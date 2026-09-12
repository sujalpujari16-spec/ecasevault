# e-CASEVAULT System Updates & Changelog

## Date: September 6, 2026

This document records the latest user-requested modifications made to the Maharashtra Police e-CASEVAULT system.

---

### 1. Police Officers Only in Dropdowns & Rosters
- **Objective:** Only sworn police officers must appear in officer selection dropdowns and personnel lists. Non-police roles (e.g. Chief Forensic Scientist *Dr. Neha V. Sawant, Ph.D.*, public prosecutors, auditors, and jail wardens) must be strictly excluded.
- **Backend Changes:**
  - `server/routes/officers.ts`:
    - Updated `GET /api/officers` to support a `?role=POLICE` query parameter.
    - Updated the offline demo fallback (`getOfflineOfficersForUser`) to filter officers by role when the query parameter is passed.
    - Added rank-based filtering so non-police designations are removed from police lists.
- **Frontend Changes:**
  - `src/services/apiClient.ts`: Added optional `role?: string` parameter to `getOfficers(role?: string)`.
  - `src/components/AssignIOModal.tsx`: Calls `apiClient.getOfficers('POLICE')` and checks rank prefixes to display only police personnel.
  - `src/components/CaseTeamPanel.tsx`: Removed forensic scientists (`Dr. Neha V. Sawant`, `Dr. Smita Kelkar`) from mock fallbacks and filtered `availableOfficers` strictly to police officers.
  - `src/components/NewCaseModal.tsx`: Step 4 Investigating Officer selection filtered strictly for police officers.
  - `src/components/OfficersDirectoryView.tsx` & `src/components/MemberManagementView.tsx`: Exclusively lists active police officers.
  - `src/components/CaseDetailsModal.tsx`: Loads `apiClient.getOfficers('POLICE')`.

---

### 2. Retain Context on Adding Items (No Unwanted Redirects)
- **Objective:** Prevent the app from dumping the user back out to the main dashboard when registering a case, assigning an officer, or adding investigation items.
- **Changes Applied:**
  - `src/components/VaultDashboard.tsx`:
    - In `handleNewCaseCreated` and `onCreateCase`: When a new case is registered, the application immediately sets `setSelectedCaseForDetails(newCase)` and `setIsCaseDetailsOpen(true)`, taking the officer directly inside the newly created case docket.
    - In `onAssignSuccess`: When an officer is assigned or reassigned via `AssignIOModal`, the modal updates `selectedCaseForDetails` directly without kicking the user out.
    - In `fetchAllData`: Safely preserves `selectedCaseForDetails` and merges fresh server data without overwriting local sub-arrays or closing open dialogs.
    - Adding investigation notes, diary entries, evidence items, and case team members preserves the active tab and view state.

---

### 3. Completely Removed 3D Docket View
- **Objective:** Remove the 3D Docket Viewer button and trigger completely from the application.
- **Changes Applied:**
  - `src/components/CaseDetailsModal.tsx`:
    - Removed the gold `3D Docket Viewer` header button.
    - Removed `onOpen3DDiary` from `CaseDetailsModalProps` and component parameters.
  - `src/components/VaultDashboard.tsx`:
    - Removed `onOpen3DDiary` prop passed to `CaseDetailsModal`.

---

