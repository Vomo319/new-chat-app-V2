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
const friendships = new Map();

app.get('/', (req, res) => {
  res.send('Server is running!');
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('login', (username) => {
    users.set(socket.id, { username, socketId: socket.id, online: true });
    updateUserList();
    console.log(`User ${username} logged in`);
  });

  socket.on('add_friend', ({ friendUsername }) => {
    const currentUser = users.get(socket.id);
    if (currentUser) {
      const friend = Array.from(users.values()).find(user => user.username === friendUsername);
      if (friend) {
        if (!friendships.has(currentUser.username)) {
          friendships.set(currentUser.username, new Set());
        }
        friendships.get(currentUser.username).add(friendUsername);
        
        if (!friendships.has(friendUsername)) {
          friendships.set(friendUsername, new Set());
        }
        friendships.get(friendUsername).add(currentUser.username);

        socket.emit('friend_added', { username: friendUsername });
        io.to(friend.socketId).emit('friend_added', { username: currentUser.username });
        updateUserList();
      } else {
        socket.emit('error', { message: 'User not found' });
      }
    }
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
      user.online = false;
      updateUserList();
    }
    console.log('User disconnected:', socket.id);
  });

  function updateUserList() {
    const userList = Array.from(users.values()).map(user => ({
      username: user.username,
      socketId: user.socketId,
      online: user.online
    }));
    io.emit('user_list', userList);
    
    // Send friend list to each user
    users.forEach((user, socketId) => {
      const friendList = Array.from(friendships.get(user.username) || []).map(friendUsername => {
        const friend = userList.find(u => u.username === friendUsername);
        return friend || { username: friendUsername, online: false };
      });
      io.to(socketId).emit('friend_list', friendList);
    });
  }
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

