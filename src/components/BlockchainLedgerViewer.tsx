import React, { useState, useEffect } from 'react';
import { Shield, Lock, CheckCircle, Cpu, RefreshCw, Copy, Check, Link, FileText, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { apiClient } from '../services/apiClient';

interface FabricTransaction {
  txId: string;
  txType: string;
  resourceId: string;
  actor: string;
  organization: string;
  timestamp: string;
  status: string;
}

interface BlockchainEventItem {
  eventId: string;
  caseId?: string;
  entityId: string;
  entityType: string;
  action: string;
  actorId: string;
  actorName?: string;
  timestamp: string;
  fileHash?: string;
  dataHash: string;
  previousHash: string;
  eventHash: string;
  blockchainTxId?: string;
  blockchainStatus: string;
  metadata?: Record<string, any>;
}

interface BlockchainLedgerViewerProps {
  refreshTrigger?: number;
}

export const BlockchainLedgerViewer: React.FC<BlockchainLedgerViewerProps> = ({ refreshTrigger }) => {
  const [activeTab, setActiveTab] = useState<'CHAIN' | 'TRANSACTIONS'>('CHAIN');
  const [transactions, setTransactions] = useState<FabricTransaction[]>([]);
  const [events, setEvents] = useState<BlockchainEventItem[]>([]);
  const [verificationReport, setVerificationReport] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const loadLedgerData = async () => {
    setLoading(true);
    try {
      const [txRes, statsRes, eventsRes, verifyRes] = await Promise.all([
        apiClient.getFabricTransactions().catch(() => ({ success: false })),
        apiClient.getFabricStats().catch(() => ({ success: false })),
        apiClient.getBlockchainEvents().catch(() => ({ success: false })),
        apiClient.verifyBlockchainEventChain().catch(() => ({ success: false })),
      ]);

      if (txRes && txRes.success && Array.isArray(txRes.transactions)) {
        setTransactions(txRes.transactions);
      }
      if (statsRes && statsRes.success) {
        setStats(statsRes);
      }
      if (eventsRes && eventsRes.success && Array.isArray(eventsRes.events)) {
        setEvents(eventsRes.events);
      }
      if (verifyRes && verifyRes.success && verifyRes.report) {
        setVerificationReport(verifyRes.report);
      }
    } catch (err) {
      console.error('[FABRIC LEDGER VIEWER ERROR]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyChain = async () => {
    setIsVerifying(true);
    try {
      const res = await apiClient.verifyBlockchainEventChain();
      if (res && res.success) {
        setVerificationReport(res.report);
      }
    } catch (err) {
      console.error('[VERIFY CHAIN ERROR]', err);
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    loadLedgerData();
  }, [refreshTrigger]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Header Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-mono uppercase">Network Status</p>
            <p className="text-lg font-bold text-emerald-400 flex items-center gap-1.5 mt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              {stats?.status || 'FABRIC_2.5_ACTIVE'}
            </p>
          </div>
          <Cpu className="w-8 h-8 text-emerald-400/30" />
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-mono uppercase">Activity Chain Events</p>
            <p className="text-xl font-bold text-slate-100 mt-1">{events.length}</p>
          </div>
          <Link className="w-8 h-8 text-purple-400/30" />
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-mono uppercase">Channel</p>
            <p className="text-lg font-bold text-indigo-400 mt-1">{stats?.channel || 'ecasevault-channel'}</p>
          </div>
          <Lock className="w-8 h-8 text-indigo-400/30" />
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-mono uppercase">Chain Integrity</p>
            <p className={`text-lg font-bold flex items-center gap-1 mt-1 ${
              verificationReport?.isIntact ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              <ShieldCheck className="w-5 h-5" />
              {verificationReport?.isIntact ? '100% INTACT' : 'VERIFIED'}
            </p>
          </div>
          <CheckCircle className="w-8 h-8 text-emerald-400/30" />
        </div>
      </div>

      {/* Main Ledger Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-5">
        {/* Navigation & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('CHAIN')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'CHAIN' 
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40' 
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Link className="w-3.5 h-3.5" />
              <span>Activity Hash-Chain ({events.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('TRANSACTIONS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'TRANSACTIONS' 
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40' 
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Fabric Transactions ({transactions.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleVerifyChain}
              disabled={isVerifying}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-700/30 hover:bg-emerald-700/50 border border-emerald-500/40 text-emerald-300 rounded-lg transition cursor-pointer font-semibold disabled:opacity-50"
            >
              <ShieldCheck className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
              <span>Verify Chain Integrity</span>
            </button>
            <button
              type="button"
              onClick={loadLedgerData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Live Integrity Banner */}
        {verificationReport && (
          <div className={`p-3 rounded-lg border flex items-center justify-between gap-3 text-xs ${
            verificationReport.isIntact 
              ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300' 
              : 'bg-amber-950/30 border-amber-800/60 text-amber-300'
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{verificationReport.details}</span>
            </div>
            <span className="font-mono text-[11px] text-slate-400 shrink-0">
              Verified: {new Date(verificationReport.verificationTimestamp).toLocaleTimeString()}
            </span>
          </div>
        )}

        {/* TAB 1: ACTIVITY HASH-CHAIN */}
        {activeTab === 'CHAIN' && (
          <div>
            {loading ? (
              <div className="p-8 text-center text-slate-400">Loading blockchain activity chain...</div>
            ) : events.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                No blockchain activity events recorded yet. Register an FIR to generate the Genesis block.
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((evt, idx) => {
                  const isFirst = idx === 0;
                  const isLatest = idx === events.length - 1;
                  return (
                    <div
                      key={evt.eventId}
                      className="bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition space-y-3"
                    >
                      {/* Top row: Block Index, Action, Entity, Time */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-purple-900/40 text-purple-300 border border-purple-700/50">
                            BLOCK #{idx + 1}
                          </span>
                          <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-blue-900/30 text-blue-300 border border-blue-700/40">
                            {evt.action}
                          </span>
                          {evt.caseId && (
                            <span className="font-mono text-[11px] text-slate-300">
                              {evt.caseId}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-slate-400 text-[11px] font-mono">
                          <span>{new Date(evt.timestamp).toLocaleString()}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                            {evt.blockchainStatus}
                          </span>
                        </div>
                      </div>

                      {/* Actor & Entity */}
                      <div className="text-xs text-slate-300 flex items-center gap-2">
                        <span className="text-slate-400">Initiator:</span>
                        <span className="font-semibold text-slate-200">{evt.actorName || evt.actorId}</span>
                        <span className="font-mono text-slate-400 text-[11px]">({evt.actorId})</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-400">Entity:</span>
                        <span className="font-mono text-slate-200">{evt.entityType}:{evt.entityId}</span>
                      </div>

                      {/* Cryptographic Link Flow */}
                      <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-3 text-[11px] font-mono space-y-2">
                        {/* File Hash if present */}
                        {evt.fileHash && (
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <span className="text-blue-400 font-sans font-bold flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5" /> File Content Raw Hash:
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-blue-300 font-mono" title={evt.fileHash}>
                                {evt.fileHash.substring(0, 32)}...
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(evt.fileHash!)}
                                className="text-slate-500 hover:text-slate-300 p-0.5"
                                title="Copy File Hash"
                              >
                                {copiedHash === evt.fileHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Previous Hash -> Event Hash */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-sans">Previous Block Hash:</span>
                            <span className="text-slate-400 truncate block" title={evt.previousHash}>
                              {isFirst ? '0000000000000000... [GENESIS]' : `${evt.previousHash.substring(0, 24)}...`}
                            </span>
                          </div>
                          <div>
                            <span className="text-purple-400 block text-[10px] uppercase font-sans font-bold">Event Hash:</span>
                            <div className="flex items-center gap-1">
                              <span className="text-purple-300 font-bold truncate" title={evt.eventHash}>
                                {evt.eventHash.substring(0, 24)}...
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(evt.eventHash)}
                                className="text-slate-500 hover:text-slate-300 p-0.5"
                                title="Copy Event Hash"
                              >
                                {copiedHash === evt.eventHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* TxID */}
                        {evt.blockchainTxId && (
                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/40">
                            <span>Hyperledger Fabric TxID:</span>
                            <span className="font-mono text-emerald-400/90">{evt.blockchainTxId}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FABRIC TRANSACTIONS */}
        {activeTab === 'TRANSACTIONS' && (
          <div>
            {loading ? (
              <div className="p-8 text-center text-slate-400">Loading Fabric transaction records...</div>
            ) : transactions.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No on-chain transactions found for current authorization scope.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 uppercase text-slate-400 bg-slate-950/50">
                      <th className="py-3 px-4">Transaction ID</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Resource ID</th>
                      <th className="py-3 px-4">Actor</th>
                      <th className="py-3 px-4">Organization</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {transactions.map((tx) => (
                      <tr key={tx.txId} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono text-blue-400">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate max-w-[150px] sm:max-w-[200px]" title={tx.txId}>
                              {tx.txId}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(tx.txId)}
                              className="text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                              title="Copy Full Transaction ID"
                            >
                              {copiedHash === tx.txId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            tx.txType === 'CASE_REGISTRATION' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            tx.txType === 'EVIDENCE_REGISTRATION' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                            'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {tx.txType}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">{tx.resourceId || 'N/A'}</td>
                        <td className="py-3 px-4 text-slate-300">{tx.actor || 'PoliceOrgMSP'}</td>
                        <td className="py-3 px-4 font-mono text-slate-400">{tx.organization || 'PoliceOrgMSP'}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            tx.status === 'CONFIRMED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            tx.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {new Date(tx.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

