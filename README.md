# CRM Lead Management System

A comprehensive CRM application for managing sales leads with email sending and Google Sheets import capabilities.

## Features

- 📊 **Lead Management**: Track and manage sales leads with different statuses
- ✉️ **Email Integration**: Send emails to leads (console logging in development, SMTP in production)
- 📥 **Import Leads**: Import from Excel/CSV files or Google Sheets
- 📈 **Dashboard**: View statistics and recent leads
- 🔍 **Search & Filter**: Easily find and filter leads
- 💾 **Database**: PostgreSQL with Drizzle ORM

## Technology Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS + Shadcn UI components
- TanStack Query for data fetching
- Wouter for routing

### Backend
- Node.js with Express
- TypeScript
- PostgreSQL (Supabase/Neon compatible)
- Drizzle ORM

## Setup

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database (Supabase, Neon, or local)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd SalesEmail-main
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Copy `.env` and update with your database URL:
   ```env
   DATABASE_URL=postgresql://user:password@host:port/database
   ```

4. **Push database schema**
   ```bash
   npm run db:push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```
   
   The app will be available at `http://localhost:5000`

## Configuration

### Database
Set your PostgreSQL connection string in `.env`:
```env
DATABASE_URL=postgresql://user:password@host:port/database
```

### Email Sending (Optional)

#### Development Mode (Default)
Emails are logged to console - no configuration needed.

#### Production SMTP
To send real emails, configure SMTP in `.env`:
```env
EMAIL_FROM=your-email@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
```

**Gmail Setup:**
1. Enable 2-factor authentication
2. Create an App Password: Google Account → Security → App Passwords
3. Use the app password as `SMTP_PASS`

### Google Sheets Import (Optional)

#### Public Sheets
No configuration needed for publicly accessible sheets.

#### Private Sheets - Service Account (Recommended)
1. Create a Google Cloud project
2. Enable Google Sheets API
3. Create a service account and download JSON key
4. Share your sheet with the service account email
5. Add to `.env`:
   ```env
   GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
   ```

#### Private Sheets - OAuth
1. Create OAuth credentials in Google Cloud Console
2. Get refresh token using OAuth flow
3. Add to `.env`:
   ```env
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REFRESH_TOKEN=your-refresh-token
   ```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run db:push` - Push database schema changes
- `npm run check` - Type check

## Database Schema

### Leads Table
- `id` - UUID primary key
- `clientName` - Client name
- `email` - Email address
- `leadDetails` - Additional details
- `status` - Lead status (New, Contacted, Qualified, etc.)
- `companyId` - Optional company reference
- `createdAt` - Creation timestamp
- `updatedAt` - Update timestamp

### Emails Table
- `id` - UUID primary key
- `leadId` - Reference to lead
- `subject` - Email subject
- `body` - Email body
- `direction` - 'sent' or 'received'
- `sentAt` - Timestamp

### Companies Table
- `id` - UUID primary key
- `name` - Company name
- `createdAt` - Creation timestamp

## API Endpoints

### Leads
- `GET /api/leads` - Get all leads
- `GET /api/leads/:id` - Get specific lead
- `POST /api/leads` - Create new lead
- `PATCH /api/leads/:id/status` - Update lead status
- `POST /api/leads/:id/send-email` - Send email to lead

### Emails
- `GET /api/emails/:leadId` - Get emails for a lead

### Import
- `POST /api/import/file` - Upload Excel/CSV
- `POST /api/import/sheets` - Import from Google Sheets URL

### Companies
- `GET /api/companies` - Get all companies
- `POST /api/companies` - Create new company

## Development

The application uses a single server that serves both the API and the frontend:
- API endpoints: `http://localhost:5000/api/*`
- Frontend: `http://localhost:5000`

In development mode, Vite's dev server is integrated with the Express backend for hot module replacement.

## Production Build

```bash
npm run build
npm start
```

The build creates optimized static files and a Node.js server bundle.

## License

MIT
