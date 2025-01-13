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

app.get('/', (req, res) => {
  res.send('Server is running!');
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('login', (username) => {
    users.set(socket.id, { username, socketId: socket.id });
    io.emit('user_list', Array.from(users.values()));
    console.log(`User ${username} logged in`);
  });

  socket.on('send_message', ({ recipientId, message }) => {
    const sender = users.get(socket.id);
    const recipient = Array.from(users.values()).find(user => user.socketId === recipientId);
    if (sender && recipient) {
      const fullMessage = { 
        ...message, 
        sender: sender.username, 
        recipient: recipient.username,
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        readBy: [sender.username]
      };
      io.to(recipientId).to(socket.id).emit('new_message', fullMessage);
      console.log(`Message sent from ${sender.username} to ${recipient.username}: ${JSON.stringify(fullMessage)}`);
    }
  });

  socket.on('typing', ({ recipientId, isTyping }) => {
    const user = users.get(socket.id);
    if (user) {
      socket.to(recipientId).emit('user_typing', { username: user.username, isTyping });
    }
  });

  socket.on('read_receipt', ({ messageId, senderId }) => {
    const user = users.get(socket.id);
    if (user) {
      io.to(senderId).emit('message_read', { messageId, username: user.username });
    }
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);
      io.emit('user_list', Array.from(users.values()));
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

