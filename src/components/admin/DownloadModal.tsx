import { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import {
  Download, Loader2, Package, X, AlertTriangle,
} from 'lucide-react';
import JSZip from 'jszip';

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
  skin_tones: string[];
  inspiration_url: string | null;
  drive_link: string | null;
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
  inspiration_url: string | null;
  status: string;
  created_at: string;
}

interface DownloadModalProps {
  open: boolean;
  onClose: () => void;
  batches: BatchJob[];
  getAdminHeaders: () => Record<string, string>;
}

const ALL_STATUSES = ['pending', 'processing', 'completed', 'failed', 'partial', 'delivered'];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function fetchImageBlob(
  url: string,
  headers: Record<string, string>,
): Promise<Uint8Array | null> {
  try {
    // Proxy through admin-batches edge function to avoid CORS issues with Azure
    const proxyUrl = `${SUPABASE_URL}/functions/v1/admin-batches?action=proxy_image&url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl, { headers });
    if (!response.ok) {
      console.warn(`[ZIP] proxy_image failed ${response.status} for ${url.substring(0, 80)}…`);
      return null;
    }
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (e) {
    console.warn('[ZIP] fetchImageBlob error:', e);
    return null;
  }
}

export default function DownloadModal({ open, onClose, batches, getAdminHeaders }: DownloadModalProps) {
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['completed', 'delivered']);
  const [batchIdsInput, setBatchIdsInput] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [emailsInput, setEmailsInput] = useState('');
  const [maxUsers, setMaxUsers] = useState('');
  const [skipUsersInput, setSkipUsersInput] = useState('');
  const [includeUploads, setIncludeUploads] = useState(true);
  const [includeOutputs, setIncludeOutputs] = useState(true);
  const [includeInspiration, setIncludeInspiration] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(true);

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState('');

  const ADMIN_API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-batches`;

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setProgress(0);
    setProgressLabel('Fetching batch data…');
    setError('');

    try {
      // 1. Filter batches based on criteria
      let filtered = [...batches];

      // Status filter
      if (selectedStatuses.length > 0) {
        filtered = filtered.filter(b => selectedStatuses.includes(b.status));
      }

      // Batch IDs filter
      const batchIds = batchIdsInput.split(',').map(s => s.trim()).filter(Boolean);
      if (batchIds.length > 0) {
        filtered = filtered.filter(b => batchIds.some(id => b.id.includes(id)));
      }

      // Date range
      if (dateFrom) {
        const from = new Date(dateFrom);
        filtered = filtered.filter(b => new Date(b.created_at) >= from);
      }
      if (dateTo) {
        const to = new Date(dateTo + 'T23:59:59Z');
        filtered = filtered.filter(b => new Date(b.created_at) <= to);
      }

      // Email filter
      const emails = emailsInput.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      if (emails.length > 0) {
        filtered = filtered.filter(b =>
          emails.some(e => b.user_email.toLowerCase().includes(e))
        );
      }

      // Skip users
      const skipUsers = skipUsersInput.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      if (skipUsers.length > 0) {
        filtered = filtered.filter(b =>
          !skipUsers.some(s => b.user_email.toLowerCase().includes(s) || b.user_id.includes(s))
        );
      }

      // Max users
      if (maxUsers && parseInt(maxUsers) > 0) {
        const limit = parseInt(maxUsers);
        const uniqueEmails = [...new Set(filtered.map(b => b.user_email))].slice(0, limit);
        filtered = filtered.filter(b => uniqueEmails.includes(b.user_email));
      }

      if (filtered.length === 0) {
        setError('No batches match your filters.');
        setGenerating(false);
        return;
      }

      setProgressLabel(`Found ${filtered.length} batches. Fetching images…`);

      // 2. Fetch all images for filtered batches
      const allImages: BatchImage[] = [];
      for (let i = 0; i < filtered.length; i++) {
        const batch = filtered[i];
        setProgressLabel(`Fetching images for batch ${i + 1}/${filtered.length}…`);
        try {
          const res = await fetch(
            `${ADMIN_API_URL}?action=get_images&batch_id=${batch.id}`,
            { headers: getAdminHeaders() }
          );
          if (res.ok) {
            const data = await res.json();
            allImages.push(...(data.images || []));
          }
        } catch (e) {
          console.warn(`Failed to fetch images for batch ${batch.id}`, e);
        }
        setProgress(((i + 1) / filtered.length) * 20); // 0-20% for fetching metadata
      }

      // 3. Calculate total images to download
      let totalImageCount = 0;
      for (const img of allImages) {
        if (includeUploads && img.original_url) totalImageCount++;
        if (includeOutputs && img.result_url) totalImageCount++;
        if (includeInspiration && img.inspiration_url) totalImageCount++;
      }
      // Add batch-level inspiration
      for (const batch of filtered) {
        if (includeInspiration && batch.inspiration_url) totalImageCount++;
      }

      if (totalImageCount === 0 && !includeMetadata) {
        setError('No images to download with current filters.');
        setGenerating(false);
        return;
      }

      // 4. Build ZIP
      const zip = new JSZip();
      let downloadedCount = 0;

      // Group batches by user email
      const userBatches: Record<string, BatchJob[]> = {};
      for (const b of filtered) {
        if (!userBatches[b.user_email]) userBatches[b.user_email] = [];
        userBatches[b.user_email].push(b);
      }

      for (const [email, userBatchList] of Object.entries(userBatches)) {
        for (const batch of userBatchList) {
          const categorySlug = batch.jewelry_category.toLowerCase().replace(/\s+/g, '_');
          const folderName = `${email}/Batch_${batch.id.slice(0, 8)}_${categorySlug}`;
          const batchImages = allImages.filter(img => img.batch_id === batch.id);

          // Uploads
          if (includeUploads) {
            let uploadIdx = 1;
            for (const img of batchImages) {
              if (!img.original_url) continue;
              setProgressLabel(`Downloading upload ${uploadIdx} for ${email}…`);
              const blob = await fetchImageBlob(img.original_url, getAdminHeaders());
              if (blob) {
                const ext = img.original_url.includes('.png') ? 'png' : 'jpg';
                zip.file(`${folderName}/uploads/upload_${String(uploadIdx).padStart(2, '0')}.${ext}`, blob);
              }
              uploadIdx++;
              downloadedCount++;
              setProgress(20 + (downloadedCount / Math.max(totalImageCount, 1)) * 70);
            }
          }

          // Outputs
          if (includeOutputs) {
            let outputIdx = 1;
            for (const img of batchImages) {
              if (!img.result_url) continue;
              setProgressLabel(`Downloading output ${outputIdx} for ${email}…`);
              const blob = await fetchImageBlob(img.result_url, getAdminHeaders());
              if (blob) {
                const ext = img.result_url.includes('.png') ? 'png' : 'jpg';
                zip.file(`${folderName}/outputs/output_v${outputIdx}.${ext}`, blob);
              }
              outputIdx++;
              downloadedCount++;
              setProgress(20 + (downloadedCount / Math.max(totalImageCount, 1)) * 70);
            }
          }

          // Inspiration (per-image)
          if (includeInspiration) {
            let inspoIdx = 1;
            for (const img of batchImages) {
              if (!img.inspiration_url) continue;
              setProgressLabel(`Downloading inspiration for ${email}…`);
              const blob = await fetchImageBlob(img.inspiration_url, getAdminHeaders());
              if (blob) {
                const ext = img.inspiration_url.includes('.png') ? 'png' : 'jpg';
                zip.file(`${folderName}/inspiration/inspo_general_${String(inspoIdx).padStart(2, '0')}.${ext}`, blob);
              }
              inspoIdx++;
              downloadedCount++;
              setProgress(20 + (downloadedCount / Math.max(totalImageCount, 1)) * 70);
            }
            // Batch-level inspiration
            if (batch.inspiration_url) {
              const blob = await fetchImageBlob(batch.inspiration_url, getAdminHeaders());
              if (blob) {
                const ext = batch.inspiration_url.includes('.png') ? 'png' : 'jpg';
                zip.file(`${folderName}/inspiration/inspo_batch_reference.${ext}`, blob);
              }
              downloadedCount++;
              setProgress(20 + (downloadedCount / Math.max(totalImageCount, 1)) * 70);
            }
          }

          // Metadata
          if (includeMetadata) {
            const metadata = {
              user_name: batch.user_display_name || batch.user_email.split('@')[0],
              email: batch.user_email,
              batch_id: batch.id,
              category: batch.jewelry_category,
              skin_tones: batch.skin_tones,
              status: batch.status,
              total_images: batch.total_images,
              completed_images: batch.completed_images,
              created_at: batch.created_at,
              completed_at: batch.completed_at,
              drive_link: batch.drive_link,
              images: batchImages.map(img => ({
                sequence: img.sequence_number,
                skin_tone: img.skin_tone,
                status: img.status,
                has_original: !!img.original_url,
                has_result: !!img.result_url,
                has_inspiration: !!img.inspiration_url,
              })),
            };
            zip.file(`${folderName}/metadata.json`, JSON.stringify(metadata, null, 2));
          }
        }
      }

      // 5. Generate ZIP blob
      setProgress(92);
      setProgressLabel('Compressing ZIP file…');

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      // 6. Download
      setProgress(100);
      setProgressLabel('Download ready!');

      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `formanova-export-${dateStr}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);

      setTimeout(() => {
        setGenerating(false);
        setProgress(0);
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('ZIP generation failed:', err);
      setError(err.message || 'Failed to generate ZIP');
      setGenerating(false);
    }
  }, [batches, selectedStatuses, batchIdsInput, dateFrom, dateTo, emailsInput, maxUsers, skipUsersInput, includeUploads, includeOutputs, includeInspiration, includeMetadata, getAdminHeaders, onClose, ADMIN_API_URL]);

  return (
    <Dialog open={open} onOpenChange={() => !generating && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-primary" />
            Download ZIP Export
          </DialogTitle>
        </DialogHeader>

        {generating ? (
          <div className="space-y-4 py-4">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">{progressLabel}</p>
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 p-2 rounded">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 p-2 rounded">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Status Filter */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Filter by Status
              </Label>
              <div className="flex flex-wrap gap-2">
                {ALL_STATUSES.map(status => (
                  <label key={status} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={selectedStatuses.includes(status)}
                      onCheckedChange={() => toggleStatus(status)}
                    />
                    <span className="text-xs capitalize">{status}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Batch IDs */}
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Specific Batch IDs <span className="text-muted-foreground/50">(comma-separated, optional)</span>
              </Label>
              <Input
                value={batchIdsInput}
                onChange={e => setBatchIdsInput(e.target.value)}
                placeholder="abc123, def456…"
                className="h-8 text-xs bg-background/50 border-border/40"
              />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Date From
                </Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="h-8 text-xs bg-background/50 border-border/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Date To
                </Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="h-8 text-xs bg-background/50 border-border/40"
                />
              </div>
            </div>

            {/* Email Filter */}
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Filter by Email <span className="text-muted-foreground/50">(comma-separated, optional)</span>
              </Label>
              <Input
                value={emailsInput}
                onChange={e => setEmailsInput(e.target.value)}
                placeholder="user@email.com, other@email.com…"
                className="h-8 text-xs bg-background/50 border-border/40"
              />
            </div>

            {/* Max Users & Skip Users */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Max Users
                </Label>
                <Input
                  type="number"
                  value={maxUsers}
                  onChange={e => setMaxUsers(e.target.value)}
                  placeholder="All"
                  min={1}
                  className="h-8 text-xs bg-background/50 border-border/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Skip User IDs/Emails
                </Label>
                <Input
                  value={skipUsersInput}
                  onChange={e => setSkipUsersInput(e.target.value)}
                  placeholder="skip@email.com…"
                  className="h-8 text-xs bg-background/50 border-border/40"
                />
              </div>
            </div>

            {/* Include Options */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Include in Download
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Uploads (originals)', checked: includeUploads, set: setIncludeUploads },
                  { label: 'Outputs (results)', checked: includeOutputs, set: setIncludeOutputs },
                  { label: 'Inspiration images', checked: includeInspiration, set: setIncludeInspiration },
                  { label: 'Metadata (JSON)', checked: includeMetadata, set: setIncludeMetadata },
                ].map(opt => (
                  <label key={opt.label} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={opt.checked}
                      onCheckedChange={(v) => opt.set(!!v)}
                    />
                    <span className="text-xs">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="bg-muted/30 rounded p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground text-[10px] uppercase tracking-wider">Preview</p>
              <p>{batches.length} total batches loaded</p>
              <p>Statuses: {selectedStatuses.length ? selectedStatuses.join(', ') : 'all'}</p>
            </div>
          </div>
        )}

        {!generating && (
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={selectedStatuses.length === 0}
              className="gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Generate ZIP
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
