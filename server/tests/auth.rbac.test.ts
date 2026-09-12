import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authorizeRole, SystemRole } from '../middleware/rbac';
import { canCreateCase, canUploadForDepartment, canCreateEvidence } from '../../src/utils/policeWorkflow';

describe('5-Role Authentication & Backend RBAC Clearance Suite', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-maharashtra-police-2026';

  test('Bcrypt properly verifies authentic passwords and rejects invalid passwords', async () => {
    const rawPassword = 'OfficialPolicePassword#2026';
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const isMatch = await bcrypt.compare(rawPassword, passwordHash);
    assert.equal(isMatch, true, 'Valid password must match bcrypt hash');

    const isFakeMatch = await bcrypt.compare('WrongPassword#123', passwordHash);
    assert.equal(isFakeMatch, false, 'Invalid password must be rejected');
  });

  test('JWT token issues signed claim and correctly decodes canonical 5 system roles', () => {
    const canonicalRoles: SystemRole[] = ['POLICE', 'FORENSIC', 'LEGAL', 'AUDITOR', 'ADMIN'];

    canonicalRoles.forEach((role) => {
      const userPayload = {
        userId: `USR-${role}-01`,
        badgeNo: `MH-${role}-01`,
        role,
        station: 'ANDHERI-PS',
        username: `${role.toLowerCase()}@demo`,
      };

      const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '15m', issuer: 'e-casevault' });
      assert.ok(token.length > 20, 'JWT token string should be non-empty');

      const decoded = jwt.verify(token, JWT_SECRET, { issuer: 'e-casevault' }) as any;
      assert.equal(decoded.badgeNo, userPayload.badgeNo);
      assert.equal(decoded.role, role);
    });
  });

  test('Backend authorizeRole middleware strictly allows permitted roles and returns 403 for unauthorized', () => {
    function simulateMiddleware(userRole: string, allowedRoles: SystemRole[]) {
      let statusCode = 200;
      let jsonPayload: any = null;
      let nextCalled = false;

      const req: any = { user: { role: userRole } };
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (payload: any) => {
              jsonPayload = payload;
            },
          };
        },
      };
      const next = () => {
        nextCalled = true;
      };

      const middleware = authorizeRole(...allowedRoles);
      middleware(req, res, next);

      return { statusCode, jsonPayload, nextCalled };
    }

    // 1. POST /api/cases — POLICE ONLY
    assert.equal(simulateMiddleware('POLICE', ['POLICE']).nextCalled, true);
    assert.equal(simulateMiddleware('FORENSIC', ['POLICE']).statusCode, 403);
    assert.equal(simulateMiddleware('LEGAL', ['POLICE']).statusCode, 403);
    assert.equal(simulateMiddleware('AUDITOR', ['POLICE']).statusCode, 403);
    assert.equal(simulateMiddleware('ADMIN', ['POLICE']).statusCode, 403);

    // Legacy ranks are NOT authorized as roles
    assert.equal(simulateMiddleware('PI', ['POLICE']).statusCode, 403);
    assert.equal(simulateMiddleware('DySP', ['POLICE']).statusCode, 403);
    assert.equal(simulateMiddleware('SP', ['POLICE']).statusCode, 403);
    assert.equal(simulateMiddleware('OFFICER', ['POLICE']).statusCode, 403);

    // 2. POST /api/evidence/upload — POLICE ONLY
    assert.equal(simulateMiddleware('POLICE', ['POLICE']).nextCalled, true);
    assert.equal(simulateMiddleware('FORENSIC', ['POLICE']).statusCode, 403);
    assert.equal(simulateMiddleware('LEGAL', ['POLICE']).statusCode, 403);
    assert.equal(simulateMiddleware('AUDITOR', ['POLICE']).statusCode, 403);
    assert.equal(simulateMiddleware('ADMIN', ['POLICE']).statusCode, 403);

    // 3. POST /api/evidence/transfer — POLICE and FORENSIC only
    assert.equal(simulateMiddleware('POLICE', ['POLICE', 'FORENSIC']).nextCalled, true);
    assert.equal(simulateMiddleware('FORENSIC', ['POLICE', 'FORENSIC']).nextCalled, true);
    assert.equal(simulateMiddleware('LEGAL', ['POLICE', 'FORENSIC']).statusCode, 403);
    assert.equal(simulateMiddleware('AUDITOR', ['POLICE', 'FORENSIC']).statusCode, 403);
    assert.equal(simulateMiddleware('ADMIN', ['POLICE', 'FORENSIC']).statusCode, 403);

    // 4. POST /api/cases/:id/close — POLICE ONLY
    assert.equal(simulateMiddleware('POLICE', ['POLICE']).nextCalled, true);
    assert.equal(simulateMiddleware('FORENSIC', ['POLICE']).statusCode, 403);
    assert.equal(simulateMiddleware('LEGAL', ['POLICE']).statusCode, 403);
    assert.equal(simulateMiddleware('AUDITOR', ['POLICE']).statusCode, 403);
    assert.equal(simulateMiddleware('ADMIN', ['POLICE']).statusCode, 403);

    // 5. POST /api/officers (User provisioning) — ADMIN ONLY
    assert.equal(simulateMiddleware('ADMIN', ['ADMIN']).nextCalled, true);
    assert.equal(simulateMiddleware('POLICE', ['ADMIN']).statusCode, 403);
    assert.equal(simulateMiddleware('FORENSIC', ['ADMIN']).statusCode, 403);
    assert.equal(simulateMiddleware('LEGAL', ['ADMIN']).statusCode, 403);
    assert.equal(simulateMiddleware('AUDITOR', ['ADMIN']).statusCode, 403);
  });

  test('Departmental file upload matrix enforces strict section segregation', () => {
    // POLICE can only upload to POLICE department
    assert.equal(canUploadForDepartment('POLICE', 'POLICE'), true);
    assert.equal(canUploadForDepartment('POLICE', 'FORENSIC'), false);
    assert.equal(canUploadForDepartment('POLICE', 'LEGAL'), false);

    // FORENSIC can only upload to FORENSIC department
    assert.equal(canUploadForDepartment('FORENSIC', 'FORENSIC'), true);
    assert.equal(canUploadForDepartment('FORENSIC', 'POLICE'), false);
    assert.equal(canUploadForDepartment('FORENSIC', 'LEGAL'), false);

    // LEGAL can only upload to LEGAL department
    assert.equal(canUploadForDepartment('LEGAL', 'LEGAL'), true);
    assert.equal(canUploadForDepartment('LEGAL', 'POLICE'), false);
    assert.equal(canUploadForDepartment('LEGAL', 'FORENSIC'), false);

    // AUDITOR and ADMIN cannot upload case documents to any department
    assert.equal(canUploadForDepartment('AUDITOR', 'POLICE'), false);
    assert.equal(canUploadForDepartment('AUDITOR', 'FORENSIC'), false);
    assert.equal(canUploadForDepartment('AUDITOR', 'LEGAL'), false);

    assert.equal(canUploadForDepartment('ADMIN', 'POLICE'), false);
    assert.equal(canUploadForDepartment('ADMIN', 'FORENSIC'), false);
    assert.equal(canUploadForDepartment('ADMIN', 'LEGAL'), false);
  });

  test('Case and evidence creation authority strictly limited to POLICE', () => {
    assert.equal(canCreateCase('POLICE'), true);
    assert.equal(canCreateCase('FORENSIC'), false);
    assert.equal(canCreateCase('LEGAL'), false);
    assert.equal(canCreateCase('AUDITOR'), false);
    assert.equal(canCreateCase('ADMIN'), false);

    const mockCase: any = { 
      status: 'Investigation Ongoing', 
      policeStation: 'Andheri Police Station',
      investigating_officer_id: 'MH-POL-1',
      officers: { assignedIOBadge: 'MH-POL-1' }
    };
    assert.equal(canCreateEvidence({ role: 'POLICE', badgeNo: 'MH-POL-1', station: 'Andheri Police Station' } as any, mockCase), true);
    assert.equal(canCreateEvidence({ role: 'FORENSIC', badgeNo: 'MH-FOR-1', station: 'FSL' } as any, mockCase), false);
    assert.equal(canCreateEvidence({ role: 'LEGAL', badgeNo: 'MH-LEG-1', station: 'High Court' } as any, mockCase), false);
    assert.equal(canCreateEvidence({ role: 'AUDITOR', badgeNo: 'MH-AUD-1', station: 'HQ' } as any, mockCase), false);
    assert.equal(canCreateEvidence({ role: 'ADMIN', badgeNo: 'MH-ADM-1', station: 'HQ' } as any, mockCase), false);
  });
});
