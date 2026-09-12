/**
 * e-CASEVAULT MCP Legal Tools
 * Official Model Context Protocol (MCP) tool definitions and execution handlers
 * Grounded strictly in the GSMS-B Bharatiya Legal Corpus (BNS, BNSS, BSA) & Special Statutes.
 */

import { LegalRagService } from '../services/legalRagService';
import { LegalClassificationService } from '../services/legalClassificationService';
import { LegalOffenceService } from '../services/legalOffenceService';

export interface ApplicableProvisionTier {
  category: 'PRIMARY' | 'CONDITIONAL' | 'EXCLUDED_UNLESS_AGGRAVATED' | 'PROCEDURAL' | 'EVIDENTIARY';
  act: string;
  section: string;
  title: string;
  classification: string;
  punishment?: string;
  triggerCondition: string;
  notes: string;
}

export interface ApplicableProvisionsAnalysis {
  incidentType: string;
  primaryAct: string;
  executiveSummary: string;
  provisions: {
    primary: ApplicableProvisionTier[];
    conditional: ApplicableProvisionTier[];
    excludedUnlessAggravated: ApplicableProvisionTier[];
    procedural: ApplicableProvisionTier[];
    evidentiary: ApplicableProvisionTier[];
  };
  operationalChecklist: string[];
  evidentiaryChecklist: string[];
  disclaimer: string;
}

/**
 * Standard MCP Tool Definitions
 */
