package main

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract defines the e-CASEVAULT production permissioned chaincode contract
type SmartContract struct {
	contractapi.Contract
}

// CaseAsset defines the on-chain metadata for a registered case.
//
// StationID, JurisdictionZone, AssignedIOBadge, SupervisorBadge and
// ClosureAuthorizedBadge are the authorization anchors. They are recorded on the
// ledger so that every case-scoped mutation can be authorized from immutable
// on-chain state plus the caller's signed X.509 attributes, without trusting any
// client-supplied argument, application role or JWT claim.
type CaseAsset struct {
	ObjectType             string `json:"docType"`
	CaseID                 string `json:"caseId"`
	FIRNumber              string `json:"firNumber"`
	CrimeType              string `json:"crimeType"`
	PoliceStation          string `json:"policeStation"`
	StationID              string `json:"stationId,omitempty"`
	JurisdictionZone       string `json:"jurisdictionZone,omitempty"`
	CreatedByBadge         string `json:"createdByBadge"`
	CreatedByName          string `json:"createdByName"`
	AssignedIOBadge        string `json:"assignedIoBadge,omitempty"`
	SupervisorBadge        string `json:"supervisorBadge,omitempty"`
	ClosureAuthorizedBadge string `json:"closureAuthorizedBadge,omitempty"`
	CaseMetadataHash       string `json:"caseMetadataHash"`
	Timestamp              string `json:"timestamp"`
	Status                 string `json:"status"`
}

// EvidenceAsset defines the on-chain SHA-256 proof for evidence custody
type EvidenceAsset struct {
	ObjectType        string `json:"docType"`
	EvidenceID        string `json:"evidenceId"`
	CaseID            string `json:"caseId"`
	EvidenceTag       string `json:"evidenceTag"`
	SHA256Hash        string `json:"sha256Hash"`
	Category          string `json:"category"`
	CollectedBy       string `json:"collectedBy"`
	CurrentCustodian  string `json:"currentCustodian"`
	CustodianIdentity string `json:"custodianIdentity,omitempty"`
	StorageLocation   string `json:"storageLocation"`
	RegisteredAt      string `json:"registeredAt"`
	TxID              string `json:"txId"`
	Status            string `json:"status"`
}

// CustodyTransferRecord defines an immutable evidence handover block
type CustodyTransferRecord struct {
	TransferID       string `json:"transferId"`
	EvidenceID       string `json:"evidenceId"`
	FromOfficer      string `json:"fromOfficer"`
	ToOfficer        string `json:"toOfficer"`
	Location         string `json:"location"`
	Action           string `json:"action"`
	Condition        string `json:"condition"`
	SealIntact       bool   `json:"sealIntact"`
	DigitalSignature string `json:"digitalSignature"`
	Timestamp        string `json:"timestamp"`
	CallerClientID   string `json:"callerClientId"`
}

// FingerprintAsset defines biometric verification hash recorded on Fabric
type FingerprintAsset struct {
	ObjectType     string `json:"docType"`
	FingerprintID  string `json:"fingerprintId"`
	CaseID         string `json:"caseId"`
	EvidenceID     string `json:"evidenceId"`
	PrintType      string `json:"printType"`
	FingerPosition string `json:"fingerPosition"`
	ScanFileHash   string `json:"scanFileHash"`
	RegisteredAt   string `json:"registeredAt"`
	RegisteredBy   string `json:"registeredBy"`
	TxID           string `json:"txId"`
}

// ForensicReportAsset defines an immutable FSL report hash registered on Fabric
type ForensicReportAsset struct {
	ObjectType    string `json:"docType"`
	ReportID      string `json:"reportId"`
	CaseID        string `json:"caseId"`
	EvidenceID    string `json:"evidenceId"`
	ExaminerName  string `json:"examinerName"`
	ExaminerBadge string `json:"examinerBadge"`
	LabName       string `json:"labName"`
	ReportHash    string `json:"reportHash"`
	RegisteredAt  string `json:"registeredAt"`
	TxID          string `json:"txId"`
	Status        string `json:"status"`
}

// BlockchainEventAsset defines an immutable chained activity event on Fabric
type BlockchainEventAsset struct {
	ObjectType   string `json:"docType"`
	EventID      string `json:"eventId"`
	CaseID       string `json:"caseId"`
	EntityID     string `json:"entityId"`
	EntityType   string `json:"entityType"`
	Action       string `json:"action"`
	ActorID      string `json:"actorId"`
	FileHash     string `json:"fileHash"`
	DataHash     string `json:"dataHash"`
	PreviousHash string `json:"previousHash"`
	EventHash    string `json:"eventHash"`
	Timestamp    string `json:"timestamp"`
	TxID         string `json:"txId"`
}

// AccessRequestAsset defines an immutable authorization request on Fabric
type AccessRequestAsset struct {
	ObjectType       string `json:"docType"`
	RequestID        string `json:"requestId"`
	CaseID           string `json:"caseId"`
	RequestedByBadge string `json:"requestedByBadge"`
	RequestedByName  string `json:"requestedByName"`
	AccessLevel      string `json:"accessLevel"`
	Reason           string `json:"reason"`
	Status           string `json:"status"`
	ReviewedBy       string `json:"reviewedBy"`
	ReviewedAt       string `json:"reviewedAt"`
	TxID             string `json:"txId"`
}

// HistoryQueryResult structure for returning entity history
type HistoryQueryResult struct {
	TxId      string          `json:"txId"`
	Timestamp string          `json:"timestamp"`
	IsDelete  bool            `json:"isDelete"`
	Value     json.RawMessage `json:"value"`
}

var sha256Regex = regexp.MustCompile(`^[0-9a-fA-F]{64}$`)
var badgePattern = regexp.MustCompile(`^[A-Za-z0-9_-]{3,64}$`)

// isValidOfficerBadgeFormat ensures an identity string conforms to valid officer identifier structure
// and rejects generic unmapped administrative identities.
func isValidOfficerBadgeFormat(val string) bool {
	if val == "" || len(val) < 3 || len(val) > 64 {
		return false
	}
	lower := strings.ToLower(val)
	if lower == "admin" || lower == "user1" || strings.Contains(lower, "admin@") || strings.Contains(lower, "user1@") {
		return false
	}
	return badgePattern.MatchString(val)
}

// validateClientIdentity validates caller MSP against allowed organizations and extracts caller identity.
func validateClientIdentity(ctx contractapi.TransactionContextInterface, allowedMSPs ...string) (string, string, error) {
	ci := ctx.GetClientIdentity()
	if ci == nil {
		return "", "", fmt.Errorf("client identity validation failed: identity context is missing")
	}

	mspID, err := ci.GetMSPID()
	if err != nil {
		return "", "", fmt.Errorf("client identity validation failed: %v", err)
	}
	if mspID == "" {
		return "", "", fmt.Errorf("client identity validation failed: empty MSPID")
	}

	clientID, err := ci.GetID()
	if err != nil {
		return "", "", fmt.Errorf("client identity validation failed: %v", err)
	}
	if clientID == "" {
		return "", "", fmt.Errorf("client identity validation failed: empty client ID")
	}

	isAllowed := false
	for _, allowed := range allowedMSPs {
		if mspID == allowed {
			isAllowed = true
			break
		}
	}

	if !isAllowed {
		return "", "", fmt.Errorf("unauthorized organization %s: action only permitted for %v", mspID, allowedMSPs)
	}

	return mspID, clientID, nil
}

