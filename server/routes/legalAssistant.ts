import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { requireLawAgentAccess } from '../middleware/lawAgentAuth';
import { AgentOrchestrator } from '../services/legalAgent/agent/agentOrchestrator';
import { HybridRetriever } from '../services/legalAgent/retrieval/hybridRetriever';
import { ProvisionService } from '../services/legalAgent/legal/provisionService';
import { AgentContext } from '../services/legalAgent/types';
import { LegalRagService } from '../services/legalRagService';

export const legalRouter = Router();
const orchestrator = AgentOrchestrator.getInstance();
const hybridRetriever = HybridRetriever.getInstance();
const provisionService = ProvisionService.getInstance();
const legacyRagService = LegalRagService.getInstance();

// Trigger background initialization
provisionService.initialize().catch((err) => {
  console.error('[legalRouter] Error during provisionService init:', err);
});

/**
 * POST /api/legal/query
 * Execute multi-stage hybrid retrieval (Exact section + Title + Keyword + Vector + Reranking)
 * Protected by strict POLICE-only RBAC
 */
legalRouter.post('/query', authenticateJwt, requireLawAgentAccess, async (req: Request, res: Response) => {
  try {
    const { query, actFilter, limit } = req.body;
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const validatedFilter = ['BNS', 'BNSS', 'BSA'].includes(actFilter) ? actFilter : undefined;
    const validatedLimit = Math.min(Math.max(1, Number(limit) || 5), 20);

    const results = await hybridRetriever.retrieve(query, validatedFilter, validatedLimit);

    // Format consistent with frontend expectations
    const topResult = results[0];
    res.json({
      query,
      filterApplied: validatedFilter || 'ALL_ACTS',
      totalResults: results.length,
      topMatch: topResult
        ? {
            act: topResult.act,
            section: topResult.section,
            title: topResult.title,
            score: topResult.finalScore,
            matchType: topResult.matchType,
          }
        : null,
      results: results.map((r) => ({
        act: r.act,
        sectionNumber: r.section,
        title: r.title,
        chapter: r.provision.chapter,
        text: r.provision.cleanText,
        score: r.finalScore,
        matchType: r.matchType,
        sha256: r.provision.contentHash,
      })),
    });
  } catch (error: any) {
    console.error('[legalRouter] Error executing query:', error);
    res.status(500).json({ error: 'Internal server error while executing legal query' });
  }
});

/**
 * POST /api/legal/chat
 * Multi-turn Private Legal Intelligence Agent
 * Invariants: POLICE only, Local inference, RBAC-guarded tools, Claim & Citation Validation
 */
legalRouter.post('/chat', authenticateJwt, requireLawAgentAccess, async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required for legal agent' });
    }

    const agentContext: AgentContext = {
      user: {
        userId: user.userId || user.badgeNo,
        badgeNo: user.badgeNo,
        role: user.role,
        station: user.station || 'General Station',
        station_id: user.station_id,
        username: user.username || user.badgeNo,
        name: user.name || user.username,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      externalAiAllowed: false,
    };

    const latestUserMsg = messages[messages.length - 1]?.content || '';
    const history = messages.slice(0, -1);

    const agentResult = await orchestrator.processQuery(latestUserMsg, history, agentContext);

    res.json({
      message: { role: 'assistant', content: agentResult.answer },
      primaryProvision: agentResult.primaryProvision,
      retrievedSections: agentResult.sources,
      citations: agentResult.sources.map((c) => c.title),
      relatedProvisions: agentResult.relatedProvisions,
      confidence: agentResult.confidence,
      toolsExecuted: ['query_analyzer', 'hybrid_retriever', 'local_llm', 'claim_validator', 'citation_validator'],
      executionTimeMs: agentResult.executionTimeMs,
      modelUsed: agentResult.modelUsed,
      externalApiUsed: false,
      validationStatus: agentResult.validationStatus,
      dataMinimizationReport: agentResult.dataMinimizationReport,
    });
  } catch (error: any) {
    console.error('[legalRouter] Error executing Private Legal Agent chat:', error);
    res.status(500).json({ error: 'Internal server error while executing legal reasoning' });
  }
});

/**
 * GET /api/legal/sections
 * List & search statutory sections across BNS, BNSS, BSA with pagination
 */
