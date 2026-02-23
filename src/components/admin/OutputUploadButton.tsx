import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, Trash2, Eye } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const ADMIN_API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-batches`;

interface OutputUploadButtonProps {
  batchId: string;
  imageId: string;
  currentResultUrl: string | null;
  getAdminHeaders: () => Record<string, string>;
  onUploaded: (imageId: string, resultUrl: string) => void;
  onDeleted: (imageId: string) => void;
  onPreview: (url: string, title: string) => void;
}

export default function OutputUploadButton({
  batchId, imageId, currentResultUrl,
  getAdminHeaders, onUploaded, onDeleted, onPreview,
}: OutputUploadButtonProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Only image files allowed', variant: 'destructive' });
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast({ title: 'File too large (max 15MB)', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      // Read as base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await fetch(`${ADMIN_API_URL}?action=upload_output`, {
        method: 'POST',
        headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: batchId,
          image_id: imageId,
          base64,
          content_type: file.type,
          filename: file.name,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Upload failed');
      }

      const data = await response.json();
      onUploaded(imageId, data.image?.result_url || '');
      toast({ title: 'Output uploaded successfully' });
    } catch (err: any) {
      toast({ title: err.message || 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`${ADMIN_API_URL}?action=delete_output`, {
        method: 'POST',
        headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batchId, image_id: imageId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Delete failed');
      }

      onDeleted(imageId);
      toast({ title: 'Output removed' });
    } catch (err: any) {
      toast({ title: err.message || 'Delete failed', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  if (currentResultUrl) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPreview(currentResultUrl, 'Output Preview')}
          className="text-[10px] text-emerald-400 hover:underline"
        >
          View Output
        </button>
        <Button
          size="sm"
          variant="ghost"
          className="h-5 w-5 p-0 text-muted-foreground hover:text-red-400"
          onClick={handleDelete}
          disabled={deleting}
          title="Remove output"
        >
          {deleting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Trash2 className="h-2.5 w-2.5" />}
        </Button>
        <label className="cursor-pointer">
          <Button
            size="sm"
            variant="ghost"
            className="h-5 w-5 p-0 text-muted-foreground hover:text-primary"
            asChild
            title="Replace output"
          >
            <span>
              <Upload className="h-2.5 w-2.5" />
            </span>
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
          />
        </label>
      </div>
    );
  }

  return (
    <label className="cursor-pointer inline-flex">
      <Button
        size="sm"
        variant="ghost"
        className="h-6 gap-1 text-[10px] text-muted-foreground hover:text-primary px-1.5"
        disabled={uploading}
        asChild
      >
        <span>
          {uploading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <Upload className="h-3 w-3" />
              Upload
            </>
          )}
        </span>
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
        disabled={uploading}
      />
    </label>
  );
}
