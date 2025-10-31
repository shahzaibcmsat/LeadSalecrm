import sgMail from '@sendgrid/mail';
import { Client as SendGridClient } from '@sendgrid/client';
import type { MailDataRequired } from '@sendgrid/mail';

// Initialize SendGrid with API key
// Normalize env values (trim and strip surrounding quotes)
const normalize = (v?: string) => (v || '').trim().replace(/^['"]|['"]$/g, '');
const SENDGRID_API_KEY = normalize(process.env.SENDGRID_API_KEY);
const SENDGRID_FROM_EMAIL = normalize(process.env.SENDGRID_FROM_EMAIL);
const SENDGRID_FROM_NAME = normalize(process.env.SENDGRID_FROM_NAME) || 'FMD Companies';
const SENDGRID_REGION = normalize(process.env.SENDGRID_REGION || 'global').toLowerCase(); // 'global' | 'eu'

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log('✅ SendGrid initialized successfully');
  console.log(`   API Key (first 10 chars): ${SENDGRID_API_KEY.substring(0, 10)}...`);
  console.log(`   API Key length: ${SENDGRID_API_KEY.length} characters`);
  console.log(`   Configured region: ${SENDGRID_REGION}`);
  // Handle EU data residency if required
  try {
    // Newer SDKs expose setDataResidency. If present, prefer it.
    const anyMail: any = sgMail as any;
    if (typeof anyMail.setDataResidency === 'function' && SENDGRID_REGION === 'eu') {
      anyMail.setDataResidency('eu');
      console.log('🌍 SendGrid data residency set to EU via setDataResidency');
    } else if (SENDGRID_REGION === 'eu') {
      // Fallback: override client host to EU endpoint
      const client = new SendGridClient();
      client.setApiKey(SENDGRID_API_KEY);
      // setBaseUrl is available on client; if not, use host option via constructor
      // @ts-ignore - typings may not include setDefaultRequest / setBaseUrl in all versions
      if (typeof (client as any).setDefaultRequest === 'function') {
        (client as any).setDefaultRequest('baseUrl', 'https://api.eu.sendgrid.com');
      }
      // @ts-ignore
      if (typeof (client as any).setBaseUrl === 'function') {
        (client as any).setBaseUrl('https://api.eu.sendgrid.com');
      }
      (sgMail as any).setClient(client);
  console.log('🌍 SendGrid region set to EU via custom client');
    }
  } catch (e) {
    console.warn('⚠️ Unable to configure SendGrid region:', (e as Error).message);
  }
} else {
  console.warn('⚠️ SendGrid API key not configured');
}

export interface SendGridEmailData {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  inReplyTo?: string;  // For email threading - Message-ID of the email being replied to
  references?: string;  // For email threading - Message-ID reference chain
}

/**
 * Send email using SendGrid
 * @param emailData Email details (to, subject, text, html)
 * @returns Object with success status and messageId
 */
export async function sendEmailViaSendGrid(emailData: SendGridEmailData): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    // Validate configuration
    if (!SENDGRID_API_KEY) {
      throw new Error('SendGrid API key is not configured. Please set SENDGRID_API_KEY in .env file');
    }

    if (!SENDGRID_FROM_EMAIL) {
      throw new Error('SendGrid sender email is not configured. Please set SENDGRID_FROM_EMAIL in .env file');
    }

    console.log('📧 Preparing to send email via SendGrid...');
    console.log(`   From: ${SENDGRID_FROM_NAME} <${SENDGRID_FROM_EMAIL}>`);
    console.log(`   To: ${emailData.to}`);
    console.log(`   Subject: ${emailData.subject}`);
    
    if (emailData.inReplyTo) {
      console.log(`   🧵 Threading: In-Reply-To: ${emailData.inReplyTo}`);
    }

    // Prepare email message
    const msg: MailDataRequired = {
      to: emailData.to,
      from: {
        email: SENDGRID_FROM_EMAIL,
        name: SENDGRID_FROM_NAME,
      },
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html || emailData.text.replace(/\n/g, '<br>'),
    };

    // Add reply-to if provided
    if (emailData.replyTo) {
      msg.replyTo = emailData.replyTo;
    }
    
    // Add email threading headers for proper conversation threading
    if (emailData.inReplyTo || emailData.references) {
      (msg as any).headers = {};
      if (emailData.inReplyTo) {
        (msg as any).headers['In-Reply-To'] = emailData.inReplyTo;
      }
      if (emailData.references) {
        (msg as any).headers['References'] = emailData.references;
      }
    }

    // Send email
    const response = await sgMail.send(msg);
    
    console.log('✅ Email sent successfully via SendGrid!');
    console.log(`   Status: ${response[0].statusCode}`);
    console.log(`   Message ID: ${response[0].headers['x-message-id']}`);

    return {
      success: true,
      messageId: response[0].headers['x-message-id'] as string || `sendgrid-${Date.now()}`,
    };
  } catch (error: any) {
    console.error('❌ SendGrid email sending failed:', error);
    
    // Extract error details from SendGrid response
    let errorMessage = 'Unknown error';
    if (error.response?.body?.errors) {
      errorMessage = error.response.body.errors.map((e: any) => e.message).join(', ');
    } else if (error.message) {
      errorMessage = error.message;
    }

    console.error('   Error details:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// SMTP fallback via Nodemailer using SendGrid's SMTP relay
export async function sendEmailViaSendGridSMTP(emailData: SendGridEmailData): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    if (!SENDGRID_API_KEY) {
      throw new Error('SendGrid API key is not configured.');
    }
    if (!SENDGRID_FROM_EMAIL) {
      throw new Error('SENDGRID_FROM_EMAIL is not configured.');
    }

    const nodemailer = await import('nodemailer');
    const host = SENDGRID_REGION === 'eu' ? 'smtp.eu.sendgrid.net' : 'smtp.sendgrid.net';

    const transporter = nodemailer.createTransport({
      host,
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: SENDGRID_API_KEY,
      },
    });

    const mailOptions: any = {
      from: `${SENDGRID_FROM_NAME} <${SENDGRID_FROM_EMAIL}>`,
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html || emailData.text.replace(/\n/g, '<br>'),
      replyTo: emailData.replyTo,
    };
    
    // Add email threading headers
    if (emailData.inReplyTo || emailData.references) {
      mailOptions.headers = {};
      if (emailData.inReplyTo) {
        mailOptions.headers['In-Reply-To'] = emailData.inReplyTo;
      }
      if (emailData.references) {
        mailOptions.headers['References'] = emailData.references;
      }
    }

    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Email sent via SendGrid SMTP:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('❌ SendGrid SMTP sending failed:', error?.response || error?.message || error);
    return { success: false, error: error?.message || 'SMTP send failed' };
  }
}

