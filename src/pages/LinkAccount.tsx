import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Link2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

type LinkStatus =
  | 'loading'
  | 'success'
  | 'invalid_token'
  | 'expired_token'
  | 'already_used'
  | 'wrong_account'
  | 'missing_token'
  | 'error';

interface LinkResult {
  platform?: string;
}

export default function LinkAccount() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, initializing, getAuthHeader } = useAuth();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<LinkStatus>(token ? 'loading' : 'missing_token');
  const [platform, setPlatform] = useState<string | null>(null);
  const hasAttempted = useRef(false);

  // Redirect to login if unauthenticated (preserve return URL)
  useEffect(() => {
    if (initializing) return;
    if (!user && token) {
      const returnPath = `/link?token=${encodeURIComponent(token)}`;
      navigate(`/login?redirect=${encodeURIComponent(returnPath)}`, { replace: true });
    }
  }, [user, initializing, token, navigate]);

  // Attempt linking once authenticated
  useEffect(() => {
    if (!user || !token || hasAttempted.current || initializing) return;
    hasAttempted.current = true;

    const linkAccount = async () => {
      setStatus('loading');
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        };

        const response = await fetch('/api/agent/link/complete', {
          method: 'POST',
          headers,
          body: JSON.stringify({ link_token: token }),
        });

        if (response.ok) {
          const data: LinkResult = await response.json();
          setPlatform(data.platform || null);
          setStatus('success');
          return;
        }

        // Map HTTP errors to user-friendly states
        const status_code = response.status;
        if (status_code === 400) {
          const body = await response.json().catch(() => ({}));
          const detail = (body.detail || '').toLowerCase();
          if (detail.includes('expired')) {
            setStatus('expired_token');
          } else if (detail.includes('already') || detail.includes('used')) {
            setStatus('already_used');
          } else {
            setStatus('invalid_token');
          }
        } else if (status_code === 403) {
          setStatus('wrong_account');
        } else if (status_code === 404 || status_code === 422) {
          setStatus('invalid_token');
        } else {
          setStatus('error');
        }
      } catch {
        setStatus('error');
      }
    };

    linkAccount();
  }, [user, token, initializing, getAuthHeader]);

  // While auth is initializing, show loader
  if (initializing) {
    return <Shell><StatusCard status="loading" /></Shell>;
  }

  return (
    <Shell>
      <AnimatePresence mode="wait">
        <StatusCard key={status} status={status} platform={platform} userEmail={user?.email} />
      </AnimatePresence>
    </Shell>
  );
}

/* ─── Layout Shell ─── */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

/* ─── Status Card ─── */
function StatusCard({
  status,
  platform,
  userEmail,
}: {
  status: LinkStatus;
  platform?: string | null;
  userEmail?: string;
}) {
  const configs: Record<
    LinkStatus,
    { icon: React.ReactNode; title: string; body: React.ReactNode }
  > = {
    loading: {
      icon: <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />,
      title: 'LINKING YOUR ACCOUNT',
      body: <p className="text-muted-foreground">Please wait while we connect your account…</p>,
    },
    success: {
      icon: <CheckCircle2 className="h-8 w-8 text-[hsl(var(--formanova-success))]" />,
      title: 'ACCOUNT LINKED',
      body: (
        <p className="text-muted-foreground">
          {platform ? platformReturnMessage(platform) : 'You can return to your chat with Nova now.'}
        </p>
      ),
    },
    missing_token: {
      icon: <AlertTriangle className="h-8 w-8 text-[hsl(var(--formanova-warning))]" />,
      title: 'MISSING LINK',
      body: (
        <p className="text-muted-foreground">
          This page requires a valid link from Nova.
          <br />
          <span className="mt-2 block">
            Ask Nova in your chat for a fresh link to connect your account.
          </span>
        </p>
      ),
    },
    invalid_token: {
      icon: <XCircle className="h-8 w-8 text-destructive" />,
      title: 'INVALID LINK',
      body: (
        <p className="text-muted-foreground">
          This link is invalid or malformed.
          <br />
          <span className="mt-2 block">
            Please ask Nova for a new link to try again.
          </span>
        </p>
      ),
    },
    expired_token: {
      icon: <AlertTriangle className="h-8 w-8 text-[hsl(var(--formanova-warning))]" />,
      title: 'LINK EXPIRED',
      body: (
        <p className="text-muted-foreground">
          This link has expired for security reasons.
          <br />
          <span className="mt-2 block">
            Ask Nova for a fresh link — it only takes a moment.
          </span>
        </p>
      ),
    },
    already_used: {
      icon: <Link2 className="h-8 w-8 text-muted-foreground" />,
      title: 'ALREADY LINKED',
      body: (
        <p className="text-muted-foreground">
          This link has already been used to connect an account.
          <br />
          <span className="mt-2 block">
            If you need to re-link, ask Nova for a new link.
          </span>
        </p>
      ),
    },
    wrong_account: {
      icon: <ShieldAlert className="h-8 w-8 text-destructive" />,
      title: 'WRONG ACCOUNT',
      body: (
        <div className="text-muted-foreground">
          <p>
            You're signed in as{' '}
            <span className="text-foreground font-medium">{userEmail}</span>, but this link belongs
            to a different account.
          </p>
          <p className="mt-3">Sign out and try again with the correct account.</p>
        </div>
      ),
    },
    error: {
      icon: <XCircle className="h-8 w-8 text-destructive" />,
      title: 'SOMETHING WENT WRONG',
      body: (
        <p className="text-muted-foreground">
          We couldn't complete the linking process.
          <br />
          <span className="mt-2 block">
            Please try again, or contact us at{' '}
            <a
              href="mailto:studio@formanova.ai"
              className="text-foreground underline underline-offset-4 hover:opacity-70 transition-opacity"
            >
              studio@formanova.ai
            </a>
          </span>
        </p>
      ),
    },
  };

  const config = configs[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="bg-card border border-border p-10 text-center space-y-6"
    >
      <div className="flex justify-center">{config.icon}</div>

      <h1 className="font-display text-lg tracking-[0.2em] uppercase text-foreground">
        {config.title}
      </h1>

      <div className="font-mono text-xs leading-relaxed max-w-sm mx-auto">
        {config.body}
      </div>

      {status !== 'loading' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {status === 'success' ? (
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-4">
              You may close this tab
            </p>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 uppercase tracking-[0.1em] text-[11px]"
              onClick={() => window.location.href = '/'}
            >
              Return Home
            </Button>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

/* ─── Helpers ─── */
function platformReturnMessage(platform: string): string {
  const map: Record<string, string> = {
    whatsapp: 'Your account is linked. You can return to WhatsApp now.',
    slack: 'Your account is linked. You can return to Slack now.',
    discord: 'Your account is linked. You can return to Discord now.',
    email: 'Your account is linked. You can return to your email now.',
  };
  return map[platform.toLowerCase()] || 'Your account is linked. You can return to your chat with Nova now.';
}
