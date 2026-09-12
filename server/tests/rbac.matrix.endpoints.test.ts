import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { authorizeRole, SystemRole } from '../middleware/rbac';
import { canCreateCase, canUploadForDepartment, canCreateEvidence } from '../../src/utils/policeWorkflow';

describe('Strict 5-System-Roles Endpoint RBAC Test Suite', () => {

  function mockMiddlewareCall(role: string, allowedRoles: SystemRole[]) {
    let statusCode = 200;
    let jsonBody: any = null;
    let nextCalled = false;

    const req: any = {
      user: {
        userId: `USR-${role}-01`,
        badgeNo: `MH-${role}-01`,
        role: role as any,
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

  describe('1. Endpoint: POST /api/cases (FIR & Case Repository Creation)', () => {
    test('POLICE is authorized (200 OK / next called)', () => {
      const result = mockMiddlewareCall('POLICE', ['POLICE']);
      assert.equal(result.nextCalled, true);
    });

    test('FORENSIC cannot create case (403 Forbidden)', () => {
      const result = mockMiddlewareCall('FORENSIC', ['POLICE']);
      assert.equal(result.statusCode, 403);
      assert.equal(result.nextCalled, false);
      assert.match(result.jsonBody?.error, /Forbidden/);
    });

    test('LEGAL cannot create case (403 Forbidden)', () => {
      const result = mockMiddlewareCall('LEGAL', ['POLICE']);
      assert.equal(result.statusCode, 403);
      assert.equal(result.nextCalled, false);
    });

    test('AUDITOR cannot create case (403 Forbidden)', () => {
      const result = mockMiddlewareCall('AUDITOR', ['POLICE']);
      assert.equal(result.statusCode, 403);
      assert.equal(result.nextCalled, false);
    });

    test('ADMIN cannot create case (403 Forbidden)', () => {
      const result = mockMiddlewareCall('ADMIN', ['POLICE']);
      assert.equal(result.statusCode, 403);
      assert.equal(result.nextCalled, false);
    });
  });

  describe('2. Endpoint: POST /api/evidence/upload (Crime-Scene Evidence)', () => {
    test('POLICE is authorized to register crime-scene evidence', () => {
      const result = mockMiddlewareCall('POLICE', ['POLICE']);
      assert.equal(result.nextCalled, true);
    });

    test('FORENSIC cannot upload police evidence (403 Forbidden)', () => {
      const result = mockMiddlewareCall('FORENSIC', ['POLICE']);
      assert.equal(result.statusCode, 403);
      assert.equal(result.nextCalled, false);
    });

    test('LEGAL cannot upload crime-scene evidence (403 Forbidden)', () => {
      const result = mockMiddlewareCall('LEGAL', ['POLICE']);
      assert.equal(result.statusCode, 403);
      assert.equal(result.nextCalled, false);
    });

    test('AUDITOR cannot upload evidence (403 Forbidden)', () => {
      const result = mockMiddlewareCall('AUDITOR', ['POLICE']);
      assert.equal(result.statusCode, 403);
      assert.equal(result.nextCalled, false);
    });

    test('ADMIN cannot upload evidence (403 Forbidden)', () => {
      const result = mockMiddlewareCall('ADMIN', ['POLICE']);
      assert.equal(result.statusCode, 403);
      assert.equal(result.nextCalled, false);
    });
  });

  describe('3. Endpoint: POST /api/evidence/transfer (Chain of Custody Transfer)', () => {
    test('POLICE can transfer evidence to forensic / court', () => {
      const result = mockMiddlewareCall('POLICE', ['POLICE', 'FORENSIC']);
      assert.equal(result.nextCalled, true);
    });

    test('FORENSIC can transfer evidence back to police / examiners', () => {
      const result = mockMiddlewareCall('FORENSIC', ['POLICE', 'FORENSIC']);
      assert.equal(result.nextCalled, true);
    });

    test('LEGAL cannot transfer evidence (403 Forbidden)', () => {
      const result = mockMiddlewareCall('LEGAL', ['POLICE', 'FORENSIC']);
      assert.equal(result.statusCode, 403);
    });

    test('AUDITOR cannot transfer evidence (403 Forbidden)', () => {
      const result = mockMiddlewareCall('AUDITOR', ['POLICE', 'FORENSIC']);
      assert.equal(result.statusCode, 403);
    });

    test('ADMIN cannot transfer evidence (403 Forbidden)', () => {
      const result = mockMiddlewareCall('ADMIN', ['POLICE', 'FORENSIC']);
      assert.equal(result.statusCode, 403);
    });
  });

  describe('4. Endpoint: POST /api/cases/:id/close (Formal Case Closure)', () => {
    test('POLICE is authorized to execute formal case closure', () => {
      const result = mockMiddlewareCall('POLICE', ['POLICE']);
      assert.equal(result.nextCalled, true);
    });

    test('FORENSIC cannot close case (403 Forbidden)', () => {
      const result = mockMiddlewareCall('FORENSIC', ['POLICE']);
      assert.equal(result.statusCode, 403);
    });

    test('LEGAL cannot close case arbitrarily (403 Forbidden)', () => {
      const result = mockMiddlewareCall('LEGAL', ['POLICE']);
      assert.equal(result.statusCode, 403);
    });

    test('AUDITOR cannot close case (403 Forbidden)', () => {
      const result = mockMiddlewareCall('AUDITOR', ['POLICE']);
      assert.equal(result.statusCode, 403);
    });

    test('ADMIN cannot close case (403 Forbidden)', () => {
      const result = mockMiddlewareCall('ADMIN', ['POLICE']);
      assert.equal(result.statusCode, 403);
    });
  });

  describe('5. Endpoint: POST /api/officers (Personnel Provisioning & Account Management)', () => {
    test('ADMIN is authorized to provision accounts and assign roles', () => {
      const result = mockMiddlewareCall('ADMIN', ['ADMIN']);
      assert.equal(result.nextCalled, true);
    });

    test('POLICE cannot provision accounts (403 Forbidden)', () => {
      const result = mockMiddlewareCall('POLICE', ['ADMIN']);
      assert.equal(result.statusCode, 403);
    });

    test('FORENSIC cannot provision accounts (403 Forbidden)', () => {
      const result = mockMiddlewareCall('FORENSIC', ['ADMIN']);
      assert.equal(result.statusCode, 403);
    });

    test('LEGAL cannot provision accounts (403 Forbidden)', () => {
      const result = mockMiddlewareCall('LEGAL', ['ADMIN']);
      assert.equal(result.statusCode, 403);
    });

    test('AUDITOR cannot provision accounts (403 Forbidden)', () => {
      const result = mockMiddlewareCall('AUDITOR', ['ADMIN']);
      assert.equal(result.statusCode, 403);
    });
  });

  describe('6. Departmental Document Isolation & Document Type Segregation', () => {
    test('POLICE can upload POLICE documents (FIR, Charge Sheet, Case Diary)', () => {
      assert.equal(canUploadForDepartment('POLICE', 'POLICE'), true);
    });

    test('POLICE CANNOT upload FSL / DNA reports as FORENSIC', () => {
      assert.equal(canUploadForDepartment('POLICE', 'FORENSIC'), false);
    });

    test('POLICE CANNOT upload court judgments as LEGAL', () => {
      assert.equal(canUploadForDepartment('POLICE', 'LEGAL'), false);
    });

    test('FORENSIC can upload FORENSIC reports (FSL, DNA, Ballistics, Fingerprint)', () => {
      assert.equal(canUploadForDepartment('FORENSIC', 'FORENSIC'), true);
    });

    test('FORENSIC CANNOT upload FIR or police reports', () => {
      assert.equal(canUploadForDepartment('FORENSIC', 'POLICE'), false);
    });

    test('FORENSIC CANNOT upload court judgments', () => {
      assert.equal(canUploadForDepartment('FORENSIC', 'LEGAL'), false);
    });

    test('LEGAL can upload LEGAL documents (Court Order, Judgment, Bail, Warrants)', () => {
      assert.equal(canUploadForDepartment('LEGAL', 'LEGAL'), true);
    });

    test('LEGAL CANNOT upload FIR or crime-scene reports', () => {
      assert.equal(canUploadForDepartment('LEGAL', 'POLICE'), false);
    });

    test('LEGAL CANNOT upload forensic examination findings', () => {
      assert.equal(canUploadForDepartment('LEGAL', 'FORENSIC'), false);
    });

    test('AUDITOR CANNOT upload to any department repository (Read-Only Vigilance)', () => {
      assert.equal(canUploadForDepartment('AUDITOR', 'POLICE'), false);
      assert.equal(canUploadForDepartment('AUDITOR', 'FORENSIC'), false);
      assert.equal(canUploadForDepartment('AUDITOR', 'LEGAL'), false);
    });

    test('ADMIN CANNOT upload to case repository sections (Separation of Powers)', () => {
      assert.equal(canUploadForDepartment('ADMIN', 'POLICE'), false);
      assert.equal(canUploadForDepartment('ADMIN', 'FORENSIC'), false);
      assert.equal(canUploadForDepartment('ADMIN', 'LEGAL'), false);
    });
  });

  describe('7. Rejection of Legacy Rank Aliases in System Authorization', () => {
    test('Legacy ranks (PI, DySP, SP, OFFICER) are strictly rejected from system endpoints', () => {
      const legacyRanks = ['PI', 'DYSP', 'SP', 'OFFICER', 'INVESTIGATOR', 'PSI', 'API', 'ASI'];
      legacyRanks.forEach((rank) => {
        const result = mockMiddlewareCall(rank, ['POLICE']);
        assert.equal(result.statusCode, 403, `Legacy rank '${rank}' must not bypass system role checks`);
      });
    });
  });
});
