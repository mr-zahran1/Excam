# Ahmed Finance Exam Platform — Full MVP

A production-oriented exam platform built for Cloudflare Workers + Cloudflare D1, with a visual language aligned to the Ahmed Elsheshtawy finance portfolio: warm off-white surfaces, graphite text, orange accent, thin borders, quiet cards, generous spacing, and responsive layouts.

## Included

### Student
- Registration
- Automatic Student ID generation
- Secure login by Student ID or email
- Server-side session cookie
- Dashboard
- Active exam list
- Exam entry
- Server-enforced timer
- Multiple-choice questions
- Correct answers never sent to the student browser
- Submit + automatic grading
- Pass/fail result
- Personal result history

### Admin
- Secure admin login
- One-time bootstrap for first super admin
- Overview statistics
- Student search
- Student detail view
- Student ID visibility
- Block/activate students
- Create/edit/delete exams
- Activate/deactivate exams
- Set duration
- Set passing percentage
- Full question management
- Add/edit/delete questions
- Set correct answers
- Set points and order
- Results search
- Result detail with answer review
- Super-admin management of admin accounts

## Architecture

```text
Browser
  |
  v
Cloudflare Worker
  |-- Authentication / sessions
  |-- Authorization
  |-- Exam API
  |-- Grading API
  |-- Admin API
  |
  +--> Cloudflare D1 (SQLite)
  |
  +--> Static Assets (public/)
```

## Database

Tables:
- users
- admin_users
- exams
- questions
- exam_attempts
- answers
- results
- sessions

Passwords use PBKDF2-SHA-256 with a random salt. Sessions are opaque random IDs stored server-side and sent in Secure, HttpOnly, SameSite cookies.

## Setup

### 1. Install

```bash
npm install
```

### 2. Create D1

```bash
npx wrangler d1 create ahmed-finance-exam-db
```

Copy the returned database ID into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "ahmed-finance-exam-db"
database_id = "YOUR_DATABASE_ID"
migrations_dir = "migrations"
```

### 3. Apply migration

Remote:

```bash
npx wrangler d1 migrations apply DB --remote
```

Local development:

```bash
npm run db:migrate:local
```

### 4. Create the first super admin

Set a Wrangler secret:

```bash
npx wrangler secret put ADMIN_BOOTSTRAP_SECRET
```

Deploy first:

```bash
npm run deploy
```

Then call the one-time bootstrap endpoint from an authenticated API client:

```http
POST /api/setup/admin
x-bootstrap-secret: YOUR_BOOTSTRAP_SECRET
content-type: application/json

{
  "username": "admin",
  "password": "change-this-password"
}
```

The endpoint locks permanently after the first admin is created.

### 5. Deploy

```bash
npm run deploy
```

## Security notes

- Passwords are never stored in plain text.
- Correct answers are selected only on the server during grading.
- Admin APIs require an admin session.
- Student APIs require a student session.
- SQL uses D1 prepared statements and bound parameters.
- Exam duration is checked server-side during start and submission.
- Sessions are stored in D1, not localStorage.
- Frontend state is only UI state; authentication and grading are server-side.
- Origin checking is applied to API requests that provide an Origin header.

## Important deployment step

Do not commit the real D1 database ID or any bootstrap secret to a public repository if your repository is public. Use Wrangler secrets for sensitive values.
