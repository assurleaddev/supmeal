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
      (socket as any).user = { id: payload.sub, email: payload.email, username: payload.username };
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user as { id: string; email: string; username: string };

    // Join a cookbook chat room
    socket.on('cookbook:join', async (cookbookId: string) => {
      // Verify membership
      const member = await prisma.cookbookMember.findUnique({
        where: { cookbookId_userId: { cookbookId, userId: user.id } },
      });
      if (!member) { socket.emit('error', 'Not a member of this cookbook'); return; }

      socket.join(`cookbook:${cookbookId}`);
      socket.to(`cookbook:${cookbookId}`).emit('cookbook:joined', {
        userId: user.id,
        username: user.username,
      });
    });

    // Leave a cookbook chat room
    socket.on('cookbook:leave', (cookbookId: string) => {
      socket.leave(`cookbook:${cookbookId}`);
      socket.to(`cookbook:${cookbookId}`).emit('cookbook:left', { userId: user.id });
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
      io.to(`cookbook:${cookbookId}`).emit('cookbook:message', chatMessage);
    });

    socket.on('disconnect', () => {
      // Cleanup handled by socket.io automatically
    });
  });
}
