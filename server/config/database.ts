import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ecasevault';

// Determine if SSL is required (for cloud providers like Render, Supabase, Neon, Railway, AWS RDS)
const isRemoteDb = 
  process.env.DATABASE_SSL === 'true' ||
  (process.env.NODE_ENV === 'production' && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) ||
  connectionString.includes('render.com') ||
  connectionString.includes('railway') ||
  connectionString.includes('supabase.co') ||
  connectionString.includes('neon.tech') ||
  connectionString.includes('amazonaws.com');

export const pool = new Pool({
  connectionString: connectionString || 'postgres://test:test@localhost:5432/test',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined,
});

/**
 * Checks PostgreSQL database connection status by running SELECT 1 query.
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (err) {
    return false;
  }
}