export const MCP_TOOL_DEFINITIONS = [
  {
    name: 'search_legal_sections',
    description: 'Searches verified Bharatiya criminal laws (BNS 2023, BNSS 2023, BSA 2023) and special Indian statutes (Motor Vehicles Act 1988, IT Act 2000, POCSO 2012, NI Act 1881) for relevant sections.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Legal search terms or incident description (e.g., "drunk driving alcohol breath analyzer", "cheating online fraud", "murder penalty").',
        },
        actFilter: {
          type: 'string',
          enum: ['BNS', 'BNSS', 'BSA', 'ALL'],
          description: 'Optional filter for specific legal code (BNS, BNSS, BSA, or ALL).',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of sections to retrieve (default: 5, max: 20).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_legal_section',
    description: 'Retrieves the complete authoritative text, chapter, cognizable/bailable classification, punishment, legacy code cross-reference (IPC/CrPC/IEA), and cryptographic SHA-256 seal for an exact section.',
    inputSchema: {
      type: 'object',
      properties: {
        act: {
          type: 'string',
          enum: ['BNS', 'BNSS', 'BSA', 'MV_ACT', 'IT_ACT', 'POCSO', 'NI_ACT'],
          description: 'The statutory act code.',
        },
        sectionNumber: {
          type: 'string',
          description: 'The exact section number (e.g., "103", "185", "281", "173", "63").',
        },
      },
      required: ['act', 'sectionNumber'],
    },
  },
  {
    name: 'get_section',
    description: 'Retrieves authoritative statutory text, classification, punishment, and SHA-256 seal for an exact section (alias of get_legal_section).',
    inputSchema: {
      type: 'object',
      properties: {
        act: {
          type: 'string',
          description: 'The statutory act code (e.g., "BNS", "BNSS", "BSA", "MV_ACT").',
        },
        sectionNumber: {
          type: 'string',
          description: 'The section number (e.g., "101", "103", "185").',
        },
      },
      required: ['act', 'sectionNumber'],
    },
  },
  {
    name: 'find_offence',
    description: 'Detects criminal offence entity from natural language and retrieves mapped primary, punishment, conditional, procedural, and evidentiary provisions along with critical negative exclusions.',
    inputSchema: {
      type: 'object',
      properties: {
        offenceName: {
          type: 'string',
          description: 'The name or description of the offence (e.g., "murder", "theft", "stalking", "drunk driving").',
        },
      },
      required: ['offenceName'],
    },
  },
  {
    name: 'get_primary_provisions',
    description: 'Retrieves the primary substantive criminal provisions (definition and core charge) mapped to an offence entity.',
    inputSchema: {
      type: 'object',
      properties: {
        offence: {
          type: 'string',
          description: 'The offence identifier or query (e.g., "murder", "theft", "assault").',
        },
      },
      required: ['offence'],
    },
  },
  {
    name: 'get_conditional_provisions',
    description: 'Retrieves conditional provisions mapped to an offence and evaluates whether statutory conditions are satisfied given incident facts.',
    inputSchema: {
      type: 'object',
      properties: {
        offence: {
          type: 'string',
          description: 'The offence identifier or query (e.g., "murder", "drunk driving").',
        },
        facts: {
          type: 'string',
          description: 'Optional incident facts to evaluate condition satisfaction.',
        },
      },
      required: ['offence'],
    },
  },
  {
    name: 'get_procedural_provisions',
    description: 'Retrieves mandatory police procedural mandates under BNSS 2023 for an offence (e.g., FIR registration under BNSS 173, audio-video recording under BNSS 105).',
    inputSchema: {
      type: 'object',
      properties: {
        offence: {
          type: 'string',
          description: 'The offence identifier or query (e.g., "murder", "drunk driving").',
        },
      },
      required: ['offence'],
    },
  },
  {
    name: 'get_classification',
    description: 'Retrieves authoritative procedural classification (cognizable, bailable, compoundable, triable_by, classification_source, punishment) sourced directly from BNSS 2023 First Schedule.',
    inputSchema: {
      type: 'object',
      properties: {
        act: {
          type: 'string',
          description: 'The statutory Act code (e.g. "BNS", "BNSS", "BSA", "MV_ACT").',
        },
        section: {
          type: 'string',
          description: 'The section number (e.g. "101", "103", "185").',
        },
      },
      required: ['act', 'section'],
    },
  },
  {
    name: 'find_applicable_provisions',
    description: 'Rigorously evaluates an incident scenario (e.g. drunk driving, road accident, cyber fraud) and classifies statutory provisions into explicit tiers: PRIMARY (direct substantive charge), CONDITIONAL (applicable only if specific facts exist), EXCLUDED_UNLESS_AGGRAVATED (must NOT be charged unless specific severe outcomes like death occurred), and PROCEDURAL.',
    inputSchema: {
      type: 'object',
      properties: {
        incidentDescription: {
          type: 'string',
          description: 'Detailed description of the incident facts (e.g., "Driver intercepted with 85 mg alcohol per 100 ml blood on highway").',
        },
        hasFatality: {
          type: 'boolean',
          description: 'Whether any human casualty or death occurred in the incident.',
        },
        hasInjury: {
          type: 'boolean',
          description: 'Whether bodily injury occurred.',
        },
        hasPropertyDamage: {
          type: 'boolean',
          description: 'Whether property damage or collision occurred.',
        },
      },
      required: ['incidentDescription'],
    },
  },
  {
    name: 'get_procedure',
    description: 'Returns mandatory Standard Operating Procedures (SOP) for police officers under BNSS 2023, BSA 2023, or special statutory procedural requirements (e.g., breathalyzer testing within 2 hours, mandatory audio-video recording).',
    inputSchema: {
      type: 'object',
      properties: {
        procedureType: {
          type: 'string',
          enum: ['DRUNK_DRIVING_SOP', 'ELECTRONIC_EVIDENCE_SEIZURE', 'ARREST_PROCEDURE', 'CRIME_SCENE_PANCHNAMA'],
          description: 'The type of police operational procedure required.',
        },
      },
      required: ['procedureType'],
    },
  },
  {
    name: 'verify_legal_version',
    description: 'Verifies the enactment version (post July 1, 2024 Bharatiya Sanhita vs legacy pre-2024 IPC/CrPC/IEA) and cryptographic SHA-256 seal of a legal provision.',
    inputSchema: {
      type: 'object',
      properties: {
        act: {
          type: 'string',
          description: 'The Act code (e.g. BNS, BNSS, BSA).',
        },
        sectionNumber: {
          type: 'string',
          description: 'The section number.',
        },
      },
      required: ['act', 'sectionNumber'],
    },
  },
];

/**
 * Gemini-compatible Function Declarations
 */
export const GEMINI_LEGAL_FUNCTION_DECLARATIONS = MCP_TOOL_DEFINITIONS.map((tool) => ({
  name: tool.name,
  description: tool.description,
  parameters: tool.inputSchema,
}));

/**
 * Legal MCP Tools Execution Engine
 */
export class LegalMcpTools {
  private static ragService: LegalRagService = LegalRagService.getInstance();

