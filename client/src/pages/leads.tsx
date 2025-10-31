import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Lead, Email } from "@shared/schema";
import { LeadCard } from "@/components/lead-card";
import { EmailComposerModal } from "@/components/email-composer-modal";
import { LeadDetailPanel } from "@/components/lead-detail-panel";
import { AddLeadDialog } from "@/components/add-lead-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Loader2, Filter, Plus } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { notificationStore } from "@/lib/notificationStore";

export default function Leads() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [replyingToLead, setReplyingToLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ['/api/leads'],
  });

  const { data: emails = [] } = useQuery<Email[]>({
    queryKey: ['/api/emails', selectedLead?.id],
    enabled: !!selectedLead,
  });

  // When opening a lead, clear its unread counter and trigger a quick inbox sync
  useEffect(() => {
    if (!selectedLead) return;
    // Clear client-side unread badge for this lead
    notificationStore.clearLead(selectedLead.id);
    // Proactively trigger server-side sync so the thread is fresh
    (async () => {
      try {
        await apiRequest('POST', '/api/emails/sync', {});
        queryClient.invalidateQueries({ queryKey: ['/api/emails', selectedLead.id] });
      } catch (e) {
        // non-blocking
      }
    })();
  }, [selectedLead]);

  const sendEmailMutation = useMutation({
    mutationFn: async ({ leadId, subject, body }: { leadId: string; subject: string; body: string }) => {
      return apiRequest("POST", `/api/leads/${leadId}/send-email`, { subject, body });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/emails', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({
        title: "Email sent",
        description: "Your email has been sent successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: string }) => {
      return apiRequest("PATCH", `/api/leads/${leadId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({
        title: "Status updated",
        description: "Lead status has been updated successfully.",
      });
    },
  });

  const handleReply = (lead: Lead) => {
    setReplyingToLead(lead);
    setIsComposerOpen(true);
  };

  const handleSendEmail = async (subject: string, body: string) => {
    if (!replyingToLead) return;
    await sendEmailMutation.mutateAsync({
      leadId: replyingToLead.id,
      subject,
      body,
    });
  };

  const handleStatusChange = (leadId: string, newStatus: string) => {
    updateStatusMutation.mutate({ leadId, status: newStatus });
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch = 
      lead.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.leadDetails && lead.leadDetails.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-2">All Leads</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track all your leads
          </p>
        </div>
        <Button 
          onClick={() => {
            setEditingLead(null);
            setIsAddLeadOpen(true);
          }}
          className="bg-fmd-green hover:bg-fmd-green-dark"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Lead
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or details..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48" data-testid="select-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="Contacted">Contacted</SelectItem>
              <SelectItem value="Qualified">Qualified</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Follow-up">Follow-up</SelectItem>
              <SelectItem value="Closed Won">Closed Won</SelectItem>
              <SelectItem value="Closed Lost">Closed Lost</SelectItem>
              <SelectItem value="Closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredLeads.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              {searchTerm || statusFilter !== "all" 
                ? "No leads match your filters" 
                : "No leads yet. Import some to get started."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground mb-4" data-testid="text-result-count">
            Showing {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-4">
            {filteredLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onReply={handleReply}
                onViewDetails={setSelectedLead}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        </div>
      )}

      <EmailComposerModal
        lead={replyingToLead}
        isOpen={isComposerOpen}
        onClose={() => {
          setIsComposerOpen(false);
          setReplyingToLead(null);
        }}
        onSend={handleSendEmail}
      />

      <AddLeadDialog
        isOpen={isAddLeadOpen}
        onClose={() => {
          setIsAddLeadOpen(false);
          setEditingLead(null);
        }}
        lead={editingLead}
      />

      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          emails={emails}
          onClose={() => setSelectedLead(null)}
          onStatusChange={handleStatusChange}
          onReply={handleReply}
          onEdit={(lead) => {
            setEditingLead(lead);
            setIsAddLeadOpen(true);
          }}
        />
      )}
    </div>
  );
}
