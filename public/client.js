// BonziWorld Chat Client
const socket = io();

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const nicknameInput = document.getElementById('nickname');
const roomInput = document.getElementById('room-id');
const joinBtn = document.getElementById('join-btn');
const leaveBtn = document.getElementById('leave-btn');
const chatArea = document.getElementById('chat-area');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const userCount = document.getElementById('user-count');
const currentUser = document.getElementById('current-user');
const typingIndicator = document.getElementById('typing-indicator');

// State
let myUsername = '';
let mySocketId = '';
const users = new Map(); // socketId -> {username, element, x, y, color}
const gorillaColors = ['purple', 'blue', 'green', 'red', 'yellow', 'orange', 'pink', 'cyan'];
let myColor = '';

// Gorilla SVG Template
function getGorillaSVG(color) {
  return `
    <svg viewBox="0 0 100 100" class="gorilla-svg gorilla-${color}">
      <!-- Body -->
      <ellipse cx="50" cy="65" rx="30" ry="25" class="gorilla-body" fill="#9B59B6"/>
      <!-- Head -->
      <ellipse cx="50" cy="35" rx="25" ry="22" class="gorilla-body" fill="#9B59B6"/>
      <!-- Face -->
      <ellipse cx="50" cy="38" rx="15" ry="12" fill="#D2B48C"/>
      <!-- Eyes -->
      <ellipse cx="43" cy="33" rx="4" ry="5" fill="white"/>
      <ellipse cx="57" cy="33" rx="4" ry="5" fill="white"/>
      <circle cx="44" cy="34" r="2" fill="black"/>
      <circle cx="56" cy="34" r="2" fill="black"/>
      <!-- Nose -->
      <ellipse cx="50" cy="40" rx="3" ry="2" fill="#5D3A1A"/>
      <!-- Mouth -->
      <path d="M 43 45 Q 50 50 57 45" fill="none" stroke="#5D3A1A" stroke-width="2" stroke-linecap="round"/>
      <!-- Ears -->
      <ellipse cx="22" cy="30" rx="6" ry="8" class="gorilla-body" fill="#9B59B6"/>
      <ellipse cx="78" cy="30" rx="6" ry="8" class="gorilla-body" fill="#9B59B6"/>
    </svg>
  `;
}

// Login Handler
joinBtn.addEventListener('click', () => {
  const nickname = nicknameInput.value.trim();
  const room = roomInput.value.trim();
  
  if (!nickname) {
    nicknameInput.style.boxShadow = '0 0 0 3px #E74C3C';
    setTimeout(() => {
      nicknameInput.style.boxShadow = '';
    }, 500);
    return;
  }
  
  myUsername = nickname;
  socket.emit('join', { username: nickname, room: room || 'default' });
  
  // Switch screens
  loginScreen.classList.remove('active');
  chatScreen.classList.add('active');
  
  currentUser.textContent = `You: ${nickname}`;
  messageInput.focus();
});

// Enter key on nickname input
nicknameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinBtn.click();
  }
});

// Leave Handler
leaveBtn.addEventListener('click', () => {
  socket.disconnect();
  location.reload();
});

// Create Gorilla User Element
function createGorillaElement(socketId, username, color, x, y) {
  const gorilla = document.createElement('div');
  gorilla.className = 'gorilla-user';
  gorilla.id = `user-${socketId}`;
  gorilla.style.left = `${x}px`;
  gorilla.style.top = `${ypx`;
  
  gorilla.innerHTML = `
    <div class="gorilla-avatar">
      ${getGorillaSVG(color)}
    </div>
    <div class="username-label">${username}</div>
    <div class="speech-container"></div>
  `;
  
  // Make draggable
  makeDraggable(gorilla, socketId);
  
  chatArea.appendChild(gorilla);
  return gorilla;
}

// Draggable functionality
function makeDraggable(element, socketId) {
  let isDragging = false;
  let startX, startY, initialLeft, initialTop;
  
  element.addEventListener('mousedown', (e) => {
    if (socketId !== socket.id) return; // Only drag yourself
    
    isDragging = true;
    element.classList.add('dragging');
    
    startX = e.clientX;
    startY = e.clientY;
    initialLeft = element.offsetLeft;
    initialTop = element.offsetTop;
    
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    let newLeft = initialLeft + dx;
    let newTop = initialTop + dy;
    
    // Keep within bounds
    const maxX = chatArea.clientWidth - element.clientWidth;
    const maxY = chatArea.clientHeight - element.clientHeight;
    
    newLeft = Math.max(0, Math.min(newLeft, maxX));
    newTop = Math.max(0, Math.min(newTop, maxY));
    
    element.style.left = `${newLeft}px`;
    element.style.top = `${newTop}px`;
    
    // Update position in users map
    if (users.has(socketId)) {
      users.get(socketId).x = newLeft;
      users.get(socketId).y = newTop;
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      element.classList.remove('dragging');
    }
  });
}

