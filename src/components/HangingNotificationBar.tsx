import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const HangingNotificationBar = () => {
  const [visible, setVisible] = useState(true);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 18, mass: 0.8 }}
          className="w-full bg-card/95 backdrop-blur-sm border-b border-border/50 relative z-50"
        >
          {/* Subtle sway wrapper */}
          <motion.div
            animate={{ y: [0, 1.5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4"
          >
            {/* Accent line */}
            <div className="hidden sm:block w-1 h-8 bg-formanova-hero-accent/60 rounded-full flex-shrink-0" />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="font-display text-xs sm:text-sm uppercase tracking-wider text-foreground leading-snug">
                We're currently updating our systems.
              </p>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 leading-relaxed">
                We've received your photos. Delivery may take 24–72 hours. Thank you for your patience — your results are on the way.
              </p>
            </div>

            {/* Close */}
            <button
              onClick={() => setVisible(false)}
              className="flex-shrink-0 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Close notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>

          {/* Bottom shadow for "hanging" depth */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default HangingNotificationBar;
