/**
 * e-CASEVAULT — Production REST API Client & Server Synchronizer
 * 
 * Provides end-to-end API client functions connecting the React frontend to
 * the Node.js Express backend with automatic JWT Authorization headers.
 */

export const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

let jwtToken: string | null = 
  (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('casevault_jwt_token') : null) || 
  (typeof localStorage !== 'undefined' ? localStorage.getItem('casevault_jwt_token') || localStorage.getItem('ecasevault_token') : null);

export function setAuthToken(token: string | null): void {
  jwtToken = token;
  if (token) {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('casevault_jwt_token', token);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('casevault_jwt_token', token);
      localStorage.setItem('ecasevault_token', token);
    }
  } else {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('casevault_jwt_token');
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('casevault_jwt_token');
      localStorage.removeItem('ecasevault_token');
    }
  }
}

export function getAuthToken(): string | null {
  return (
    jwtToken || 
    sessionStorage.getItem('casevault_jwt_token') || 
    localStorage.getItem('casevault_jwt_token') || 
    localStorage.getItem('ecasevault_token')
  );
}

/**
 * Real-Time Multi-Device SSE synchronization listener
 * Maintains a persistent Server-Sent Events stream with automatic fast reconnect.
 */
export function initRealTimeSync(onCaseUpdate?: (data: any) => void): () => void {
  let eventSource: EventSource | null = null;
  let isClosed = false;
  let reconnectTimer: any = null;

  const connect = () => {
    if (isClosed) return;
    try {
      const sseUrl = `${API_BASE_URL}/events/stream`;
      eventSource = new EventSource(sseUrl);

      eventSource.addEventListener('connected', () => {
        window.dispatchEvent(new CustomEvent('casevault:sync-connected'));
      });

      eventSource.addEventListener('case_update', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (onCaseUpdate) {
            onCaseUpdate(payload);
          }
          window.dispatchEvent(new CustomEvent('casevault:case-updated', { detail: payload }));
        } catch (err) {
          console.warn('[SSE] Event parse error:', err);
        }
      });

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!isClosed && !reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, 2000);
        }
      };
    } catch (err) {
      console.warn('[SSE] EventSource init failed:', err);
      if (!isClosed && !reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, 2000);
      }
    }
  };

  connect();

  return () => {
    isClosed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (eventSource) {
      eventSource.close();
    }
  };
}

function getHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...customHeaders };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = getHeaders((options.headers as Record<string, string>) || {});
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    setAuthToken(null);
  }

  const data = await response.json();
  return data as T;
}

