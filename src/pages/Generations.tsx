import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { ArrowLeft, ImageIcon, Calendar, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

interface DeliveryThumbnail {
  id: string;
  filename: string;
  url: string;
}

interface DeliveryBatch {
  id: string;
  batch_id: string;
  category: string | null;
  token: string | null;
  created_at: string;
  delivery_status: string;
  image_count: number;
  thumbnails: DeliveryThumbnail[];
}

export default function Generations() {
  const { user, getAuthHeader } = useAuth();
  const [deliveries, setDeliveries] = useState<DeliveryBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchDeliveries = async () => {
      try {
        const headers = getAuthHeader();
        const token = headers['Authorization']?.replace('Bearer ', '') || '';
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/delivery-manager?action=my_deliveries`,
          { headers: { 'X-User-Token': token } }
        );
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        setDeliveries(data.deliveries || []);
      } catch (err) {
        console.error('[Generations] fetch error:', err);
        setError('Could not load your generations. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDeliveries();
  }, [user]);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <h1 className="text-3xl font-display mb-8">My Generations</h1>

        {loading && (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="border-border/50 bg-card/50">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <Skeleton className="aspect-square rounded-md" />
                    <Skeleton className="aspect-square rounded-md" />
                    <Skeleton className="aspect-square rounded-md" />
                  </div>
                  <Skeleton className="h-9 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {error && (
          <Card className="border-destructive/50 bg-card/50">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-destructive text-center mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </CardContent>
          </Card>
        )}

        {!loading && !error && deliveries.length === 0 && (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center mb-2">No generations yet</p>
              <p className="text-sm text-muted-foreground/70 text-center mb-6">
                Submit your jewelry photos in the studio and your results will appear here.
              </p>
              <Button asChild>
                <Link to="/studio">Go to Studio</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !error && deliveries.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            {deliveries.map((batch) => (
              <Card key={batch.id} className="border-border/50 bg-card/50 overflow-hidden hover:border-primary/30 transition-colors">
                <CardContent className="p-5">
                  {/* Header: date + category */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(batch.created_at), 'MMM d, yyyy')}
                    </div>
                    <div className="flex items-center gap-2">
                      {batch.category && (
                        <Badge variant="secondary" className="capitalize text-xs">
                          {batch.category}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {batch.image_count} {batch.image_count === 1 ? 'image' : 'images'}
                      </span>
                    </div>
                  </div>

                  {/* Thumbnail grid */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {batch.thumbnails.map((thumb) => (
                      <div key={thumb.id} className="aspect-square rounded-md overflow-hidden bg-muted">
                        <OptimizedImage
                          src={thumb.url}
                          alt={thumb.filename}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                    {/* Fill empty slots if < 3 thumbnails */}
                    {Array.from({ length: Math.max(0, 3 - batch.thumbnails.length) }).map((_, i) => (
                      <div key={`empty-${i}`} className="aspect-square rounded-md bg-muted/50" />
                    ))}
                  </div>

                  {/* View Results button */}
                  {batch.token && (
                    <Button asChild variant="outline" className="w-full gap-2">
                      <Link to={`/results/${batch.token}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                        View Results
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
