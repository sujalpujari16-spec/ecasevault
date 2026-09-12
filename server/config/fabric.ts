import path from 'path';

export const FABRIC_CONFIG = {
  channelName: process.env.FABRIC_CHANNEL || 'ecasevault-channel',
  chaincodeName: process.env.FABRIC_CHAINCODE || 'ecasevault',
  mspId: process.env.FABRIC_MSP_ID || 'PoliceOrgMSP',
  cryptoPath: process.env.FABRIC_CRYPTO_PATH || path.resolve(process.cwd(), 'blockchain/network/organizations/peerOrganizations/police.casevault.police.gov.in'),
  peerEndpoint: process.env.FABRIC_PEER_ENDPOINT || 'localhost:7051',
  peerHostAlias: process.env.FABRIC_PEER_HOST_ALIAS || 'peer0.police.casevault.police.gov.in',
};
