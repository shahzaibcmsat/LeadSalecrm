# SendGrid Inbound Parse Setup

This guide explains how to configure SendGrid Inbound Parse to receive email replies from leads and automatically process them in your CRM.

## What is Inbound Parse?

SendGrid's Inbound Parse Webhook allows your application to receive emails sent to a specific domain or subdomain. When someone replies to your emails, SendGrid forwards the email data to your application via a webhook.

## Prerequisites

- SendGrid account with verified domain
- Access to your domain's DNS settings
- Your CRM application deployed and accessible via HTTPS (required for production)

## Setup Steps

### 1. Configure DNS Records

Add an MX record for your domain or subdomain to point to SendGrid:

**For subdomain (recommended): `reply.yourdomain.com`**

| Type | Host | Priority | Value |
|------|------|----------|-------|
| MX | reply | 10 | mx.sendgrid.net |

**Example:**
- **Type**: MX
- **Host**: `reply` (or `reply.yourdomain.com`)
- **Priority**: 10
- **Value**: `mx.sendgrid.net`

### 2. Configure Inbound Parse in SendGrid

1. Log in to your [SendGrid Dashboard](https://app.sendgrid.com/)
2. Navigate to **Settings** → **Inbound Parse**
3. Click **Add Host & URL**
4. Fill in the form:
   - **Subdomain**: `reply` (or your chosen subdomain)
   - **Domain**: Your verified domain (e.g., `yourdomain.com`)
   - **Destination URL**: `https://yourdomain.com/api/webhooks/sendgrid/inbound`
   - **Spam Check**: ☑ Check incoming emails for spam
   - **Send Raw**: ☐ Leave unchecked (we need parsed data)

5. Click **Add**

### 3. Update Your Reply-To Address

When sending emails from your CRM, make sure to set the Reply-To address to use your inbound parse subdomain:

Example: `crm@reply.yourdomain.com`

This can be configured in your `.env` file:

```env
SENDGRID_REPLY_TO=crm@reply.yourdomain.com
```

### 4. Test the Setup

1. Send an email to a lead from your CRM
2. Reply to that email from the lead's email client
3. Check your CRM server logs - you should see:
   ```
   📨 Received inbound email webhook from SendGrid
   ✅ Found lead: [Lead Name]
   ✅ Saved email from [email] for lead [Lead Name]
   🔔 Added notification for [Lead Name]
   ```
4. The notification bell in your CRM should show the new reply
5. The email should appear in the lead's communication history

## Troubleshooting

### Webhook Not Receiving Data

**Check DNS Propagation:**
```bash
nslookup -type=MX reply.yourdomain.com
```
You should see `mx.sendgrid.net` in the response.

**Verify Webhook URL:**
- Must be HTTPS in production (HTTP only works for localhost testing)
- Must be publicly accessible
- Should return 200 status code

**Test Webhook Manually:**
You can test by sending a POST request to your webhook URL with sample data:

```bash
curl -X POST https://yourdomain.com/api/webhooks/sendgrid/inbound \
  -F "from=test@example.com" \
  -F "to=crm@reply.yourdomain.com" \
  -F "subject=Test Email" \
  -F "text=This is a test email body"
```

### Emails Not Showing in CRM

1. **Check Lead Email Match**: The sender's email must exactly match a lead's email in your database
2. **Check Logs**: Look for error messages in server console
3. **Verify Storage**: Ensure database connection is working

### Notifications Not Appearing

1. **Check Notification Store**: The notification should be logged in server console
2. **Refresh Frontend**: The notification bell polls every 30 seconds
3. **Check Browser Console**: Look for any JavaScript errors

## Local Development

For local testing, you can use tools like:
- **ngrok**: `ngrok http 5000` - Creates a public HTTPS URL for your local server
- **localtunnel**: `lt --port 5000`

Then use the generated URL for your SendGrid Inbound Parse destination.

## Security Considerations

1. **Verify Webhook Signatures**: SendGrid can sign webhook requests (optional but recommended)
2. **Validate Email Addresses**: The webhook checks if the sender matches a lead before saving
3. **Rate Limiting**: Consider implementing rate limiting on the webhook endpoint
4. **Spam Filtering**: Enable "Spam Check" in SendGrid Inbound Parse settings

## Email Threading

The webhook automatically handles email threading:
- Extracts `Message-ID` and `In-Reply-To` headers
- Links replies to original emails via `conversationId`
- Maintains conversation history in your CRM

## Additional Resources

- [SendGrid Inbound Parse Documentation](https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook)
- [SendGrid Webhook Event Reference](https://docs.sendgrid.com/for-developers/parsing-email/inbound-email)