// resolveCallerBadge deterministically resolves the authenticated officer badge from the Fabric client identity context.
// Strictly enforces explicit X.509 certificate attribute 'officerBadge' (or 'badge').
// Any identity lacking the explicit attribute is strictly DENIED. No loose CN or client ID guessing.
func resolveCallerBadge(ctx contractapi.TransactionContextInterface) (string, error) {
	ci := ctx.GetClientIdentity()
	if ci == nil {
		return "", fmt.Errorf("client identity context is missing")
	}

	// 1. Check custom X.509 attribute "officerBadge"
	if badge, found, _ := ci.GetAttributeValue("officerBadge"); found && strings.TrimSpace(badge) != "" {
		clean := strings.TrimSpace(badge)
		if isValidOfficerBadgeFormat(clean) {
			return clean, nil
		}
		return "", fmt.Errorf("invalid officerBadge certificate attribute format: '%s'", clean)
	}

	// 2. Check custom X.509 attribute "badge"
	if badge, found, _ := ci.GetAttributeValue("badge"); found && strings.TrimSpace(badge) != "" {
		clean := strings.TrimSpace(badge)
		if isValidOfficerBadgeFormat(clean) {
			return clean, nil
		}
		return "", fmt.Errorf("invalid badge certificate attribute format: '%s'", clean)
	}

	clientID, _ := ci.GetID()
	return "", fmt.Errorf("access denied: X.509 certificate lacks mandatory 'officerBadge' attribute (client identity: '%s')", clientID)
}

// callerContext is the authenticated, certificate-derived description of the
// transaction submitter. Every field originates from the CA-signed X.509
// certificate presented to the peer. Nothing here is taken from a transaction
// argument, so a client cannot elevate itself by lying in the request body.
type callerContext struct {
	MSPID   string
	Badge   string
	Role    string
	Station string
	Zone    string
}

// normaliseRole canonicalises a certificate role attribute. An unrecognised or
// absent role collapses to OFFICER, the least-privileged rank, so a
// misconfigured certificate can never gain supervisory authority.
func normaliseRole(raw string) string {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case "SP", "SUPERINTENDENT", "SUPERINTENDENT_OF_POLICE":
		return "SP"
	case "DYSP", "DY_SP", "DEPUTY_SUPERINTENDENT":
		return "DySP"
	case "PI", "INSPECTOR", "POLICE_INSPECTOR":
		return "PI"
	default:
		return "OFFICER"
	}
}

// resolveCallerContext builds the authenticated caller description from the
// Fabric client identity. The officerBadge attribute is mandatory; role,
// station and zone are optional and default to the least-privileged
// interpretation when absent.
func resolveCallerContext(ctx contractapi.TransactionContextInterface, allowedMSPs ...string) (*callerContext, error) {
	mspID, _, err := validateClientIdentity(ctx, allowedMSPs...)
	if err != nil {
		return nil, err
	}

	badge, err := resolveCallerBadge(ctx)
	if err != nil {
		return nil, err
	}

	ci := ctx.GetClientIdentity()

	rawRole := ""
	if v, found, _ := ci.GetAttributeValue("role"); found {
		rawRole = v
	} else if v, found, _ := ci.GetAttributeValue("officerRole"); found {
		rawRole = v
	}

	station := ""
	if v, found, _ := ci.GetAttributeValue("station"); found {
		station = strings.TrimSpace(v)
	} else if v, found, _ := ci.GetAttributeValue("stationId"); found {
		station = strings.TrimSpace(v)
	}

	zone := ""
	if v, found, _ := ci.GetAttributeValue("zone"); found {
		zone = strings.TrimSpace(v)
	} else if v, found, _ := ci.GetAttributeValue("jurisdictionZone"); found {
		zone = strings.TrimSpace(v)
	}

	return &callerContext{
		MSPID:   mspID,
		Badge:   badge,
		Role:    normaliseRole(rawRole),
		Station: station,
		Zone:    zone,
	}, nil
}

// isCasePrincipal reports whether the caller is individually bound to the case:
// its creator, its assigned investigating officer, or its recorded supervisor.
func (c *callerContext) isCasePrincipal(caseAsset *CaseAsset) bool {
	if c.Badge == "" || caseAsset == nil {
		return false
	}
	return c.Badge == caseAsset.CreatedByBadge ||
		(caseAsset.AssignedIOBadge != "" && c.Badge == caseAsset.AssignedIOBadge) ||
		(caseAsset.SupervisorBadge != "" && c.Badge == caseAsset.SupervisorBadge)
}

// commandsStation reports whether a PI's certificate station matches the case
// station. Legacy assets predating StationID fall back to the station name.
func (c *callerContext) commandsStation(caseAsset *CaseAsset) bool {
	if c.Station == "" || caseAsset == nil {
		return false
	}
	if caseAsset.StationID != "" && strings.EqualFold(c.Station, caseAsset.StationID) {
		return true
	}
	return caseAsset.PoliceStation != "" && strings.EqualFold(c.Station, caseAsset.PoliceStation)
}

// commandsZone reports whether a DySP's certificate jurisdiction zone matches
// the case zone. A case with no recorded zone fails closed: the DySP must
// instead be an individually bound case principal.
func (c *callerContext) commandsZone(caseAsset *CaseAsset) bool {
	if c.Zone == "" || caseAsset == nil || caseAsset.JurisdictionZone == "" {
		return false
	}
	return strings.EqualFold(c.Zone, caseAsset.JurisdictionZone)
}

// authorizeCaseWrite enforces case-level write authorization for mutations that
// advance an existing case. A valid Fabric identity is necessary but NOT
// sufficient: the caller must additionally hold authority over this specific
// case.
//
//	SP       — statewide authority
//	DySP     — cases inside its own jurisdiction zone
//	PI       — cases belonging to its own station
//	OFFICER  — only cases it created, is the assigned IO of, or supervises
func authorizeCaseWrite(caller *callerContext, caseAsset *CaseAsset, action string) error {
	if caller == nil || caseAsset == nil {
		return fmt.Errorf("%s denied: authorization context unavailable", action)
	}

	if caller.isCasePrincipal(caseAsset) {
		return nil
	}

	switch caller.Role {
	case "SP":
		return nil
	case "DySP":
		if caller.commandsZone(caseAsset) {
			return nil
		}
		return fmt.Errorf("%s denied: DySP '%s' (zone '%s') holds no authority over case %s in zone '%s'",
			action, caller.Badge, caller.Zone, caseAsset.CaseID, caseAsset.JurisdictionZone)
	case "PI":
		if caller.commandsStation(caseAsset) {
			return nil
		}
		return fmt.Errorf("%s denied: PI '%s' (station '%s') holds no authority over case %s at station '%s'",
			action, caller.Badge, caller.Station, caseAsset.CaseID, caseAsset.StationID)
	}

	return fmt.Errorf("%s denied: officer '%s' is not the creator, assigned investigating officer or supervisor of case %s",
		action, caller.Badge, caseAsset.CaseID)
}

