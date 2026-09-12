import React, { useState, useEffect, useRef } from 'react';
import { 
  Scale, 
  Search, 
  Sparkles, 
  Send, 
  RefreshCw, 
  Copy, 
  Check, 
  ShieldCheck, 
  FileText, 
  Layers, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  BookOpen
} from 'lucide-react';
import { apiClient } from '../services/apiClient';

interface LegalSection {
  id: string;
  act: 'BNS' | 'BNSS' | 'BSA';
  actFull: string;
  sectionNumber: string;
  title: string;
  chapter: string;
  text: string;
  sha256: string;
  keywords: string[];
  cognizable?: boolean;
  bailable?: boolean;
  punishment?: string;
  offenceType?: string;
  crossReference?: {
    legacyAct: string;
    legacySection: string;
    notes?: string;
  };
}

interface RetrievedChunk {
  section: LegalSection;
  relevanceScore: number;
  matchReason: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  retrievedSections?: RetrievedChunk[];
  citations?: string[];
  executionTimeMs?: number;
}

interface PoliceLawAssistantViewProps {
  initialQuery?: string;
  onApplyToCase?: (sections: string[], text: string) => void;
}

export const PoliceLawAssistantView: React.FC<PoliceLawAssistantViewProps> = ({ 
  initialQuery, 
  onApplyToCase 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('law_assistant_chat_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load chat history');
    }
    return [];
  });
  const [inputQuery, setInputQuery] = useState(initialQuery || '');
  const [loading, setLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryAct, setDirectoryAct] = useState<'ALL' | 'BNS' | 'BNSS' | 'BSA'>('ALL');
  const [directorySections, setDirectorySections] = useState<LegalSection[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('law_assistant_chat_history', JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to save chat history');
    }
  }, [messages]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load stats on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await apiClient.getLegalStats();
        setStats(data);
      } catch (err) {
        console.warn('Could not fetch legal stats:', err);
      }
    };
    fetchStats();
  }, []);

  // Handle initial query if provided from external view
  useEffect(() => {
    if (initialQuery && initialQuery.trim().length > 0 && messages.length === 0) {
      handleSendMessage(initialQuery);
    }
  }, [initialQuery]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputQuery(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  // Submit message
  const handleSendMessage = async (queryText?: string) => {
    const textToSend = (queryText || inputQuery).trim();
    if (!textToSend || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputQuery('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setLoading(true);

    try {
      // Call conversational RAG endpoint
      const payload = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await apiClient.chatLegalAssistant(payload);

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.message.content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        retrievedSections: response.retrievedSections,
        citations: response.citations,
        executionTimeMs: response.executionTimeMs,
      };

      setMessages([...newMessages, assistantMessage]);
    } catch (error: any) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Unable to complete legal synthesis:** ${error.message || 'Server error occurred'}. Please ensure the server is connected.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    setMessages([]);
    setInputQuery('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const toggleSourceDrawer = (msgId: string) => {
    setExpandedSources((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  // Load directory modal
  const openDirectory = async () => {
    setShowDirectoryModal(true);
    setDirectoryLoading(true);
    try {
      const act = directoryAct === 'ALL' ? undefined : directoryAct;
      const res = await apiClient.getLegalSections({ act, search: directorySearch, limit: 50 });
      setDirectorySections(res.sections || []);
    } catch (e) {
      console.error('Failed to load directory:', e);
    } finally {
      setDirectoryLoading(false);
    }
  };

  const filterDirectory = async (act: 'ALL' | 'BNS' | 'BNSS' | 'BSA', search: string) => {
    setDirectoryAct(act);
    setDirectorySearch(search);
    setDirectoryLoading(true);
    try {
      const actFilter = act === 'ALL' ? undefined : act;
      const res = await apiClient.getLegalSections({ act: actFilter, search, limit: 50 });
      setDirectorySections(res.sections || []);
    } catch (e) {
      console.error(e);
    } finally {
      setDirectoryLoading(false);
    }
  };

  // Render markdown-like elements cleanly in light mode
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inTable = false;
    let tableHeader: string[] = [];
    let tableRows: string[][] = [];

    const flushTable = (key: string) => {
      if (tableHeader.length > 0 || tableRows.length > 0) {
        elements.push(
          <div key={`table-${key}`} className="overflow-x-auto my-3 border border-slate-200 rounded-lg shadow-xs">
            <table className="w-full text-left text-xs border-collapse bg-white">
              <thead>
                <tr className="bg-slate-100 text-slate-900 border-b border-slate-200 font-semibold">
                  {tableHeader.map((h, i) => (
                    <th key={i} className="py-2.5 px-3 whitespace-nowrap">
                      {h.trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {tableRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                    {row.map((col, cIdx) => (
                      <td key={cIdx} className="py-2.5 px-3 align-top leading-relaxed">
                        {renderInlineFormatting(col.trim())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      inTable = false;
      tableHeader = [];
      tableRows = [];
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      // Table parsing
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const cells = trimmed
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());

        if (cells.every((c) => c.match(/^[:\s-]+$/))) {
          inTable = true;
          return;
        }

        if (!inTable) {
          inTable = true;
          tableHeader = cells;
        } else {
          tableRows.push(cells);
        }
        return;
      } else if (inTable) {
        flushTable(`line-${idx}`);
      }

      // Headers
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={idx} className="text-sm font-bold text-slate-900 mt-3.5 mb-1.5 flex items-center gap-2 border-b border-slate-200 pb-1">
            {trimmed.replace('### ', '')}
          </h3>
        );
        return;
      }
      if (trimmed.startsWith('#### ')) {
        elements.push(
          <h4 key={idx} className="text-xs font-semibold text-slate-800 mt-2.5 mb-1 flex items-center gap-1.5">
            {trimmed.replace('#### ', '')}
          </h4>
        );
        return;
      }

      // Divider
      if (trimmed === '---' || trimmed === '***') {
        elements.push(<hr key={idx} className="border-slate-200 my-2.5" />);
        return;
      }

      // Blockquotes
      if (trimmed.startsWith('> [!NOTE]')) {
        return;
      }
      if (trimmed.startsWith('> ')) {
        elements.push(
          <div key={idx} className="border-l-2 border-blue-600 bg-blue-50/70 px-3 py-1.5 rounded-r my-2 text-xs text-blue-900 leading-relaxed">
            {renderInlineFormatting(trimmed.replace('> ', ''))}
          </div>
        );
        return;
      }

      // Bullet points
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        const bulletText = trimmed.replace(/^(\*|-|•)\s+/, '');
        elements.push(
          <div key={idx} className="flex items-start gap-2 my-1 text-xs text-slate-700 leading-relaxed pl-1">
            <span className="text-blue-600 font-bold mt-0.5">•</span>
            <div>{renderInlineFormatting(bulletText)}</div>
          </div>
        );
        return;
      }

      // Numbered lists
      if (trimmed.match(/^\d+\.\s+/)) {
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          elements.push(
            <div key={idx} className="flex items-start gap-2 my-1.5 text-xs text-slate-700 leading-relaxed pl-1">
              <span className="bg-blue-100 text-blue-800 border border-blue-200 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                {numMatch[1]}
              </span>
              <div>{renderInlineFormatting(numMatch[2])}</div>
            </div>
          );
          return;
        }
      }

      // Blank line
      if (!trimmed) {
        elements.push(<div key={idx} className="h-1.5" />);
        return;
      }

      // Normal paragraph
      elements.push(
        <p key={idx} className="text-xs text-slate-700 leading-relaxed my-1">
          {renderInlineFormatting(trimmed)}
        </p>
      );
    });

    if (inTable) {
      flushTable('end');
    }

    return elements;
  };

  // Inline formatting helper
  const renderInlineFormatting = (text: string): React.ReactNode => {
    const parts = text.split(/(<br\s*\/?>|\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

    return parts.map((part, i) => {
      if (!part) return null;
      if (part === '<br>' || part === '<br/>' || part === '<br />') {
        return <br key={i} />;
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <em key={i} className="italic text-slate-600">
            {part.slice(1, -1)}
          </em>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="px-1.5 py-0.5 rounded bg-slate-100 text-blue-900 font-mono text-[11px] border border-slate-200">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] bg-white text-slate-800 relative overflow-hidden">
      {/* Clean Light Header Bar */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shadow-xs">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Private Legal Intelligence Agent
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                100% Local Inference
              </span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hidden sm:inline-block">
                Zero Cloud Transmission
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 flex items-center gap-2">
              <span>On-premise statutory synthesis grounded in Bharatiya Sanhitas (BNS • BNSS • BSA)</span>
              <span className="text-slate-300">•</span>
              <span className="text-emerald-600 font-medium">RBAC Case Tools Enabled</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {stats && (
            <div className="hidden lg:flex items-center gap-1.5 text-[11px] bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full text-slate-600 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{stats.totalSections} Codified Sections</span>
            </div>
          )}

          <button
            type="button"
            onClick={openDirectory}
            className="flex items-center gap-1.5 text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors shadow-2xs font-medium cursor-pointer"
            title="Browse all Sections"
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Statutory Directory</span>
          </button>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearChat}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              title="Start New Chat"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Conversation Stream */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6 bg-slate-50/40">
        {messages.length === 0 ? (
          /* Clean Simple Empty State with Governance Notice */
          <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-center p-6 select-none">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-3 text-blue-600 shadow-xs">
              <Scale className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              Private Legal Intelligence Agent
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-lg leading-relaxed">
              Air-gapped statutory reasoning engine operating without external generative APIs. Authorized officers can query codified BNS, BNSS, and BSA statutes or inspect authorized case dockets under strict RBAC jurisdiction.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 max-w-xl">
              {[
                'Requirements under BNSS Section 105 for videography',
                'Admissibility of CCTV electronic evidence under BSA Section 63',
                'Punishment and mob lynching provisions under BNS Section 103',
                'Analyze legal charges and procedural status for CASE-2026-00142',
              ].map((query, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleSendMessage(query)}
                  className="text-[11px] bg-white hover:bg-blue-50/70 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-800 px-3 py-1.5 rounded-lg transition-all text-left shadow-2xs cursor-pointer"
                >
                  {query}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 mt-6 text-[10px] text-slate-400 font-medium">
              <span className="flex items-center gap-1 text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Zero Cloud Transmission
              </span>
              <span>•</span>
              <span>Station Scoped Access</span>
              <span>•</span>
              <span>Blockchain Audit Anchored</span>
            </div>
          </div>
        ) : (
          /* Message Thread */
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="shrink-0 w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shadow-2xs mt-1">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                  </div>
                )}

                <div
                  className={`flex flex-col ${
                    msg.role === 'user'
                      ? 'items-end max-w-[85%]'
                      : 'items-start max-w-[92%] sm:max-w-[88%]'
                  }`}
                >
                  {/* Message Bubble */}
                  <div
                    className={`rounded-2xl px-4 py-3.5 text-xs shadow-2xs ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-sm font-medium'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm w-full'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    ) : (
                      <div className="space-y-1">{renderFormattedContent(msg.content)}</div>
                    )}
                  </div>

                  {/* Assistant Footer: Sources Drawer & Actions */}
                  {msg.role === 'assistant' && (
                    <div className="w-full mt-2 flex flex-col gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                        <div className="flex items-center gap-2">
                          {msg.retrievedSections && msg.retrievedSections.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleSourceDrawer(msg.id)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-blue-700 border border-slate-200 transition-colors font-semibold text-[11px] cursor-pointer"
                            >
                              <Layers className="w-3 h-3" />
                              <span>
                                {msg.retrievedSections.length} Source Chunks
                              </span>
                              {expandedSources[msg.id] ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          )}

                          {msg.executionTimeMs !== undefined && (
                            <span className="flex items-center gap-1 text-[10px] text-slate-400">
                              <Clock className="w-3 h-3" />
                              {msg.executionTimeMs}ms
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="inline-flex items-center gap-1 p-1 px-2 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                            title="Copy advisory"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-[10px] text-emerald-600 font-semibold">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span className="text-[10px]">Copy</span>
                              </>
                            )}
                          </button>

                          {onApplyToCase && msg.retrievedSections && msg.retrievedSections.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const sectionLabels = msg.retrievedSections!.map(
                                  (r) => `${r.section.act} Sec ${r.section.sectionNumber}`
                                );
                                onApplyToCase(sectionLabels, msg.content);
                              }}
                              className="inline-flex items-center gap-1 p-1 px-2 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors border border-blue-200 cursor-pointer font-medium"
                              title="Attach sections to current case"
                            >
                              <FileText className="w-3 h-3" />
                              <span className="text-[10px]">Apply to Case</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expandable Verified Statutory Chunks Accordion */}
                      {expandedSources[msg.id] && msg.retrievedSections && (
                        <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-xs">
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                            <span className="text-[11px] font-semibold text-slate-800 flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              Cryptographically Sealed Statutory Chunks
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              SHA-256 Verified
                            </span>
                          </div>

                          <div className="grid grid-cols-1 gap-2">
                            {msg.retrievedSections.map((r, sIdx) => (
                              <div
                                key={sIdx}
                                className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                        r.section.act === 'BNS'
                                          ? 'bg-blue-100 text-blue-800'
                                          : r.section.act === 'BNSS'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-purple-100 text-purple-800'
                                      }`}
                                    >
                                      {r.section.act} § {r.section.sectionNumber}
                                    </span>
                                    <span className="font-semibold text-slate-800">
                                      {r.section.title}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    Score: {(r.relevanceScore * 100).toFixed(0)}%
                                  </span>
                                </div>

                                <p className="text-slate-600 text-[11px] leading-relaxed line-clamp-3">
                                  {r.section.text}
                                </p>

                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-[10px] text-slate-400 font-mono">
                                  <span>SHA: {r.section.sha256.substring(0, 16)}...</span>
                                  {r.section.crossReference && (
                                    <span className="text-slate-600">
                                      Legacy: {r.section.crossReference.legacyAct} § {r.section.crossReference.legacySection}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Pulsing Loading Bubble */}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="shrink-0 w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shadow-2xs mt-1">
                  <Sparkles className="w-4 h-4 text-blue-600 animate-spin" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-3 shadow-2xs">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]" />
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]" />
                  </div>
                  <span className="text-xs text-slate-600 font-medium">
                    Searching statutory provisions & synthesizing guidance...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Clean White Bottom Search & Chat Input Bar */}
      <footer className="shrink-0 bg-white border-t border-slate-200 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-2 bg-white border border-slate-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 rounded-2xl p-2 shadow-sm transition-all">
            <textarea
              ref={textareaRef}
              value={inputQuery}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Search legal provisions, offences, procedural steps, or BNS sections... (Enter to send, Shift+Enter for newline)"
              rows={1}
              disabled={loading}
              className="flex-1 bg-transparent text-xs sm:text-sm text-slate-800 placeholder-slate-400 resize-none outline-none py-1.5 px-3 max-h-36 leading-relaxed"
            />

            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputQuery.trim() || loading}
              className="shrink-0 w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white disabled:text-slate-400 flex items-center justify-center transition-all shadow-xs disabled:shadow-none cursor-pointer"
              title="Send Query"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 px-2">
            <span>
              Codified statutory search • Grounded in BNS, BNSS, BSA & Indian Special Statutes
            </span>
            <span className="hidden sm:inline">
              Press <kbd className="px-1 py-0.5 bg-slate-100 rounded border border-slate-200 text-slate-600">Enter ↵</kbd> to send
            </span>
          </div>
        </div>
      </footer>

      {/* Statutory Directory Drawer Modal */}
      {showDirectoryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Statutory Directory (1,059 Codified Sections)
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Search and inspect Bharatiya Nyaya Sanhita, BNSS & BSA provisions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDirectoryModal(false)}
                className="text-slate-500 hover:text-slate-800 text-xs px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 cursor-pointer font-medium"
              >
                Close ✕
              </button>
            </div>

            {/* Filter controls */}
            <div className="px-6 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {(['ALL', 'BNS', 'BNSS', 'BSA'] as const).map((act) => (
                  <button
                    type="button"
                    key={act}
                    onClick={() => filterDirectory(act, directorySearch)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      directoryAct === act
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {act}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={directorySearch}
                  onChange={(e) => filterDirectory(directoryAct, e.target.value)}
                  placeholder="Search section number, title, keywords..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {/* Directory Section List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 divide-y divide-slate-100 bg-slate-50/50">
              {directoryLoading ? (
                <div className="py-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  Loading statutory sections...
                </div>
              ) : directorySections.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No statutory provisions found matching your filter.
                </div>
              ) : (
                directorySections.map((sec) => (
                  <div key={sec.id} className="pt-3 first:pt-0 space-y-1.5 bg-white p-3 rounded-xl border border-slate-200 mb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sec.act === 'BNS'
                              ? 'bg-blue-100 text-blue-800'
                              : sec.act === 'BNSS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {sec.act} § {sec.sectionNumber}
                        </span>
                        <h3 className="text-xs font-bold text-slate-900">
                          {sec.title}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDirectoryModal(false);
                          handleSendMessage(`Explain ${sec.act} Section ${sec.sectionNumber}: ${sec.title}`);
                        }}
                        className="text-[10px] bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 font-medium cursor-pointer"
                      >
                        Explain Section →
                      </button>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                      {sec.text}
                    </p>

                    <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span>Chapter: {sec.chapter}</span>
                      {sec.crossReference && (
                        <span className="text-blue-700 font-medium">
                          Corresponds to legacy: {sec.crossReference.legacyAct} § {sec.crossReference.legacySection}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
