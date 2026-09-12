#!/usr/bin/env bash
# ============================================================================
# e-CASEVAULT — Real End-to-End Hyperledger Fabric Lifecycle Test Suite
# Flow: Login -> Create Case -> Verify on Fabric -> Register Evidence ->
#       Verify Hash -> Transfer Custody -> Verify History -> Audit Verification
# ============================================================================

set -euo pipefail

API_URL="${API_URL:-http://localhost:5001/api}"

echo "======================================================================"
echo "  e-CASEVAULT — End-to-End Fabric Lifecycle Test Suite"
echo "======================================================================"

# Helper function to extract JSON field using node
json_field() {
  local json="$1"
  local field="$2"
  node -e "try { const obj = JSON.parse(process.argv[1]); console.log(obj.${field} || ''); } catch { console.log(''); }" "${json}"
}

# 1. Health Probe
echo "[STEP 1/8] Verifying API Server Health..."
HEALTH_HTTP=$(curl -s -w "\n%{http_code}" "${API_URL}/health")
HEALTH_CODE=$(echo "${HEALTH_HTTP}" | tail -n1)
HEALTH_BODY=$(echo "${HEALTH_HTTP}" | sed '$d')

if [ "${HEALTH_CODE}" -ne 200 ]; then
  echo "❌ [FAILED] API Server /health returned HTTP ${HEALTH_CODE}: ${HEALTH_BODY}"
  exit 1
fi
echo "✓ API Server is healthy (HTTP 200)"

# 2. Authenticate
echo "[STEP 2/8] Authenticating with Police Inspector Credentials..."
LOGIN_HTTP=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"pi_patil","password":"Password@123"}')
LOGIN_CODE=$(echo "${LOGIN_HTTP}" | tail -n1)
LOGIN_BODY=$(echo "${LOGIN_HTTP}" | sed '$d')

if [ "${LOGIN_CODE}" -ne 200 ]; then
  echo "❌ [FAILED] Authentication failed with HTTP ${LOGIN_CODE}: ${LOGIN_BODY}"
  exit 1
fi

TOKEN=$(json_field "${LOGIN_BODY}" "token")
if [ -z "${TOKEN}" ]; then
  echo "❌ [FAILED] Authentication succeeded but no JWT token was returned: ${LOGIN_BODY}"
  exit 1
fi
echo "✓ Authenticated successfully. JWT Token acquired."

# 3. Create Real Test Case on PostgreSQL & Hyperledger Fabric
TEST_TIMESTAMP=$(date +%s)
FIR_NO="TEST/CR/2026/${TEST_TIMESTAMP}"
echo "[STEP 3/8] Creating Test Case (${FIR_NO}) on Fabric Ledger..."

CASE_PAYLOAD=$(cat <<EOF
{
  "newCaseData": {
    "firNumber": "${FIR_NO}",
    "crimeType": "Forensic Ledger Integration Test",
    "incidentDate": "2026-09-03",
    "incidentLocation": "Andheri East Investigation Hub",
    "policeStation": "Andheri Police Station, Mumbai",
    "policeStationId": "ANDHERI-PS",
    "summary": "Automated integration test for Hyperledger Fabric end-to-end lifecycle verification."
  }
}
EOF
)

CREATE_CASE_HTTP=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/cases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "${CASE_PAYLOAD}")
CREATE_CASE_CODE=$(echo "${CREATE_CASE_HTTP}" | tail -n1)
CREATE_CASE_BODY=$(echo "${CREATE_CASE_HTTP}" | sed '$d')

if [ "${CREATE_CASE_CODE}" -ne 201 ] && [ "${CREATE_CASE_CODE}" -ne 200 ]; then
  echo "❌ [FAILED] Case creation failed with HTTP ${CREATE_CASE_CODE}: ${CREATE_CASE_BODY}"
  exit 1
fi

CASE_ID=$(json_field "${CREATE_CASE_BODY}" "caseId")
CASE_TX_ID=$(json_field "${CREATE_CASE_BODY}" "blockchainTxId")

if [ -z "${CASE_ID}" ] || [ -z "${CASE_TX_ID}" ]; then
  echo "❌ [FAILED] Case created but missing caseId or blockchainTxId: ${CREATE_CASE_BODY}"
  exit 1
fi
echo "✓ Case created: ID=${CASE_ID}, Fabric TX=${CASE_TX_ID}"

# 4. Verify Case on Hyperledger Fabric
echo "[STEP 4/8] Querying Case directly from Fabric World State..."
FABRIC_CASE_HTTP=$(curl -s -w "\n%{http_code}" "${API_URL}/blockchain/case/${CASE_ID}" \
  -H "Authorization: Bearer ${TOKEN}")
FABRIC_CASE_CODE=$(echo "${FABRIC_CASE_HTTP}" | tail -n1)
FABRIC_CASE_BODY=$(echo "${FABRIC_CASE_HTTP}" | sed '$d')

if [ "${FABRIC_CASE_CODE}" -ne 200 ]; then
  echo "❌ [FAILED] Querying case from Fabric failed with HTTP ${FABRIC_CASE_CODE}: ${FABRIC_CASE_BODY}"
  exit 1
fi
echo "✓ Case confirmed on Fabric world state."

# 5. Register Evidence on Hyperledger Fabric
echo "[STEP 5/8] Uploading & Registering Evidence with AES-256-GCM & SHA-256 Digest on Fabric..."
TEMP_EVIDENCE_FILE=$(mktemp)
echo "CONFIDENTIAL DIGITAL EVIDENCE PAYLOAD FOR INTEGRATION TEST: ${TEST_TIMESTAMP}" > "${TEMP_EVIDENCE_FILE}"
EXPECTED_SHA256=$(shasum -a 256 "${TEMP_EVIDENCE_FILE}" | awk '{print $1}')

