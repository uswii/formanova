import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Box, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    title: "CAD → Catalog",
    description: "Turn your CAD files into realistic product visuals and catalog-ready images.",
    icon: Box,
    route: "/cad-to-catalog",
  },
  {
    title: "Text → CAD",
    description: "Generate detailed jewelry CAD concepts from text prompts.",
    icon: Sparkles,
    route: "/text-to-cad",
  },
];

const CADStudio = () => {
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
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 * i }}
              whileHover={{ y: -4, scale: 1.01 }}
              className="group relative rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-8 sm:p-10 flex flex-col items-center text-center shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-300"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground mb-3">
                {feature.title}
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
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
};

export default CADStudio;
