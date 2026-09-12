/**
 * e-CASEVAULT Conversation Context Manager
 * Phase 29: Multi-Turn Conversation State Tracking
 */

export interface ConversationState {
  currentAct: 'BNS' | 'BNSS' | 'BSA' | null;
  currentSection: string | null;
  currentCaseId: string | null;
  currentTopic: string | null;
  language: 'en' | 'mr';
  lastUpdated: number;
}

export class ConversationContextManager {
  private static instance: ConversationContextManager;
  private states = new Map<string, ConversationState>(); // Key: sessionId or badgeNo

  public static getInstance(): ConversationContextManager {
    if (!ConversationContextManager.instance) {
      ConversationContextManager.instance = new ConversationContextManager();
    }
    return ConversationContextManager.instance;
  }

  public getState(sessionKey: string): ConversationState {
    const state = this.states.get(sessionKey);
    if (!state) {
      const initial: ConversationState = {
        currentAct: null,
        currentSection: null,
        currentCaseId: null,
        currentTopic: null,
        language: 'en',
        lastUpdated: Date.now(),
      };
      this.states.set(sessionKey, initial);
      return initial;
    }
    return state;
  }

  public updateState(sessionKey: string, updates: Partial<ConversationState>): void {
    const current = this.getState(sessionKey);
    this.states.set(sessionKey, {
      ...current,
      ...updates,
      lastUpdated: Date.now(),
    });
  }

  /**
   * Resolves follow-up query pronouns or ellipsis using existing conversation state
   */
  public enrichFollowUpQuery(sessionKey: string, rawQuery: string): string {
    const state = this.getState(sessionKey);
    const q = rawQuery.toLowerCase().trim();

    // Check if user is asking for punishment, procedure, or bail without repeating section
    if (state.currentAct && state.currentSection) {
      if (/^(what\s*is\s*)?the\s*punishment\??$/i.test(q) || /^punishment\??$/i.test(q)) {
        return `punishment for ${state.currentAct} Section ${state.currentSection}`;
      }
      if (/^is\s*it\s*bailable\??$/i.test(q) || /^bailable\??$/i.test(q)) {
        return `is ${state.currentAct} Section ${state.currentSection} bailable`;
      }
      if (/^is\s*it\s*cognizable\??$/i.test(q) || /^cognizable\??$/i.test(q)) {
        return `is ${state.currentAct} Section ${state.currentSection} cognizable`;
      }
    }

    return rawQuery;
  }
}
