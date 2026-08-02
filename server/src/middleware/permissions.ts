import { Response, NextFunction } from 'express';
import { CookbookRole } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/database';
import { AppError } from './error';

const ROLE_HIERARCHY: Record<CookbookRole, number> = {
  CREATOR: 4,
  EDITOR: 3,
  COMMENTER: 2,
  READER: 1,
};

export function requireCookbookRole(minRole: CookbookRole) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const cookbookId = req.params.cookbookId || req.params.id;

    try {
      const member = await prisma.cookbookMember.findUnique({
        where: { cookbookId_userId: { cookbookId, userId: req.user.id } },
      });

      if (!member) {
        return next(new AppError('Not a member of this cookbook', 403));
      }

      if (ROLE_HIERARCHY[member.role] < ROLE_HIERARCHY[minRole]) {
        return next(new AppError('Insufficient permissions', 403));
      }

      // Attach member role to request for downstream use
      (req as any).cookbookRole = member.role;
      next();
    } catch (err) {
      next(err);
    }
  };
}
