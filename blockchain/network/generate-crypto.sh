#!/usr/bin/env bash
# ============================================================================
# e-CASEVAULT — Hyperledger Fabric 2.5 Crypto Generation Script
# Generates realistic X.509 ECDSA (prime256v1) credentials for all 3 organizations
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORG_DIR="${SCRIPT_DIR}/organizations"

echo "[FABRIC CRYPTO] Initializing MSP & TLS infrastructure in ${ORG_DIR}..."
rm -rf "${ORG_DIR}"
mkdir -p "${ORG_DIR}"

# 1. Orderer Org CA & Orderer Node
ORDERER_DOMAIN="casevault.police.gov.in"
ORDERER_BASE="${ORG_DIR}/ordererOrganizations/${ORDERER_DOMAIN}"
mkdir -p "${ORDERER_BASE}/msp/cacerts" "${ORDERER_BASE}/msp/tlscacerts"
mkdir -p "${ORDERER_BASE}/orderers/orderer.${ORDERER_DOMAIN}/msp/keystore"
mkdir -p "${ORDERER_BASE}/orderers/orderer.${ORDERER_DOMAIN}/msp/signcerts"
mkdir -p "${ORDERER_BASE}/orderers/orderer.${ORDERER_DOMAIN}/msp/cacerts"
mkdir -p "${ORDERER_BASE}/orderers/orderer.${ORDERER_DOMAIN}/msp/tlscacerts"
mkdir -p "${ORDERER_BASE}/orderers/orderer.${ORDERER_DOMAIN}/tls"

# Orderer CA Key & Cert (ECDSA prime256v1)
openssl ecparam -name prime256v1 -genkey -noout -out "${ORDERER_BASE}/msp/ca-key.pem"
openssl req -new -x509 -days 365 \
  -subj "/C=IN/ST=Maharashtra/L=Mumbai/O=OrdererOrg/CN=ca.${ORDERER_DOMAIN}" \
  -key "${ORDERER_BASE}/msp/ca-key.pem" \
  -out "${ORDERER_BASE}/msp/cacerts/ca.pem" 2>/dev/null
cp "${ORDERER_BASE}/msp/cacerts/ca.pem" "${ORDERER_BASE}/msp/tlscacerts/tlsca.pem"

# Orderer Node Key & Cert
openssl ecparam -name prime256v1 -genkey -noout -out "${ORDERER_BASE}/orderers/orderer.${ORDERER_DOMAIN}/tls/server.key"
openssl req -new \
  -subj "/C=IN/ST=Maharashtra/L=Mumbai/O=OrdererOrg/CN=orderer.${ORDERER_DOMAIN}" \
  -key "${ORDERER_BASE}/orderers/orderer.${ORDERER_DOMAIN}/tls/server.key" \
  -out "${ORDERER_BASE}/orderers/orderer.${ORDERER_DOMAIN}/tls/server.csr" 2>/dev/null

openssl x509 -req -days 365 \
  -in "${ORDERER_BASE}/orderers/orderer.${ORDERER_DOMAIN}/tls/server.csr" \
  -CA "${ORDERER_BASE}/msp/cacerts/ca.pem" \
  -CAkey "${ORDERER_BASE}/msp/ca-key.pem" \
  -CAcreateserial \
  -out "${ORDERER_BASE}/orderers/orderer.${ORDERER_DOMAIN}/tls/server.crt" 2>/dev/null
cp "${ORDERER_BASE}/msp/cacerts/ca.pem" "${ORDERER_BASE}/orderers/orderer.${ORDERER_DOMAIN}/tls/ca.crt"
cp "${ORDERER_BASE}/orderers/orderer.${ORDERER_DOMAIN}/tls/server.key" "${ORDERER_BASE}/orderers/orderer.${ORDERER_DOMAIN}/msp/keystore/priv_sk"
cp "${ORDERER_BASE}/orderers/orderer.${ORDERER_DOMAIN}/tls/server.crt" "${ORDERER_BASE}/orderers/orderer.${ORDERER_DOMAIN}/msp/signcerts/cert.pem"
cp "${ORDERER_BASE}/msp/cacerts/ca.pem" "${ORDERER_BASE}/orderers/orderer.${ORDERER_DOMAIN}/msp/cacerts/ca.pem"
cp "${ORDERER_BASE}/msp/cacerts/ca.pem" "${ORDERER_BASE}/orderers/orderer.${ORDERER_DOMAIN}/msp/tlscacerts/tlsca.pem"

