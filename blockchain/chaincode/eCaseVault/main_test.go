package main

import (
	"crypto/x509"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/hyperledger/fabric-chaincode-go/shim"
	"github.com/hyperledger/fabric-chaincode-go/shimtest"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// MockClientIdentity satisfies contractapi.ClientIdentityInterface for testing
type MockClientIdentity struct {
	mspID      string
	id         string
	attributes map[string]string
	err        error
}

func (m *MockClientIdentity) GetID() (string, error) {
	if m.err != nil {
		return "", m.err
	}
	return m.id, nil
}

func (m *MockClientIdentity) GetMSPID() (string, error) {
	if m.err != nil {
		return "", m.err
	}
	return m.mspID, nil
}

func (m *MockClientIdentity) GetAttributeValue(attrName string) (value string, found bool, err error) {
	if m.attributes != nil {
		if val, ok := m.attributes[attrName]; ok {
			return val, true, nil
		}
	}
	return "", false, nil
}

func (m *MockClientIdentity) AssertAttributeValue(attrName, attrValue string) error {
	return nil
}

func (m *MockClientIdentity) GetX509Certificate() (*x509.Certificate, error) {
	return nil, nil
}

// MockTransactionContext satisfies contractapi.TransactionContextInterface
type MockTransactionContext struct {
	contractapi.TransactionContext
	stub              *shimtest.MockStub
	clientIdentity    contractapi.ClientIdentityInterface
	isMissingIdentity bool
}

func (m *MockTransactionContext) GetStub() shim.ChaincodeStubInterface {
	return m.stub
}

func (m *MockTransactionContext) GetClientIdentity() contractapi.ClientIdentityInterface {
	if m.isMissingIdentity {
		return nil
	}
	if m.clientIdentity != nil {
		return m.clientIdentity
	}
	return &MockClientIdentity{mspID: "PoliceOrgMSP", id: "x509::CN=officer-MH-POL-8842::O=PoliceOrg"}
}

func setupTestContext(mspID string, callerID string) (*SmartContract, *MockTransactionContext) {
	contract := &SmartContract{}
	mockStub := shimtest.NewMockStub("eCaseVault", nil)
	attrs := make(map[string]string)

	// Extract officer badge from callerID and populate officerBadge attribute
	if callerID != "" && !strings.Contains(strings.ToLower(callerID), "admin") && !strings.Contains(strings.ToLower(callerID), "user1") {
		badge := callerID
		if strings.Contains(callerID, "CN=") {
			parts := strings.Split(callerID, "CN=")
			if len(parts) > 1 {
				cnPart := strings.Split(parts[1], "::")[0]
				cnPart = strings.TrimPrefix(cnPart, "officer-")
				badge = cnPart
			}
		}
		attrs["officerBadge"] = badge
	}

	ci := &MockClientIdentity{mspID: mspID, id: callerID, attributes: attrs}
	ctx := &MockTransactionContext{stub: mockStub, clientIdentity: ci}
	return contract, ctx
}

// setupRoleContext builds a caller whose CA-signed certificate carries the rank
// and jurisdiction attributes the chaincode authorizes against. These attributes
// are the ONLY source of authority: nothing is read from a transaction argument.
func setupRoleContext(mspID, badge, role, station, zone string) (*SmartContract, *MockTransactionContext) {
	contract := &SmartContract{}
	mockStub := shimtest.NewMockStub("eCaseVault", nil)
	attrs := map[string]string{"officerBadge": badge}
	if role != "" {
		attrs["role"] = role
	}
	if station != "" {
		attrs["station"] = station
	}
	if zone != "" {
		attrs["zone"] = zone
	}
	ci := &MockClientIdentity{mspID: mspID, id: "x509::CN=officer-" + badge, attributes: attrs}
	return contract, &MockTransactionContext{stub: mockStub, clientIdentity: ci}
}

// newCase is a helper that registers a case owned by the given creator with an
// explicit station, zone, assigned IO and supervisor.
func newCase(t *testing.T, contract *SmartContract, ctx *MockTransactionContext, caseID, station, zone, creator, io, supervisor string) {
	t.Helper()
	ctx.stub.MockTransactionStart("setup-" + caseID)
	err := contract.CreateCase(ctx, caseID, "FIR/2026/"+caseID, "Theft", station+" PS", station, zone, creator, "Officer "+creator, io, supervisor, "hash-"+caseID)
	ctx.stub.MockTransactionEnd("setup-" + caseID)
	if err != nil {
		t.Fatalf("setup CreateCase(%s) failed: %v", caseID, err)
	}
}

func TestInitLedger(t *testing.T) {
	contract, ctx := setupTestContext("PoliceOrgMSP", "x509::CN=officer-MH-POL-8842::O=PoliceOrg")
	ctx.stub.MockTransactionStart("tx1")
	err := contract.InitLedger(ctx)
	ctx.stub.MockTransactionEnd("tx1")
	if err != nil {
		t.Fatalf("InitLedger failed: %v", err)
	}

	val := ctx.stub.State["MH-MUM-2026-004821"]
	if val == nil {
		t.Fatalf("Expected genesis case in state, got nil")
	}

	var caseAsset CaseAsset
	if err := json.Unmarshal(val, &caseAsset); err != nil {
		t.Fatalf("Failed to unmarshal case asset: %v", err)
	}
	if caseAsset.FIRNumber != "AND/CR/2026/04821" {
		t.Errorf("Expected FIR AND/CR/2026/04821, got %s", caseAsset.FIRNumber)
	}
}

func TestCreateCase_ValidAndUnauthorized(t *testing.T) {
	contract, ctx := setupTestContext("PoliceOrgMSP", "x509::CN=officer-MH-POL-101::O=PoliceOrg")

	// 1. Valid creation under PoliceOrgMSP
	ctx.stub.MockTransactionStart("tx2")
	err := contract.CreateCase(ctx, "CASE-001", "FIR/2026/001", "Theft", "Bandra PS", "MH-STN-BAN-01", "Mumbai Metropolitan", "MH-POL-101", "Officer Roy", "MH-POL-101", "", "hash123")
	ctx.stub.MockTransactionEnd("tx2")
	if err != nil {
		t.Fatalf("CreateCase under PoliceOrgMSP failed: %v", err)
	}

	// 2. Duplicate rejection
	ctx.stub.MockTransactionStart("tx3")
	err = contract.CreateCase(ctx, "CASE-001", "FIR/2026/001", "Theft", "Bandra PS", "MH-STN-BAN-01", "Mumbai Metropolitan", "MH-POL-101", "Officer Roy", "MH-POL-101", "", "hash123")
	ctx.stub.MockTransactionEnd("tx3")
	if err == nil {
		t.Fatalf("Expected error for duplicate case, got nil")
	}

	// 3. Creator badge spoofing rejection (caller is MH-POL-101 but badge argument is MH-POL-999)
	ctx.stub.MockTransactionStart("tx3-spoof")
	err = contract.CreateCase(ctx, "CASE-002", "FIR/2026/002", "Theft", "Bandra PS", "MH-STN-BAN-01", "Mumbai Metropolitan", "MH-POL-999", "Officer Roy", "MH-POL-999", "", "hash123")
	ctx.stub.MockTransactionEnd("tx3-spoof")
	if err == nil {
		t.Fatalf("Expected error when creator badge does not match authenticated caller badge, got nil")
	}

	// 4. Unauthorized org rejection (FSLOrgMSP cannot create cases)
	_, fslCtx := setupTestContext("FSLOrgMSP", "x509::CN=officer-FSL-001::O=FSLOrg")
	fslCtx.stub = ctx.stub // share world state
	fslCtx.stub.MockTransactionStart("tx4")
	err = contract.CreateCase(fslCtx, "CASE-003", "FIR/2026/003", "Robbery", "Dadar PS", "MH-STN-DAD-01", "Mumbai Metropolitan", "FSL-001", "Officer Roy", "FSL-001", "", "hash456")
	fslCtx.stub.MockTransactionEnd("tx4")
	if err == nil {
		t.Fatalf("Expected error when FSLOrgMSP attempts to create case, got nil")
	}

	// 5. Missing/error identity rejection
	ctx.clientIdentity = &MockClientIdentity{err: fmt.Errorf("connection lost")}
	ctx.stub.MockTransactionStart("tx5")
	err = contract.CreateCase(ctx, "CASE-004", "FIR/2026/004", "Assault", "Colaba PS", "MH-STN-COL-01", "Mumbai Metropolitan", "MH-POL-101", "Officer Roy", "MH-POL-101", "", "hash789")
	ctx.stub.MockTransactionEnd("tx5")
	if err == nil {
		t.Fatalf("Expected error when client identity retrieval fails, got nil")
	}
}

func TestRegisterEvidence_ValidAndUnauthorized(t *testing.T) {
	contract, ctx := setupTestContext("PoliceOrgMSP", "x509::CN=officer-MH-POL-101::O=PoliceOrg")
	validSha := "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

	// Ensure case exists
	ctx.stub.MockTransactionStart("tx-setup-case")
	_ = contract.CreateCase(ctx, "CASE-001", "FIR/2026/001", "Theft", "Bandra PS", "MH-STN-BAN-01", "Mumbai Metropolitan", "MH-POL-101", "Officer Roy", "MH-POL-101", "", "hash123")
	ctx.stub.MockTransactionEnd("tx-setup-case")

	// 1. PoliceOrg can register evidence
	ctx.stub.MockTransactionStart("tx6")
	err := contract.RegisterEvidence(ctx, "EV-001", "CASE-001", "TAG-1", validSha, "Digital Evidence", "MH-POL-101", "Locker 4")
	ctx.stub.MockTransactionEnd("tx6")
	if err != nil {
		t.Fatalf("RegisterEvidence failed: %v", err)
	}

	// 2. CyberCellOrg cannot register evidence directly
	_, cyberCtx := setupTestContext("CyberCellOrgMSP", "x509::CN=officer-MH-CYB-001::O=CyberCellOrg")
	cyberCtx.stub = ctx.stub
	cyberCtx.stub.MockTransactionStart("tx7")
	err = contract.RegisterEvidence(cyberCtx, "EV-002", "CASE-001", "TAG-2", validSha, "Hard Drive", "MH-CYB-001", "Locker 1")
	cyberCtx.stub.MockTransactionEnd("tx7")
	if err == nil {
		t.Fatalf("Expected error when CyberCellOrgMSP attempts to register evidence, got nil")
	}

	// 3. Invalid SHA-256 rejected
	ctx.stub.MockTransactionStart("tx8")
	err = contract.RegisterEvidence(ctx, "EV-003", "CASE-001", "TAG-3", "invalid-short-hash", "Documents", "MH-POL-101", "Locker 2")
	ctx.stub.MockTransactionEnd("tx8")
	if err == nil {
		t.Fatalf("Expected error for malformed SHA-256 hash, got nil")
	}

	// 4. Evidence registration for non-existent case rejected
	ctx.stub.MockTransactionStart("tx8-no-case")
	err = contract.RegisterEvidence(ctx, "EV-004", "NON-EXISTENT-CASE", "TAG-4", validSha, "Documents", "MH-POL-101", "Locker 2")
	ctx.stub.MockTransactionEnd("tx8-no-case")
	if err == nil {
		t.Fatalf("Expected error when registering evidence for non-existent case, got nil")
	}
}

func TestVerifyEvidenceHash_TamperDetection(t *testing.T) {
	contract, ctx := setupTestContext("PoliceOrgMSP", "x509::CN=officer-MH-POL-101::O=PoliceOrg")
	validSha := "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

	// Create case first
	ctx.stub.MockTransactionStart("tx-setup-case-verify")
	_ = contract.CreateCase(ctx, "CASE-001", "FIR/2026/001", "Theft", "Bandra PS", "MH-STN-BAN-01", "Mumbai Metropolitan", "MH-POL-101", "Officer Roy", "MH-POL-101", "", "hash123")
	ctx.stub.MockTransactionEnd("tx-setup-case-verify")

	ctx.stub.MockTransactionStart("tx9")
	_ = contract.RegisterEvidence(ctx, "EV-VERIFY-01", "CASE-001", "TAG-V1", validSha, "Physical", "MH-POL-101", "Safe 1")
	ctx.stub.MockTransactionEnd("tx9")

	// Match
	matchStatus, err := contract.VerifyEvidenceHash(ctx, "EV-VERIFY-01", validSha)
	if err != nil || matchStatus != "VERIFIED_INTEGRITY_MATCH" {
		t.Fatalf("Expected VERIFIED_INTEGRITY_MATCH, got %s (err: %v)", matchStatus, err)
	}

	// Tampered
	tamperedSha := "0000000000000000000000000000000000000000000000000000000000000000"
	tamperStatus, err := contract.VerifyEvidenceHash(ctx, "EV-VERIFY-01", tamperedSha)
	if err != nil || tamperStatus != "TAMPER_ALERT_HASH_MISMATCH" {
		t.Fatalf("Expected TAMPER_ALERT_HASH_MISMATCH, got %s (err: %v)", tamperStatus, err)
	}
}

func TestTransferEvidence_SecurityAndCustodyIdentity(t *testing.T) {
	contract, ctxA := setupTestContext("PoliceOrgMSP", "x509::CN=officer-OFFICER-A::O=PoliceOrg")
	validSha := "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

	// Create case first
	ctxA.stub.MockTransactionStart("tx-setup-case-transfer")
	_ = contract.CreateCase(ctxA, "CASE-001", "FIR/2026/001", "Theft", "Bandra PS", "MH-STN-BAN-01", "Mumbai Metropolitan", "OFFICER-A", "Officer Roy", "OFFICER-A", "", "hash123")
	ctxA.stub.MockTransactionEnd("tx-setup-case-transfer")

	// Register evidence with initial custodian = OFFICER-A
	ctxA.stub.MockTransactionStart("tx10")
	err := contract.RegisterEvidence(ctxA, "EV-100", "CASE-001", "TAG-100", validSha, "Firearm", "OFFICER-A", "Locker 1")
	ctxA.stub.MockTransactionEnd("tx10")
	if err != nil {
		t.Fatalf("Failed to register initial evidence: %v", err)
	}

	// 1. TEST: B attempting A -> C spoof = FAIL
	_, ctxB := setupTestContext("PoliceOrgMSP", "x509::CN=officer-OFFICER-B::O=PoliceOrg")
	ctxB.stub = ctxA.stub
	ctxB.stub.MockTransactionStart("tx11-spoof")
	err = contract.TransferEvidence(ctxB, "TR-SPOOF-1", "EV-100", "OFFICER-A", "OFFICER-C", "Locker 2", "Transfer", "Sealed", "sig-fake")
	ctxB.stub.MockTransactionEnd("tx11-spoof")
	if err == nil {
		t.Fatalf("Security violation: expected transfer to FAIL when Officer B attempts to transfer Officer A's evidence (A -> C spoof)")
	}

	// 2. TEST: Admin string in identity does NOT bypass custody = FAIL
	_, ctxAdmin := setupTestContext("PoliceOrgMSP", "x509::CN=Admin-User::O=PoliceOrg")
	ctxAdmin.stub = ctxA.stub
	ctxAdmin.stub.MockTransactionStart("tx-admin-bypass")
	err = contract.TransferEvidence(ctxAdmin, "TR-ADMIN-1", "EV-100", "OFFICER-A", "OFFICER-B", "Locker 1", "Transfer", "Sealed", "sig-admin")
	ctxAdmin.stub.MockTransactionEnd("tx-admin-bypass")
	if err == nil {
		t.Fatalf("Security violation: expected transfer to FAIL when caller contains 'Admin' but is not registered custodian")
	}

	// 3. TEST: A -> B valid
	ctxA.stub.MockTransactionStart("tx12-valid-A-to-B")
	err = contract.TransferEvidence(ctxA, "TR-001", "EV-100", "OFFICER-A", "OFFICER-B", "FSL Lab Kalina", "Lab Handover", "Sealed", "sig-valid-A")
	ctxA.stub.MockTransactionEnd("tx12-valid-A-to-B")
	if err != nil {
		t.Fatalf("Valid transfer A -> B failed: %v", err)
	}

	// Verify custodian updated to OFFICER-B
	ev, err := contract.GetEvidence(ctxA, "EV-100")
	if err != nil || ev.CurrentCustodian != "OFFICER-B" {
		t.Fatalf("Expected current custodian to be 'OFFICER-B', got '%s' (err: %v)", ev.CurrentCustodian, err)
	}

	// 4. TEST: C attempting B -> D spoof = FAIL (after A -> B)
	_, ctxC := setupTestContext("PoliceOrgMSP", "x509::CN=officer-OFFICER-C::O=PoliceOrg")
	ctxC.stub = ctxA.stub
	ctxC.stub.MockTransactionStart("tx13-spoof-C")
	err = contract.TransferEvidence(ctxC, "TR-SPOOF-2", "EV-100", "OFFICER-B", "OFFICER-D", "Safe", "Transfer", "Sealed", "sig-fake-C")
	ctxC.stub.MockTransactionEnd("tx13-spoof-C")
	if err == nil {
		t.Fatalf("Security violation: expected transfer to FAIL when Officer C attempts to transfer Officer B's evidence (B -> D spoof)")
	}

	// Also: Officer A trying to transfer again must FAIL because custodian is now B
	ctxA.stub.MockTransactionStart("tx13-old-custodian-A")
	err = contract.TransferEvidence(ctxA, "TR-OLD-A", "EV-100", "OFFICER-B", "OFFICER-C", "Lab", "Transfer", "Sealed", "sig-old-A")
	ctxA.stub.MockTransactionEnd("tx13-old-custodian-A")
	if err == nil {
		t.Fatalf("Security violation: expected transfer to FAIL when previous custodian A attempts to transfer after ownership moved to B")
	}

	// 5. TEST: B -> C valid after A -> B
	ctxB.stub.MockTransactionStart("tx14-valid-B-to-C")
	err = contract.TransferEvidence(ctxB, "TR-002", "EV-100", "OFFICER-B", "OFFICER-C", "Cyber Cell Locker", "Forensic Delivery", "Sealed", "sig-valid-B")
	ctxB.stub.MockTransactionEnd("tx14-valid-B-to-C")
	if err != nil {
		t.Fatalf("Valid transfer B -> C failed after A -> B: %v", err)
	}

	// Verify custodian updated to OFFICER-C
	ev, err = contract.GetEvidence(ctxB, "EV-100")
	if err != nil || ev.CurrentCustodian != "OFFICER-C" {
		t.Fatalf("Expected current custodian to be 'OFFICER-C', got '%s' (err: %v)", ev.CurrentCustodian, err)
	}

	// 6. TEST: Unknown / Empty identity = FAIL
	_, ctxUnknown := setupTestContext("PoliceOrgMSP", "")
	ctxUnknown.stub = ctxA.stub
	ctxUnknown.stub.MockTransactionStart("tx15-unknown")
	err = contract.TransferEvidence(ctxUnknown, "TR-UNKNOWN", "EV-100", "OFFICER-C", "OFFICER-D", "Safe", "Transfer", "Sealed", "sig-none")
	ctxUnknown.stub.MockTransactionEnd("tx15-unknown")
	if err == nil {
		t.Fatalf("Expected transfer to FAIL with empty/unknown client identity, got nil")
	}

	// 7. TEST: Missing identity context = FAIL
	ctxMissing := &MockTransactionContext{stub: ctxA.stub, isMissingIdentity: true}
	ctxMissing.stub.MockTransactionStart("tx16-missing")
	err = contract.TransferEvidence(ctxMissing, "TR-MISSING", "EV-100", "OFFICER-C", "OFFICER-D", "Safe", "Transfer", "Sealed", "sig-none")
	ctxMissing.stub.MockTransactionEnd("tx16-missing")
	if err == nil {
		t.Fatalf("Expected transfer to FAIL with nil client identity context, got nil")
	}
}

func TestRegisterForensicReport_Authorization(t *testing.T) {
	contract, ctx := setupTestContext("FSLOrgMSP", "x509::CN=officer-FSL-901::O=FSLOrg")
	validReportHash := "a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890"

	// Create case first
	ctx.stub.MockTransactionStart("tx-setup-case-fsl")
	_, policeCtx := setupTestContext("PoliceOrgMSP", "x509::CN=officer-MH-POL-101::O=PoliceOrg")
	policeCtx.stub = ctx.stub
	_ = contract.CreateCase(policeCtx, "CASE-001", "FIR/2026/001", "Theft", "Bandra PS", "MH-STN-BAN-01", "Mumbai Metropolitan", "MH-POL-101", "Officer Roy", "MH-POL-101", "", "hash123")
	ctx.stub.MockTransactionEnd("tx-setup-case-fsl")

	// 1. FSLOrgMSP can register forensic report with matching examiner badge
	ctx.stub.MockTransactionStart("tx19")
	err := contract.RegisterForensicReport(ctx, "FSL-001", "CASE-001", "", "Dr. Sharma", "FSL-901", "FSL Kalina", validReportHash)
	ctx.stub.MockTransactionEnd("tx19")
	if err != nil {
		t.Fatalf("FSLOrgMSP forensic report registration failed: %v", err)
	}

	// 2. FSL User attempting to submit with spoofed examiner badge (FSL-901 attempts to submit as FSL-999) = FAIL
	ctx.stub.MockTransactionStart("tx19-spoof")
	err = contract.RegisterForensicReport(ctx, "FSL-SPOOF", "CASE-001", "", "Dr. Other", "FSL-999", "FSL Kalina", validReportHash)
	ctx.stub.MockTransactionEnd("tx19-spoof")
	if err == nil {
		t.Fatalf("Expected error when examinerBadge does not match authenticated Fabric caller, got nil")
	}

	// 3. PoliceOrgMSP cannot register forensic report directly
	policeCtx.stub.MockTransactionStart("tx20")
	err = contract.RegisterForensicReport(policeCtx, "FSL-002", "CASE-001", "", "Officer Patil", "MH-POL-101", "Police Station", validReportHash)
	policeCtx.stub.MockTransactionEnd("tx20")
	if err == nil {
		t.Fatalf("Expected error when PoliceOrgMSP attempts to register forensic report, got nil")
	}
}

// ============================================================================
// CASE-LEVEL AUTHORIZATION REGRESSION TESTS
// ----------------------------------------------------------------------------
// A valid Fabric identity is NECESSARY but NOT SUFFICIENT. Each test below
// drives the chaincode through a caller whose authority is expressed solely in
// CA-signed X.509 attributes, and asserts that possessing a well-formed police
// certificate does not by itself confer authority over an arbitrary case.
// ============================================================================

// TestUpdateCaseStatus_CaseLevelAuthorization asserts that only officers bound
// to a case, or supervisors whose jurisdiction covers it, may advance it.
func TestUpdateCaseStatus_CaseLevelAuthorization(t *testing.T) {
	// Case at station A, zone West, created by and assigned to OFFICER-A.
	contract, ctxA := setupRoleContext("PoliceOrgMSP", "MH-POL-A1", "OFFICER", "MH-STN-A", "West")
	newCase(t, contract, ctxA, "CASE-AUTH-1", "MH-STN-A", "West", "MH-POL-A1", "MH-POL-A1", "MH-POL-SUP")

	// 1. Assigned officer updating own case = PASS
	ctxA.stub.MockTransactionStart("u1")
	err := contract.UpdateCaseStatus(ctxA, "CASE-AUTH-1", "Under Investigation")
	ctxA.stub.MockTransactionEnd("u1")
	if err != nil {
		t.Fatalf("assigned officer must be able to update own case, got: %v", err)
	}

	// 2. Unassigned officer from an unrelated station updating case = FAIL
	_, ctxB := setupRoleContext("PoliceOrgMSP", "MH-POL-B1", "OFFICER", "MH-STN-B", "East")
	ctxB.stub = ctxA.stub
	ctxB.stub.MockTransactionStart("u2")
	err = contract.UpdateCaseStatus(ctxB, "CASE-AUTH-1", "Closed By Me")
	ctxB.stub.MockTransactionEnd("u2")
	if err == nil {
		t.Fatalf("SECURITY: unassigned officer from another station must NOT update case")
	}

	// 3. PI of a DIFFERENT station = FAIL (rank alone is not authority)
	_, ctxPiB := setupRoleContext("PoliceOrgMSP", "MH-POL-B9", "PI", "MH-STN-B", "East")
	ctxPiB.stub = ctxA.stub
	ctxPiB.stub.MockTransactionStart("u3")
	err = contract.UpdateCaseStatus(ctxPiB, "CASE-AUTH-1", "Reopened")
	ctxPiB.stub.MockTransactionEnd("u3")
	if err == nil {
		t.Fatalf("SECURITY: PI of an unrelated station must NOT update case")
	}

	// 4. PI of the OWNING station = PASS
	_, ctxPiA := setupRoleContext("PoliceOrgMSP", "MH-POL-A9", "PI", "MH-STN-A", "West")
	ctxPiA.stub = ctxA.stub
	ctxPiA.stub.MockTransactionStart("u4")
	err = contract.UpdateCaseStatus(ctxPiA, "CASE-AUTH-1", "Chargesheet Filed")
	ctxPiA.stub.MockTransactionEnd("u4")
	if err != nil {
		t.Fatalf("PI of owning station must be able to update case, got: %v", err)
	}

	// 5. DySP of an unrelated zone = FAIL
	_, ctxDyE := setupRoleContext("PoliceOrgMSP", "MH-POL-E5", "DySP", "MH-STN-E", "East")
	ctxDyE.stub = ctxA.stub
	ctxDyE.stub.MockTransactionStart("u5")
	err = contract.UpdateCaseStatus(ctxDyE, "CASE-AUTH-1", "Transferred")
	ctxDyE.stub.MockTransactionEnd("u5")
	if err == nil {
		t.Fatalf("SECURITY: DySP of an unrelated zone must NOT update case")
	}

	// 6. Certificate with NO officerBadge attribute = FAIL
	ctxNoBadge := &MockTransactionContext{
		stub:           ctxA.stub,
		clientIdentity: &MockClientIdentity{mspID: "PoliceOrgMSP", id: "x509::CN=nobody", attributes: map[string]string{}},
	}
	ctxNoBadge.stub.MockTransactionStart("u6")
	err = contract.UpdateCaseStatus(ctxNoBadge, "CASE-AUTH-1", "Hijacked")
	ctxNoBadge.stub.MockTransactionEnd("u6")
	if err == nil {
		t.Fatalf("SECURITY: identity without officerBadge attribute must be DENIED")
	}

	// 7. Reserved generic identity (Admin / User1) = FAIL
	for _, generic := range []string{"Admin", "User1"} {
		ctxGeneric := &MockTransactionContext{
			stub:           ctxA.stub,
			clientIdentity: &MockClientIdentity{mspID: "PoliceOrgMSP", id: "x509::CN=" + generic, attributes: map[string]string{"officerBadge": generic}},
		}
		ctxGeneric.stub.MockTransactionStart("u7-" + generic)
		err = contract.UpdateCaseStatus(ctxGeneric, "CASE-AUTH-1", "Hijacked")
		ctxGeneric.stub.MockTransactionEnd("u7-" + generic)
		if err == nil {
			t.Fatalf("SECURITY: generic identity %q must be DENIED", generic)
		}
	}

	// 8. Closure must not be reachable through a plain status update.
	ctxPiA.stub.MockTransactionStart("u8")
	err = contract.UpdateCaseStatus(ctxPiA, "CASE-AUTH-1", "Closed")
	ctxPiA.stub.MockTransactionEnd("u8")
	if err == nil {
		t.Fatalf("SECURITY: closure via UpdateCaseStatus must be rejected in favour of CloseCase")
	}
}

// TestCloseCase_SupervisoryAuthorization asserts closure is a supervisory act:
// being the assigned IO does not by itself permit closing the investigation.
func TestCloseCase_SupervisoryAuthorization(t *testing.T) {
	contract, ctxIO := setupRoleContext("PoliceOrgMSP", "MH-POL-IO1", "OFFICER", "MH-STN-A", "West")
	newCase(t, contract, ctxIO, "CASE-CLOSE-1", "MH-STN-A", "West", "MH-POL-IO1", "MH-POL-IO1", "MH-POL-SUP")

	// 1. Ordinary officer (even the assigned IO) cannot close = FAIL
	ctxIO.stub.MockTransactionStart("c1")
	err := contract.CloseCase(ctxIO, "CASE-CLOSE-1", "solved")
	ctxIO.stub.MockTransactionEnd("c1")
	if err == nil {
		t.Fatalf("SECURITY: ordinary officer must NOT close a case without delegation")
	}

	// 2. Cross-station PI cannot close = FAIL
	_, ctxPiB := setupRoleContext("PoliceOrgMSP", "MH-POL-B9", "PI", "MH-STN-B", "East")
	ctxPiB.stub = ctxIO.stub
	ctxPiB.stub.MockTransactionStart("c2")
	err = contract.CloseCase(ctxPiB, "CASE-CLOSE-1", "not mine")
	ctxPiB.stub.MockTransactionEnd("c2")
	if err == nil {
		t.Fatalf("SECURITY: PI of an unrelated station must NOT close case")
	}

	// 3. Explicit delegation by the owning PI, then officer closes = PASS
	_, ctxPiA := setupRoleContext("PoliceOrgMSP", "MH-POL-A9", "PI", "MH-STN-A", "West")
	ctxPiA.stub = ctxIO.stub
	ctxPiA.stub.MockTransactionStart("c3")
	err = contract.AuthorizeCaseClosure(ctxPiA, "CASE-CLOSE-1", "MH-POL-IO1")
	ctxPiA.stub.MockTransactionEnd("c3")
	if err != nil {
		t.Fatalf("owning PI must be able to delegate closure authority, got: %v", err)
	}

	ctxIO.stub.MockTransactionStart("c4")
	err = contract.CloseCase(ctxIO, "CASE-CLOSE-1", "investigation complete")
	ctxIO.stub.MockTransactionEnd("c4")
	if err != nil {
		t.Fatalf("explicitly delegated officer must be able to close case, got: %v", err)
	}

	// 4. Already-closed case cannot be closed again
	ctxPiA.stub.MockTransactionStart("c5")
	err = contract.CloseCase(ctxPiA, "CASE-CLOSE-1", "again")
	ctxPiA.stub.MockTransactionEnd("c5")
	if err == nil {
		t.Fatalf("closing an already closed case must be rejected")
	}
}

// TestApproveAccessRequest_NoSelfEscalation is the regression test for the
// privilege-escalation hole where any authenticated officer could approve their
// OWN access request and thereby grant themselves visibility of any case.
func TestApproveAccessRequest_NoSelfEscalation(t *testing.T) {
	contract, ctxA := setupRoleContext("PoliceOrgMSP", "MH-POL-A1", "OFFICER", "MH-STN-A", "West")
	newCase(t, contract, ctxA, "CASE-ACL-1", "MH-STN-A", "West", "MH-POL-A1", "MH-POL-A1", "MH-POL-SUP")

	// Outsider raises an access request against a case they have no relation to.
	_, ctxOut := setupRoleContext("PoliceOrgMSP", "MH-POL-X9", "OFFICER", "MH-STN-B", "East")
	ctxOut.stub = ctxA.stub
	ctxOut.stub.MockTransactionStart("a1")
	err := contract.CreateAccessRequest(ctxOut, "REQ-1", "CASE-ACL-1", "MH-POL-X9", "Outsider", "READ", "curiosity")
	ctxOut.stub.MockTransactionEnd("a1")
	if err != nil {
		t.Fatalf("raising an access request should be permitted: %v", err)
	}

	// 1. THE ATTACK: requester approves their own request = MUST FAIL
	ctxOut.stub.MockTransactionStart("a2")
	err = contract.ApproveAccessRequest(ctxOut, "REQ-1", "Outsider")
	ctxOut.stub.MockTransactionEnd("a2")
	if err == nil {
		t.Fatalf("SECURITY: officer must NOT be able to approve their own access request (self-escalation)")
	}

	// 2. An unrelated non-supervisory officer approving = MUST FAIL
	_, ctxBystander := setupRoleContext("PoliceOrgMSP", "MH-POL-Z1", "OFFICER", "MH-STN-C", "North")
	ctxBystander.stub = ctxA.stub
	ctxBystander.stub.MockTransactionStart("a3")
	err = contract.ApproveAccessRequest(ctxBystander, "REQ-1", "Bystander")
	ctxBystander.stub.MockTransactionEnd("a3")
	if err == nil {
		t.Fatalf("SECURITY: unrelated officer must NOT approve access to another station's case")
	}

	// 3. PI of an unrelated station approving = MUST FAIL
	_, ctxPiB := setupRoleContext("PoliceOrgMSP", "MH-POL-B9", "PI", "MH-STN-B", "East")
	ctxPiB.stub = ctxA.stub
	ctxPiB.stub.MockTransactionStart("a4")
	err = contract.ApproveAccessRequest(ctxPiB, "REQ-1", "Cross-station PI")
	ctxPiB.stub.MockTransactionEnd("a4")
	if err == nil {
		t.Fatalf("SECURITY: cross-station PI must NOT approve access to this case")
	}

	// 4. PI of the OWNING station approving = PASS
	_, ctxPiA := setupRoleContext("PoliceOrgMSP", "MH-POL-A9", "PI", "MH-STN-A", "West")
	ctxPiA.stub = ctxA.stub
	ctxPiA.stub.MockTransactionStart("a5")
	err = contract.ApproveAccessRequest(ctxPiA, "REQ-1", "Owning PI")
	ctxPiA.stub.MockTransactionEnd("a5")
	if err != nil {
		t.Fatalf("PI of owning station must be able to approve access, got: %v", err)
	}

	var req AccessRequestAsset
	if err := json.Unmarshal(ctxA.stub.State["REQ-1"], &req); err != nil {
		t.Fatalf("failed to read approved request: %v", err)
	}
	if req.Status != "Approved" {
		t.Fatalf("expected status Approved, got %s", req.Status)
	}
	// The reviewer must be the authenticated approver, never the requester.
	if req.ReviewedBy != "MH-POL-A9" {
		t.Fatalf("reviewer must be bound to authenticated approver, got %s", req.ReviewedBy)
	}
}

// TestRejectAndRevokeAccess_Authorization asserts refusal and withdrawal of
// access are supervisory acts scoped to the case.
func TestRejectAndRevokeAccess_Authorization(t *testing.T) {
	contract, ctxA := setupRoleContext("PoliceOrgMSP", "MH-POL-A1", "OFFICER", "MH-STN-A", "West")
	newCase(t, contract, ctxA, "CASE-ACL-2", "MH-STN-A", "West", "MH-POL-A1", "MH-POL-A1", "MH-POL-SUP")

	_, ctxOut := setupRoleContext("PoliceOrgMSP", "MH-POL-X9", "OFFICER", "MH-STN-B", "East")
	ctxOut.stub = ctxA.stub
	ctxOut.stub.MockTransactionStart("r0")
	_ = contract.CreateAccessRequest(ctxOut, "REQ-2", "CASE-ACL-2", "MH-POL-X9", "Outsider", "READ", "need")
	ctxOut.stub.MockTransactionEnd("r0")

	// 1. Cross-station PI rejecting another station's request = FAIL
	_, ctxPiB := setupRoleContext("PoliceOrgMSP", "MH-POL-B9", "PI", "MH-STN-B", "East")
	ctxPiB.stub = ctxA.stub
	ctxPiB.stub.MockTransactionStart("r1")
	err := contract.RejectAccessRequest(ctxPiB, "REQ-2", "Cross PI")
	ctxPiB.stub.MockTransactionEnd("r1")
	if err == nil {
		t.Fatalf("SECURITY: cross-station PI must NOT reject this case's access request")
	}

	// 2. SP may reject anywhere (statewide authority) = PASS
	_, ctxSp := setupRoleContext("PoliceOrgMSP", "MH-POL-SP1", "SP", "MH-STN-HQ", "Statewide")
	ctxSp.stub = ctxA.stub
	ctxSp.stub.MockTransactionStart("r2")
	err = contract.RejectAccessRequest(ctxSp, "REQ-2", "SP")
	ctxSp.stub.MockTransactionEnd("r2")
	if err != nil {
		t.Fatalf("SP must hold statewide rejection authority, got: %v", err)
	}

	// 3. Revocation by an unrelated officer = FAIL
	ctxOut.stub.MockTransactionStart("r3")
	_ = contract.CreateAccessRequest(ctxOut, "REQ-3", "CASE-ACL-2", "MH-POL-X9", "Outsider", "READ", "need")
	ctxOut.stub.MockTransactionEnd("r3")

	_, ctxZ := setupRoleContext("PoliceOrgMSP", "MH-POL-Z1", "OFFICER", "MH-STN-C", "North")
	ctxZ.stub = ctxA.stub
	ctxZ.stub.MockTransactionStart("r4")
	err = contract.RevokeAccess(ctxZ, "REQ-3", "MH-POL-Z1")
	ctxZ.stub.MockTransactionEnd("r4")
	if err == nil {
		t.Fatalf("SECURITY: unrelated officer must NOT revoke an access grant on another station's case")
	}

	// 4. The grantee may always relinquish their own access = PASS
	ctxOut.stub.MockTransactionStart("r5")
	err = contract.RevokeAccess(ctxOut, "REQ-3", "MH-POL-X9")
	ctxOut.stub.MockTransactionEnd("r5")
	if err != nil {
		t.Fatalf("an officer must be able to relinquish their own access grant, got: %v", err)
	}
}

// TestRegisterFingerprint_CaseAuthorization asserts biometric registration is a
// case-scoped investigative write, not merely an authenticated one.
func TestRegisterFingerprint_CaseAuthorization(t *testing.T) {
	contract, ctxA := setupRoleContext("PoliceOrgMSP", "MH-POL-A1", "OFFICER", "MH-STN-A", "West")
	newCase(t, contract, ctxA, "CASE-FP-1", "MH-STN-A", "West", "MH-POL-A1", "MH-POL-A1", "MH-POL-SUP")
	validSha := "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

	// 1. Assigned officer registering on own case = PASS
	ctxA.stub.MockTransactionStart("f1")
	err := contract.RegisterFingerprint(ctxA, "FP-1", "CASE-FP-1", "", "Latent", "R-Index", validSha, "MH-POL-A1")
	ctxA.stub.MockTransactionEnd("f1")
	if err != nil {
		t.Fatalf("assigned officer must be able to register fingerprint on own case, got: %v", err)
	}

	// 2. Unrelated officer registering against another station's case = FAIL
	_, ctxB := setupRoleContext("PoliceOrgMSP", "MH-POL-B1", "OFFICER", "MH-STN-B", "East")
	ctxB.stub = ctxA.stub
	ctxB.stub.MockTransactionStart("f2")
	err = contract.RegisterFingerprint(ctxB, "FP-2", "CASE-FP-1", "", "Latent", "L-Thumb", validSha, "MH-POL-B1")
	ctxB.stub.MockTransactionEnd("f2")
	if err == nil {
		t.Fatalf("SECURITY: unrelated officer must NOT register fingerprints against another station's case")
	}

	// 3. Spoofed registeredBy = FAIL
	ctxA.stub.MockTransactionStart("f3")
	err = contract.RegisterFingerprint(ctxA, "FP-3", "CASE-FP-1", "", "Latent", "R-Mid", validSha, "MH-POL-ZZZ")
	ctxA.stub.MockTransactionEnd("f3")
	if err == nil {
		t.Fatalf("SECURITY: registeredBy that contradicts the authenticated caller must be rejected")
	}
}
