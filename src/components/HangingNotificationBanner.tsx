import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const HangingNotificationBanner = () => {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <motion.div
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="w-full bg-muted/60 border-b border-border px-5 py-4 md:px-8 md:py-5 relative z-50"
    >
      <button
        onClick={() => setVisible(false)}
        className="absolute top-4 right-4 md:right-6 p-1 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Close notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="max-w-3xl mx-auto pr-8 space-y-1">
        <p className="font-display text-sm md:text-base uppercase tracking-wider text-foreground">
          We're currently updating our systems.
        </p>
        <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
          We've successfully received your photos. Delivery may take 24–72 hours.
        </p>
        <p className="text-[10px] md:text-xs text-muted-foreground/70 font-mono tracking-wide">
          Thank you for your patience — your results are on the way.
        </p>
      </div>
    </motion.div>
  );
};

export default HangingNotificationBanner;