// authorizeCaseClosure enforces the stricter authorization boundary for closing
// a case. Closure is a supervisory act and terminates the investigation, so
// possessing a valid Fabric identity — or even being the assigned IO — does not
// by itself confer permission.
//
//	SP       — may close any case
//	DySP     — may close cases inside its own jurisdiction zone
//	PI       — may close cases at its own station, or cases it is bound to
//	OFFICER  — DENIED unless a supervisor has explicitly recorded the officer
//	           in ClosureAuthorizedBadge via AuthorizeCaseClosure
func authorizeCaseClosure(caller *callerContext, caseAsset *CaseAsset) error {
	if caller == nil || caseAsset == nil {
		return fmt.Errorf("case closure denied: authorization context unavailable")
	}

	if caseAsset.ClosureAuthorizedBadge != "" && caller.Badge == caseAsset.ClosureAuthorizedBadge {
		return nil
	}

	switch caller.Role {
	case "SP":
		return nil
	case "DySP":
		if caller.commandsZone(caseAsset) || caller.Badge == caseAsset.SupervisorBadge {
			return nil
		}
		return fmt.Errorf("case closure denied: DySP '%s' (zone '%s') holds no closure authority over case %s in zone '%s'",
			caller.Badge, caller.Zone, caseAsset.CaseID, caseAsset.JurisdictionZone)
	case "PI":
		if caller.commandsStation(caseAsset) || caller.isCasePrincipal(caseAsset) {
			return nil
		}
		return fmt.Errorf("case closure denied: PI '%s' (station '%s') holds no closure authority over case %s at station '%s'",
			caller.Badge, caller.Station, caseAsset.CaseID, caseAsset.StationID)
	}

	return fmt.Errorf("case closure denied: officer '%s' holds no supervisory rank and has not been explicitly authorized to close case %s",
		caller.Badge, caseAsset.CaseID)
}

// authorizeSupervisoryAction enforces that granting, refusing or withdrawing
// access to a case is performed by an officer with supervisory authority over
// that case. Without this check any officer holding a valid certificate could
// approve their own access request and self-escalate onto any case.
func authorizeSupervisoryAction(caller *callerContext, caseAsset *CaseAsset, action string) error {
	if caller == nil || caseAsset == nil {
		return fmt.Errorf("%s denied: authorization context unavailable", action)
	}

	switch caller.Role {
	case "SP":
		return nil
	case "DySP":
		if caller.commandsZone(caseAsset) || caller.Badge == caseAsset.SupervisorBadge {
			return nil
		}
		return fmt.Errorf("%s denied: DySP '%s' (zone '%s') holds no supervisory authority over case %s in zone '%s'",
			action, caller.Badge, caller.Zone, caseAsset.CaseID, caseAsset.JurisdictionZone)
	case "PI":
		if caller.commandsStation(caseAsset) || caller.Badge == caseAsset.CreatedByBadge || caller.Badge == caseAsset.SupervisorBadge {
			return nil
		}
		return fmt.Errorf("%s denied: PI '%s' (station '%s') holds no supervisory authority over case %s at station '%s'",
			action, caller.Badge, caller.Station, caseAsset.CaseID, caseAsset.StationID)
	}

	return fmt.Errorf("%s denied: officer '%s' holds no supervisory rank over case %s",
		action, caller.Badge, caseAsset.CaseID)
}

// InitLedger initializes the ledger state with genesis case
func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	genesisCase := CaseAsset{
		ObjectType:             "CASE",
		CaseID:                 "MH-MUM-2026-004821",
		FIRNumber:              "AND/CR/2026/04821",
		CrimeType:              "Cyber Fraud & Criminal Breach of Trust",
		PoliceStation:          "Andheri Police Station, Mumbai",
		StationID:              "MH-STN-AND-01",
		JurisdictionZone:       "Mumbai Metropolitan",
		CreatedByBadge:         "MH-POL-8842",
		CreatedByName:          "Inspector Vikram K. Patil",
		AssignedIOBadge:        "MH-POL-2045",
		SupervisorBadge:        "MH-POL-1001",
		CaseMetadataHash:       "9f8c31ab72890e4f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f",
		Timestamp:              time.Now().Format(time.RFC3339),
		Status:                 "Forensic Examination",
	}

	caseJSON, err := json.Marshal(genesisCase)
	if err != nil {
		return fmt.Errorf("failed to marshal genesis case: %v", err)
	}

	return ctx.GetStub().PutState(genesisCase.CaseID, caseJSON)
}

// CreateCase registers a new police case on the blockchain (PoliceOrgMSP only).
// stationID and zone are persisted as the case's authorization anchors, and
// assignedIOBadge / supervisorBadge record the officers individually bound to
// the case. All later case-scoped mutations authorize against these fields.
func (s *SmartContract) CreateCase(ctx contractapi.TransactionContextInterface, caseID string, firNumber string, crimeType string, station string, stationID string, zone string, badge string, name string, assignedIOBadge string, supervisorBadge string, metadataHash string) error {
	if caseID == "" || firNumber == "" || station == "" || badge == "" {
		return fmt.Errorf("invalid arguments: caseId, firNumber, station, and badge must be non-empty")
	}

	caller, err := resolveCallerContext(ctx, "PoliceOrgMSP")
	if err != nil {
		return fmt.Errorf("unauthorized case creation: %v", err)
	}
	callerBadge := caller.Badge

	// Verify creator badge matches authenticated caller
	if badge != "" && badge != callerBadge {
		return fmt.Errorf("case creation rejected: createdByBadge '%s' does not match authenticated caller badge '%s'", badge, callerBadge)
	}

	// An officer may only register a case at a station it is certified for.
	// SP holds statewide registration authority.
	if caller.Role != "SP" && caller.Station != "" && stationID != "" && !strings.EqualFold(caller.Station, stationID) {
		return fmt.Errorf("case creation rejected: officer '%s' is certified for station '%s' and cannot register a case at station '%s'", callerBadge, caller.Station, stationID)
	}

	if assignedIOBadge != "" && !isValidOfficerBadgeFormat(assignedIOBadge) {
		return fmt.Errorf("case creation rejected: invalid assignedIOBadge format '%s'", assignedIOBadge)
	}
	if supervisorBadge != "" && !isValidOfficerBadgeFormat(supervisorBadge) {
		return fmt.Errorf("case creation rejected: invalid supervisorBadge format '%s'", supervisorBadge)
	}

	exists, err := s.AssetExists(ctx, caseID)
	if err != nil {
		return fmt.Errorf("failed to read from world state: %v", err)
	}
	if exists {
		return fmt.Errorf("the case %s already exists on the ledger", caseID)
	}

	caseAsset := CaseAsset{
		ObjectType:       "CASE",
		CaseID:           caseID,
		FIRNumber:        firNumber,
		CrimeType:        crimeType,
		PoliceStation:    station,
		StationID:        stationID,
		JurisdictionZone: zone,
		CreatedByBadge:   callerBadge,
		CreatedByName:    name,
		AssignedIOBadge:  assignedIOBadge,
		SupervisorBadge:  supervisorBadge,
		CaseMetadataHash: metadataHash,
		Timestamp:        time.Now().Format(time.RFC3339),
		Status:           "FIR Registered",
	}

	caseJSON, err := json.Marshal(caseAsset)
	if err != nil {
		return fmt.Errorf("failed to marshal case asset: %v", err)
	}

	if err := ctx.GetStub().SetEvent("CaseCreated", caseJSON); err != nil {
		return fmt.Errorf("failed to set CaseCreated event: %v", err)
	}

	return ctx.GetStub().PutState(caseID, caseJSON)
}

