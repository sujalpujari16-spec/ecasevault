#!/usr/bin/env bash
# ============================================================================
# e-CASEVAULT — Production Hyperledger Fabric 2.5 Lifecycle & Network Script
# Multi-Organization Support: PoliceOrgMSP, FSLOrgMSP, CyberCellOrgMSP
# Channel: ecasevault-channel | Chaincode: ecasevault
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLOCKCHAIN_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CHANNEL_NAME="${FABRIC_CHANNEL:-ecasevault-channel}"
CC_NAME="${FABRIC_CHAINCODE:-ecasevault}"
CC_VERSION="1.0"
CC_SEQUENCE="1"

ORDERER_CA="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/casevault.police.gov.in/orderers/orderer.casevault.police.gov.in/tls/ca.crt"
ORDERER_ADDR="orderer.casevault.police.gov.in:7050"

COMMAND="${1:-help}"

function check_prereqs() {
    if ! command -v docker &> /dev/null; then
        echo "[ERROR] 'docker' command not found in PATH. Please ensure Docker is installed and running." >&2
        exit 1
    fi
    if ! docker compose version &> /dev/null; then
        echo "[ERROR] 'docker compose' not found. Please install Docker Compose v2+." >&2
        exit 1
    fi
}

function network_up() {
    check_prereqs
    echo "[FABRIC NETWORK] Step 1: Checking X.509 MSP & TLS credentials..."
    if [ ! -d "${SCRIPT_DIR}/organizations/peerOrganizations" ]; then
        bash "${SCRIPT_DIR}/generate-crypto.sh"
    fi

    echo "[FABRIC NETWORK] Step 2: Launching Orderer, Peers, and CLI containers..."
    docker compose -f "${BLOCKCHAIN_DIR}/docker-compose.yaml" up -d

    echo "[FABRIC NETWORK] Verifying container status..."
    sleep 4
    docker compose -f "${BLOCKCHAIN_DIR}/docker-compose.yaml" ps
    echo "[FABRIC NETWORK] Orderer and peer nodes online."
}

function network_down() {
    check_prereqs
    echo "[FABRIC NETWORK] Stopping Fabric containers and destroying volumes..."
    docker compose -f "${BLOCKCHAIN_DIR}/docker-compose.yaml" down -v --remove-orphans
    rm -rf "${SCRIPT_DIR}/channel-artifacts"
    echo "[FABRIC NETWORK] Hyperledger Fabric network stopped cleanly."
}

function create_channel() {
    check_prereqs
    echo "[FABRIC CHANNEL] Creating channel '${CHANNEL_NAME}'..."
    mkdir -p "${SCRIPT_DIR}/channel-artifacts"

    # Step 0: Generate Channel Creation Transaction via configtxgen
    echo "[FABRIC CHANNEL] Generating channel creation transaction artifact (${CHANNEL_NAME}.tx)..."
    docker exec casevault-cli bash -c "
        export FABRIC_CFG_PATH=/opt/gopath/src/github.com/hyperledger/fabric/peer
        configtxgen -profile CaseVaultChannel \
            -outputCreateChannelTx /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.tx \
            -channelID ${CHANNEL_NAME}
    "

    # Step 1: Create channel block with Orderer
    docker exec casevault-cli bash -c "
        peer channel create -o ${ORDERER_ADDR} -c ${CHANNEL_NAME} \
            --ordererTLSHostnameOverride orderer.casevault.police.gov.in \
            -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.tx \
            --outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.block \
            --tls --cafile ${ORDERER_CA}
    "

    # Step 2: Join PoliceOrg Peer
    echo "[FABRIC CHANNEL] Joining PoliceOrg peer0 to ${CHANNEL_NAME}..."
    docker exec casevault-cli bash -c "
        peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.block
    "

    # Step 3: Join FSLOrg Peer
    echo "[FABRIC CHANNEL] Joining FSLOrg peer0 to ${CHANNEL_NAME}..."
    docker exec \
        -e CORE_PEER_ADDRESS=peer0.fsl.casevault.police.gov.in:9051 \
        -e CORE_PEER_LOCALMSPID=FSLOrgMSP \
        -e CORE_PEER_TLS_CERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/fsl.casevault.police.gov.in/peers/peer0.fsl.casevault.police.gov.in/tls/server.crt \
        -e CORE_PEER_TLS_KEY_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/fsl.casevault.police.gov.in/peers/peer0.fsl.casevault.police.gov.in/tls/server.key \
        -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/fsl.casevault.police.gov.in/peers/peer0.fsl.casevault.police.gov.in/tls/ca.crt \
        -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/fsl.casevault.police.gov.in/users/Admin@fsl.casevault.police.gov.in/msp \
        casevault-cli bash -c "peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.block"

    # Step 4: Join CyberCellOrg Peer
    echo "[FABRIC CHANNEL] Joining CyberCellOrg peer0 to ${CHANNEL_NAME}..."
    docker exec \
        -e CORE_PEER_ADDRESS=peer0.cyber.casevault.police.gov.in:11051 \
        -e CORE_PEER_LOCALMSPID=CyberCellOrgMSP \
        -e CORE_PEER_TLS_CERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/cyber.casevault.police.gov.in/peers/peer0.cyber.casevault.police.gov.in/tls/server.crt \
        -e CORE_PEER_TLS_KEY_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/cyber.casevault.police.gov.in/peers/peer0.cyber.casevault.police.gov.in/tls/server.key \
        -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/cyber.casevault.police.gov.in/peers/peer0.cyber.casevault.police.gov.in/tls/ca.crt \
        -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/cyber.casevault.police.gov.in/users/Admin@cyber.casevault.police.gov.in/msp \
        casevault-cli bash -c "peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.block"

    echo "[FABRIC CHANNEL] Channel ${CHANNEL_NAME} successfully created and all 3 organization peers joined."
}

