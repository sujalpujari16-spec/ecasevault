import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../config/database';
import { authenticateJwt } from '../middleware/auth';
import { authorizeRole } from '../middleware/rbac';
import { auditService } from '../services/auditService';
import { casePersistenceService } from '../services/casePersistenceService';
import { blockchainEventService } from '../services/blockchainEventService';

export const accessRequestsRouter = Router();

// GET /api/access-requests — List access requests (Scoped by RBAC)
accessRequestsRouter.get('/', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { status, caseId } = req.query as { status?: string; caseId?: string };

  try {
    let requests: any[] = [];
    try {
      let query = `
        SELECT ar.*, c.case_title, c.police_station
        FROM access_requests ar
        LEFT JOIN cases c ON ar.case_id = c.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (user.role === 'ADMIN' || user.role === 'AUDITOR') {
        // Full system-wide visibility
      } else if (user.role === 'POLICE') {
        params.push(user.badgeNo);
        query += ` AND (c.assigned_io_badge = $1 OR c.investigating_officer_id = $1 OR ar.requested_by_badge = $1)`;
      } else {
        params.push(user.badgeNo);
        query += ` AND ar.requested_by_badge = $1`;
      }

      if (status) {
        params.push(status);
        query += ` AND ar.status = $${params.length}`;
      }

      if (caseId) {
        params.push(caseId);
        query += ` AND ar.case_id = $${params.length}`;
      }

      query += ' ORDER BY ar.requested_at DESC';

      const result = await pool.query(query, params);
      requests = result.rows;
    } catch {
      // Database offline
    }

    if (requests.length === 0) {
      const stored = casePersistenceService.getAccessRequests({
        status: status as string,
        caseId: caseId as string,
      });

      // Filter stored requests by scope
      requests = stored.filter(r => {
        if (user.role === 'ADMIN' || user.role === 'AUDITOR') return true;
        if (r.requester_badge === user.badgeNo) return true;
        const targetCase = casePersistenceService.getCaseById(r.case_id);
        if (targetCase && (targetCase.investigating_officer_id === user.badgeNo || targetCase.assigned_io_badge === user.badgeNo)) {
          return true;
        }
        return false;
      }).map(r => {
        const targetCase = casePersistenceService.getCaseById(r.case_id);
        return {
          ...r,
          request_id: r.id,
          requested_by_badge: r.requester_badge,
          requested_by_name: r.requester_name,
          requested_by_role: r.requester_role,
          clearance_requested: r.requested_permission,
          requested_at: r.created_at,
          case_title: targetCase?.case_title || `Case ${r.case_id}`,
          police_station: targetCase?.police_station || 'Maharashtra Police',
        };
      });
    }

    res.json({ success: true, count: requests.length, requests });
  } catch (err: any) {
    console.error('[ACCESS REQUESTS GET ERROR]', err);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve access requests',
      requestId: `REQ-${Date.now()}`,
    });
  }
});

// POST /api/access-requests — Request temporary case access
accessRequestsRouter.post('/', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { caseId, reason, clearanceRequested, requestedDurationHours } = req.body;

  if (!caseId || !reason) {
    res.status(400).json({ success: false, error: 'caseId and reason are required' });
    return;
  }

  try {
    const hours = Number(requestedDurationHours) || 24;
    const targetCase = casePersistenceService.getCaseById(caseId);

    // Save in persistent store
    const storedReq = casePersistenceService.createAccessRequest({
      case_id: caseId,
      requester_badge: user.badgeNo,
      requester_name: user.name || user.username || `Officer ${user.badgeNo}`,
      requester_role: user.role,
      requester_station_id: user.station_id || user.station,
      reason,
      requested_permission: clearanceRequested || 'CONFIDENTIAL',
      requested_duration_hours: hours,
    });

    const requestId = storedReq.id;

    // Try DB insert if online
    try {
      await pool.query(
        `INSERT INTO access_requests (
           request_id, case_id, requested_by_badge, requested_by_name, 
           requested_by_role, clearance_requested, reason, status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')`,
        [
          requestId,
          caseId,
          user.badgeNo,
          user.name || user.username,
          user.role,
          clearanceRequested || 'CONFIDENTIAL',
          reason,
        ]
      );
    } catch {
      // Store fallback handled
    }

    // Audit log
    await auditService.logAuditEvent({
      action: 'ACCESS_REQUESTED',
      eventType: 'ACCESS',
      userId: user.badgeNo,
      userName: user.name || user.username,
      userRole: user.role,
      caseId,
      resourceType: 'CASE',
      resourceId: caseId,
      status: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      reason: `Requested access to Case ${caseId} for: ${reason} (Duration: ${hours}h)`,
    });

    // Blockchain Event: ACCESS_REQUESTED
    const blockchainEv = await blockchainEventService.createBlockchainEvent({
      caseId,
      entityId: requestId,
      entityType: 'ACCESS',
      action: 'ACCESS_REQUESTED',
      actorId: user.badgeNo,
      actorName: user.name || user.username,
      metadata: {
        requestId,
        caseId,
        requesterBadge: user.badgeNo,
        requesterStation: user.station_id || user.station || 'UNKNOWN',
        reason,
        requestedDurationHours: hours,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Access clearance request submitted to Station Command and Admin',
      requestId,
      blockchainTxId: blockchainEv.blockchainTxId,
      eventHash: blockchainEv.eventHash,
    });
  } catch (err: any) {
    console.error('[ACCESS REQUEST SUBMIT ERROR]', err);
    res.status(500).json({
      success: false,
      error: 'Failed to submit access request',
      requestId: `REQ-${Date.now()}`,
    });
  }
});