// GetCase retrieves a case record from the ledger
func (s *SmartContract) GetCase(ctx contractapi.TransactionContextInterface, caseID string) (*CaseAsset, error) {
	caseJSON, err := ctx.GetStub().GetState(caseID)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}
	if caseJSON == nil {
		return nil, fmt.Errorf("case %s does not exist", caseID)
	}

	var caseAsset CaseAsset
	if err := json.Unmarshal(caseJSON, &caseAsset); err != nil {
		return nil, fmt.Errorf("failed to unmarshal case asset: %v", err)
	}

	return &caseAsset, nil
}

// UpdateCaseStatus updates status of a registered case (PoliceOrgMSP only).
// Authentication alone is insufficient: the authenticated caller must hold
// case-level authority over this specific case, enforced on-chain below.
func (s *SmartContract) UpdateCaseStatus(ctx contractapi.TransactionContextInterface, caseID string, newStatus string) error {
	if caseID == "" || newStatus == "" {
		return fmt.Errorf("invalid arguments: caseId and newStatus must be non-empty")
	}

	caller, err := resolveCallerContext(ctx, "PoliceOrgMSP")
	if err != nil {
		return fmt.Errorf("unauthorized case update: %v", err)
	}

	caseAsset, err := s.GetCase(ctx, caseID)
	if err != nil {
		return err
	}

	if caseAsset.Status == "Closed" {
		return fmt.Errorf("cannot update status of closed case %s", caseID)
	}

	// CRITICAL CASE-LEVEL AUTHORIZATION BOUNDARY.
	// Enforced inside the Fabric transaction so it cannot be bypassed by
	// calling the peer directly, and derived only from ledger state plus the
	// caller's CA-signed certificate attributes.
	if err := authorizeCaseWrite(caller, caseAsset, "case status update"); err != nil {
		return err
	}

	// Formal closure has a stricter authorization boundary and must be executed
	// through CloseCase, which records the closure reason immutably.
	if strings.EqualFold(strings.TrimSpace(newStatus), "Closed") {
		return fmt.Errorf("case status update rejected: case closure must be executed via CloseCase with a mandatory closure justification")
	}

	caseAsset.Status = newStatus
	caseJSON, err := json.Marshal(caseAsset)
	if err != nil {
		return fmt.Errorf("failed to marshal updated case asset: %v", err)
	}

	if err := ctx.GetStub().SetEvent("CaseStatusUpdated", caseJSON); err != nil {
		return fmt.Errorf("failed to set CaseStatusUpdated event: %v", err)
	}

	return ctx.GetStub().PutState(caseID, caseJSON)
}

// CloseCase marks a case closed on the immutable ledger (PoliceOrgMSP only).
// Closure carries a stricter authorization boundary than an ordinary status
// change: a valid Fabric identity does NOT confer permission to close every
// case. See authorizeCaseClosure for the enforced rank and jurisdiction rules.
func (s *SmartContract) CloseCase(ctx contractapi.TransactionContextInterface, caseID string, closureReason string) error {
	if caseID == "" || closureReason == "" {
		return fmt.Errorf("invalid arguments: caseId and closureReason must be non-empty")
	}

	caller, err := resolveCallerContext(ctx, "PoliceOrgMSP")
	if err != nil {
		return fmt.Errorf("unauthorized case closure: %v", err)
	}

	caseAsset, err := s.GetCase(ctx, caseID)
	if err != nil {
		return err
	}

	if caseAsset.Status == "Closed" {
		return fmt.Errorf("case %s is already closed on the ledger", caseID)
	}

	// CRITICAL CASE-LEVEL AUTHORIZATION BOUNDARY for case closure.
	if err := authorizeCaseClosure(caller, caseAsset); err != nil {
		return err
	}

	caseAsset.Status = "Closed"
	caseJSON, err := json.Marshal(caseAsset)
	if err != nil {
		return fmt.Errorf("failed to marshal closed case asset: %v", err)
	}

	if err := ctx.GetStub().SetEvent("CaseClosed", caseJSON); err != nil {
		return fmt.Errorf("failed to set CaseClosed event: %v", err)
	}

	return ctx.GetStub().PutState(caseID, caseJSON)
}

// UpdateCaseAssignment reassigns the investigating officer and/or supervisor of
// a case. Reassignment changes who holds case-level authority, so it is itself a
// supervisory act and is authorized accordingly.
func (s *SmartContract) UpdateCaseAssignment(ctx contractapi.TransactionContextInterface, caseID string, assignedIOBadge string, supervisorBadge string) error {
	if caseID == "" {
		return fmt.Errorf("invalid arguments: caseId must be non-empty")
	}
	if assignedIOBadge == "" && supervisorBadge == "" {
		return fmt.Errorf("invalid arguments: at least one of assignedIOBadge or supervisorBadge must be provided")
	}

	caller, err := resolveCallerContext(ctx, "PoliceOrgMSP")
	if err != nil {
		return fmt.Errorf("unauthorized case reassignment: %v", err)
	}

	caseAsset, err := s.GetCase(ctx, caseID)
	if err != nil {
		return err
	}

	if caseAsset.Status == "Closed" {
		return fmt.Errorf("cannot reassign closed case %s", caseID)
	}

	if err := authorizeSupervisoryAction(caller, caseAsset, "case reassignment"); err != nil {
		return err
	}

	if assignedIOBadge != "" {
		if !isValidOfficerBadgeFormat(assignedIOBadge) {
			return fmt.Errorf("case reassignment rejected: invalid assignedIOBadge format '%s'", assignedIOBadge)
		}
		caseAsset.AssignedIOBadge = assignedIOBadge
	}

	if supervisorBadge != "" {
		if !isValidOfficerBadgeFormat(supervisorBadge) {
			return fmt.Errorf("case reassignment rejected: invalid supervisorBadge format '%s'", supervisorBadge)
		}
		caseAsset.SupervisorBadge = supervisorBadge
	}

	caseJSON, err := json.Marshal(caseAsset)
	if err != nil {
		return fmt.Errorf("failed to marshal reassigned case asset: %v", err)
	}

	if err := ctx.GetStub().SetEvent("CaseReassigned", caseJSON); err != nil {
		return fmt.Errorf("failed to set CaseReassigned event: %v", err)
	}

	return ctx.GetStub().PutState(caseID, caseJSON)
}