  public static async executeTool(toolName: string, args: Record<string, any>): Promise<any> {
    await this.ragService.initialize();

    switch (toolName) {
      case 'search_legal_sections':
        return this.searchLegalSections(args.query, args.actFilter, args.limit);

      case 'get_legal_section':
      case 'get_section':
        return this.getLegalSection(args.act, args.sectionNumber || args.section);

      case 'find_offence':
        return this.findOffence(args.offenceName || args.offence || args.query);

      case 'get_primary_provisions':
        return this.getPrimaryProvisions(args.offence);

      case 'get_conditional_provisions':
        return this.getConditionalProvisions(args.offence, args.facts);

      case 'get_procedural_provisions':
        return this.getProceduralProvisions(args.offence);

      case 'get_classification':
        return this.getClassification(args.act, args.section || args.sectionNumber);

      case 'find_applicable_provisions':
        return this.findApplicableProvisions(args.incidentDescription, {
          hasFatality: Boolean(args.hasFatality),
          hasInjury: Boolean(args.hasInjury),
          hasPropertyDamage: Boolean(args.hasPropertyDamage),
        });

      case 'get_procedure':
        return this.getProcedure(args.procedureType);

      case 'verify_legal_version':
        return this.verifyLegalVersion(args.act, args.sectionNumber || args.section);

      default:
        throw new Error(`Unknown MCP legal tool: "${toolName}"`);
    }
  }

  /**
   * Tool 1: search_legal_sections
   */
  public static async searchLegalSections(
    query: string,
    actFilter?: string,
    limit = 5
  ): Promise<{
    query: string;
    totalRetrieved: number;
    results: Array<{
      act: string;
      section: string;
      title: string;
      chapter: string;
      classification: string;
      punishment: string;
      relevance: number;
      sha256Digest: string;
      version: string;
    }>;
  }> {
    const validatedFilter = ['BNS', 'BNSS', 'BSA'].includes(actFilter || '') ? (actFilter as any) : undefined;
    const queryResult = await this.ragService.query(query, validatedFilter, limit);

    const results = queryResult.retrievedSections.map((r) => ({
      act: `${r.section.actFull} (${r.section.act})`,
      section: r.section.sectionNumber,
      title: r.section.title,
      chapter: r.section.chapter,
      classification: `${r.section.cognizable ? 'Cognizable' : 'Non-Cognizable'} | ${r.section.bailable ? 'Bailable' : 'Non-Bailable'}`,
      punishment: r.section.punishment || 'As prescribed by statute',
      relevance: Math.round(r.relevanceScore * 100) / 100,
      sha256Digest: r.section.sha256,
      version: 'In force from 01-07-2024 (Bharatiya Enactments)',
    }));

    return {
      query,
      totalRetrieved: results.length,
      results,
    };
  }

  /**
   * Tool 2: get_legal_section
   */
  public static async getLegalSection(
    act: string,
    sectionNumber: string
  ): Promise<{
    found: boolean;
    act: string;
    sectionNumber: string;
    title?: string;
    chapter?: string;
    text?: string;
    classification?: string;
    punishment?: string;
    legacyCrossReference?: any;
    sha256?: string;
    officialStatus?: string;
  }> {
    const cleanAct = act.toUpperCase();

    // Check Special Acts first
    if (cleanAct === 'MV_ACT' || cleanAct === 'MOTOR_VEHICLES_ACT') {
      if (sectionNumber === '185') {
        return {
          found: true,
          act: 'Motor Vehicles Act, 1988',
          sectionNumber: '185',
          title: 'Driving by a drunken person or by a person under the influence of drugs',
          chapter: 'Chapter XIII - Offences, Penalties and Procedure',
          text: 'Whoever, while driving, or attempting to drive, a motor vehicle has, in his blood, alcohol exceeding 30 mg. per 100 ml. of blood detected in a test by a breath analyser, or is under the influence of a drug to such an extent as to be incapable of exercising proper control over the vehicle, shall be punishable.',
          classification: 'Special Statute Offence (Cognizable arrest power under Section 202 MV Act)',
          punishment: 'First offence: Imprisonment up to 6 months, or fine up to ₹10,000, or both. Subsequent offence (within 3 years): Imprisonment up to 2 years, or fine up to ₹15,000, or both.',
          officialStatus: 'Active & In Force (As amended by Motor Vehicles Amendment Act, 2019)',
        };
      }
    }

    const sec = this.ragService.getSection(cleanAct as any, sectionNumber);
    if (!sec) {
      return {
        found: false,
        act: cleanAct,
        sectionNumber,
      };
    }

    return {
      found: true,
      act: sec.actFull,
      sectionNumber: sec.sectionNumber,
      title: sec.title,
      chapter: sec.chapter,
      text: sec.text,
      classification: `${sec.cognizable ? 'Cognizable' : 'Non-Cognizable'} | ${sec.bailable ? 'Bailable' : 'Non-Bailable'}`,
      punishment: sec.punishment,
      legacyCrossReference: sec.crossReference,
      sha256: sec.sha256,
      officialStatus: 'Official In-Force Statute (Effective 01 July 2024)',
    };
  }

