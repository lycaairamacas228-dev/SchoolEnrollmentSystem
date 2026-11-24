
# School Enrollment System

Responsive full-stack school enrollment application built with React, Vite, Node.js, Express and SQLite.

## Requirements
- Node.js 18+
- npm

## Run locally
Open two terminals.

### 1) Backend
```bash
cd server
npm install
npm run dev
```
API: http://localhost:5000

### 2) Frontend
```bash
cd client
npm install
npm run dev
```
Open the URL printed by Vite (usually http://localhost:5173).

The SQLite database is created automatically at `server/data/school.db` and seeded with demo courses, subjects, and accounts.

## Demo accounts
- Admin: `admin@school.edu` / `Admin123!`
- Student: `student@school.edu` / `Student123!`

Change demo passwords before deploying. This project is a local development starter; production deployment should add HTTPS, rate limiting, email verification, backups, and a stronger operational security review.

## Features
- Student registration, login and logout (bcrypt password hashing, JWT auth)
- Student profile and dashboard
- Course and subject catalog
- Enrollment application with school year, semester and selected subjects
- Enrollment status tracking and history
- Admin dashboard with summary counts
- Admin CRUD for courses and subjects
- Admin review / approval / rejection of enrollment applications
- Student records and CSV export
- Responsive mobile/tablet/desktop UI
