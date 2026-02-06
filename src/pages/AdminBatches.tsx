import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle 
} from '@/components/ui/dialog';
import { 
  RefreshCw, Eye, Clock, CheckCircle2, XCircle, Loader2,
  Mail, Image as ImageIcon, Download, ExternalLink, ShieldCheck, LogOut
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { getStoredToken } from '@/lib/auth-api';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const ADMIN_API_URL = `${SUPABASE_URL}/functions/v1/admin-batches`;

interface BatchJob {
  id: string;
  user_id: string;
  user_email: string;
  user_display_name: string | null;
  jewelry_category: string;
  notification_email: string | null;
  status: string;
  total_images: number;
  completed_images: number;
  failed_images: number;
  workflow_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface BatchImage {
  id: string;
  batch_id: string;
  sequence_number: number;
  original_url: string;
  result_url: string | null;
  mask_url: string | null;
  thumbnail_url: string | null;
  skin_tone: string | null;
  classification_category: string | null;
  classification_is_worn: boolean | null;
  classification_flagged: boolean | null;
  status: string;
  error_message: string | null;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  processing: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  completed: 'bg-green-500/20 text-green-400 border-green-500/50',
  failed: 'bg-red-500/20 text-red-400 border-red-500/50',
  partial: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
};

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-400" />;
    case 'failed': return <XCircle className="h-4 w-4 text-red-400" />;
    case 'processing': return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
    default: return <Clock className="h-4 w-4 text-yellow-400" />;
  }
};

