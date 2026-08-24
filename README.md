# Adeeb Cash Flow — Vercel + MongoDB

A full-stack cash-flow application with a separate static frontend and Node.js backend.

## Project structure

- `frontend/index.html` — signup/login entry screen and authenticated dashboard
- `frontend/app.js` — frontend application logic
- `backend/src` — Express API, MongoDB models, authentication and admin routes
- `api/index.js` — Vercel serverless entry point

## Local setup

1. Copy `.env.example` to `.env`.
2. Add your MongoDB Atlas connection string and a long random JWT secret.
3. Set `ADMIN_EMAIL` to the email that should receive admin access on signup.
4. Run `npm install`, then `npm run dev`.
5. Open `http://localhost:3000`.

## Vercel deployment

Import this folder as a Vercel project and add `MONGODB_URI`, `JWT_SECRET`, and `ADMIN_EMAIL` in Project Settings → Environment Variables. The Express backend is deployed as a Node.js Function and the frontend is served statically.
