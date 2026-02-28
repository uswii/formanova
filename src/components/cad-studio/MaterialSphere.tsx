/**
 * MaterialSphere — CSS-only PBR-style material preview sphere.
 * Metals: metallic reflections, studio lighting highlights, surface sheen.
 * Gems: depth, refraction caustics, faceted highlights, inner glow.
 */

interface MaterialSphereProps {
  category: "metal" | "gemstone";
  preview: string; // the linear-gradient or color from MaterialDef
  size?: number;   // px, default 40
  className?: string;
}

export default function MaterialSphere({ category, preview, size = 40, className = "" }: MaterialSphereProps) {
  const s = `${size}px`;

  if (category === "metal") {
    return (
      <div
        className={`relative rounded-full flex-shrink-0 ${className}`}
        style={{
          width: s,
          height: s,
          background: preview,
          boxShadow: `
            inset -${size * 0.15}px -${size * 0.1}px ${size * 0.25}px rgba(0,0,0,0.45),
            inset ${size * 0.08}px ${size * 0.08}px ${size * 0.2}px rgba(255,255,255,0.35),
            0 ${size * 0.05}px ${size * 0.15}px rgba(0,0,0,0.3)
          `,
        }}
      >
        {/* Primary specular highlight */}
        <div
          className="absolute rounded-full"
          style={{
            width: `${size * 0.45}px`,
            height: `${size * 0.25}px`,
            top: `${size * 0.12}px`,
            left: `${size * 0.18}px`,
            background: `radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.3) 40%, transparent 70%)`,
            filter: `blur(${size * 0.03}px)`,
          }}
        />
        {/* Secondary rim reflection */}
        <div
          className="absolute rounded-full"
          style={{
            width: `${size * 0.3}px`,
            height: `${size * 0.15}px`,
            bottom: `${size * 0.18}px`,
            right: `${size * 0.1}px`,
            background: `radial-gradient(ellipse, rgba(255,255,255,0.25) 0%, transparent 70%)`,
            filter: `blur(${size * 0.04}px)`,
          }}
        />
        {/* Brushed texture overlay */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `repeating-linear-gradient(
              135deg,
              transparent,
              transparent ${size * 0.02}px,
              rgba(255,255,255,0.04) ${size * 0.02}px,
              rgba(255,255,255,0.04) ${size * 0.04}px
            )`,
            mixBlendMode: "overlay",
          }}
        />
      </div>
    );
  }

  // Gemstone
  return (
    <div
      className={`relative rounded-full flex-shrink-0 ${className}`}
      style={{
        width: s,
        height: s,
        background: preview,
        boxShadow: `
          inset -${size * 0.12}px -${size * 0.08}px ${size * 0.2}px rgba(0,0,0,0.5),
          inset ${size * 0.06}px ${size * 0.06}px ${size * 0.15}px rgba(255,255,255,0.2),
          0 ${size * 0.05}px ${size * 0.18}px rgba(0,0,0,0.35),
          0 0 ${size * 0.3}px rgba(255,255,255,0.08)
        `,
      }}
    >
      {/* Inner glow / depth */}
      <div
        className="absolute inset-[15%] rounded-full"
        style={{
          background: `radial-gradient(circle at 40% 35%, rgba(255,255,255,0.25) 0%, transparent 60%)`,
          filter: `blur(${size * 0.05}px)`,
        }}
      />
      {/* Primary facet highlight — sharp, angled */}
      <div
        className="absolute"
        style={{
          width: `${size * 0.3}px`,
          height: `${size * 0.15}px`,
          top: `${size * 0.15}px`,
          left: `${size * 0.2}px`,
          background: `linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.4) 50%, transparent 100%)`,
          clipPath: "polygon(10% 0%, 90% 0%, 70% 100%, 30% 100%)",
          filter: `blur(${size * 0.015}px)`,
        }}
      />
      {/* Secondary facet */}
      <div
        className="absolute"
        style={{
          width: `${size * 0.2}px`,
          height: `${size * 0.12}px`,
          top: `${size * 0.3}px`,
          left: `${size * 0.5}px`,
          background: `linear-gradient(160deg, rgba(255,255,255,0.6) 0%, transparent 80%)`,
          clipPath: "polygon(0% 0%, 100% 20%, 80% 100%, 10% 80%)",
          filter: `blur(${size * 0.01}px)`,
        }}
      />
      {/* Tiny sparkle dot */}
      <div
        className="absolute rounded-full"
        style={{
          width: `${size * 0.08}px`,
          height: `${size * 0.08}px`,
          top: `${size * 0.18}px`,
          left: `${size * 0.28}px`,
          background: "white",
          filter: `blur(${size * 0.01}px)`,
          opacity: 0.9,
        }}
      />
      {/* Caustic rainbow refraction hint */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(
            from 200deg at 35% 40%,
            transparent 0deg,
            rgba(255,100,100,0.12) 30deg,
            rgba(255,255,100,0.1) 60deg,
            rgba(100,255,100,0.1) 90deg,
            rgba(100,200,255,0.12) 120deg,
            transparent 150deg
          )`,
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
}
