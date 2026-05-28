# Stitch Tailoring & Design

Stitch is a tailoring and design application split into separate frontend and backend folders.

```text
frontend/  Next.js user interface
backend/   Node.js Express API with SQL Server
```

## Tech Stack

Frontend:

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Toastr CDN CSS

Backend:

- Node.js
- Express
- SQL Server
- mssql
- msnodesqlv8 for Windows Authentication
- bcryptjs
- Twilio SMS API for OTP delivery

## Main Features

- Responsive Stitch home page
- User role-based access (User vs Tailor)
- Register and login pages with role selection
- SQL Server powered auth API
- Password hashing with bcryptjs
- Logout and protected page behavior
- Profile page with editable details and image upload
- About, Collection, Careers, and Blog pages
- YouTube training video on the Blog page
- User booking system with pick-up and drop-off
- Tailor join application system

## User Roles

**User Role:**
- Can access: Home, About, Collection, Careers, Blog
- Can book tailoring services via "/booking"
- Can manage profile

**Tailor Role:**
- Can access: Home, Careers, Blog only
- Can view join applications history
- Cannot book services
- Can view career opportunities

Navigation dynamically adjusts based on user role after login.

Frontend routes:

| Route | Access | Description |
| --- | --- | --- |
| `/` | Public | Home page |
| `/login` | Public | Login page |
| `/register` | Public | Register page |
| `/booking` | Protected | Book Now page with pick-up and drop-off booking form |
| `/join` | Public | Join Stitch - Application form for tailors and designers |
| `/profile` | Protected | Editable profile page |
| `/about` | Protected | About Us page |
| `/collection` | Protected | Collection page |
| `/careers` | Protected | Careers page |
| `/blog` | Protected | Blog page |

Backend routes:

| Route | Method | Description |
| --- | --- | --- |
| `/health` | GET | Backend health check |
| `/api/auth/register` | POST | Register user |
| `/api/auth/login` | POST | Login user |
| `/api/bookings` | POST | Save pickup/drop-off booking |
| `/api/bookings` | GET | List pickup/drop-off bookings |
| `/api/join` | POST | Submit join application |
| `/api/join` | GET | List all join applications |
| `/api/tailors?location=...` | GET | Search available tailors by pickup location |

## Important Files

```text
frontend/app/page.tsx                         Home page
frontend/app/booking/page.tsx                 Book Now page with booking form
frontend/app/join/page.tsx                    Join Stitch application form
frontend/app/login/page.tsx                   Login page
frontend/app/register/page.tsx                Register page
frontend/app/profile/page.tsx                 Profile page
frontend/app/components/AuthForm.tsx          Calls backend login/register APIs
frontend/app/components/BookingForm.tsx       Pick-up and drop-off booking form
frontend/app/components/AuthActions.tsx       Navbar auth/profile/logout actions
frontend/app/components/AuthGuard.tsx         Protected route guard
frontend/app/components/ProtectedLink.tsx     Blocks protected links when logged out
frontend/app/components/Toast.tsx             Toastr-compatible messages
frontend/.env.example                         Frontend API URL example

backend/server.js                             Express server
backend/db.js                                 SQL Server connection helper
backend/database.sql                          SQL Server database/table script
backend/.env.example                          Backend SQL config example
```

## SQL Server Setup

Run this script in SQL Server:

```text
backend/database.sql
```

Create `backend/.env` from `backend/.env.example`.

For your SSMS connection `SAGAR\SQLEXPRESS` with Integrated Security, use:

```text
PORT=4000
FRONTEND_URL=http://localhost:3000
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+15551234567
SQL_SERVER=localhost
SQL_AUTH_TYPE=windows
SQL_SERVER=SAGAR\SQLEXPRESS
SQL_DATABASE=stitch
SQL_CONNECTION_STRING=Driver={ODBC Driver 17 for SQL Server};Server=SAGAR\SQLEXPRESS;Database=stitch;Trusted_Connection=Yes;Encrypt=Yes;TrustServerCertificate=Yes;Application Name=Stitch Backend
```

Create `frontend/.env.local` from `frontend/.env.example`:

```text
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Run Locally

Install backend dependencies:

```bash
cd backend
npm install
```

Start backend:

```bash
cd backend
npm run dev
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

Start frontend in another terminal:

```bash
cd frontend
npm run dev
```

Open:

```text
http://localhost:3000
```

## Build and Lint

Frontend lint:

```bash
cd frontend
npm run lint
```

Frontend build:

```bash
cd frontend
npm run build
```

Backend start:

```bash
cd backend
npm run start
```

## Notes

- The frontend stores a simple `stitch-auth` flag after successful backend login/register.
- Login OTPs are sent by SMS when Twilio environment variables are configured.
- Without Twilio settings, the backend logs the OTP and returns `devOtp` for local development.
- User role is stored in `stitch-role` localStorage (user or tailor).
- User data is stored in `stitch-user` localStorage.
- SQL Server stores registered users in the `Users` table with role column.
- SQL Server stores pickup/drop-off requests in the `Bookings` table.
- SQL Server stores join applications in the `JoinApplications` table.
- Booking search shows available tailor cards from matching join applications.
- Passwords are stored as bcrypt hashes, not plain text.
- Profile information is still stored in browser localStorage.
- Join application images are stored as base64 data in the database.
- Role-based navigation: Users see all pages, Tailors see only Careers and Blog.