// Show Speech Bubble
function showSpeechBubble(socketId, message) {
  const user = users.get(socketId);
  if (!user) return;
  
  const container = user.element.querySelector('.speech-container');
  
  // Remove existing bubble
  const existingBubble = container.querySelector('.speech-bubble');
  if (existingBubble) {
    existingBubble.remove();
  }
  
  // Create new bubble
  const bubble = document.createElement('div');
  bubble.className = 'speech-bubble';
  bubble.textContent = message;
  container.appendChild(bubble);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    bubble.remove();
  }, 5000);
}

// Show System Message
function showSystemMessage(text) {
  const msg = document.createElement('div');
  msg.className = 'system-message';
  msg.textContent = text;
  chatArea.appendChild(msg);
  
  setTimeout(() => {
    msg.remove();
  }, 3000);
}

// Typing indicator
let typingTimeout;
function updateTypingIndicator() {
  const typingUsers = [];
  users.forEach((user, socketId) => {
    if (user.isTyping && socketId !== socket.id) {
      typingUsers.push(user.username);
    }
  });
  
  if (typingUsers.length === 0) {
    typingIndicator.textContent = '';
  } else if (typingUsers.length === 1) {
    typingIndicator.textContent = `${typingUsers[0]} is typing...`;
  } else {
    typingIndicator.textContent = `${typingUsers.length} people are typing...`;
  }
}

// Send Message
function sendMessage() {
  const message = messageInput.value.trim();
  if (!message) return;
  
  socket.emit('chat message', { message });
  messageInput.value = '';
  
  // Show own bubble immediately
  showSpeechBubble(socket.id, message);
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

// Typing events
messageInput.addEventListener('input', () => {
  socket.emit('typing', true);
  
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing', false);
  }, 1000);
});

// Socket Event Handlers


socket.on('connect', () => {
  mySocketId = socket.id;
  console.log('Connected to server:', socket.id);
});

socket.on('user count', (count) => {
  userCount.textContent = `${count} user${count !== 1 ? 's' : ''} online`;
});

socket.on('user joined', (data) => {
  showSystemMessage(data.message);
  
  const x = Math.floor(Math.random() * (chatArea.clientWidth - 100));
  const y = Math.floor(Math.random() * (chatArea.clientHeight - 120));
  const color = gorillaColors[Math.floor(Math.random() * gorillaColors.length)];
  
  const element = createGorillaElement(data.socketId, data.username, color, x, y);
  
  users.set(data.socketId, {
    username: data.username,
    element: element,
    x; y,
    color: color,
    isTyping: false
  });
});

socket.on('user left', (data) => {
  showSystemMessage(data.message);
  
  const user = users.get(data.socketId);
  if (user) {
    user.element.remove();
    users.delete(data.socketId);
  }
});

socket.on('chat message', (data) => {
  if (data.socketId !== socket.id) {
    showSpeechBubble(data.socketId, data.message);
  }
});

socket.on('typing', (data) => {
  const user = users.get(data.socketId);
  if (user) {
    user.isTyping = data.isTyping;
    updateTypingIndicator();
  }
});

socket.on('init', (data) => {
  myColor = gorillaColors[Math.floor(Math.random() * gorillaColors.length)];
  
  const x = Math.floor(Math.random() * (chatArea.clientWidth - 100));
  const y = Math.floor(Math.random() * (chatArea.clientHeight - 120);
  
  const element = createGorillaElement(socket.id, myUsername, myColor, x, y);
  
  users.set(socket.id, {
    username: myUsername,
    element: element,
    x: x,
    y: y,
    color: myColor,
    isTyping: false
  });
  
  if (data.users) {
    data.users.forEach(user => {
      if (user.socketId !== socket.id) {
        const ux = Math.floor(Math.random() * (chatArea.clientWidth - 100));
        const uy = Math.floor(Math.random() * (chatArea.clientHeight - 120));
        const ucolor = gorillaColors[Math.floor(Math.random() * gorillaColors.length)];
        
        const uelement = createGorillaElement(user.socketId, user.username, ucolor, ux, uy);
        
        users.set(user.socketId, {
          username: user.username,
          element: uelement,
          x: ux,
          y: uy,
          color: ucolor,
          isTyping: false
        });
      }
    });
  }
});