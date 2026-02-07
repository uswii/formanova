import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Pencil, X, Mail, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getStoredToken } from '@/lib/auth-api';
import { toast } from '@/hooks/use-toast';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface BatchSubmittedConfirmationProps {
  categoryName: string;
  imageCount: number;
  batchId?: string;
  onStartAnother: () => void;
}

const BatchSubmittedConfirmation = ({
  categoryName,
  imageCount,
  batchId,
}: BatchSubmittedConfirmationProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [notificationEmail, setNotificationEmail] = useState(user?.email || '');
  const [isSaving, setIsSaving] = useState(false);
  const [emailError, setEmailError] = useState('');

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const handleSaveEmail = async () => {
    if (!batchId) return;

    const trimmed = notificationEmail.trim();
    if (!trimmed) {
      setEmailError('Email is required');
      return;
    }
    if (!isValidEmail(trimmed)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setEmailError('');
    setIsSaving(true);
    try {
      const userToken = getStoredToken();
      const response = await fetch(`${SUPABASE_URL}/functions/v1/batch-submit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
          ...(userToken ? { 'X-User-Token': userToken } : {}),
        },
        body: JSON.stringify({
          batch_id: batchId,
          notification_email: trimmed,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to update email');
      }
      
      setNotificationEmail(trimmed);
      toast({
        title: 'Email updated',
        description: `Results will be sent to ${trimmed}`,
      });
      setIsEditingEmail(false);
    } catch (err: any) {
      console.error('Failed to update email:', err);
      toast({
        title: err.message || 'Failed to update email',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-8 relative">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-lg w-full"
      >
        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6 rounded-full bg-green-500/10 flex items-center justify-center"
        >
          <Check className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
        </motion.div>

        {/* Main Message */}
        <h2 className="font-display text-xl sm:text-2xl md:text-3xl uppercase tracking-wide mb-2 sm:mb-3">
          Generation Started
        </h2>
        
        <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 px-2">
          Your <span className="text-foreground">{imageCount} {categoryName.toLowerCase()}</span> {imageCount === 1 ? 'photo is' : 'photos are'} being 
          generated and verified for accuracy.
        </p>

        {/* Email notification section */}
        <div className="bg-muted/30 rounded-lg p-4 mb-6">
          {isEditingEmail ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <input
                  type="email"
                  value={notificationEmail}
                  onChange={(e) => { setNotificationEmail(e.target.value); setEmailError(''); }}
                  className={`flex-1 bg-background border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 ${
                    emailError ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-formanova-hero-accent'
                  }`}
                  placeholder="Enter email"
                  autoFocus
                />
                <button
                  onClick={handleSaveEmail}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs bg-formanova-hero-accent text-primary-foreground rounded hover:bg-formanova-hero-accent/90 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                  Save
                </button>
                <button
                  onClick={() => {
                    setNotificationEmail(user?.email || '');
                    setIsEditingEmail(false);
                    setEmailError('');
                  }}
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {emailError && (
                <p className="text-xs text-destructive ml-6">{emailError}</p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Results will be sent to{' '}
                <span className="text-foreground font-medium">{notificationEmail}</span>
              </span>
              <button
                onClick={() => setIsEditingEmail(true)}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                title="Edit email"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Timeline message */}
        <p className="text-sm text-muted-foreground">
          We'll get back to you within <span className="text-foreground font-medium">24 hours</span>
        </p>
      </motion.div>

      {/* Footer info - mobile: relative, desktop: absolute */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-8 sm:mt-0 sm:absolute sm:bottom-6 sm:left-6 text-xs text-muted-foreground/60 text-center sm:text-left"
      >
        <button
          onClick={() => navigate('/batches')}
          className="hover:text-muted-foreground transition-colors"
        >
          View batch status →
        </button>
        {batchId && (
          <span className="block sm:inline sm:ml-3 font-mono mt-1 sm:mt-0 text-[10px]">{batchId}</span>
        )}
      </motion.div>
    </div>
  );
};

export default BatchSubmittedConfirmation;
