import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ImageIcon } from 'lucide-react';

export default function Generations() {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <h1 className="text-3xl font-display mb-8">My Generations</h1>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-4">Generation history coming soon</p>
            <Button asChild>
              <Link to="/studio">Go to Studio</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
