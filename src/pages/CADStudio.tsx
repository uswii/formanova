import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Box, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import InteractiveRing from "@/components/cad/InteractiveRing";

const cadFeatures = [
  {
    title: "CAD → Catalog",
    description:
      "Turn your CAD files into realistic product visuals and catalog-ready images.",
    icon: Box,
    route: "/cad-to-catalog",
  },
  {
    title: "Text → CAD",
    description:
      "Generate detailed jewelry CAD concepts from text prompts.",
    icon: Sparkles,
    route: "/text-to-cad",
  },
];

export default function CADStudio() {
  const navigate = useNavigate();

  return (
    <div className="h-screen relative overflow-hidden bg-background flex flex-col">
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6">
        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="mb-2"
        >
          <span
            className="font-display text-[clamp(2.5rem,8vw,5.5rem)] leading-none tracking-wide"
            style={{
              background: "linear-gradient(180deg, hsl(var(--foreground) / 0.9), hsl(var(--muted-foreground) / 0.5))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            CAD Studio
          </span>
        </motion.h1>

        {/* 3D Ring - compact, below title */}
        <div className="relative w-[280px] h-[280px] mx-auto -mt-4 mb-4">
          <InteractiveRing />
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
          {cadFeatures.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 + 0.15 * i }}
              whileHover={{ y: -3, scale: 1.01 }}
              className="group relative rounded-xl overflow-hidden flex flex-col items-center text-center p-6 bg-card border border-border/50 hover:border-border transition-colors"
            >
              <div className="w-11 h-11 rounded-lg bg-muted/10 flex items-center justify-center mb-3 group-hover:bg-muted/20 transition-colors">
                <feature.icon className="w-5 h-5 text-muted-foreground/60" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">
                {feature.title}
              </h2>
              <p className="text-muted-foreground/60 mb-4 leading-relaxed text-sm">
                {feature.description}
              </p>
              <Button
                variant="secondary"
                className="w-full mt-auto"
                onClick={() => navigate(feature.route)}
              >
                Open Studio →
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
