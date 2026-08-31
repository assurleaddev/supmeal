import { CookbookRole, Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../config/database';
import { AppError } from '../middleware/error';
import { getCookbookPermissions } from '../middleware/permissions';

/**
 * Logique métier des cookbooks : composition de la réponse (rôle + droits), cycle de vie des
 * invitations, gestion des membres et historique de la messagerie.
 */

// ─────────────────────────────────────────
// Contrats d'entrée
// ─────────────────────────────────────────

export const createCookbookSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const updateCookbookSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
});

/** Le rôle CREATOR ne s'attribue pas : il naît avec le cookbook et ne peut être ni donné ni repris. */
const ASSIGNABLE_ROLES = ['EDITOR', 'COMMENTER', 'READER'] as const;

export const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(ASSIGNABLE_ROLES).default('READER'),
});

export const memberRoleSchema = z.object({ role: z.enum(ASSIGNABLE_ROLES) });

export const messageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.coerce.date().optional(),
});

export type MessageQuery = z.infer<typeof messageQuerySchema>;

const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

const cookbookSummaryInclude = {
  createdBy: { select: { id: true, username: true, avatar: true } },
  _count: { select: { recipes: true, members: true } },
} satisfies Prisma.CookbookInclude;

/** Un cookbook n'est jamais renvoyé sans le rôle de l'appelant ni les droits qui en découlent. */
function withPermissions<T>(cookbook: T, role: CookbookRole) {
  return { ...cookbook, myRole: role, permissions: getCookbookPermissions(role) };
}

// ─────────────────────────────────────────
// Lecture
// ─────────────────────────────────────────

export async function listCookbooks(userId: string) {
  const memberships = await prisma.cookbookMember.findMany({
    where: { userId },
    include: { cookbook: { include: cookbookSummaryInclude } },
    orderBy: { joinedAt: 'desc' },
  });

  return memberships.map((membership) => withPermissions(membership.cookbook, membership.role));
}

export async function getCookbook(cookbookId: string, role: CookbookRole) {
  const cookbook = await prisma.cookbook.findUnique({
    where: { id: cookbookId },
    include: {
      createdBy: { select: { id: true, username: true, avatar: true } },
      members: {
        include: { user: { select: { id: true, username: true, avatar: true, email: true } } },
      },
      _count: { select: { recipes: true } },
    },
  });

  if (!cookbook) throw new AppError('Cookbook not found', 404);
  return withPermissions(cookbook, role);
}

// ─────────────────────────────────────────
// Écriture
// ─────────────────────────────────────────

export async function createCookbook(
  userId: string,
  input: z.infer<typeof createCookbookSchema>,
) {
  const cookbook = await prisma.cookbook.create({
    data: {
      ...input,
      createdById: userId,
      members: { create: { userId, role: CookbookRole.CREATOR } },
    },
    include: cookbookSummaryInclude,
  });

  return withPermissions(cookbook, CookbookRole.CREATOR);
}

export function updateCookbook(cookbookId: string, input: z.infer<typeof updateCookbookSchema>) {
  return prisma.cookbook.update({
    where: { id: cookbookId },
    data: input,
    include: { createdBy: { select: { id: true, username: true } } },
  });
}

export async function setCoverImage(cookbookId: string, filename: string) {
  const cookbook = await prisma.cookbook.update({
    where: { id: cookbookId },
    data: { coverImage: `/uploads/recipes/${filename}` },
  });

  return { coverImage: cookbook.coverImage };
}

export async function deleteCookbook(cookbookId: string) {
  await prisma.cookbook.delete({ where: { id: cookbookId } });
}

// ─────────────────────────────────────────
// Invitations
// ─────────────────────────────────────────

