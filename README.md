# FMD Lead Management System

A comprehensive CRM application for managing sales leads with real-time email integration, persistent notifications, and company organization features.

## Features

- 📊 **Lead Management**: Track and manage sales leads with different statuses
- ✉️ **Email Integration**: Send and receive emails with Microsoft Outlook integration
- 🔔 **Real-time Notifications**: Persistent notification bell with unread email counts that survive page refreshes
- 📥 **Import Leads**: Import from Excel/CSV files
- 🏢 **Company Management**: Organize leads by company with filtering capabilities
- 📈 **Dashboard**: View statistics and recent leads
- 🔍 **Search & Filter**: Easily find and filter leads by name, email, status, or company
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

### Email Integration

This system supports two email providers: **Microsoft Outlook** (default, recommended) and **SendGrid** (alternative).

**Default Provider:** Microsoft Outlook/Microsoft 365

To switch providers, set in `.env`:
```env
EMAIL_PROVIDER=microsoft  # Default (recommended for full threading support)
# or
EMAIL_PROVIDER=sendgrid   # Alternative
```

#### Microsoft Outlook (Default - Recommended)
Configure Microsoft Graph API credentials in `.env`:
```env
EMAIL_PROVIDER=microsoft
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=your-tenant-id
EMAIL_FROM_ADDRESS=your-email@company.com
```

**Advantages:**
- ✅ Full email threading with createReply API
- ✅ Automatic email reply detection
- ✅ Two-way email sync (send & receive)
- ✅ Conversation tracking
- ✅ Native Outlook integration

**Setup:**
1. Register an app in Azure AD
2. Add Microsoft Graph API permissions (Mail.ReadWrite, Mail.Send)
3. Generate a client secret
4. Configure the credentials in `.env`

See `MICROSOFT_EMAIL_SETUP.md` for detailed setup instructions.

#### SendGrid (Alternative)
Configure SendGrid API in `.env`:
```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-api-key
SENDGRID_FROM_EMAIL=your-verified-sender@example.com
SENDGRID_REGION=eu  # or 'us' for US region
```

**Advantages:**
- ✅ Simple setup
- ✅ High deliverability
- ✅ Email threading via headers

**Note:** Requires SendGrid Inbound Parse webhook for receiving replies.

**Setup:**
1. Create a SendGrid account
2. Generate an API key with Mail Send permissions
3. Verify your sender email address
4. Set the appropriate region (eu or us)
5. Configure Inbound Parse webhook for reply notifications

See `SENDGRID-SETUP.md` and `SENDGRID-INBOUND-SETUP.md` for detailed setup instructions.

#### Email Notifications
The system automatically displays notifications in the header bell icon when leads reply to emails:
- **Microsoft Outlook**: Polls for new emails every 2 minutes
- **SendGrid**: Receives replies via Inbound Parse webhook

Notifications persist across page refreshes and are cleared when you open the lead's details.

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
- `body` - Email body (supports HTML)
- `direction` - 'sent' or 'received'
- `messageId` - Microsoft Graph message ID for tracking
- `conversationId` - Thread ID for grouping emails
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
- `POST /api/emails/sync` - Manually trigger email sync
- `GET /api/notifications/emails` - Get new email notifications

### Import
- `POST /api/import/file` - Upload Excel/CSV

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
