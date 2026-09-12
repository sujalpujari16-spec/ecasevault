# e-CASEVAULT — Phase 0 Baseline Repository Audit & Implementation Status

**Date**: September 2026  
**Auditor**: Senior Full-Stack, Cybersecurity & Hyperledger Fabric Systems Architect  
**Repository**: Maharashtra Police – e-CASEVAULT  

---

## 1. Existing Architecture

e-CASEVAULT is designed as a high-security Digital Case and Evidence Management System for the Maharashtra Police Department under the **Blockchain & Cybersecurity** domain.

```
┌─────────────────────────────────────────────────────────────┐
│                 Client Frontend (React 19 + Vite)           │
│  - TypeScript, Tailwind CSS, Lucide Icons, Framer Motion     │
│  - Pure SessionStorage for ephemeral Bearer JWT token       │
│  - Strict Off-Chain Evidence Architecture                   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS (REST API + Bearer JWT)
┌──────────────────────────────▼──────────────────────────────┐
│             Enterprise Backend (Node.js + Express 4)         │
│  - Express Rate Limiting, Helmet Security, CORS Protection   │
│  - Bcrypt Authentication & 15m Expiry JWT Tokens            │
│  - Relational Station & Case Authorization Engine (RBAC)    │
│  - Asymmetric Digital Signatures (Ed25519)                   │
│  - Off-Chain File Encryption Engine (AES-256-GCM + Salt)     │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
┌──────────────▼─────────────┐ ┌──────────────▼───────────────┐
│ PostgreSQL Relational DB   │ │ Hyperledger Fabric 2.5 Net   │
│ - police_stations          │ │ - Channel: ecasevault-channel│
│ - users (SP/DySP/PI/OFF)   │ │ - Chaincode: ecasevault (Go) │
│ - cases (Relational PS FK) │ │ - Orgs: PoliceOrgMSP,        │
│ - case_assignments         │ │         FSLOrgMSP,           │
│ - evidence (AES metadata)  │ │         CyberCellOrgMSP      │
│ - evidence_transfers       │ │ - State: Case & Evidence     │
│ - fingerprints             │ │   Hashes, Custody Log,       │
│ - access_requests          │ │   FSL Reports, Clearances    │
│ - audit_logs & alerts      │ │ (Authoritative Hash Ledger)  │
│ - login_attempts           │ └──────────────────────────────┘
└────────────────────────────┘
```

---

## 2. Existing Working Features

1. **Cryptographic Suite**:
   - AES-256-GCM authenticated encryption/decryption with 32-byte (256-bit) cryptographically random salt, 16-byte random IV, and 16-byte authentication tag per file.
   - SHA-256 cryptographic digest computation.
   - Authentic Ed25519 asymmetric digital signing (`signPayloadAsymmetric`) and signature verification (`verifyDigitalSignature`). Server-side persistent key management.
2. **PostgreSQL Relational Schema**:
   - 11 normalized tables with foreign key constraints, check constraints, and performance indexes (`schema.sql`).
   - Migrations for encryption salt, blockchain status, `police_station_id`, and custody transfer attributes.
3. **Authentication & Session Restore**:
   - Bcrypt password hashing (`bcrypt.hash(password, 10)`).
   - JWT issuance with 15m expiration, issuer/audience validation.
   - `GET /api/auth/me` endpoint restores active officer session upon page reload.
   - Rate limiting and audit trail of failed/successful login attempts in `login_attempts`.
4. **Relational Station & Case Authorization (RBAC)**:
   - Enforces relational matching: `cases.police_station_id = users.station_id`.
   - Hierarchical access: SP/DySP statewide oversight; PI station-level; Officer assigned-only or approved access request.
   - 400 for missing case IDs; 404 for non-existent cases; 403 for unauthorized requests.
5. **Authoritative Evidence Verification**:
   - Decrypts off-chain file, computes SHA-256 digest, and evaluates against Hyperledger Fabric `VerifyEvidenceHash`.
   - **Zero database fallback**: If Fabric is offline, unconditionally returns `VERIFICATION_UNAVAILABLE`.
6. **Path Traversal Protection**:
   - Sanitizes filenames via `path.basename` and validates that resolved paths are strictly confined inside `storage/evidence/`.
7. **Automated Testing**:
   - The `npm test` glob (`server/tests/*.test.ts`) contains **16 top-level cases
     and 31 subtests (47 total)**, counted statically from source:
     - Authentication & RBAC clearance (4 tests).
     - Cryptographic engine & Ed25519 digital signatures (5 tests).
     - Off-chain storage, traversal protection, authoritative verification, and custody state transitions (4 tests).
     - Fabric gateway configuration & ledger isolation probe (1 test + 3 subtests).
     - Security matrix (1 test + 22 subtests).
     - End-to-end flow (1 test + 6 subtests).
   - **Execution status: NOT VERIFIED.** The suite was not run in the packaging
     environment (no npm registry access, so dependencies could not be
     installed). No pass/fail figure is claimed. Run `npm ci && npm test` on the
     target machine to establish an actual result.
   - `server/tests/runtime/fabric.runtime.test.ts` is deliberately excluded from
     the `npm test` glob; it requires a live Fabric network and is run via
     `npm run test:fabric`.
