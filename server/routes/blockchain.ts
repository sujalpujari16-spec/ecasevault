import { Router, Request, Response } from 'express';
import { fabricGateway } from '../services/fabricGateway';
import { pool } from '../config/database';
import { authenticateJwt } from '../middleware/auth';
import { authorizeCaseAccess, verifyCaseAccessForUser } from '../middleware/caseAccess';
import { buildCaseScope, buildEvidenceScope, buildTransferScope } from '../middleware/rbacScope';
import { blockchainEventService } from '../services/blockchainEventService';

export const blockchainRouter = Router();

// Apply JWT authentication to all blockchain exploration endpoints
blockchainRouter.use(authenticateJwt);

/**
 * GET /api/blockchain/transactions
 * Committed Fabric transaction records, read from the persistent store.
 *
 * Every one of the three source datasets is filtered through the SAME
 * need-to-know scope (server/middleware/rbacScope.ts). evidence_transfers was
 * previously returned unfiltered, which leaked chain-of-custody transfers
 * across police stations to any authenticated officer.
 */
blockchainRouter.get('/transactions', async (req: Request, res: Response) => {
  const user = req.user!;

  try {
    const caseScope = buildCaseScope(user, 'c');
    const evidenceScope = buildEvidenceScope(user, 'e');
    const transferScope = buildTransferScope(user, 't');

    const [casesRes, evidenceRes, transfersRes] = await Promise.all([
      pool.query(
        `SELECT c.blockchain_tx_id AS "txId", 'CASE_REGISTRATION' AS "txType", c.id AS "resourceId",
                c.pi_in_charge AS "actor", 'PoliceOrgMSP' AS "organization", c.created_at AS "timestamp",
                c.blockchain_status AS "status"
         FROM cases c
         WHERE c.blockchain_tx_id IS NOT NULL AND ${caseScope.clause}`,
        caseScope.params
      ),
      pool.query(
        `SELECT e.blockchain_tx_id AS "txId", 'EVIDENCE_REGISTRATION' AS "txType", e.evidence_tag AS "resourceId",
                e.collected_by AS "actor", 'PoliceOrgMSP' AS "organization", e.created_at AS "timestamp",
                e.blockchain_status AS "status"
         FROM evidence e
         WHERE e.blockchain_tx_id IS NOT NULL AND ${evidenceScope.clause}`,
        evidenceScope.params
      ),
      pool.query(
        `SELECT t.blockchain_tx_id AS "txId", 'CUSTODY_TRANSFER' AS "txType", t.evidence_id AS "resourceId",
                t.from_officer AS "actor", 'PoliceOrgMSP' AS "organization", t.timestamp,
                t.blockchain_status AS "status"
         FROM evidence_transfers t
         WHERE t.blockchain_tx_id IS NOT NULL AND ${transferScope.clause}`,
        transferScope.params
      ),
    ]);

    const transactions = [...casesRes.rows, ...evidenceRes.rows, ...transfersRes.rows].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    res.json({
      success: true,
      count: transactions.length,
      scope: caseScope.unrestricted ? 'STATEWIDE' : 'NEED_TO_KNOW',
      transactions,
    });
  } catch (err: any) {
    console.error('[BLOCKCHAIN TX ERROR]', err);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve blockchain transactions',
      requestId: `REQ-${Date.now()}`,
    });
  }
});

/**
 * GET /api/blockchain/blocks
 * Direct Fabric block retrieval is NOT enabled in this deployment. Reading raw
 * blocks requires a channel event/BlockEvent subscription with the peer's
 * Deliver service, which is deliberately not wired up here.
 *
 * This endpoint reports its unimplemented state explicitly. It must never
 * return `{ success: true, blocks: [] }` — an empty array is indistinguishable
 * from "the ledger is empty" and misrepresents an unbuilt feature as real data.
 */
blockchainRouter.get('/blocks', async (_req: Request, res: Response) => {
  res.status(501).json({
    success: false,
    status: 'NOT_IMPLEMENTED',
    message: 'Direct Fabric block retrieval is not enabled',
  });
});

// GET /api/blockchain/stats — Get Fabric connection status & channel metadata
blockchainRouter.get('/stats', async (_req: Request, res: Response) => {
  const isConnected = await fabricGateway.checkConnection();
  res.json({
    success: true,
    status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
    channel: process.env.FABRIC_CHANNEL || 'ecasevault-channel',
    chaincode: process.env.FABRIC_CHAINCODE || 'ecasevault',
    mspId: process.env.FABRIC_MSP_ID || 'PoliceOrgMSP',
    peerEndpoint: process.env.FABRIC_PEER_ENDPOINT || 'localhost:7051',
  });
});

// GET /api/blockchain/case/:id — Query case directly from Fabric world state (Case Authorized)
blockchainRouter.get('/case/:id', authorizeCaseAccess, async (req: Request, res: Response) => {
  try {
    const caseData = await fabricGateway.getCase(req.params.id);
    res.json({
      success: true,
      caseId: req.params.id,
      data: caseData,
    });
  } catch (err: any) {
    console.error(`[BLOCKCHAIN GET CASE ERROR] Case ${req.params.id}:`, err);
    res.status(404).json({
      success: false,
      error: `Case record ${req.params.id} is not committed or not found on the Fabric ledger`,
      requestId: `REQ-${Date.now()}`,
    });
  }
});

// GET /api/blockchain/case/:id/history — Query case transaction history from Fabric (Case Authorized)
blockchainRouter.get('/case/:id/history', authorizeCaseAccess, async (req: Request, res: Response) => {
  try {
    const historyStr = await fabricGateway.evaluateTransaction('GetCaseHistory', [req.params.id], 'POLICE');
    res.json({
      success: true,
      caseId: req.params.id,
      history: JSON.parse(historyStr),
    });
  } catch (err: any) {
    console.error(`[BLOCKCHAIN CASE HISTORY ERROR] Case ${req.params.id}:`, err);
    res.status(503).json({
      success: false,
      error: 'Unable to query case ledger history at this time',
      requestId: `REQ-${Date.now()}`,
    });
  }
});

