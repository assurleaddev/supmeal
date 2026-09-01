import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { JwtPayload } from '../types';
import { env } from '../config/env';

export function setupSocket(io: SocketServer) {
  // Auth middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string;
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      const user = { id: payload.sub, email: payload.email, username: payload.username };
      (socket as any).user = user;
      // `socket.data` est le seul champ que Socket.io conserve sur les `RemoteSocket` renvoyés par
      // `fetchSockets()`. Sans cette copie, la liste de présence ne saurait pas qui est connecté.
      socket.data.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  /** Nom de la room d'un cookbook. Un seul endroit pour cette convention. */
  const roomOf = (cookbookId: string): string => `cookbook:${cookbookId}`;

  /**
   * Membres actuellement connectés à une room, dédupliqués par utilisateur.
   *
   * La déduplication n'est pas cosmétique : un même compte ouvert dans deux onglets tient deux
   * sockets, et sans elle il apparaîtrait deux fois dans la liste de présence.
   */
  async function presenceOf(cookbookId: string) {
    const sockets = await io.in(roomOf(cookbookId)).fetchSockets();
    const byUser = new Map<string, { userId: string; username: string }>();

    for (const s of sockets) {
      const u = s.data.user as { id: string; username: string } | undefined;
      if (u) byUser.set(u.id, { userId: u.id, username: u.username });
    }

    return [...byUser.values()];
  }

  io.on('connection', (socket) => {
    const user = (socket as any).user as { id: string; email: string; username: string };

    // Join a cookbook chat room
    socket.on('cookbook:join', async (cookbookId: string) => {
      // Verify membership
      const member = await prisma.cookbookMember.findUnique({
        where: { cookbookId_userId: { cookbookId, userId: user.id } },
      });
      if (!member) { socket.emit('error', 'Not a member of this cookbook'); return; }

      socket.join(roomOf(cookbookId));

      // `socket.to()` exclut l'émetteur : le nouvel arrivant ne reçoit donc pas son propre
      // `cookbook:joined` et ne saurait jamais qui est déjà présent. Sans cet envoi, sa liste
      // resterait vide jusqu'à la prochaine arrivée.
      socket.emit('cookbook:presence', { cookbookId, members: await presenceOf(cookbookId) });

      socket.to(roomOf(cookbookId)).emit('cookbook:joined', {
        cookbookId,
        userId: user.id,
        username: user.username,
      });
    });

    // Leave a cookbook chat room
    socket.on('cookbook:leave', (cookbookId: string) => {
      socket.leave(roomOf(cookbookId));
      socket.to(roomOf(cookbookId)).emit('cookbook:left', {
        cookbookId,
        userId: user.id,
        username: user.username,
      });
    });

    // Send a message to a cookbook
    socket.on('cookbook:sendMessage', async (data: { cookbookId: string; content: string }) => {
      const { cookbookId, content } = data;
      if (!content?.trim()) return;

      // Verify membership and permission to chat
      const member = await prisma.cookbookMember.findUnique({
        where: { cookbookId_userId: { cookbookId, userId: user.id } },
      });
      if (!member || member.role === 'READER') {
        socket.emit('error', 'Insufficient permissions');
        return;
      }

      // Save message to DB
      const message = await prisma.message.create({
        data: { cookbookId, userId: user.id, content: content.trim() },
        include: { user: { select: { id: true, username: true, avatar: true } } },
      });

      const chatMessage = {
        id: message.id,
        cookbookId,
        userId: user.id,
        username: user.username,
        avatar: message.user.avatar,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      };

      // Broadcast to all room members including sender
      io.to(roomOf(cookbookId)).emit('cookbook:message', chatMessage);
    });

    /**
     * Fermer l'onglet n'émet aucun `cookbook:leave` : sans ce gestionnaire, l'utilisateur restait
     * affiché comme présent chez les autres jusqu'à leur propre rechargement.
     *
     * L'événement est `disconnecting` et non `disconnect` : c'est le seul moment où `socket.rooms`
     * contient encore les rooms quittées. Dans `disconnect`, l'ensemble est déjà vidé.
     */
    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (!room.startsWith('cookbook:')) continue;   // la room personnelle porte l'id du socket
        socket.to(room).emit('cookbook:left', {
          cookbookId: room.slice('cookbook:'.length),
          userId: user.id,
          username: user.username,
        });
      }
    });
  });
}