8. **TypeScript & Production Build**:
   - `npm run lint` (`tsc --noEmit`) and `npm run build`: **NOT VERIFIED** in the
     packaging environment for the same dependency reason. Both must be run on
     the target machine before submission.

---

## 3. Existing Broken / Incomplete Features

1. **Frontend Business ID Generation with `Math.random()`**:
   - `src/components/FingerprintTab.tsx` (line 78): generates `FP-MH-2026-...` using `Math.random()`.
   - `src/components/CaseTeamPanel.tsx` (lines 71, 158): generates assignment IDs `CA-2026-...` using `Math.random()`.
   - `src/components/AccessRequestApprovalPanel.tsx` (line 55): generates assignment IDs `CA-2026-...` using `Math.random()`.
   - `src/components/VictimInformationTab.tsx` (line 77): generates victim IDs `VIC-2026-...` using `Math.random()`.
   - `src/components/NewCaseModal.tsx` (lines 127, 132): generates case ID and FIR number using `Math.random()`.
   - `src/components/CaseAccessRequestModal.tsx` (line 41): generates request ID `AR-2026-...` using `Math.random()`.
   - `src/components/CaseDetailsModal.tsx` (lines 234, 391, 465): generates evidence tags, FSL request IDs, document IDs using `Math.random()`.
2. **Residual Mock Data Imports**:
   - `src/components/CaseDetailsModal.tsx` still imports `INITIAL_OFFICERS` from `src/data/mockCases.ts` and passes it as fallback prop.
   - `src/components/SecurityCenterView.tsx` uses hardcoded fallback alerts with hardcoded case ID `MH-MUM-2026-004821`.
   - `src/data/mockCases.ts` still exists in the repository.
3. **Local Tooling Limitations**:
   - Local workstation lacks `docker` and `go` CLI binaries in host PATH. Fabric deployment scripts and chaincode must be validated for clean reproducibility in standard containerized environments.

---

## 4. Security Vulnerabilities

1. **Chaincode Identity Check Bypasses (`main.go`)**:
   - Lines 145-148, 270-273:
     ```go
     mspID, err := ctx.GetClientIdentity().GetMSPID()
     if err == nil && mspID != "" && mspID != "PoliceOrgMSP" { ... }
     ```
     If `err != nil` (identity cannot be retrieved) or `mspID == ""`, the error is ignored and transaction execution proceeds!
     **Fix**: Explicitly fail if `err != nil` or `mspID == ""`.
2. **Chaincode Custody Transfer Impersonation Vulnerability (`main.go`)**:
   - `TransferEvidence` (lines 334-350):
     - Takes `fromOfficer` as an argument without independently validating that the authenticated Fabric caller matches the current custodian.
     - Does not check if `transferID` already exists on ledger (missing duplicate transfer guard).
     - Does not verify that `toOfficer` is non-empty and distinct from current custodian.
3. **Chaincode Case Closure Authorization (`main.go`)**:
   - `CloseCase` does not verify caller organization or supervisory role before updating status to "Closed".
4. **Duplicate / Legacy Chaincode File**:
   - `blockchain/chaincode/eCaseVault.go` is an obsolete single-file duplicate that could be accidentally packaged instead of `blockchain/chaincode/eCaseVault/`.

---

## 5. Mock / Simulated Functionality Inventory

| Area | Status | Location | Action Required |
|---|---|---|---|
| Business IDs | 🔴 In-Memory `Math.random()` | `FingerprintTab`, `CaseTeamPanel`, `NewCaseModal`, `CaseDetailsModal`, `VictimInformationTab` | Remove frontend generation; delegate to backend API or database sequences / UUIDs |
| Officers Fallback | 🟡 Static Array | `CaseDetailsModal.tsx` | Fetch real officers list via `apiClient.getOfficers()` |
| Security Alerts Fallback | 🟡 Static Array | `SecurityCenterView.tsx` | Fetch security alerts via `apiClient.getSecurityAlerts()` |
| Legacy Mock Cases File | 🔴 Legacy File | `src/data/mockCases.ts` | Disconnect and remove in Phase 8 |
| Legacy Chaincode File | 🔴 Legacy File | `blockchain/chaincode/eCaseVault.go` | Remove in Phase 16 cleanup |

---

## 6. Hyperledger Fabric Status

- **Organizations**: `PoliceOrgMSP` (port 7051), `FSLOrgMSP` (port 9051), `CyberCellOrgMSP` (port 11051), `OrdererMSP` (port 7050).
- **Channel**: `ecasevault-channel`.
- **Chaincode**: `ecasevault` (Go contract API).
- **Gateway**: Node.js `@hyperledger/fabric-gateway` connecting via authentic TLS root CA and X.509/ECDSA credentials.
- **Status**: Gateway code is real, isolated from fake memory blocks, and handles peer disconnection safely (`503 VERIFICATION_UNAVAILABLE`). Chaincode security requires hardening (Phase 2).

