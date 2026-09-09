# MetrologyCheck — Legal Metrology Compliance Checker

**SIH26034 · Phase 2**

MetrologyCheck is a React + Node.js + PostgreSQL prototype for scanning packaged-commodity labels, extracting declarations with OCR, checking mandatory declarations against prototype Legal Metrology rules, and storing inspection history.

This version also includes **real account authentication**:

- Mandatory email/password signup before local login.
- Secure password hashing with `bcryptjs`.
- JWT-based authenticated sessions.
- Protected application routes.
- Google OAuth 2.0 login/signup.
- Three project roles: `INSPECTOR`, `SUPERVISOR`, and `ADMIN`.
- New self-registered accounts are safely created as `INSPECTOR`.
- No hard-coded demo users are seeded by the server.
- Responsive login, signup, dashboard, inspection and result screens.

> **Important:** This is a college-project prototype, not a legal certification system. The OCR and rule engine are assistive and should be reviewed by an authorized person before any enforcement decision.

---

## 1. Technology stack

### Frontend

- React
- Vite
- React Router
- Lucide React
- Responsive CSS

### Backend

- Node.js
- Express
- PostgreSQL
- `pg`
- JWT (`jsonwebtoken`)
- Password hashing (`bcryptjs`)
- Google OAuth 2.0 (`passport-google-oauth20`)
- Multer for image uploads
- Sharp for image preprocessing
- Tesseract.js for OCR

---

## 2. Project structure

```text
legal-metrology-phase1/
├── README.md
├── backend/
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── config/
│       │   ├── db.js
│       │   ├── env.js
│       │   └── schema.sql
│       ├── controllers/
│       │   ├── authController.js
│       │   └── inspectionController.js
│       ├── middleware/
│       │   ├── auth.js
│       │   └── upload.js
│       ├── routes/
│       │   ├── authRoutes.js
│       │   └── inspectionRoutes.js
│       ├── services/
│       │   ├── inspectionService.js
│       │   ├── ocrService.js
│       │   └── userService.js
│       └── utils/
│           ├── declarationDetector.js
│           └── rules.js
└── frontend/
    ├── .env.example
    ├── index.html
    ├── package.json
    ├── public/
    │   └── favicon.svg
    └── src/
        ├── components/
        │   └── Layout.jsx
        ├── pages/
        │   ├── Dashboard.jsx
        │   ├── History.jsx
        │   ├── Inspect.jsx
        │   ├── Login.jsx
        │   ├── Result.jsx
        │   └── Signup.jsx
        ├── services/
        │   └── api.js
        ├── main.jsx
        └── styles.css
```

---

# 3. Authentication flow

## Local email/password authentication

The flow is:

```text
Signup page
    ↓
POST /api/auth/signup
    ↓
Validate name/email/password
    ↓
Check duplicate email
    ↓
Hash password with bcrypt
    ↓
Store user in PostgreSQL
    ↓
Redirect to Login
    ↓
User enters email + password
    ↓
POST /api/auth/login
    ↓
Compare password with bcrypt hash
    ↓
Create JWT
    ↓
Store JWT in browser localStorage
    ↓
Protected routes call /api/auth/me
    ↓
Dashboard / inspections become available
```

### Security behavior

- Passwords are never stored as plain text.
- The database stores a bcrypt hash in `password_hash`.
- JWT contains the authenticated user's ID and role.
- Every protected API request sends:

```http
Authorization: Bearer <JWT>
```

- The backend verifies the token and loads the current user from PostgreSQL.
- If the token is invalid, expired, or the account no longer exists, the request is rejected.
- Self-registration always creates an `INSPECTOR` account. Users cannot choose `ADMIN` or `SUPERVISOR` during signup.

---

# 4. Google authentication setup

Google login is implemented with **OAuth 2.0** using Passport's Google strategy.

## Step 1 — Create a Google Cloud project

1. Open Google Cloud Console:
   https://console.cloud.google.com/
2. Create a new project for the college project, for example:
   `MetrologyCheck-SIH26034`
3. Select the project.

## Step 2 — Configure the OAuth consent screen

In Google Cloud Console:

1. Open **Google Auth Platform** / **OAuth consent screen**.
2. Choose the appropriate application/user type for your project.
3. Enter the application name:
   `MetrologyCheck`
