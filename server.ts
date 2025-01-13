import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';

// Initialize express app
const app = express();
const httpServer = createServer(app);

// Socket.IO setup with CORS
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Basic health check route
app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'ChatPWA Backend is running' });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle joining a chat room
  socket.on('join_chat', (chatId: string) => {
    socket.join(chatId);
    console.log(`User ${socket.id} joined chat: ${chatId}`);
  });

  // Handle sending messages
  socket.on('send_message', (message: {
    chatId: string;
    content: string;
    senderId: string;
    timestamp: string;
  }) => {
    io.to(message.chatId).emit('new_message', {
      ...message,
      id: Date.now().toString()
    });
    console.log(`Message sent in chat ${message.chatId}`);
  });

  // Handle typing indicators
  socket.on('typing', (data: { chatId: string; userId: string }) => {
    socket.to(data.chatId).emit('user_typing', data.userId);
  });

  // Handle stop typing
  socket.on('stop_typing', (data: { chatId: string; userId: string }) => {
    socket.to(data.chatId).emit('user_stop_typing', data.userId);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, _next: any) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

