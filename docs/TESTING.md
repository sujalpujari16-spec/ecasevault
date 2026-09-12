# e-CASEVAULT — Verification & Testing Suite

## 1. Automated Build & Type Checking

```bash
# Run TypeScript compilation check
npm run lint

# Run Vite production build check
npm run build
```

---

## 2. API Endpoint Verification Procedures

### Test 1: Health Status Check
```bash
curl -s http://localhost:5001/api/health
```
Expected: `{"status":"ONLINE","version":"3.0.0-ENTERPRISE"...}`

### Test 2: Authentication & Signed JWT Issuance
```bash
curl -s -X POST http://localhost:5001/api/auth/login -H "Content-Type: application/json" -d '{"username":"sp.pradhan","password":"<YOUR_CONFIGURED_PASSWORD>"}'
```
Expected: `{"success":true,"token":"eyJhbGciOiJI..."}`

### Test 3: Fabric Gateway Block History
```bash
curl -s http://localhost:5001/api/blockchain/blocks
```
Expected: `{"success":true,"count":1,"blocks":[...]}`
