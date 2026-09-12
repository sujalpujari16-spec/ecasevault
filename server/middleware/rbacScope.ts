/**
 * ============================================================================
 * e-CASEVAULT — Row-Level (Need-to-Know) Case Visibility Scope
 * ============================================================================
 * SINGLE SOURCE OF TRUTH for "which cases may this officer see?".
 *
 * Every list endpoint that exposes case-derived rows (cases, evidence,
 * evidence_transfers, fingerprints, access requests, ledger transactions)
 * MUST derive its WHERE clause from buildCaseScope(). Hand-rolling a filter
 * per dataset is what previously allowed /api/blockchain/transactions to leak
 * custody transfers across police stations: two of three datasets were
 * filtered and the third was not.
 *
 * Authorization model (default deny):
 *   SP       — statewide clearance.
 *   DySP     — authorized jurisdiction only (own division/zone), NOT statewide.
 *   PI       — own police station only.
 *   OFFICER  — assigned cases only (assigned IO, active team assignment, or an
 *              approved non-expired cross-station access grant).
 *
 * Status comparisons are case-insensitive on purpose: schema.sql defaults
 * case_assignments.status to 'Active' and access_requests.status to 'Pending',
 * while application code writes 'ACTIVE'/'APPROVED'. A case-sensitive
 * comparison silently denies legitimately assigned officers.
 * ============================================================================
 */

export type SystemRole = 'POLICE' | 'FORENSIC' | 'LEGAL' | 'AUDITOR' | 'ADMIN';
export type OfficerRole = SystemRole; // backwards type alias

export interface RbacScopeUser {
  role: SystemRole | string;
  badgeNo: string;
  station_id?: string;
  station?: string;
}

export interface CaseScope {
  /** SQL boolean expression over `alias`, safe to embed in a WHERE clause. */
  clause: string;
  /** Ordered bind parameters the clause references. */
  params: string[];
  /** True for statewide clearance roles (AUDITOR, ADMIN). Used by tests to assert scoping. */
  unrestricted: boolean;
  /** Role the scope was derived for, after normalisation. */
  role: SystemRole;
}

/** Roles recognised by the authorization model. Strictly the 5 canonical system roles. */
const KNOWN_ROLES: SystemRole[] = ['POLICE', 'FORENSIC', 'LEGAL', 'AUDITOR', 'ADMIN'];

/**
 * Normalises an inbound role claim strictly into one of the 5 canonical system roles.
 */
export function normaliseRole(role: unknown): SystemRole {
  if (typeof role !== 'string') return 'POLICE';
  const trimmed = role.trim().toUpperCase();
  const match = KNOWN_ROLES.find((r) => r.toUpperCase() === trimmed);
  if (match) return match;

  if (trimmed === 'FORENSIC' || trimmed === 'FSL') return 'FORENSIC';
  if (trimmed === 'LEGAL' || trimmed === 'LEGAL OFFICER' || trimmed === 'PROSECUTOR') return 'LEGAL';
  if (trimmed === 'JAIL' || trimmed === 'PRISON' || trimmed === 'SUPERINTENDENT' || trimmed === 'WARDEN') return 'POLICE';
  if (trimmed === 'NCRB' || trimmed === 'SCRB' || trimmed === 'CRIME RECORDS') return 'POLICE';
  if (trimmed === 'AUDITOR' || trimmed === 'AUDIT' || trimmed === 'VIGILANCE') return 'AUDITOR';
  if (trimmed === 'ADMIN' || trimmed === 'ADMINISTRATOR' || trimmed === 'SUPERVISOR') return 'ADMIN';

  return 'POLICE';
}

/**
 * Builds the row-level visibility predicate for an authenticated officer.
 *
 * @param user       Authenticated officer, taken from the verified JWT claim.
 * @param alias      SQL alias of the `cases` table in the caller's query.
 * @param startIndex 1-based index of the first bind placeholder to allocate.
 */
