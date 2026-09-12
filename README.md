# MAHARASHTRA POLICE — e-CASEVAULT
### Enterprise Digital Case & Evidence Vault on Hyperledger Fabric 2.5

```text
React + TypeScript
        │
        │ HTTPS + JWT (Role-Based Access Control)
        ▼
Node.js + Express REST API (Port 5001)
        │
   ┌────┴────────────────────────┬────────────────────────┐
   ▼                             ▼                        ▼
PostgreSQL Database       Encrypted Storage        Fabric Gateway SDK
(Cases, Users, Evidence,  (AES-256-GCM Binary      (gRPC + TLS 1.3)
 Audit Logs, Alerts)       Off-chain Files)               │
                                                          ▼
                                                 Hyperledger Fabric 2.5
                                                 ├── PoliceOrgMSP (peer0:7051)
                                                 ├── FSLOrgMSP (peer0:9051)
                                                 ├── CyberCellOrgMSP (peer0:11051)
                                                 └── Channel: ecasevault-channel
                                                     Chaincode: ecasevault
```

---

## 🏛 Architecture Overview

**e-CASEVAULT** implements a defense-in-depth architecture where:
1. **PostgreSQL** serves as the operational database for users, police stations, cases, metadata, access control, and operational audit logs.
2. **Encrypted Storage (`storage/evidence/`)** securely stores actual evidence files (PDFs, images, videos, audio, forensic reports) off-chain using **AES-256-GCM** encryption with unique 16-byte random salts, initialization vectors, and authentication tags.
3. **Hyperledger Fabric 2.5** is the immutable trust layer. It stores cryptographic SHA-256 evidence digests, case registration proofs, forensic report digests, biometric fingerprint hashes, and complete chain-of-custody transfer records. Evidence files themselves are **never stored on-chain**.

---

## 📋 Prerequisites

Ensure the following tools are installed on your host system:

1. **Docker & Docker Compose** (v2.0+)
   ```bash
   docker --version
   docker compose version
   ```
2. **Node.js** (v18+ or v20+) and **npm**
   ```bash
   node --version
   npm --version
   ```
3. **Go** (v1.20+) — required for compiling and testing chaincode
   ```bash
   go version
   ```
4. **PostgreSQL** (v14+)
   ```bash
   psql --version
   ```
5. **OpenSSL** (v1.1.1+ or v3.0+)
   ```bash
   openssl version
   ```

---

## 🚀 Quickstart: Step-by-Step Setup

### Step 1: Clone Repository & Install Node Dependencies
```bash
cd maharashtra-police---e-casevault-2
npm install
```

### Step 2: Generate X.509 ECDSA Credentials for Organizations
Run the deterministic crypto generation script to generate ECDSA (prime256v1) certificates and keys for **PoliceOrgMSP**, **FSLOrgMSP**, and **CyberCellOrgMSP**:
```bash
./blockchain/network/generate-crypto.sh
```

### Step 3: Start the Hyperledger Fabric Network
Launch the Orderer, Peers, and Fabric CLI containers:
```bash
./blockchain/network/network.sh up
```

### Step 4: Create Channel & Join Peers
Create `ecasevault-channel` and join all organizational peers:
```bash
./blockchain/network/network.sh createChannel
```

### Step 5: Deploy the eCaseVault Chaincode
Package, install, approve, and commit the authoritative Go chaincode (`blockchain/chaincode/eCaseVault/main.go`) to the channel:
```bash
./blockchain/network/network.sh deployCC
```

Or execute all network setup steps in one command:
```bash
./blockchain/network/network.sh all
```

---

## 🗄 Step 6: Configure Environment & Database

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Configure database credentials in `.env`. Generate the two cryptographic
   secrets with `openssl rand -hex 32` — never reuse a value copied from
   documentation, since any published secret is compromised by definition:
   ```env
   DATABASE_URL=postgresql://casevault_app:REPLACE_WITH_DB_PASSWORD@localhost:5432/casevault
   JWT_SECRET=REPLACE_WITH_OPENSSL_RAND_HEX_32
   ENCRYPTION_MASTER_KEY=REPLACE_WITH_OPENSSL_RAND_HEX_32
   ```

3. Initialize PostgreSQL schema:
   ```bash
   psql -U postgres -d casevault -f server/db/schema.sql
   psql -U postgres -d casevault -f server/db/migrations/001_add_encryption_salt.sql
   psql -U postgres -d casevault -f server/db/migrations/002_add_blockchain_status.sql
   ```

---

## 🖥 Step 7: Start Backend & Frontend

### Terminal 1: Backend Express REST API Server
```bash
npx tsx server/index.ts
```
The server starts on port `5001`. Verify health at:
```bash
curl http://localhost:5001/api/health
```

### Terminal 2: React + Vite Frontend
```bash
npm run dev
```
Open your browser at `http://localhost:3000` (or `http://localhost:5173`).

---

## 🧪 Integration Testing & Ledger Queries

### Run Automated Fabric Integration Test
```bash
./scripts/test-fabric-integration.sh
```

### Run Chaincode Unit Tests
```bash
cd blockchain/chaincode/eCaseVault
go test -v ./...
```

### Query Fabric Directly via Fabric CLI
Inspect committed records on `ecasevault-channel` independently of Node.js:
```bash
# Query Case Asset
docker exec casevault-cli peer chaincode query \
  -C ecasevault-channel -n ecasevault \
  -c '{"function":"GetCase","Args":["MH-MUM-2026-004821"]}'

# Query Evidence History
docker exec casevault-cli peer chaincode query \
  -C ecasevault-channel -n ecasevault \
  -c '{"function":"GetEvidenceHistory","Args":["EV-001"]}'
```

---

## 🛑 Teardown & Reset

To stop the network and preserve ledger state:
```bash
docker compose -f blockchain/docker-compose.yaml stop
```

To completely destroy the network and remove volumes:
```bash
./blockchain/network/network.sh down
```
