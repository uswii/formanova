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
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Full-page 3D Ring Background */}
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        <div className="w-full h-full max-w-[900px] max-h-[900px] mx-auto" style={{ aspectRatio: "1/1" }}>
          <InteractiveRing />
        </div>
      </div>

      {/* Content overlay */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-6 mt-20"
        >
          <p className="text-xs sm:text-sm tracking-[0.35em] uppercase text-muted-foreground/70 mb-4">
            CAD Studio
          </p>
          <div className="w-12 h-px bg-muted-foreground/30 mx-auto mb-8" />
        </motion.div>

        {/* Spacer to push cards below the ring */}
        <div className="flex-1 min-h-[280px] sm:min-h-[340px]" />

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl mb-20">
          {cadFeatures.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 + 0.15 * i }}
              whileHover={{ y: -4, scale: 1.01 }}
              className="group relative rounded-2xl overflow-hidden flex flex-col items-center text-center p-8"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--card) / 0.25), hsl(var(--card) / 0.1))",
                backdropFilter: "blur(24px) saturate(1.4)",
                WebkitBackdropFilter: "blur(24px) saturate(1.4)",
                border: "1px solid hsl(var(--border) / 0.2)",
                boxShadow:
                  "inset 0 1px 0 0 hsl(var(--foreground) / 0.04), 0 8px 32px hsl(var(--background) / 0.4)",
              }}
            >
              <div className="w-12 h-12 rounded-xl bg-muted/20 flex items-center justify-center mb-5 group-hover:bg-muted/30 transition-colors">
                <feature.icon className="w-6 h-6 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {feature.title}
              </h2>
              <p className="text-muted-foreground mb-6 leading-relaxed text-sm">
                {feature.description}
              </p>
              <Button
                className="w-full mt-auto"
                size="lg"
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