// Auto transport: try API first; on 401/403 fallback to SMTP
export async function sendEmailViaSendGridAuto(emailData: SendGridEmailData) {
  const transport = (process.env.SENDGRID_TRANSPORT || 'auto').toLowerCase();
  if (transport === 'smtp') return sendEmailViaSendGridSMTP(emailData);
  if (transport === 'api') return sendEmailViaSendGrid(emailData);

  const apiResult = await sendEmailViaSendGrid(emailData);
  if (apiResult.success) return apiResult;
  if (apiResult.error && /(unauthorized|forbidden|authorization|401|403)/i.test(apiResult.error)) {
    console.log('↪️ Falling back to SendGrid SMTP due to API auth error');
    return sendEmailViaSendGridSMTP(emailData);
  }
  return apiResult;
}

/**
 * Verify SendGrid configuration
 */
export function verifySendGridConfig(): {
  configured: boolean;
  apiKey: boolean;
  fromEmail: boolean;
  fromName: boolean;
} {
  const config = {
    configured: false,
    apiKey: !!SENDGRID_API_KEY,
    fromEmail: !!SENDGRID_FROM_EMAIL,
    fromName: !!SENDGRID_FROM_NAME,
  };

  config.configured = config.apiKey && config.fromEmail;

  console.log('📋 SendGrid Configuration Check:');
  console.log(`  API Key: ${config.apiKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`  From Email: ${config.fromEmail ? `✅ ${SENDGRID_FROM_EMAIL}` : '❌ Missing'}`);
  console.log(`  From Name: ${config.fromName ? `✅ ${SENDGRID_FROM_NAME}` : '⚠️ Using default'}`);

  return config;
}

/**
 * Get SendGrid configuration details
 */
export function getSendGridConfig() {
  return {
    apiKey: SENDGRID_API_KEY ? '***' + SENDGRID_API_KEY.slice(-4) : '',
    fromEmail: SENDGRID_FROM_EMAIL,
    fromName: SENDGRID_FROM_NAME,
    configured: !!(SENDGRID_API_KEY && SENDGRID_FROM_EMAIL),
  };
}
