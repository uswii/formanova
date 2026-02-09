import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  RefreshCw, Eye, Clock, CheckCircle2, XCircle, Loader2,
  Mail, Image as ImageIcon, Download, ExternalLink, ShieldCheck, LogOut,
  ChevronDown, ChevronRight, Copy, Truck, AlertTriangle, Hash, FileSpreadsheet,
  Search, Link2, Save, X, Trash2
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getStoredToken } from '@/lib/auth-api';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const ADMIN_API_URL = `${SUPABASE_URL}/functions/v1/admin-batches`;

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
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
  skin_tones: string[];
  inspiration_url: string | null;
  drive_link: string | null;
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
  inspiration_url: string | null;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function toPKT(dateStr: string): string {
  const d = new Date(dateStr);
  // PKT = UTC+5
  const pkt = new Date(d.getTime() + 5 * 60 * 60 * 1000);
  const day = pkt.getUTCDate().toString().padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[pkt.getUTCMonth()];
  const year = pkt.getUTCFullYear();
  const h = pkt.getUTCHours();
  const m = pkt.getUTCMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${day} ${month} ${year}, ${h12}:${m} ${ampm} PKT`;
}

const statusConfig: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  pending: { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-400', icon: Clock },
  processing: { bg: 'bg-blue-500/15 border-blue-500/30', text: 'text-blue-400', icon: Loader2 },
  completed: { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-400', icon: CheckCircle2 },
  failed: { bg: 'bg-red-500/15 border-red-500/30', text: 'text-red-400', icon: XCircle },
  partial: { bg: 'bg-orange-500/15 border-orange-500/30', text: 'text-orange-400', icon: AlertTriangle },
  delivered: { bg: 'bg-violet-500/15 border-violet-500/30', text: 'text-violet-400', icon: Truck },
};

const ALL_STATUSES = ['pending', 'processing', 'completed', 'failed', 'partial', 'delivered'];

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.pending;
  const Icon = cfg.icon;
  const isSpinning = status === 'processing';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
      <Icon className={`h-3 w-3 ${isSpinning ? 'animate-spin' : ''}`} />
      {status}
    </span>
  );
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast({ title: 'Copied to clipboard' });
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function AdminBatches() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const [adminSecret, setAdminSecret] = useState<string | null>(() => sessionStorage.getItem('admin_secret'));
  const [secretInput, setSecretInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [gateError, setGateError] = useState('');
  const [batches, setBatches] = useState<BatchJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [batchImages, setBatchImages] = useState<Record<string, BatchImage[]>>({});
  const [loadingImages, setLoadingImages] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<{ url: string; title: string } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [editingDriveLink, setEditingDriveLink] = useState<string | null>(null);
  const [driveLinkInput, setDriveLinkInput] = useState('');
  const [savingDriveLink, setSavingDriveLink] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState<string | null>(null);

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

  const fetchBatches = useCallback(async (search?: string) => {
    setLoading(true);
    try {
      const searchParam = search !== undefined ? search : activeSearch;
      const queryStr = searchParam ? `&search=${encodeURIComponent(searchParam)}` : '';
      const response = await fetch(`${ADMIN_API_URL}?action=list_batches${queryStr}`, { headers: getAdminHeaders() });
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
  }, [getAdminHeaders, activeSearch]);

  const handleSearch = useCallback(() => {
    setActiveSearch(searchQuery);
    fetchBatches(searchQuery);
  }, [searchQuery, fetchBatches]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setActiveSearch('');
    fetchBatches('');
  }, [fetchBatches]);

  const handleSaveDriveLink = useCallback(async (batchId: string) => {
    setSavingDriveLink(true);
    try {
      const response = await fetch(`${ADMIN_API_URL}?action=update_drive_link`, {
        method: 'POST',
        headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batchId, drive_link: driveLinkInput.trim() || null }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save drive link');
      }
      const data = await response.json();
      setBatches(prev => prev.map(b => b.id === batchId ? { ...b, ...data.batch } : b));
      setEditingDriveLink(null);
      toast({ title: 'Drive link saved' });
    } catch (err: any) {
      toast({ title: err.message || 'Failed to save', variant: 'destructive' });
    } finally {
      setSavingDriveLink(false);
    }
  }, [getAdminHeaders, driveLinkInput]);

  const fetchBatchImages = useCallback(async (batchId: string) => {
    if (batchImages[batchId]) return; // already loaded
    setLoadingImages(batchId);
    try {
      const response = await fetch(`${ADMIN_API_URL}?action=get_images&batch_id=${batchId}`, { headers: getAdminHeaders() });
      if (!response.ok) throw new Error('Failed to fetch images');
      const data = await response.json();
      setBatchImages(prev => ({ ...prev, [batchId]: data.images || [] }));
    } catch (err) {
      console.error('Failed to fetch batch images:', err);
      toast({ title: 'Failed to load images', variant: 'destructive' });
    } finally {
      setLoadingImages(null);
    }
  }, [getAdminHeaders, batchImages]);

  const handleUpdateStatus = useCallback(async (batchId: string, newStatus: string) => {
    setUpdatingStatus(batchId);
    try {
      const response = await fetch(`${ADMIN_API_URL}?action=update_status`, {
        method: 'POST',
        headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batchId, status: newStatus }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update status');
      }
      const data = await response.json();
      setBatches(prev => prev.map(b => b.id === batchId ? { ...b, ...data.batch } : b));
      toast({ title: `Status updated to "${newStatus}"` });
    } catch (err: any) {
      toast({ title: err.message || 'Failed to update', variant: 'destructive' });
    } finally {
      setUpdatingStatus(null);
    }
  }, [getAdminHeaders]);

  const handleDeleteBatch = useCallback(async (batchId: string) => {
    setDeletingBatch(batchId);
    try {
      const response = await fetch(`${ADMIN_API_URL}?action=delete_batch`, {
        method: 'POST',
        headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batchId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete batch');
      }
      setBatches(prev => prev.filter(b => b.id !== batchId));
      if (expandedBatchId === batchId) setExpandedBatchId(null);
      toast({ title: 'Batch deleted' });
    } catch (err: any) {
      toast({ title: err.message || 'Failed to delete', variant: 'destructive' });
    } finally {
      setDeletingBatch(null);
    }
  }, [getAdminHeaders, expandedBatchId]);

  useEffect(() => {
    if (isAuthenticated) fetchBatches();
  }, [isAuthenticated, fetchBatches]);

  const toggleBatch = (batchId: string) => {
    if (expandedBatchId === batchId) {
      setExpandedBatchId(null);
    } else {
      setExpandedBatchId(batchId);
      fetchBatchImages(batchId);
    }
  };

  const handleVerifySecret = async () => {
    if (!secretInput.trim()) { setGateError('Enter password'); return; }
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
      setGateError('Connection failed');
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

  const exportBatchesCSV = useCallback(() => {
    if (batches.length === 0) return;
    const headers = ['Batch ID', 'User Name', 'User Email', 'Notification Email', 'Category', 'Skin Tones', 'Status', 'Total Images', 'Completed', 'Failed', 'Workflow ID', 'Has Inspiration', 'Drive Link', 'Created (PKT)', 'Updated (PKT)', 'Completed (PKT)', 'Error'];
    const esc = (v: string | number) => { const s = String(v); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = batches.map(b => [b.id, b.user_display_name || '', b.user_email, b.notification_email || b.user_email, b.jewelry_category, (b.skin_tones || []).join('; '), b.status, b.total_images, b.completed_images, b.failed_images, b.workflow_id || '', b.inspiration_url ? 'Yes' : 'No', b.drive_link || '', toPKT(b.created_at), toPKT(b.updated_at), b.completed_at ? toPKT(b.completed_at) : '', b.error_message || '']);
    const csv = [headers.join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `formanova-batches-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast({ title: `Exported ${batches.length} batches` });
  }, [batches]);

  const exportFullDashboard = useCallback(async () => {
    try {
      // Fetch all images
      const response = await fetch(`${ADMIN_API_URL}?action=all_images`, { headers: getAdminHeaders() });
      if (!response.ok) throw new Error('Failed to fetch images');
      const data = await response.json();
      const allImages = (data.images || []) as BatchImage[];

      // Build batch lookup
      const batchMap: Record<string, BatchJob> = {};
      for (const b of batches) batchMap[b.id] = b;

      const headers = [
        'Batch ID', 'User Name', 'User Email', 'Notification Email', 'Category', 'Batch Status',
        'Image #', 'Image ID', 'Skin Tone', 'Image Status', 'Flagged', 'Is Worn', 'Classification',
        'Original URL', 'Result URL', 'Mask URL', 'Inspiration URL', 'Batch Inspiration URL',
        'Batch Created (PKT)', 'Batch Completed (PKT)', 'Image Started (PKT)', 'Image Completed (PKT)', 'Error'
      ];
      const esc = (v: string | number) => { const s = String(v); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };

      const rows = allImages.map(img => {
        const b = batchMap[img.batch_id];
        return [
          img.batch_id,
          b?.user_display_name || '',
          b?.user_email || '',
          b?.notification_email || b?.user_email || '',
          b?.jewelry_category || '',
          b?.status || '',
          img.sequence_number,
          img.id,
          img.skin_tone || '',
          img.status,
          img.classification_flagged ? 'Yes' : 'No',
          img.classification_is_worn ? 'Yes' : 'No',
          img.classification_category || '',
          img.original_url || '',
          img.result_url || '',
          img.mask_url || '',
          img.inspiration_url || '',
          b?.inspiration_url || '',
          b?.created_at ? toPKT(b.created_at) : '',
          b?.completed_at ? toPKT(b.completed_at) : '',
          img.processing_started_at ? toPKT(img.processing_started_at) : '',
          img.processing_completed_at ? toPKT(img.processing_completed_at) : '',
          img.error_message || ''
        ];
      });

      const csv = [headers.join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `formanova-full-export-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      toast({ title: `Exported ${allImages.length} image records across ${batches.length} batches` });
    } catch (err) {
      console.error('Full export failed:', err);
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  }, [batches, getAdminHeaders]);

  // ═══════════════════════════════════════════════════════════════
  // AUTH GATE — Not logged in
  // ═══════════════════════════════════════════════════════════════
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="relative w-full max-w-sm">
          <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-primary/30 via-primary/10 to-primary/30 blur-xl opacity-60" />
          <Card className="relative bg-card/90 backdrop-blur border-border/40 shadow-2xl">
            <CardContent className="pt-10 pb-8 px-8 text-center space-y-6">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shadow-[0_0_30px_hsl(var(--primary)/0.2)]">
                <ShieldCheck className="h-7 w-7 text-primary" />
              </div>
              <Button onClick={signInWithGoogle} className="w-full gap-2 font-semibold">
                Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // AUTH GATE — Need admin password
  // ═══════════════════════════════════════════════════════════════
  if (!adminSecret) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="relative w-full max-w-sm">
          <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-primary/30 via-primary/10 to-primary/30 blur-xl opacity-60" />
          <Card className="relative bg-card/90 backdrop-blur border-border/40 shadow-2xl">
            <CardContent className="pt-10 pb-8 px-8 space-y-6">
              <div className="text-center">
                <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shadow-[0_0_30px_hsl(var(--primary)/0.2)] mb-4">
                  <ShieldCheck className="h-7 w-7 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground font-mono">{user.email}</p>
              </div>
              <div className="space-y-3">
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={secretInput}
                  onChange={(e) => { setSecretInput(e.target.value); setGateError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifySecret()}
                  className="font-mono text-center text-lg tracking-widest bg-background/50 border-border/50 h-12"
                />
                {gateError && (
                  <p className="text-xs text-destructive text-center">{gateError}</p>
                )}
                <Button
                  onClick={handleVerifySecret}
                  disabled={!secretInput.trim() || verifying}
                  className="w-full h-11 font-semibold shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
                >
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enter'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════════════
  const stats = {
    total: batches.length,
    pending: batches.filter(b => b.status === 'pending').length,
    processing: batches.filter(b => b.status === 'processing').length,
    completed: batches.filter(b => b.status === 'completed').length,
    delivered: batches.filter(b => b.status === 'delivered').length,
    failed: batches.filter(b => b.status === 'failed').length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="border-b border-border/40 bg-card/30 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_hsl(145_60%_50%/0.6)]" />
            <span className="font-display text-lg tracking-wider">ADMIN</span>
            <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
              {user.email}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button onClick={exportBatchesCSV} variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground" title="Export batches summary">
              <Download className="h-3.5 w-3.5" /> Batches
            </Button>
            <Button onClick={exportFullDashboard} variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground" title="Export all batches + images with skin tones">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Full Export
            </Button>
            <Button onClick={() => fetchBatches()} variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={handleLogout} variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {([
            { label: 'Total', value: stats.total, color: 'text-foreground' },
            { label: 'Pending', value: stats.pending, color: 'text-amber-400' },
            { label: 'Processing', value: stats.processing, color: 'text-blue-400' },
            { label: 'Completed', value: stats.completed, color: 'text-emerald-400' },
            { label: 'Delivered', value: stats.delivered, color: 'text-violet-400' },
            { label: 'Failed', value: stats.failed, color: 'text-red-400' },
          ] as const).map(({ label, value, color }) => (
            <div key={label} className="border border-border/40 bg-card/30 rounded p-3">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
              <p className={`text-xl font-display mt-0.5 ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by email, batch ID, category, status, drive link…"
              className="pl-9 h-9 text-xs bg-card/30 border-border/40"
            />
            {activeSearch && (
              <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          <Button onClick={handleSearch} size="sm" variant="outline" className="h-9 gap-1.5 text-xs">
            <Search className="h-3.5 w-3.5" /> Search
          </Button>
          {activeSearch && (
            <span className="text-[10px] text-muted-foreground">
              Showing {batches.length} result{batches.length !== 1 ? 's' : ''} for "{activeSearch}"
            </span>
          )}
        </div>

        {/* Main Table */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No batches yet</p>
          </div>
        ) : (
          <div className="border border-border/40 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-card/60 border-b border-border/40">
                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-8"></th>
                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</th>
                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Batch ID</th>
                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Category</th>
                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Skin Tone</th>
                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">User</th>
                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Email</th>
                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Notify Email</th>
                    <th className="text-center px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Images</th>
                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Created (PKT)</th>
                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Completed (PKT)</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => {
                    const isExpanded = expandedBatchId === batch.id;
                    const images = batchImages[batch.id] || [];
                    const isLoadingThisImages = loadingImages === batch.id;

                    return (
                      <>
                        {/* Batch Row */}
                        <tr
                          key={batch.id}
                          className={`border-b border-border/20 cursor-pointer transition-colors ${
                            isExpanded ? 'bg-primary/5' : 'hover:bg-card/40'
                          }`}
                          onClick={() => toggleBatch(batch.id)}
                        >
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={batch.status} />
                          </td>
                          <td className="px-3 py-2.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(batch.id); }}
                              className="font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                              title={batch.id}
                            >
                              {batch.id.slice(0, 8)}…
                            </button>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant="outline" className="capitalize text-[10px]">{batch.jewelry_category}</Badge>
                          </td>
                          <td className="px-3 py-2.5 capitalize text-muted-foreground">
                            {batch.skin_tones?.length ? batch.skin_tones.join(', ') : '—'}
                          </td>
                          <td className="px-3 py-2.5 font-medium">
                            {batch.user_display_name || batch.user_email.split('@')[0]}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {batch.user_email}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {batch.notification_email && batch.notification_email !== batch.user_email
                              ? batch.notification_email
                              : <span className="text-muted-foreground/40">same</span>
                            }
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="text-emerald-400">{batch.completed_images}</span>
                            <span className="text-muted-foreground/40 mx-0.5">/</span>
                            <span>{batch.total_images}</span>
                            {batch.failed_images > 0 && (
                              <span className="text-red-400 ml-1">({batch.failed_images}✗)</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap text-[11px]">
                            {toPKT(batch.created_at)}
                          </td>
                          <td className="px-3 py-2.5 text-[11px] whitespace-nowrap">
                            {batch.completed_at
                              ? <span className="text-emerald-400/80">{toPKT(batch.completed_at)}</span>
                              : <span className="text-muted-foreground/30">—</span>
                            }
                          </td>
                        </tr>

                        {/* Expanded Detail Row */}
                        {isExpanded && (
                          <tr key={`${batch.id}-detail`}>
                            <td colSpan={11} className="bg-card/40 border-b border-border/30 px-0">
                              <div className="px-6 py-5 space-y-5">
                                {/* Info Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                                  <div>
                                    <span className="text-muted-foreground/60 block text-[10px] uppercase tracking-wider mb-0.5">Full Batch ID</span>
                                    <button onClick={() => copyToClipboard(batch.id)} className="font-mono text-foreground hover:text-primary transition-colors flex items-center gap-1 text-[11px]">
                                      {batch.id} <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                                    </button>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground/60 block text-[10px] uppercase tracking-wider mb-0.5">Workflow ID</span>
                                    {batch.workflow_id ? (
                                      <button onClick={() => copyToClipboard(batch.workflow_id!)} className="font-mono text-foreground hover:text-primary transition-colors flex items-center gap-1 text-[11px]">
                                        {batch.workflow_id.slice(0, 16)}… <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                                      </button>
                                    ) : <span className="text-muted-foreground/40">—</span>}
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground/60 block text-[10px] uppercase tracking-wider mb-0.5">Skin Tone(s)</span>
                                    <span className="capitalize">{batch.skin_tones?.length ? batch.skin_tones.join(', ') : '—'}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground/60 block text-[10px] uppercase tracking-wider mb-0.5">Updated (PKT)</span>
                                    <span>{toPKT(batch.updated_at)}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground/60 block text-[10px] uppercase tracking-wider mb-0.5">Update Status</span>
                                    <div className="flex items-center gap-2">
                                      <Select
                                        value={batch.status}
                                        onValueChange={(val) => handleUpdateStatus(batch.id, val)}
                                        disabled={updatingStatus === batch.id}
                                      >
                                        <SelectTrigger className="w-32 h-7 text-[11px] bg-background/50 border-border/40">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {ALL_STATUSES.map(s => (
                                            <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      {updatingStatus === batch.id && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground/60 block text-[10px] uppercase tracking-wider mb-0.5">Actions</span>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1"
                                          disabled={deletingBatch === batch.id}
                                        >
                                          {deletingBatch === batch.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                          Delete
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete this batch?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            This will permanently delete the batch and all {batch.total_images} associated image records. Azure blobs will not be deleted.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDeleteBatch(batch.id)}
                                            className="bg-red-600 hover:bg-red-700"
                                          >
                                            Delete
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </div>

                                {/* Drive Link */}
                                <div className="flex items-start gap-3 p-2.5 rounded bg-card/60 border border-border/30">
                                  <Link2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold block mb-1">Google Drive Link</span>
                                    {editingDriveLink === batch.id ? (
                                      <div className="flex items-center gap-2">
                                        <Input
                                          value={driveLinkInput}
                                          onChange={(e) => setDriveLinkInput(e.target.value)}
                                          placeholder="https://drive.google.com/..."
                                          className="h-7 text-[11px] bg-background/50 border-border/40 flex-1"
                                          onKeyDown={(e) => e.key === 'Enter' && handleSaveDriveLink(batch.id)}
                                        />
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 w-7 p-0"
                                          onClick={() => handleSaveDriveLink(batch.id)}
                                          disabled={savingDriveLink}
                                        >
                                          {savingDriveLink ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 w-7 p-0"
                                          onClick={() => setEditingDriveLink(null)}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        {batch.drive_link ? (
                                          <>
                                            <a
                                              href={batch.drive_link}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-[11px] text-primary hover:underline truncate max-w-[400px]"
                                            >
                                              {batch.drive_link}
                                            </a>
                                            <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                          </>
                                        ) : (
                                          <span className="text-[11px] text-muted-foreground/40">No link added</span>
                                        )}
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 text-[10px] text-muted-foreground hover:text-foreground px-2"
                                          onClick={() => {
                                            setEditingDriveLink(batch.id);
                                            setDriveLinkInput(batch.drive_link || '');
                                          }}
                                        >
                                          {batch.drive_link ? 'Edit' : 'Add Link'}
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Global Inspiration */}
                                {batch.inspiration_url && (
                                  <div className="flex items-center gap-3 p-2.5 rounded bg-primary/5 border border-primary/10">
                                    <div
                                      className="w-14 h-14 rounded overflow-hidden cursor-pointer flex-shrink-0 border border-border/30"
                                      onClick={() => setImagePreview({ url: batch.inspiration_url!, title: 'Global Inspiration' })}
                                    >
                                      <img
                                        src={batch.inspiration_url}
                                        alt="Inspiration"
                                        className="w-full h-full object-cover"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                      />
                                    </div>
                                    <div>
                                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold block">Global Inspiration</span>
                                      <span className="text-[11px] text-muted-foreground">Mood board reference for all images</span>
                                    </div>
                                  </div>
                                )}

                                {batch.error_message && (
                                  <div className="p-2.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                                    {batch.error_message}
                                  </div>
                                )}

                                {/* Images Table */}
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                                    Images ({isLoadingThisImages ? '…' : images.length})
                                  </p>
                                  {isLoadingThisImages ? (
                                    <div className="space-y-1.5">
                                      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                                    </div>
                                  ) : images.length === 0 ? (
                                    <p className="text-muted-foreground/50 text-xs text-center py-4">No images</p>
                                  ) : (
                                    <div className="border border-border/30 rounded overflow-hidden">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="bg-card/50 border-b border-border/30">
                                            <th className="text-left px-2.5 py-2 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold w-12">Preview</th>
                                            <th className="text-left px-2.5 py-2 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold w-8">#</th>
                                            <th className="text-left px-2.5 py-2 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Status</th>
                                            <th className="text-left px-2.5 py-2 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Skin Tone</th>
                                            <th className="text-left px-2.5 py-2 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Flags</th>
                                            <th className="text-left px-2.5 py-2 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Original URL</th>
                                            <th className="text-left px-2.5 py-2 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Result URL</th>
                                            <th className="text-left px-2.5 py-2 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Mask URL</th>
                                            <th className="text-left px-2.5 py-2 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Inspiration</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {images.map((img) => (
                                            <tr key={img.id} className="border-b border-border/20 hover:bg-card/30 transition-colors">
                                              <td className="px-2.5 py-1.5">
                                                <div
                                                  className="w-10 h-10 rounded bg-muted/30 overflow-hidden cursor-pointer flex-shrink-0"
                                                  onClick={() => img.original_url && setImagePreview({ url: img.original_url, title: `#${img.sequence_number} Original` })}
                                                >
                                                  {(img.thumbnail_url || img.original_url) ? (
                                                    <img
                                                      src={img.thumbnail_url || img.original_url}
                                                      alt={`#${img.sequence_number}`}
                                                      className="w-full h-full object-cover"
                                                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                  ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                      <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
                                                    </div>
                                                  )}
                                                </div>
                                              </td>
                                              <td className="px-2.5 py-1.5 font-mono text-muted-foreground">{img.sequence_number}</td>
                                              <td className="px-2.5 py-1.5"><StatusBadge status={img.status} /></td>
                                              <td className="px-2.5 py-1.5 capitalize text-muted-foreground">{img.skin_tone || '—'}</td>
                                              <td className="px-2.5 py-1.5">
                                                {img.classification_flagged && <Badge variant="destructive" className="text-[9px] px-1 py-0">Flagged</Badge>}
                                                {img.classification_is_worn && <span className="text-[9px] text-muted-foreground ml-1">Worn</span>}
                                              </td>
                                              <td className="px-2.5 py-1.5">
                                                {img.original_url ? (
                                                  <button
                                                    onClick={() => setImagePreview({ url: img.original_url, title: `#${img.sequence_number} Original` })}
                                                    className="text-[10px] text-primary hover:underline truncate max-w-[140px] block text-left"
                                                    title={img.original_url}
                                                  >
                                                    View Original
                                                  </button>
                                                ) : <span className="text-muted-foreground/30">—</span>}
                                              </td>
                                              <td className="px-2.5 py-1.5">
                                                {img.result_url ? (
                                                  <button
                                                    onClick={() => setImagePreview({ url: img.result_url!, title: `#${img.sequence_number} Result` })}
                                                    className="text-[10px] text-emerald-400 hover:underline truncate max-w-[140px] block text-left"
                                                  >
                                                    View Result
                                                  </button>
                                                ) : <span className="text-muted-foreground/30">—</span>}
                                              </td>
                                              <td className="px-2.5 py-1.5">
                                                {img.mask_url ? (
                                                  <button
                                                    onClick={() => setImagePreview({ url: img.mask_url!, title: `#${img.sequence_number} Mask` })}
                                                    className="text-[10px] text-blue-400 hover:underline truncate max-w-[140px] block text-left"
                                                  >
                                                    View Mask
                                                  </button>
                                                ) : <span className="text-muted-foreground/30">—</span>}
                                              </td>
                                              <td className="px-2.5 py-1.5">
                                                {img.inspiration_url ? (
                                                  <button
                                                    onClick={() => setImagePreview({ url: img.inspiration_url!, title: `#${img.sequence_number} Inspiration` })}
                                                    className="text-[10px] text-violet-400 hover:underline truncate max-w-[140px] block text-left"
                                                  >
                                                    View Inspiration
                                                  </button>
                                                ) : <span className="text-muted-foreground/30">—</span>}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={!!imagePreview} onOpenChange={() => setImagePreview(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-background/95 backdrop-blur border-border/40">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-sm font-mono flex items-center justify-between">
              <span>{imagePreview?.title}</span>
              {imagePreview?.url && (
                <div className="flex gap-3">
                  <a
                    href={imagePreview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" /> Open
                  </a>
                  <a
                    href={imagePreview.url}
                    download
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <Download className="h-3 w-3" /> Download
                  </a>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-2 flex items-center justify-center">
            {imagePreview?.url && (
              <img
                src={imagePreview.url}
                alt={imagePreview.title}
                className="max-w-full max-h-[75vh] object-contain rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).alt = 'Failed to load image';
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
