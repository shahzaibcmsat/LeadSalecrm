import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';
import 'isomorphic-fetch';

// Microsoft Graph OAuth configuration
interface MicrosoftGraphConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
}

// In-memory token storage (for production, use database)
let cachedAccessToken: string | null = null;
let tokenExpiry: number | null = null;

function getMicrosoftGraphConfig(): MicrosoftGraphConfig | null {
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const tenantId = process.env.AZURE_TENANT_ID || 'common';
  const redirectUri = process.env.AZURE_REDIRECT_URI || 'http://localhost:5000/api/auth/callback';

  console.log('📋 Microsoft Graph Configuration Check:');
  console.log('  AZURE_CLIENT_ID:', clientId ? '✅ Set' : '❌ Not set');
  console.log('  AZURE_CLIENT_SECRET:', clientSecret ? '✅ Set' : '❌ Not set');
  console.log('  AZURE_TENANT_ID:', tenantId);
  console.log('  EMAIL_FROM_ADDRESS:', process.env.EMAIL_FROM_ADDRESS || '❌ Not set');

  if (!clientId || !clientSecret) {
    console.log('❌ Microsoft Graph not configured - missing credentials');
    return null;
  }

  return { clientId, clientSecret, tenantId, redirectUri };
}

// Create MSAL client for OAuth
function createMsalClient(): ConfidentialClientApplication | null {
  const config = getMicrosoftGraphConfig();
  if (!config) return null;

  return new ConfidentialClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
      clientSecret: config.clientSecret,
    },
  });
}

// Get access token using client credentials (app-only access)
async function getAccessToken(): Promise<string | null> {
  // Return cached token if still valid
  if (cachedAccessToken && tokenExpiry && Date.now() < tokenExpiry) {
    console.log('🔑 Using cached access token');
    return cachedAccessToken;
  }

  const msalClient = createMsalClient();
  if (!msalClient) {
    console.log('❌ MSAL client not created - check AZURE_CLIENT_ID and AZURE_CLIENT_SECRET');
    return null;
  }

  try {
    console.log('🔄 Acquiring new access token from Microsoft...');
    const result = await msalClient.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default'],
    });

    if (result?.accessToken) {
      cachedAccessToken = result.accessToken;
      tokenExpiry = result.expiresOn ? result.expiresOn.getTime() : Date.now() + 3600000;
      console.log('✅ Access token acquired successfully');
      return result.accessToken;
    }
  } catch (error: any) {
    console.error('❌ Failed to acquire access token:', error.message);
    console.error('Error details:', error.errorCode, error.errorMessage);
  }

  return null;
}

