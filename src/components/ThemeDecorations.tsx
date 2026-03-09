import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export function ThemeDecorations() {
  const { theme } = useTheme();

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {theme === 'neon' && <NeonDecorations />}
      {theme === 'synthwave' && <SynthwaveDecorations />}
      {theme === 'cyberpunk' && <CyberpunkDecorations />}
      {theme === 'kawaii' && <KawaiiDecorations />}
      {theme === 'cutie' && <CutieDecorations />}
      {theme === 'retro' && <RetroDecorations />}
      {theme === 'nostalgia' && <NostalgiaDecorations />}
      {theme === 'luxury' && <LuxuryDecorations />}
      {theme === 'fashion' && <FashionDecorations />}
      {theme === 'vintage' && <VintageDecorations />}
    </div>
  );
}

function NeonDecorations() {
  return (
    <>
      {/* Animated glowing lines */}
      <div className="absolute top-24 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" />
      <div className="absolute top-48 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-60 animate-pulse" style={{ animationDelay: '0.5s' }} />
      <div className="absolute bottom-24 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80 animate-pulse" style={{ animationDelay: '1s' }} />
      
      {/* Large corner glow orbs */}
      <div className="absolute -top-20 -right-20 w-[400px] h-[400px] bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute -bottom-20 -left-20 w-[350px] h-[350px] bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 -right-10 w-[200px] h-[200px] bg-blue-500/15 rounded-full blur-2xl animate-float" />
      
      {/* Electric sparks scattered */}
      {[...Array(6)].map((_, i) => (
        <svg 
          key={i}
          className="absolute text-cyan-400 animate-pulse"
          style={{
            top: `${15 + i * 15}%`,
            left: i % 2 === 0 ? `${5 + i * 5}%` : 'auto',
            right: i % 2 === 1 ? `${5 + i * 5}%` : 'auto',
            width: `${20 + (i % 3) * 8}px`,
            height: `${20 + (i % 3) * 8}px`,
            animationDelay: `${i * 0.3}s`,
            filter: 'drop-shadow(0 0 8px currentColor)'
          }}
          viewBox="0 0 24 24" 
          fill="currentColor"
        >
          <path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z" />
        </svg>
      ))}
      
      {/* Vertical glow bars */}
      <div className="absolute top-0 left-[15%] w-[3px] h-full bg-gradient-to-b from-cyan-400/40 via-transparent to-cyan-400/40 animate-pulse" />
      <div className="absolute top-0 right-[20%] w-[2px] h-full bg-gradient-to-b from-purple-500/30 via-transparent to-purple-500/30 animate-pulse" style={{ animationDelay: '0.7s' }} />
    </>
  );
}

