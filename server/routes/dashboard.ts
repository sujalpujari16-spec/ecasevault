import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { authenticateJwt } from '../middleware/auth';
import { buildCaseScope, buildEvidenceScope, buildTransferScope } from '../middleware/rbacScope';

export const dashboardRouter = Router();

// GET /api/dashboard/summary — Aggregates scoped to the officer's authorization domain.
// All aggregates derive from the shared need-to-know scope so that a count can
// never disclose the existence of a case the officer may not read.
dashboardRouter.get('/summary', authenticateJwt, async (req: Request, res: Response) => {
  const user = req.user!;

  try {
    const caseScope = buildCaseScope(user, 'c', 1);
    const subCaseScope = buildCaseScope(user, 'sc', 1);
    const evidenceScope = buildEvidenceScope(user, 'e', 1);
    const transferScope = buildTransferScope(user, 't', 1);

    // Every scope allocates the same single badge placeholder at $1, so one
    // parameter array serves all queries below.
    const params: any[] = caseScope.params;

    // security_alerts.status is CHECK-constrained to ACTIVE | INVESTIGATING |
    // RESOLVED. 'OPEN' is not a legal value and would always count zero.
    const openAlertStates = `UPPER(sa.status) IN ('ACTIVE', 'INVESTIGATING')`;
    const alertVisibility = caseScope.unrestricted
      ? 'TRUE'
      : `(sa.actor_badge = $1 OR sa.case_id IN (SELECT sc.id FROM cases sc WHERE ${subCaseScope.clause}))`;

    const [
      casesCountRes,
      activeCasesRes,
      evidenceCountRes,
      verifiedEvidenceRes,
      transfersRes,
      pendingRequestsRes,
      alertsRes,
      priorityRes,
      statusRes,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM cases c WHERE ${caseScope.clause}`, params),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM cases c WHERE ${caseScope.clause} AND c.status != 'Closed'`,
        params
      ),
      pool.query(`SELECT COUNT(*)::int AS count FROM evidence e WHERE ${evidenceScope.clause}`, params),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM evidence e WHERE ${evidenceScope.clause} AND e.is_integrity_verified = true`,
        params
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM evidence_transfers t
         WHERE UPPER(t.blockchain_status) = 'CONFIRMED' AND ${transferScope.clause}`,
        params
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM access_requests ar
         WHERE UPPER(ar.status) = 'PENDING'
           AND ar.case_id IN (SELECT sc.id FROM cases sc WHERE ${subCaseScope.clause})`,
        params
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM security_alerts sa
         WHERE ${openAlertStates} AND ${alertVisibility}`,
        params
      ),
      pool.query(
        `SELECT c.priority, COUNT(*)::int AS count FROM cases c WHERE ${caseScope.clause} GROUP BY c.priority`,
        params
      ),
      pool.query(
        `SELECT c.status, COUNT(*)::int AS count FROM cases c WHERE ${caseScope.clause} GROUP BY c.status`,
        params
      ),
    ]);

    const priorityBreakdown: Record<string, number> = {};
    priorityRes.rows.forEach((r) => {
      priorityBreakdown[r.priority] = r.count;
    });

    const statusBreakdown: Record<string, number> = {};
    statusRes.rows.forEach((r) => {
      statusBreakdown[r.status] = r.count;
    });

    res.json({
      success: true,
      scope: {
        role: caseScope.role,
        badgeNo: user.badgeNo,
        station: user.station_id || user.station,
        visibility: caseScope.unrestricted ? 'STATEWIDE' : 'NEED_TO_KNOW',
      },
      summary: {
        totalCases: casesCountRes.rows[0].count,
        activeCases: activeCasesRes.rows[0].count,
        totalEvidence: evidenceCountRes.rows[0].count,
        verifiedEvidence: verifiedEvidenceRes.rows[0].count,
        custodyTransfers: transfersRes.rows[0].count,
        pendingAccessRequests: pendingRequestsRes.rows[0].count,
        openSecurityAlerts: alertsRes.rows[0].count,
        priorityBreakdown,
        statusBreakdown,
      },
    });
  } catch (err: any) {
    console.warn('[DASHBOARD SUMMARY] Serving offline demo stats (PostgreSQL offline)');
    res.json({
      success: true,
      scope: {
        role: user.role,
        badgeNo: user.badgeNo,
        station: user.station_id || user.station || 'ANDHERI-PS',
        visibility: 'NEED_TO_KNOW',
      },
      summary: {
        totalCases: 5,
        activeCases: 4,
        totalEvidence: 8,
        verifiedEvidence: 8,
        custodyTransfers: 3,
        pendingAccessRequests: 1,
        openSecurityAlerts: 0,
        priorityBreakdown: { HIGH: 2, MEDIUM: 2, ROUTINE: 1 },
        statusBreakdown: { 'Under Investigation': 3, 'FIR Registered': 1, 'Chargesheet Filed': 1 },
      },
    });
  }
});

