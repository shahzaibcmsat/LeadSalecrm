import { Mail, Clock, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lead } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { useUnreadEmailCounts } from "@/lib/notificationStore";

interface LeadCardProps {
  lead: Lead;
  onReply: (lead: Lead) => void;
  onViewDetails: (lead: Lead) => void;
  onStatusChange?: (leadId: string, status: string) => void;
}

const statusVariants: Record<string, "default" | "secondary" | "outline"> = {
  New: "default",
  Contacted: "secondary",
  Qualified: "outline",
  "In Progress": "secondary",
  "Follow-up": "secondary",
  "Closed Won": "default",
  "Closed Lost": "outline",
  "Closed": "outline",
};

const statusOptions = [
  "New",
  "Contacted",
  "Qualified",
  "In Progress",
  "Follow-up",
  "Closed Won",
  "Closed Lost",
  "Closed"
];

export function LeadCard({ lead, onReply, onViewDetails, onStatusChange }: LeadCardProps) {
  const { perLeadUnread } = useUnreadEmailCounts();
  const unread = perLeadUnread[lead.id] || 0;
  return (
    <Card 
      className="p-4 hover-elevate cursor-pointer transition-all hover:shadow-lg border-l-4 border-l-fmd-burgundy/30 hover:border-l-fmd-burgundy" 
      onClick={() => onViewDetails(lead)}
      data-testid={`card-lead-${lead.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-base truncate text-fmd-black" data-testid={`text-client-name-${lead.id}`}>
              {lead.clientName}
            </h3>
            {(lead as any).company && (
              <Badge variant="outline" className="text-xs gap-1">
                <Building2 className="w-3 h-3" />
                {(lead as any).company.name}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 relative">
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-fmd-green" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] leading-none rounded-full px-1.5 py-0.5 shadow">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </div>
            <span className="truncate" data-testid={`text-email-${lead.id}`}>{lead.email}</span>
          </div>
          {lead.leadDetails && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {lead.leadDetails}
            </p>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Added {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {onStatusChange ? (
            <Select 
              value={lead.status} 
              onValueChange={(value) => {
                onStatusChange(lead.id, value);
              }}
            >
              <SelectTrigger 
                className="w-36 min-h-8 font-medium" 
                onClick={(e) => e.stopPropagation()}
                data-testid={`select-status-${lead.id}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent onClick={(e) => e.stopPropagation()}>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status} data-testid={`option-status-${status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant={statusVariants[lead.status] || "default"} className="font-medium" data-testid={`badge-status-${lead.id}`}>
              {lead.status.toUpperCase()}
            </Badge>
          )}
          <Button 
            size="sm" 
            className="bg-fmd-green hover:bg-fmd-green-dark text-white font-medium"
            onClick={(e) => {
              e.stopPropagation();
              onReply(lead);
            }}
            data-testid={`button-reply-${lead.id}`}
          >
            <Mail className="w-3.5 h-3.5 mr-2" />
            Reply
          </Button>
        </div>
      </div>
    </Card>
  );
}
