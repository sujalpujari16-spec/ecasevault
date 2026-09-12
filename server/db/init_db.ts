import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/database';
import { runLegalMigration } from './migrate_legal';
import { seedDatabase } from './seed';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initializeDatabase(): Promise<boolean> {
  console.log('[DATABASE INIT] Checking database connection and schema...');
  let client;
  try {
    client = await pool.connect();
  } catch (err: any) {
    console.warn('[DATABASE INIT] Database unreachable (running in offline fallback mode):', err.message);
    return false;
  }

  try {
    // Check if tables already exist
    const checkResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'cases'
    `);

    if (checkResult.rows.length === 0) {
      console.log('[DATABASE INIT] Base schema not found. Executing schema.sql...');
      const schemaPath = path.join(__dirname, 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await client.query(schemaSql);
        console.log('[DATABASE INIT] ✅ schema.sql executed successfully.');
      } else {
        console.warn('[DATABASE INIT] ⚠️ schema.sql not found at:', schemaPath);
      }
    } else {
      console.log('[DATABASE INIT] Base tables already exist.');
    }

    // Always ensure legal & AI audit tables
    await runLegalMigration();

    // Always ensure demo seeds
    await seedDatabase();

    console.log('[DATABASE INIT] ✅ Database initialization verified.');
    return true;
  } catch (err: any) {
    console.error('[DATABASE INIT ERROR] Failed to initialize database:', err);
    return false;
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].includes('init_db.ts')) {
  initializeDatabase().then(() => pool.end());
}
