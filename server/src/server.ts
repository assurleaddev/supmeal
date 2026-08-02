import http from 'http';
import { Server as SocketServer } from 'socket.io';
import { createApp } from './app';
import { setupSocket } from './socket/socketHandler';
import prisma from './config/database';

const PORT = Number(process.env.PORT) || 3000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:80';

async function main() {
  // Test database connection
  await prisma.$connect();
  console.log('✅ Database connected');

  const app = createApp();
  const httpServer = http.createServer(app);

  // Attach Socket.io
  const io = new SocketServer(httpServer, {
    cors: {
      origin: CLIENT_URL,
      credentials: true,
    },
    path: '/socket.io',
  });

  setupSocket(io);

  httpServer.listen(PORT, () => {
    console.log(`🚀 SUPMEAL server running on port ${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