### 4. Simplified User-Friendly Language Across the UI
- **Objective:** Replace dense legal, technical, and bureaucratic terminology with clear, plain, everyday words.
- **Changes Applied:**
  - **Sidebar Navigation:**
    - `POLICE Dashboard Overview` $\rightarrow$ `Police Dashboard`
    - `All Cases (N)` $\rightarrow$ `All Cases (N)`
    - `Officer & Personnel Roster` $\rightarrow$ `Police Officers`
    - `Crime Analytics & Stats` $\rightarrow$ `Reports & Statistics`
    - `Audit Trail & Activity` $\rightarrow$ `Activity Log`
    - `Evidence Vault (N)` $\rightarrow$ `Evidence Vault (N)`
  - **Case Details & Modals:**
    - `First Information Report (FIR) Statutory Record` $\rightarrow$ `Case Summary & Details`
    - `Assigned IO` $\rightarrow$ `Assigned Officer`
    - `Lead Investigating Officer (IO)` $\rightarrow$ `Lead Investigating Officer`
    - `Reassign IO` $\rightarrow$ `Change Officer`
    - `Legal Scrutiny Directives` $\rightarrow$ `Legal Advice & Notes`
    - `Approve Final Closure & Seal` $\rightarrow$ `Close Case`
    - `Investigation Journal` $\rightarrow$ `Investigation Notes`
    - `Evidence & Chain of Custody` $\rightarrow$ `Evidence`
    - `FSL Forensics` $\rightarrow$ `Lab Reports`
    - `Court Orders & Judgments` $\rightarrow$ `Court Process`
    - `Crime Classification` $\rightarrow$ `Crime Type`
    - `Applied Acts & Sections` $\rightarrow$ `Applicable Laws & Sections`
    - `Case Narrative & Summary Notes` $\rightarrow$ `Case Summary`
    - `Official Signed Physical FIR Hardcopy Scan` $\rightarrow$ `Signed Paper FIR Copy`
    - `View Official FIR Docket In-App` $\rightarrow$ `View Case Details`
    - `Upload Signed FIR Hardcopy Photo` $\rightarrow$ `Upload Paper Photo`
    - `Statutory Compliance` $\rightarrow$ `Status & Approvals`
    - `CrPC 157 Notice: Transmitted to Magistrate` $\rightarrow$ `Court Notice: Sent to Magistrate`
    - `Malkhana Entry: SHA-256 Logged` $\rightarrow$ `Evidence Storage: Securely Stored`
  - **Modals & Panels:**
    - `Assign Lead IO` $\rightarrow$ `Assign Investigating Officer`
    - `Select IO from Station Directory` $\rightarrow$ `Select Police Officer`
    - `Supervisory Directive / Assignment Instructions` $\rightarrow$ `Assignment Notes / Instructions`
    - `Add Case Member` $\rightarrow$ `Add Officer to Case`

---

### 5. Verification & Test Results
- **Automated Tests:**
  - `npm test`: **178/178 tests passed** across 22 test suites (0 failures).
- **TypeScript Compilation:**
  - `npx tsc --noEmit`: 0 errors.
- **Production Build:**
  - `npm run build`: Successfully built Vite distribution in `dist/`.
- **API Verification:**
  - `GET /api/officers?role=POLICE`: Verified to return only police personnel; non-police roles are strictly omitted.

---

## Date: September 7, 2026 — Enterprise Security, 5 Canonical Roles & Packaging Updates

### 1. Admin Police Station Management & Station Creation
- **Objective:** Give System Administrators the ability to register and configure new police stations dynamically across Maharashtra.
- **Backend Changes:**
  - `server/routes/stations.ts`: Implemented `POST /api/stations` restricted to `ADMIN` role with validation for station name, code, district, commissionerate/range, and address.
  - Updates in-memory and persistent station registry.
- **Frontend Changes:**
  - `src/components/AdministrationView.tsx`: Added interactive "Add New Police Station" form allowing Admins to create new stations with code, district, and jurisdiction.
  - Dynamically updates station lists across the application without requiring a rebuild.

---

### 2. Officer Creation with Photo Upload
- **Objective:** Allow Administrators and Unit Commanders to upload official uniform portrait photos when creating new officers.
- **Backend Changes:**
  - `server/routes/officers.ts`: Updated `POST /api/officers` with `multer` multipart support (`upload.single('photo')`) to handle binary photo uploads securely, saving to `storage/photos/` with validated image MIME types and generating accessible photo URLs.
- **Frontend Changes:**
  - `src/components/MemberManagementView.tsx`: Added a photo upload drag-and-drop selector with instant image preview, allowing photo selection from local disk or webcam.
  - Photo is automatically associated with the newly provisioned badge and displayed in officer rosters.

---

### 3. Canonical 5 Stakeholder Roles Enforcement
- **Objective:** Strictly align the architecture with the five canonical stakeholder roles:
  $$\text{POLICE} \quad \big| \quad \text{FORENSIC} \quad \big| \quad \text{LEGAL} \quad \big| \quad \text{AUDITOR} \quad \big| \quad \text{ADMIN}$$