function SynthwaveDecorations() {
  return (
    <>
      {/* Sunset gradient - more prominent */}
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-pink-500/30 via-orange-500/15 to-transparent" />
      
      {/* Large retro sun */}
      <div className="absolute bottom-32 left-1/2 -translate-x-1/2 w-[300px] h-[150px] bg-gradient-to-t from-orange-500/40 via-pink-500/30 to-purple-500/20 rounded-t-full blur-sm" />
      <div className="absolute bottom-32 left-1/2 -translate-x-1/2 w-[280px] h-[140px] overflow-hidden">
        {/* Sun lines */}
        {[...Array(8)].map((_, i) => (
          <div key={i} className="absolute left-0 right-0 h-[4px] bg-purple-900/60" style={{ bottom: `${i * 20}px` }} />
        ))}
      </div>
      
      {/* Perspective grid - more visible */}
      <div className="absolute bottom-0 left-0 right-0 h-72 opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(320 100% 62%) 2px, transparent 2px),
            linear-gradient(to bottom, hsl(320 100% 62%) 2px, transparent 2px)
          `,
          backgroundSize: '60px 30px',
          transform: 'perspective(400px) rotateX(65deg)',
          transformOrigin: 'bottom'
        }}
      />
      
      {/* Floating stars */}
      {[...Array(5)].map((_, i) => (
        <div 
          key={i}
          className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
          style={{
            top: `${10 + i * 12}%`,
            left: `${10 + i * 20}%`,
            animationDelay: `${i * 0.5}s`,
            boxShadow: '0 0 10px white'
          }}
        />
      ))}
      
      {/* Side glow */}
      <div className="absolute top-0 bottom-0 left-0 w-32 bg-gradient-to-r from-purple-500/20 to-transparent" />
      <div className="absolute top-0 bottom-0 right-0 w-32 bg-gradient-to-l from-pink-500/20 to-transparent" />
    </>
  );
}

function CyberpunkDecorations() {
  return (
    <>
      {/* Glitch corners - larger */}
      <div className="absolute top-4 left-4 w-32 h-32 border-l-4 border-t-4 border-pink-500/60 animate-pulse" />
      <div className="absolute top-4 right-4 w-32 h-32 border-r-4 border-t-4 border-cyan-400/60 animate-pulse" style={{ animationDelay: '0.3s' }} />
      <div className="absolute bottom-4 left-4 w-32 h-32 border-l-4 border-b-4 border-cyan-400/60 animate-pulse" style={{ animationDelay: '0.6s' }} />
      <div className="absolute bottom-4 right-4 w-32 h-32 border-r-4 border-b-4 border-pink-500/60 animate-pulse" style={{ animationDelay: '0.9s' }} />
      
      {/* Circuit lines - animated */}
      <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M0,15 L25,15 L30,20 L70,20 L75,15 L100,15" stroke="#00FFFF" strokeWidth="0.5" fill="none" className="animate-pulse" />
        <path d="M0,85 L15,85 L20,80 L50,80 L55,85 L100,85" stroke="#FF00FF" strokeWidth="0.5" fill="none" className="animate-pulse" style={{ animationDelay: '0.5s' }} />
        <circle cx="30" cy="20" r="2" fill="#00FFFF" className="animate-pulse" />
        <circle cx="75" cy="15" r="2" fill="#00FFFF" className="animate-pulse" />
        <circle cx="20" cy="80" r="2" fill="#FF00FF" className="animate-pulse" />
        <circle cx="55" cy="85" r="2" fill="#FF00FF" className="animate-pulse" />
      </svg>
      
      {/* Large neon glow blobs */}
      <div className="absolute top-[20%] right-0 w-[300px] h-[300px] bg-pink-500/25 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[20%] left-0 w-[300px] h-[300px] bg-cyan-400/25 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
      
      {/* Glitch text effect bars */}
      <div className="absolute top-[30%] left-0 right-0 h-1 bg-pink-500/40 animate-pulse" style={{ clipPath: 'inset(0 70% 0 0)' }} />
      <div className="absolute top-[70%] left-0 right-0 h-1 bg-cyan-400/40 animate-pulse" style={{ clipPath: 'inset(0 0 0 60%)' }} />
    </>
  );
}

function KawaiiDecorations() {
  return (
    <>
      {/* Large sparkles with glow */}
      {[...Array(12)].map((_, i) => (
        <svg
          key={i}
          className="absolute text-pink-400/70 animate-float"
          style={{
            top: `${5 + (i * 8)}%`,
            left: i % 2 === 0 ? `${3 + (i % 5) * 20}%` : 'auto',
            right: i % 2 === 1 ? `${3 + (i % 5) * 20}%` : 'auto',
            width: `${20 + (i % 4) * 10}px`,
            height: `${20 + (i % 4) * 10}px`,
            animationDelay: `${i * 0.2}s`,
            animationDuration: `${2 + (i % 3)}s`,
            filter: 'drop-shadow(0 0 6px currentColor)'
          }}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
        </svg>
      ))}
      
      {/* Floating hearts */}
      {[...Array(6)].map((_, i) => (
        <svg 
          key={`heart-${i}`}
          className="absolute text-pink-400/60 animate-float"
          style={{
            top: `${15 + i * 14}%`,
            left: i % 2 === 0 ? `${80 + (i % 3) * 5}%` : `${5 + (i % 3) * 5}%`,
            width: `${24 + (i % 3) * 8}px`,
            animationDelay: `${i * 0.4}s`,
            animationDuration: `${3 + i % 2}s`,
            filter: 'drop-shadow(0 0 4px currentColor)'
          }}
          viewBox="0 0 24 24" 
          fill="currentColor"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      ))}
      
      {/* Soft gradient blobs - bigger */}
      <div className="absolute -top-20 -right-20 w-[400px] h-[400px] bg-pink-300/25 rounded-full blur-3xl animate-pulse" />
      <div className="absolute -bottom-20 -left-20 w-[350px] h-[350px] bg-green-200/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-yellow-200/10 rounded-full blur-3xl" />
      
      {/* Rainbow stripe */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-pink-400 via-yellow-300 to-green-300 opacity-40" />
    </>
  );
}

function CutieDecorations() {
  return (
    <>
      {/* Floating bubbles - larger and animated */}
      {[...Array(10)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-gradient-to-br from-purple-300/30 to-pink-300/30 animate-float border border-white/20"
          style={{
            width: `${40 + i * 20}px`,
            height: `${40 + i * 20}px`,
            top: `${10 + (i % 5) * 18}%`,
            left: `${5 + (i % 4) * 25}%`,
            animationDelay: `${i * 0.3}s`,
            animationDuration: `${3 + (i % 3)}s`
          }}
        />
      ))}
      
      {/* Stars with glow */}
      {[...Array(8)].map((_, i) => (
        <svg
          key={i}
          className="absolute text-purple-400/60 animate-pulse"
          style={{
            top: `${10 + i * 11}%`,
            right: `${5 + (i % 4) * 10}%`,
            width: `${16 + (i % 3) * 10}px`,
            animationDelay: `${i * 0.2}s`,
            filter: 'drop-shadow(0 0 5px currentColor)'
          }}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
      
      {/* Dreamy gradient overlays */}
      <div className="absolute -top-32 left-1/4 w-[500px] h-[500px] bg-purple-400/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute -bottom-32 right-1/4 w-[400px] h-[400px] bg-pink-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
      
      {/* Cloud shapes */}
      <div className="absolute top-20 left-10 w-32 h-12 bg-white/10 rounded-full blur-md animate-float" />
      <div className="absolute top-16 left-20 w-24 h-10 bg-white/10 rounded-full blur-md animate-float" style={{ animationDelay: '0.5s' }} />
      <div className="absolute bottom-32 right-16 w-28 h-10 bg-white/10 rounded-full blur-md animate-float" style={{ animationDelay: '1s' }} />
    </>
  );
}

function RetroDecorations() {
  return (
    <>
      {/* Large pixel corner borders */}
      <div className="absolute top-4 left-4 w-40 h-40">
        <div className="absolute top-0 left-0 w-full h-4 bg-green-500/60" />
        <div className="absolute top-0 left-0 w-4 h-full bg-green-500/60" />
      </div>
      <div className="absolute top-4 right-4 w-40 h-40">
        <div className="absolute top-0 right-0 w-full h-4 bg-green-500/60" />
        <div className="absolute top-0 right-0 w-4 h-full bg-green-500/60" />
      </div>
      <div className="absolute bottom-4 left-4 w-40 h-40">
        <div className="absolute bottom-0 left-0 w-full h-4 bg-green-500/60" />
        <div className="absolute bottom-0 left-0 w-4 h-full bg-green-500/60" />
      </div>
      <div className="absolute bottom-4 right-4 w-40 h-40">
        <div className="absolute bottom-0 right-0 w-full h-4 bg-green-500/60" />
        <div className="absolute bottom-0 right-0 w-4 h-full bg-green-500/60" />
      </div>
      
      {/* Scanlines overlay */}
      <div className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,0,0.15) 2px, rgba(0,255,0,0.15) 4px)'
        }}
      />
      
      {/* Pixel art elements scattered */}
      {[...Array(8)].map((_, i) => (
        <div 
          key={i}
          className={`absolute w-4 h-4 animate-pulse ${i % 3 === 0 ? 'bg-green-400/80' : i % 3 === 1 ? 'bg-yellow-400/80' : 'bg-red-400/80'}`}
          style={{
            top: `${20 + i * 10}%`,
            left: i % 2 === 0 ? `${15 + i * 5}%` : 'auto',
            right: i % 2 === 1 ? `${15 + i * 5}%` : 'auto',
            animationDelay: `${i * 0.2}s`,
            boxShadow: '0 0 10px currentColor'
          }}
        />
      ))}
      
      {/* CRT glow effect */}
      <div className="absolute inset-0 bg-gradient-radial from-green-500/5 to-transparent" style={{ background: 'radial-gradient(ellipse at center, rgba(0,255,0,0.08) 0%, transparent 70%)' }} />
    </>
  );
}

function NostalgiaDecorations() {
  return (
    <>
      {/* Film grain overlay - more visible */}
      <div className="absolute inset-0 opacity-[0.08] animate-pulse"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
        }}
      />
      
      {/* Strong sepia vignette */}
      <div className="absolute inset-0" 
        style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(120, 80, 40, 0.3) 100%)' }}
      />
      
      {/* Warm light leaks */}
      <div className="absolute -top-20 -right-20 w-[500px] h-[500px] bg-amber-500/25 rounded-full blur-3xl animate-pulse" />
      <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] bg-orange-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/3 left-0 w-32 h-96 bg-gradient-to-r from-amber-400/20 to-transparent blur-xl" />
      
      {/* Film sprocket holes effect on sides */}
      <div className="absolute top-0 bottom-0 left-2 w-6 flex flex-col justify-around opacity-20">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="w-4 h-6 rounded-sm bg-black/40" />
        ))}
      </div>
      <div className="absolute top-0 bottom-0 right-2 w-6 flex flex-col justify-around opacity-20">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="w-4 h-6 rounded-sm bg-black/40" />
        ))}
      </div>
    </>
  );
}

function LuxuryDecorations() {
  return (
    <>
      {/* Diamond pattern - more visible */}
      <div className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30z' fill='none' stroke='%23C9A96E' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px'
        }}
      />
      
      {/* Rose gold accent lines */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-rose-400/50 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-rose-400/50 to-transparent" />
      <div className="absolute top-0 bottom-0 left-0 w-[2px] bg-gradient-to-b from-transparent via-rose-400/30 to-transparent" />
      <div className="absolute top-0 bottom-0 right-0 w-[2px] bg-gradient-to-b from-transparent via-rose-400/30 to-transparent" />
      
      {/* Elegant corner accents */}
      <div className="absolute top-8 left-8 w-32 h-32 border-l-2 border-t-2 border-rose-400/40" />
      <div className="absolute top-8 right-8 w-32 h-32 border-r-2 border-t-2 border-rose-400/40" />
      <div className="absolute bottom-8 left-8 w-32 h-32 border-l-2 border-b-2 border-rose-400/40" />
      <div className="absolute bottom-8 right-8 w-32 h-32 border-r-2 border-b-2 border-rose-400/40" />
      
      {/* Warm ambient glow */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-rose-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-rose-500/10 rounded-full blur-3xl" />
    </>
  );
}

function FashionDecorations() {
  return (
    <>
      {/* Runway center spotlight */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-full bg-gradient-to-b from-white/10 via-white/5 to-transparent" 
        style={{ clipPath: 'polygon(40% 0, 60% 0, 70% 100%, 30% 100%)' }}
      />
      
      {/* Camera flash bursts */}
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 bg-white rounded-full animate-pulse"
          style={{
            top: `${20 + i * 15}%`,
            left: i % 2 === 0 ? `${10 + i * 5}%` : 'auto',
            right: i % 2 === 1 ? `${10 + i * 5}%` : 'auto',
            animationDelay: `${i * 0.4}s`,
            boxShadow: '0 0 20px 10px rgba(255,255,255,0.3)'
          }}
        />
      ))}
      
      {/* Dramatic side lighting */}
      <div className="absolute top-0 bottom-0 left-0 w-24 bg-gradient-to-r from-yellow-500/15 to-transparent" />
      <div className="absolute top-0 bottom-0 right-0 w-24 bg-gradient-to-l from-yellow-500/15 to-transparent" />
      
      {/* Editorial frame lines */}
      <div className="absolute top-8 left-8 right-8 h-[1px] bg-white/20" />
      <div className="absolute bottom-8 left-8 right-8 h-[1px] bg-white/20" />
      <div className="absolute top-8 bottom-8 left-8 w-[1px] bg-white/20" />
      <div className="absolute top-8 bottom-8 right-8 w-[1px] bg-white/20" />
      
      {/* Diagonal fashion accent */}
      <div className="absolute top-0 right-0 w-64 h-64 overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[2px] bg-gradient-to-l from-yellow-500/60 to-transparent origin-top-right rotate-[-45deg]" />
      </div>
      <div className="absolute bottom-0 left-0 w-64 h-64 overflow-hidden">
        <div className="absolute bottom-0 left-0 w-[400px] h-[2px] bg-gradient-to-r from-yellow-500/60 to-transparent origin-bottom-left rotate-[-45deg]" />
      </div>
      
      {/* Elegant typography-style vertical text placeholder */}
      <div className="absolute top-1/2 -translate-y-1/2 left-4 flex flex-col gap-2 opacity-20">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="w-1 bg-white/60" style={{ height: `${20 + (i % 3) * 15}px` }} />
        ))}
      </div>
      <div className="absolute top-1/2 -translate-y-1/2 right-4 flex flex-col gap-2 opacity-20">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="w-1 bg-white/60" style={{ height: `${20 + (i % 3) * 15}px` }} />
        ))}
      </div>
      
      {/* Top spotlight glow */}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-yellow-500/10 rounded-full blur-3xl" />
      
      {/* Model silhouette hint - abstract shape */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[2px] h-48 bg-gradient-to-t from-white/30 to-transparent" />
    </>
  );
}

function VintageDecorations() {
  return (
    <>
      {/* Aged paper texture - more visible */}
      <div className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
        }}
      />
      
      {/* Warm corner gradients */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-amber-600/20 to-transparent" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-amber-600/15 to-transparent" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-amber-600/15 to-transparent" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-amber-600/20 to-transparent" />
      
      {/* Decorative frame */}
      <div className="absolute inset-12 border-2 border-amber-700/20 rounded-sm" />
      <div className="absolute inset-14 border border-amber-700/10 rounded-sm" />
      
      {/* Corner ornaments */}
      <div className="absolute top-10 left-10 w-8 h-8 border-t-2 border-l-2 border-amber-700/30 rounded-tl-lg" />
      <div className="absolute top-10 right-10 w-8 h-8 border-t-2 border-r-2 border-amber-700/30 rounded-tr-lg" />
      <div className="absolute bottom-10 left-10 w-8 h-8 border-b-2 border-l-2 border-amber-700/30 rounded-bl-lg" />
      <div className="absolute bottom-10 right-10 w-8 h-8 border-b-2 border-r-2 border-amber-700/30 rounded-br-lg" />
    </>
  );
}
