import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Clock,
  User,
  Building2,
  Calendar,
  ChevronDown,
  Filter,
  Bell
} from 'lucide-react';
import { CaseFile, UserSession, CaseAccessRequest, CaseAssignment, CaseAccessLevel } from '../types';
import { soundEffects } from './AudioEffects';
import { apiClient } from '../services/apiClient';

interface AccessRequestApprovalPanelProps {
  cases: CaseFile[];
  session: UserSession;
  onUpdateCases: (cases: CaseFile[]) => void;
}

export const AccessRequestApprovalPanel: React.FC<AccessRequestApprovalPanelProps> = ({
  cases,
  session,
  onUpdateCases
}) => {
  const [filterStatus, setFilterStatus] = useState<'Pending' | 'Approved' | 'Rejected' | 'ALL'>('Pending');
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [approvalNote, setApprovalNote] = useState<Record<string, string>>({});

  // Gather all access requests from all accessible cases
  const allRequests: Array<{ request: CaseAccessRequest; caseFile: CaseFile }> = [];
  cases.forEach(c => {
    (c.accessRequests || []).forEach(r => {
      if (filterStatus === 'ALL' || r.status === filterStatus) {
        allRequests.push({ request: r, caseFile: c });
      }
    });
  });

  const pendingCount = cases.reduce((acc, c) =>
    acc + (c.accessRequests || []).filter(r => r.status === 'Pending').length, 0);

  const handleApprove = (caseFile: CaseFile, request: CaseAccessRequest) => {
    soundEffects.playStamp();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + request.requestedDurationDays * 24 * 60 * 60 * 1000);
    const approvedAt = now.toISOString().replace('T', ' ').substring(0, 16) + ' IST';
    const expiresAtStr = expiresAt.toISOString().replace('T', ' ').substring(0, 16) + ' IST';

    const newAssignment: CaseAssignment = {
      assignmentId: `ASGN-${caseFile.id.slice(-6)}-${Date.now().toString(36).toUpperCase()}`,
      caseId: caseFile.id,
      userId: request.requestedByUserId,
      officerName: request.requestedByName,
      officerRank: request.requestedByRank,
      assignmentRole: 'Temporary View Access',
      assignedBy: session.badgeNo,
      assignedByName: session.officerName,
      assignedAt: approvedAt,
      accessLevel: request.requestedAccessLevel,
      status: 'Active',
      expiresAt: expiresAtStr
    };

    const updatedCase: CaseFile = {
      ...caseFile,
      accessRequests: (caseFile.accessRequests || []).map(r =>
        r.requestId === request.requestId
          ? {
              ...r,
              status: 'Approved' as const,
              reviewedBy: session.badgeNo,
              reviewedByName: session.officerName,
              reviewedAt: approvedAt,
              approvalNote: approvalNote[request.requestId] || '',
              expiresAt: expiresAtStr
            }
          : r
      ),
      caseAssignments: [...(caseFile.caseAssignments || []), newAssignment],
      timeline: [
        ...(caseFile.timeline || []),
        {
          id: `TL-AR-${Date.now()}`,
          date: now.toISOString().substring(0, 10),
          title: 'Access Request Approved',
          description: `${request.requestedByRank} ${request.requestedByName} granted ${request.requestedAccessLevel} access for ${request.requestedDurationDays} days. Approved by ${session.officerName}. Expires: ${expiresAtStr}`,
          officer: session.officerName,
          badge: session.badgeNo,
          type: 'ACCESS_GRANTED'
        }
      ]
    };

    const updatedCases = cases.map(c => c.id === caseFile.id ? updatedCase : c);
    onUpdateCases(updatedCases);

    // Synchronize approval with backend & blockchain event chain
    apiClient.approveAccessRequest(request.requestId, request.requestedDurationDays * 24).catch(err => {
      console.warn('[BACKEND_ACCESS_APPROVE_SYNC_WARN]', err);
    });
  };

  const handleReject = (caseFile: CaseFile, request: CaseAccessRequest) => {
    soundEffects.playSnap();
    const rejectedAt = new Date().toISOString().replace('T', ' ').substring(0, 16) + ' IST';
    const reason = approvalNote[request.requestId] || 'Request rejected by authority.';

    const updatedCase: CaseFile = {
      ...caseFile,
      accessRequests: (caseFile.accessRequests || []).map(r =>
        r.requestId === request.requestId
          ? {
              ...r,
              status: 'Rejected' as const,
              reviewedBy: session.badgeNo,
              reviewedByName: session.officerName,
              reviewedAt: rejectedAt,
              approvalNote: reason
            }
          : r
      )
    };

    const updatedCases = cases.map(c => c.id === caseFile.id ? updatedCase : c);
    onUpdateCases(updatedCases);

    // Synchronize rejection with backend & blockchain event chain
    apiClient.rejectAccessRequest(request.requestId, reason).catch(err => {
      console.warn('[BACKEND_ACCESS_REJECT_SYNC_WARN]', err);
    });
  };

  const STATUS_STYLES: Record<string, string> = {
    Pending: 'bg-amber-100 text-amber-800 border-amber-200',
    Approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Rejected: 'bg-red-100 text-red-800 border-red-200',
    'More Info Requested': 'bg-blue-100 text-blue-800 border-blue-200',
    Expired: 'bg-slate-100 text-slate-600 border-slate-200'
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[#182f4d] flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Access Request Approval
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Review and approve officer requests for case access
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-100 border border-amber-300 rounded-xl">
            <Bell className="w-4 h-4 text-amber-600 animate-pulse" />
            <span className="text-xs font-bold text-amber-800">{pendingCount} Pending</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-slate-400" />
        {(['Pending', 'Approved', 'Rejected', 'ALL'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              filterStatus === s
                ? 'bg-[#182f4d] text-white border-[#182f4d]'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {s === 'ALL' ? 'All Requests' : s}
          </button>
        ))}
      </div>

      {/* Request List */}
      {allRequests.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 border border-slate-200 rounded-xl">
          <Shield className="w-10 h-10 mx-auto mb-3 text-slate-200" />
          <p className="text-sm text-slate-500 font-medium">No {filterStatus === 'ALL' ? '' : filterStatus.toLowerCase()} requests</p>
          <p className="text-xs text-slate-400 mt-1">Access requests will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allRequests.map(({ request, caseFile }) => (
            <motion.div
              key={request.requestId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs"
            >
              {/* Request Header */}
              <div
                className="p-4 flex items-start gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpandedRequest(expandedRequest === request.requestId ? null : request.requestId)}
              >
                <div className="w-9 h-9 rounded-xl bg-[#182f4d]/10 flex items-center justify-center shrink-0">
                  <User className="w-4.5 h-4.5 text-[#182f4d]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#182f4d] font-mono">{request.requestId}</span>
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${STATUS_STYLES[request.status]}`}>
                      {request.status}
                    </span>
                    {request.status === 'Pending' && (
                      <span className="text-[10px] text-amber-600 font-semibold animate-pulse">● Action Required</span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-slate-800 mt-0.5">
                    {request.requestedByRank} {request.requestedByName}
                  </p>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> {request.requestedByStation}
                    </span>
                    <span className="flex items-center gap-1">
                      Case: <span className="font-mono font-medium">{caseFile.id}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {request.submittedAt}
                    </span>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${expandedRequest === request.requestId ? 'rotate-180' : ''}`} />
              </div>

              {/* Expanded Panel */}
              <AnimatePresence>
                {expandedRequest === request.requestId && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-slate-100"
                  >
                    <div className="p-4 space-y-4">
                      {/* Request Details */}
                      <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Case</p>
                          <p className="font-mono font-bold text-[#182f4d] mt-0.5">{caseFile.id}</p>
                          <p className="text-slate-500 text-[10px]">{caseFile.caseTitle.substring(0, 40)}...</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Purpose</p>
                          <p className="font-semibold text-slate-700 mt-0.5">{request.purpose}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Requested Access</p>
                          <p className="font-semibold text-slate-700 mt-0.5">{request.requestedAccessLevel}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Duration</p>
                          <p className="font-semibold text-slate-700 mt-0.5">{request.requestedDurationDays} Days</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Reason / Justification</p>
                        <p className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-3">
                          {request.reason}
                        </p>
                      </div>

                      {/* Action Buttons */}
                      {request.status === 'Pending' && (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleReject(caseFile, request)}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                          <button
                            onClick={() => handleApprove(caseFile, request)}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