// Get authorization URL for user consent (delegated permissions)
export function getAuthorizationUrl(): string | null {
  const config = getMicrosoftGraphConfig();
  if (!config) return null;

  const scopes = ['User.Read', 'Mail.Send'];
  const authUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?` +
    `client_id=${config.clientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(config.redirectUri)}` +
    `&response_mode=query` +
    `&scope=${encodeURIComponent(scopes.join(' '))}`;

  return authUrl;
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string): Promise<any> {
  const msalClient = createMsalClient();
  const config = getMicrosoftGraphConfig();
  
  if (!msalClient || !config) {
    throw new Error('Microsoft Graph not configured');
  }

  try {
    const result = await msalClient.acquireTokenByCode({
      code,
      scopes: ['User.Read', 'Mail.Send'],
      redirectUri: config.redirectUri,
    });

    return result;
  } catch (error) {
    console.error('Failed to exchange code for tokens:', error);
    throw error;
  }
}

// Create Microsoft Graph client
export async function getGraphClient(): Promise<Client | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

// Send email using Microsoft Graph API
export async function sendEmail(
  to: string, 
  subject: string, 
  body: string, 
  fromEmail?: string,
  inReplyTo?: string // Message ID to reply to for threading
): Promise<{ success: boolean; message: string; details?: any; messageId?: string; conversationId?: string }> {
  console.log('\n📧 ========== EMAIL SEND ATTEMPT ==========');
  console.log('To:', to);
  console.log('Subject:', subject);
  console.log('From:', fromEmail || process.env.EMAIL_FROM_ADDRESS);
  if (inReplyTo) {
    console.log('🧵 In-Reply-To:', inReplyTo);
  }
  
  const client = await getGraphClient();

  if (!client) {
    // Fallback to console logging if Graph is not configured
    console.log('⚠️  No Microsoft Graph client available - logging email instead');
    console.log('=== EMAIL SENT (No Microsoft Graph configured) ===');
    console.log(`From: ${fromEmail || 'noreply@example.com'}`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body}`);
    console.log('===================================================\n');
    
    return {
      success: true,
      message: 'Email logged (Microsoft Graph not configured)',
      details: { to, subject, body }
    };
  }

  try {
    // For app-only access, you need to specify the user to send from
    const sendFromUser = fromEmail || process.env.EMAIL_FROM_ADDRESS;
    
    if (!sendFromUser) {
      throw new Error('EMAIL_FROM_ADDRESS must be set when using app-only access');
    }

    console.log('📤 Attempting to send via Microsoft Graph...');
    console.log('   Using sender:', sendFromUser);

    const sendMail: any = {
      message: {
        subject: subject,
        body: {
          contentType: 'Text',
          content: body
        },
        toRecipients: [
          {
            emailAddress: {
              address: to
            }
          }
        ]
      },
      saveToSentItems: true  // Save to sent items for proper delivery
    };

    // Add threading headers if replying to an existing message
    if (inReplyTo) {
      console.log('🧵 Adding email threading headers');
      // Try to get the original message to reply to it properly
      try {
        const originalMessage = await client.api(`/users/${sendFromUser}/messages/${inReplyTo}`).get();
        
        // Use the reply endpoint for proper threading
        console.log('   Using createReply for proper threading');
        const reply = await client.api(`/users/${sendFromUser}/messages/${inReplyTo}/createReply`).post({});
        
        // Update the reply with our content
        await client.api(`/users/${sendFromUser}/messages/${reply.id}`).patch({
          body: {
            contentType: 'Text',
            content: body
          }
        });
        
        // Send the reply
        await client.api(`/users/${sendFromUser}/messages/${reply.id}/send`).post({});
        
        console.log('✅ Email sent as reply via Microsoft Graph!');
        console.log('   Message ID:', reply.id);
        console.log('   Conversation ID:', reply.conversationId || originalMessage.conversationId);
        
        return {
          success: true,
          message: 'Email sent as reply via Microsoft Graph',
          details: { to, subject, from: sendFromUser },
          messageId: reply.id,
          conversationId: reply.conversationId || originalMessage.conversationId
        };
      } catch (replyError) {
        console.warn('⚠️ Could not use createReply, sending as new message with headers:', replyError);
        // Fall back to sending with custom headers
        sendMail.message.internetMessageHeaders = [
          {
            name: 'In-Reply-To',
            value: `<${inReplyTo}>`
          },
          {
            name: 'References',
            value: `<${inReplyTo}>`
          }
        ];
      }
    }

    // For app-only permissions, use /users/{id}/sendMail endpoint
    const response = await client.api(`/users/${sendFromUser}/sendMail`).post(sendMail);

    // Get the sent message details from sent items
    let messageId: string | undefined;
    let conversationId: string | undefined;
    
    try {
      // Wait a moment for the message to be saved
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get the most recent sent message
      const sentMessages = await client.api(`/users/${sendFromUser}/mailFolders/SentItems/messages`)
        .top(1)
        .orderby('sentDateTime desc')
        .get();
      
      if (sentMessages.value && sentMessages.value.length > 0) {
        messageId = sentMessages.value[0].id;
        conversationId = sentMessages.value[0].conversationId;
        console.log('📬 Message ID:', messageId);
        console.log('🧵 Conversation ID:', conversationId);
      }
    } catch (error) {
      console.warn('⚠️ Could not retrieve sent message details:', error);
    }

    console.log('✅ Email sent successfully via Microsoft Graph!');
    console.log('   Response: Email sent');
    console.log('=========================================\n');

    return {
      success: true,
      message: 'Email sent via Microsoft Graph',
      details: { to, subject, from: sendFromUser },
      messageId,
      conversationId
    };
  } catch (error: any) {
    console.error('❌ Failed to send email via Microsoft Graph');
    console.error('   Error code:', error.code);
    console.error('   Error message:', error.message);
    console.error('   Status code:', error.statusCode);
    
    // Check if it's a mailbox issue
    if (error.code === 'ErrorAccessDenied' || error.code === 'MailboxNotEnabledForRESTAPI') {
      console.error('   💡 Suggestion: Verify that the mailbox exists and has an Exchange Online license');
      console.error('   💡 Try using a different email address that you know has a working mailbox');
    }
    
    console.error('   Full error:', JSON.stringify(error, null, 2));
    console.log('=========================================\n');
    
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

// Check if Microsoft Graph is configured
export function isMicrosoftGraphConfigured(): boolean {
  return getMicrosoftGraphConfig() !== null;
}

// Fetch new emails from inbox
export async function fetchNewEmails(sinceDateTime?: string): Promise<any[]> {
  const client = await getGraphClient();
  const fromEmail = process.env.EMAIL_FROM_ADDRESS;

  if (!client || !fromEmail) {
    console.log('⚠️ Cannot fetch emails - Graph client or email address not configured');
    return [];
  }

  try {
    console.log('📬 Fetching new emails from inbox...');
    
    let query = client.api(`/users/${fromEmail}/mailFolders/Inbox/messages`)
      .top(50)
      .orderby('receivedDateTime desc')
      .select('id,conversationId,subject,from,toRecipients,body,receivedDateTime,isRead,internetMessageHeaders');

    // If we have a timestamp, only fetch emails after that time
    if (sinceDateTime) {
      query = query.filter(`receivedDateTime gt ${sinceDateTime}`);
    }

    const response = await query.get();
    
    console.log(`📫 Found ${response.value?.length || 0} emails`);
    return response.value || [];
  } catch (error: any) {
    console.error('❌ Failed to fetch emails:', error.message);
    return [];
  }
}

// Get specific email by ID
export async function getEmailById(messageId: string): Promise<any | null> {
  const client = await getGraphClient();
  const fromEmail = process.env.EMAIL_FROM_ADDRESS;

  if (!client || !fromEmail) {
    return null;
  }

  try {
    const message = await client.api(`/users/${fromEmail}/messages/${messageId}`)
      .select('id,conversationId,subject,from,toRecipients,body,receivedDateTime,internetMessageHeaders')
      .get();
    
    return message;
  } catch (error: any) {
    console.error(`❌ Failed to get email ${messageId}:`, error.message);
    return null;
  }
}

// Extract In-Reply-To header from message
export function getInReplyToHeader(message: any): string | null {
  if (!message.internetMessageHeaders) return null;
  
  const inReplyToHeader = message.internetMessageHeaders.find(
    (h: any) => h.name.toLowerCase() === 'in-reply-to'
  );
  
  return inReplyToHeader?.value || null;
}
