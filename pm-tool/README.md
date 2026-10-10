# BoardFlow — Mini Project Management Tool

A collaborative Trello/Asana-style tool: projects, boards with lists,
task cards, assignment, comments, and **real-time updates over WebSockets**.
Built with Express.js, Socket.IO, SQLite, and vanilla HTML/CSS/JS.

## Features
- Auth (register/login/logout, bcrypt-hashed passwords, sessions)
- Create projects, add teammates by username
- Trello-style board: lists (columns) + task cards, drag-and-drop between lists
- Assign tasks to project members, set due dates
- Comment threads on each task
- In-app notification bell (assigned to a task, added to a project, someone commented)
- **Real-time**: when one teammate moves a card, assigns a task, or comments,
  everyone else viewing that board sees it update live — no refresh needed.
  Socket.IO shares the same login session as the REST API, so a socket is
  authenticated automatically from the browser's existing cookie.

## Tech stack
- Backend: Node.js + Express.js
- Real-time: Socket.IO (session-authenticated WebSocket connections)
- Database: SQLite (via better-sqlite3) — single `pm.db` file, auto-created
- Auth: express-session + bcryptjs
- Frontend: plain HTML, CSS, JavaScript (fetch API + Socket.IO client, no framework)

## Setup

```bash
npm install
npm start
```

Open http://localhost:3002 in your browser.

Two demo accounts + a demo project are seeded automatically:
- asha@example.com / password123
- rahul@example.com / password123

**To see real-time updates in action**: log in as Asha in one browser window
and Rahul in another (or a private/incognito window), open the same project
board in both, then move a card or add a comment in one — it updates in the
other instantly.

Delete `pm.db` (and `-wal`/`-shm` files) to reset all data.

## Database design (the core learning point of this project)

```
users ---< project_members >--- projects ---< lists ---< tasks >--- users (assignee)
                                                            |
                                                            >--- task_comments
users ---< notifications
```

- `project_members` is a junction table (many-to-many: users ↔ projects),
  with a `role` column ('owner' | 'member').
- `tasks.assignee_id` is a second foreign key to `users` — a task has both
  a creator (`created_by`) and an assignee, which is a common real-world
  pattern worth noticing.
- `notifications` stores events so they're visible even if you weren't
  online when they happened; Socket.IO is used additionally to push them
  live if you ARE online.

## How the real-time layer works (routes/projects.js, routes/tasks.js, server.js)

1. `server.js` creates one `express-session` middleware and shares it with
   both Express (`app.use`) and Socket.IO (`io.engine.use`) — so a
   WebSocket connection automatically knows which logged-in user it
   belongs to, with no separate token.
2. Each connected socket joins a personal room (`user:<id>`) for direct
   notifications, and a `project:<id>` room when viewing that board
   (after a server-side membership check).
3. Whenever a route changes something (task created/moved/deleted, list
   created, comment posted), it calls `io.to('project:<id>').emit(...)`
   so everyone on that board's page updates instantly.
4. Assignment and comment notifications additionally call
   `io.to('user:<id>').emit('notification', ...)` to update that one
   person's bell icon live, wherever they are in the app.

## Project structure

```
server.js           - Express + Socket.IO setup, shared session
db.js                - SQLite schema + seed data
routes/
  auth.js            - register, login, logout, /me, user search
  projects.js        - create/list/view projects, add members, add lists
  tasks.js           - create/move/assign/delete tasks, comments
  notifications.js   - list notifications, mark all read
public/
  index.html, board.html, task.html, login.html, register.html
  css/style.css
  js/app.js          - shared nav, fetch helper, Socket.IO connection, notif bell
  js/*.js            - one script per page
```

## Where to go from here
- Swap SQLite for MongoDB + Mongoose to match a MERN curriculum.
- Add role-based permissions (only the owner can delete the project).
- Add due-date reminders (a scheduled job that checks for tasks due soon).
- Persist drag-and-drop ordering within a list (the `position` column is
  already there — just needs a reorder endpoint).