  /**
   * Tool 3: find_applicable_provisions
   * Explicitly categorizes provisions into PRIMARY, CONDITIONAL, EXCLUDED, and PROCEDURAL.
   */
  public static async findApplicableProvisions(
    incidentDescription: string,
    options: { hasFatality?: boolean; hasInjury?: boolean; hasPropertyDamage?: boolean } = {}
  ): Promise<ApplicableProvisionsAnalysis> {
    const text = incidentDescription.toLowerCase();

    // Check if drunk driving scenario
    const isDrunkDriving =
      (/\b(drunk|drunken|drink|drinking|alcohol|liquor|intoxicated|dui|bac|breath\s*analys[eo]r)\b/i.test(text) &&
      /\b(driv\w*|hit|accident|pedestrian|car|vehicle|crash|road|traffic|scooter|bike)\b/i.test(text)) ||
      /\b(drunk\s*driv\w*|drink\s*and\s*drive)\b/i.test(text);

    if (isDrunkDriving) {
      const hasDeath = options.hasFatality || /\b(dead|death|died|fatal|killed|fatality)\b/i.test(text);
      const hasHurt = options.hasInjury || /\b(injur\w*|hurt|wound\w*|fractur\w*|hospital)\b/i.test(text);

      const primary: ApplicableProvisionTier[] = [
        {
          category: 'PRIMARY',
          act: 'Motor Vehicles Act, 1988',
          section: 'Section 185',
          title: 'Driving by a drunken person or by a person under the influence of drugs',
          classification: 'Special Statute Offence (Arrest without warrant under MV Act Sec 202)',
          punishment: '1st Offence: Imprisonment up to 6 months, or fine up to ₹10,000, or both. Subsequent offence: Imprisonment up to 2 years, or fine up to ₹15,000, or both.',
          triggerCondition: 'Blood Alcohol Content (BAC) exceeding 30 mg per 100 ml of blood detected via breath analyser or medical laboratory test.',
          notes: 'This is the mandatory and primary substantive charge for driving under the influence of alcohol.',
        },
      ];

      const conditional: ApplicableProvisionTier[] = [
        {
          category: 'CONDITIONAL',
          act: 'Bharatiya Nyaya Sanhita (BNS, 2023)',
          section: 'Section 281',
          title: 'Rash driving or riding on a public way',
          classification: 'Non-Cognizable (Cognizable with warrant) | Bailable',
          punishment: 'Imprisonment up to 6 months, or fine up to ₹1,000, or both.',
          triggerCondition: 'APPLIES ONLY IF the vehicle was driven rashly or negligently on a public way so as to endanger human life or personal safety.',
          notes: 'DO NOT charge BNS 281 solely for BAC > 30mg. There must be observable evidence of rash or dangerous vehicle navigation.',
        },
        {
          category: 'CONDITIONAL',
          act: 'Bharatiya Nyaya Sanhita (BNS, 2023)',
          section: 'Section 125',
          title: 'Act endangering life or personal safety of others',
          classification: 'Non-Cognizable | Bailable',
          punishment: 'Imprisonment up to 3 months, or fine up to ₹2,500, or both. If hurt caused: up to 6 months or fine up to ₹5,000.',
          triggerCondition: 'APPLIES ONLY IF the driver committed an overt rash or negligent act that actively jeopardized pedestrians or other road users.',
          notes: 'Invoked if specific bystanders or vehicles had to take evasive action to avoid injury.',
        },
      ];

      if (hasHurt) {
        conditional.push({
          category: 'CONDITIONAL',
          act: 'Bharatiya Nyaya Sanhita (BNS, 2023)',
          section: 'Section 115 / 117',
          title: 'Voluntarily causing hurt / Grievous hurt',
          classification: 'Cognizable | Bailable (Hurt) / Non-Bailable (Grievous Hurt)',
          punishment: 'Section 115: Up to 1 year or fine up to ₹10,000. Section 117: Up to 7 years and fine.',
          triggerCondition: 'Triggered because incident facts indicate physical bodily injury or fracture caused to a victim.',
          notes: 'Requires immediate Medico-Legal Certificate (MLC) from examining government hospital.',
        });
      }

      const excludedUnlessAggravated: ApplicableProvisionTier[] = [
        {
          category: 'EXCLUDED_UNLESS_AGGRAVATED',
          act: 'Bharatiya Nyaya Sanhita (BNS, 2023)',
          section: 'Section 106(1) & 106(2)',
          title: 'Causing death by negligence (and Failure to report / Hit-and-run)',
          classification: 'Cognizable | Non-Bailable',
          punishment: 'BNS 106(1): Imprisonment up to 5 years and fine. BNS 106(2) [Hit & Run]: Imprisonment up to 10 years and fine.',
          triggerCondition: hasDeath
            ? 'APPLICABLE: Fatality occurred as a direct result of the collision.'
            : 'STRICTLY NOT APPLICABLE unless human death resulted from the collision.',
          notes: hasDeath
            ? 'Apply Section 106(1) for negligent death, or Section 106(2) if the driver fled without reporting to police or doctor.'
            : 'OFFICER WARNING: Do NOT invoke BNS Section 106 for drunk driving where no person died. Charging BNS 106 without a casualty is a fatal defect in prosecution.',
        },
      ];

      const procedural: ApplicableProvisionTier[] = [
        {
          category: 'PROCEDURAL',
          act: 'Bharatiya Nagarik Suraksha Sanhita (BNSS, 2023)',
          section: 'Section 105',
          title: 'Recording of search and seizure through audio-video electronic means',
          classification: 'Mandatory Police Procedure',
          triggerCondition: 'Mandatory during breathalyzer testing, field sobriety check, and vehicle impounding/seizure.',
          notes: 'Investigation officer MUST conduct audio-video recording on mobile/bodycam and prepare contemporaneous panchnama.',
        },
        {
          category: 'PROCEDURAL',
          act: 'Motor Vehicles Act, 1988',
          section: 'Section 203 & Section 204',
          title: 'Breath tests and Laboratory examination of blood specimens',
          classification: 'Mandatory Medical Timeline',
          triggerCondition: 'Mandatory statutory protocol following positive breath test or driver refusal.',
          notes: 'Officer must escort suspect to registered medical practitioner for blood specimen collection WITHIN 2 HOURS of interception.',
        },
        {
          category: 'PROCEDURAL',
          act: 'Motor Vehicles Act, 1988',
          section: 'Section 202',
          title: 'Power to arrest without warrant in view of police officer',
          classification: 'Statutory Arrest Authorization',
          triggerCondition: 'Police officer in uniform may arrest driver without warrant if breathalyzer test reveals alcohol or is refused.',
          notes: 'Subject to BNSS Section 35 notice & arrest safeguards.',
        },
      ];

      const evidentiary: ApplicableProvisionTier[] = [
        {
          category: 'EVIDENTIARY',
          act: 'Bharatiya Sakshya Adhiniyam (BSA, 2023)',
          section: 'Section 63',
          title: 'Admissibility of electronic records and mandatory certificate',
          classification: 'Mandatory Evidence Rule',
          triggerCondition: 'Mandatory for breathalyzer printed digital receipt, bodycam video, and traffic intersection CCTV.',
          notes: 'Without a signed BSA Section 63 certificate, electronic breathalyzer printouts are inadmissible in court.',
        },
        {
          category: 'EVIDENTIARY',
          act: 'Bharatiya Sakshya Adhiniyam (BSA, 2023)',
          section: 'Section 39',
          title: 'Opinions of experts (Forensic Chemical & Medical Analysis)',
          classification: 'Expert Evidence Admissibility',
          triggerCondition: 'Signed chemical analysis report of blood alcohol level from Regional Forensic Science Laboratory (RFSL).',
          notes: 'Proves precise milligrams of alcohol per 100 ml of blood to satisfy Section 185 threshold.',
        },
      ];

      return {
        incidentType: 'Drunk Driving & Traffic Safety Incident',
        primaryAct: 'Motor Vehicles Act, 1988 (Sec 185) & Bharatiya Nyaya Sanhita, 2023',
        executiveSummary: hasDeath
          ? 'FATAL DRUNK DRIVING INCIDENT: Governed primarily by MV Act Section 185 and BNS Section 106 (Causing death by negligence). Mandatory BNSS 105 electronic recording and 2-hour medical blood analysis under MV Act 204.'
          : 'STANDARD DRUNK DRIVING ENFORCEMENT: The PRIMARY substantive charge is Motor Vehicles Act Section 185 (BAC > 30mg/100ml). BNS Section 281 and 125 are CONDITIONAL upon proof of rash driving. BNS Section 106 (Death by negligence) is NOT APPLICABLE as no casualty occurred.',
        provisions: {
          primary,
          conditional,
          excludedUnlessAggravated,
          procedural,
          evidentiary,
        },
        operationalChecklist: [
          'Subject driver immediately to calibrated breath analyser test under Section 203 of Motor Vehicles Act.',
          'Record digital printout showing exact BAC (must exceed 30 mg / 100 ml blood).',
          'Arrest driver without warrant under MV Act Section 202 if test is positive or refused.',
          'Escort driver to government hospital within 2 hours for mandatory blood draw under MV Act Section 204.',
          'Conduct vehicle seizure with mandatory audio-video electronic recording under BNSS Section 105.',
          'Issue notice under BNSS Section 35 and inform nominated relative/friend immediately.',
        ],
        evidentiaryChecklist: [
          'Affix signed Certificate under Bharatiya Sakshya Adhiniyam (BSA) Section 63 to the breathalyzer printout.',
          'Secure sealed blood sample preservation tube and dispatch to State Forensic Science Laboratory (FSL).',
          'Export and hash-chain intersection CCTV footage with BSA Section 63 certificate.',
          'Obtain preliminary Medico-Legal Examination Report from examining Medical Officer under BSA Section 39.',
        ],
        disclaimer: 'OFFICIAL POLICE REFERENCE ONLY: Advisory generated strictly from verified statutory enactments. All charges must be vetted by the Investigating Officer and the Public Prosecutor before filing the final Police Report (BNSS 193).',
      };
    }

    // Default semantic evaluation for general crimes
    const generalResult = await this.ragService.query(incidentDescription);
    const primary: ApplicableProvisionTier[] = generalResult.retrievedSections.slice(0, 2).map((r) => ({
      category: 'PRIMARY',
      act: r.section.actFull,
      section: `${r.section.act} Section ${r.section.sectionNumber}`,
      title: r.section.title,
      classification: `${r.section.cognizable ? 'Cognizable' : 'Non-Cognizable'} | ${r.section.bailable ? 'Bailable' : 'Non-Bailable'}`,
      punishment: r.section.punishment,
      triggerCondition: r.matchReason,
      notes: `Codified under ${r.section.chapter}.`,
    }));

    const conditional: ApplicableProvisionTier[] = generalResult.retrievedSections.slice(2, 4).map((r) => ({
      category: 'CONDITIONAL',
      act: r.section.actFull,
      section: `${r.section.act} Section ${r.section.sectionNumber}`,
      title: r.section.title,
      classification: `${r.section.cognizable ? 'Cognizable' : 'Non-Cognizable'} | ${r.section.bailable ? 'Bailable' : 'Non-Bailable'}`,
      punishment: r.section.punishment,
      triggerCondition: 'Applicable if secondary criminal elements or conspiracy are established.',
      notes: r.matchReason,
    }));

    return {
      incidentType: 'General Criminal Incident Analysis',
      primaryAct: 'Bharatiya Nyaya Sanhita, 2023',
      executiveSummary: generalResult.groundedAnalysis.summary,
      provisions: {
        primary,
        conditional,
        excludedUnlessAggravated: [],
        procedural: [
          {
            category: 'PROCEDURAL',
            act: 'Bharatiya Nagarik Suraksha Sanhita (BNSS, 2023)',
            section: 'Section 173',
            title: 'Information in cognizable cases (Registration of FIR)',
            classification: 'Mandatory FIR Procedure',
            triggerCondition: 'Mandatory upon receiving cognizable offence complaint.',
            notes: 'Follow BNSS 173(3) preliminary inquiry rules if punishment is 3 to 7 years.',
          },
          {
            category: 'PROCEDURAL',
            act: 'Bharatiya Nagarik Suraksha Sanhita (BNSS, 2023)',
            section: 'Section 105',
            title: 'Recording of search and seizure through audio-video electronic means',
            classification: 'Mandatory Video Protocol',
            triggerCondition: 'Mandatory during all search and seizure operations.',
            notes: 'Requires contemporaneous electronic panchnama without delay.',
          },
        ],
        evidentiary: [
          {
            category: 'EVIDENTIARY',
            act: 'Bharatiya Sakshya Adhiniyam (BSA, 2023)',
            section: 'Section 63',
            title: 'Admissibility of electronic records and mandatory certificate',
            classification: 'Mandatory Electronic Evidence Rule',
            triggerCondition: 'Required for any digital, CCTV, CDR, or computer output.',
            notes: 'Must accompany charge sheet in court.',
          },
        ],
      },
      operationalChecklist: generalResult.groundedAnalysis.investigationChecklist,
      evidentiaryChecklist: generalResult.groundedAnalysis.evidenceAdmissibilityChecklist,
      disclaimer: generalResult.groundedAnalysis.disclaimer,
    };
  }