export const apiClient = {
  // ==========================================
  // 1. AUTHENTICATION & SESSION
  // ==========================================
  async login(username: string, password: string, totpCode?: string): Promise<any> {
    const data = await request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, totpCode }),
    });
    if (data.success && data.token) {
      setAuthToken(data.token);
    }
    return data;
  },

  async verifyMfa(tempToken: string, totpCode: string): Promise<any> {
    const data = await request<any>('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ tempToken, totpCode }),
    });
    if (data.success && data.token) {
      setAuthToken(data.token);
    }
    return data;
  },

  async verifyAuditHashChain(): Promise<any> {
    return request<any>('/security/audit/verify-chain');
  },

  async scanAntivirus(file: File | Blob, originalname?: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file, originalname || 'scan_file.bin');
    const headers = getHeaders();
    delete headers['Content-Type']; // Allow browser to set boundary
    const response = await fetch(`${API_BASE_URL}/security/antivirus/scan`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return response.json();
  },

  async verifyBiometricLiveness(imageBase64: string, challengeType = 'PASSIVE'): Promise<any> {
    return request<any>('/security/biometrics/verify-liveness', {
      method: 'POST',
      body: JSON.stringify({ imageBase64, challengeType }),
    });
  },

  async logout(): Promise<any> {
    try {
      await request<any>('/auth/logout', { method: 'POST' });
    } finally {
      setAuthToken(null);
    }
  },

  async getCurrentUser(): Promise<any> {
    return request<any>('/auth/me');
  },

  async forgotPassword(email: string, badgeNo?: string): Promise<any> {
    return request<any>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email, badgeNo }),
    });
  },

  async resetPassword(badgeNo: string, newPassword: string): Promise<any> {
    return request<any>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ badgeNo, newPassword }),
    });
  },

  // ==========================================
  // 2. CASE MANAGEMENT
  // ==========================================
  async getCases(): Promise<any> {
    return request<any>('/cases');
  },

  async getCase(id: string): Promise<any> {
    return request<any>(`/cases/${encodeURIComponent(id)}`);
  },

  async createCase(caseData: any): Promise<any> {
    return request<any>('/cases', {
      method: 'POST',
      body: JSON.stringify({ newCaseData: caseData }),
    });
  },

  async updateCase(id: string, updateData: any): Promise<any> {
    return request<any>(`/cases/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
  },

  async closeCase(id: string, reason: string, disposition?: string): Promise<any> {
    return request<any>(`/cases/${encodeURIComponent(id)}/close`, {
      method: 'POST',
      body: JSON.stringify({ reason, finalDisposition: disposition }),
    });
  },

  async getCaseAudit(id: string): Promise<any> {
    return request<any>(`/cases/${encodeURIComponent(id)}/audit`);
  },

  // ==========================================
  // 3. EVIDENCE & INTEGRITY
  // ==========================================
  async getCaseEvidence(caseId: string): Promise<any> {
    return request<any>(`/evidence/case/${encodeURIComponent(caseId)}`);
  },

  async getEvidence(id: string): Promise<any> {
    return request<any>(`/evidence/${encodeURIComponent(id)}`);
  },

  async uploadEvidence(formData: FormData): Promise<any> {
    return request<any>('/evidence/upload', {
      method: 'POST',
      body: formData,
    });
  },

  async downloadEvidence(id: string): Promise<Blob> {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/evidence/${encodeURIComponent(id)}/download`, {
      headers,
    });
    if (!res.ok) {
      throw new Error(`Failed to download evidence: HTTP ${res.status}`);
    }
    return res.blob();
  },

  async verifyEvidence(evidenceTag: string, evidenceId?: string): Promise<any> {
    return request<any>('/evidence/verify', {
      method: 'POST',
      body: JSON.stringify({ evidenceTag, evidenceId }),
    });
  },

  async transferEvidence(transferData: {
    evidenceId: string;
    toOfficerId: string;
    purpose?: string;
    location?: string;
    condition?: string;
  }): Promise<any> {
    return request<any>('/evidence/transfer', {
      method: 'POST',
      body: JSON.stringify(transferData),
    });
  },

  async getEvidenceHistory(id: string): Promise<any> {
    return request<any>(`/evidence/${encodeURIComponent(id)}/history`);
  },

  // ==========================================
  // 4. OFFICERS DIRECTORY & ADMINISTRATION
  // ==========================================
  async getOfficers(role?: string): Promise<any> {
    const query = role ? `?role=${encodeURIComponent(role)}` : '';
    return request<any>(`/officers${query}`);
  },

  async getOfficer(id: string): Promise<any> {
    return request<any>(`/officers/${encodeURIComponent(id)}`);
  },

  async createOfficer(officerData: any): Promise<any> {
    return request<any>('/officers', {
      method: 'POST',
      body: JSON.stringify(officerData),
    });
  },

  async updateOfficer(id: string, data: any): Promise<any> {
    return request<any>(`/officers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async disableOfficer(id: string): Promise<any> {
    return request<any>(`/officers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async getStations(): Promise<any> {
    return request<any>('/stations');
  },

  async createStation(stationData: any): Promise<any> {
    return request<any>('/stations', {
      method: 'POST',
      body: JSON.stringify(stationData),
    });
  },

  // ==========================================
  // 5. CASE ASSIGNMENTS
  // ==========================================
  async getAssignments(caseId: string): Promise<any> {
    return request<any>(`/cases/${encodeURIComponent(caseId)}/assignments`);
  },

  async assignOfficer(caseId: string, assignmentData: {
    userBadge: string;
    officerName?: string;
    assignmentRole?: string;
    accessLevel?: string;
  }): Promise<any> {
    return request<any>(`/cases/${encodeURIComponent(caseId)}/assign`, {
      method: 'POST',
      body: JSON.stringify(assignmentData),
    });
  },

  async removeAssignment(caseId: string, assignmentId: string, reason?: string): Promise<any> {
    return request<any>(`/cases/${encodeURIComponent(caseId)}/assignments/${encodeURIComponent(assignmentId)}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
  },

  // ==========================================
  // 6. ACCESS REQUESTS & CLEARANCES
  // ==========================================
  async createAccessRequest(data: {
    caseId: string;
    reason: string;
    clearanceRequested?: string;
    requestedDurationHours?: number;
  }): Promise<any> {
    return request<any>('/access-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async requestCaseAccess(data: {
    caseId: string;
    reason: string;
    clearanceRequested?: string;
    requestedDurationHours?: number;
  }): Promise<any> {
    return this.createAccessRequest(data);
  },

  async getAccessRequests(caseId?: string, status?: string): Promise<any> {
    const params = new URLSearchParams();
    if (caseId) params.append('caseId', caseId);
    if (status) params.append('status', status);
    return request<any>(`/access-requests?${params.toString()}`);
  },

  async approveAccessRequest(id: string, durationHours = 24): Promise<any> {
    return request<any>(`/access-requests/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ durationHours }),
    });
  },

  async rejectAccessRequest(id: string, reason?: string): Promise<any> {
    return request<any>(`/access-requests/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejectionReason: reason }),
    });
  },

  // ==========================================
  // 7. DASHBOARD & REPORTING
  // ==========================================
  async getDashboardSummary(): Promise<any> {
    return request<any>('/dashboard/summary');
  },

  async getRecentActivity(limit = 15): Promise<any> {
    return request<any>(`/dashboard/activity?limit=${limit}`);
  },

  // ==========================================
  // 8. SECURITY & AUDIT
  // ==========================================
  async getSecurityAlerts(): Promise<any> {
    return request<any>('/security/alerts');
  },

  async getSecurityPosture(): Promise<any> {
    return request<any>('/security/posture');
  },

  async getAuditLogs(params: Record<string, string> = {}): Promise<any> {
    const searchParams = new URLSearchParams(params);
    return request<any>(`/audit?${searchParams.toString()}`);
  },

  async verifyAuditEvent(eventId: string): Promise<any> {
    return request<any>(`/audit/${encodeURIComponent(eventId)}/verify`, {
      method: 'POST',
    });
  },

  async getAuditSecurityAnomalies(params: { lookbackMinutes?: number; custodyGapHours?: number } = {}): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params.lookbackMinutes) searchParams.set('lookbackMinutes', String(params.lookbackMinutes));
    if (params.custodyGapHours) searchParams.set('custodyGapHours', String(params.custodyGapHours));
    return request<any>(`/audit/security-anomalies?${searchParams.toString()}`);
  },


  // ==========================================
  // 9. PARAMETERIZED SEARCH
  // ==========================================
  async search(query: string, page = 1, limit = 10): Promise<any> {
    return request<any>(`/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
  },

  // ==========================================
  // 10. HYPERLEDGER FABRIC TRANSACTION LEDGER
  // ==========================================
  // NOTE: there is deliberately no getFabricBlocks(). Raw Fabric block
  // retrieval requires a peer Deliver-service subscription that this deployment
  // does not wire up, and the server answers /blockchain/blocks with HTTP 501
  // NOT_IMPLEMENTED. The transaction ledger below is the real ledger view.
  async getFabricTransactions(): Promise<any> {
    return request<any>('/blockchain/transactions');
  },

  async getFabricStats(): Promise<any> {
    return request<any>('/blockchain/stats');
  },

  async getCaseLedgerHistory(caseId: string): Promise<any> {
    return request<any>(`/blockchain/case/${encodeURIComponent(caseId)}/history`);
  },

  async getEvidenceLedgerHistory(evidenceId: string): Promise<any> {
    return request<any>(`/blockchain/evidence/${encodeURIComponent(evidenceId)}/history`);
  },

  // Central Blockchain Activity Hash-Chain Methods
  async getBlockchainEvents(caseId?: string, limit?: number): Promise<any> {
    const params = new URLSearchParams();
    if (caseId) params.append('caseId', caseId);
    if (limit) params.append('limit', limit.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<any>(`/blockchain/events${query}`);
  },

  async verifyBlockchainEventChain(caseId?: string): Promise<any> {
    const query = caseId ? `?caseId=${encodeURIComponent(caseId)}` : '';
    return request<any>(`/blockchain/events/verify${query}`);
  },

  async getLatestBlockchainEvent(): Promise<any> {
    return request<any>('/blockchain/events/latest');
  },

  // ==========================================
  // 12. POLICE LAW ASSISTANT (BNS / BNSS / BSA RAG)
  // ==========================================
  async queryLegalAssistant(query: string, actFilter?: 'BNS' | 'BNSS' | 'BSA', limit = 5): Promise<any> {
    return request<any>('/legal/query', {
      method: 'POST',
      body: JSON.stringify({ query, actFilter, limit }),
    });
  },

  async chatLegalAssistant(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>): Promise<any> {
    return request<any>('/legal/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    });
  },

  async getLegalSections(params?: { act?: string; search?: string; page?: number; limit?: number }): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params?.act) searchParams.append('act', params.act);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));
    return request<any>(`/legal/sections?${searchParams.toString()}`);
  },

  async getLegalSection(act: string, sectionNumber: string): Promise<any> {
    return request<any>(`/legal/sections/${encodeURIComponent(act)}/${encodeURIComponent(sectionNumber)}`);
  },

  async getLegalCrossReferences(): Promise<any> {
    return request<any>('/legal/cross-reference');
  },

  async runLegalBenchmark(sampleSize = 25): Promise<any> {
    return request<any>(`/legal/benchmark?sampleSize=${encodeURIComponent(sampleSize)}`);
  },

  async getLegalStats(): Promise<any> {
    return request<any>('/legal/stats');
  },

  // ==========================================
  // 10. JAIL & PRISON MANAGEMENT
  // ==========================================
  async getJailStats(): Promise<any> {
    return request<any>('/jail/stats');
  },

  async getPrisoners(): Promise<any> {
    return request<any>('/jail/prisoners');
  },

  async getCasePrisoners(caseId: string): Promise<any> {
    return request<any>(`/jail/cases/${encodeURIComponent(caseId)}/prisoner`);
  },

  async admitPrisoner(admissionData: any): Promise<any> {
    return request<any>('/jail/admission', {
      method: 'POST',
      body: JSON.stringify(admissionData),
    });
  },

  async logCustodyEvent(eventData: any): Promise<any> {
    return request<any>('/jail/custody-event', {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  },

  async getWarrants(): Promise<any> {
    return request<any>('/jail/warrants');
  },

  async issueWarrant(warrantData: any): Promise<any> {
    return request<any>('/jail/warrants', {
      method: 'POST',
      body: JSON.stringify(warrantData),
    });
  },

  // ==========================================
  // 11. NCRB / SCRB CRIMINAL INTELLIGENCE
  // ==========================================
  async getNcrbStats(): Promise<any> {
    return request<any>('/ncrb/stats');
  },

  async searchCriminalHistory(query: string): Promise<any> {
    return request<any>(`/ncrb/search?q=${encodeURIComponent(query)}`);
  },

  async getAllCriminalHistory(): Promise<any> {
    return request<any>('/ncrb/history');
  },

  async getPersonDossier(personId: string): Promise<any> {
    return request<any>(`/ncrb/person/${encodeURIComponent(personId)}`);
  },

  async generateNcrbReport(reportParams: { personIdentifier: string; requestedByPurpose?: string }): Promise<any> {
    return request<any>('/ncrb/report', {
      method: 'POST',
      body: JSON.stringify(reportParams),
    });
  },

  // 7-Role Architecture Plan aliases
  async createUser(userData: any): Promise<any> {
    return this.createOfficer(userData);
  },

  async toggleUserStatus(id: string, active: boolean): Promise<any> {
    return this.updateOfficer(id, { status: active ? 'ACTIVE' : 'INACTIVE' });
  },

  async assignUserRole(id: string, role: string): Promise<any> {
    return this.updateOfficer(id, { role });
  },

  async updateCustodyStatus(eventData: any): Promise<any> {
    return this.logCustodyEvent(eventData);
  },

  async generateHistoryReport(reportParams: { personIdentifier: string; requestedByPurpose?: string }): Promise<any> {
    return this.generateNcrbReport(reportParams);
  },

  // Biometric Identity & Case Link (Police Dashboard)
  async searchIdentity(payload: FormData | {
    caseId: string;
    purpose: string;
    justification: string;
    imageBase64?: string;
    queryEmbedding?: number[];
    searchScope?: 'ALL_PERSONS' | 'CASE_PERSONS_ONLY';
  }): Promise<any> {
    const isFormData = payload instanceof FormData;
    return request<any>('/identity/search', {
      method: 'POST',
      body: isFormData ? payload : JSON.stringify(payload)
    });
  },

  async enrollIdentity(enrollData: {
    name: string;
    alias?: string;
    dateOfBirth?: string;
    gender?: string;
    photoUrl?: string;
    embedding?: number[];
    caseId?: string;
    role?: string;
  }): Promise<any> {
    return request<any>('/identity/enroll', {
      method: 'POST',
      body: JSON.stringify(enrollData)
    });
  },

  async confirmIdentity(searchId: string, personId: string): Promise<any> {
    return request<any>('/identity/confirm', {
      method: 'POST',
      body: JSON.stringify({ searchId, personId })
    });
  },

  async getBiometricAuditTrail(): Promise<any> {
    return request<any>('/identity/audit');
  },

  // FIR Smart Intake & Auto-Registration Endpoints
  async uploadFirDocument(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('firDocument', file);
    return request<any>('/fir/intake', {
      method: 'POST',
      body: formData,
    });
  },

  async extractFirOcr(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('firDocument', file);
    return request<any>('/fir/ocr', {
      method: 'POST',
      body: formData,
    });
  },

  async registerFirDocket(payload: any): Promise<any> {
    return request<any>('/fir/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async changeInvestigatingOfficer(caseId: string, payload: {
    newOfficerBadge: string;
    newOfficerName: string;
    reason: string;
    revokeTemporaryGrants?: boolean;
  }): Promise<any> {
    return request<any>(`/admin/cases/${encodeURIComponent(caseId)}/change-io`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Health
  async checkHealth(): Promise<any> {
    return request<any>('/health');
  },
};

// Backward-compatible named exports
export const loginViaApi = apiClient.login;
export const fetchCasesFromApi = apiClient.getCases;
export const createCaseViaApi = apiClient.createCase;
export const verifyEvidenceSha256ViaApi = apiClient.verifyEvidence;
export const fetchSecurityPostureFromApi = apiClient.getSecurityPosture;
export const fetchSecurityAlertsFromApi = apiClient.getSecurityAlerts;
// NOTE: no fetchBlockchainBlocksFromApi export. Block retrieval is not
// implemented (server returns HTTP 501), so exposing an alias here would be a
// compile-time reference to a function that does not exist.
export const fetchBlockchainStatsFromApi = apiClient.getFabricStats;
export const checkServerHealth = async (): Promise<boolean> => {
  try {
    const data = await apiClient.checkHealth();
    return data.status === 'healthy' || data.status === 'degraded';
  } catch {
    return false;
  }
};
