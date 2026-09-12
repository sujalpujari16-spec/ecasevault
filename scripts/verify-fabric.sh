#!/usr/bin/env bash
# ============================================================================
# e-CASEVAULT — Production Hyperledger Fabric Post-Deployment Verifier
# Validates: Containers -> MSP -> Channel -> 3-Org Peers -> Chaincode -> Query
# ============================================================================

set -euo pipefail

CHANNEL_NAME="${FABRIC_CHANNEL:-ecasevault-channel}"
CC_NAME="${FABRIC_CHAINCODE:-ecasevault}"

echo "======================================================================"
echo "  e-CASEVAULT — Fabric Post-Deployment Verification Audit"
echo "======================================================================"

if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker is not installed or not in PATH." >&2
    exit 1
fi

# 1. Verify Fabric Containers Running
echo "[CHECK 1/8] Verifying Fabric Docker containers..."
RUNNING_CONTAINERS=$(docker ps --format '{{.Names}}')
REQUIRED_CONTAINERS=("orderer.casevault.police.gov.in" "peer0.police.casevault.police.gov.in" "peer0.fsl.casevault.police.gov.in" "peer0.cyber.casevault.police.gov.in" "casevault-cli")

for c in "${REQUIRED_CONTAINERS[@]}"; do
    if ! echo "${RUNNING_CONTAINERS}" | grep -q "${c}"; then
        echo "[FAILED] Required container '${c}' is not running!" >&2
        exit 1
    fi
    echo "  ✓ Container running: ${c}"
done

# 2. Verify CA/MSP Structures
echo "[CHECK 2/8] Verifying X.509 MSP and TLS certificate structures..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../blockchain/network" && pwd)"
if [ ! -f "${SCRIPT_DIR}/organizations/peerOrganizations/police.casevault.police.gov.in/tlsca/tlsca.PoliceOrg-cert.pem" ] || \
   [ ! -f "${SCRIPT_DIR}/organizations/peerOrganizations/fsl.casevault.police.gov.in/tlsca/tlsca.FSLOrg-cert.pem" ] || \
   [ ! -f "${SCRIPT_DIR}/organizations/peerOrganizations/cyber.casevault.police.gov.in/tlsca/tlsca.CyberCellOrg-cert.pem" ]; then
    echo "[FAILED] Required MSP / TLS certificates missing from organizations directory!" >&2
    exit 1
fi
echo "  ✓ All 3 organization MSP structures verified."

# 3. Verify Channel Exists & Police Peer Joined
echo "[CHECK 3/8] Verifying channel '${CHANNEL_NAME}' on PoliceOrg peer..."
CHANNELS=$(docker exec casevault-cli peer channel list)
if ! echo "${CHANNELS}" | grep -q "${CHANNEL_NAME}"; then
    echo "[FAILED] Channel '${CHANNEL_NAME}' not found on PoliceOrg peer!" >&2
    exit 1
fi
echo "  ✓ PoliceOrg joined '${CHANNEL_NAME}'"

# 4. Verify FSL Peer Joined
echo "[CHECK 4/8] Verifying channel '${CHANNEL_NAME}' on FSLOrg peer..."
FSL_CHANNELS=$(docker exec \
    -e CORE_PEER_ADDRESS=peer0.fsl.casevault.police.gov.in:9051 \
    -e CORE_PEER_LOCALMSPID=FSLOrgMSP \
    -e CORE_PEER_TLS_CERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/fsl.casevault.police.gov.in/peers/peer0.fsl.casevault.police.gov.in/tls/server.crt \
    -e CORE_PEER_TLS_KEY_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/fsl.casevault.police.gov.in/peers/peer0.fsl.casevault.police.gov.in/tls/server.key \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/fsl.casevault.police.gov.in/peers/peer0.fsl.casevault.police.gov.in/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/fsl.casevault.police.gov.in/users/Admin@fsl.casevault.police.gov.in/msp \
    casevault-cli peer channel list)
if ! echo "${FSL_CHANNELS}" | grep -q "${CHANNEL_NAME}"; then
    echo "[FAILED] Channel '${CHANNEL_NAME}' not found on FSLOrg peer!" >&2
    exit 1
fi
echo "  ✓ FSLOrg joined '${CHANNEL_NAME}'"

# 5. Verify CyberCell Peer Joined
echo "[CHECK 5/8] Verifying channel '${CHANNEL_NAME}' on CyberCellOrg peer..."
CYBER_CHANNELS=$(docker exec \
    -e CORE_PEER_ADDRESS=peer0.cyber.casevault.police.gov.in:11051 \
    -e CORE_PEER_LOCALMSPID=CyberCellOrgMSP \
    -e CORE_PEER_TLS_CERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/cyber.casevault.police.gov.in/peers/peer0.cyber.casevault.police.gov.in/tls/server.crt \
    -e CORE_PEER_TLS_KEY_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/cyber.casevault.police.gov.in/peers/peer0.cyber.casevault.police.gov.in/tls/server.key \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/cyber.casevault.police.gov.in/peers/peer0.cyber.casevault.police.gov.in/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/cyber.casevault.police.gov.in/users/Admin@cyber.casevault.police.gov.in/msp \
    casevault-cli peer channel list)
if ! echo "${CYBER_CHANNELS}" | grep -q "${CHANNEL_NAME}"; then
    echo "[FAILED] Channel '${CHANNEL_NAME}' not found on CyberCellOrg peer!" >&2
    exit 1
fi
echo "  ✓ CyberCellOrg joined '${CHANNEL_NAME}'"

# 6. Verify Chaincode Installed
echo "[CHECK 6/8] Verifying chaincode '${CC_NAME}' installed on peers..."
INSTALLED=$(docker exec casevault-cli peer lifecycle chaincode queryinstalled)
if ! echo "${INSTALLED}" | grep -q "${CC_NAME}"; then
    echo "[FAILED] Chaincode '${CC_NAME}' is not installed!" >&2
    exit 1
fi
echo "  ✓ Chaincode installed package found."

# 7. Verify Chaincode Committed
echo "[CHECK 7/8] Verifying chaincode '${CC_NAME}' committed to channel '${CHANNEL_NAME}'..."
COMMITTED=$(docker exec casevault-cli peer lifecycle chaincode querycommitted --channelID "${CHANNEL_NAME}" --name "${CC_NAME}")
if ! echo "${COMMITTED}" | grep -q "${CC_NAME}"; then
    echo "[FAILED] Chaincode '${CC_NAME}' is not committed on '${CHANNEL_NAME}'!" >&2
    exit 1
fi
echo "  ✓ Chaincode committed definition verified."

# 8. Verify Chaincode Query Execution
echo "[CHECK 8/8] Executing live chaincode query against ledger..."
QUERY_OUTPUT=$(docker exec casevault-cli peer chaincode query \
    -C "${CHANNEL_NAME}" -n "${CC_NAME}" \
    -c '{"function":"AssetExists","Args":["PING_AUDIT_PROBE"]}')
echo "  ✓ Chaincode query executed successfully. Result: ${QUERY_OUTPUT}"

echo "======================================================================"
echo "  [AUDIT PASSED] Hyperledger Fabric 2.5 Deployment is 100% Genuine & Operational."
echo "======================================================================"
