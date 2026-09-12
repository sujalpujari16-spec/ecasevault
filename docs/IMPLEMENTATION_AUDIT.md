# e-CASEVAULT — Full Project Audit & Architecture Map

## 1. Current Architecture Overview
The system is built as a React + TypeScript frontend (Vite, Tailwind CSS, Framer Motion) paired with a Node.js + Express REST API server running on port `5001`.

```
                    e-CASEVAULT
                         │
                 React / Vite UI
                         │
                    HTTPS / JWT
                         │
                         ▼
                Node.js / Express API
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
     PostgreSQL     Encrypted Local   Fabric Gateway
     Database       Storage           SDK Client
     (Operational)  (Off-Chain files)  (Hyperledger Fabric)
```

---

## 2. Existing Functionality vs. Simulated Components

| Component | Status | Production Implementation |
|---|---|---|
| **UI Presentation Layer** | 🟢 Complete | React / Vite UI screens (Dashboard, Cases, FIR, Evidence, Fingerprints, Access Requests, Security Center, Explorer). |
| **Database Persisted Data** | 🟢 Ready | PostgreSQL tables (`users`, `cases`, `evidence`, `evidence_transfers`, `access_requests`, `audit_logs`, `security_alerts`, `login_attempts`). |
| **Authentication & RBAC** | 🟢 Production | Bcrypt password hashing (`work factor 12`), 15-minute signed JWT access tokens, server-side `authorizeRole` and `authorizeCaseAccess` middleware. |
| **Off-Chain Encrypted Storage**| 🟢 Production | AES-256-GCM binary file payload encryption stored off-chain in `storage/evidence/{evidenceTag}.enc`. |
| **Simulated Ledger Engine** | 🔴 Fake / Remove | Legacy `_fabricBlocks` array in `fabricService.ts`, `_onChainTransactions` array in `fabricGateway.ts`, and local browser `appendBlock()` calls in `src/utils/blockchainLedger.ts`. |
| **Fabric Smart Contracts** | 🟢 Ready | Production Go Chaincode [`blockchain/chaincode/eCaseVault/main.go`](blockchain/chaincode/eCaseVault/main.go) with `GetClientIdentity()` MSP checks and history iterators. |

---

## 3. Identifiers to Replace

1. **Simulated Memory Blocks**: Remove `_fabricBlocks` in `server/services/fabricService.ts` and `_onChainTransactions` in `server/services/fabricGateway.ts`.
2. **Browser-Side Ledger**: Replace `appendBlock()` and `getLedger()` calls in React components (`FingerprintTab.tsx`, `EvidenceIntegrityModal.tsx`, `AccessRequestApprovalPanel.tsx`, `VaultDashboard.tsx`) with backend REST API calls.
3. **Random Identifier Generation**: Replace `Math.random()` calls for security IDs with `crypto.randomUUID()`.

---

## 4. Implementation Strategy & Execution Order

- **Phase A**: Security & Environment Fail-Fast Cleanup (`DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_MASTER_KEY`).
- **Phase B**: PostgreSQL Operational Source of Truth (`users`, `cases`, `evidence`, `audit_logs`, `security_alerts`).
- **Phase C**: Off-Chain Encrypted Evidence Storage & SHA-256 Integrity Verification (`storage/evidence/`).
- **Phase D**: Server-Side RBAC & Case-Level Default-Deny Authorization (`authorizeCaseAccess`).
- **Phase E**: Hyperledger Fabric Gateway Client SDK Integration (`server/services/fabricGateway.ts`).
- **Phase F**: Go Chaincode Hardening (`ctx.GetClientIdentity().GetMSPID()`).
- **Phase G**: UI Synchronization & End-to-End Verification.
