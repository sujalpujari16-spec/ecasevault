# e-CASEVAULT — HANDOFF BRIEF FOR CODING AGENT

**Project:** Maharashtra Police e-CASEVAULT — Hyperledger Fabric 2.5 + React 19/Vite + Express/TypeScript + PostgreSQL
**Repo:** `maharashtra-police---e-casevault-2 copy`
**Purpose:** Smart India Hackathon (SIH) submission — a forensic/legal evidence system. Chain of custody must hold up in court.
**Current status:** `NOT SUBMISSION READY` — blocked on *unexecuted verification*, not on known defects.

---

## 0. READ THIS FIRST — WHAT IS ALREADY DONE

A full security hardening pass has **already been applied to the source**. Your job is **verification and failure repair**, NOT reimplementation.

**Do NOT redo the work in Section 1. Do NOT redesign the application. Do NOT replace working architecture.**

The previous pass could not run `npm`, `go`, or `docker` (no registry network, no Go toolchain, no Docker daemon). Every claim below marked `NOT VERIFIED` is honest — it means the command was never executed, not that it failed.

---

## 1. FIXES ALREADY APPLIED (verify, don't rewrite)

### Chaincode — `blockchain/chaincode/eCaseVault/main.go`

Five functions had authentication but **no case-level authorization**. All now call the authorization helpers:

| Function | Vulnerability that was fixed | Guard now applied |
|---|---|---|
| `UpdateCaseStatus` | authenticated but unauthorized against the case | `authorizeCaseWrite` |
| `CloseCase` | same | `authorizeCaseClosure` |
| `ApproveAccessRequest` | **privilege self-escalation** — any valid police cert could approve its *own* request onto *any* case | `authorizeSupervisoryAction` + self-approval denial |
| `RejectAccessRequest` | no case authority check (cross-station tampering) | `authorizeSupervisoryAction` |
| `RevokeAccess` | no case authority check (cross-station DoS) | `authorizeSupervisoryAction`, except a grantee may relinquish their own grant |
| `RegisterFingerprint` | existence-check only — could write biometrics onto another station's case | `GetCase` + closed-case guard + `authorizeCaseWrite` + evidence/case binding |

`TransferEvidence` was audited and was already correct (caller badge must equal `evidence.CurrentCustodian`).

### Chaincode tests — `main_test.go`

**The Go suite previously could not compile**: 9 `CreateCase` call sites passed 7 arguments to an 11-parameter function. All 9 were rewritten. Added helpers `setupRoleContext(mspID, badge, role, station, zone)` and `newCase(...)`, plus 5 regression tests. Now 11 test functions total.

### Backend

- `server/routes/blockchain.ts` — `/transactions` scopes **all three** datasets (cases, evidence, transfers) through `server/middleware/rbacScope.ts`. `/blocks` returns HTTP **501 NOT_IMPLEMENTED**.
- `server/services/fabricGateway.ts` — officer-specific Gateway using the officer's own X.509 cert + private key. Throws on empty badge and on unprovisioned identity.
- `src/services/apiClient.ts` — removed dead `getFabricBlocks()` **and** the dangling `fetchBlockchainBlocksFromApi` export that referenced it (this would have broken `npm run build`).

### Packaging & docs

- `scripts/package-submission.sh` now writes the ZIP to the **parent directory**. Writing it into the project root was the root cause of the nested-ZIP problem and would have recurred on every run. Script self-verifies with 10 `assert_absent` + 4 `assert_present` checks against `unzip -Z1` of the real archive.
- Credentials in `README.md` and `docs/DEPLOYMENT.md` replaced with `REPLACE_WITH_*` placeholders.
- `docs/FINAL_ACCEPTANCE_REPORT.md` and `docs/IMPLEMENTATION_STATUS.md` corrected — the false claims `43/43 tests passing` and `0 occurrences across entire codebase` are gone.

---

## 2. HARD CONSTRAINTS — NON-NEGOTIABLE

These are the project's security invariants. **Do not weaken any of them to make a test pass.**

1. **Authority comes only from CA-signed X.509 certificate attributes** (`officerBadge`, `role`, `station`, `zone`). Never from `req.body`, never from a frontend-supplied role, never from JWT role alone for direct Fabric authorization. The Fabric transaction itself must enforce the critical authorization boundary.
2. **No identity fallback.** There must be NO fallback to `User1`, a generic organization identity, `Admin`, or a default certificate. If an officer is not provisioned: **DENY**.
3. **Do not reintroduce** CN parsing, client-ID guessing, `Admin` string matching, or `User1` fallback. Missing or unregistered `officerBadge` → DENY.
4. **Authentication alone is never sufficient.** Every state-changing chaincode function must pair identity resolution with a case-level authorization check.
5. **Never fabricate ledger data** — no fake transaction IDs, timestamps, block numbers, or hashes. `/blocks` must not return `{"success": true, "blocks": []}`. UI stays "Fabric Transaction Ledger", never "Block Explorer".
6. **No real credentials in the repo.** Test/demo passwords must never become production defaults.
7. **RBAC hierarchy:** SP (statewide) > DySP (jurisdiction zone) > PI (own station) > OFFICER (assigned cases only). Default-deny.

