# e-CASEVAULT — Deployment & Environment Guide

## 1. Prerequisites
- Node.js v18+ & npm
- PostgreSQL 16+

---

## 2. PostgreSQL Setup & Migrations

```bash
# 1. Create PostgreSQL database
createdb casevault

# 2. Run DDL Schema
psql casevault < server/db/schema.sql

# 3. Run Migrations
psql casevault < server/db/migrations/001_add_encryption_salt.sql

# 4. Seed initial database users
npx tsx server/db/seed.ts
```

---

## 3. Environment Variables Configuration (`.env`)

Copy `.env.example` to `.env` and replace every placeholder below with a freshly
generated secret. The placeholders are intentionally NOT valid values — never
deploy a secret that was copied out of documentation, a tutorial, or a git
history, since anything published is compromised by definition.

Generate the two cryptographic secrets with:

```bash
# 64-character random JWT signing secret
openssl rand -hex 32

# 32-byte AES-256 master key for evidence encryption
openssl rand -hex 32
```

```env
NODE_ENV=development
PORT=5001
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://casevault_app:REPLACE_WITH_DB_PASSWORD@localhost:5432/casevault
JWT_SECRET=REPLACE_WITH_OPENSSL_RAND_HEX_32
ENCRYPTION_MASTER_KEY=REPLACE_WITH_OPENSSL_RAND_HEX_32
FABRIC_CHANNEL=ecasevault-channel
FABRIC_CHAINCODE=ecasevault
FABRIC_MSP_ID=PoliceOrgMSP
FABRIC_PEER_ENDPOINT=localhost:7051
```

> **Security note.** `ENCRYPTION_MASTER_KEY` is the root of trust for all
> AES-256-GCM evidence encryption. If it is lost, previously encrypted evidence
> cannot be decrypted; if it leaks, the off-chain evidence store must be treated
> as compromised. Store it in a secrets manager or HSM, never in the repository.

---

## 4. Launching System Services

```bash
# Start backend server
npx tsx server/index.ts

# Start frontend application
npm run dev
```
