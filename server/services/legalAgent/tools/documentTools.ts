/**
 * e-CASEVAULT Document Tools
 * Phase 14 & Phase 28: Controlled Document Excerpt Tool with Data Minimization
 */

import { AgentUser, ToolExecutionResult } from '../types';
import { AgentPermissions } from '../permissions';
import { documentRepoService } from '../../documentRepoService';

export async function executeGetDocumentExcerpt(
  caseId: string,
  documentId: string,
  user: AgentUser,
  maxChars: number = 1500
): Promise<ToolExecutionResult> {
  const auth = await AgentPermissions.canAccessCase(caseId, user);
  if (!auth.allowed) {
    return {
      toolName: 'get_document_excerpt',
      isAuthorized: false,
      status: 'DENIED',
      error: auth.reason || 'Unauthorized case access.',
    };
  }

  const doc = documentRepoService.getDocumentById(documentId);
  if (!doc) {
    return {
      toolName: 'get_document_excerpt',
      isAuthorized: true,
      status: 'SUCCESS',
      data: { error: `Document ${documentId} not found.` },
    };
  }

  // Retrieve decrypted text or metadata excerpt
  let text = '';
  try {
    const dec = await documentRepoService.getDecryptedDocumentBuffer(documentId);
    text = dec.buffer.toString('utf8', 0, maxChars);
  } catch {
    text = `[Document Metadata Only] ${doc.title} (${doc.documentType}) - Hash: ${doc.sha256Hash}`;
  }

  // Data Minimization: Redact sensitive numbers (Aadhaar, Phone)
  const sanitized = text
    .replace(/(?:\+91[\-\s]?)?[6789]\d{9}/g, '[PHONE REDACTED]')
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '[AADHAAR REDACTED]');

  return {
    toolName: 'get_document_excerpt',
    isAuthorized: true,
    status: 'SUCCESS',
    data: {
      documentId: doc.id,
      title: doc.title,
      category: doc.documentType,
      excerpt: sanitized.substring(0, maxChars),
      sha256Hash: doc.sha256Hash,
      version: doc.version,
    },
    dataMinimizationApplied: true,
  };
}