// POST /api/access-requests/:id/approve — Approve access request
accessRequestsRouter.post('/:id/approve', authenticateJwt, authorizeRole('ADMIN', 'POLICE'), async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = req.user!;
  const { durationHours } = req.body;
  const hours = Number(durationHours) || 24;

  try {
    const result = casePersistenceService.approveAccessRequest(id, user.badgeNo, hours);
    if (!result) {
      res.status(404).json({ success: false, error: 'Access request not found or not in PENDING status' });
      return;
    }

    const { request: reqData, grant } = result;

    // Try DB update if online
    try {
      await pool.query(
        `UPDATE access_requests
         SET status = 'APPROVED',
             reviewed_by_badge = $1,
             reviewed_at = CURRENT_TIMESTAMP,
             expires_at = $2
         WHERE request_id = $3`,
        [user.badgeNo, grant.expires_at, id]
      );
    } catch {
      // Handled in store
    }

    // Audit log
    await auditService.logAuditEvent({
      action: 'ACCESS_APPROVED',
      eventType: 'ACCESS',
      userId: user.badgeNo,
      userName: user.name || user.username,
      userRole: user.role,
      caseId: reqData.case_id,
      resourceType: 'CASE',
      resourceId: reqData.case_id,
      status: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      reason: `Approved access request ${id} for officer ${reqData.requester_badge} (Expires: ${grant.expires_at})`,
    });

    // Blockchain Event: ACCESS_APPROVED
    const blockchainEv = await blockchainEventService.createBlockchainEvent({
      caseId: reqData.case_id,
      entityId: id,
      entityType: 'ACCESS',
      action: 'ACCESS_APPROVED',
      actorId: user.badgeNo,
      actorName: user.name || user.username,
      metadata: {
        requestId: id,
        caseId: reqData.case_id,
        grantedToBadge: reqData.requester_badge,
        approvedByBadge: user.badgeNo,
        expiresAt: grant.expires_at,
        grantId: grant.id,
      },
    });

    res.json({
      success: true,
      message: `Access granted for ${hours} hours`,
      expiresAt: grant.expires_at,
      request: reqData,
      grant,
      blockchainTxId: blockchainEv.blockchainTxId,
      eventHash: blockchainEv.eventHash,
    });
  } catch (err: any) {
    console.error('[ACCESS REQUEST APPROVE ERROR]', err);
    res.status(500).json({
      success: false,
      error: 'Failed to approve access request',
      requestId: `REQ-${Date.now()}`,
    });
  }
});

// POST /api/access-requests/:id/reject — Reject access request
accessRequestsRouter.post('/:id/reject', authenticateJwt, authorizeRole('ADMIN', 'POLICE'), async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = req.user!;
  const { rejectionReason } = req.body;

  try {
    const rejectedReq = casePersistenceService.rejectAccessRequest(
      id,
      user.badgeNo,
      rejectionReason || 'Declined by Administrator'
    );

    if (!rejectedReq) {
      res.status(404).json({ success: false, error: 'Access request not found or not in PENDING status' });
      return;
    }

    // Try DB update if online
    try {
      await pool.query(
        `UPDATE access_requests
         SET status = 'REJECTED',
             reviewed_by_badge = $1,
             reviewed_at = CURRENT_TIMESTAMP,
             rejection_reason = $2
         WHERE request_id = $3`,
        [user.badgeNo, rejectionReason || 'Access request declined', id]
      );
    } catch {
      // Handled in store
    }

    // Audit log
    await auditService.logAuditEvent({
      action: 'ACCESS_REJECTED',
      eventType: 'ACCESS',
      userId: user.badgeNo,
      userName: user.name || user.username,
      userRole: user.role,
      caseId: rejectedReq.case_id,
      resourceType: 'CASE',
      resourceId: rejectedReq.case_id,
      status: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      reason: `Rejected access request ${id} for officer ${rejectedReq.requester_badge}: ${rejectionReason || 'Declined'}`,
    });

    // Blockchain Event: ACCESS_REJECTED
    const blockchainEv = await blockchainEventService.createBlockchainEvent({
      caseId: rejectedReq.case_id,
      entityId: id,
      entityType: 'ACCESS',
      action: 'ACCESS_REJECTED',
      actorId: user.badgeNo,
      actorName: user.name || user.username,
      metadata: {
        requestId: id,
        caseId: rejectedReq.case_id,
        rejectedOfficerBadge: rejectedReq.requester_badge,
        rejectedByBadge: user.badgeNo,
        rejectionReason: rejectionReason || 'Declined',
      },
    });

    res.json({
      success: true,
      message: 'Access request rejected',
      request: rejectedReq,
      blockchainTxId: blockchainEv.blockchainTxId,
      eventHash: blockchainEv.eventHash,
    });
  } catch (err: any) {
    console.error('[ACCESS REQUEST REJECT ERROR]', err);
    res.status(500).json({
      success: false,
      error: 'Failed to reject access request',
      requestId: `REQ-${Date.now()}`,
    });
  }
});

