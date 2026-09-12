import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { authorizeRole, SystemRole } from '../middleware/rbac';
import { authenticateJwt } from '../middleware/auth';
import { normaliseRole } from '../middleware/rbacScope';
import { casePersistenceService } from '../services/casePersistenceService';

describe('5-Stakeholder Roles & ICJS Multi-Pillar RBAC Test Suite', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-maharashtra-police-2026';
  const CANONICAL_FIVE_ROLES: SystemRole[] = ['POLICE', 'FORENSIC', 'LEGAL', 'AUDITOR', 'ADMIN'];

  function createRoleToken(role: string, badgeNo?: string): string {
    return jwt.sign(
      {
        userId: `USR-${role}-TEST`,
        badgeNo: badgeNo || `MH-${role}-9001`,
        username: `${role.toLowerCase()}@demo`,
        role,
        station: 'State Police Headquarters, Mumbai',
      },
      JWT_SECRET,
      { expiresIn: '15m', issuer: 'e-casevault' }
    );
  }

  function mockMiddlewareCall(role: string, allowedRoles: SystemRole[]) {
    let statusCode = 200;
    let jsonBody: any = null;
    let nextCalled = false;

    const req: any = {
      user: {
        userId: `USR-${role}-01`,
        badgeNo: `MH-${role}-01`,
        role,
        username: `${role.toLowerCase()}@demo`,
      },
    };

    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (body: any) => {
            jsonBody = body;
          },
        };
      },
    };

    const next = () => {
      nextCalled = true;
    };

    const middleware = authorizeRole(...allowedRoles);
    middleware(req, res, next);

    return { statusCode, nextCalled, jsonBody };
  }

  function simulateAuthHeader(token: string) {
    let statusCode = 200;
    let jsonBody: any = null;
    let nextCalled = false;
    let authenticatedUser: any = null;

    const req: any = {
      headers: {
        authorization: `Bearer ${token}`,
      },
      ip: '127.0.0.1',
    };

    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (body: any) => {
            jsonBody = body;
          },
        };
      },
    };

    const next = () => {
      nextCalled = true;
      authenticatedUser = req.user;
    };

    authenticateJwt(req, res, next);
    return { statusCode, nextCalled, jsonBody, authenticatedUser };
  }

  // 1. Authenticate as each of the 5 canonical roles
  test('1. Authentication pipeline correctly decodes and validates all 5 canonical roles', () => {
    CANONICAL_FIVE_ROLES.forEach((role) => {
      const token = createRoleToken(role);
      const authResult = simulateAuthHeader(token);
      assert.equal(authResult.nextCalled, true, `Role ${role} token must pass authenticateJwt`);
      assert.equal(authResult.authenticatedUser.role, role, `Decoded role should match ${role}`);
      assert.equal(normaliseRole(role), role, `Role ${role} must normalise to canonical system role`);
    });
  });

  test('1b. External integration modules & departmental roles normalize to canonical 5 roles', () => {
    assert.equal(normaliseRole('JAIL'), 'POLICE');
    assert.equal(normaliseRole('PRISON'), 'POLICE');
    assert.equal(normaliseRole('SUPERINTENDENT'), 'POLICE');
    assert.equal(normaliseRole('NCRB'), 'POLICE');
    assert.equal(normaliseRole('SCRB'), 'POLICE');
    assert.equal(normaliseRole('FSL'), 'FORENSIC');
    assert.equal(normaliseRole('PROSECUTOR'), 'LEGAL');
    assert.equal(normaliseRole('VIGILANCE'), 'AUDITOR');
    assert.equal(normaliseRole('SUPERVISOR'), 'ADMIN');
  });

  // 2. ICJS Prisons / Custody Module Authorization Boundaries
  describe('2. ICJS Prisons / Custody Module Authorization Boundaries', () => {
    test('POLICE & ADMIN are authorized to access prisoner roster and custody endpoints (200 OK)', () => {
      const policeResult = mockMiddlewareCall('POLICE', ['POLICE', 'ADMIN', 'LEGAL', 'AUDITOR']);
      assert.equal(policeResult.nextCalled, true, 'POLICE must be permitted on prisoner endpoints');

      const adminResult = mockMiddlewareCall('ADMIN', ['POLICE', 'ADMIN', 'LEGAL', 'AUDITOR']);
      assert.equal(adminResult.nextCalled, true, 'ADMIN must be permitted on prisoner endpoints');
    });

    test('FORENSIC is strictly prohibited from managing prison custody admissions (403 Forbidden)', () => {
      const result = mockMiddlewareCall('FORENSIC', ['POLICE', 'ADMIN']);
      assert.equal(result.statusCode, 403);
      assert.equal(result.nextCalled, false);
      assert.match(result.jsonBody?.error, /Forbidden/);
    });

    test('Prison custody registry can retrieve active inmates from persistent store', () => {
      const prisoners = casePersistenceService.getAllPrisoners();
      assert.ok(Array.isArray(prisoners), 'Prisoners must be an array');
    });
  });

  // 3. ICJS NCRB / Crime Intelligence Module Authorization Boundaries
  describe('3. ICJS NCRB / Crime Intelligence Module Authorization Boundaries', () => {
    test('POLICE, LEGAL, AUDITOR, ADMIN are authorized for criminal intelligence search and statistics (200 OK)', () => {
      const searchResult = mockMiddlewareCall('POLICE', ['POLICE', 'ADMIN', 'LEGAL', 'AUDITOR']);
      assert.equal(searchResult.nextCalled, true, 'POLICE must be authorized for search');

      const statsResult = mockMiddlewareCall('LEGAL', ['POLICE', 'ADMIN', 'AUDITOR', 'LEGAL']);
      assert.equal(statsResult.nextCalled, true, 'LEGAL must be authorized for stats');
    });

    test('FORENSIC is strictly prohibited from issuing criminal history reports (403 Forbidden)', () => {
      const result = mockMiddlewareCall('FORENSIC', ['POLICE', 'ADMIN', 'LEGAL']);
      assert.equal(result.statusCode, 403);
      assert.equal(result.nextCalled, false);
    });

    test('NCRB integration module searches criminal history records in persistent store', () => {
      const results = casePersistenceService.searchCriminalHistory('');
      assert.ok(Array.isArray(results), 'Criminal history search must return array');
    });
  });

  // 4. AUDITOR Restrictions (Read-Only Vigilance)
  describe('4. AUDITOR Role Read-Only Enforcement', () => {
    test('AUDITOR is authorized for audit logs, ledger inspection, and chain verification (200 OK)', () => {
      const result = mockMiddlewareCall('AUDITOR', ['AUDITOR', 'ADMIN']);
      assert.equal(result.nextCalled, true);
    });

    test('AUDITOR is strictly forbidden from case creation (403 Forbidden)', () => {
      const result = mockMiddlewareCall('AUDITOR', ['POLICE']);
      assert.equal(result.statusCode, 403);
      assert.equal(result.nextCalled, false);
    });

    test('AUDITOR is strictly forbidden from evidence creation (403 Forbidden)', () => {
      const result = mockMiddlewareCall('AUDITOR', ['POLICE']);
      assert.equal(result.statusCode, 403);
      assert.equal(result.nextCalled, false);
    });

    test('AUDITOR is strictly forbidden from prisoner admission (403 Forbidden)', () => {
      const result = mockMiddlewareCall('AUDITOR', ['POLICE', 'ADMIN']);
      assert.equal(result.statusCode, 403);
      assert.equal(result.nextCalled, false);
    });
  });

  // 5. ADMIN User Management & Provisioning
  describe('5. ADMIN Role Governance & System Oversight', () => {
    test('ADMIN is authorized to manage users, assign roles, and configure system (200 OK)', () => {
      const result = mockMiddlewareCall('ADMIN', ['ADMIN']);
      assert.equal(result.nextCalled, true, 'ADMIN must be authorized for system management');
    });

    test('Other roles cannot manage users or provision accounts (403 Forbidden)', () => {
      const nonAdminRoles: SystemRole[] = ['POLICE', 'FORENSIC', 'LEGAL', 'AUDITOR'];
      nonAdminRoles.forEach((role) => {
        const result = mockMiddlewareCall(role, ['ADMIN']);
        assert.equal(result.statusCode, 403, `${role} must not be allowed to administer users`);
        assert.equal(result.nextCalled, false);
      });
    });
  });

  // 6. Security Token Tampering & Invalid Role Rejection
  describe('6. Token Tampering & Unknown Role Rejection', () => {
    test('Tampered JWT signature is rejected with 401 Unauthorized', () => {
      const token = createRoleToken('ADMIN');
      const tampered = token.slice(0, -5) + 'XXXXX';
      const result = simulateAuthHeader(tampered);
      assert.equal(result.statusCode, 401);
      assert.equal(result.nextCalled, false);
    });

    test('Unknown or arbitrary role string is denied access by authorizeRole', () => {
      const invalidRoles = ['SUPERUSER', 'HACKER', 'INTERN', 'PUBLIC', 'USER'];
      invalidRoles.forEach((badRole) => {
        const result = mockMiddlewareCall(badRole, CANONICAL_FIVE_ROLES);
        assert.equal(result.statusCode, 403, `Arbitrary role ${badRole} must be rejected`);
        assert.equal(result.nextCalled, false);
      });
    });
  });
});
