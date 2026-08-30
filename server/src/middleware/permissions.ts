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

/**
 * Droits accordés par un rôle au sein d'un cookbook.
 *
 * Ce sont les mêmes seuils que ceux appliqués par `requireCookbookRole` : la hiérarchie des rôles
 * est une règle métier et ne doit exister qu'ici. Le client se contente d'afficher ou de masquer
 * les actions à partir de cet objet, sans jamais réinterpréter le rôle lui-même.
 */
export interface CookbookPermissions {
  canComment: boolean;
  canChat: boolean;
  canEditRecipes: boolean;
  canManageMembers: boolean;
  canDeleteCookbook: boolean;
}

export function getCookbookPermissions(role: CookbookRole): CookbookPermissions {
  const level = ROLE_HIERARCHY[role];

  return {
    canComment: level >= ROLE_HIERARCHY.COMMENTER,
    canChat: level >= ROLE_HIERARCHY.COMMENTER,
    canEditRecipes: level >= ROLE_HIERARCHY.EDITOR,
    canManageMembers: level >= ROLE_HIERARCHY.CREATOR,
    canDeleteCookbook: level >= ROLE_HIERARCHY.CREATOR,
  };
}

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