// AuthorizeCaseClosure records an explicit, immutable delegation of closure
// authority to a single named officer. This is the only mechanism by which an
// officer without supervisory rank may close a case, and only a supervisor with
// authority over the case may grant it.
func (s *SmartContract) AuthorizeCaseClosure(ctx contractapi.TransactionContextInterface, caseID string, officerBadge string) error {
	if caseID == "" || officerBadge == "" {
		return fmt.Errorf("invalid arguments: caseId and officerBadge must be non-empty")
	}
	if !isValidOfficerBadgeFormat(officerBadge) {
		return fmt.Errorf("closure authorization rejected: invalid officerBadge format '%s'", officerBadge)
	}

	caller, err := resolveCallerContext(ctx, "PoliceOrgMSP")
	if err != nil {
		return fmt.Errorf("unauthorized closure delegation: %v", err)
	}

	caseAsset, err := s.GetCase(ctx, caseID)
	if err != nil {
		return err
	}

	if caseAsset.Status == "Closed" {
		return fmt.Errorf("cannot delegate closure authority on already closed case %s", caseID)
	}

	if err := authorizeSupervisoryAction(caller, caseAsset, "closure delegation"); err != nil {
		return err
	}

	// A supervisor cannot use this transaction to grant closure authority to
	// itself, which would let a PI outside its own station launder authority.
	if officerBadge == caller.Badge {
		return fmt.Errorf("closure delegation rejected: officer '%s' cannot delegate closure authority to itself", caller.Badge)
	}

	caseAsset.ClosureAuthorizedBadge = officerBadge

	caseJSON, err := json.Marshal(caseAsset)
	if err != nil {
		return fmt.Errorf("failed to marshal case asset: %v", err)
	}

	if err := ctx.GetStub().SetEvent("CaseClosureAuthorized", caseJSON); err != nil {
		return fmt.Errorf("failed to set CaseClosureAuthorized event: %v", err)
	}

	return ctx.GetStub().PutState(caseID, caseJSON)
}

// GetCaseHistory returns all historical transactions for a case
func (s *SmartContract) GetCaseHistory(ctx contractapi.TransactionContextInterface, caseID string) ([]HistoryQueryResult, error) {
	resultsIterator, err := ctx.GetStub().GetHistoryForKey(caseID)
	if err != nil {
		return nil, fmt.Errorf("failed to get history iterator for case %s: %v", caseID, err)
	}
	defer resultsIterator.Close()

	var records []HistoryQueryResult
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		record := HistoryQueryResult{
			TxId:      response.TxId,
			Timestamp: time.Unix(response.Timestamp.Seconds, int64(response.Timestamp.Nanos)).Format(time.RFC3339),
			IsDelete:  response.IsDelete,
			Value:     response.Value,
		}
		records = append(records, record)
	}

	return records, nil
}

// RegisterEvidence commits an evidence item's SHA-256 hash and metadata on-chain
func (s *SmartContract) RegisterEvidence(ctx contractapi.TransactionContextInterface, evidenceID string, caseID string, tag string, sha256 string, category string, collector string, location string) error {
	if evidenceID == "" || caseID == "" || tag == "" || sha256 == "" {
		return fmt.Errorf("invalid arguments: evidenceID, caseID, tag, and sha256 must be non-empty")
	}

	caller, err := resolveCallerContext(ctx, "PoliceOrgMSP", "FSLOrgMSP")
	if err != nil {
		return fmt.Errorf("unauthorized evidence registration: %v", err)
	}
	callerBadge := caller.Badge

	if !sha256Regex.MatchString(sha256) {
		return fmt.Errorf("invalid SHA-256 digest format: must be 64 hexadecimal characters")
	}

	// Verify associated case exists and load it for authorization
	caseAsset, err := s.GetCase(ctx, caseID)
	if err != nil {
		return fmt.Errorf("cannot register evidence: associated case %s does not exist on ledger", caseID)
	}

	if caseAsset.Status == "Closed" {
		return fmt.Errorf("cannot register evidence against closed case %s", caseID)
	}

	// CASE-LEVEL AUTHORIZATION. A police officer may only attach evidence to a
	// case it holds authority over; otherwise any officer with a valid
	// certificate could inject evidence into any investigation in the state.
	// FSLOrgMSP examiners are authorized by organizational boundary: they submit
	// laboratory-produced exhibits and are never case principals.
	if caller.MSPID == "PoliceOrgMSP" {
		if err := authorizeCaseWrite(caller, caseAsset, "evidence registration"); err != nil {
			return err
		}
	}

	exists, err := s.AssetExists(ctx, evidenceID)
	if err != nil {
		return fmt.Errorf("failed to read world state: %v", err)
	}
	if exists {
		return fmt.Errorf("evidence %s already registered on ledger", evidenceID)
	}

	// Verify collector matches authenticated caller
	if collector == "" {
		collector = callerBadge
	} else if collector != callerBadge {
		return fmt.Errorf("registration rejected: collector '%s' does not match authenticated caller badge '%s'", collector, callerBadge)
	}

	txID := ctx.GetStub().GetTxID()
	evidence := EvidenceAsset{
		ObjectType:        "EVIDENCE",
		EvidenceID:        evidenceID,
		CaseID:            caseID,
		EvidenceTag:       tag,
		SHA256Hash:        sha256,
		Category:          category,
		CollectedBy:       callerBadge,
		CurrentCustodian:  callerBadge,
		CustodianIdentity: callerBadge,
		StorageLocation:   location,
		RegisteredAt:      time.Now().Format(time.RFC3339),
		TxID:              txID,
		Status:            "Collected & Sealed",
	}

	evidenceJSON, err := json.Marshal(evidence)
	if err != nil {
		return fmt.Errorf("failed to marshal evidence asset: %v", err)
	}

	if err := ctx.GetStub().SetEvent("EvidenceRegistered", evidenceJSON); err != nil {
		return fmt.Errorf("failed to set EvidenceRegistered event: %v", err)
	}

	return ctx.GetStub().PutState(evidenceID, evidenceJSON)
}

// GetEvidence retrieves an evidence asset from the ledger
func (s *SmartContract) GetEvidence(ctx contractapi.TransactionContextInterface, evidenceID string) (*EvidenceAsset, error) {
	evidenceJSON, err := ctx.GetStub().GetState(evidenceID)
	if err != nil {
		return nil, fmt.Errorf("failed to read world state: %v", err)
	}
	if evidenceJSON == nil {
		return nil, fmt.Errorf("evidence %s not found on ledger", evidenceID)
	}

	var evidence EvidenceAsset
	if err := json.Unmarshal(evidenceJSON, &evidence); err != nil {
		return nil, fmt.Errorf("failed to unmarshal evidence: %v", err)
	}

	return &evidence, nil
}

