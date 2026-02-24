import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const DELIVERY_API = `${SUPABASE_URL}/functions/v1/delivery-manager`;

interface GalleryImage {
  id: string;
  image_filename: string;
  sequence: number;
  download_url: string;
}

interface GalleryData {
  category: string;
  user_email: string;
  images: GalleryImage[];
}

export default function DeliveryResults() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<GalleryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`${DELIVERY_API}?action=gallery&token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError('Failed to load results'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#c8a97e]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-center px-6">
        <div>
          <h1 className="text-[#c8a97e] text-2xl tracking-[6px] font-light mb-4">FORMANOVA</h1>
          <p className="text-[#999] text-sm">{error || 'Results not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* Header */}
      <div className="text-center pt-12 pb-8 px-6">
        <h1 className="text-[#c8a97e] text-2xl tracking-[6px] font-light mb-2">FORMANOVA</h1>
        <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#c8a97e] to-transparent mx-auto mb-6" />
        <p className="text-[#e0e0e0] text-lg">
          Your <span className="text-[#c8a97e] capitalize">{data.category}</span> results are ready
        </p>
        <p className="text-[#666] text-sm mt-1">{data.images.length} image{data.images.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Download All */}
      {data.images.length > 1 && (
        <div className="text-center mb-8">
          <p className="text-[#888] text-xs mb-3">Click each image below to download individually</p>
        </div>
      )}

      {/* Gallery */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.images.map(img => (
            <div key={img.id} className="group relative bg-[#111] border border-[#222] rounded-lg overflow-hidden">
              <div className="aspect-square bg-[#1a1a1a]">
                <img
                  src={img.download_url}
                  alt={img.image_filename}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-3 flex items-center justify-between">
                <p className="text-[#999] text-xs truncate flex-1">{img.image_filename}</p>
                <a
                  href={img.download_url}
                  download={img.image_filename || `image_${img.sequence}.jpg`}
                  className="inline-flex items-center gap-1 text-xs text-[#c8a97e] hover:text-[#e0c99e] shrink-0 ml-2"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pb-8">
        <p className="text-[#555] text-xs">© {new Date().getFullYear()} FormaNova · AI-Powered Jewelry Photography</p>
      </div>
    </div>
  );
}