- **Architectural Re-framing:**
  - Completely removed `JAIL` and `NCRB` as user login accounts or system roles.
  - Reframed Prisons (`e-Prisons`) and Crime Records (`NCRB/CCTNS`) as **ICJS Multi-Pillar Integration Modules** accessible to authorized operational roles (`POLICE`, `LEGAL`, `ADMIN`, `AUDITOR`).
- **Changes Applied:**
  - `src/types.ts`: `PoliceRole` type set strictly to `'POLICE' | 'FORENSIC' | 'LEGAL' | 'AUDITOR' | 'ADMIN'`.
  - `src/utils/policeWorkflow.ts`: Removed `JAIL` and `NCRB` keys from `ROLE_PERMISSIONS` and `RANKS_BY_CREATOR`. Normalized legacy tokens (`JAIL`, `PRISON`, `NCRB`, `SCRB`) into `POLICE`.
  - `src/components/LoginWindow.tsx`: Standardized on a 5-pillar role selection grid (`grid-cols-5`) representing the five canonical roles.
  - `src/components/VaultDashboard.tsx`: Embedded ICJS Multi-Pillar View as an operational module in the navigation for authorized personnel.
  - `server/db/schema.sql`: Database schema CHECK constraint enforced: `CHECK (role IN ('POLICE', 'FORENSIC', 'LEGAL', 'AUDITOR', 'ADMIN'))`.
  - `server/middleware/auth.ts`, `server/middleware/rbac.ts`, `server/middleware/rbacScope.ts`: Strict 5-role enforcement across all authorization gates.

---

### 4. Authentication: Fail-Closed Security & Elimination of Dev Fallbacks
- **Objective:** Ensure production authentication is cryptographically sound with no development bypasses.
- **Changes Applied:**
  - `server/routes/auth.ts`:
    - Completely removed `password.length >= 3` and any arbitrary password acceptance.
    - Separated `PRODUCTION` mode from `DEMO` mode: in production, every login requires authoritative PostgreSQL active officer lookup and `bcrypt` hash verification.
    - If the database is unreachable, the system fails closed with `503 Service Unavailable`.
  - `server/middleware/auth.ts`:
    - In `verifyActiveOfficer()`, eliminated the catch block fallback that bypassed database verification. If PostgreSQL is offline, requests fail closed (503) rather than proceeding with unverified JWT claims.

---

### 5. Document Download Capability Token (No Role Manufacture)
- **Objective:** Prevent download tokens from manufacturing privileged system roles like `role: 'POLICE'`.
- **Changes Applied:**
  - `server/services/documentRepoService.ts` & `server/routes/documents.ts`:
    - `generateDownloadToken` cryptographically signs short-lived HMAC capability tokens containing:
      `{ scope: 'DOCUMENT_DOWNLOAD', documentId, caseId, userId, badge, role, station, iat, exp }`.
    - `authenticateDownload` unpacks genuine caller identity and authorization capability rather than fabricating elevated roles.

---

### 6. Architectural Positioning (PostgreSQL + Fabric)
- **Objective:** Clearly articulate the enterprise architecture for SIH evaluation.
- **Positioning:**
  - **PostgreSQL**: Authoritative operational database for live state, searches, and relational data.
  - **Hyperledger Fabric**: Immutable trust and audit layer for SHA-256 digests and custody transfer transactions.
  - **Encrypted File Storage**: AES-256-GCM off-chain encrypted disk storage for evidence binaries.
- **Documentation:**
  - Updated `docs/ARCHITECTURE.md` with complete diagrams, role matrices, ICJS multi-pillar integration architecture, and the "One Case $\rightarrow$ One Repository" hierarchy.

---

