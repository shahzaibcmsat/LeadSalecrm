import { useEffect, useRef } from 'react';
import { useToast } from './use-toast';
import { notificationStore } from "@/lib/notificationStore";
import { queryClient } from "@/lib/queryClient";

interface EmailNotification {
  id: string;
  leadId: string;
  leadName: string;
  fromEmail: string;
  subject: string;
  timestamp: string;
}

export function useEmailNotifications() {
  const { toast } = useToast();
  const lastCheckRef = useRef<string>(new Date().toISOString());
  const shownNotificationsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const checkForNotifications = async () => {
      try {
        const response = await fetch(`/api/notifications/emails?since=${lastCheckRef.current}`);
        const data = await response.json();

        if (data.notifications && data.notifications.length > 0) {
          data.notifications.forEach((notification: EmailNotification) => {
            // Only show if we haven't shown this notification before
            if (!shownNotificationsRef.current.has(notification.id)) {
              toast({
                title: "📧 New Email Reply!",
                description: `${notification.leadName} replied: "${notification.subject}"`,
                duration: 8000,
              });
              
              shownNotificationsRef.current.add(notification.id);

              // Update unread counters and refresh lead's email thread
              notificationStore.increment(notification.leadId);
              // Refresh emails for that lead (if panel open)
              queryClient.invalidateQueries({ queryKey: ['/api/emails', notification.leadId] });
              // Also refresh leads to reflect status change to Replied
              queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
            }
          });

          // Update last check time to the newest notification
          const newest = data.notifications[data.notifications.length - 1];
          lastCheckRef.current = newest.timestamp;
        }
      } catch (error) {
        console.error('Failed to check for notifications:', error);
      }
    };

    // Check immediately
    checkForNotifications();

    // Then check every 30 seconds
    const interval = setInterval(checkForNotifications, 30000);

    return () => clearInterval(interval);
  }, [toast]);
}