  /**
   * Tool 4: get_procedure
   */
  public static async getProcedure(procedureType: string): Promise<{
    procedureType: string;
    governingStatute: string;
    steps: Array<{ stepNumber: number; action: string; statutoryMandate: string; evidenceOutput: string }>;
  }> {
    if (procedureType === 'DRUNK_DRIVING_SOP') {
      return {
        procedureType: 'DRUNK_DRIVING_SOP',
        governingStatute: 'Motor Vehicles Act 1988 (Sec 185, 202, 203, 204), BNSS 2023 (Sec 35, 105), BSA 2023 (Sec 63)',
        steps: [
          {
            stepNumber: 1,
            action: 'Interception & Electronic Breathalyzer Test',
            statutoryMandate: 'Section 203, Motor Vehicles Act 1988',
            evidenceOutput: 'Digital printout from calibrated breath analyser indicating BAC in mg/100ml.',
          },
          {
            stepNumber: 2,
            action: 'Audio-Video Electronic Recording of Inspection & Seizure',
            statutoryMandate: 'Section 105, Bharatiya Nagarik Suraksha Sanhita 2023',
            evidenceOutput: 'Tamper-evident video recording of breath test and vehicle impoundment.',
          },
          {
            stepNumber: 3,
            action: 'Statutory Arrest without Warrant',
            statutoryMandate: 'Section 202, Motor Vehicles Act 1988 & BNSS Section 35',
            evidenceOutput: 'Arrest memo with time, grounds, and formal intimation to designated relative.',
          },
          {
            stepNumber: 4,
            action: 'Mandatory Medical Examination within 2 Hours',
            statutoryMandate: 'Section 204, Motor Vehicles Act 1988',
            evidenceOutput: 'Sealed blood sample vial with Chain of Custody label dispatched to FSL.',
          },
          {
            stepNumber: 5,
            action: 'Execution of Electronic Certificate',
            statutoryMandate: 'Section 63, Bharatiya Sakshya Adhiniyam 2023',
            evidenceOutput: 'Signed BSA Section 63 certificate authenticating breathalyzer slip & bodycam video.',
          },
        ],
      };
    }

    return {
      procedureType: 'ELECTRONIC_EVIDENCE_SEIZURE',
      governingStatute: 'BNSS Section 105 & BSA Section 63',
      steps: [
        {
          stepNumber: 1,
          action: 'Continuous Video Recording of Seizure',
          statutoryMandate: 'BNSS Section 105',
          evidenceOutput: 'Uncut video file showing device discovery and recovery.',
        },
        {
          stepNumber: 2,
          action: 'Static Shielding / Faraday Isolation',
          statutoryMandate: 'Forensic Evidence Standard (FSL Protocol)',
          evidenceOutput: 'Device placed in anti-static Faraday pouch to prevent remote wipe.',
        },
        {
          stepNumber: 3,
          action: 'Cryptographic Hashing (SHA-256)',
          statutoryMandate: 'BSA Section 63',
          evidenceOutput: 'Calculated SHA-256 hash written onto physical panchnama and digital log.',
        },
        {
          stepNumber: 4,
          action: 'Certificate Generation under BSA 63',
          statutoryMandate: 'BSA Section 63(4)',
          evidenceOutput: 'Formally signed Certificate by Officer and technical custodian.',
        },
      ],
    };
  }