### 7. Submission Packaging & Cleanliness
- **Objective:** Ensure evaluator ZIP packages build cleanly on any target machine (macOS / Linux / Windows) without architecture mismatch errors.
- **Changes Applied:**
  - `scripts/package-submission.sh`: Cleans and excludes `node_modules/`, `dist/`, `.DS_Store`, `__MACOSX/`, `.env`, and encrypted test caches (`*.enc`).
  - Added `"package"` and `"package:zip"` commands in `package.json`.
  - Automated verification confirms **0 violations across 189 files**, producing `maharashtra-police-e-casevault-submission.zip`.

---

### 8. Identity & Case Link (Candidate Matching & Case History)
- **Objective:** Implement a realistic, ethical biometric search engine for police investigators without "face $\to$ criminal" profiling:
  $$\text{Face Image} \longrightarrow \text{128-d Embedding} \longrightarrow \text{Candidate Matches} \longrightarrow \text{Officer Verification} \longrightarrow \text{Authorized Case History}$$
- **Architectural Rules:**
  - **Police Dashboard Only:** Feature is strictly scoped to `POLICE` role; non-investigative roles cannot perform biometric searches.
  - **Mandatory Pre-requisites:** Requires active Case ID, Investigative Purpose (`CCTV investigation`, `Suspect verification`, `Missing person`, etc.), and written Justification before running queries.
  - **Person Registry vs. Criminal Database:** Queries a central `persons` registry and calculates cosine similarity across enrolled 128-d vectors.
  - **Multi-Candidate Review:** Returns ranked candidates ($93.2\%$, $81.4\%$, etc.) requiring explicit human officer confirmation.
  - **Statutory Witness Exclusion:** In compliance with witness protection guidelines, any case relationship marked `WITNESS` is strictly omitted from biometric search output.
  - **Victim Privacy Guard:** For individuals associated as `VICTIM`, personal contact details are masked (`contactMasked: true`) under Section 73 BSA.
  - **Blockchain Audit Chaining:** Every search is hashed (SHA-256) and anchored to the Fabric ledger with `searchId`, officer badge, purpose, and timestamp.
  - **Abuse Detection Engine:** Automatically flags high-velocity search bursts across few cases (`flagged_abuse = true`) for supervisory and Auditor review.
  - **Auditor Dashboard Integration:** Added **Biometric Audit & Police Search Accountability** section to `AuditorDashboardView.tsx` showing live search metrics, officer search velocities, and blockchain transaction receipts.
- **Backend Changes:**
  - `server/db/schema.sql`: Added `persons`, `biometric_profiles`, `person_case_relationships`, `biometric_searches`, and `biometric_search_candidates` tables and indexes.
  - `server/services/biometricService.ts`: Embedding generation, cosine similarity ranking, privacy filtering, abuse detection, and audit hash-chaining.
  - `server/routes/identitySearch.ts`: `POST /api/identity/search`, `POST /api/identity/confirm`, and `GET /api/identity/audit`.
  - `server/index.ts`: Mounted `/api/identity` route.
- **Frontend Changes:**
  - `src/services/apiClient.ts`: Added `searchIdentity`, `confirmIdentity`, and `getBiometricAuditTrail`.
  - `src/components/IdentitySearchPanel.tsx`: New comprehensive police investigation panel with CCTV frame preview, candidate review cards, human verification, and case history.
  - `src/components/VaultDashboard.tsx`: Added `Identity & Case Link` navigation menu item and view rendering exclusively for `POLICE`.
  - `src/components/AuditorDashboardView.tsx`: Integrated Biometric Audit & Abuse Telemetry view.

---

### 9. Verification & System Metrics
- **TypeScript Compilation:** `npm run lint` (`tsc --noEmit`) $\rightarrow$ **0 errors**.
- **Automated Test Suite:** `npm test` $\rightarrow$ **183/183 tests passed** across 23 test suites (including 7 new biometric identity & privacy tests).
- **Production Build:** `npm run build` $\rightarrow$ **Vite bundle succeeded in 2.73s**.
- **Package Cleanliness:** `npm run package` $\rightarrow$ **Clean ZIP verified with 0 violations across 193 files** (`maharashtra-police-e-casevault-submission.zip`).
- **Runtime Services:**
  - Backend API: Running on port **5001** (`http://localhost:5001/api/health`)
  - Frontend Application: Running on port **3000** (`http://localhost:3000`)