EVIDENCE_UPLOAD_HTTP=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/evidence" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "caseId=${CASE_ID}" \
  -F "category=Digital Forensics" \
  -F "description=Test Evidence Payload" \
  -F "locationFound=Scene of Incident Alpha" \
  -F "storageLocker=Vault-Locker-01" \
  -F "evidenceFile=@${TEMP_EVIDENCE_FILE};type=text/plain")
rm -f "${TEMP_EVIDENCE_FILE}"

EVIDENCE_UPLOAD_CODE=$(echo "${EVIDENCE_UPLOAD_HTTP}" | tail -n1)
EVIDENCE_UPLOAD_BODY=$(echo "${EVIDENCE_UPLOAD_HTTP}" | sed '$d')

if [ "${EVIDENCE_UPLOAD_CODE}" -ne 201 ] && [ "${EVIDENCE_UPLOAD_CODE}" -ne 200 ]; then
  echo "❌ [FAILED] Evidence registration failed with HTTP ${EVIDENCE_UPLOAD_CODE}: ${EVIDENCE_UPLOAD_BODY}"
  exit 1
fi

EVIDENCE_ID=$(json_field "${EVIDENCE_UPLOAD_BODY}" "evidenceId")
EVIDENCE_TAG=$(json_field "${EVIDENCE_UPLOAD_BODY}" "evidenceTag")
EVIDENCE_TX_ID=$(json_field "${EVIDENCE_UPLOAD_BODY}" "blockchainTxId")

if [ -z "${EVIDENCE_ID}" ] || [ -z "${EVIDENCE_TX_ID}" ]; then
  echo "❌ [FAILED] Evidence registered but missing evidenceId or blockchainTxId: ${EVIDENCE_UPLOAD_BODY}"
  exit 1
fi
echo "✓ Evidence registered: ID=${EVIDENCE_ID}, Tag=${EVIDENCE_TAG}, Fabric TX=${EVIDENCE_TX_ID}"

# 6. Verify Evidence Hash against Fabric Ledger
echo "[STEP 6/8] Executing Authoritative Hash Integrity Verification on Fabric..."
VERIFY_HTTP=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/evidence/verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"evidenceId\":\"${EVIDENCE_ID}\"}")
VERIFY_CODE=$(echo "${VERIFY_HTTP}" | tail -n1)
VERIFY_BODY=$(echo "${VERIFY_HTTP}" | sed '$d')

if [ "${VERIFY_CODE}" -ne 200 ]; then
  echo "❌ [FAILED] Evidence verification failed with HTTP ${VERIFY_CODE}: ${VERIFY_BODY}"
  exit 1
fi

IS_MATCH=$(json_field "${VERIFY_BODY}" "isMatch")
if [ "${IS_MATCH}" != "true" ]; then
  echo "❌ [FAILED] Fabric evidence integrity verification did not match: ${VERIFY_BODY}"
  exit 1
fi
echo "✓ Cryptographic SHA-256 match verified against Fabric ledger (isMatch=true)"

# 7. Transfer Custody with Asymmetric Ed25519 Signature
echo "[STEP 7/8] Transferring Custody to FSL Examiner on Hyperledger Fabric..."
TRANSFER_HTTP=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/evidence/transfer" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"evidenceId\": \"${EVIDENCE_ID}\",
    \"toOfficer\": \"FSL Forensic Examiner Dr. Sharma\",
    \"location\": \"FSL Kalina Ballistics Lab\",
    \"purpose\": \"Ballistic trajectory analysis\",
    \"condition\": \"Sealed with tamper-evident seal\"
  }")
TRANSFER_CODE=$(echo "${TRANSFER_HTTP}" | tail -n1)
TRANSFER_BODY=$(echo "${TRANSFER_HTTP}" | sed '$d')

if [ "${TRANSFER_CODE}" -ne 200 ]; then
  echo "❌ [FAILED] Custody transfer failed with HTTP ${TRANSFER_CODE}: ${TRANSFER_BODY}"
  exit 1
fi

TRANSFER_ID=$(json_field "${TRANSFER_BODY}" "transferId")
TRANSFER_TX_ID=$(json_field "${TRANSFER_BODY}" "blockchainTxId")
echo "✓ Custody transfer recorded: TransferID=${TRANSFER_ID}, Fabric TX=${TRANSFER_TX_ID}"

# 8. Query History & Audit Trail
echo "[STEP 8/8] Verifying Custody Transfer Audit Trail & History..."
HISTORY_HTTP=$(curl -s -w "\n%{http_code}" "${API_URL}/evidence/${EVIDENCE_ID}/history" \
  -H "Authorization: Bearer ${TOKEN}")
HISTORY_CODE=$(echo "${HISTORY_HTTP}" | tail -n1)
HISTORY_BODY=$(echo "${HISTORY_HTTP}" | sed '$d')

if [ "${HISTORY_CODE}" -ne 200 ]; then
  echo "❌ [FAILED] Custody history query failed with HTTP ${HISTORY_CODE}: ${HISTORY_BODY}"
  exit 1
fi
echo "✓ Custody history retrieved successfully."

echo "======================================================================"
echo "  [SUCCESS] End-to-End Fabric Lifecycle Integration Test PASSED!"
echo "======================================================================"
exit 0