# Function to generate peer org crypto
generate_peer_org() {
  local ORG_NAME="$1"
  local ORG_DOMAIN="$2"
  local MSP_ID="$3"
  local PEER_NAME="peer0.${ORG_DOMAIN}"

  echo "[FABRIC CRYPTO] Provisioning ECDSA credentials for ${ORG_NAME} (${MSP_ID})..."
  local PEER_BASE="${ORG_DIR}/peerOrganizations/${ORG_DOMAIN}"
  mkdir -p "${PEER_BASE}/msp/cacerts" "${PEER_BASE}/msp/tlscacerts" "${PEER_BASE}/tlsca"
  mkdir -p "${PEER_BASE}/peers/${PEER_NAME}/msp/keystore" "${PEER_BASE}/peers/${PEER_NAME}/msp/signcerts"
  mkdir -p "${PEER_BASE}/peers/${PEER_NAME}/msp/cacerts" "${PEER_BASE}/peers/${PEER_NAME}/msp/tlscacerts"
  mkdir -p "${PEER_BASE}/peers/${PEER_NAME}/tls"
  mkdir -p "${PEER_BASE}/users/Admin@${ORG_DOMAIN}/msp/keystore" "${PEER_BASE}/users/Admin@${ORG_DOMAIN}/msp/signcerts"
  mkdir -p "${PEER_BASE}/users/Admin@${ORG_DOMAIN}/msp/cacerts" "${PEER_BASE}/users/Admin@${ORG_DOMAIN}/msp/tlscacerts"
  mkdir -p "${PEER_BASE}/users/User1@${ORG_DOMAIN}/msp/keystore" "${PEER_BASE}/users/User1@${ORG_DOMAIN}/msp/signcerts"
  mkdir -p "${PEER_BASE}/users/User1@${ORG_DOMAIN}/msp/cacerts" "${PEER_BASE}/users/User1@${ORG_DOMAIN}/msp/tlscacerts"

  # Org CA Key & Cert (ECDSA prime256v1)
  openssl ecparam -name prime256v1 -genkey -noout -out "${PEER_BASE}/msp/ca-key.pem"
  openssl req -new -x509 -days 365 \
    -subj "/C=IN/ST=Maharashtra/L=Mumbai/O=${ORG_NAME}/CN=ca.${ORG_DOMAIN}" \
    -key "${PEER_BASE}/msp/ca-key.pem" \
    -out "${PEER_BASE}/msp/cacerts/ca.pem" 2>/dev/null
  cp "${PEER_BASE}/msp/cacerts/ca.pem" "${PEER_BASE}/msp/tlscacerts/tlsca.pem"
  cp "${PEER_BASE}/msp/cacerts/ca.pem" "${PEER_BASE}/tlsca/tlsca.${ORG_NAME}-cert.pem"

  # Peer Node TLS & Signing Certs
  openssl ecparam -name prime256v1 -genkey -noout -out "${PEER_BASE}/peers/${PEER_NAME}/tls/server.key"
  openssl req -new \
    -subj "/C=IN/ST=Maharashtra/L=Mumbai/O=${ORG_NAME}/CN=${PEER_NAME}" \
    -key "${PEER_BASE}/peers/${PEER_NAME}/tls/server.key" \
    -out "${PEER_BASE}/peers/${PEER_NAME}/tls/server.csr" 2>/dev/null

  openssl x509 -req -days 365 \
    -in "${PEER_BASE}/peers/${PEER_NAME}/tls/server.csr" \
    -CA "${PEER_BASE}/msp/cacerts/ca.pem" \
    -CAkey "${PEER_BASE}/msp/ca-key.pem" \
    -CAcreateserial \
    -out "${PEER_BASE}/peers/${PEER_NAME}/tls/server.crt" 2>/dev/null

  cp "${PEER_BASE}/msp/cacerts/ca.pem" "${PEER_BASE}/peers/${PEER_NAME}/tls/ca.crt"
  cp "${PEER_BASE}/peers/${PEER_NAME}/tls/server.key" "${PEER_BASE}/peers/${PEER_NAME}/msp/keystore/priv_sk"
  cp "${PEER_BASE}/peers/${PEER_NAME}/tls/server.crt" "${PEER_BASE}/peers/${PEER_NAME}/msp/signcerts/cert.pem"
  cp "${PEER_BASE}/msp/cacerts/ca.pem" "${PEER_BASE}/peers/${PEER_NAME}/msp/cacerts/ca.pem"
  cp "${PEER_BASE}/msp/cacerts/ca.pem" "${PEER_BASE}/peers/${PEER_NAME}/msp/tlscacerts/tlsca.pem"

  # User1 (Client Application Identity used by Fabric Gateway)
  openssl ecparam -name prime256v1 -genkey -noout -out "${PEER_BASE}/users/User1@${ORG_DOMAIN}/msp/keystore/priv_sk"
  openssl req -new \
    -subj "/C=IN/ST=Maharashtra/L=Mumbai/O=${ORG_NAME}/CN=User1@${ORG_DOMAIN}" \
    -key "${PEER_BASE}/users/User1@${ORG_DOMAIN}/msp/keystore/priv_sk" \
    -out "${PEER_BASE}/users/User1@${ORG_DOMAIN}/msp/user1.csr" 2>/dev/null

  openssl x509 -req -days 365 \
    -in "${PEER_BASE}/users/User1@${ORG_DOMAIN}/msp/user1.csr" \
    -CA "${PEER_BASE}/msp/cacerts/ca.pem" \
    -CAkey "${PEER_BASE}/msp/ca-key.pem" \
    -CAcreateserial \
    -out "${PEER_BASE}/users/User1@${ORG_DOMAIN}/msp/signcerts/cert.pem" 2>/dev/null
  cp "${PEER_BASE}/msp/cacerts/ca.pem" "${PEER_BASE}/users/User1@${ORG_DOMAIN}/msp/cacerts/ca.pem"
  cp "${PEER_BASE}/msp/cacerts/ca.pem" "${PEER_BASE}/users/User1@${ORG_DOMAIN}/msp/tlscacerts/tlsca.pem"

  # Admin Identity
  openssl ecparam -name prime256v1 -genkey -noout -out "${PEER_BASE}/users/Admin@${ORG_DOMAIN}/msp/keystore/priv_sk"
  openssl req -new \
    -subj "/C=IN/ST=Maharashtra/L=Mumbai/O=${ORG_NAME}/CN=Admin@${ORG_DOMAIN}" \
    -key "${PEER_BASE}/users/Admin@${ORG_DOMAIN}/msp/keystore/priv_sk" \
    -out "${PEER_BASE}/users/Admin@${ORG_DOMAIN}/msp/admin.csr" 2>/dev/null

  openssl x509 -req -days 365 \
    -in "${PEER_BASE}/users/Admin@${ORG_DOMAIN}/msp/admin.csr" \
    -CA "${PEER_BASE}/msp/cacerts/ca.pem" \
    -CAkey "${PEER_BASE}/msp/ca-key.pem" \
    -CAcreateserial \
    -out "${PEER_BASE}/users/Admin@${ORG_DOMAIN}/msp/signcerts/cert.pem" 2>/dev/null
  # Helper to generate individual officer identities
  generate_officer_identity() {
    local BADGE="$1"
    local SAFE_BADGE="${BADGE//[^a-zA-Z0-9_-]/_}"
    local USER_DIR="${PEER_BASE}/users/officer-${SAFE_BADGE}"
    mkdir -p "${USER_DIR}/msp/keystore" "${USER_DIR}/msp/signcerts" "${USER_DIR}/msp/cacerts" "${USER_DIR}/msp/tlscacerts"
    openssl ecparam -name prime256v1 -genkey -noout -out "${USER_DIR}/msp/keystore/priv_sk"
    openssl req -new \
      -subj "/C=IN/ST=Maharashtra/L=Mumbai/O=${ORG_NAME}/CN=officer-${BADGE}" \
      -key "${USER_DIR}/msp/keystore/priv_sk" \
      -out "${USER_DIR}/msp/officer.csr" 2>/dev/null
    local EXT_FILE="${USER_DIR}/msp/ext.cnf"
    cat <<EOF > "${EXT_FILE}"
[default]
1.2.3.4.5.6.7.8.1 = ASN1:UTF8String:{"attrs":{"officerBadge":"${BADGE}"}}
EOF
    openssl x509 -req -days 365 \
      -in "${USER_DIR}/msp/officer.csr" \
      -CA "${PEER_BASE}/msp/cacerts/ca.pem" \
      -CAkey "${PEER_BASE}/msp/ca-key.pem" \
      -CAcreateserial \
      -extfile "${EXT_FILE}" \
      -out "${USER_DIR}/msp/signcerts/cert.pem" 2>/dev/null
    rm -f "${EXT_FILE}"
    cp "${PEER_BASE}/msp/cacerts/ca.pem" "${USER_DIR}/msp/cacerts/ca.pem"
    cp "${PEER_BASE}/msp/cacerts/ca.pem" "${USER_DIR}/msp/tlscacerts/tlsca.pem"
  }

  if [ "${ORG_NAME}" = "PoliceOrg" ]; then
    generate_officer_identity "MH-POL-8842"
    generate_officer_identity "MH-POL-1001"
    generate_officer_identity "MH-POL-2045"
    generate_officer_identity "MH-POL-4412"
    generate_officer_identity "MH-POL-5501"
  elif [ "${ORG_NAME}" = "FSLOrg" ]; then
    generate_officer_identity "MH-FSL-001"
  elif [ "${ORG_NAME}" = "CyberCellOrg" ]; then
    generate_officer_identity "MH-CYB-001"
  fi
}

generate_peer_org "PoliceOrg" "police.casevault.police.gov.in" "PoliceOrgMSP"
generate_peer_org "FSLOrg" "fsl.casevault.police.gov.in" "FSLOrgMSP"
generate_peer_org "CyberCellOrg" "cyber.casevault.police.gov.in" "CyberCellOrgMSP"

echo "[FABRIC CRYPTO] X.509 ECDSA (prime256v1) certificates generated successfully."
