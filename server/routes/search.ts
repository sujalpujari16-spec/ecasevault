import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { authenticateJwt } from '../middleware/auth';
import { buildCaseScope, buildEvidenceScope } from '../middleware/rbacScope';

export const searchRouter = Router();

// GET /api/search — Parameterized, RBAC-filtered search across cases and evidence
searchRouter.get('/', authenticateJwt, async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  if (!q) {
    res.json({ success: true, query: '', total: 0, cases: [], evidence: [] });
    return;
  }

  const searchPattern = `%${q}%`;
  const user = req.user!;

  try {
    // Need-to-know scope for cases. $1 is the search pattern, so the scope
    // allocates its placeholders from $2 onward.
    const caseScope = buildCaseScope(user, 'c', 2);
    const caseParams: any[] = [searchPattern, ...caseScope.params];

    const casesLimitIndex = caseParams.length + 1;
    const casesOffsetIndex = caseParams.length + 2;
    caseParams.push(limit, offset);

    const casesQuery = `
      SELECT c.id, c.fir_number, c.case_title, c.police_station, c.crime_type, c.status, c.priority,
             c.assigned_io, c.assigned_io_badge, c.incident_date, c.blockchain_status
      FROM cases c
      WHERE (c.fir_number ILIKE $1
         OR c.case_title ILIKE $1
         OR c.id ILIKE $1
         OR c.police_station ILIKE $1
         OR c.crime_type ILIKE $1
         OR c.assigned_io ILIKE $1
         OR c.assigned_io_badge ILIKE $1
         OR c.status ILIKE $1)
      AND ${caseScope.clause}
      ORDER BY c.created_at DESC
      LIMIT $${casesLimitIndex} OFFSET $${casesOffsetIndex}
    `;

    // Evidence must belong to cases that the user is authorized to access.
    const evidenceScope = buildEvidenceScope(user, 'e', 2);
    const evidenceParams: any[] = [searchPattern, ...evidenceScope.params];

    const evLimitIndex = evidenceParams.length + 1;
    const evOffsetIndex = evidenceParams.length + 2;
    evidenceParams.push(limit, offset);

    const evidenceQuery = `
      SELECT e.id, e.case_id, e.evidence_tag, e.category, e.description, e.collected_by,
             e.current_custodian, e.status, e.storage_locker, e.is_integrity_verified, e.blockchain_status
      FROM evidence e
      WHERE (e.evidence_tag ILIKE $1
         OR e.id ILIKE $1
         OR e.description ILIKE $1
         OR e.category ILIKE $1
         OR e.current_custodian ILIKE $1
         OR e.collected_by ILIKE $1)
      AND ${evidenceScope.clause}
      ORDER BY e.created_at DESC
      LIMIT $${evLimitIndex} OFFSET $${evOffsetIndex}
    `;

    const [casesResult, evidenceResult] = await Promise.all([
      pool.query(casesQuery, caseParams),
      pool.query(evidenceQuery, evidenceParams),
    ]);

    res.json({
      success: true,
      query: q,
      page,
      limit,
      cases: casesResult.rows,
      evidence: evidenceResult.rows,
      totalMatches: casesResult.rows.length + evidenceResult.rows.length,
    });
  } catch (err: any) {
    console.error('[SEARCH API ERROR]', err);
    res.status(500).json({
      success: false,
      error: 'Search operation failed. Please try again.',
      requestId: `REQ-${Date.now()}`,
    });
  }
});