function deploy_chaincode() {
    check_prereqs
    echo "[FABRIC CHAINCODE] Starting Hyperledger Fabric chaincode lifecycle for '${CC_NAME}'..."
    local CC_PACKAGE="/opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CC_NAME}.tar.gz"

    echo "[LIFECYCLE 1/8] Packaging chaincode..."
    docker exec casevault-cli bash -c "
        peer lifecycle chaincode package ${CC_PACKAGE} \
            --path /opt/gopath/src/github.com/hyperledger/fabric-samples/chaincode/eCaseVault \
            --lang golang \
            --label ${CC_NAME}_${CC_VERSION}
    "

    echo "[LIFECYCLE 2/8] Installing chaincode on PoliceOrg peer0..."
    docker exec casevault-cli bash -c "
        peer lifecycle chaincode install ${CC_PACKAGE}
    "

    echo "[LIFECYCLE 3/8] Installing chaincode on FSLOrg peer0..."
    docker exec \
        -e CORE_PEER_ADDRESS=peer0.fsl.casevault.police.gov.in:9051 \
        -e CORE_PEER_LOCALMSPID=FSLOrgMSP \
        -e CORE_PEER_TLS_CERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/fsl.casevault.police.gov.in/peers/peer0.fsl.casevault.police.gov.in/tls/server.crt \
        -e CORE_PEER_TLS_KEY_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/fsl.casevault.police.gov.in/peers/peer0.fsl.casevault.police.gov.in/tls/server.key \
        -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/fsl.casevault.police.gov.in/peers/peer0.fsl.casevault.police.gov.in/tls/ca.crt \
        -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/fsl.casevault.police.gov.in/users/Admin@fsl.casevault.police.gov.in/msp \
        casevault-cli bash -c "peer lifecycle chaincode install ${CC_PACKAGE}"

    echo "[LIFECYCLE 4/8] Installing chaincode on CyberCellOrg peer0..."
    docker exec \
        -e CORE_PEER_ADDRESS=peer0.cyber.casevault.police.gov.in:11051 \
        -e CORE_PEER_LOCALMSPID=CyberCellOrgMSP \
        -e CORE_PEER_TLS_CERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/cyber.casevault.police.gov.in/peers/peer0.cyber.casevault.police.gov.in/tls/server.crt \
        -e CORE_PEER_TLS_KEY_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/cyber.casevault.police.gov.in/peers/peer0.cyber.casevault.police.gov.in/tls/server.key \
        -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/cyber.casevault.police.gov.in/peers/peer0.cyber.casevault.police.gov.in/tls/ca.crt \
        -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/cyber.casevault.police.gov.in/users/Admin@cyber.casevault.police.gov.in/msp \
        casevault-cli bash -c "peer lifecycle chaincode install ${CC_PACKAGE}"

    echo "[LIFECYCLE 5/8] Querying installed package ID..."
    PACKAGE_ID=$(docker exec casevault-cli bash -c "peer lifecycle chaincode queryinstalled" | grep "${CC_NAME}_${CC_VERSION}" | head -n 1 | awk -F'[, ]+' '{print $3}')
    if [ -z "${PACKAGE_ID}" ]; then
        echo "[ERROR] Failed to query installed chaincode package ID" >&2
        exit 1
    fi
    echo "[LIFECYCLE] Installed Chaincode Package ID: ${PACKAGE_ID}"

    echo "[LIFECYCLE 6/8] Approving chaincode definition across all 3 organizations..."
    # Approve for PoliceOrgMSP
    docker exec casevault-cli bash -c "
        peer lifecycle chaincode approveformyorg -o ${ORDERER_ADDR} \
            --ordererTLSHostnameOverride orderer.casevault.police.gov.in \
            --tls --cafile ${ORDERER_CA} \
            --channelID ${CHANNEL_NAME} --name ${CC_NAME} --version ${CC_VERSION} \
            --package-id ${PACKAGE_ID} --sequence ${CC_SEQUENCE}
    "

    # Approve for FSLOrgMSP
    docker exec \
        -e CORE_PEER_ADDRESS=peer0.fsl.casevault.police.gov.in:9051 \
        -e CORE_PEER_LOCALMSPID=FSLOrgMSP \
        -e CORE_PEER_TLS_CERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/fsl.casevault.police.gov.in/peers/peer0.fsl.casevault.police.gov.in/tls/server.crt \
        -e CORE_PEER_TLS_KEY_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/fsl.casevault.police.gov.in/peers/peer0.fsl.casevault.police.gov.in/tls/server.key \
        -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/fsl.casevault.police.gov.in/peers/peer0.fsl.casevault.police.gov.in/tls/ca.crt \
        -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/fsl.casevault.police.gov.in/users/Admin@fsl.casevault.police.gov.in/msp \
        casevault-cli bash -c "
            peer lifecycle chaincode approveformyorg -o ${ORDERER_ADDR} \
                --ordererTLSHostnameOverride orderer.casevault.police.gov.in \
                --tls --cafile ${ORDERER_CA} \
                --channelID ${CHANNEL_NAME} --name ${CC_NAME} --version ${CC_VERSION} \
                --package-id ${PACKAGE_ID} --sequence ${CC_SEQUENCE}
        "

    # Approve for CyberCellOrgMSP
    docker exec \
        -e CORE_PEER_ADDRESS=peer0.cyber.casevault.police.gov.in:11051 \
        -e CORE_PEER_LOCALMSPID=CyberCellOrgMSP \
        -e CORE_PEER_TLS_CERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/cyber.casevault.police.gov.in/peers/peer0.cyber.casevault.police.gov.in/tls/server.crt \
        -e CORE_PEER_TLS_KEY_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/cyber.casevault.police.gov.in/peers/peer0.cyber.casevault.police.gov.in/tls/server.key \
        -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/cyber.casevault.police.gov.in/peers/peer0.cyber.casevault.police.gov.in/tls/ca.crt \
        -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/cyber.casevault.police.gov.in/users/Admin@cyber.casevault.police.gov.in/msp \
        casevault-cli bash -c "
            peer lifecycle chaincode approveformyorg -o ${ORDERER_ADDR} \
                --ordererTLSHostnameOverride orderer.casevault.police.gov.in \
                --tls --cafile ${ORDERER_CA} \
                --channelID ${CHANNEL_NAME} --name ${CC_NAME} --version ${CC_VERSION} \
                --package-id ${PACKAGE_ID} --sequence ${CC_SEQUENCE}
        "

    echo "[LIFECYCLE 7/8] Checking commit readiness for '${CC_NAME}'..."
    docker exec casevault-cli bash -c "
        peer lifecycle chaincode checkcommitreadiness \
            --channelID ${CHANNEL_NAME} --name ${CC_NAME} --version ${CC_VERSION} \
            --sequence ${CC_SEQUENCE} --output json
    "

    echo "[LIFECYCLE 8/8] Committing chaincode definition to channel '${CHANNEL_NAME}'..."
    docker exec casevault-cli bash -c "
        peer lifecycle chaincode commit -o ${ORDERER_ADDR} \
            --ordererTLSHostnameOverride orderer.casevault.police.gov.in \
            --tls --cafile ${ORDERER_CA} \
            --channelID ${CHANNEL_NAME} --name ${CC_NAME} --version ${CC_VERSION} \
            --sequence ${CC_SEQUENCE} \
            --peerAddresses peer0.police.casevault.police.gov.in:7051 \
            --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.casevault.police.gov.in/peers/peer0.police.casevault.police.gov.in/tls/ca.crt \
            --peerAddresses peer0.fsl.casevault.police.gov.in:9051 \
            --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/fsl.casevault.police.gov.in/peers/peer0.fsl.casevault.police.gov.in/tls/ca.crt \
            --peerAddresses peer0.cyber.casevault.police.gov.in:11051 \
            --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/cyber.casevault.police.gov.in/peers/peer0.cyber.casevault.police.gov.in/tls/ca.crt
    "

    echo "[FABRIC CHAINCODE] Verifying committed chaincode on '${CHANNEL_NAME}'..."
    docker exec casevault-cli bash -c "
        peer lifecycle chaincode querycommitted --channelID ${CHANNEL_NAME} --name ${CC_NAME}
    "

    echo "[FABRIC CHAINCODE] Initializing genesis ledger via InitLedger..."
    docker exec casevault-cli bash -c "
        peer chaincode invoke -o ${ORDERER_ADDR} \
            --ordererTLSHostnameOverride orderer.casevault.police.gov.in \
            --tls --cafile ${ORDERER_CA} \
            -C ${CHANNEL_NAME} -n ${CC_NAME} \
            -c '{\"function\":\"InitLedger\",\"Args\":[]}' \
            --peerAddresses peer0.police.casevault.police.gov.in:7051 \
            --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.casevault.police.gov.in/peers/peer0.police.casevault.police.gov.in/tls/ca.crt
    "

    echo "[FABRIC CHAINCODE] Full chaincode lifecycle deployment succeeded across all 3 organizations."
}

case "${COMMAND}" in
    up)
        network_up
        ;;
    down)
        network_down
        ;;
    createChannel)
        create_channel
        ;;
    deployCC)
        deploy_chaincode
        ;;
    all)
        network_up
        create_channel
        deploy_chaincode
        ;;
    *)
        echo "Usage: $0 {up|down|createChannel|deployCC|all}"
        exit 1
        ;;
esac
