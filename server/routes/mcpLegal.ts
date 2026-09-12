/**
 * e-CASEVAULT MCP Legal Server Route
 * Exposes Model Context Protocol (MCP) endpoints for external AI agents, Gemini function calling,
 * and remote MCP clients to query the verified Bharatiya legal knowledge base.
 */

import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { LegalMcpTools, MCP_TOOL_DEFINITIONS } from '../mcp/legalMcpTools';

export const mcpLegalRouter = Router();

/**
 * GET /api/mcp/legal/health
 */
mcpLegalRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    serverName: 'e-casevault-legal-mcp',
    version: '2.0.0',
    protocolVersion: '2024-11-05',
    availableTools: MCP_TOOL_DEFINITIONS.map((t) => t.name),
  });
});

/**
 * GET /api/mcp/legal/tools
 * Lists all available MCP tools and their JSON schemas
 */
mcpLegalRouter.get('/tools', authenticateJwt, (_req: Request, res: Response) => {
  res.json({
    tools: MCP_TOOL_DEFINITIONS,
  });
});

/**
 * POST /api/mcp/legal/execute
 * Direct tool execution endpoint
 */
mcpLegalRouter.post('/execute', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const { name, arguments: args } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Tool "name" is required' });
    }

    const result = await LegalMcpTools.executeTool(name, args || {});
    res.json({
      tool: name,
      result,
    });
  } catch (error: any) {
    console.error(`[mcpLegalRouter] Error executing tool "${req.body?.name}":`, error);
    res.status(500).json({ error: error.message || 'Internal tool execution error' });
  }
});

/**
 * POST /api/mcp/legal
 * JSON-RPC 2.0 compliant MCP endpoint
 */
mcpLegalRouter.post('/', async (req: Request, res: Response) => {
  const { jsonrpc, id, method, params } = req.body;

  if (jsonrpc !== '2.0') {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: id || null,
      error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' },
    });
  }

  try {
    switch (method) {
      case 'initialize':
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {
                listChanged: false,
              },
            },
            serverInfo: {
              name: 'e-casevault-legal-mcp',
              version: '2.0.0',
            },
          },
        });

      case 'notifications/initialized':
        return res.status(204).send();

      case 'tools/list':
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            tools: MCP_TOOL_DEFINITIONS,
          },
        });

      case 'tools/call': {
        const { name, arguments: toolArgs } = params || {};
        if (!name) {
          return res.status(400).json({
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: 'Invalid params: tool "name" is required' },
          });
        }

        const toolResult = await LegalMcpTools.executeTool(name, toolArgs || {});
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(toolResult, null, 2),
              },
            ],
          },
        });
      }

      default:
        return res.status(404).json({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method "${method}" not found` },
        });
    }
  } catch (error: any) {
    console.error(`[mcpLegalRouter] JSON-RPC error for method "${method}":`, error);
    return res.status(500).json({
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: error.message || 'Internal error' },
    });
  }
});