export default function AdminBatches() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const [adminSecret, setAdminSecret] = useState<string | null>(() => sessionStorage.getItem('admin_secret'));
  const [secretInput, setSecretInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [gateError, setGateError] = useState('');
  const [batches, setBatches] = useState<BatchJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<BatchJob | null>(null);
  const [batchImages, setBatchImages] = useState<BatchImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);

  const isAuthenticated = !!user && !!adminSecret;

  const getAdminHeaders = useCallback((): Record<string, string> => {
    const userToken = getStoredToken();
    return {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
      ...(userToken ? { 'X-User-Token': userToken } : {}),
      ...(adminSecret ? { 'X-Admin-Secret': adminSecret } : {}),
    };
  }, [adminSecret]);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${ADMIN_API_URL}?action=list_batches`, { headers: getAdminHeaders() });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          sessionStorage.removeItem('admin_secret');
          setAdminSecret(null);
          return;
        }
        throw new Error('Failed to fetch batches');
      }
      const data = await response.json();
      setBatches(data.batches || []);
    } catch (err) {
      console.error('Failed to fetch batches:', err);
      toast({ title: 'Failed to load batches', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [getAdminHeaders]);

  const fetchBatchImages = useCallback(async (batchId: string) => {
    setLoadingImages(true);
    try {
      const response = await fetch(`${ADMIN_API_URL}?action=get_images&batch_id=${batchId}`, { headers: getAdminHeaders() });
      if (!response.ok) throw new Error('Failed to fetch images');
      const data = await response.json();
      setBatchImages(data.images || []);
    } catch (err) {
      console.error('Failed to fetch batch images:', err);
      toast({ title: 'Failed to load images', variant: 'destructive' });
    } finally {
      setLoadingImages(false);
    }
  }, [getAdminHeaders]);

  // Auto-fetch batches on successful auth
  useEffect(() => {
    if (isAuthenticated) fetchBatches();
  }, [isAuthenticated, fetchBatches]);

  const handleVerifySecret = async () => {
    if (!secretInput.trim()) { setGateError('Please enter the admin secret'); return; }
    setVerifying(true);
    setGateError('');
    try {
      const userToken = getStoredToken();
      const response = await fetch(`${ADMIN_API_URL}?action=list_batches`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
          ...(userToken ? { 'X-User-Token': userToken } : {}),
          'X-Admin-Secret': secretInput.trim(),
        },
      });
      if (response.ok) {
        sessionStorage.setItem('admin_secret', secretInput.trim());
        setAdminSecret(secretInput.trim());
      } else {
        const data = await response.json().catch(() => ({}));
        setGateError(data.error || 'Access denied');
      }
    } catch {
      setGateError('Failed to verify — check your connection');
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_secret');
    setAdminSecret(null);
    setSecretInput('');
    signOut();
  };

  const handleViewBatch = (batch: BatchJob) => {
    setSelectedBatch(batch);
    fetchBatchImages(batch.id);
  };

  const exportToCSV = useCallback(() => {
    if (batches.length === 0) { toast({ title: 'No data to export', variant: 'destructive' }); return; }
    const headers = ['Batch ID','User Email','Display Name','Category','Notification Email','Status','Total Images','Completed','Failed','Workflow ID','Created At','Completed At','Error Message'];
    const escapeCSV = (v: string | number) => { const s = String(v); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = batches.map(b => [b.id, b.user_email, b.user_display_name || '', b.jewelry_category, b.notification_email || b.user_email, b.status, b.total_images, b.completed_images, b.failed_images, b.workflow_id || '', b.created_at, b.completed_at || '', b.error_message || '']);
    const csv = [headers.join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `formanova-batches-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast({ title: `Exported ${batches.length} batches` });
  }, [batches]);

  const exportBatchImages = useCallback(async () => {
    try {
      const response = await fetch(`${ADMIN_API_URL}?action=all_images`, { headers: getAdminHeaders() });
      if (!response.ok) throw new Error('Failed to fetch images');
      const data = await response.json();
      const allImages = data.images as BatchImage[];
      if (!allImages?.length) { toast({ title: 'No image data to export', variant: 'destructive' }); return; }
      const headers = ['Image ID','Batch ID','Seq','Status','Skin Tone','Category','Is Worn','Flagged','Original URL','Result URL','Mask URL','Thumbnail URL','Started','Completed','Error'];
      const escapeCSV = (v: string | number) => { const s = String(v); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
      const rows = allImages.map(i => [i.id, i.batch_id, i.sequence_number, i.status, i.skin_tone || '', i.classification_category || '', i.classification_is_worn ? 'Yes' : 'No', i.classification_flagged ? 'Yes' : 'No', i.original_url || '', i.result_url || '', i.mask_url || '', i.thumbnail_url || '', i.processing_started_at || '', i.processing_completed_at || '', i.error_message || '']);
      const csv = [headers.join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `formanova-images-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      toast({ title: `Exported ${allImages.length} images` });
    } catch (err) {
      console.error('Failed to export images:', err);
      toast({ title: 'Failed to export images', variant: 'destructive' });
    }
  }, [getAdminHeaders]);

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Auth Gate
  // ═══════════════════════════════════════════════════════════════
  // Not logged in at all
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-6">
        <Card className="w-full max-w-md bg-card/80 backdrop-blur border-border/50">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">Admin Access</CardTitle>
            <p className="text-sm text-muted-foreground">You must be signed in to access the admin dashboard.</p>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={signInWithGoogle} className="gap-2">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Logged in but need admin secret
  if (!adminSecret) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-6">
        <Card className="w-full max-w-md bg-card/80 backdrop-blur border-border/50">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Admin Access</CardTitle>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{user.email}</span>
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Enter Admin Password</label>
              <Input
                type="password"
                placeholder="Enter admin password..."
                value={secretInput}
                onChange={(e) => { setSecretInput(e.target.value); setGateError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifySecret()}
                className="font-mono"
              />
            </div>
            {gateError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <p className="text-sm text-destructive">{gateError}</p>
              </div>
            )}
            <Button onClick={handleVerifySecret} disabled={!secretInput.trim() || verifying} className="w-full gap-2">
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {verifying ? 'Verifying...' : 'Access Dashboard'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Dashboard
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Signed in as <span className="text-foreground font-medium">{user.email}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportToCSV} variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" /> Export Batches
            </Button>
            <Button onClick={exportBatchImages} variant="outline" size="sm" className="gap-2">
              <ExternalLink className="h-4 w-4" /> Export Images
            </Button>
            <Button onClick={fetchBatches} variant="outline" size="sm" className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button onClick={handleLogout} variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Batches', value: batches.length, color: '' },
            { label: 'Processing', value: batches.filter(b => b.status === 'processing').length, color: 'text-blue-400' },
            { label: 'Completed', value: batches.filter(b => b.status === 'completed').length, color: 'text-green-400' },
            { label: 'Failed', value: batches.filter(b => b.status === 'failed').length, color: 'text-red-400' },
          ].map(({ label, value, color }) => (
            <Card key={label} className="bg-card/50 border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
              <CardContent><div className={`text-2xl font-bold ${color}`}>{value}</div></CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader><CardTitle>Recent Batches</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : batches.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No batches submitted yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Notification Email</TableHead>
                      <TableHead>Images</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch) => (
                      <TableRow key={batch.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <StatusIcon status={batch.status} />
                            <Badge className={statusColors[batch.status] || statusColors.pending}>{batch.status}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{batch.user_display_name || batch.user_email.split('@')[0]}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> {batch.user_email}</span>
                            <code className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">{batch.user_id.slice(0, 8)}...</code>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{batch.jewelry_category}</Badge></TableCell>
                        <TableCell><span className="text-sm text-muted-foreground">{batch.notification_email || batch.user_email}</span></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="text-green-400">{batch.completed_images}</span>
                            <span className="text-muted-foreground">/</span>
                            <span>{batch.total_images}</span>
                            {batch.failed_images > 0 && <span className="text-red-400 ml-1">({batch.failed_images} ✗)</span>}
                          </div>
                        </TableCell>
                        <TableCell><span className="text-sm text-muted-foreground whitespace-nowrap">{format(new Date(batch.created_at), 'MMM d, HH:mm')}</span></TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => handleViewBatch(batch)}><Eye className="h-4 w-4 mr-1" /> View</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!selectedBatch} onOpenChange={() => setSelectedBatch(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <StatusIcon status={selectedBatch?.status || 'pending'} /> Batch Details
              </DialogTitle>
            </DialogHeader>
            {selectedBatch && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Batch ID:</span><p className="font-mono text-xs mt-1">{selectedBatch.id}</p></div>
                  <div><span className="text-muted-foreground">User:</span><p className="mt-1">{selectedBatch.user_email}</p></div>
                  <div><span className="text-muted-foreground">Category:</span><p className="mt-1 capitalize">{selectedBatch.jewelry_category}</p></div>
                  <div><span className="text-muted-foreground">Notification Email:</span><p className="mt-1">{selectedBatch.notification_email || 'Same as user'}</p></div>
                  <div><span className="text-muted-foreground">Workflow ID:</span><p className="font-mono text-xs mt-1">{selectedBatch.workflow_id || 'N/A'}</p></div>
                  <div><span className="text-muted-foreground">Created:</span><p className="mt-1">{format(new Date(selectedBatch.created_at), 'PPpp')}</p></div>
                </div>
                {selectedBatch.error_message && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-red-400 text-sm">{selectedBatch.error_message}</p>
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Images ({batchImages.length})</h3>
                  {loadingImages ? (
                    <div className="grid grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
                  ) : batchImages.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No images</p>
                  ) : (
                    <div className="space-y-3">
                      {batchImages.map((img) => (
                        <Card key={img.id} className="p-3 bg-muted/30">
                          <div className="flex items-start gap-4">
                            <div className="w-20 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                              {img.original_url ? (
                                <img src={img.original_url} alt={`Image ${img.sequence_number}`} className="w-full h-full object-cover"
                                  onError={(e) => { const t = e.target as HTMLImageElement; t.style.display = 'none'; t.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-muted-foreground text-xs p-1 text-center">No preview</div>'; }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-8 w-8 text-muted-foreground" /></div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 text-sm space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">#{img.sequence_number}</span>
                                <Badge className={statusColors[img.status] || statusColors.pending}>{img.status}</Badge>
                                {img.classification_flagged && <Badge variant="destructive">Flagged</Badge>}
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                                <div>Skin Tone: {img.skin_tone || 'N/A'}</div>
                                <div>Category: {img.classification_category || 'N/A'}</div>
                                <div>Worn: {img.classification_is_worn ? 'Yes' : 'No'}</div>
                                {img.error_message && <div className="col-span-2 text-red-400">Error: {img.error_message}</div>}
                              </div>
                              <div className="flex flex-wrap gap-2 pt-1">
                                {img.original_url && <a href={img.original_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Original</a>}
                                {img.result_url && <a href={img.result_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Result</a>}
                                {img.mask_url && <a href={img.mask_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Mask</a>}
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
