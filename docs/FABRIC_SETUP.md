# e-CASEVAULT — Hyperledger Fabric 2.5 Multi-Org Deployment Guide

## 1. Network Architecture
- **Consensus**: Raft (`etcdraft`) single orderer cluster (`orderer.casevault.police.gov.in:7050`)
- **Organizations**:
  1. `PoliceOrgMSP` (`peer0.police.casevault.police.gov.in:7051`)
  2. `FSLOrgMSP` (`peer0.fsl.casevault.police.gov.in:9051`)
  3. `CyberCellOrgMSP` (`peer0.cyber.casevault.police.gov.in:11051`)
- **Channel**: `ecasevault-channel`
- **Chaincode**: `ecasevault` (Go 1.20 contract at `blockchain/chaincode/eCaseVault`)

---

## 2. One-Command Complete Network & Chaincode Deployment

Deploy the entire network, channel, and chaincode lifecycle in one command:

```bash
cd blockchain/network
./network.sh all
```

This single command executes the authoritative 8-step lifecycle:
1. Generates X.509 ECDSA certificates and MSP directory structure via `./generate-crypto.sh`.
2. Starts Orderer, 3 Peer nodes, and `casevault-cli` container via `docker compose`.
3. Generates channel transaction (`ecasevault-channel.tx`) via `configtxgen` using profile `CaseVaultChannel`.
4. Creates channel `ecasevault-channel` and joins all 3 organization peers.
5. Packages chaincode `ecasevault.tar.gz`.
6. Installs chaincode on PoliceOrg, FSLOrg, and CyberCellOrg peers.
7. Approves chaincode definition across all 3 organizations (majority endorsement).
8. Commits chaincode definition to `ecasevault-channel`, initializes ledger, and validates query.

---

## 3. Fabric Gateway Client SDK Integration

The Express backend connects via `@hyperledger/fabric-gateway` using the following environment variables:

```env
FABRIC_CHANNEL=ecasevault-channel
FABRIC_CHAINCODE=ecasevault
FABRIC_MSP_ID=PoliceOrgMSP
FABRIC_PEER_ENDPOINT=localhost:7051
FABRIC_PEER_HOST_ALIAS=peer0.police.casevault.police.gov.in
```