export async function createInvite(
  cookbookId: string,
  invitedById: string,
  input: z.infer<typeof inviteSchema>,
) {
  const invite = await prisma.cookbookInvite.create({
    data: {
      cookbookId,
      email: input.email.toLowerCase(),
      role: input.role as CookbookRole,
      invitedById,
      expiresAt: new Date(Date.now() + INVITE_LIFETIME_MS),
    },
  });

  return { token: invite.token, email: invite.email, expiresAt: invite.expiresAt };
}

export async function acceptInvite(token: string, userId: string) {
  const invite = await prisma.cookbookInvite.findUnique({
    where: { token },
    include: { cookbook: { select: { id: true, name: true } } },
  });

  if (!invite) throw new AppError('Invite not found', 404);
  if (invite.usedAt) throw new AppError('Invite already used', 400);
  if (invite.expiresAt < new Date()) throw new AppError('Invite expired', 400);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) throw new AppError('User not found', 404);

  // L'invitation est nominative : sans cette vérification, le jeton était un simple porteur et
  // n'importe quel compte l'ayant intercepté pouvait rejoindre le cookbook.
  if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    throw new AppError('This invite was issued for a different email address', 403);
  }

  const existing = await prisma.cookbookMember.findUnique({
    where: { cookbookId_userId: { cookbookId: invite.cookbookId, userId } },
  });
  if (existing) throw new AppError('Already a member of this cookbook', 409);

  await prisma.$transaction([
    prisma.cookbookMember.create({
      data: { cookbookId: invite.cookbookId, userId, role: invite.role },
    }),
    prisma.cookbookInvite.update({ where: { id: invite.id }, data: { usedAt: new Date() } }),
  ]);

  return {
    cookbookId: invite.cookbookId,
    cookbookName: invite.cookbook.name,
    role: invite.role,
  };
}

// ─────────────────────────────────────────
// Membres
// ─────────────────────────────────────────

export async function updateMemberRole(
  cookbookId: string,
  targetUserId: string,
  actingUserId: string,
  role: (typeof ASSIGNABLE_ROLES)[number],
) {
  if (targetUserId === actingUserId) {
    throw new AppError('Cannot change your own role', 400);
  }

  return prisma.cookbookMember.update({
    where: { cookbookId_userId: { cookbookId, userId: targetUserId } },
    data: { role: role as CookbookRole },
    include: { user: { select: { id: true, username: true } } },
  });
}

export async function removeMember(
  cookbookId: string,
  targetUserId: string,
  actingUserId: string,
) {
  if (targetUserId === actingUserId) {
    throw new AppError('Use the leave endpoint to leave a cookbook', 400);
  }

  await prisma.cookbookMember.delete({
    where: { cookbookId_userId: { cookbookId, userId: targetUserId } },
  });
}

export async function leaveCookbook(cookbookId: string, userId: string) {
  const member = await prisma.cookbookMember.findUnique({
    where: { cookbookId_userId: { cookbookId, userId } },
  });

  if (!member) throw new AppError('Not a member', 404);
  if (member.role === CookbookRole.CREATOR) {
    // Le transfert de propriété n'existe pas : CREATOR ne figure pas dans ASSIGNABLE_ROLES.
    // Le message ne doit donc pas orienter vers une action que l'application n'offre pas.
    throw new AppError('Creator cannot leave — delete the cookbook instead', 400);
  }

  await prisma.cookbookMember.delete({
    where: { cookbookId_userId: { cookbookId, userId } },
  });
}

// ─────────────────────────────────────────
// Messagerie
// ─────────────────────────────────────────

export async function listMessages(cookbookId: string, query: MessageQuery) {
  const messages = await prisma.message.findMany({
    where: {
      cookbookId,
      ...(query.before && { createdAt: { lt: query.before } }),
    },
    include: { user: { select: { id: true, username: true, avatar: true } } },
    orderBy: { createdAt: 'desc' },
    take: query.limit,
  });

  // Récupérés du plus récent au plus ancien pour que `take` garde les derniers, puis remis dans
  // l'ordre chronologique attendu à l'affichage.
  return messages.reverse();
}