  /**
   * Tool 5: verify_legal_version
   */
  public static async verifyLegalVersion(
    act: string,
    sectionNumber: string
  ): Promise<{
    act: string;
    sectionNumber: string;
    currentCode: boolean;
    effectiveDate: string;
    supersedes: string;
    sha256Digest?: string;
  }> {
    const cleanAct = act.toUpperCase();
    const isBharatiya = ['BNS', 'BNSS', 'BSA'].includes(cleanAct);

    const supersedesMap: Record<string, string> = {
      BNS: 'Indian Penal Code, 1860 (IPC)',
      BNSS: 'Code of Criminal Procedure, 1973 (CrPC)',
      BSA: 'Indian Evidence Act, 1872 (IEA)',
    };

    const sec = this.ragService.getSection(cleanAct as any, sectionNumber);

    return {
      act: cleanAct,
      sectionNumber,
      currentCode: isBharatiya || cleanAct === 'MV_ACT',
      effectiveDate: isBharatiya ? '01 July 2024' : 'As in force',
      supersedes: supersedesMap[cleanAct] || 'Legacy Enactments',
      sha256Digest: sec?.sha256,
    };
  }

  /**
   * Tool 6: find_offence
   */
  public static async findOffence(offenceName: string): Promise<any> {
    const offService = LegalOffenceService.getInstance();
    offService.initialize();
    const detected = offService.detectOffence(offenceName);
    if (!detected) {
      return {
        found: false,
        query: offenceName,
        message: `No criminal offence entity found matching "${offenceName}".`,
      };
    }
    const advisory = offService.getStructuredOffenceAdvisory(detected, offenceName);
    return {
      found: true,
      offence_id: detected.offence_id,
      canonical_name: detected.canonical_name,
      aliases: detected.aliases,
      primary: advisory.primaryProvisions,
      punishment: advisory.punishmentProvisions,
      conditional: advisory.conditionalProvisions,
      procedural: advisory.proceduralProvisions,
      evidentiary: advisory.evidentiaryProvisions,
      exclusions: advisory.negativeExclusions,
      summary: advisory.summary,
    };
  }

