import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Box, Sparkles } from 'lucide-react';

const features = [
  {
    title: 'CAD → Catalog',
    description: 'Turn your CAD files into realistic product visuals and catalog-ready images.',
    icon: Box,
    route: '/cad-to-catalog',
  },
  {
    title: 'Text → CAD',
    description: 'Generate detailed jewelry CAD concepts from text prompts.',
    icon: Sparkles,
    route: '/text-to-cad',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const CADStudio = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-background py-10 px-6 md:px-12 lg:px-16">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto text-center mb-12"
      >
        <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase block mb-3">
          CAD Studio
        </span>
        <h1 className="font-display text-3xl md:text-4xl lg:text-5xl tracking-tight mb-4">
          CAD Studio
        </h1>
        <p className="text-muted-foreground text-sm md:text-base max-w-lg mx-auto">
          Generate production-ready jewelry assets from CAD or text.
        </p>
      </motion.div>

      {/* Feature Cards Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {features.map((feature) => (
          <motion.div
            key={feature.title}
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(feature.route)}
            className="group relative cursor-pointer marta-frame overflow-hidden border border-border/50 bg-card/30 backdrop-blur-sm rounded-sm transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_30px_-5px_hsl(var(--primary)/0.3)]"
          >
            <div className="p-8 md:p-10 flex flex-col h-full">
              {/* Icon */}
              <div className="mb-8">
                <div className="w-14 h-14 rounded-sm bg-primary/10 flex items-center justify-center transition-colors duration-300 group-hover:bg-primary/20">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
              </div>

              {/* Content */}
              <h2 className="font-display text-2xl md:text-3xl mb-3 tracking-tight">
                {feature.title}
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-8 flex-1">
                {feature.description}
              </p>

              {/* CTA */}
              <button className="w-full flex items-center justify-center gap-2 h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium transition-all duration-300 hover:bg-primary/90 group-hover:shadow-lg group-hover:shadow-primary/20">
                Open Studio
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};

export default CADStudio;
