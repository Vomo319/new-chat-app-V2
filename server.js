const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

const users = new Map();
const rooms = new Set(['general', 'random', 'tech']);

app.get('/', (req, res) => {
  res.send('Server is running!');
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('login', (username) => {
    users.set(socket.id, { username, currentRoom: null });
    io.emit('user_list', Array.from(users.values()).map(u => u.username));
    console.log(`User ${username} logged in`);
  });

  socket.on('join_room', (room) => {
    const user = users.get(socket.id);
    if (user) {
      if (user.currentRoom) {
        socket.leave(user.currentRoom);
      }
      socket.join(room);
      user.currentRoom = room;
      io.to(room).emit('user_joined', { username: user.username, room });
      console.log(`User ${user.username} joined room ${room}`);
    }
  });

  socket.on('send_message', (message) => {
    const user = users.get(socket.id);
    if (user && user.currentRoom) {
      const fullMessage = { ...message, sender: user.username, room: user.currentRoom };
      io.to(user.currentRoom).emit('new_message', fullMessage);
      console.log(`Message sent in ${user.currentRoom}: ${JSON.stringify(fullMessage)}`);
    }
  });

  socket.on('typing', (isTyping) => {
    const user = users.get(socket.id);
    if (user && user.currentRoom) {
      socket.to(user.currentRoom).emit('user_typing', { username: user.username, isTyping });
    }
  });

  socket.on('read_receipt', (messageId) => {
    const user = users.get(socket.id);
    if (user && user.currentRoom) {
      io.to(user.currentRoom).emit('message_read', { messageId, username: user.username });
    }
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);
      io.emit('user_list', Array.from(users.values()).map(u => u.username));
      if (user.currentRoom) {
        io.to(user.currentRoom).emit('user_left', { username: user.username, room: user.currentRoom });
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

