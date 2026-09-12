import { auditService, AuditEventRecord } from './auditService';
import { pool } from '../config/database';

export interface SecurityAnomaly {
  ruleId: 'RULE_A' | 'RULE_B' | 'RULE_C' | 'RULE_D';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO';
  title: string;
  description: string;
  detectedAt: string;
  targetUser?: string;
  caseId?: string;
  evidenceId?: string;
  count?: number;
  threshold?: number;
  timeframeMinutes?: number;
  metadata?: Record<string, any>;
}

export const auditSecurityService = {
  /**
   * Evaluates all statutory security rules against the audit trail.
   */
  async evaluateSecurityRules(options: {
    lookbackMinutes?: number;
    custodyGapHours?: number;
  } = {}): Promise<SecurityAnomaly[]> {
    const anomalies: SecurityAnomaly[] = [];
    const lookbackMinutes = options.lookbackMinutes ?? 60;
    const custodyGapHours = options.custodyGapHours ?? 24;
    const now = Date.now();

    // Fetch recent events
    const { events } = await auditService.getAllAuditEvents({ limit: 500 });
    const recentEvents = events.filter((e) => {
      const eventTime = new Date(e.createdAt).getTime();
      return now - eventTime <= lookbackMinutes * 60 * 1000;
    });

    // ─────────────────────────────────────────────────────────────
    // RULE A: 5 failed logins within 10 minutes -> Possible brute-force activity
    // ─────────────────────────────────────────────────────────────
    const tenMinAgo = now - 10 * 60 * 1000;
    const failedLoginsByUserOrIp: Record<string, AuditEventRecord[]> = {};

    recentEvents
      .filter((e) => {
        const t = new Date(e.createdAt).getTime();
        return (
          t >= tenMinAgo &&
          (e.action === 'USER_LOGIN_FAILED' || (e.action === 'USER_LOGIN' && e.status === 'FAILURE'))
        );
      })
      .forEach((e) => {
        const key = e.userId || e.ipAddress || 'UNKNOWN';
        if (!failedLoginsByUserOrIp[key]) failedLoginsByUserOrIp[key] = [];
        failedLoginsByUserOrIp[key].push(e);
      });

    for (const [key, evts] of Object.entries(failedLoginsByUserOrIp)) {
      if (evts.length >= 5) {
        anomalies.push({
          ruleId: 'RULE_A',
          severity: 'CRITICAL',
          title: 'Possible Brute-Force Authentication Activity',
          description: `Detected ${evts.length} failed login attempts for target '${key}' within the last 10 minutes.`,
          detectedAt: new Date().toISOString(),
          targetUser: key,
          count: evts.length,
          threshold: 5,
          timeframeMinutes: 10,
          metadata: {
            ipAddresses: Array.from(new Set(evts.map((e) => e.ipAddress))),
          },
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // RULE B: 15 unauthorized accesses within 10 minutes -> Repeated access denial
    // ─────────────────────────────────────────────────────────────
    const deniedAccessesByUser: Record<string, AuditEventRecord[]> = {};

    recentEvents
      .filter((e) => {
        const t = new Date(e.createdAt).getTime();
        return (
          t >= tenMinAgo &&
          (e.status === 'FAILURE' ||
            e.action.includes('ACCESS_DENIED') ||
            e.action.includes('UNAUTHORIZED') ||
            (e.reason && e.reason.toLowerCase().includes('denied')))
        );
      })
      .forEach((e) => {
        const key = e.userId || 'ANONYMOUS';
        if (!deniedAccessesByUser[key]) deniedAccessesByUser[key] = [];
        deniedAccessesByUser[key].push(e);
      });

    for (const [user, evts] of Object.entries(deniedAccessesByUser)) {
      if (evts.length >= 15) {
        anomalies.push({
          ruleId: 'RULE_B',
          severity: 'HIGH',
          title: 'Repeated Access Denial & Privilege Probing',
          description: `Officer/Identity '${user}' encountered ${evts.length} unauthorized access denials within 10 minutes.`,
          detectedAt: new Date().toISOString(),
          targetUser: user,
          count: evts.length,
          threshold: 15,
          timeframeMinutes: 10,
          metadata: {
            attemptedResources: evts.map((e) => `${e.resourceType}:${e.resourceId}`),
          },
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // RULE C: 20 evidence downloads within 5 minutes -> Unusual evidence access
    // ─────────────────────────────────────────────────────────────
    const fiveMinAgo = now - 5 * 60 * 1000;
    const downloadsByUser: Record<string, AuditEventRecord[]> = {};

    recentEvents
      .filter((e) => {
        const t = new Date(e.createdAt).getTime();
        return (
          t >= fiveMinAgo &&
          (e.action === 'EVIDENCE_DOWNLOADED' ||
            e.action === 'DOCUMENT_DOWNLOADED' ||
            e.action === 'EVIDENCE_VIEWED')
        );
      })
      .forEach((e) => {
        const key = e.userId || 'UNKNOWN';
        if (!downloadsByUser[key]) downloadsByUser[key] = [];
        downloadsByUser[key].push(e);
      });

    for (const [user, evts] of Object.entries(downloadsByUser)) {
      if (evts.length >= 20) {
        anomalies.push({
          ruleId: 'RULE_C',
          severity: 'HIGH',
          title: 'Unusual High-Velocity Evidence Extraction',
          description: `User '${user}' triggered ${evts.length} evidence/document downloads or decrypt operations within 5 minutes.`,
          detectedAt: new Date().toISOString(),
          targetUser: user,
          count: evts.length,
          threshold: 20,
          timeframeMinutes: 5,
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // RULE D: Evidence transferred with no RECEIVED event exceeding configured timeframe -> Evidence custody gap
    // ─────────────────────────────────────────────────────────────
    const custodyCutoff =
      custodyGapHours === 0
        ? now + 5000
        : now - custodyGapHours * 60 * 60 * 1000;
    const transfers = events.filter(
      (e) => e.action === 'EVIDENCE_TRANSFERRED' && new Date(e.createdAt).getTime() <= custodyCutoff
    );

    for (const transfer of transfers) {
      const evidenceId = transfer.resourceId || transfer.metadata?.evidenceId;
      if (!evidenceId) continue;

      const receivedEvent = events.find(
        (e) =>
          e.action === 'EVIDENCE_RECEIVED' &&
          (e.resourceId === evidenceId || e.metadata?.evidenceId === evidenceId) &&
          new Date(e.createdAt).getTime() > new Date(transfer.createdAt).getTime()
      );

      if (!receivedEvent) {
        anomalies.push({
          ruleId: 'RULE_D',
          severity: 'CRITICAL',
          title: 'Evidence Custody Gap Detected',
          description: `Evidence '${evidenceId}' transferred by ${transfer.userId} on ${transfer.createdAt} has not had a corresponding EVIDENCE_RECEIVED event within ${custodyGapHours} hours.`,
          detectedAt: new Date().toISOString(),
          caseId: transfer.caseId || undefined,
          evidenceId: evidenceId,
          targetUser: transfer.userId || undefined,
          metadata: {
            transferId: transfer.id,
            transferredAt: transfer.createdAt,
            targetRecipient: transfer.metadata?.targetOfficer || transfer.metadata?.recipient,
          },
        });
      }
    }

    return anomalies;
  },

  /**
   * Records a security alert into security_alerts table and audit trail.
   */
  async recordAlert(anomaly: SecurityAnomaly): Promise<void> {
    const alertId = `ALT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    try {
      await pool.query(
        `INSERT INTO security_alerts (
           id, timestamp, alert_type, severity, title, description,
           case_id, evidence_id, actor_badge, status
         ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, 'ACTIVE')`,
        [
          alertId,
          anomaly.ruleId,
          anomaly.severity,
          anomaly.title,
          anomaly.description,
          anomaly.caseId || null,
          anomaly.evidenceId || null,
          anomaly.targetUser || null,
        ]
      );
    } catch {
      // Offline fallback
    }

    await auditService.logAuditEvent({
      action: 'SECURITY_ALERT',
      eventType: 'SECURITY',
      userId: 'SEC-ENGINE',
      userRole: 'ADMIN',
      caseId: anomaly.caseId,
      resourceType: 'SECURITY_ALERT',
      resourceId: alertId,
      status: 'WARNING',
      reason: anomaly.title,
      metadata: {
        ...anomaly,
        alertId,
      },
    });
  },
};
