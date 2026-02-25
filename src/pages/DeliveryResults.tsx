import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Loader2, Images } from 'lucide-react';
import { Button } from '@/components/ui/button';
import formanovaLogo from '@/assets/formanova-logo.png';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const DELIVERY_API = `${SUPABASE_URL}/functions/v1/delivery-manager`;

interface GalleryImage {
  id: string;
  image_filename: string;
  sequence: number;
  download_url: string;
  thumbnail_url: string;
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
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${DELIVERY_API}?action=gallery&token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else {
          // Build proxy URLs for display (avoids CORS with Azure)
          const images = (d.images || []).map((img: GalleryImage) => ({
            ...img,
            thumbnail_url: `${DELIVERY_API}?action=thumbnail&token=${token}&image_id=${img.id}`,
          }));
          setData({ ...d, images });
        }
      })
      .catch(() => setError('Failed to load results'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleDownload = async (image: GalleryImage) => {
    setDownloading(image.id);
    try {
      const resp = await fetch(`${DELIVERY_API}?action=download&token=${token}&image_id=${image.id}`);
      if (!resp.ok) throw new Error('Download failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = image.image_filename || `image_${image.sequence}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Download failed. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-6 w-6 animate-spin text-formanova-hero-accent mx-auto" />
          <p className="marta-label text-muted-foreground">Loading your results</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center space-y-6">
          <img src={formanovaLogo} alt="FormaNova" className="h-8 mx-auto opacity-80" />
          <div className="w-12 h-px bg-gradient-to-r from-transparent via-formanova-hero-accent to-transparent mx-auto" />
          <p className="text-muted-foreground text-sm">{error || 'Results not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      {/* Hero header */}
      <div className="text-center px-6 mb-12">
        <div className="w-12 h-px bg-gradient-to-r from-transparent via-formanova-hero-accent to-transparent mx-auto mb-8" />
        
        <h1 className="text-4xl md:text-5xl tracking-[0.2em] text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>
          YOUR RESULTS
        </h1>
        
        <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
          Your photos are ready to download
        </p>
        
        <div className="inline-flex items-center gap-2 marta-frame px-4 py-2">
          <Images className="w-3.5 h-3.5 text-formanova-hero-accent" />
          <span className="marta-label text-muted-foreground">
            {data.images.length} PHOTO{data.images.length !== 1 ? 'S' : ''}
          </span>
        </div>
      </div>

      {/* Gallery grid */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.images.map(img => (
            <div key={img.id} className="group relative marta-frame overflow-hidden bg-card">
              {/* Image */}
              <div className="aspect-square bg-muted">
                <img
                  src={img.thumbnail_url}
                  alt={img.image_filename}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  loading="lazy"
                />
              </div>
              
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <Button
                  onClick={() => handleDownload(img)}
                  disabled={downloading === img.id}
                  variant="outline"
                  className="marta-frame border-foreground/30 bg-background/80 backdrop-blur-sm text-foreground hover:bg-foreground hover:text-background gap-2 text-xs uppercase tracking-[2px] px-6 py-3"
                >
                  {downloading === img.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  Download
                </Button>
              </div>
              
              {/* Bottom bar */}
              <div className="px-3 py-2.5 flex items-center justify-between border-t border-border/50">
                <span className="marta-label text-muted-foreground truncate">
                  {img.image_filename}
                </span>
                <button
                  onClick={() => handleDownload(img)}
                  disabled={downloading === img.id}
                  className="text-formanova-hero-accent hover:text-foreground transition-colors p-1"
                >
                  {downloading === img.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center mt-16 px-6 space-y-4">
        <div className="w-12 h-px bg-gradient-to-r from-transparent via-border to-transparent mx-auto" />
        <p className="text-muted-foreground/50 text-[10px] tracking-[3px] uppercase">
          © {new Date().getFullYear()} Forma Nova · AI-Powered Jewelry Photography
        </p>
      </div>
    </div>
  );
}
