import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Layers, Box } from "lucide-react";
import InteractiveRing from "@/components/cad/InteractiveRing";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

const cadFeatures = [
  {
    title: "Text to CAD",
    description: "Generate jewelry CAD concepts from text prompts.",
    route: "/text-to-cad",
    comingSoon: false,
    icon: Layers,
  },
  {
    title: "CAD to Catalog",
    description: "Turn CAD files into catalog-ready product visuals.",
    route: "/cad-to-catalog",
    comingSoon: true,
    icon: Box,
  },
];

export default function CADStudio() {
  const navigate = useNavigate();

  return (
    <div className="h-[calc(100vh-5rem)] bg-background flex flex-col px-6 md:px-12 lg:px-16 py-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl w-full mx-auto mb-4 flex items-end justify-between"
      >
        <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase">
          CAD Studio
        </span>
        <span className="hidden md:block font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase">
          3D Design Tools
        </span>
      </motion.div>

      {/* Main content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl w-full mx-auto flex-1 grid grid-cols-1 md:grid-cols-5 gap-4 min-h-0"
      >
        {/* Left: Ring preview + heading — no border frame */}
        <motion.div
          variants={itemVariants}
          className="relative md:col-span-3 flex flex-col min-h-0"
        >
          {/* Ring container — frameless, directly on page bg */}
          <div className="relative flex-1 min-h-[200px]">
            <InteractiveRing />
          </div>

          {/* Heading grouped tightly below ring */}
          <div className="pt-3 pb-1">
            <h1 className="font-display text-3xl md:text-4xl uppercase tracking-wide text-foreground leading-none">
              CAD Studio
            </h1>
            <p className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase mt-1.5">
              3D jewelry design &amp; visualization tools
            </p>
          </div>
        </motion.div>

        {/* Right: stacked action cards */}
        <div className="md:col-span-2 flex flex-col gap-3 min-h-0">
          {cadFeatures.map((feature) => {
            const Icon = feature.icon;

            if (feature.comingSoon) {
              return (
                <motion.div
                  key={feature.title}
                  variants={itemVariants}
                  className="relative flex-1 marta-frame overflow-hidden opacity-40 pointer-events-none flex flex-col justify-between p-5 md:p-6"
                >
                  {/* Structured accent — wireframe grid lines */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.04]">
                      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5" className="w-full h-full text-foreground">
                        <rect x="10" y="10" width="30" height="30" />
                        <rect x="25" y="25" width="30" height="30" />
                        <rect x="40" y="40" width="30" height="30" />
                        <line x1="25" y1="25" x2="40" y2="40" />
                        <line x1="55" y1="25" x2="70" y2="40" />
                        <line x1="25" y1="55" x2="40" y2="70" />
                      </svg>
                    </div>
                  </div>

                  <div className="flex items-start justify-between">
                    <div className="w-8 h-8 flex items-center justify-center border border-border/50">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase bg-muted/80 backdrop-blur-sm px-3 py-1.5">
                      Coming Soon
                    </span>
                  </div>

                  <div className="mt-auto pt-4">
                    <h2 className="font-display text-xl md:text-2xl uppercase tracking-wide text-foreground">
                      {feature.title}
                    </h2>
                    <p className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase mt-1.5 max-w-xs">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              );
            }

            return (
              <motion.button
                key={feature.title}
                variants={itemVariants}
                whileHover={{ scale: 1.01, y: -2 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => navigate(feature.route)}
                className="group relative flex-1 marta-frame overflow-hidden cursor-pointer transition-all duration-300 hover:border-formanova-hero-accent hover:shadow-[0_0_30px_-5px_hsl(var(--formanova-hero-accent)/0.4)] text-left flex flex-col justify-between p-5 md:p-6"
              >
                {/* Structured accent — isometric wireframe lines */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500">
                    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5" className="w-full h-full text-foreground">
                      <polygon points="50,10 90,30 90,70 50,90 10,70 10,30" />
                      <line x1="50" y1="10" x2="50" y2="90" />
                      <line x1="10" y1="30" x2="90" y2="30" />
                      <line x1="10" y1="70" x2="90" y2="70" />
                    </svg>
                  </div>
                </div>

                <div className="flex items-start justify-between">
                  <div className="w-8 h-8 flex items-center justify-center border border-border/50 group-hover:border-formanova-hero-accent/50 transition-colors duration-300">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors duration-300" />
                  </div>

                  {/* Hover arrow */}
                  <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                    <div className="w-8 h-8 flex items-center justify-center bg-formanova-hero-accent shadow-lg shadow-formanova-hero-accent/30">
                      <ArrowRight className="w-3.5 h-3.5 text-primary-foreground" />
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-4">
                  <h2 className="font-display text-xl md:text-2xl uppercase tracking-wide text-foreground transition-transform duration-300 group-hover:translate-x-0.5">
                    {feature.title}
                  </h2>
                  <p className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase mt-1.5 max-w-xs">
                    {feature.description}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
