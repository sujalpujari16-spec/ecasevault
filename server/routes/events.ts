import express, { Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';

export const eventsRouter = express.Router();

interface SSEClient {
  id: string;
  res: Response;
  badgeNo?: string;
  role?: string;
}

const clients = new Map<string, SSEClient>();

/**
 * GET /api/events/stream
 * Server-Sent Events stream for real-time multi-device sync
 */
eventsRouter.get('/stream', (req: Request, res: Response): void => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for Nginx/reverse proxies
  res.flushHeaders();

  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const badgeNo = (req.query.badge as string) || undefined;
  const role = (req.query.role as string) || undefined;

  const client: SSEClient = { id: clientId, res, badgeNo, role };
  clients.set(clientId, client);

  // Send initial handshake event
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, timestamp: new Date().toISOString() })}\n\n`);

  // Keep-alive heartbeat every 20 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeat);
      clients.delete(clientId);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
  });
});

/**
 * Broadcast an event payload to all connected SSE clients
 */
export function broadcastEvent(eventName: string, data: any): void {
  const payload = JSON.stringify({
    event: eventName,
    data,
    timestamp: new Date().toISOString()
  });

  for (const [id, client] of clients.entries()) {
    try {
      client.res.write(`event: ${eventName}\ndata: ${payload}\n\n`);
    } catch (err) {
      clients.delete(id);
    }
  }
}

/**
 * Helper to emit case mutation events
 */
export function emitCaseEvent(eventType: 'CASE_CREATED' | 'CASE_UPDATED' | 'IO_REASSIGNED' | 'DOCUMENT_UPLOADED' | 'EVIDENCE_ADDED', data: any): void {
  broadcastEvent('case_update', { eventType, ...data });
}