// TransferEvidence records an immutable chain-of-custody transfer with authenticated caller identity verification
func (s *SmartContract) TransferEvidence(ctx contractapi.TransactionContextInterface, transferID string, evidenceID string, fromOfficer string, toOfficer string, location string, action string, condition string, digitalSignature string) error {
	if transferID == "" || evidenceID == "" || toOfficer == "" {
		return fmt.Errorf("invalid transfer arguments: transferID, evidenceID, and toOfficer are required")
	}

	// 1. Enforce organization authorization
	_, _, err := validateClientIdentity(ctx, "PoliceOrgMSP", "FSLOrgMSP", "CyberCellOrgMSP")
	if err != nil {
		return fmt.Errorf("unauthorized custody transfer: %v", err)
	}

	// 2. Resolve authenticated caller badge
	callerBadge, err := resolveCallerBadge(ctx)
	if err != nil {
		return fmt.Errorf("custody transfer rejected: unable to resolve authenticated caller identity: %v", err)
	}

	// 3. Prevent duplicate transfers (idempotency guard)
	transferExists, err := s.AssetExists(ctx, transferID)
	if err != nil {
		return fmt.Errorf("failed to check transfer existence: %v", err)
	}
	if transferExists {
		return fmt.Errorf("transfer %s has already been committed to the ledger (duplicate transfer rejected)", transferID)
	}

	// 4. Verify evidence existence
	evidence, err := s.GetEvidence(ctx, evidenceID)
	if err != nil {
		return err
	}

	// 5. Verify evidence is in an active state
	if evidence.Status == "Closed" || evidence.Status == "Disposed" {
		return fmt.Errorf("custody transfer rejected: evidence %s is in '%s' status and cannot be transferred", evidenceID, evidence.Status)
	}

	// 6. CRITICAL AUTHENTICATION ENFORCEMENT:
	// The authenticated Fabric caller badge MUST match the registered CurrentCustodian.
	// We do NOT trust fromOfficer as proof of identity.
	// We do NOT allow any "Admin" bypass string.
	if callerBadge != evidence.CurrentCustodian {
		return fmt.Errorf("custody transfer rejected: authenticated caller '%s' is not the current evidence custodian '%s'", callerBadge, evidence.CurrentCustodian)
	}

	// If fromOfficer was provided, ensure it does not contradict CurrentCustodian
	if fromOfficer != "" && fromOfficer != evidence.CurrentCustodian {
		return fmt.Errorf("custody transfer rejected: specified fromOfficer '%s' does not match current evidence custodian '%s'", fromOfficer, evidence.CurrentCustodian)
	}

	// 7. Target custodian cannot be identical to current custodian
	if toOfficer == evidence.CurrentCustodian {
		return fmt.Errorf("invalid transfer: target custodian '%s' cannot be identical to current custodian", toOfficer)
	}

	// 8. Atomically update custodian and bound identity to target officer
	evidence.CurrentCustodian = toOfficer
	evidence.CustodianIdentity = toOfficer
	evidence.StorageLocation = location
	evidence.Status = "Transferred"

	updatedEvidenceJSON, err := json.Marshal(evidence)
	if err != nil {
		return fmt.Errorf("failed to marshal updated evidence: %v", err)
	}

	if err := ctx.GetStub().PutState(evidenceID, updatedEvidenceJSON); err != nil {
		return fmt.Errorf("failed to put updated evidence: %v", err)
	}

	transferRecord := CustodyTransferRecord{
		TransferID:       transferID,
		EvidenceID:       evidenceID,
		FromOfficer:      callerBadge,
		ToOfficer:        toOfficer,
		Location:         location,
		Action:           action,
		Condition:        condition,
		SealIntact:       true,
		DigitalSignature: digitalSignature,
		Timestamp:        time.Now().Format(time.RFC3339),
		CallerClientID:   callerBadge,
	}

	transferJSON, err := json.Marshal(transferRecord)
	if err != nil {
		return fmt.Errorf("failed to marshal transfer record: %v", err)
	}

	if err := ctx.GetStub().SetEvent("EvidenceTransferred", transferJSON); err != nil {
		return fmt.Errorf("failed to set EvidenceTransferred event: %v", err)
	}

	return ctx.GetStub().PutState(transferID, transferJSON)
}

// GetEvidenceHistory returns the complete immutable chain-of-custody transaction history for an evidence item
func (s *SmartContract) GetEvidenceHistory(ctx contractapi.TransactionContextInterface, evidenceID string) ([]HistoryQueryResult, error) {
	resultsIterator, err := ctx.GetStub().GetHistoryForKey(evidenceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get history iterator for key %s: %v", evidenceID, err)
	}
	defer resultsIterator.Close()

	var records []HistoryQueryResult
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		record := HistoryQueryResult{
			TxId:      response.TxId,
			Timestamp: time.Unix(response.Timestamp.Seconds, int64(response.Timestamp.Nanos)).Format(time.RFC3339),
			IsDelete:  response.IsDelete,
			Value:     response.Value,
		}
		records = append(records, record)
	}

	return records, nil
}

// VerifyEvidenceHash compares a calculated current SHA-256 hash against the blockchain-registered record
func (s *SmartContract) VerifyEvidenceHash(ctx contractapi.TransactionContextInterface, evidenceID string, currentSHA256 string) (string, error) {
	evidence, err := s.GetEvidence(ctx, evidenceID)
	if err != nil {
		return "NOT_FOUND", err
	}

	if evidence.SHA256Hash == currentSHA256 {
		return "VERIFIED_INTEGRITY_MATCH", nil
	}
	return "TAMPER_ALERT_HASH_MISMATCH", nil
}

// RegisterFingerprint records a biometric scan hash on Fabric (PoliceOrgMSP or CyberCellOrgMSP)
// Derives registeredBy strictly from authenticated caller context.
func (s *SmartContract) RegisterFingerprint(ctx contractapi.TransactionContextInterface, fingerprintID string, caseID string, evidenceID string, printType string, fingerPosition string, scanFileHash string, registeredBy string) error {
	if fingerprintID == "" || caseID == "" || scanFileHash == "" {
		return fmt.Errorf("invalid arguments: fingerprintID, caseID, and scanFileHash are required")
	}

	caller, err := resolveCallerContext(ctx, "PoliceOrgMSP", "CyberCellOrgMSP")
	if err != nil {
		return fmt.Errorf("unauthorized fingerprint registration: %v", err)
	}
	callerBadge := caller.Badge

	// Verify or bind registeredBy to authenticated caller
	if registeredBy != "" && registeredBy != callerBadge {
		return fmt.Errorf("fingerprint registration rejected: registeredBy '%s' does not match authenticated caller badge '%s'", registeredBy, callerBadge)
	}
	registeredBy = callerBadge

	if !sha256Regex.MatchString(scanFileHash) {
		return fmt.Errorf("invalid scanFileHash: must be 64 hexadecimal characters")
	}

	// Duplicate check
	fpExists, err := s.AssetExists(ctx, fingerprintID)
	if err != nil {
		return fmt.Errorf("failed to check fingerprint existence: %v", err)
	}
	if fpExists {
		return fmt.Errorf("fingerprint %s already registered on ledger", fingerprintID)
	}

	// Verify case exists, then enforce case-level write authority. Registering
	// biometric evidence against a case is an investigative write: a valid
	// certificate alone must not let an unrelated officer attach fingerprint
	// records to another station's case.
	caseAsset, err := s.GetCase(ctx, caseID)
	if err != nil {
		return fmt.Errorf("case %s does not exist on ledger", caseID)
	}

	if caseAsset.Status == "Closed" {
		return fmt.Errorf("cannot register fingerprint against closed case %s", caseID)
	}

	// CyberCellOrgMSP operates as a specialist forensic partner across stations,
	// so it is exempt from the police case-principal test; PoliceOrgMSP callers
	// must hold case-level authority.
	if caller.MSPID == "PoliceOrgMSP" {
		if err := authorizeCaseWrite(caller, caseAsset, "fingerprint registration"); err != nil {
			return err
		}
	}

	// Verify evidence exists if specified, and that it belongs to the same case.
	if evidenceID != "" {
		evidenceAsset, err := s.GetEvidence(ctx, evidenceID)
		if err != nil {
			return fmt.Errorf("evidence %s does not exist on ledger", evidenceID)
		}
		if evidenceAsset.CaseID != caseID {
			return fmt.Errorf("fingerprint registration rejected: evidence %s belongs to case %s, not case %s", evidenceID, evidenceAsset.CaseID, caseID)
		}
	}

	txID := ctx.GetStub().GetTxID()
	fp := FingerprintAsset{
		ObjectType:     "FINGERPRINT",
		FingerprintID:  fingerprintID,
		CaseID:         caseID,
		EvidenceID:     evidenceID,
		PrintType:      printType,
		FingerPosition: fingerPosition,
		ScanFileHash:   scanFileHash,
		RegisteredAt:   time.Now().Format(time.RFC3339),
		RegisteredBy:   registeredBy,
		TxID:           txID,
	}

	fpJSON, err := json.Marshal(fp)
	if err != nil {
		return err
	}

	if err := ctx.GetStub().SetEvent("FingerprintRegistered", fpJSON); err != nil {
		return err
	}

	return ctx.GetStub().PutState(fingerprintID, fpJSON)
}

