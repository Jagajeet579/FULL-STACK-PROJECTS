const express = require('express');
const session = require('express-session');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const db = require('./db'); // initializes and seeds the database on first run

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const notificationRoutes = require('./routes/notifications');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3002;

const sessionMiddleware = session({
  secret: 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 },
});

app.use(express.json());
app.use(sessionMiddleware);

// Share the same session store with Socket.IO so a socket knows who the
// connected user is from their existing login cookie — no separate token
// handshake needed, and users can't impersonate someone else's socket.
io.engine.use(sessionMiddleware);

app.set('io', io);

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(express.static(path.join(__dirname, 'public')));

// ---------- WebSocket (Socket.IO) events ----------
io.on('connection', (socket) => {
  const userId = socket.request.session?.userId;
  if (!userId) {
    socket.disconnect(true);
    return;
  }

  // Every connected user gets a personal room for direct notifications.
  socket.join(`user:${userId}`);

  // Client asks to join a project's "board room" so it receives live
  // task/comment updates for that board. We check membership first so
  // someone can't eavesdrop on a project they don't belong to.
  socket.on('join-project', (projectId) => {
    const member = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId);
    if (member) socket.join(`project:${projectId}`);
  });

  socket.on('leave-project', (projectId) => {
    socket.leave(`project:${projectId}`);
  });
});

server.listen(PORT, () => {
  console.log(`PM tool running at http://localhost:${PORT}`);
});
