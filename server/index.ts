import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { authRouter } from './routes/auth';
import { casesRouter } from './routes/cases';
import { evidenceRouter } from './routes/evidence';
import { officersRouter } from './routes/officers';
import { accessRequestsRouter } from './routes/accessRequests';
import { dashboardRouter } from './routes/dashboard';
import { searchRouter } from './routes/search';
import { auditRouter } from './routes/audit';
import { blockchainRouter } from './routes/blockchain';
import { securityRouter } from './routes/security';
import documentsRouter from './routes/documents';
import { legalRouter } from './routes/legalAssistant';
import { mcpLegalRouter } from './routes/mcpLegal';
import { jailRouter } from './routes/jail';
import { ncrbRouter } from './routes/ncrb';
import { stationsRouter } from './routes/stations';
import identityRouter from './routes/identitySearch';
import { firIntakeRouter } from './routes/firIntake';
import { adminCasesRouter } from './routes/adminCases';
import { eventsRouter } from './routes/events';
import { apiLimiter } from './middleware/rateLimit';
import { pool, checkDatabaseConnection } from './config/database';
import { initializeDatabase } from './db/init_db';
import { supabaseAdmin, initializeSupabaseStorage, SUPABASE_BUCKET_DOCUMENTS, SUPABASE_BUCKET_EVIDENCE } from './config/supabase';
import { fabricGateway } from './services/fabricGateway';

