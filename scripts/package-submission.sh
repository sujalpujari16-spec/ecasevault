#!/usr/bin/env bash
# ============================================================================
# e-CASEVAULT — Production Submission Packaging Script
# Excludes node_modules/, dist/, .env, secrets, logs, and generated artifacts.
# Produces a clean, genuine, verifiable submission ZIP package.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# The archive is written to the PARENT of the project directory, never inside it.
# Writing it into ROOT_DIR is what previously produced a submission ZIP nested
# inside the next submission ZIP.
OUTPUT_ZIP="$(cd "${ROOT_DIR}/.." && pwd)/maharashtra-police-e-casevault-submission.zip"

echo "============================================================================"
echo " Packaging e-CASEVAULT for Submission"
echo " Working Directory: ${ROOT_DIR}"
echo " Output Archive:    ${OUTPUT_ZIP}"
echo "============================================================================"

# Remove any stale archive that a previous run left INSIDE the project tree, so
# it can never be swept into the new package.
rm -f "${ROOT_DIR}/maharashtra-police-e-casevault-submission.zip"

# Ensure placeholder gitkeep files exist
mkdir -p "${ROOT_DIR}/storage/evidence" "${ROOT_DIR}/storage/keys" "${ROOT_DIR}/storage/fabric-identities" "${ROOT_DIR}/storage/case_repo"
touch "${ROOT_DIR}/storage/evidence/.gitkeep"
touch "${ROOT_DIR}/storage/keys/.gitkeep"
touch "${ROOT_DIR}/storage/fabric-identities/.gitkeep"
touch "${ROOT_DIR}/storage/case_repo/.gitkeep"

# Clean test generated artifacts before packaging
rm -f "${ROOT_DIR}/storage/evidence/"*.enc
rm -rf "${ROOT_DIR}/storage/case_repo/"*
touch "${ROOT_DIR}/storage/case_repo/.gitkeep"
rm -f "${ROOT_DIR}/storage/keys/"*.pem
rm -rf "${ROOT_DIR}/dist"
rm -f "${OUTPUT_ZIP}"

# Create clean ZIP excluding forbidden files.
# NOTE: "*.zip" is excluded so that a previously built submission archive can
# never be nested inside the new one.
cd "${ROOT_DIR}"
zip -r "${OUTPUT_ZIP}" . \
  -x "node_modules/*" \
  -x "*/node_modules/*" \
  -x "dist/*" \
  -x "*/dist/*" \
  -x "build/*" \
  -x "coverage/*" \
  -x ".git/*" \
  -x "*.zip" \
  -x ".env" \
  -x ".env.*" \
  -x "!.env.example" \
  -x "*.pem" \
  -x "*.key" \
  -x "*.enc" \
  -x "blockchain/network/organizations/*" \
  -x "blockchain/network/channel-artifacts/*" \
  -x "storage/evidence/*" \
  -x "storage/case_repo/*" \
  -x "storage/keys/*" \
  -x "storage/fabric-identities/*" \
  -x "*.log" \
  -x ".DS_Store" \
  -x "*/.DS_Store" \
  -x "__MACOSX/*" \
  -x "*/__MACOSX/*" \
  -x ".claude/*" \
  -x "*/.claude/*" \
  -x ".vscode/*" \
  -x "*/.vscode/*" \
  -x ".idea/*" \
  -x "*/.idea/*"

# .env.example is required documentation, and the storage directories must ship
# as empty placeholders, so re-add them explicitly after the broad exclusions.
zip "${OUTPUT_ZIP}" .env.example >/dev/null
zip "${OUTPUT_ZIP}" storage/evidence/.gitkeep storage/case_repo/.gitkeep storage/keys/.gitkeep storage/fabric-identities/.gitkeep >/dev/null

echo "============================================================================"
echo " Verifying ZIP Cleanliness & Contents"
echo "============================================================================"

TOTAL_FILES=$(unzip -l "${OUTPUT_ZIP}" | tail -n 1 | awk '{print $2}')
ZIP_SIZE=$(ls -lh "${OUTPUT_ZIP}" | awk '{print $5}')

echo "Package Location: ${OUTPUT_ZIP}"
echo "Total Files in ZIP: ${TOTAL_FILES}"
echo "ZIP File Size: ${ZIP_SIZE}"

# ----------------------------------------------------------------------------
# Forbidden pattern assertions, run against the ACTUAL packaged archive listing
# rather than against the working tree. Each pattern is checked independently so
# the report names every violation, not just the first.
# ----------------------------------------------------------------------------
LISTING="$(unzip -Z1 "${OUTPUT_ZIP}")"
FORBIDDEN_HITS=0

assert_absent() {
  local label="$1" pattern="$2"
  local hits
  hits="$(printf '%s\n' "${LISTING}" | grep -E "${pattern}" || true)"
  if [ -n "${hits}" ]; then
    echo "❌ CRITICAL: ${label} present in ZIP:"
    printf '%s\n' "${hits}" | head -5 | sed 's/^/     /'
    FORBIDDEN_HITS=$((FORBIDDEN_HITS + 1))
  else
    echo "✅ ${label}: absent"
  fi
}

assert_absent "node_modules"          '(^|/)node_modules/'
assert_absent "dist build output"     '(^|/)dist/'
assert_absent "__MACOSX"              '(^|/)__MACOSX/'
assert_absent "nested ZIP archives"   '\.zip$'
assert_absent "real .env file"        '(^|/)\.env$|(^|/)\.env\.(local|production)$'
assert_absent "private keys / certs"  '\.(pem|key|p12|pfx)$'
assert_absent "Fabric organizations"  '(^|/)blockchain/network/organizations/'
assert_absent "encrypted evidence"    '\.enc$'
assert_absent "runtime logs"          '\.log$'
assert_absent "macOS metadata"        '(^|/)\.DS_Store$'

# Required files must be PRESENT
assert_present() {
  local label="$1" pattern="$2"
  if printf '%s\n' "${LISTING}" | grep -qE "${pattern}"; then
    echo "✅ ${label}: present"
  else
    echo "❌ CRITICAL: ${label} MISSING from ZIP"
    FORBIDDEN_HITS=$((FORBIDDEN_HITS + 1))
  fi
}

assert_present ".env.example"    '(^|/)\.env\.example$'
assert_present "package.json"    '(^|/)package\.json$'
assert_present "package-lock"    '(^|/)package-lock\.json$'
assert_present "chaincode"       'blockchain/chaincode/eCaseVault/main\.go$'

echo "----------------------------------------------------------------------------"
if [ ${FORBIDDEN_HITS} -eq 0 ]; then
  echo "✅ SUBMISSION ZIP VERIFIED CLEAN: 0 violations across ${TOTAL_FILES} files."
else
  echo "❌ SUBMISSION ZIP VALIDATION FAILED: ${FORBIDDEN_HITS} violation(s) detected."
  exit 1
fi