4. Add a support/developer email as required by Google.
5. Add the scopes needed for basic identity information. The application requests:
   - `profile`
   - `email`
6. For local development, add your Google account as a test user if Google's project configuration requires it.

## Step 3 — Create OAuth client credentials

Create an **OAuth Client ID** for a web application.

Use this local development origin:

```text
http://localhost:5174
```

Add this exact authorized redirect URI:

```text
http://localhost:5000/api/auth/google/callback
```

The redirect URI must match the backend `.env` value exactly.

Google will provide:

```text
Client ID
Client Secret
```

Keep the client secret private. Do not commit it to GitHub.

## Step 4 — Configure backend `.env`

Copy:

```text
backend/.env.example
```

to:

```text
backend/.env
```

Then configure:

```env
PORT=5000
CORS_ORIGIN=http://localhost:5174,http://localhost:5173
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/legal_metrology
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1d
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
FRONTEND_URL=http://localhost:5174
OCR_LANG=eng
```

## Step 5 — Configure frontend `.env`

Copy:

```text
frontend/.env.example
```

to:

```text
frontend/.env
```

Use:

```env
VITE_API_URL=http://localhost:5000/api
VITE_BACKEND_URL=http://localhost:5000
```

## Step 6 — Test Google login

Start the backend:

```bash
cd backend
npm install
npm run dev
```

Start the frontend in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5174
```

Click:

```text
Continue with Google
```

Google authenticates the user and redirects to:

```text
http://localhost:5000/api/auth/google/callback
```

The backend finds or creates the user, creates a JWT, and redirects the browser to:

```text
http://localhost:5174/oauth-callback?token=<JWT>
```

The React app stores the token and opens the dashboard.

### First Google login

If the Google email does not already exist in PostgreSQL, the application creates a new user with:

```text
role = INSPECTOR
```

If the Google email already exists as a local account, the Google ID is linked to that account.

---

# 5. PostgreSQL setup

Make sure PostgreSQL is installed and running.

Create the database:

```sql
CREATE DATABASE legal_metrology;
```

The backend automatically executes:

```text
backend/src/config/schema.sql
```

on startup, so the tables do not need to be created manually after the database exists.

The main tables are:

- `users`
- `inspections`
- `inspection_images`

## Verify the database

Using `psql`:

```bash
psql -U postgres -h localhost
```

Then:

```sql
\\l
\\c legal_metrology
\\dt
```

If Windows says `psql` is not recognized, use the PostgreSQL installation path, for example:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost
```

Change `16` if your installed PostgreSQL version is different.

---

# 6. Installation and running

## Backend

```bash
cd backend
npm install
```

Create `backend/.env` and configure PostgreSQL/JWT/Google values.

Then:

```bash
npm run dev
```

Expected output:

```text
Database ready.
Legal Metrology backend running on http://localhost:5000
```

## Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal. The project is configured for `http://localhost:5174` by default because the Google OAuth documentation uses port 5174.

---

# 7. Real authentication usage

There are two normal ways to enter the application.

### Option A — Email/password

1. Open `/signup`.
2. Create an account.
3. The backend stores the bcrypt password hash.
4. You are redirected to `/login`.
5. Sign in with the newly created credentials.
6. The backend returns a JWT.
7. The protected dashboard opens.

### Option B — Google

1. Open `/login` or `/signup`.
2. Select Google authentication.
3. Complete Google consent/login.
4. The backend creates or finds the user.
5. A JWT is issued.
6. The user is redirected to the dashboard.

No demo email/password account is automatically inserted by the application.

---

# 8. Roles

The project defines three roles:

| Role | Intended access |
|---|---|
| Inspector | Create inspections, upload package images, view own inspection records |
| Supervisor | View inspections in the relevant jurisdiction and approve/follow up |
| Admin | Manage users, configure rules and view system-wide analytics |

For safety, public signup only creates `INSPECTOR` accounts. `SUPERVISOR` and `ADMIN` should be assigned through a controlled administrative process rather than allowing a visitor to select those roles during signup.

The database constraint also restricts role values to:

```text
INSPECTOR
SUPERVISOR
ADMIN
```

---

# 9. Phase 2 inspection pipeline

