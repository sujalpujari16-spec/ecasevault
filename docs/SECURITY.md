# e-CASEVAULT — Cybersecurity & Cryptographic Model

## 1. Authentication & JWT Token Strategy
- **Password Protection**: Passwords are pre-hashed using `bcrypt` (work factor 12).
- **Access Tokens**: Short-lived signed `jsonwebtoken` tokens expiring in 15 minutes (`15m`).
- **Claim Integrity**: User identity (`userId`, `badgeNo`, `role`, `station`) is derived strictly from server-side JWT claims. Client-submitted roles are ignored.
- **Account Lockout**: 15-minute account lockout enforced after 5 consecutive failed login attempts recorded in `login_attempts` table.

---

## 2. Cryptographic Evidence Protection
- **SHA-256 Hashing**: Binary content SHA-256 digest computed off-chain and registered on Hyperledger Fabric.
- **AES-256-GCM Encryption**: Payload binary encrypted using random 16-byte salt, KDF, and random 16-byte IV.
- **Tamper Detection**: On evidence verification, payload is decrypted, re-hashed, and compared against stored Fabric digest. Hash mismatch automatically triggers a `CRITICAL` alert in `security_alerts` table.

---

## 3. Server-Side RBAC & Case Authorization
- **SP / DySP**: Unrestricted jurisdiction-wide clearance.
- **Police Inspector (PI)**: Station-level clearance matching `police_stations.station_id`.
- **Investigating Officer (IO)**: Explicitly assigned cases or active approved access requests in `access_requests` table.
