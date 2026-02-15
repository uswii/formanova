import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';

const CADStudio = () => {
  return (
    <div className="min-h-[calc(100vh-5rem)] bg-background flex flex-col items-center justify-center px-6 md:px-12 lg:px-16 py-10">
      {/* Access Notice */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full text-center mb-10"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <p className="font-mono text-xs sm:text-sm tracking-wide text-muted-foreground leading-relaxed max-w-lg">
            This functionality is only available for select jewelry brands. To request access please contact Sophia at{' '}
            <a
              href="mailto:sophia@raresense.so?subject=Request%20for%20CAD%20Access&body=Hi%20Sophia,%0A%0AI%E2%80%99d%20like%20to%20request%20access%20to%20the%20CAD%20functionality%20for%20my%20jewelry%20brand.%0A%0AThank%20you."
              className="text-primary hover:underline font-medium"
            >
              sophia@raresense.so
            </a>
          </p>
        </div>
      </motion.div>

      {/* Video */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="max-w-4xl w-full"
      >
        <div className="aspect-video w-full rounded-lg overflow-hidden border border-border/40">
          <iframe
            src="https://www.youtube.com/embed/OYvhYxGzQAY"
            title="CAD to Photo Rendering"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      </motion.div>
    </div>
  );
};

export default CADStudio;
