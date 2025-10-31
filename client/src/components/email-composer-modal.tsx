import { useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Lead } from "@shared/schema";

interface EmailComposerModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onSend: (subject: string, body: string) => Promise<void>;
}

export function EmailComposerModal({ lead, isOpen, onClose, onSend }: EmailComposerModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;
    
    setIsSending(true);
    try {
      await onSend(subject, body);
      setSubject("");
      setBody("");
      onClose();
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="modal-email-composer">
        <DialogHeader>
          <DialogTitle>Reply to {lead?.clientName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input 
              id="to" 
              value={lead?.email || ""} 
              disabled 
              className="bg-muted"
              data-testid="input-to-email"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Enter email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              data-testid="input-subject"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              placeholder="Type your message here..."
              className="min-h-64 font-mono text-sm resize-none"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              data-testid="textarea-body"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isSending}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSend}
            disabled={isSending || !subject.trim() || !body.trim()}
            data-testid="button-send"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