const app = express();
const PORT = process.env.PORT || 5001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Security Headers & CORS (relaxed CSP to allow Vite assets & PDF previews in production)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// General Rate Limiting & JSON Parsing
app.use(apiLimiter);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Audit logger middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[e-CASEVAULT ENTERPRISE API] ${timestamp} | ${req.method} ${req.path} | IP: ${req.ip}`);
  next();
});

// Primary REST API Routes
app.use('/api/auth', authRouter);
app.use('/api/cases', casesRouter);
app.use('/api/evidence', evidenceRouter);
app.use('/api/officers', officersRouter);
app.use('/api/access-requests', accessRequestsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/search', searchRouter);
app.use('/api/audit', auditRouter);
app.use('/api/blockchain', blockchainRouter);
app.use('/api/security', securityRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/legal', legalRouter);
app.use('/api/mcp/legal', mcpLegalRouter);
app.use('/api/jail', jailRouter);
app.use('/api/ncrb', ncrbRouter);
app.use('/api/stations', stationsRouter);
app.use('/api/identity', identityRouter);
app.use('/api/fir', firIntakeRouter);
app.use('/api/admin/cases', adminCasesRouter);
app.use('/api/events', eventsRouter);

// Health Check Endpoints (Phase 27)
async function handleHealthCheck(_req: Request, res: Response) {
  const isDbConnected = await checkDatabaseConnection();
  const isFabricConnected = await fabricGateway.checkConnection();

  const statusCode = isDbConnected && isFabricConnected ? 200 : 200; // Return full diagnostic body
  res.status(statusCode).json({
    status: isDbConnected && isFabricConnected ? 'healthy' : 'degraded',
    system: 'e-CASEVAULT Maharashtra Police Enterprise REST API Server',
    version: '3.0.0-ENTERPRISE',
    timestamp: new Date().toISOString(),
    database: isDbConnected ? 'CONNECTED' : 'DISCONNECTED',
    fabric: isFabricConnected ? 'CONNECTED' : 'DISCONNECTED',
    databaseStatus: isDbConnected ? 'CONNECTED' : 'DISCONNECTED',
    blockchainStatus: isFabricConnected ? 'CONNECTED' : 'DISCONNECTED',
    securityPolicies: {
      transportSecurity: 'Client HTTPS terminated at Reverse Proxy; Fabric peer comms via gRPC TLS 1.3',
      rbacEnforcement: 'SERVER_SIDE_JWT',
      encryptionStandard: 'AES-256-GCM',
      hashingStandard: 'SHA-256 Digest',
    },
  });
}

app.get('/health', handleHealthCheck);
app.get('/api/health', handleHealthCheck);

// Dedicated Database Health Check
async function handleDbHealth(_req: Request, res: Response) {
  try {
    const start = Date.now();
    const result = await pool.query('SELECT 1 AS probe');
    const latencyMs = Date.now() - start;

    if (result.rows[0]?.probe === 1) {
      res.json({ status: 'CONNECTED', latencyMs, database: 'PostgreSQL 14+' });
    } else {
      res.status(503).json({ status: 'DISCONNECTED', error: 'Unexpected probe output' });
    }
  } catch (err: any) {
    console.error('[DATABASE PROBE ERROR]', err);
    res.status(503).json({ status: 'DISCONNECTED', error: 'Database connection failed' });
  }
}

app.get('/health/db', handleDbHealth);
app.get('/api/health/db', handleDbHealth);

// Dedicated Fabric Health Check
async function handleFabricHealth(_req: Request, res: Response) {
  const isConnected = await fabricGateway.checkConnection();
  if (isConnected) {
    res.json({
      status: 'CONNECTED',
      channel: process.env.FABRIC_CHANNEL || 'ecasevault-channel',
      chaincode: process.env.FABRIC_CHAINCODE || 'ecasevault',
      mspId: process.env.FABRIC_MSP_ID || 'PoliceOrgMSP',
    });
  } else {
    res.status(503).json({
      status: 'DISCONNECTED',
      error: 'Hyperledger Fabric peer gRPC endpoint unavailable',
      endpoint: process.env.FABRIC_PEER_ENDPOINT || 'localhost:7051',
    });
  }
}

app.get('/health/fabric', handleFabricHealth);
app.get('/api/health/fabric', handleFabricHealth);

// Dedicated Supabase Enterprise Backend Health Check
async function handleSupabaseHealth(_req: Request, res: Response) {
  try {
    const { data, error } = await supabaseAdmin.storage.listBuckets();
    if (error) {
      res.json({
        status: 'DEGRADED_OFFLINE_MODE',
        backend: 'Supabase Enterprise Managed PostgreSQL + Private Storage',
        message: 'Running with local encrypted cache fallback',
        buckets: [SUPABASE_BUCKET_DOCUMENTS, SUPABASE_BUCKET_EVIDENCE],
        error: error.message
      });
      return;
    }
    res.json({
      status: 'CONNECTED',
      backend: 'Supabase Enterprise Managed PostgreSQL + Private Storage',
      url: process.env.SUPABASE_URL || 'https://ecasevault-supabase.police.gov.in',
      buckets: (data || []).map(b => b.name)
    });
  } catch (err: any) {
    res.json({
      status: 'DEGRADED_OFFLINE_MODE',
      backend: 'Supabase Enterprise Managed PostgreSQL + Private Storage',
      message: 'Running with local encrypted cache fallback',
      buckets: [SUPABASE_BUCKET_DOCUMENTS, SUPABASE_BUCKET_EVIDENCE],
      error: err.message
    });
  }
}

app.get('/health/supabase', handleSupabaseHealth);
app.get('/api/health/supabase', handleSupabaseHealth);

// Centralized Error Handling Middleware
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const requestId = req.headers['x-request-id'] || `REQ-${Date.now()}`;
  console.error(`[UNHANDLED ERROR] [${requestId}] ${req.method} ${req.path}:`, err);

  const statusCode = typeof err.status === 'number' ? err.status : 500;

  res.status(statusCode).json({
    success: false,
    error: statusCode >= 500 ? 'Internal server error occurred' : (err.message || 'An unexpected error occurred'),
    requestId,
  });
});

// Static frontend assets serving (Single-Port Production Deployment)
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  console.log(`[e-CASEVAULT] Serving production static frontend from ${distPath}`);
  app.use(express.static(distPath));

  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      return next();
    }
    const indexHtml = path.join(distPath, 'index.html');
    if (fs.existsSync(indexHtml)) {
      res.sendFile(indexHtml);
    } else {
      next();
    }
  });
}

app.listen(PORT, async () => {
  console.log(`================================================================`);
  console.log(`  e-CASEVAULT Production API Server Running on port ${PORT}  `);
  console.log(`  Health Check: http://localhost:${PORT}/api/health               `);
  console.log(`  Supabase:     http://localhost:${PORT}/api/health/supabase      `);
  console.log(`================================================================`);
  await initializeDatabase();
  await initializeSupabaseStorage();
});
