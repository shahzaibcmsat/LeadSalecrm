import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { insertLeadSchema, insertEmailSchema, insertCompanySchema } from "@shared/schema";
import { sendEmail, isMicrosoftGraphConfigured, getAuthorizationUrl, exchangeCodeForTokens } from "./outlook";
import { sendEmailViaSendGrid, sendEmailViaSendGridAuto, verifySendGridConfig, getSendGridConfig } from "./sendgrid";
import { Client as SendGridClient } from '@sendgrid/client';

// Dynamic email provider (read from environment; can be changed at runtime)
function getProvider(): 'sendgrid' | 'microsoft' {
  const p = (process.env.EMAIL_PROVIDER || 'microsoft').toLowerCase();
  return (p === 'sendgrid' ? 'sendgrid' : 'microsoft');
}

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // OAuth authentication routes for Microsoft Graph
  app.get("/api/auth/microsoft", async (req, res) => {
    try {
      const authUrl = getAuthorizationUrl();
      if (!authUrl) {
        return res.status(500).json({ 
          message: "Microsoft Graph not configured. Please set AZURE_CLIENT_ID and AZURE_CLIENT_SECRET" 
        });
      }
      res.redirect(authUrl);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/auth/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      if (!code) {
        return res.status(400).send("No authorization code provided");
      }

      const tokenResponse = await exchangeCodeForTokens(code);
      
      // Store the tokens securely (in production, use database)
      // For now, just redirect to success page
      res.send(`
        <html>
          <body>
            <h2>✅ Microsoft Account Connected Successfully!</h2>
            <p>You can now close this window and return to the application.</p>
            <script>setTimeout(() => window.close(), 2000);</script>
          </body>
        </html>
      `);
    } catch (error: any) {
      res.status(500).send(`Authentication failed: ${error.message}`);
    }
  });

  app.get("/api/auth/status", async (req, res) => {
    const sendGridConfig = verifySendGridConfig();
    const sendGridDetails = getSendGridConfig();
    
    res.json({
      emailProvider: getProvider(),
      microsoftGraph: isMicrosoftGraphConfigured(),
      sendgrid: sendGridConfig.configured,
      environment: {
        hasClientId: !!process.env.AZURE_CLIENT_ID,
        hasClientSecret: !!process.env.AZURE_CLIENT_SECRET,
        tenantId: process.env.AZURE_TENANT_ID || 'common',
        fromAddress: process.env.EMAIL_FROM_ADDRESS || 'not set',
        sendgridFromEmail: sendGridDetails.fromEmail,
        sendgridConfigured: sendGridConfig.configured
      }
    });
  });

  // Debug endpoint to test email configuration
  app.get("/api/debug/email-config", async (req, res) => {
    const sendGridConfig = verifySendGridConfig();
    const sendGridDetails = getSendGridConfig();
    
    res.json({
      provider: getProvider(),
      sendgrid: {
        configured: sendGridConfig.configured,
        apiKey: sendGridDetails.apiKey,
        fromEmail: sendGridDetails.fromEmail,
        fromName: sendGridDetails.fromName,
        apiKeyLength: process.env.SENDGRID_API_KEY?.length || 0,
        apiKeyPrefix: process.env.SENDGRID_API_KEY?.substring(0, 10) || 'Not set'
      },
      microsoft: {
        configured: isMicrosoftGraphConfigured(),
        clientId: process.env.AZURE_CLIENT_ID ? 'Set (hidden)' : 'Not set',
        clientSecret: process.env.AZURE_CLIENT_SECRET ? 'Set (hidden)' : 'Not set',
        tenantId: process.env.AZURE_TENANT_ID || 'common',
        fromAddress: process.env.EMAIL_FROM_ADDRESS || 'Not set',
        redirectUri: process.env.AZURE_REDIRECT_URI || 'http://localhost:5000/api/auth/callback'
      }
    });
  });

  // Debug: verify SendGrid API key/auth and list granted scopes
  app.get('/api/debug/sendgrid-auth', async (_req, res) => {
    try {
      const apiKey = process.env.SENDGRID_API_KEY || '';
      if (!apiKey) return res.status(400).json({ ok: false, error: 'SENDGRID_API_KEY not set' });

      const region = (process.env.SENDGRID_REGION || 'global').toLowerCase();
      const client = new SendGridClient();
      client.setApiKey(apiKey.trim().replace(/^['\"]|['\"]$/g, ''));
      // If EU residency, direct requests to EU API host
      // @ts-ignore: setBaseUrl may not be typed in all versions
      if (region === 'eu' && typeof (client as any).setBaseUrl === 'function') {
        (client as any).setBaseUrl('https://api.eu.sendgrid.com');
      }

      const [resp, body] = await client.request({ method: 'GET', url: '/v3/scopes' });
      res.json({ ok: true, status: resp.statusCode, region, scopes: body?.scopes || [] });
    } catch (err: any) {
      const status = err?.code || err?.response?.statusCode || 500;
      const errors = err?.response?.body?.errors || [{ message: err?.message || 'Unknown error' }];
      res.status(status).json({ ok: false, status, errors });
    }
  });

  // Get current email provider and configuration
  app.get("/api/email/provider", async (_req, res) => {
    const provider = getProvider();
    const sendGridConfig = verifySendGridConfig();
    res.json({
      provider,
      available: ["sendgrid", "microsoft"],
      sendgridConfigured: sendGridConfig.configured,
      microsoftConfigured: isMicrosoftGraphConfigured(),
    });
  });

  // Set current email provider at runtime (without restart)
  app.post("/api/email/provider", async (req, res) => {
    try {
      const { provider } = req.body as { provider?: string };
      if (!provider || !["sendgrid", "microsoft"].includes(provider)) {
        return res.status(400).json({ message: "provider must be 'sendgrid' or 'microsoft'" });
      }
      // Update environment for this process so all modules read the new value
      process.env.EMAIL_PROVIDER = provider;
      res.json({ success: true, provider });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Test SendGrid email sending
  app.post("/api/debug/test-sendgrid", async (req, res) => {
    try {
      const { to } = req.body;
      if (!to) {
        return res.status(400).json({ error: 'Email address required in body as "to"' });
      }

      const result = await sendEmailViaSendGridAuto({
        to,
        subject: 'Test Email from FMD CRM',
        text: 'This is a test email to verify SendGrid integration is working correctly.',
        html: '<p>This is a test email to verify <strong>SendGrid</strong> integration is working correctly.</p>'
      });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Test if the mailbox exists and is accessible
  app.get("/api/debug/test-mailbox", async (req, res) => {
    try {
      const { getGraphClient } = await import("./outlook");
      const client = await getGraphClient();
      
      if (!client) {
        return res.json({ success: false, error: "Microsoft Graph not configured" });
      }

      const fromAddress = process.env.EMAIL_FROM_ADDRESS;
      if (!fromAddress) {
        return res.json({ success: false, error: "EMAIL_FROM_ADDRESS not set" });
      }

      // Try to get the user's mailbox info
      const user = await client.api(`/users/${fromAddress}`).get();
      
      res.json({ 
        success: true, 
        message: "Mailbox exists and is accessible",
        user: {
          displayName: user.displayName,
          mail: user.mail,
          userPrincipalName: user.userPrincipalName
        }
      });
    } catch (error: any) {
      res.json({ 
        success: false, 
        error: error.message,
        code: error.code,
        suggestion: error.code === 'Request_ResourceNotFound' 
          ? 'User/Mailbox does not exist in this tenant'
          : 'Check if user has Exchange Online license'
      });
    }
  });

  app.get("/api/leads", async (req, res) => {
    try {
      const leads = await storage.getAllLeads();
      res.json(leads);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/leads/:id", async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.json(lead);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/leads", async (req, res) => {
    try {
      const validatedData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(validatedData);
      res.status(201).json(lead);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/leads/:id", async (req, res) => {
    try {
      const validatedData = insertLeadSchema.parse(req.body);
      const lead = await storage.updateLead(req.params.id, validatedData);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.json(lead);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/leads/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }
      const lead = await storage.updateLeadStatus(req.params.id, status);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.json(lead);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/leads/:id/send-email", async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      const { subject, body } = req.body;
      if (!subject || !body) {
        return res.status(400).json({ message: "Subject and body are required" });
      }

  const provider = getProvider();
  console.log(`📧 Sending email via ${provider} provider...`);

      // Send email using configured provider
      let result: { success?: boolean; messageId?: string; conversationId?: string; error?: string };
      
  if (provider === 'sendgrid') {
        // Use SendGrid (auto: API then fallback to SMTP on auth errors)
        result = await sendEmailViaSendGridAuto({
          to: lead.email,
          subject,
          text: body,
          html: body.replace(/\n/g, '<br>'),
        });
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to send email via SendGrid');
        }
      } else {
        // Use Microsoft Graph (default)
        result = await sendEmail(lead.email, subject, body);
      }

      const fromEmail = provider === 'sendgrid' 
        ? process.env.SENDGRID_FROM_EMAIL 
        : process.env.EMAIL_FROM_ADDRESS;

      const emailData = insertEmailSchema.parse({
        leadId: lead.id,
        subject,
        body,
        direction: "sent",
        messageId: result.messageId || null,
        conversationId: result.conversationId || null,
        fromEmail: fromEmail || null,
        toEmail: lead.email,
        inReplyTo: null,
      });

      const email = await storage.createEmail(emailData);
      
      await storage.updateLeadStatus(lead.id, "Contacted");

  res.json({ success: true, email, provider });
    } catch (error: any) {
      console.error("Error sending email:", error);
      res.status(500).json({ message: error.message || "Failed to send email" });
    }
  });

  app.get("/api/emails/:leadId", async (req, res) => {
    try {
      const emails = await storage.getEmailsByLeadId(req.params.leadId);
      res.json(emails);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get recent email notifications
  app.get("/api/notifications/emails", async (req, res) => {
    try {
      const { getRecentNotifications } = await import("./index");
      const since = req.query.since as string | undefined;
      const notifications = getRecentNotifications(since);
      res.json({ notifications });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Sync emails from inbox (check for new replies)
  app.post("/api/emails/sync", async (req, res) => {
    try {
      const { fetchNewEmails, getInReplyToHeader } = await import("./outlook");
      
      // Get timestamp of last sync (or fetch all recent emails)
      const lastSyncTime = req.body.since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const newEmails = await fetchNewEmails(lastSyncTime);
      let savedCount = 0;
      let matchedCount = 0;

      for (const email of newEmails) {
        // Check if this email is a reply to one of our sent emails
        const conversationId = email.conversationId;
        const fromAddress = email.from?.emailAddress?.address;
        
        if (!fromAddress) continue;

        // Try to find a lead with this email address
        const lead = await storage.getLeadByEmail(fromAddress);
        
        if (lead) {
          matchedCount++;
          
          // Check if we already have this message
          const existing = await storage.getEmailByMessageId(email.id);
          
          if (!existing) {
            const emailData = insertEmailSchema.parse({
              leadId: lead.id,
              subject: email.subject || '(No Subject)',
              body: email.body?.content || '',
              direction: 'received',
              messageId: email.id,
              conversationId: conversationId || null,
              fromEmail: fromAddress,
              toEmail: process.env.EMAIL_FROM_ADDRESS || null,
              inReplyTo: getInReplyToHeader(email),
            });

            await storage.createEmail(emailData);
            savedCount++;
            
            // Update lead status to "Replied" if they responded
            await storage.updateLeadStatus(lead.id, "Replied");
          }
        }
      }

      res.json({ 
        success: true, 
        checked: newEmails.length,
        matched: matchedCount,
        saved: savedCount,
        lastSync: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Error syncing emails:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/import/file", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      const leads = data.map((row: any) => {
        const clientName = row["Client Name"] || row["Name"] || row["client_name"] || row["name"];
        const email = row["Email"] || row["email"];
        const leadDetails = row["Lead Details"] || row["Lead"] || row["Description"] || row["lead_details"] || row["description"] || "";

        if (!clientName || !email) {
          throw new Error("Each row must have Client Name and Email columns");
        }

        return {
          clientName: String(clientName).trim(),
          email: String(email).trim(),
          leadDetails: String(leadDetails).trim(),
          status: "New",
        };
      });

      const validatedLeads = leads.map((lead) => insertLeadSchema.parse(lead));
      const createdLeads = await storage.createLeads(validatedLeads);

      res.json({ success: true, count: createdLeads.length });
    } catch (error: any) {
      console.error("Error importing file:", error);
      res.status(400).json({ message: error.message || "Failed to import file" });
    }
  });

  app.get("/api/companies", async (req, res) => {
    try {
      const companies = await storage.getAllCompanies();
      res.json(companies);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/companies/:id", async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/companies/:id/leads", async (req, res) => {
    try {
      const leads = await storage.getLeadsByCompany(req.params.id);
      res.json(leads);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/companies", async (req, res) => {
    try {
      const validatedData = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(validatedData);
      res.status(201).json(company);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/companies/:id", async (req, res) => {
    try {
      const validatedData = insertCompanySchema.parse(req.body);
      const company = await storage.updateCompany(req.params.id, validatedData);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/companies/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCompany(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