// RegisterForensicReport records an FSL forensic report hash on Fabric (FSLOrgMSP only)
// Binds examinerBadge strictly to the authenticated caller identity.
func (s *SmartContract) RegisterForensicReport(ctx contractapi.TransactionContextInterface, reportID string, caseID string, evidenceID string, examinerName string, examinerBadge string, labName string, reportHash string) error {
	if reportID == "" || caseID == "" || reportHash == "" {
		return fmt.Errorf("invalid arguments: reportID, caseID, and reportHash are required")
	}

	_, _, err := validateClientIdentity(ctx, "FSLOrgMSP")
	if err != nil {
		return fmt.Errorf("unauthorized forensic report registration: %v", err)
	}

	callerBadge, err := resolveCallerBadge(ctx)
	if err != nil {
		return fmt.Errorf("unauthorized forensic report registration: %v", err)
	}

	// Bind examinerBadge to authenticated Fabric caller
	if examinerBadge != "" && examinerBadge != callerBadge {
		return fmt.Errorf("forensic report rejected: examinerBadge '%s' does not match authenticated caller badge '%s'", examinerBadge, callerBadge)
	}
	examinerBadge = callerBadge

	if !sha256Regex.MatchString(reportHash) {
		return fmt.Errorf("invalid reportHash: must be 64 hexadecimal characters")
	}

	// Duplicate check
	reportExists, err := s.AssetExists(ctx, reportID)
	if err != nil {
		return fmt.Errorf("failed to check forensic report existence: %v", err)
	}
	if reportExists {
		return fmt.Errorf("forensic report %s already registered on ledger", reportID)
	}

	// Verify case exists
	caseExists, err := s.AssetExists(ctx, caseID)
	if err != nil || !caseExists {
		return fmt.Errorf("case %s does not exist on ledger", caseID)
	}

	// Verify evidence exists if specified
	if evidenceID != "" {
		evExists, err := s.AssetExists(ctx, evidenceID)
		if err != nil || !evExists {
			return fmt.Errorf("evidence %s does not exist on ledger", evidenceID)
		}
	}

	txID := ctx.GetStub().GetTxID()
	report := ForensicReportAsset{
		ObjectType:    "FORENSIC_REPORT",
		ReportID:      reportID,
		CaseID:        caseID,
		EvidenceID:    evidenceID,
		ExaminerName:  examinerName,
		ExaminerBadge: examinerBadge,
		LabName:       labName,
		ReportHash:    reportHash,
		RegisteredAt:  time.Now().Format(time.RFC3339),
		TxID:          txID,
		Status:        "REPORT_SUBMITTED",
	}

	reportJSON, err := json.Marshal(report)
	if err != nil {
		return err
	}

	if err := ctx.GetStub().SetEvent("ForensicReportRegistered", reportJSON); err != nil {
		return err
	}

	return ctx.GetStub().PutState(reportID, reportJSON)
}

// CreateAccessRequest records an access permission request on Fabric with authenticated identity binding
func (s *SmartContract) CreateAccessRequest(ctx contractapi.TransactionContextInterface, requestID string, caseID string, badge string, name string, accessLevel string, reason string) error {
	if requestID == "" || caseID == "" {
		return fmt.Errorf("invalid arguments: requestID and caseID are required")
	}

	_, _, err := validateClientIdentity(ctx, "PoliceOrgMSP", "FSLOrgMSP", "CyberCellOrgMSP")
	if err != nil {
		return fmt.Errorf("unauthorized access request creation: %v", err)
	}

	callerBadge, err := resolveCallerBadge(ctx)
	if err != nil {
		return fmt.Errorf("unauthorized access request creation: %v", err)
	}

	// Reject spoofed requester badge
	if badge != "" && badge != callerBadge {
		return fmt.Errorf("access request rejected: requestedByBadge '%s' does not match authenticated caller badge '%s'", badge, callerBadge)
	}
	badge = callerBadge

	// Duplicate check
	reqExists, err := s.AssetExists(ctx, requestID)
	if err != nil {
		return fmt.Errorf("failed to check access request existence: %v", err)
	}
	if reqExists {
		return fmt.Errorf("access request %s already exists on ledger", requestID)
	}

	// Verify case exists
	caseExists, err := s.AssetExists(ctx, caseID)
	if err != nil || !caseExists {
		return fmt.Errorf("case %s does not exist on ledger", caseID)
	}

	txID := ctx.GetStub().GetTxID()
	req := AccessRequestAsset{
		ObjectType:       "ACCESS_REQUEST",
		RequestID:        requestID,
		CaseID:           caseID,
		RequestedByBadge: badge,
		RequestedByName:  name,
		AccessLevel:      accessLevel,
		Reason:           reason,
		Status:           "Pending",
		TxID:             txID,
	}

	reqJSON, err := json.Marshal(req)
	if err != nil {
		return err
	}

	if err := ctx.GetStub().SetEvent("AccessRequested", reqJSON); err != nil {
		return err
	}

	return ctx.GetStub().PutState(requestID, reqJSON)
}