---

## 3. WHAT YOU MUST ACTUALLY RUN

All six gates below are currently `NOT VERIFIED`. Run each, record the real result.

```bash
# Node toolchain
rm -rf node_modules dist
npm ci
npm run lint      # tsc --noEmit
npm test          # tsx --test server/tests/*.test.ts
npm run build     # vite build

# Chaincode
cd blockchain/chaincode/eCaseVault && go test -v ./...

# Live Fabric (requires Docker)
./blockchain/network/network.sh up
./blockchain/network/network.sh createChannel
./blockchain/network/network.sh deployCC
npm run test:fabric
```

**Known environment note:** the ZIP the user originally reviewed shipped a bundled `node_modules` containing macOS `darwin-arm64` esbuild binaries, which fail on Linux. The fix is `rm -rf node_modules && npm ci`. **Do not solve this by committing platform-specific binaries to the repository.**

Static facts already established (use these as expectations, not as results):
- `npm test` glob contains **16 top-level cases + 31 subtests = 47 total** across 6 files.
- `main_test.go` contains **11 test functions**.
- Brace/paren balance clean; **0 arity mismatches** between chaincode signatures and test call sites.

---

## 4. HIGHEST-RISK AREA — EXPECT REAL FAILURES HERE

**The Go test suite has never once been executed** (it could not compile before). Treat a first-run failure as expected, not as evidence the security fixes are wrong.

The single most likely failure point is **certificate attribute injection into the mock stub**. The tests rely on `setupRoleContext()` putting `officerBadge`, `role`, `station`, and `zone` into the caller identity, and `resolveCallerBadge()` reading them back via the `cid` library. With `shimtest.MockStub`, `cid` parses attributes out of a real X.509 certificate extension (OID `1.2.3.4.5.6.7.8.1`) carrying a JSON `attrs` payload in the serialized `SignedProposal` creator.

If those tests fail:
- **Fix the test harness so it produces a properly encoded creator identity.** Build a real (self-signed, throwaway) cert with the attribute extension and marshal it into a `msp.SerializedIdentity`.
- **Do NOT** fix it by relaxing `resolveCallerBadge()` to accept a badge from transaction arguments, or by adding a test-only bypass branch in production chaincode. That would reintroduce the exact vulnerability class this pass eliminated.

Also verify `go.mod`/`go.sum` actually resolve `github.com/hyperledger/fabric-chaincode-go/shimtest` and `fabric-contract-api-go`; `go mod tidy` may be required.

---

## 5. HOW TO REPORT BACK

Use exactly three states, and never blur them:

- **PASS** — command was executed, result observed.
- **FAIL** — executed, wrong result.
- **NOT VERIFIED** — could not execute (say why).

For every item record the **exact command** and the **actual output**. Do not declare PASS from source inspection alone. Do not claim a test count you did not observe. Do not claim `LIVE FABRIC VERIFIED` unless a real Fabric network was running and the integration lifecycle completed.

Scope every claim to one of four categories — an unscoped claim about "the whole codebase" is usually false:

| Category | Paths | Ships? |
|---|---|---|
| Production source | `src/`, `server/` (excl. `server/tests/`), `blockchain/chaincode/` | Yes |
| Tests | `server/tests/`, `main_test.go` | No |
| Documentation | `docs/`, `README.md` | No |
| Generated/runtime | `node_modules/`, `dist/`, `storage/**`, `blockchain/network/organizations/` | No — excluded from ZIP |

Example: `INITIAL_CASES` is absent from production source but present in `docs/` as prose describing its removal. That is correct and expected.

Final line must be `SUBMISSION READY` **only** when all six gates in Section 3 pass. Otherwise `NOT SUBMISSION READY`.

---

## 6. REPACKAGING

After all gates pass:

```bash
npm run package:zip
```

The archive is written **outside** the project folder. It must contain none of: `node_modules/`, `dist/`, `__MACOSX/`, `.env`, `*.pem`, `*.key`, private keys, Fabric generated organizations, generated encrypted evidence, runtime logs, temp files, or a nested submission ZIP. It must contain `.env.example` and `storage/*/.gitkeep`.

Verify independently rather than trusting the script — extract the archive and grep it:

```bash
cd /tmp && rm -rf vz && mkdir vz && cd vz
unzip -q <path-to-submission.zip>
find . \( -name node_modules -o -name dist -o -name __MACOSX -o -name "*.zip" \
       -o -name "*.pem" -o -name "*.key" -o -name "*.enc" -o -name ".env" \) -print
grep -rniE "SecurePass|JWT_Secret|MasterSecret|super_secret|YourSecurePassword" .
```

Both should return nothing. Last verified state: **127 files, 317K, 14/14 assertions passed, 0 forbidden entries.**
