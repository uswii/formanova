import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download } from "lucide-react";

interface DownloadRenameDialogProps {
  open: boolean;
  defaultName: string;
  extension: string;
  onConfirm: (filename: string) => void;
  onCancel: () => void;
}

export function DownloadRenameDialog({
  open,
  defaultName,
  extension,
  onConfirm,
  onCancel,
}: DownloadRenameDialogProps) {
  const [name, setName] = useState(defaultName);

  const handleConfirm = useCallback(() => {
    const sanitized = (name.trim() || defaultName).replace(/[<>:"/\\|?*]/g, "_");
    onConfirm(`${sanitized}.${extension}`);
  }, [name, defaultName, extension, onConfirm]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm tracking-wider uppercase">
            Save As
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            File name
          </label>
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              autoFocus
              className="font-mono text-sm"
            />
            <span className="text-sm text-muted-foreground font-mono">.{extension}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} className="font-mono text-xs uppercase tracking-wider">
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="font-mono text-xs uppercase tracking-wider gap-2">
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Hook for easy usage: returns trigger function + dialog element */
export function useDownloadRename() {
  const [state, setState] = useState<{
    open: boolean;
    defaultName: string;
    extension: string;
    resolve: ((filename: string | null) => void) | null;
  }>({ open: false, defaultName: "", extension: "", resolve: null });

  const promptRename = useCallback(
    (defaultName: string, extension: string): Promise<string | null> => {
      return new Promise((resolve) => {
        setState({ open: true, defaultName, extension, resolve });
      });
    },
    []
  );

  const dialog = state.open ? (
    <DownloadRenameDialog
      open
      defaultName={state.defaultName}
      extension={state.extension}
      onConfirm={(filename) => {
        state.resolve?.(filename);
        setState((s) => ({ ...s, open: false }));
      }}
      onCancel={() => {
        state.resolve?.(null);
        setState((s) => ({ ...s, open: false }));
      }}
    />
  ) : null;

  return { promptRename, DownloadDialog: dialog };
}
