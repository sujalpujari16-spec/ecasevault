# e-CASEVAULT — System Architecture Documentation

## 1. Executive Summary
e-CASEVAULT is a permissioned digital case and evidence management platform designed for law enforcement agencies (Maharashtra Police). It decouples operational state from immutable audit proofs by leveraging:
- **PostgreSQL**: Operational state (users, cases, evidence metadata, access requests, audit logs, security alerts).
- **Encrypted Local Disk Storage (`storage/evidence/`)**: Off-chain storage for AES-256-GCM encrypted binary evidence payloads.
- **Hyperledger Fabric 2.5**: Immutable blockchain ledger for case registration, evidence SHA-256 digests, and custody transfer events.

---

## 2. Technical System Diagram

```
                React / Vite UI
                      │
                 HTTPS / JWT
                      │
                      ▼
            Node.js / Express API
                      │
      ┌───────────────┼───────────────┐
      │               │               │
      ▼               ▼               ▼
 PostgreSQL      Encrypted File   Fabric Gateway
 Database        Disk Storage     Client SDK
 (Operational)   (Off-Chain)           │
                                       ▼
                              Hyperledger Fabric
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ▼                        ▼                        ▼
         PoliceOrgMSP              FSLOrgMSP             CyberCellOrgMSP
```

---

## 3. Data Ownership Matrix

| Operational Entity | Storage Location | Key Attributes / Cryptographic Guarantees |
|---|---|---|
| **Users & Credentials** | PostgreSQL | Password hashes computed using `bcrypt` (work factor 12). |
| **Case Metadata & FIR** | PostgreSQL + Fabric | FIR number, crime type, police station; case creation registered on Fabric. |
| **Case Repository Documents** | Disk / Supabase + Fabric | Stored encrypted (AES-256-GCM); SHA-256 bound to case repository on Fabric. |
| **Evidence Metadata** | PostgreSQL + Fabric | Storage locker, custodian, original SHA-256 digest, Fabric transaction ID. |
| **Evidence Binary Payload**| Disk (`storage/evidence/`) | AES-256-GCM encrypted payload (`.enc`), random 16-byte salt, random 16-byte IV. |
| **Immutable Chain of Custody**| Fabric Ledger | Transfer history, from/to officers, timestamp, client identity (MSP). |

---

## 4. Canonical Five Stakeholder Roles

e-CASEVAULT strictly enforces five canonical stakeholder roles across the entire platform (PostgreSQL, Express RBAC, Fabric MSP, and React UI):

```
                    e-CASEVAULT
                         │
          ┌──────────────┼──────────────┐
          │              │              │
       POLICE         FORENSIC        LEGAL
          │              │              │
          └──────────────┼──────────────┘
                         │
                 Shared Case Repository
                         │
                 ┌───────┴───────┐
              AUDITOR          ADMIN
```

1. **POLICE**
   - First Information Report (FIR) generation & BNS/BNSS/BSA classification.
   - Active investigation diary, witness statements, panchnama documentation.
   - Physical & digital evidence collection, AES-256-GCM staging, custody transfers.
   - CCTNS integration and prisoner remand management.
2. **FORENSIC**
   - Forensic Science Laboratory (FSL) request processing.
   - Scientific examination, DNA analysis, ballistics reports, digital forensics.
   - Cryptographically signed examination reports bound to evidence items.
3. **LEGAL**
   - Legal review of case materials and charge sheet preparation.
   - Remand applications, court filing submissions, bail opposition, judgments.
   - Court proceedings & warrant management via ICJS e-Courts bridge.
4. **AUDITOR**
   - Immutable audit log inspection and SHA-256 hash-chain verification.
   - Cross-stakeholder access monitoring, download capability auditing, vigilance alerts.
   - Strictly read-only; prohibited from creating cases, evidence, or modifying custody.
5. **ADMIN**
   - Officer provisioning, credential rotation, station & unit management.
   - System security policies, antivirus & malware quarantine configuration.
   - Separation of powers: prohibited from uploading evidence or falsifying investigations.

---

## 5. Inter-Operable Criminal Justice System (ICJS) Multi-Pillar Integrations

Rather than treating correctional facilities and national crime databases as application user logins, e-CASEVAULT implements them as **ICJS Multi-Pillar Integration Modules**:

- **Prisons / Custody Pillar (e-Prisons)**: Inmate custody admission, transfer between jail and court, biometric verification, and medical remand tracking. Accessible to authorized `POLICE`, `LEGAL`, and `ADMIN` personnel.
- **Crime Records Pillar (NCRB / CCTNS)**: National crime statistics lookup, statewide wanted-person queries, modus operandi search, and repeat-offender intelligence. Accessible across `POLICE`, `LEGAL`, `AUDITOR`, and `ADMIN`.

---

## 6. One Case → One Comprehensive Repository

Each registered case functions as a unified digital repository with department-isolated document trees:

```
CASE-2026-001 (CR-2026-001)
│
├── POLICE INVESTIGATION
│   ├── FIR & GD Entries
│   ├── Investigation Diary (Case Diary)
│   ├── Witness Statements & Panchnamas
│   └── Digital & Physical Evidence Items
│
├── FORENSIC EXAMINATION
│   ├── FSL Requests
│   ├── DNA / Ballistics / Cyber Reports
│   └── Scientific Evidence Verifications
│
├── LEGAL PROCEEDINGS
│   ├── Charge Sheet (Form 55)
│   ├── Remand Applications & Bail Orders
│   └── Court Filings & Final Judgments
│
└── AUDIT & INTEGRITY
    ├── User Access & Download Audits
    ├── Biometric Liveness Confirmations
    └── Hyperledger Fabric Chain of Custody Transactions
```