// Middleware to authorize access to an evidence item before querying Fabric ledger
async function authorizeEvidenceAccess(req: Request, res: Response, next: any): Promise<void> {
  const evidenceId = req.params.id;
  const user = req.user!;

  try {
    const dbResult = await pool.query(
      'SELECT id, case_id FROM evidence WHERE id = $1 OR evidence_tag = $1',
      [evidenceId]
    );

    if (dbResult.rows.length === 0) {
      res.status(404).json({ success: false, error: `Evidence item '${evidenceId}' not found` });
      return;
    }

    const caseId = dbResult.rows[0].case_id;
    const hasAccess = await verifyCaseAccessForUser(caseId, user);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: 'Access Denied: You do not have clearance to inspect blockchain records for this evidence item',
        requestId: `REQ-${Date.now()}`,
      });
      return;
    }

    req.params.internalId = dbResult.rows[0].id;
    next();
  } catch (err: any) {
    console.error('[BLOCKCHAIN EVIDENCE AUTH ERROR]', err);
    res.status(500).json({ success: false, error: 'Authorization check failed', requestId: `REQ-${Date.now()}` });
  }
}

// GET /api/blockchain/evidence/:id/history — Query real evidence history from chaincode (Authorized)
blockchainRouter.get('/evidence/:id/history', authorizeEvidenceAccess, async (req: Request, res: Response) => {
  const targetId = req.params.internalId || req.params.id;

  try {
    const history = await fabricGateway.getEvidenceHistory(targetId);
    res.json({
      success: true,
      evidenceId: req.params.id,
      history,
    });
  } catch (err: any) {
    console.error(`[BLOCKCHAIN EVIDENCE HISTORY ERROR] Evidence ${req.params.id}:`, err);
    res.status(503).json({
      success: false,
      status: 'VERIFICATION_UNAVAILABLE',
      error: 'Unable to query evidence ledger history at this time',
      requestId: `REQ-${Date.now()}`,
    });
  }
});

// GET /api/blockchain/evidence/:id/verify — Query and verify evidence hash directly from Fabric (Authorized)
blockchainRouter.get('/evidence/:id/verify', authorizeEvidenceAccess, async (req: Request, res: Response) => {
  const targetId = req.params.internalId || req.params.id;
  const sha256 = (req.query.hash as string) || '';
  if (!sha256) {
    res.status(400).json({ success: false, error: 'Query parameter "hash" is required for verification' });
    return;
  }

  try {
    const result = await fabricGateway.verifyEvidenceHash(targetId, sha256);
    res.json({
      success: true,
      evidenceId: req.params.id,
      verificationResult: result,
      status: result === 'VERIFIED_INTEGRITY_MATCH' ? 'VERIFIED' : 'TAMPERED',
    });
  } catch (err: any) {
    console.error(`[BLOCKCHAIN EVIDENCE VERIFY ERROR] Evidence ${req.params.id}:`, err);
    res.status(503).json({
      success: false,
      error: 'Fabric evidence verification query failed',
      requestId: `REQ-${Date.now()}`,
    });
  }
});

/**
 * GET /api/blockchain/events
 * Retrieves immutable blockchain activity chain events, optionally filtered by caseId.
 */
blockchainRouter.get('/events', async (req: Request, res: Response) => {
  const caseId = req.query.caseId as string;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

  try {
    let events = caseId 
      ? blockchainEventService.getEventsByCaseId(caseId) 
      : blockchainEventService.getAllEvents();

    if (limit && !isNaN(limit) && limit > 0) {
      events = events.slice(-limit);
    }

    res.json({
      success: true,
      caseId: caseId || null,
      count: events.length,
      events,
    });
  } catch (err: any) {
    console.error('[BLOCKCHAIN EVENTS ERROR]', err);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve blockchain events',
      requestId: `REQ-${Date.now()}`,
    });
  }
});

/**
 * GET /api/blockchain/events/verify
 * Cryptographically verifies hash continuity and mathematical integrity of the activity chain.
 */
blockchainRouter.get('/events/verify', async (req: Request, res: Response) => {
  const caseId = req.query.caseId as string;

  try {
    const events = caseId 
      ? blockchainEventService.getEventsByCaseId(caseId)
      : undefined;

    const report = blockchainEventService.verifyEventChainIntegrity(events);

    res.json({
      success: true,
      caseId: caseId || null,
      report,
    });
  } catch (err: any) {
    console.error('[BLOCKCHAIN EVENTS VERIFY ERROR]', err);
    res.status(500).json({
      success: false,
      error: 'Failed to verify blockchain chain integrity',
      requestId: `REQ-${Date.now()}`,
    });
  }
});

/**
 * GET /api/blockchain/events/latest
 * Retrieves the latest event in the blockchain chain.
 */
blockchainRouter.get('/events/latest', async (_req: Request, res: Response) => {
  try {
    const all = blockchainEventService.getAllEvents();
    const latestEvent = all.length > 0 ? all[all.length - 1] : null;
    const latestEventHash = blockchainEventService.getLatestEventHash();

    res.json({
      success: true,
      latestEvent,
      latestEventHash,
      totalEvents: all.length,
    });
  } catch (err: any) {
    console.error('[BLOCKCHAIN LATEST EVENT ERROR]', err);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve latest blockchain event',
      requestId: `REQ-${Date.now()}`,
    });
  }
});

