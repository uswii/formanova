import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Layers, Camera } from "lucide-react";
import InteractiveRing from "@/components/cad/InteractiveRing";

import textToCadImg from "@/assets/cad-studio/text-to-cad-card.webp";
import cadToCatalogImg from "@/assets/cad-studio/cad-to-catalog-card.webp";

const cadFeatures = [
  {
    title: "Text to CAD",
    description: "Generate jewelry CAD concepts from text prompts.",
    route: "/text-to-cad",
    comingSoon: false,
    icon: Layers,
    image: textToCadImg,
  },
  {
    title: "CAD to Catalog",
    description: "Turn CAD files into catalog-ready product visuals.",
    route: "/cad-to-catalog",
    comingSoon: true,
    icon: Camera,
    image: cadToCatalogImg,
  },
];

export default function CADStudio() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-background flex flex-col items-center px-6 md:px-12 lg:px-16">
      {/* Header */}
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="font-display text-4xl md:text-5xl lg:text-6xl uppercase tracking-wide text-center pt-8 md:pt-12 text-foreground"
      >
        CAD <span className="hero-accent-text">Studio</span>
      </motion.h1>

      {/* 3D Ring */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.15 }}
        className="w-full max-w-md h-[220px] md:h-[280px] lg:h-[320px] -mt-2"
      >
        <InteractiveRing />
      </motion.div>

      {/* Feature Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 pb-12 -mt-2"
      >
        {cadFeatures.map((feature) => {
          const Icon = feature.icon;

          if (feature.comingSoon) {
            return (
              <div
                key={feature.title}
                className="group relative marta-frame overflow-hidden aspect-[4/3] md:aspect-[3/2] opacity-60 cursor-default"
              >
                {/* Background image */}
                <img
                  src={feature.image}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Coming Soon badge */}
                <div className="absolute top-4 right-4">
                  <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase bg-muted/80 backdrop-blur-sm px-3 py-1.5">
                    Coming Soon
                  </span>
                </div>

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
                  <Icon className="w-5 h-5 text-formanova-hero-accent mb-2" />
                  <h2 className="font-display text-xl md:text-2xl uppercase tracking-wide text-white">
                    {feature.title}
                  </h2>
                  <p className="font-mono text-[10px] tracking-[0.15em] text-white/60 uppercase mt-1 max-w-xs">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          }

          return (
            <motion.button
              key={feature.title}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => navigate(feature.route)}
              className="group relative marta-frame overflow-hidden aspect-[4/3] md:aspect-[3/2] cursor-pointer text-left transition-all duration-300 hover:border-formanova-hero-accent hover:shadow-[0_0_30px_-5px_hsl(var(--formanova-hero-accent)/0.4)]"
            >
              {/* Background image */}
              <img
                src={feature.image}
                alt={feature.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {/* Hover arrow */}
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                <div className="w-8 h-8 flex items-center justify-center bg-formanova-hero-accent shadow-lg shadow-formanova-hero-accent/30">
                  <ArrowRight className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
              </div>

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
                <Icon className="w-5 h-5 text-formanova-hero-accent mb-2" />
                <h2 className="font-display text-xl md:text-2xl uppercase tracking-wide text-white transition-transform duration-300 group-hover:translate-x-0.5">
                  {feature.title}
                </h2>
                <p className="font-mono text-[10px] tracking-[0.15em] text-white/60 uppercase mt-1 max-w-xs">
                  {feature.description}
                </p>
              </div>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