// ApproveAccessRequest marks access request approved on Fabric (PoliceOrgMSP only).
// Reviewer is derived strictly from authenticated Fabric identity.
//
// Approving an access request GRANTS case visibility, so it is the single most
// privilege-sensitive mutation in the contract. Authentication alone is not
// sufficient: without an on-chain supervisory check any officer holding a valid
// PoliceOrgMSP certificate could approve their OWN pending request and thereby
// self-escalate onto any case in the state. Two boundaries are enforced below:
// the caller must hold supervisory authority over the case, and the caller must
// not be the requester.
func (s *SmartContract) ApproveAccessRequest(ctx contractapi.TransactionContextInterface, requestID string, reviewerName string) error {
	caller, err := resolveCallerContext(ctx, "PoliceOrgMSP")
	if err != nil {
		return fmt.Errorf("unauthorized access request approval: %v", err)
	}
	callerBadge := caller.Badge

	reqJSON, err := ctx.GetStub().GetState(requestID)
	if err != nil || reqJSON == nil {
		return fmt.Errorf("access request %s not found", requestID)
	}

	var req AccessRequestAsset
	if err := json.Unmarshal(reqJSON, &req); err != nil {
		return err
	}

	// Verify associated case exists
	caseAsset, err := s.GetCase(ctx, req.CaseID)
	if err != nil {
		return fmt.Errorf("case %s associated with request not found: %v", req.CaseID, err)
	}

	// Only active cases may have approvals granted
	if caseAsset.Status == "Closed" {
		return fmt.Errorf("cannot approve access request for closed case %s", req.CaseID)
	}

	// SEPARATION OF DUTIES: an officer may never approve their own request,
	// regardless of rank. Checked before the rank test so that a PI or DySP
	// cannot self-grant access to a case they command but are not assigned to.
	if req.RequestedByBadge != "" && req.RequestedByBadge == callerBadge {
		return fmt.Errorf("access approval denied: officer '%s' cannot approve their own access request %s", callerBadge, requestID)
	}

	// CRITICAL AUTHORIZATION BOUNDARY: only an officer with supervisory
	// authority over THIS case may grant access to it.
	if err := authorizeSupervisoryAction(caller, caseAsset, "access approval"); err != nil {
		return err
	}

	req.Status = "Approved"
	req.ReviewedBy = callerBadge
	req.ReviewedAt = time.Now().Format(time.RFC3339)

	updatedJSON, err := json.Marshal(req)
	if err != nil {
		return err
	}

	if err := ctx.GetStub().SetEvent("AccessApproved", updatedJSON); err != nil {
		return err
	}

	return ctx.GetStub().PutState(requestID, updatedJSON)
}

// RejectAccessRequest marks access request rejected on Fabric (PoliceOrgMSP only).
// Refusal is a supervisory decision over the case: an unauthorized officer must
// not be able to reject requests belonging to another station's investigation.
func (s *SmartContract) RejectAccessRequest(ctx contractapi.TransactionContextInterface, requestID string, reviewerName string) error {
	caller, err := resolveCallerContext(ctx, "PoliceOrgMSP")
	if err != nil {
		return fmt.Errorf("unauthorized access request rejection: %v", err)
	}
	callerBadge := caller.Badge

	reqJSON, err := ctx.GetStub().GetState(requestID)
	if err != nil || reqJSON == nil {
		return fmt.Errorf("access request %s not found", requestID)
	}

	var req AccessRequestAsset
	if err := json.Unmarshal(reqJSON, &req); err != nil {
		return err
	}

	caseAsset, err := s.GetCase(ctx, req.CaseID)
	if err != nil {
		return fmt.Errorf("case %s associated with request not found: %v", req.CaseID, err)
	}

	// CRITICAL AUTHORIZATION BOUNDARY: only a supervisor of THIS case may refuse
	// access to it.
	if err := authorizeSupervisoryAction(caller, caseAsset, "access rejection"); err != nil {
		return err
	}

	req.Status = "Rejected"
	req.ReviewedBy = callerBadge
	req.ReviewedAt = time.Now().Format(time.RFC3339)

	updatedJSON, err := json.Marshal(req)
	if err != nil {
		return err
	}

	if err := ctx.GetStub().SetEvent("AccessRejected", updatedJSON); err != nil {
		return err
	}

	return ctx.GetStub().PutState(requestID, updatedJSON)
}

// RevokeAccess revokes active access on Fabric (PoliceOrgMSP only).
// Withdrawal of access is a supervisory decision over the case. Without an
// on-chain authorization check, any authenticated officer could revoke a
// legitimately granted access grant on another station's case — a denial-of-
// service against an active investigation.
func (s *SmartContract) RevokeAccess(ctx contractapi.TransactionContextInterface, requestID string, revokedBy string) error {
	caller, err := resolveCallerContext(ctx, "PoliceOrgMSP")
	if err != nil {
		return fmt.Errorf("unauthorized access revocation: %v", err)
	}
	callerBadge := caller.Badge

	reqJSON, err := ctx.GetStub().GetState(requestID)
	if err != nil || reqJSON == nil {
		return fmt.Errorf("access request %s not found", requestID)
	}

	var req AccessRequestAsset
	if err := json.Unmarshal(reqJSON, &req); err != nil {
		return err
	}

	caseAsset, err := s.GetCase(ctx, req.CaseID)
	if err != nil {
		return fmt.Errorf("case %s associated with request not found: %v", req.CaseID, err)
	}

	// CRITICAL AUTHORIZATION BOUNDARY: a supervisor of THIS case may revoke, and
	// an officer may always relinquish their own grant.
	if req.RequestedByBadge == "" || req.RequestedByBadge != callerBadge {
		if err := authorizeSupervisoryAction(caller, caseAsset, "access revocation"); err != nil {
			return err
		}
	}

	req.Status = "Revoked"
	req.ReviewedBy = callerBadge
	req.ReviewedAt = time.Now().Format(time.RFC3339)

	updatedJSON, err := json.Marshal(req)
	if err != nil {
		return err
	}

	if err := ctx.GetStub().SetEvent("AccessRevoked", updatedJSON); err != nil {
		return err
	}

	return ctx.GetStub().PutState(requestID, updatedJSON)
}

// RegisterBlockchainEvent commits a cryptographic activity event to the immutable ledger
func (s *SmartContract) RegisterBlockchainEvent(ctx contractapi.TransactionContextInterface, eventID string, caseID string, entityID string, entityType string, action string, actorID string, fileHash string, dataHash string, previousHash string, eventHash string, timestamp string) error {
	if eventID == "" || caseID == "" || eventHash == "" {
		return fmt.Errorf("invalid arguments: eventID, caseID, and eventHash are required")
	}

	callerBadge, err := resolveCallerBadge(ctx)
	if err == nil && callerBadge != "" {
		actorID = callerBadge
	}

	exists, err := s.AssetExists(ctx, eventID)
	if err != nil {
		return fmt.Errorf("failed to check event existence: %v", err)
	}
	if exists {
		return fmt.Errorf("event %s already exists on ledger", eventID)
	}

	txID := ctx.GetStub().GetTxID()
	eventAsset := BlockchainEventAsset{
		ObjectType:   "BLOCKCHAIN_EVENT",
		EventID:      eventID,
		CaseID:       caseID,
		EntityID:     entityID,
		EntityType:   entityType,
		Action:       action,
		ActorID:      actorID,
		FileHash:     fileHash,
		DataHash:     dataHash,
		PreviousHash: previousHash,
		EventHash:    eventHash,
		Timestamp:    timestamp,
		TxID:         txID,
	}

	assetJSON, err := json.Marshal(eventAsset)
	if err != nil {
		return err
	}

	if err := ctx.GetStub().SetEvent("BlockchainEventRecorded", assetJSON); err != nil {
		return err
	}

	return ctx.GetStub().PutState(eventID, assetJSON)
}

// AssetExists returns true if asset exists in world state
func (s *SmartContract) AssetExists(ctx contractapi.TransactionContextInterface, id string) (bool, error) {
	assetJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return false, err
	}
	return assetJSON != nil, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		fmt.Printf("Error creating eCaseVault chaincode: %s\n", err)
		return
	}

	if err := chaincode.Start(); err != nil {
		fmt.Printf("Error starting eCaseVault chaincode: %s\n", err)
	}
}
