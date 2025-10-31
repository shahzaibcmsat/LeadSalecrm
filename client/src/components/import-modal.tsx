import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File) => Promise<void>;
  onImportFromSheets: (sheetUrl: string) => Promise<void>;
}

export function ImportModal({ isOpen, onClose, onImport, onImportFromSheets }: ImportModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.csv'))) {
      setFile(droppedFile);
    } else {
      toast({
        title: "Invalid file",
        description: "Please upload a .xlsx or .csv file",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleImportFile = async () => {
    if (!file) return;
    
    setIsImporting(true);
    try {
      await onImport(file);
      setFile(null);
      onClose();
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportSheets = async () => {
    if (!sheetUrl.trim()) return;
    
    setIsImporting(true);
    try {
      await onImportFromSheets(sheetUrl);
      setSheetUrl("");
      onClose();
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="modal-import">
        <DialogHeader>
          <DialogTitle>Import Leads</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Upload Excel/CSV File</h3>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? 'border-primary bg-primary/5' : 'border-border'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              data-testid="dropzone-file"
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              {file ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{file.name}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFile(null)}
                    data-testid="button-remove-file"
                  >
                    <X className="w-3 h-3 mr-2" />
                    Remove
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag and drop your file here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Supports .xlsx and .csv files
                  </p>
                  <Input
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                    data-testid="input-file"
                  />
                  <Button asChild variant="outline" data-testid="button-browse">
                    <label htmlFor="file-upload" className="cursor-pointer">
                      Browse Files
                    </label>
                  </Button>
                </>
              )}
            </div>
            {file && (
              <Button 
                className="w-full" 
                onClick={handleImportFile}
                disabled={isImporting}
                data-testid="button-import-file"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import from File
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium">Import from Google Sheets</h3>
            <div className="space-y-2">
              <Label htmlFor="sheet-url">Google Sheets URL</Label>
              <Input
                id="sheet-url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                data-testid="input-sheet-url"
              />
              <p className="text-xs text-muted-foreground">
                Make sure the sheet is shared with view access
              </p>
            </div>
            <Button 
              className="w-full"
              onClick={handleImportSheets}
              disabled={isImporting || !sheetUrl.trim()}
              data-testid="button-import-sheets"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Import from Google Sheets
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