```text
Package image upload
        ↓
Multer receives image
        ↓
Sharp preprocessing
        ↓
Tesseract OCR
        ↓
Text + word bounding boxes
        ↓
Declaration detection
        ↓
Prototype Legal Metrology rule checks
        ↓
Compliance score
        ↓
Violations / missing declarations
        ↓
Inspection saved in PostgreSQL
        ↓
Result page + evidence images
```

The OCR service currently extracts text, confidence and word-level bounding boxes. Precise legal-grade font-size verification is not claimed in this prototype.

---

# 10. Mandatory declaration prototype checks

The declaration detector currently looks for patterns such as:

- Manufacturer / packer / importer
- Common or generic product information
- Net quantity
- MRP
- Month/year of manufacture or packing
- Consumer care phone/email
- Country of origin for imported products
- Best-before / use-by / expiry
- Unit sale price where applicable

The current rule engine is a prototype and should be extended and legally reviewed before real enforcement use.

---

# 11. Common problems and fixes

## `database "legal_metrology" does not exist`

Create it:

```sql
CREATE DATABASE legal_metrology;
```

Then restart the backend.

## `password authentication failed for user "postgres"`

Check the password in:

```text
backend/.env
```

The password must match the PostgreSQL `postgres` user.

## `EADDRINUSE: address already in use :::5000`

Another process is using port 5000.

Windows:

```powershell
netstat -ano | findstr :5000
```

Then kill the PID:

```powershell
taskkill /PID <PID> /F
```

## Google redirects to an error

Check that these values match exactly:

```text
Google Authorized redirect URI
        =
GOOGLE_CALLBACK_URL
```

For this project:

```text
http://localhost:5000/api/auth/google/callback
```

Also make sure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are present in `backend/.env`.

## Google says redirect URI mismatch

The most common cause is using `localhost:5173` in Google while the backend callback is configured for `localhost:5000`.

The **redirect URI is the backend callback**, not the frontend URL:

```text
http://localhost:5000/api/auth/google/callback
```

The frontend URL is configured separately as:

```env
FRONTEND_URL=http://localhost:5174
```

## Frontend CORS error

If Vite is running on 5174, make sure backend `.env` includes:

```env
CORS_ORIGIN=http://localhost:5174,http://localhost:5173
```

Restart the backend after changing `.env`.

## `Chrome` is not exported by lucide-react

The Google button intentionally uses `Globe2` from `lucide-react` instead of the unavailable `Chrome` export.

## `favicon.ico` 404

This version includes a local SVG favicon at:

```text
frontend/public/favicon.svg
```

so the previous favicon request should no longer be necessary.

---

# 12. Important security notes

For a college/local demonstration, the current JWT + bcrypt + Google OAuth flow is suitable as a prototype. Before production deployment:

- Use HTTPS.
- Store secrets in a secret manager or secure deployment environment.
- Use secure, HTTP-only cookies instead of localStorage for production session handling.
- Rotate JWT secrets when required.
- Add rate limiting and account lockout/abuse controls.
- Add email verification and password reset flows.
- Add CSRF protection where applicable.
- Add audit logging for privileged actions.
- Add controlled user provisioning for Supervisor/Admin roles.
- Restrict uploaded file types and scan uploads for malicious content.
- Move uploads to secure object storage instead of local disk.
- Apply database migrations rather than relying on startup schema creation.

---

# 13. Current scope

This package represents the **Phase 2 frontend/backend prototype**.

Included:

- Real local signup/login
- bcrypt password hashing
- JWT authentication
- Google OAuth 2.0 setup
- Role-aware user model
- PostgreSQL persistence
- Protected routes
- Responsive UI
- Image upload
- OCR preprocessing
- Tesseract OCR
- Declaration detection
- Prototype compliance rules
- Inspection history
- Compliance result screen
- Evidence image storage

Not yet included as production features:

- Production-grade legal rule certification
- Exact legal font-size metrology measurement
- Production deployment
- Production secret management
- Advanced supervisor/admin workflow UI
- Email verification/password reset
- Full audit/event logging
- Production object storage

---

## License / academic use

This project is prepared as a college/SIH prototype for SIH26034. Review the applicable Legal Metrology legislation and rules with an authorized subject-matter expert before using results for real enforcement decisions.
