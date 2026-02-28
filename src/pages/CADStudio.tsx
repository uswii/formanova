import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
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
  },
  {
    title: "CAD to Catalog",
    description: "Turn CAD files into catalog-ready product visuals.",
    route: "/cad-to-catalog",
    comingSoon: true,
  },
];

export default function CADStudio() {
  const navigate = useNavigate();

  return (
    <div className="h-[calc(100vh-5rem)] bg-background flex flex-col px-6 md:px-12 lg:px-16 py-6">
      {/* Header — identical to /studio */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl w-full mx-auto mb-6 flex items-end justify-between"
      >
        <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase">
          CAD Studio
        </span>
        <span className="hidden md:block font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase">
          3D Design Tools
        </span>
      </motion.div>

      {/* Main content — split layout */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl w-full mx-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0"
      >
        {/* Left: 3D Ring */}
        <motion.div
          variants={itemVariants}
          className="relative marta-frame overflow-hidden min-h-[280px]"
        >
          <InteractiveRing />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/70 to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 p-5 md:p-6 pointer-events-none">
            <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase block mb-1">
              Interactive Preview
            </span>
            <h1 className="font-display text-3xl md:text-4xl lg:text-5xl uppercase tracking-wide text-foreground leading-none">
              CAD Studio
            </h1>
          </div>
        </motion.div>

        {/* Right: Feature cards stacked */}
        <div className="flex flex-col gap-4 min-h-0">
          {cadFeatures.map((feature) => {
            if (feature.comingSoon) {
              return (
                <motion.div
                  key={feature.title}
                  variants={itemVariants}
                  className="relative flex-1 marta-frame overflow-hidden opacity-40 pointer-events-none flex flex-col justify-end p-5 md:p-6"
                >
                  <div className="absolute top-4 right-4">
                    <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase bg-muted/80 backdrop-blur-sm px-3 py-1.5">
                      Coming Soon
                    </span>
                  </div>
                  <h2 className="font-display text-xl md:text-2xl uppercase tracking-wide text-foreground">
                    {feature.title}
                  </h2>
                  <p className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase mt-1.5 max-w-xs">
                    {feature.description}
                  </p>
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
                className="group relative flex-1 marta-frame overflow-hidden cursor-pointer transition-all duration-300 hover:border-formanova-hero-accent hover:shadow-[0_0_30px_-5px_hsl(var(--formanova-hero-accent)/0.4)] text-left flex flex-col justify-end p-5 md:p-6"
              >
                <h2 className="font-display text-xl md:text-2xl uppercase tracking-wide text-foreground transition-transform duration-300 group-hover:translate-x-0.5">
                  {feature.title}
                </h2>
                <p className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase mt-1.5 max-w-xs">
                  {feature.description}
                </p>

                {/* Hover arrow */}
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                  <div className="w-8 h-8 flex items-center justify-center bg-formanova-hero-accent shadow-lg shadow-formanova-hero-accent/30">
                    <ArrowRight className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
