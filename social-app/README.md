# Loopline — Mini Social Media App

A full-stack social media app with profiles, posts, comments, likes, and follows.
Built with Express.js, SQLite, and vanilla HTML/CSS/JS.

## Features
- User registration & login (bcrypt-hashed passwords, sessions)
- User profiles (bio, avatar, post count, follower/following counts)
- Follow / unfollow other users
- Create posts, view a global feed or a "following only" feed
- Like / unlike posts
- Comment on posts

## Tech stack
- Backend: Node.js + Express.js
- Database: SQLite (via better-sqlite3) — single `social.db` file, auto-created
- Auth: express-session + bcryptjs
- Frontend: plain HTML, CSS, JavaScript (fetch API, no framework)

## Setup

```bash
npm install
npm start
```

Open http://localhost:3001 in your browser.

Two demo accounts are seeded automatically:
- asha@example.com / password123
- rahul@example.com / password123

Delete `social.db` (and `-wal`/`-shm` files) to reset all data.

## Database design (the core learning point of this project)

```
users -----< posts -----< comments
  |  \
  |   \---(likes: user_id + post_id, many-to-many)---< posts
  |
  \---(follows: follower_id + following_id, self-referencing many-to-many)---/
```

- `likes` and `follows` are junction tables — each row just links two IDs.
  `UNIQUE(post_id, user_id)` on likes stops someone liking a post twice;
  `UNIQUE(follower_id, following_id)` on follows does the same for follows.
- `follows` is self-referencing: both columns point back to the `users` table.
  This is the trickiest relationship in the whole project — worth studying
  `routes/users.js` closely.

## Project structure

```
server.js          - app entry point
db.js               - SQLite schema + seed data (2 demo users, posts, etc.)
routes/
  auth.js           - register, login, logout, /me
  users.js          - profile view, follow/unfollow
  posts.js          - feed, create post, single post + comments, like/unlike
public/
  index.html, profile.html, post.html, login.html, register.html
  css/style.css
  js/app.js         - shared nav, fetch helper, post-card renderer
  js/*.js           - one script per page
```

## Where to go from here
- Swap SQLite for MongoDB + Mongoose (matches a MERN curriculum directly —
  `follows` and `likes` become collections with the same two-ID shape).
- Add image uploads for posts and avatars.
- Add pagination/infinite scroll to the feed.
- Add notifications (someone followed you / liked your post).
