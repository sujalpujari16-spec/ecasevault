/**
 * e-CASEVAULT Local LLM Engine
 * Phase 16 & Phase 17: Local Inference with Structured JSON Output
 * Invariant: STRICTLY ZERO EXTERNAL GENERATIVE-AI APIS.
 */

export interface StructuredLlmResponse {
  answer: string;
  claims: Array<{ text: string; sourceIds: string[] }>;
  relatedProvisionIds: string[];
  uncertainties: string[];
  needsClarification: boolean;
  answerType: 'LEGAL_EXPLANATION' | 'CASE_ANALYSIS' | 'CLARIFICATION' | 'PROCEDURAL';
  modelUsed: string;
  isLocal: boolean;
}

export class LocalLlmService {
  private static instance: LocalLlmService;
  private baseUrl: string;
  private modelName: string;

  private constructor() {
    this.baseUrl = process.env.LLM_BASE_URL || 'http://localhost:11434';
    this.modelName = process.env.LLM_MODEL || 'llama3.2';
  }

  public static getInstance(): LocalLlmService {
    if (!LocalLlmService.instance) {
      LocalLlmService.instance = new LocalLlmService();
    }
    return LocalLlmService.instance;
  }

  public async generateStructuredResponse(
    systemPrompt: string,
    userPrompt: string,
    fallbackContext?: {
      primaryProvision?: any;
      rankedProvisions?: any[];
      caseData?: any;
      queryAnalysis?: any;
    }
  ): Promise<StructuredLlmResponse> {
    // 1. Attempt Local Ollama Inference
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          format: 'json',
          stream: false,
          options: { temperature: 0.1 },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const rawContent = data.message?.content || '{}';
        const parsed = JSON.parse(rawContent);

        return {
          answer: parsed.answer || 'Analysis completed.',
          claims: Array.isArray(parsed.claims) ? parsed.claims : [],
          relatedProvisionIds: Array.isArray(parsed.relatedProvisionIds) ? parsed.relatedProvisionIds : [],
          uncertainties: Array.isArray(parsed.uncertainties) ? parsed.uncertainties : [],
          needsClarification: Boolean(parsed.needsClarification),
          answerType: parsed.answerType || 'LEGAL_EXPLANATION',
          modelUsed: `ollama:${this.modelName}`,
          isLocal: true,
        };
      }
    } catch {
      // Fallback to local deterministic synthesizer
    }

    // 2. High-Fidelity Local Deterministic Synthesizer (Instant & 100% Reliable Offline)
    return this.synthesizeDeterministicResponse(fallbackContext);
  }

  private synthesizeDeterministicResponse(fallback?: {
    primaryProvision?: any;
    rankedProvisions?: any[];
    caseData?: any;
    queryAnalysis?: any;
  }): StructuredLlmResponse {
    const primary = fallback?.primaryProvision || fallback?.rankedProvisions?.[0]?.provision;
    const ranked = fallback?.rankedProvisions || [];
    const caseData = fallback?.caseData;
    const analysis = fallback?.queryAnalysis;

    if (analysis?.intent === 'AMBIGUOUS' || analysis?.ambiguity) {
      return {
        answer: `### ⚖️ Clarification Required\n\nSection **${analysis.section}** exists in multiple Bharatiya statutes. Which Act do you mean?\n\n- **[BNS]** Bharatiya Nyaya Sanhita, 2023\n- **[BNSS]** Bharatiya Nagarik Suraksha Sanhita, 2023\n- **[BSA]** Bharatiya Sakshya Adhiniyam, 2023`,
        claims: [],
        relatedProvisionIds: [],
        uncertainties: ['Statutory Act not specified'],
        needsClarification: true,
        answerType: 'CLARIFICATION',
        modelUsed: 'e-casevault-local-engine:v2',
        isLocal: true,
      };
    }

    if (primary) {
      const act = primary.actCode;
      const sec = primary.sectionNumber;
      const title = primary.sectionTitle;
      const chapter = primary.chapter;
      const cleanText = primary.cleanText;

      const relatedIds = ranked
        .slice(1, 4)
        .map((r: any) => `${r.provision.actCode}_${r.provision.sectionNumber}`);

      const relatedBullets = ranked
        .slice(1, 4)
        .map((r: any) => `• **${r.provision.actCode} Section ${r.provision.sectionNumber}** — ${r.provision.sectionTitle}`)
        .join('\n');

      let caseSection = '';
      if (caseData) {
        caseSection = `\n\n### 📋 Case Application (${caseData.id || caseData.fir_number})\n• **Investigating Officer:** ${caseData.assigned_io || caseData.pi_in_charge || 'Designated IO'}\n• **Incident Location:** ${caseData.incident_location || 'Jurisdiction'}\n• **Investigative Alignment:** The factual allegations in the FIR warrant evaluation under ${act} Section ${sec}.\n• **Advisory Note:** *This analysis is an investigative decision aid and does not constitute a judicial finding of guilt.*`;
      }

      const answer = `### ⚖️ ${act} Section ${sec}: ${title}
**Chapter:** ${chapter}
**Statute:** Bharatiya Nyaya Sanhita, 2023 (Effective 1 July 2024)

#### Statutory Definition & Provisions
${cleanText}
${caseSection}

${relatedBullets ? `#### Related Statutory Provisions\n${relatedBullets}` : ''}`;

      return {
        answer,
        claims: [
          {
            text: `${act} Section ${sec} governs ${title.toLowerCase()}`,
            sourceIds: [`${act}_${sec}`],
          },
        ],
        relatedProvisionIds: relatedIds,
        uncertainties: [],
        needsClarification: false,
        answerType: caseData ? 'CASE_ANALYSIS' : 'LEGAL_EXPLANATION',
        modelUsed: 'e-casevault-local-engine:v2',
        isLocal: true,
      };
    }

    return {
      answer: '### ⚖️ Legal Query Processed\n\nNo specific matching provision was located. Please refine your query with a section number or legal concept.',
      claims: [],
      relatedProvisionIds: [],
      uncertainties: ['No matching statutory provision found'],
      needsClarification: false,
      answerType: 'LEGAL_EXPLANATION',
      modelUsed: 'e-casevault-local-engine:v2',
      isLocal: true,
    };
  }
}
