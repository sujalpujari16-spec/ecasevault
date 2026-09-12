import { Request, Response, NextFunction } from 'express';

export type SystemRole = 'POLICE' | 'FORENSIC' | 'LEGAL' | 'AUDITOR' | 'ADMIN';

/**
 * Server-side RBAC Middleware — checks req.user.role against allowed roles.
 * Strictly enforces the 5 canonical system roles: POLICE, FORENSIC, LEGAL, AUDITOR, ADMIN.
 * Rejects unauthorized roles with HTTP 403 Forbidden.
 */
export function authorizeRole(...allowedRoles: SystemRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized: Authentication required' });
      return;
    }

    const rawRole = (req.user.role || '').toUpperCase().trim();
    
    // Exact canonical role check — no legacy rank alias fallbacks
    const isAuthorized = allowedRoles.some((allowed) => allowed.toUpperCase() === rawRole);

    if (!isAuthorized) {
      res.status(403).json({
        success: false,
        error: `Forbidden: Role '${req.user.role}' lacks sufficient authorization for this endpoint`,
      });
      return;
    }

    next();
  };
}