  /**
   * Tool 7: get_primary_provisions
   */
  public static async getPrimaryProvisions(offence: string): Promise<any> {
    const offService = LegalOffenceService.getInstance();
    offService.initialize();
    const detected = offService.detectOffence(offence);
    if (!detected) {
      return { found: false, offence, primary: [] };
    }
    const advisory = offService.getStructuredOffenceAdvisory(detected, offence);
    return {
      found: true,
      offence: detected.canonical_name,
      primaryProvisions: advisory.primaryProvisions,
    };
  }

  /**
   * Tool 8: get_conditional_provisions
   */
  public static async getConditionalProvisions(offence: string, facts?: string): Promise<any> {
    const offService = LegalOffenceService.getInstance();
    offService.initialize();
    const detected = offService.detectOffence(offence);
    if (!detected) {
      return { found: false, offence, conditional: [] };
    }
    const advisory = offService.getStructuredOffenceAdvisory(detected, facts || offence);
    return {
      found: true,
      offence: detected.canonical_name,
      conditionalProvisions: advisory.conditionalProvisions,
    };
  }

  /**
   * Tool 9: get_procedural_provisions
   */
  public static async getProceduralProvisions(offence: string): Promise<any> {
    const offService = LegalOffenceService.getInstance();
    offService.initialize();
    const detected = offService.detectOffence(offence);
    if (!detected) {
      return { found: false, offence, procedural: [] };
    }
    const advisory = offService.getStructuredOffenceAdvisory(detected, offence);
    return {
      found: true,
      offence: detected.canonical_name,
      proceduralProvisions: advisory.proceduralProvisions,
    };
  }

  /**
   * Tool 10: get_classification
   */
  public static async getClassification(act: string, section: string): Promise<any> {
    const classService = LegalClassificationService.getInstance();
    classService.initialize();
    return classService.getClassification(act, section);
  }
}
