import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Mail, Upload, Loader2, CheckCircle2, XCircle, FileSpreadsheet, Send, X,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SEND_EMAIL_URL = `${SUPABASE_URL}/functions/v1/send-results-email`;

interface Delivery {
  email: string;
  batch_id: string;
}

interface DeliveryResult {
  email: string;
  batch_id: string;
  status: 'sent' | 'failed' | 'pending';
  error?: string;
}

interface BatchJob {
  id: string;
  user_email: string;
  notification_email: string | null;
  user_display_name: string | null;
  jewelry_category: string;
  status: string;
  completed_images: number;
  total_images: number;
}

interface BatchEmailSenderProps {
  open: boolean;
  onClose: () => void;
  batches: BatchJob[];
  getAdminHeaders: () => Record<string, string>;
  onBatchStatusUpdated?: (batchId: string, newStatus: string) => void;
}

export default function BatchEmailSender({ open, onClose, batches, getAdminHeaders, onBatchStatusUpdated }: BatchEmailSenderProps) {
  const [mode, setMode] = useState<'select' | 'csv'>('select');
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [results, setResults] = useState<DeliveryResult[]>([]);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [csvFileName, setCsvFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Categories to exclude from bulk email sends
  const EXCLUDED_CATEGORIES = ['bracelet'];

  // Completed batches with results ready (excluding certain categories)
  const eligibleBatches = batches.filter(b =>
    (b.status === 'completed' || b.status === 'partial') && b.completed_images > 0 &&
    !EXCLUDED_CATEGORIES.includes(b.jewelry_category.toLowerCase())
  );

  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());

  const toggleBatch = (id: string) => {
    setSelectedBatchIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedBatchIds.size === eligibleBatches.length) {
      setSelectedBatchIds(new Set());
    } else {
      setSelectedBatchIds(new Set(eligibleBatches.map(b => b.id)));
    }
  };

  const handleCsvUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.trim().split('\n');
      const parsed: Delivery[] = [];
      // Skip header if it looks like one
      const startIdx = lines[0]?.toLowerCase().includes('email') ? 1 : 0;
      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        if (parts.length >= 2 && parts[0].includes('@') && parts[1].length > 8) {
          parsed.push({ email: parts[0], batch_id: parts[1] });
        }
      }
      setDeliveries(parsed);
      if (parsed.length === 0) {
        toast({ title: 'No valid rows found', description: 'Expected format: email,batch_id', variant: 'destructive' });
      } else {
        toast({ title: `Parsed ${parsed.length} deliveries from CSV` });
      }
    };
    reader.readAsText(file);
  }, []);

  const handleSend = useCallback(async () => {
    // Build deliveries list based on mode
    let toSend: Delivery[] = [];

    if (mode === 'csv') {
      toSend = deliveries;
    } else {
      toSend = eligibleBatches
        .filter(b => selectedBatchIds.has(b.id))
        .map(b => ({
          email: b.notification_email || b.user_email,
          batch_id: b.id,
        }));
    }

    if (toSend.length === 0) {
      toast({ title: 'No deliveries to send', variant: 'destructive' });
      return;
    }

    setSending(true);
    setProgress(0);
    setResults(toSend.map(d => ({ ...d, status: 'pending' as const })));

    try {
      // Send in chunks of 10
      const chunkSize = 10;
      const allResults: DeliveryResult[] = [];

      for (let i = 0; i < toSend.length; i += chunkSize) {
        const chunk = toSend.slice(i, i + chunkSize);
        const response = await fetch(SEND_EMAIL_URL, {
          method: 'POST',
          headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ deliveries: chunk }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          chunk.forEach(d => allResults.push({ ...d, status: 'failed', error: err.error || `HTTP ${response.status}` }));
        } else {
          const data = await response.json();
          allResults.push(...(data.results || []));
          // Update batch statuses for sent ones
          for (const r of (data.results || [])) {
            if (r.status === 'sent' && onBatchStatusUpdated) {
              onBatchStatusUpdated(r.batch_id, 'delivered');
            }
          }
        }

        setProgress(Math.round(((i + chunk.length) / toSend.length) * 100));
        setResults([...allResults, ...toSend.slice(i + chunkSize).map(d => ({ ...d, status: 'pending' as const }))]);
      }

      setResults(allResults);
      const sent = allResults.filter(r => r.status === 'sent').length;
      const failed = allResults.filter(r => r.status === 'failed').length;
      toast({
        title: `Email delivery complete`,
        description: `${sent} sent, ${failed} failed`,
        variant: failed > 0 ? 'destructive' : 'default',
      });
    } catch (err: any) {
      toast({ title: 'Send failed', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
      setProgress(100);
    }
  }, [mode, deliveries, eligibleBatches, selectedBatchIds, getAdminHeaders, onBatchStatusUpdated]);

  const reset = () => {
    setDeliveries([]);
    setResults([]);
    setProgress(0);
    setCsvFileName('');
    setSelectedBatchIds(new Set());
  };

  const hasResults = results.length > 0 && results.some(r => r.status !== 'pending');

  return (
    <Dialog open={open} onOpenChange={() => { if (!sending) { onClose(); reset(); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-background/95 backdrop-blur border-border/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-primary" />
            Send Results to Users
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Email download links for completed batch results directly to users.
          </DialogDescription>
        </DialogHeader>

        {/* Mode Tabs */}
        <div className="flex gap-1 p-0.5 bg-muted/30 rounded-md w-fit">
          <button
            onClick={() => { setMode('select'); reset(); }}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              mode === 'select' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Select Batches
          </button>
          <button
            onClick={() => { setMode('csv'); reset(); }}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              mode === 'csv' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Upload CSV
          </button>
        </div>

        {/* SELECT MODE */}
        {mode === 'select' && !hasResults && (
          <div className="space-y-3">
            {eligibleBatches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No completed batches with results available.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {eligibleBatches.length} batch{eligibleBatches.length !== 1 ? 'es' : ''} ready
                  </span>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAll}>
                    {selectedBatchIds.size === eligibleBatches.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="border border-border/30 rounded-lg max-h-64 overflow-y-auto divide-y divide-border/20">
                  {eligibleBatches.map(batch => (
                    <label
                      key={batch.id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-card/40 transition-colors ${
                        selectedBatchIds.has(batch.id) ? 'bg-primary/5' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedBatchIds.has(batch.id)}
                        onChange={() => toggleBatch(batch.id)}
                        className="accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize text-[10px]">{batch.jewelry_category}</Badge>
                          <span className="text-xs text-muted-foreground font-mono">{batch.id.slice(0, 8)}…</span>
                          <span className="text-xs text-emerald-400">{batch.completed_images}/{batch.total_images} done</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          → {batch.notification_email || batch.user_email}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* CSV MODE */}
        {mode === 'csv' && !hasResults && (
          <div className="space-y-3">
            <div className="border-2 border-dashed border-border/40 rounded-lg p-6 text-center">
              <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-xs text-muted-foreground mb-1">
                Upload a CSV with columns: <code className="text-primary">email, batch_id</code>
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleCsvUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                className="text-xs mt-2 gap-1.5"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                {csvFileName || 'Choose CSV File'}
              </Button>
            </div>

            {deliveries.length > 0 && (
              <div className="border border-border/30 rounded-lg max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-card/50 border-b border-border/30">
                      <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Email</th>
                      <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Batch ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d, i) => (
                      <tr key={i} className="border-b border-border/20">
                        <td className="px-3 py-1.5 text-muted-foreground">{d.email}</td>
                        <td className="px-3 py-1.5 font-mono text-muted-foreground">{d.batch_id.slice(0, 8)}…</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* PROGRESS */}
        {sending && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Sending emails…</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* RESULTS */}
        {hasResults && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                {results.filter(r => r.status === 'sent').length} sent
              </Badge>
              {results.some(r => r.status === 'failed') && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  {results.filter(r => r.status === 'failed').length} failed
                </Badge>
              )}
            </div>
            <div className="border border-border/30 rounded-lg max-h-48 overflow-y-auto divide-y divide-border/20">
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="text-muted-foreground">{r.email}</span>
                  {r.status === 'sent' ? (
                    <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Sent</span>
                  ) : r.status === 'failed' ? (
                    <span className="text-red-400 flex items-center gap-1" title={r.error}><XCircle className="h-3 w-3" /> {r.error?.slice(0, 30)}</span>
                  ) : (
                    <span className="text-muted-foreground/50">Pending</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          {hasResults ? (
            <Button variant="outline" size="sm" onClick={() => { onClose(); reset(); }}>
              Close
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => { onClose(); reset(); }} disabled={sending}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={
                  sending ||
                  (mode === 'select' && selectedBatchIds.size === 0) ||
                  (mode === 'csv' && deliveries.length === 0)
                }
                onClick={handleSend}
              >
                <Send className="h-3.5 w-3.5" />
                Send {mode === 'select' ? selectedBatchIds.size : deliveries.length} Email{(mode === 'select' ? selectedBatchIds.size : deliveries.length) !== 1 ? 's' : ''}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
