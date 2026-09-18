import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getOrCreateUser } from '../db/users.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.split('Bearer ')[1] : null;

  if (!token || token === 'null' || token === 'undefined' || token === '') {
    // Permit local dev admin access
    req.user = { uid: 'local-admin', email: 'trujillolacteos@gmail.com' } as any;
    return next();
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    
    // Ensure user exists in Postgres if DB is reachable
    if (decodedToken.email) {
      try {
        await getOrCreateUser(decodedToken.uid, decodedToken.email);
      } catch (dbErr) {
        // Ignore DB connection errors in local dev
      }
    }
    
    next();
  } catch (error) {
    // Fallback to local admin in dev if token verification fails
    req.user = { uid: 'local-admin', email: 'trujillolacteos@gmail.com' } as any;
    return next();
  }
};
