const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Store connected users and rooms
const users = new Map(); // socketId -> {username, room}
const rooms = new Map(); // roomId -> Set of socketIds

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle user joining
  socket.on('join', (data) => {
    const username = typeof data === 'string' ? data : data.username;
    const room = typeof data === 'string' ? 'default' : (data.room || 'default');
    
    // Join socket room
    socket.join(room);
    
    // Store user info
    users.set(socket.id, { username, room });
    
    // Add to room tracking
    if (!rooms.has(room)) {
      rooms.set(room, new Set());
    }
    rooms.get(room).add(socket.id);
    
    // Get list of existing users in this room
    const roomUsers = [];
    rooms.get(room).forEach(id => {
      if (id !== socket.id) {
        const user = users.get(id);
        if (user) {
          roomUsers.push({ socketId: id, username: user.username });
        }
      }
    });
    
    // Send init data to the new user
    socket.emit('init', { users: roomUsers });
    
    // Notify others in the room
    socket.to(room).emit('user joined', {
      socketId: socket.id,
      username: username,
      message: `${username} joined the chat`
    });
    
    console.log(`${username} joined room: ${room}`);
    
    // Send updated user count to room
    io.to(room).emit('user count', rooms.get(room).size);
  });

  // Handle chat messages
  socket.on('chat message', (data) => {
    const user = users.get(socket.id);
    if (!user) return;
    
    const { room, username } = user;
    io.to(room).emit('chat message', {
      socketId: socket.id,
      username: username,
      message: data.message,
      timestamp: new Date().toLocaleTimeString()
    });
  });

  // Handle typing indicator
  socket.on('typing', (isTyping) => {
    const user = users.get(socket.id);
    if (user) {
      socket.to(user.room).emit('typing', {
        socketId: socket.id,
        username: user.username,
        isTyping: isTyping
      });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      const { username, room } = user;
      
      // Remove from room
      if (rooms.has(room)) {
        rooms.get(room).delete(socket.id);
        
        // Clean up empty rooms
        if (rooms.get(room).size === 0) {
          rooms.delete(room);
        } else {
          // Notify others in room
          io.to(room).emit('user left', {
            socketId: socket.id,
            username: username,
            message: `${username} left the chat`
          });
          
          // Update user count
          io.to(room).emit('user count', rooms.get(room).size);
        }
      }
      
      users.delete(socket.id);
      console.log(`${username} disconnected from room: ${room}`);
    }
  });
});

const PORT = process.nv.PORT || 3000;
server.listen(PORT, () => {
  console.log(`BonziWorld Chat server running on http://localhost:${PORT}`);
});