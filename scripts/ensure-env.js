import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const envExamplePath = path.join(rootDir, '.env.example');

// 1. Ensure storage directories exist
const storageDirs = [
  path.join(rootDir, 'storage', 'evidence'),
  path.join(rootDir, 'storage', 'keys'),
  path.join(rootDir, 'storage', 'case_repo'),
  path.join(rootDir, 'storage', 'quarantine'),
  path.join(rootDir, 'storage', 'fabric-identities')
];

for (const dir of storageDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const keepFile = path.join(dir, '.gitkeep');
  if (!fs.existsSync(keepFile)) {
    fs.writeFileSync(keepFile, '');
  }
}

// 2. Ensure .env exists with working local development defaults
if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    console.log('[e-CASEVAULT SETUP] Generating local development .env from .env.example...');
    let content = fs.readFileSync(envExamplePath, 'utf8');

    // Replace placeholder secrets with working local development keys
    content = content.replace(
      'JWT_SECRET=REPLACE_WITH_RANDOM_SECRET',
      'JWT_SECRET=17bfc497b9fc42cd01a7905f1b49c58395b00a38c27b542c18953a1b0681deb5'
    );
    content = content.replace(
      'ENCRYPTION_MASTER_KEY=REPLACE_WITH_RANDOM_SECRET',
      'ENCRYPTION_MASTER_KEY=e780dde9717e6191fd56965489690e1f7f7978f0c03aed5485ce6a4d90533ce7'
    );
    content = content.replace(
      'INITIAL_SEED_PASSWORD=REPLACE_WITH_STRONG_ADMIN_SEED_PASSWORD',
      'INITIAL_SEED_PASSWORD=hEYz14ltDter2SM9/+Z+dkzq'
    );

    fs.writeFileSync(envPath, content, 'utf8');
    console.log('[e-CASEVAULT SETUP] ✅ .env file automatically configured with local development credentials.');
  } else {
    console.warn('[e-CASEVAULT SETUP] ⚠️ .env.example not found. Using fallback in-memory environment defaults.');
  }
} else {
  console.log('[e-CASEVAULT SETUP] Existing .env file detected.');
}
