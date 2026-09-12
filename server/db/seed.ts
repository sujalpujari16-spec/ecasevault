import bcrypt from 'bcryptjs';
import { pool } from '../config/database';

export async function seedDatabase() {
  console.log('[e-CASEVAULT SEED] Starting PostgreSQL Database Seeding...');
  let client;
  try {
    client = await pool.connect();
  } catch (err: any) {
    console.warn('[e-CASEVAULT SEED] Database unreachable, skipping seed:', err.message);
    return;
  }

  try {
    await client.query('BEGIN');

    // 1. Seed Police Stations
    await client.query(`
      INSERT INTO police_stations (station_id, name, zone, district, address, contact_number)
      VALUES 
        ('ANDHERI-PS', 'Andheri Police Station, Mumbai', 'Zone II (Western Suburbs)', 'Mumbai City', 'S.V. Road, Andheri West, Mumbai', '+91 22 2628 1500'),
        ('DADAR-PS', 'Dadar Police Station, Mumbai', 'Zone V (Central Suburbs)', 'Mumbai City', 'Gokhale Road North, Dadar West, Mumbai', '+91 22 2430 2233'),
        ('WORLI-PS', 'Worli Police Station, Mumbai', 'Zone III (South Central)', 'Mumbai City', 'Dr. Annie Besant Road, Worli, Mumbai', '+91 22 2493 1122'),
        ('BANDRA-PS', 'Bandra Police Station, Mumbai', 'Zone IX (Western Suburbs)', 'Mumbai City', 'Hill Road, Bandra West, Mumbai', '+91 22 2642 2255'),
        ('COLABA-PS', 'Colaba Police Station, Mumbai', 'Zone I (South Mumbai)', 'Mumbai City', 'Shahid Bhagat Singh Road, Colaba, Mumbai', '+91 22 2285 2244'),
        ('KP-PS', 'Koregaon Park Police Station, Pune', 'Zone I (Pune Central)', 'Pune', 'North Main Road, Koregaon Park, Pune', '+91 20 2612 2200'),
        ('BORIVALI-STF', 'Borivali Special Task Force Unit', 'Zone XII (Special Operations)', 'Mumbai City', 'STF Complex, Link Road, Borivali West', '+91 22 2890 3344'),
        ('KALINA-FSL', 'State Forensic Science Laboratory, Kalina', 'Scientific Investigation Directorate', 'Mumbai Suburban', 'CST Road, Vidyanagari, Kalina, Santacruz East, Mumbai', '+91 22 2667 0761'),
        ('COURT-SESSIONS', 'Directorate of Public Prosecution, Mumbai Sessions Court', 'Judicial Directorate', 'Mumbai City', 'Fort, Mumbai, Maharashtra 400032', '+91 22 2267 1144'),
        ('HQ-MUMBAI', 'Maharashtra Police State Headquarters', 'Command & Control Central', 'Mumbai City', 'Old Council Hall, Shahid Bhagat Singh Marg, Colaba, Mumbai', '+91 22 2202 6636'),
        ('ARTHUR-ROAD-JAIL', 'Mumbai Central Prison (Arthur Road Jail)', 'Prisons & Correctional Services', 'Mumbai City', 'Sane Guruji Marg, Jacob Circle, Mumbai', '+91 22 2307 7244'),
        ('NCRB-DELHI', 'National Crime Records Bureau Integration Node', 'National Repository Network', 'New Delhi', 'NH-8, Mahipalpur, New Delhi', '+91 11 2678 1234'),
        ('VIGILANCE-CELL', 'State Anti-Corruption & Vigilance Cell', 'Internal Affairs Bureau', 'Mumbai City', 'Madam Cama Road, Nariman Point, Mumbai', '+91 22 2284 3322')
      ON CONFLICT (station_id) DO NOTHING;
    `);

    // 2. Hash default password
    const seedPassword = process.env.INITIAL_SEED_PASSWORD || 'Demo@12345';
    const passwordHash = await bcrypt.hash(seedPassword.trim(), 10);

    // 3. Seed Core Demo Stakeholders & Officers
    await client.query(`
      INSERT INTO users (id, badge_no, username, password_hash, full_name, rank, role, station_id, department, clearance_level)
      VALUES
        -- Core Demo Accounts
        ('USR-POL-DEMO', 'MH-POL-8842', 'police@demo', '${passwordHash}', 'Inspector Rajesh Patil', 'Police Inspector (Station Operations)', 'POLICE', 'ANDHERI-PS', 'POLICE', 'CONFIDENTIAL'),
        ('USR-FSL-DEMO', 'FSL-MH-KALINA-042', 'forensic@demo', '${passwordHash}', 'Dr. Neha V. Sawant, Ph.D.', 'Chief Forensic Scientist', 'FORENSIC', 'KALINA-FSL', 'FORENSIC', 'TOP_SECRET_INVESTIGATION'),
        ('USR-LEG-DEMO', 'BAR-MH-2011-582', 'legal@demo', '${passwordHash}', 'Adv. Shrikant Deshpande', 'Public Prosecutor', 'LEGAL', 'COURT-SESSIONS', 'LEGAL', 'RESTRICTED'),
        ('USR-ADM-DEMO', 'DGP-MH-HQ-01', 'admin@demo', '${passwordHash}', 'DGP Sanjay Saxena, IPS', 'Director General of Police', 'ADMIN', 'HQ-MUMBAI', 'ADMIN', 'TOP_SECRET_INVESTIGATION'),
        ('USR-JAL-DEMO', 'PRIS-MH-AR-009', 'jail@demo', '${passwordHash}', 'Superintendent B. K. Gaikwad', 'Superintendent of Prisons', 'JAIL', 'ARTHUR-ROAD-JAIL', 'JAIL', 'RESTRICTED'),
        ('USR-NCR-DEMO', 'NCRB-FED-991', 'ncrb@demo', '${passwordHash}', 'Officer Vikramaditya Sen', 'Intelligence Officer (NCRB Liaison)', 'NCRB', 'NCRB-DELHI', 'NCRB', 'CONFIDENTIAL'),
        ('USR-AUD-DEMO', 'VIG-MH-AUD-77', 'auditor@demo', '${passwordHash}', 'Sunil R. Deshmukh, IAS', 'Chief Vigilance Officer', 'AUDITOR', 'VIGILANCE-CELL', 'AUDITOR', 'TOP_SECRET_INVESTIGATION'),
        
        -- Station Specific IO Accounts
        ('USR-DADAR-DEMO', 'MH-IO-DADAR-01', 'dadar@demo', '${passwordHash}', 'Inspector Suresh Shinde', 'Investigating Officer', 'POLICE', 'DADAR-PS', 'POLICE', 'CONFIDENTIAL'),
        ('USR-WORLI-DEMO', 'MH-IO-WORLI-02', 'worli@demo', '${passwordHash}', 'Inspector Ramesh Jadhav', 'Investigating Officer', 'POLICE', 'WORLI-PS', 'POLICE', 'CONFIDENTIAL'),
        ('USR-BANDRA-DEMO', 'MH-IO-BANDRA-03', 'bandra@demo', '${passwordHash}', 'Inspector Priya Deshmukh', 'Investigating Officer', 'POLICE', 'BANDRA-PS', 'POLICE', 'CONFIDENTIAL'),
        ('USR-COLABA-DEMO', 'MH-IO-COLABA-04', 'colaba@demo', '${passwordHash}', 'Inspector Vikram Sawant', 'Investigating Officer', 'POLICE', 'COLABA-PS', 'POLICE', 'CONFIDENTIAL'),

        -- Officers & Command Hierarchy
        ('USR-001', 'IPS-MH-2004-12', 'sp.pradhan', '${passwordHash}', 'SP Rajesh Pradhan, IPS', 'SP', 'SP', 'ANDHERI-PS', 'POLICE_INVESTIGATION', 'TOP_SECRET_INVESTIGATION'),
        ('USR-002', 'MPS-MH-2015-88', 'dysp.sharma', '${passwordHash}', 'DySP Ananya Sharma, MPS', 'DySP', 'DySP', 'ANDHERI-PS', 'POLICE_INVESTIGATION', 'RESTRICTED'),
        ('USR-003', 'MH-POL-PI-8842', 'pi.patil', '${passwordHash}', 'Inspector Vikram K. Patil', 'PI', 'PI', 'ANDHERI-PS', 'POLICE_INVESTIGATION', 'CONFIDENTIAL'),
        ('USR-004', 'MH-PSI-4910', 'psi.deshmukh', '${passwordHash}', 'PSI R. Deshmukh', 'PSI', 'OFFICER', 'ANDHERI-PS', 'POLICE_INVESTIGATION', 'CONFIDENTIAL')
      ON CONFLICT (badge_no) DO NOTHING;
    `);

    await client.query('COMMIT');
    console.log('[e-CASEVAULT SEED] ✅ PostgreSQL Database Seeding Completed Successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[e-CASEVAULT SEED ERROR] Failed to seed database:', err);
  } finally {
    client.release();
  }
}

// Allow direct execution
if (process.argv[1] && process.argv[1].includes('seed.ts')) {
  seedDatabase().then(() => pool.end());
}