export function buildCaseScope(
  user: RbacScopeUser,
  alias = 'c',
  startIndex = 1
): CaseScope {
  const role = normaliseRole(user?.role);
  const badge = (user?.badgeNo ?? '').trim();

  // AUDITOR has statewide read-only oversight for compliance inspection
  // ADMIN has statewide visibility for user/access administration
  if (role === 'AUDITOR' || role === 'ADMIN') {
    return { clause: 'TRUE', params: [], unrestricted: true, role };
  }

  // Default deny: an officer with no badge identity can see nothing.
  if (!badge) {
    return { clause: 'FALSE', params: [], unrestricted: false, role };
  }

  // Bind index for :badge parameter
  const p1 = `$${startIndex}`;

  // Predicate: officer is the recorded lead investigator / assigned IO
  const assignedIo = `(${alias}.assigned_io_badge = ${p1} OR ${alias}.lead_investigator_badge = ${p1} OR ${alias}.investigating_officer_id = ${p1})`;

  // Predicate: officer has an active row in case_assignments
  const activeTeamAssignment =
    `EXISTS (` +
    `SELECT 1 FROM case_assignments ca ` +
    `WHERE ca.case_id = ${alias}.id ` +
    `  AND (ca.user_id = ${p1} OR ca.officer_id = ${p1}) ` +
    `  AND UPPER(ca.status) = 'ACTIVE'` +
    `)`;

  // Predicate: officer holds an unexpired approved access grant
  const approvedAccessGrant =
    `(` +
    `EXISTS (` +
    `SELECT 1 FROM access_requests ar ` +
    `WHERE ar.case_id = ${alias}.id ` +
    `  AND (ar.user_id = ${p1} OR ar.requested_by_badge = ${p1}) ` +
    `  AND UPPER(ar.status) = 'APPROVED' ` +
    `  AND (ar.expires_at IS NULL OR ar.expires_at > CURRENT_TIMESTAMP)` +
    `) OR EXISTS (` +
    `SELECT 1 FROM case_access_grants cag ` +
    `WHERE cag.case_id = ${alias}.id ` +
    `  AND (cag.user_badge = ${p1} OR cag.user_id = ${p1}) ` +
    `  AND UPPER(cag.status) = 'ACTIVE' ` +
    `  AND (cag.expires_at IS NULL OR cag.expires_at > CURRENT_TIMESTAMP)` +
    `))`;

  // Predicate: case has an active forensic request for FSL
  const forensicCaseLink =
    `EXISTS (` +
    `SELECT 1 FROM forensic_requests fr ` +
    `WHERE fr.case_id = ${alias}.id ` +
    `  AND fr.status IN ('PENDING', 'ACCEPTED', 'UNDER_EXAMINATION', 'REPORT_FILED')` +
    `)`;

  // Predicate: case is at prosecution stage / legal scrutiny
  const legalCaseLink =
    `(${alias}.status IN ('Legal Review', 'Charge Sheet / Court Process', 'Charge Sheet / Prosecution Stage', 'Forensic Examination', 'Investigation Ongoing', 'Closed'))`;

  // --- Role composition ----------------------------------------------------
  const shared = [assignedIo, activeTeamAssignment, approvedAccessGrant];

  let predicates: string[];
  if (role === 'FORENSIC') {
    predicates = [forensicCaseLink, ...shared];
  } else if (role === 'LEGAL') {
    predicates = [legalCaseLink, ...shared];
  } else {
    // POLICE: Own assigned cases or approved grants only (Same station != automatic access)
    predicates = [...shared];
  }

  return {
    clause: `(${predicates.join(' OR ')})`,
    params: [badge],
    unrestricted: false,
    role,
  };
}

/**
 * Convenience wrapper: predicate restricting an `evidence` alias to evidence
 * belonging to cases the officer may see.
 */
export function buildEvidenceScope(
  user: RbacScopeUser,
  evidenceAlias = 'e',
  startIndex = 1
): CaseScope {
  const scope = buildCaseScope(user, 'sc', startIndex);
  if (scope.unrestricted) return scope;
  return {
    ...scope,
    clause: `${evidenceAlias}.case_id IN (SELECT sc.id FROM cases sc WHERE ${scope.clause})`,
  };
}

/**
 * Convenience wrapper: predicate restricting an `evidence_transfers` alias to
 * transfers of evidence belonging to cases the officer may see.
 *
 * This is the filter whose absence caused the cross-station custody leak.
 */
export function buildTransferScope(
  user: RbacScopeUser,
  transferAlias = 't',
  startIndex = 1
): CaseScope {
  const scope = buildCaseScope(user, 'sc', startIndex);
  if (scope.unrestricted) return scope;
  return {
    ...scope,
    clause:
      `${transferAlias}.evidence_id IN (` +
      `SELECT se.id FROM evidence se WHERE se.case_id IN (` +
      `SELECT sc.id FROM cases sc WHERE ${scope.clause}))`,
  };
}
