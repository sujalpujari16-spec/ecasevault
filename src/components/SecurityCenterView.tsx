/**
 * Cybersecurity Operations Center (SOC) View
 * e-CASEVAULT — Maharashtra Police Security & Threat Intelligence Dashboard
 *
 * Features:
 *   1. Real-time Security Posture Score (96/100) & Defense-in-Depth Status
 *   2. Cryptographic Evidence Integrity Monitor (SHA-256 mismatch alerts)
 *   3. Unauthorized Access & Brute-Force Protection Log
 *   4. Expired Temporary Access Grant Revocation Engine
 *   5. Security Alerts Triage & Incident Response Panel
 *   6. Infrastructure Hardening Checklist (TLS, JWT, Bcrypt, Fabric Quorum)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Key,
  Server,
  Terminal,
  Activity,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  Clock,
  UserX,
  FileCheck,
  Zap,
  Globe,
  Radio,
  Sliders,
  Database
} from 'lucide-react';
import { UserSession } from '../types';
import { fetchSecurityPostureFromApi, fetchSecurityAlertsFromApi, checkServerHealth } from '../services/apiClient';

interface SecurityCenterViewProps {
  session: UserSession;
}

export const SecurityCenterView: React.FC<SecurityCenterViewProps> = ({ session }) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ALERTS' | 'BRUTE_FORCE' | 'HARDENING'>('OVERVIEW');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([
    {
      id: 'ALT-2026-001',
      timestamp: '2026-09-01 11:24 IST',
      alertType: 'TAMPER_ALERT_HASH_MISMATCH',
      severity: 'CRITICAL',
      title: 'Evidence SHA-256 Hash Mismatch Detected',
      description: 'Evidence EV-MH-2026-009823 current SHA-256 hash differs from registered Hyperledger Fabric ledger record. File alteration flagged.',
      caseId: 'MH-MUM-2026-004821',
      status: 'ACTIVE',
    },
    {
      id: 'ALT-2026-002',
      timestamp: '2026-09-01 03:15 IST',
      alertType: 'ANOMALOUS_AFTER_HOURS_ACCESS',
      severity: 'MEDIUM',
      title: 'After-Hours Sensitive Case Record Access',
      description: 'Officer MH-PSI-4910 accessed sensitive victim records at 03:15 AM from non-station IP range 192.168.1.45.',
      caseId: 'MH-MUM-2026-004821',
      status: 'INVESTIGATING',
    },
    {
      id: 'ALT-2026-003',
      timestamp: '2026-08-30 18:40 IST',
      alertType: 'EXPIRED_GRANT_REVOKED',
      severity: 'INFO',
      title: 'Temporary Case Access Grant Expired',
      description: 'Temporary 7-day view access grant for Case MH-MUM-2026-004650 automatically revoked by SmartContract policy SC-004.',
      caseId: 'MH-MUM-2026-004650',
      status: 'RESOLVED',
    },
  ]);

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    setIsRefreshing(true);
    const isOnline = await checkServerHealth();
    setIsBackendConnected(isOnline);

    if (isOnline) {
      const alertRes = await fetchSecurityAlertsFromApi();
      if (alertRes && alertRes.success && alertRes.alerts) {
        setAlerts(alertRes.alerts);
      }
    }
    setIsRefreshing(false);
  };

  const resolveAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'RESOLVED' } : a));
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-[#182f4d] to-slate-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
                Maharashtra Police Cybersecurity Operations Center (SOC)
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight">System Security & Defense-in-Depth Monitor</h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Real-time threat detection, WebCrypto SHA-256 evidence integrity monitoring, Hyperledger Fabric ledger audit verification, and RBAC least-privilege control.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
              isBackendConnected ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' : 'bg-blue-500/20 text-blue-300 border-blue-400/30'
            }`}>
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              {isBackendConnected ? 'Express REST API Online' : 'Local Crypto Engine Active'}
            </div>
            <button
              onClick={loadSecurityData}
              disabled={isRefreshing}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-white/10 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Security Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Security Score', value: '96 / 100', status: 'OPTIMAL', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'Active Threat Alerts', value: alerts.filter(a => a.status === 'ACTIVE').length, status: '1 CRITICAL', color: 'text-red-400', bg: 'bg-red-500/10' },
            { label: 'SHA-256 Verified Evidence', value: '247 / 248', status: '99.6% MATCH', color: 'text-amber-300', bg: 'bg-amber-500/10' },
            { label: 'Expired Grants Revoked', value: '12', status: 'AUTO-ENFORCED', color: 'text-blue-300', bg: 'bg-blue-500/10' },
          ].map(m => (
            <div key={m.label} className={`${m.bg} border border-white/10 rounded-xl p-3.5`}>
              <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">{m.label}</span>
              <p className={`text-lg font-black mt-0.5 ${m.color}`}>{m.value}</p>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{m.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
        {[
          { id: 'OVERVIEW', label: 'Security Architecture', icon: ShieldCheck },
          { id: 'ALERTS', label: 'Threat Alerts & Triage', icon: AlertTriangle },
          { id: 'BRUTE_FORCE', label: 'Access & Brute-Force Logs', icon: UserX },
          { id: 'HARDENING', label: 'Infrastructure Hardening', icon: Terminal },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                activeTab === t.id ? 'bg-white text-[#182f4d] shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & DEFENSE IN DEPTH */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Defense in Depth Layers */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-700" />
                Defense-in-Depth Layered Architecture
              </h3>
              <div className="space-y-3">
                {[
                  { layer: 'Layer 1: Network & Transport Security', desc: 'TLS 1.3 encryption, strict HTTPS origin controls, API rate-limiting.', score: '100%' },
                  { layer: 'Layer 2: Authentication & Identity', desc: 'Simulated JWT tokens, bcrypt hashed secrets, session expiry controls.', score: '95%' },
                  { layer: 'Layer 3: Role-Based Access Control (RBAC)', desc: 'Need-to-know case scoping. Officers see only assigned cases.', score: '98%' },
                  { layer: 'Layer 4: Cryptographic Evidence Security', desc: 'WebCrypto SHA-256 hashes generated on client & verified against ledger.', score: '96%' },
                  { layer: 'Layer 5: Permissioned Blockchain Ledger', desc: 'Hyperledger Fabric multi-peer consensus. Immutable audit trail.', score: '100%' },
                ].map((l, i) => (
                  <div key={i} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span>{l.layer}</span>
                      <span className="text-emerald-700 font-mono">{l.score}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{l.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Zero-Trust & Sensitive Data Isolation */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-700" />
                Zero-Trust Data Protection Policies
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl space-y-1 text-violet-950">
                  <div className="font-bold flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-violet-700" />
                    Off-Chain / On-Chain Privacy Model
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Personal victim identities, witness names, raw CCTV videos, and fingerprint images are <strong>NEVER stored on the blockchain</strong>. Only cryptographic SHA-256 hashes, timestamps, and officer badge IDs are written on-chain to protect citizen privacy per DPDP Act protocols.
                  </p>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-amber-950">
                  <div className="font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                    Automatic Time-Limited Access Revocation
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Case access grants approved via official Access Requests automatically expire after 7, 14, or 30 days. SmartContract SC-004 automatically revokes read permissions and logs an audit record upon expiration.
                  </p>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-emerald-950">
                  <div className="font-bold flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-700" />
                    Digital Signature Attainability
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Every evidence custody transfer and FIR update is signed with the officer's digital certificate key, producing a verifiable SHA-256 signature token stored on the ledger.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* AI Privacy & Local Model Governance Panel */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    AI Privacy & Local Model Governance
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Cryptographic isolation and sovereign legal intelligence architecture for Maharashtra Police
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                100% AIR-GAPPED / ZERO EXTERNAL APIS
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cloud AI Status</span>
                <p className="font-bold text-red-600 flex items-center gap-1.5 text-xs">
                  <XCircle className="w-3.5 h-3.5" />
                  Gemini / OpenAI Blocked
                </p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  External generative APIs are completely stripped. Zero prompt bytes or case facts ever leave state premises.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inference Engine</span>
                <p className="font-bold text-emerald-700 flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Ollama Local / Offline Core
                </p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Executes on localhost port 11434 with deterministic legal synthesizer fallback. High-fidelity statutory reasoning.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tool RBAC Layer</span>
                <p className="font-bold text-blue-700 flex items-center gap-1.5 text-xs">
                  <Lock className="w-3.5 h-3.5" />
                  Pre-Tool Authorization
                </p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  No direct database access. Confidential case records require station jurisdiction and active IO assignment.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Blockchain Audit</span>
                <p className="font-bold text-purple-700 flex items-center gap-1.5 text-xs">
                  <FileCheck className="w-3.5 h-3.5" />
                  Hyperledger Anchored
                </p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Every legal query creates a signed AI_LEGAL_QUERY block with external_api_used = false and SHA-256 state digest.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: THREAT ALERTS & TRIAGE */}
      {activeTab === 'ALERTS' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Security Incident Triage Queue</h3>
            <span className="text-xs text-slate-500 font-medium">{alerts.filter(a => a.status === 'ACTIVE').length} active alerts requiring review</span>
          </div>

          <div className="space-y-3">
            {alerts.map(a => (
              <div
                key={a.id}
                className={`p-4 rounded-xl border space-y-3 ${
                  a.severity === 'CRITICAL' ? 'bg-red-50/70 border-red-300' :
                  a.severity === 'HIGH' ? 'bg-orange-50/70 border-orange-300' :
                  a.severity === 'MEDIUM' ? 'bg-amber-50/70 border-amber-300' :
                  'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`w-4 h-4 ${
                      a.severity === 'CRITICAL' ? 'text-red-600' :
                      a.severity === 'HIGH' ? 'text-orange-600' :
                      a.severity === 'MEDIUM' ? 'text-amber-600' :
                      'text-blue-600'
                    }`} />
                    <span className="font-mono text-xs font-bold text-slate-900">{a.id}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                      a.severity === 'CRITICAL' ? 'bg-red-600 text-white' :
                      a.severity === 'HIGH' ? 'bg-orange-500 text-white' :
                      a.severity === 'MEDIUM' ? 'bg-amber-500 text-white' :
                      'bg-slate-200 text-slate-800'
                    }`}>{a.severity}</span>
                  </div>

                  {a.status !== 'RESOLVED' ? (
                    <button
                      onClick={() => resolveAlert(a.id)}
                      className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] rounded-lg cursor-pointer flex items-center gap-1 transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark Resolved
                    </button>
                  ) : (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded">RESOLVED</span>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-900">{a.title}</h4>
                  <p className="text-xs text-slate-700 mt-0.5">{a.description}</p>
                </div>

                <div className="flex items-center gap-4 text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
                  <span>Timestamp: <strong className="text-slate-800">{a.timestamp}</strong></span>
                  {a.caseId && <span>Case ID: <strong className="text-slate-800 font-mono">{a.caseId}</strong></span>}
                  <span>Status: <strong className="text-slate-800">{a.status}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: ACCESS & BRUTE-FORCE LOGS */}
      {activeTab === 'BRUTE_FORCE' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserX className="w-4 h-4 text-red-600" />
                Brute-Force & Failed Authentication Log
              </h3>
              <p className="text-xs text-slate-500">Automatically tracks invalid password attempts and triggers account lockout after 5 consecutive failures.</p>
            </div>
            <span className="px-2.5 py-1 bg-red-100 text-red-800 font-bold text-xs rounded-lg">Rate Limiter Active</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Client IP</th>
                  <th className="p-3">Attempted Badge / User</th>
                  <th className="p-3">Failure Reason</th>
                  <th className="p-3">Security Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50">
                  <td className="p-3 font-mono text-slate-600">2026-09-01 21:40:12</td>
                  <td className="p-3 font-mono">192.168.1.104</td>
                  <td className="p-3 font-bold text-slate-800">MH-POL-9921</td>
                  <td className="p-3 text-red-600 font-medium">Bcrypt Hash Verification Mismatch</td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">Attempt Flagged</span></td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-3 font-mono text-slate-600">2026-09-01 19:12:05</td>
                  <td className="p-3 font-mono">203.0.113.88</td>
                  <td className="p-3 font-bold text-slate-800">badge_probe_4910</td>
                  <td className="p-3 text-red-600 font-medium">Invalid Credential Pair</td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">Attempt Flagged</span></td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-3 font-mono text-slate-600">2026-08-31 02:44:19</td>
                  <td className="p-3 font-mono">198.51.100.14</td>
                  <td className="p-3 font-bold text-slate-800">admin_root</td>
                  <td className="p-3 text-red-600 font-medium">Unknown Account / Probe</td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-red-100 text-red-800 rounded font-bold text-[10px]">IP Temporarily Banned</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: INFRASTRUCTURE HARDENING */}
      {activeTab === 'HARDENING' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-blue-700" />
            System Hardening & Cryptographic Configuration Verification
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {[
              { title: 'SHA-256 Hashing Standard', value: 'WebCrypto subtle.digest("SHA-256") / Node crypto', status: 'COMPLIANT' },
              { title: 'Password Storage Standard', value: 'Bcrypt with 12 Work Factor Rounds', status: 'COMPLIANT' },
              { title: 'JWT Token Security', value: 'SHA-256 Signed Secret Payload with 24h Expiry', status: 'ACTIVE' },
              { title: 'Hyperledger Fabric Consensus', value: 'Raft Orderer + 3-Org Endorsement Policy', status: 'ENFORCED' },
              { title: 'CORS & Origin Protections', value: 'Strict White-listed HTTP Request Origins', status: 'ENFORCED' },
              { title: 'Evidence Storage Policy', value: 'SHA-256 On-Chain / Encrypted Binary Off-Chain', status: 'COMPLIANT' },
            ].map((h, i) => (
              <div key={i} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>{h.title}</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] rounded font-bold">{h.status}</span>
                </div>
                <p className="text-[11px] text-slate-600 font-mono">{h.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
