import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useUnreadEmailCounts } from "@/lib/notificationStore";
import { useQuery } from "@tanstack/react-query";
import { Lead } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { notificationStore } from "@/lib/notificationStore";

interface NotificationBellProps {
  onNotificationClick?: (leadId: string) => void;
}

export function NotificationBell({ onNotificationClick }: NotificationBellProps) {
  const { unreadTotal, perLeadUnread } = useUnreadEmailCounts();
  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ['/api/leads'],
  });

  // Get leads with unread emails
  const leadsWithUnread = leads.filter(lead => perLeadUnread[lead.id] > 0);

  const handleLeadClick = (leadId: string) => {
    // Clear the unread count when clicking on the notification
    notificationStore.clearLead(leadId);
    // Navigate to the lead
    if (onNotificationClick) {
      onNotificationClick(leadId);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-white hover:bg-white/20"
          data-testid="notification-bell"
        >
          <Bell className="h-5 w-5" />
          {unreadTotal > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadTotal > 9 ? '9+' : unreadTotal}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Email Notifications</h3>
            {unreadTotal > 0 && (
              <Badge variant="secondary">{unreadTotal} unread</Badge>
            )}
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {leadsWithUnread.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No new notifications</p>
              </div>
            ) : (
              leadsWithUnread.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => handleLeadClick(lead.id)}
                  className="p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{lead.clientName}</p>
                      <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                    </div>
                    <Badge variant="destructive" className="shrink-0">
                      {perLeadUnread[lead.id]} new
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last updated {formatDistanceToNow(new Date(lead.updatedAt), { addSuffix: true })}
                  </p>
                </div>
              ))
            )}
          </div>

          {leadsWithUnread.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => notificationStore.reset()}
            >
              Mark all as read
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
