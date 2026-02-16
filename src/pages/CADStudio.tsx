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
    <div className="min-h-screen pt-28 pb-20 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
            CAD Studio
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Generate production-ready jewelry assets from CAD or text.
          </p>
        </motion.div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cadFeatures.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 * i }}
              whileHover={{ y: -4, scale: 1.01 }}
              className="group relative rounded-2xl overflow-hidden flex flex-col items-center text-center shadow-lg hover:shadow-2xl transition-all duration-300"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--card) / 0.35), hsl(var(--card) / 0.15))",
                backdropFilter: "blur(20px) saturate(1.4)",
                WebkitBackdropFilter: "blur(20px) saturate(1.4)",
                border: "1px solid hsl(var(--border) / 0.25)",
                boxShadow:
                  "inset 0 1px 0 0 hsl(var(--foreground) / 0.06), 0 8px 32px hsl(var(--background) / 0.3)",
              }}
            >
              {/* 3D Ring Viewport */}
              <div className="w-full">
                <InteractiveRing />
              </div>

              {/* Content */}
              <div className="px-8 pb-8 pt-2 flex flex-col items-center flex-1 w-full">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground mb-2">
                  {feature.title}
                </h2>
                <p className="text-muted-foreground mb-8 leading-relaxed text-sm">
                  {feature.description}
                </p>
                <Button
                  className="w-full mt-auto"
                  size="lg"
                  onClick={() => navigate(feature.route)}
                >
                  Open Studio →
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