legalRouter.get('/sections', authenticateJwt, requireLawAgentAccess, async (req: Request, res: Response) => {
  try {
    await provisionService.initialize();
    const act = ['BNS', 'BNSS', 'BSA'].includes(String(req.query.act))
      ? (String(req.query.act) as 'BNS' | 'BNSS' | 'BSA')
      : undefined;
    const search = req.query.search ? String(req.query.search).toLowerCase() : '';
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '25'), 10)));

    let all = provisionService.getAllProvisions(act);

    if (search) {
      all = all.filter(
        (s) =>
          s.sectionNumber.toLowerCase().includes(search) ||
          s.sectionTitle.toLowerCase().includes(search) ||
          s.chapter.toLowerCase().includes(search) ||
          s.keywords.some((k) => k.toLowerCase().includes(search))
      );
    }

    const total = all.length;
    const startIdx = (page - 1) * limit;
    const paginated = all.slice(startIdx, startIdx + limit);

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      sections: paginated.map((p) => ({
        act: p.actCode,
        sectionNumber: p.sectionNumber,
        title: p.sectionTitle,
        chapter: p.chapter,
        text: p.cleanText,
        sha256: p.contentHash,
      })),
    });
  } catch (error: any) {
    console.error('[legalRouter] Error retrieving sections:', error);
    res.status(500).json({ error: 'Failed to retrieve statutory sections' });
  }
});

/**
 * GET /api/legal/sections/:act/:section
 * Fetch individual section by Act and Section Number
 */
legalRouter.get('/sections/:act/:section', authenticateJwt, requireLawAgentAccess, async (req: Request, res: Response) => {
  try {
    await provisionService.initialize();
    const act = String(req.params.act).toUpperCase() as 'BNS' | 'BNSS' | 'BSA';
    const sectionNum = String(req.params.section);

    if (!['BNS', 'BNSS', 'BSA'].includes(act)) {
      return res.status(400).json({ error: 'Invalid Act specified. Must be BNS, BNSS, or BSA.' });
    }

    const section = provisionService.getExactSection(act, sectionNum);
    if (!section) {
      return res.status(404).json({ error: `Section ${sectionNum} of ${act} not found.` });
    }

    res.json({
      act: section.actCode,
      sectionNumber: section.sectionNumber,
      title: section.sectionTitle,
      chapter: section.chapter,
      text: section.cleanText,
      sha256: section.contentHash,
      sourceDocument: section.sourceDocument,
      effectiveFrom: section.effectiveFrom,
    });
  } catch (error: any) {
    console.error('[legalRouter] Error retrieving section:', error);
    res.status(500).json({ error: 'Failed to retrieve section' });
  }
});

/**
 * GET /api/legal/cross-reference
 */
legalRouter.get('/cross-reference', authenticateJwt, requireLawAgentAccess, async (_req: Request, res: Response) => {
  try {
    const crossRefList = legacyRagService.getCrossReferenceTable();
    res.json({
      total: crossRefList.length,
      mappings: crossRefList,
    });
  } catch (error: any) {
    console.error('[legalRouter] Error getting cross references:', error);
    res.status(500).json({ error: 'Failed to retrieve cross-references' });
  }
});

/**
 * GET /api/legal/stats
 */
legalRouter.get('/stats', authenticateJwt, async (_req: Request, res: Response) => {
  try {
    await provisionService.initialize();
    const bns = provisionService.getAllProvisions('BNS');
    const bnss = provisionService.getAllProvisions('BNSS');
    const bsa = provisionService.getAllProvisions('BSA');

    res.json({
      status: 'ONLINE',
      knowledgeBase: 'e-CASEVAULT Sovereign Bharatiya Legal Corpus',
      effectiveDate: '2024-07-01',
      totalSections: bns.length + bnss.length + bsa.length,
      acts: {
        BNS: { count: bns.length, name: 'Bharatiya Nyaya Sanhita, 2023 (Substantive Criminal Law)' },
        BNSS: { count: bnss.length, name: 'Bharatiya Nagarik Suraksha Sanhita, 2023 (Criminal Procedure)' },
        BSA: { count: bsa.length, name: 'Bharatiya Sakshya Adhiniyam, 2023 (Law of Evidence)' },
      },
      tamperProtection: 'SHA-256 Digest Sealing on all statutory chunks',
      crossReferencesCount: legacyRagService.getCrossReferenceTable().length,
    });
  } catch (error: any) {
    console.error('[legalRouter] Error getting stats:', error);
    res.status(500).json({ error: 'Failed to retrieve legal stats' });
  }
});