---

## 7. Database Status

- **Engine**: PostgreSQL 14+ compatible.
- **Relational Integrity**: Foreign keys between `cases` and `police_stations`, `case_assignments` and `cases`/`users`, `evidence` and `cases`, `evidence_transfers` and `evidence`.
- **Consistency**: Status transitions: `PENDING` -> `CONFIRMED` or `FAILED`.
- **Indexes**: Indexed by station, assigned IO, case evidence, hash, and audit actor.

---

## 8. Frontend Integration Status

- **API Client**: Strongly typed `apiClient.ts` covering Auth, Cases, Evidence, Officers, Assignments, Access Requests, Dashboard, Security Alerts, and Blockchain Explorer.
- **Session**: Session restored on mount via `apiClient.getCurrentUser()`.
- **Screens**:
  - `VaultDashboard`: fetches cases, metrics, and activities from REST API.
  - `OfficersDirectoryView`: fetches real officers from `/api/officers`.
  - `MemberManagementView`: creates and lists officers via `/api/officers`.
  - `AssignIOModal`: assigns IO via `/api/cases/:id/assign`.
  - `LoginWindow`: inputs start empty, zero hardcoded passwords.
  - Remaining: Ensure sub-tabs in `CaseDetailsModal`, `FingerprintTab`, and `CaseTeamPanel` delegate all ID generation to the backend.

---

## 9. Testing Status

- **Automated Node.js Tests**: 47 cases present in `server/tests/` (16 top-level + 31 subtests). Execution: **NOT VERIFIED** — see section 7.
- **Chaincode Unit Tests**: `blockchain/chaincode/eCaseVault/main_test.go` contains **11 test functions**, including regression tests added for case-level authorization (`TestUpdateCaseStatus_CaseLevelAuthorization`, `TestCloseCase_SupervisoryAuthorization`), separation of duties (`TestApproveAccessRequest_NoSelfEscalation`), access rejection/revocation authority (`TestRejectAndRevokeAccess_Authorization`), and fingerprint case binding (`TestRegisterFingerprint_CaseAuthorization`). Execution: **NOT VERIFIED** — no Go toolchain available in the packaging environment (`which go` exits 1). Run `go test ./...` on a Go-equipped machine.
- **Type Checking**: **NOT VERIFIED** (`tsc --noEmit` not executed here).
- **Production Build**: **NOT VERIFIED** (`vite build` not executed here).

---

## 10. Phased Execution Plan

- **Phase 0 — Baseline Audit**: Complete inventory and status documentation (**CURRENT**).
- **Phase 1 — Real Fabric Network**: Verify network reproducibility, script integrity, and configuration profiles.
- **Phase 2 — Chaincode Security**: Eliminate identity bypasses in `main.go`, enforce caller = current custodian in `TransferEvidence`, prevent duplicate transfers, enforce case closure authorization, remove duplicate `eCaseVault.go`.
- **Phase 3 — Database & Transaction Consistency**: Verify foreign key cascades, ensure `PENDING` -> `CONFIRMED` / `FAILED` state transitions, idempotency checks.
- **Phase 4 — Authentication**: Rate limiting, brute-force lockout audit, password reset security.
- **Phase 5 — Complete Authorization**: Strict case-level authorization tests across all roles (SP, DySP, PI, OFFICER).
- **Phase 6 — Evidence Management**: AES-256-GCM off-chain encryption, authoritative Fabric verification, path traversal protection.
- **Phase 7 — Digital Signatures & Chain of Custody**: Ed25519 signing and verification, custodian update only upon confirmed Fabric transaction.
- **Phase 8 — Remove All Mock Data**: Eliminate `Math.random` business IDs, remove `INITIAL_CASES` / `INITIAL_OFFICERS` / `mockCases.ts`.
- **Phase 9 — Complete Frontend/API Integration**: Ensure every screen and modal mutates and fetches via API with loading and error states.
- **Phase 10 — Blockchain Transaction Ledger**: Authentic Fabric transactions explorer.
- **Phase 11 — Audit & Security Alerts**: Append-only audit logs for all security actions.
- **Phase 12 — Error Handling & API Quality**: Centralized Express error handler with safe client messages and request IDs.
- **Phase 13 — Production Security**: CORS, Helmet, rate limiting, zero secret leaks, sanitized `.env.example`.
- **Phase 14 — Automated Testing Suite**: Comprehensive unit and integration test coverage.
- **Phase 15 — Clean Checkout Verification**: Validation from a fresh clone perspective.
- **Phase 16 — Final Repository Cleanup**: Purge dead code, temporary artifacts, and duplicate files.
- **Phase 17 — README & SIH Documentation**: Authoritative setup and architecture documentation.
- **Phase 18 — Final Full-System Acceptance Test**: Complete gate check across all acceptance criteria.
