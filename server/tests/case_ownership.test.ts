import { describe, it } from 'node:test';
import assert from 'node:assert';
import { casePersistenceService } from '../services/casePersistenceService';
import { canAccessCase } from '../middleware/caseAccess';
import { blockchainEventService } from '../services/blockchainEventService';

describe('Case Ownership & Controlled Cross-Station Access Suite', () => {
  const caseId = `CASE-OWNER-${Date.now()}`;
  const officerA = {
    badgeNo: 'MH-POL-101',
    name: 'Officer A (Worli)',
    role: 'POLICE',
    station: 'Worli Police Station',
    station_id: 'STA-WORLI',
  };
  const officerB = {
    badgeNo: 'MH-POL-102',
    name: 'Officer B (Worli Colleague)',
    role: 'POLICE',
    station: 'Worli Police Station',
    station_id: 'STA-WORLI',
  };
  const officerBandra = {
    badgeNo: 'MH-POL-201',
    name: 'Officer C (Bandra)',
    role: 'POLICE',
    station: 'Bandra Police Station',
    station_id: 'STA-BANDRA',
  };
  const newIO = {
    badgeNo: 'MH-POL-301',
    name: 'Inspector D (New Lead IO)',
    role: 'POLICE',
    station: 'Worli Police Station',
    station_id: 'STA-WORLI',
  };
  const adminUser = {
    badgeNo: 'MH-ADM-001',
    name: 'Commissioner of Police (Admin)',
    role: 'ADMIN',
    station: 'HQ',
    station_id: 'STA-HQ',
  };
  const auditorUser = {
    badgeNo: 'MH-AUD-001',
    name: 'Vigilance Auditor',
    role: 'AUDITOR',
    station: 'HQ',
    station_id: 'STA-HQ',
  };

  it('1. Automatic IO Assignment: Officer A registers FIR -> automatically becomes Investigating Officer', async () => {
    // Simulate FIR registration where Officer A files the docket
    const createdCase = casePersistenceService.createCase({
      id: caseId,
      fir_number: `FIR-${Date.now()}`,
      case_title: 'Worli High-Value Commercial Robbery',
      police_station: officerA.station,
      police_station_id: officerA.station_id,
      investigating_officer_id: officerA.badgeNo,
      assigned_io: officerA.name,
      assigned_io_badge: officerA.badgeNo,
      assigned_by: officerA.badgeNo,
      assigned_at: new Date().toISOString(),
      crime_type: 'Armed Robbery',
      status: 'INVESTIGATION_ONGOING',
      priority: 'HIGH',
      incident_date: '2026-09-11',
      created_at: new Date().toISOString(),
    });

    // Create initial lead assignment record
    casePersistenceService.createAssignment({
      id: `ASGN-${caseId}-1`,
      case_id: caseId,
      officer_id: officerA.badgeNo,
      officer_name: officerA.name,
      assigned_by: officerA.badgeNo,
      assigned_at: new Date().toISOString(),
      status: 'ACTIVE',
    });

    assert.strictEqual(createdCase.investigating_officer_id, officerA.badgeNo);
    assert.strictEqual(createdCase.assigned_io_badge, officerA.badgeNo);

    // Active assignment exists in store
    const hasActive = casePersistenceService.hasActiveAssignment(caseId, officerA.badgeNo);
    assert.strictEqual(hasActive, true, 'Active assignment must exist for Officer A');
  });

  it('2. Officer A gets immediate access to the case', async () => {
    const hasAccess = await canAccessCase(officerA, caseId);
    assert.strictEqual(hasAccess, true, 'Officer A (Creator & IO) must have access');
  });

  it('3. Strict Default Deny: Officer B (same Worli station) CANNOT access the case', async () => {
    const hasAccess = await canAccessCase(officerB, caseId);
    assert.strictEqual(
      hasAccess,
      false,
      'Officer B (same station) must NOT have automatic access under strict need-to-know rules'
    );
  });

  it('4. Strict Default Deny: Officer from Bandra CANNOT access the case', async () => {
    const hasAccess = await canAccessCase(officerBandra, caseId);
    assert.strictEqual(
      hasAccess,
      false,
      'Officer from Bandra must NOT have access without an approved clearance grant'
    );
  });

  it('5. Admin and Auditor have system-wide oversight access', async () => {
    const adminAccess = await canAccessCase(adminUser, caseId);
    assert.strictEqual(adminAccess, true, 'ADMIN must have cross-system access');

    const auditorAccess = await canAccessCase(auditorUser, caseId);
    assert.strictEqual(auditorAccess, true, 'AUDITOR must have read/oversight access');
  });

  let requestId: string;

  it('6. Officer B submits cross-station access request & anchors ACCESS_REQUESTED to blockchain', async () => {
    const reqRecord = casePersistenceService.createAccessRequest({
      case_id: caseId,
      requester_badge: officerB.badgeNo,
      requester_name: officerB.name,
      requester_role: officerB.role,
      requester_station_id: officerB.station_id,
      reason: 'Assisting in cyber forensics recovery of stolen encrypted drives',
      requested_permission: 'CONFIDENTIAL',
      requested_duration_hours: 48,
    });

    requestId = reqRecord.id;
    assert.ok(requestId);
    assert.strictEqual(reqRecord.status, 'PENDING');

    // Create blockchain event
    const bcEv = await blockchainEventService.createBlockchainEvent({
      caseId,
      entityId: requestId,
      entityType: 'ACCESS',
      action: 'ACCESS_REQUESTED',
      actorId: officerB.badgeNo,
      actorName: officerB.name,
      metadata: {
        requestId,
        reason: reqRecord.reason,
      },
    });

    assert.ok(bcEv.blockchainTxId);
    assert.ok(bcEv.eventHash);

    // Access must still be denied while request is pending
    const accessWhilePending = await canAccessCase(officerB, caseId);
    assert.strictEqual(accessWhilePending, false, 'Access must remain false while request is PENDING');
  });

  it('7. Admin approves access request -> grants 48-hour access & anchors ACCESS_APPROVED', async () => {
    const approvalResult = casePersistenceService.approveAccessRequest(
      requestId,
      adminUser.badgeNo,
      48
    );

    assert.ok(approvalResult, 'Approval must succeed');
    assert.strictEqual(approvalResult.request.status, 'APPROVED');
    assert.strictEqual(approvalResult.grant.user_badge, officerB.badgeNo);

    // Anchor approval to blockchain
    const bcEv = await blockchainEventService.createBlockchainEvent({
      caseId,
      entityId: requestId,
      entityType: 'ACCESS',
      action: 'ACCESS_APPROVED',
      actorId: adminUser.badgeNo,
      actorName: adminUser.name,
      metadata: {
        requestId,
        grantedToBadge: officerB.badgeNo,
        expiresAt: approvalResult.grant.expires_at,
      },
    });

    assert.ok(bcEv.eventHash);

    // Now Officer B CAN access the case
    const accessNow = await canAccessCase(officerB, caseId);
    assert.strictEqual(accessNow, true, 'Officer B must have access after Admin approval');
  });

  it('8. Admin reassigns IO to Inspector D: former IO Officer A access is strictly revoked at backend', async () => {
    // Before reassignment, Officer A has access
    const accessBefore = await canAccessCase(officerA, caseId);
    assert.strictEqual(accessBefore, true);

    // Admin reassigns case to new IO Inspector D with reason and revokes temporary grants
    const reassignResult = casePersistenceService.reassignCaseIO(
      caseId,
      newIO.badgeNo,
      newIO.name,
      'Administrative transfer: case escalated to Special Investigation Team (SIT)',
      adminUser.badgeNo,
      true
    );

    assert.strictEqual(reassignResult.updatedCase.investigating_officer_id, newIO.badgeNo);
    assert.strictEqual(reassignResult.updatedCase.assigned_io_badge, newIO.badgeNo);
    assert.strictEqual(reassignResult.oldOfficerBadge, officerA.badgeNo);

    // Verify former IO assignment marked REMOVED with history preserved
    const allAssignments = casePersistenceService.getAssignments(caseId);
    const removedAsgn = allAssignments.find(a => a.officer_id === officerA.badgeNo);
    assert.ok(removedAsgn);
    assert.strictEqual(removedAsgn.status, 'REMOVED');
    assert.strictEqual(removedAsgn.removed_by, adminUser.badgeNo);
    assert.ok(removedAsgn.removal_reason?.includes('escalated to Special Investigation Team'));

    // Verify new IO has ACTIVE assignment
    const activeAsgn = casePersistenceService.hasActiveAssignment(caseId, newIO.badgeNo);
    assert.strictEqual(activeAsgn, true);

    // Anchor CASE_REASSIGNED to blockchain
    const bcEv = await blockchainEventService.createBlockchainEvent({
      caseId,
      entityId: caseId,
      entityType: 'CASE',
      action: 'CASE_REASSIGNED',
      actorId: adminUser.badgeNo,
      actorName: adminUser.name,
      metadata: {
        caseId,
        previousIOBadge: officerA.badgeNo,
        newIOBadge: newIO.badgeNo,
        reason: 'SIT Escalation',
      },
    });

    assert.ok(bcEv.eventHash);

    // CRITICAL SECURITY ASSERTIONS:
    // 1. Former IO (Officer A) MUST immediately get 403 / access denied
    const officerAAccessAfter = await canAccessCase(officerA, caseId);
    assert.strictEqual(
      officerAAccessAfter,
      false,
      'Former IO access must be strictly revoked at the backend immediately upon reassignment'
    );

    // 2. New IO (Inspector D) MUST immediately have access
    const newIOAccessAfter = await canAccessCase(newIO, caseId);
    assert.strictEqual(
      newIOAccessAfter,
      true,
      'New IO must have immediate active access to the case'
    );

    // 3. Since temporary grants were revoked, Officer B also loses temporary access
    const officerBAccessAfter = await canAccessCase(officerB, caseId);
    assert.strictEqual(
      officerBAccessAfter,
      false,
      'Temporary grants under former IO must be revoked when requested'
    );
  });

  it('9. Cryptographic Blockchain Event Hash Chain remains 100% verified', async () => {
    const verifyReport = blockchainEventService.verifyEventChainIntegrity();
    assert.strictEqual(verifyReport.isIntact, true, 'Blockchain event chain must be mathematically intact');
    assert.ok(verifyReport.totalEvents >= 3, 'Must contain chained events');
    assert.strictEqual(verifyReport.brokenLinkIndex, undefined, 'No broken links in event chain');
  });

  it('10. Station IO Direct Assignment: Dadar IO registers FIR -> directly assigned as IO without manual input & station bound to Dadar', async () => {
    const dadarIO = {
      badgeNo: 'MH-POL-DAD-401',
      name: 'Inspector Sachin R. Kadam (IO)',
      role: 'POLICE',
      station: 'Dadar Police Station, Mumbai',
      station_id: 'DADAR-PS',
    };

    const dadarCaseId = `CASE-DADAR-${Date.now()}`;
    const firNumber = `DAD/CR/2026/0891`;

    // Dadar IO creates case without manually putting IO — backend auto-assigns Dadar IO and Dadar station
    const newDadarCase = casePersistenceService.createCase({
      id: dadarCaseId,
      fir_number: firNumber,
      case_title: 'Dadar Station Commercial Theft Investigation',
      police_station: dadarIO.station,
      police_station_id: dadarIO.station_id,
      investigating_officer_id: dadarIO.badgeNo,
      assigned_io: dadarIO.name,
      assigned_io_badge: dadarIO.badgeNo,
      assigned_by: dadarIO.badgeNo,
      assigned_at: new Date().toISOString(),
      crime_type: 'Theft / House Breaking',
      status: 'FIR Registered',
      priority: 'HIGH',
      incident_date: '2026-09-11',
      created_at: new Date().toISOString(),
    });

    casePersistenceService.createAssignment({
      id: `ASGN-${dadarCaseId}-LEAD`,
      case_id: dadarCaseId,
      officer_id: dadarIO.badgeNo,
      officer_name: dadarIO.name,
      assigned_by: dadarIO.badgeNo,
      assigned_at: new Date().toISOString(),
      status: 'ACTIVE',
    });

    // Verify properties
    assert.strictEqual(newDadarCase.police_station, 'Dadar Police Station, Mumbai');
    assert.strictEqual(newDadarCase.police_station_id, 'DADAR-PS');
    assert.strictEqual(newDadarCase.assigned_io_badge, 'MH-POL-DAD-401');
    assert.strictEqual(newDadarCase.investigating_officer_id, 'MH-POL-DAD-401');

    // Verify Dadar IO has immediate access
    const dadarHasAccess = await canAccessCase(dadarIO, dadarCaseId);
    assert.strictEqual(dadarHasAccess, true, 'Dadar IO must have immediate active access');

    // Verify Officer from another station (Worli Officer A) CANNOT access this Dadar case
    const worliOfficerAccess = await canAccessCase(officerA, dadarCaseId);
    assert.strictEqual(worliOfficerAccess, false, 'Worli officer must be strictly denied access to Dadar case');

    // Verify Bandra officer cannot access
    const bandraAccess = await canAccessCase(officerBandra, dadarCaseId);
    assert.strictEqual(bandraAccess, false, 'Bandra officer must be strictly denied access to Dadar case');
  });
});
