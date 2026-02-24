import { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Upload, Send, Trash2, Eye, Loader2, CheckCircle2, XCircle, Mail,
  FileSpreadsheet, RefreshCw, Edit2, Save, X,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const DELIVERY_API = `${SUPABASE_URL}/functions/v1/delivery-manager`;

interface DeliveryBatch {
  id: string;
  batch_id: string;
  user_email: string;
  safe_email: string;
  override_email: string | null;
  category: string | null;
  token: string | null;
  delivery_status: string;
  delivered_at: string | null;
  email_sent_at: string | null;
  created_at: string;
  image_count: number;
}

interface PreviewImage {
  id: string;
  image_filename: string;
  image_url: string;
  preview_url: string;
  sequence: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getAdminHeaders: () => Record<string, string>;
  onDeliverySent?: () => void;
}

export default function DeliveryManager({ open, onOpenChange, getAdminHeaders, onDeliverySent }: Props) {
  const [tab, setTab] = useState('upload');
  const [csvText, setCsvText] = useState('');
  const [category, setCategory] = useState('necklace');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ batch_id: string; user_email: string; image_count: number }[] | null>(null);

  const [deliveries, setDeliveries] = useState<DeliveryBatch[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [previewDeliveryId, setPreviewDeliveryId] = useState<string | null>(null);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');

  const headers = useCallback(() => ({
    ...getAdminHeaders(),
    'Content-Type': 'application/json',
  }), [getAdminHeaders]);

  // ── Upload CSV ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(reader.result as string);
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!csvText.trim()) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const resp = await fetch(`${DELIVERY_API}?action=upload_csv`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ csv_text: csvText, category }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Upload failed');
      setUploadResult(data.created || []);
      toast({ title: `${data.total} delivery batches created` });
      setCsvText('');
      // Auto-switch to deliveries tab and refresh
      fetchDeliveries();
      setTab('deliveries');
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  // ── List deliveries ──
  const fetchDeliveries = useCallback(async () => {
    setLoadingList(true);
    try {
      const resp = await fetch(`${DELIVERY_API}?action=list`, { headers: getAdminHeaders() });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setDeliveries(data.deliveries || []);
    } catch (err: any) {
      toast({ title: err.message || 'Failed to load', variant: 'destructive' });
    } finally {
      setLoadingList(false);
    }
  }, [getAdminHeaders]);

  // ── Preview ──
  const handlePreview = async (deliveryId: string) => {
    setPreviewDeliveryId(deliveryId);
    setLoadingPreview(true);
    try {
      const resp = await fetch(`${DELIVERY_API}?action=preview&delivery_id=${deliveryId}`, { headers: getAdminHeaders() });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setPreviewImages(data.images || []);
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setLoadingPreview(false);
    }
  };

  // ── Send single or small batch ──
  const handleSend = async (deliveryIds: string[]) => {
    setSending(deliveryIds[0]);
    try {
      const resp = await fetch(`${DELIVERY_API}?action=send`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ delivery_ids: deliveryIds }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      const { sent, failed, skipped } = data.summary;
      toast({ title: `Sent: ${sent}, Failed: ${failed}, Skipped: ${skipped}` });
      fetchDeliveries();
      onDeliverySent?.();
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setSending(null);
    }
  };

  // ── Send All in batches ──
  const BATCH_SIZE = 5;
  const handleSendAll = async () => {
    const unsent = deliveries.filter(d => d.delivery_status !== 'delivered').map(d => d.id);
    if (unsent.length === 0) { toast({ title: 'All deliveries already sent' }); return; }

    setSendingAll(true);
    setSendProgress({ sent: 0, failed: 0, total: unsent.length });

    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < unsent.length; i += BATCH_SIZE) {
      const batch = unsent.slice(i, i + BATCH_SIZE);
      try {
        const resp = await fetch(`${DELIVERY_API}?action=send`, {
          method: 'POST', headers: headers(),
          body: JSON.stringify({ delivery_ids: batch }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error);
        totalSent += data.summary?.sent || 0;
        totalFailed += data.summary?.failed || 0;
      } catch {
        totalFailed += batch.length;
      }

      setSendProgress({ sent: totalSent, failed: totalFailed, total: unsent.length });

      // Non-blocking refresh — don't await, so next batch starts immediately
      fetchDeliveries();
      onDeliverySent?.();

      // Small yield between batches
      if (i + BATCH_SIZE < unsent.length) {
        await new Promise(r => setTimeout(r, 50));
      }
    }

    toast({ title: `Done! Sent: ${totalSent}, Failed: ${totalFailed}` });
    setSendingAll(false);
    setSendProgress(null);
    onDeliverySent?.();
  };

  // ── Delete ──
  const handleDelete = async (deliveryId: string) => {
    setDeleting(deliveryId);
    try {
      const resp = await fetch(`${DELIVERY_API}?action=delete`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ delivery_ids: [deliveryId] }),
      });
      if (!resp.ok) throw new Error('Delete failed');
      setDeliveries(prev => prev.filter(d => d.id !== deliveryId));
      toast({ title: 'Deleted' });
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  // ── Override email ──
  const handleSaveOverrideEmail = async (deliveryId: string) => {
    try {
      await fetch(`${DELIVERY_API}?action=update_override_email`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ delivery_id: deliveryId, override_email: emailInput.trim() || null }),
      });
      setDeliveries(prev => prev.map(d => d.id === deliveryId ? { ...d, override_email: emailInput.trim() || null } : d));
      setEditingEmail(null);
      toast({ title: 'Override email saved' });
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' });
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      delivered: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    };
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wider ${colors[status] || 'bg-muted text-muted-foreground border-border'}`}>{status}</span>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Send className="h-5 w-5 text-primary" /> Delivery Manager
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="gap-1.5 text-xs"><Upload className="h-3.5 w-3.5" /> Upload CSV</TabsTrigger>
            <TabsTrigger value="deliveries" className="gap-1.5 text-xs" onClick={() => fetchDeliveries()}>
              <Mail className="h-3.5 w-3.5" /> Deliveries
            </TabsTrigger>
          </TabsList>

          {/* ── Upload Tab ── */}
          <TabsContent value="upload" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Category:</label>
                <Input value={category} onChange={e => setCategory(e.target.value)} className="w-40 h-8 text-xs" placeholder="necklace" />
              </div>
              <div className="border border-dashed border-border/60 rounded-lg p-6 text-center">
                <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-xs text-muted-foreground mb-3">Upload CSV with columns: batch_id, user_email, safe_email, image_url</p>
                <input type="file" accept=".csv" onChange={handleFileSelect} className="hidden" id="csv-upload" />
                <label htmlFor="csv-upload">
                  <Button variant="outline" size="sm" className="text-xs" asChild><span>Choose CSV File</span></Button>
                </label>
              </div>
              {csvText && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{csvText.split('\n').length - 1} rows detected</p>
                  <pre className="text-[10px] text-muted-foreground bg-background/50 p-3 rounded border border-border/30 max-h-32 overflow-auto font-mono">
                    {csvText.split('\n').slice(0, 6).join('\n')}{csvText.split('\n').length > 6 ? '\n...' : ''}
                  </pre>
                  <Button onClick={handleUpload} disabled={uploading} className="gap-1.5 text-xs">
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Upload & Create Deliveries
                  </Button>
                </div>
              )}
              {uploadResult && (
                <div className="space-y-2 border border-emerald-500/20 bg-emerald-500/5 rounded p-3">
                  <p className="text-xs text-emerald-400 font-semibold">✓ {uploadResult.length} deliveries created</p>
                  {uploadResult.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="font-mono">{r.user_email}</span>
                      <span>→ {r.image_count} images</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Deliveries Tab ── */}
          <TabsContent value="deliveries" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">{deliveries.length} deliveries</p>
                {sendProgress && (
                  <span className="text-[10px] text-primary font-medium">
                    Sending {sendProgress.sent + sendProgress.failed}/{sendProgress.total}
                    {sendProgress.failed > 0 && <span className="text-destructive ml-1">({sendProgress.failed} failed)</span>}
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                <Button onClick={handleSendAll} variant="outline" size="sm" className="gap-1.5 text-xs" disabled={!!sending || sendingAll}>
                  {sendingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  {sendingAll ? `Sending...` : 'Send All Unsent'}
                </Button>
                <Button onClick={fetchDeliveries} variant="ghost" size="sm" className="gap-1">
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingList ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {loadingList ? (
              <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : deliveries.length === 0 ? (
              <p className="py-12 text-center text-xs text-muted-foreground">No deliveries yet. Upload a CSV first.</p>
            ) : (
              <div className="space-y-2">
                {deliveries.map(d => (
                  <div key={d.id} className="border border-border/40 rounded-lg p-3 bg-card/30">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {statusBadge(d.delivery_status)}
                        <span className="text-xs font-mono truncate">{d.user_email}</span>
                        {d.override_email && (
                          <span className="text-[10px] text-amber-400">→ {d.override_email}</span>
                        )}
                        <Badge variant="secondary" className="text-[10px]">{d.image_count} img</Badge>
                        <span className="text-[10px] text-muted-foreground">{d.category}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {editingEmail === d.id ? (
                          <div className="flex items-center gap-1">
                            <Input value={emailInput} onChange={e => setEmailInput(e.target.value)} className="h-6 w-40 text-[10px]" placeholder="Override email" />
                            <Button onClick={() => handleSaveOverrideEmail(d.id)} variant="ghost" size="sm" className="h-6 w-6 p-0"><Save className="h-3 w-3" /></Button>
                            <Button onClick={() => setEditingEmail(null)} variant="ghost" size="sm" className="h-6 w-6 p-0"><X className="h-3 w-3" /></Button>
                          </div>
                        ) : (
                          <Button onClick={() => { setEditingEmail(d.id); setEmailInput(d.override_email || ''); }} variant="ghost" size="sm" className="h-6 w-6 p-0" title="Override email">
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        )}
                        <Button onClick={() => handlePreview(d.id)} variant="ghost" size="sm" className="h-6 w-6 p-0" title="Preview"><Eye className="h-3 w-3" /></Button>
                        <Button onClick={() => handleSend([d.id])} variant="ghost" size="sm" className="h-6 w-6 p-0 text-emerald-400" disabled={!!sending} title={d.delivery_status === 'delivered' ? 'Re-send email' : 'Send email'}>
                          {sending === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        </Button>
                        {d.delivery_status === 'delivered' && <CheckCircle2 className="h-3.5 w-3.5 text-violet-400" />}
                        <Button onClick={() => handleDelete(d.id)} variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400" disabled={!!deleting} title="Delete">
                          {deleting === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                    {d.email_sent_at && (
                      <p className="text-[10px] text-muted-foreground mt-1">Sent: {new Date(d.email_sent_at).toLocaleString()}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Preview Panel */}
            {previewDeliveryId && (
              <div className="border border-primary/20 rounded-lg p-4 bg-primary/5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold">Preview: {deliveries.find(d => d.id === previewDeliveryId)?.user_email}</p>
                  <Button onClick={() => { setPreviewDeliveryId(null); setPreviewImages([]); }} variant="ghost" size="sm" className="h-6 w-6 p-0"><X className="h-3 w-3" /></Button>
                </div>
                {loadingPreview ? (
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {previewImages.map(img => (
                      <div key={img.id} className="space-y-1">
                        <img src={img.preview_url} alt={img.image_filename} className="w-full aspect-square object-cover rounded border border-border/30" loading="lazy" />
                        <p className="text-[9px] text-muted-foreground truncate">{img.image_filename}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