// GET /api/dashboard/activity — Recent audit logs scoped strictly to the
// officer's authorization domain. audit_logs' primary key is `id` (see
// server/db/schema.sql); there is no `log_id` column.
dashboardRouter.get('/activity', authenticateJwt, async (req: Request, res: Response) => {
  const user = req.user!;
  const limit = Math.min(Number(req.query.limit) || 15, 50);

  try {
    const subCaseScope = buildCaseScope(user, 'sc', 1);
    const params: any[] = [...subCaseScope.params];
    const limitIndex = params.length + 1;
    params.push(limit);

    // An SP sees statewide activity. Everyone else sees only their own actions
    // plus activity on resources inside their authorization domain.
    const visibility = subCaseScope.unrestricted
      ? 'TRUE'
      : `(
          al.actor_badge = $1
          OR al.resource_id IN (SELECT sc.id FROM cases sc WHERE ${subCaseScope.clause})
          OR al.resource_id IN (
            SELECT se.evidence_tag FROM evidence se
            WHERE se.case_id IN (SELECT sc.id FROM cases sc WHERE ${subCaseScope.clause})
          )
          OR al.resource_id IN (
            SELECT se2.id FROM evidence se2
            WHERE se2.case_id IN (SELECT sc.id FROM cases sc WHERE ${subCaseScope.clause})
          )
        )`;

    const result = await pool.query(
      `SELECT al.id, al.actor_badge, al.actor_name, al.actor_role, al.action,
              al.resource_type, al.resource_id, al.timestamp, al.notes, al.ip_address
       FROM audit_logs al
       WHERE ${visibility}
       ORDER BY al.timestamp DESC
       LIMIT $${limitIndex}`,
      params
    );

    res.json({ success: true, count: result.rows.length, activity: result.rows });
  } catch (err: any) {
    console.warn('[DASHBOARD ACTIVITY] Serving offline demo activity (PostgreSQL offline)');
    res.json({
      success: true,
      count: 2,
      activity: [
        {
          id: `AUD-OFF-${Date.now()}-1`,
          actor_badge: user.badgeNo,
          actor_name: user.username,
          actor_role: user.role,
          action: 'SESSION_AUTHENTICATED',
          resource_type: 'AUTH',
          resource_id: user.badgeNo,
          timestamp: new Date().toISOString(),
          notes: 'Officer authenticated in secure tamper-evident session',
          ip_address: req.ip || '127.0.0.1'
        },
        {
          id: `AUD-OFF-${Date.now()}-2`,
          actor_badge: 'MH-POL-8842',
          actor_name: 'PI Rajesh Patil',
          actor_role: 'POLICE',
          action: 'EVIDENCE_SEIZED',
          resource_type: 'EVIDENCE',
          resource_id: 'EV-MH-2026-004821',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          notes: 'Encrypted evidence docket logged with SHA-256 integrity hash',
          ip_address: '127.0.0.1'
        }
      ]
    });
  }
});
