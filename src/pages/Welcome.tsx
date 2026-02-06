import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';
import { ScrollRevealSection, StaggerContainer } from '@/components/ScrollRevealSection';
import { KineticText } from '@/components/KineticText';
import { CinematicHero } from '@/components/CinematicHero';
import { CinematicShowcase } from '@/components/CinematicShowcase';
import { useAuth } from '@/contexts/AuthContext';

// Assets
import formanovaLogo from '@/assets/formanova-logo.png';
import heroDiamondChoker from '@/assets/jewelry/hero-diamond-choker.png';
import heroVneckNecklace from '@/assets/jewelry/hero-vneck-necklace.png';
import heroChokerBack from '@/assets/jewelry/hero-choker-back.png';
import heroHandDiamonds from '@/assets/jewelry/hero-hand-diamonds.png';
import heroBlueBracelets from '@/assets/jewelry/hero-blue-bracelets.png';
import heroGoldPendant from '@/assets/jewelry/hero-gold-pendant.png';
import heroEmeraldEarrings from '@/assets/jewelry/hero-emerald-earrings.png';
import heroGemstoneRings from '@/assets/jewelry/hero-gemstone-rings.png';
import heroAquamarineRings from '@/assets/jewelry/hero-aquamarine-rings.png';
import heroDiamondBracelets from '@/assets/jewelry/hero-diamond-bracelets.png';

export default function Welcome() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const heroImages = [
    { src: heroDiamondChoker, alt: 'Diamond choker necklace' },
    { src: heroVneckNecklace, alt: 'V-neck diamond necklace' },
    { src: heroChokerBack, alt: 'Diamond choker from back' },
    { src: heroHandDiamonds, alt: 'Diamond hand jewelry' },
    { src: heroBlueBracelets, alt: 'Blue gemstone bracelets' },
    { src: heroGoldPendant, alt: 'Gold pendant necklace' },
    { src: heroEmeraldEarrings, alt: 'Emerald crystal earrings' },
    { src: heroGemstoneRings, alt: 'Colorful gemstone rings' },
    { src: heroAquamarineRings, alt: 'Aquamarine rings on hands' },
    { src: heroDiamondBracelets, alt: 'Diamond bracelets and rings' },
  ];

  // If signed in, go straight to studio. Otherwise, prompt to sign in.
  const handleStart = () => {
    if (user) {
      navigate('/studio');
    } else {
      navigate('/login');
    }
  };

  const features = [
    { title: 'Zero Alterations', description: 'Your jewelry stays exactly as in reality. No AI hallucinations. No subtle changes.' },
    { title: 'Verified Accuracy', description: 'See precision metrics that verify your jewelry is preserved perfectly.' },
    { title: 'Realistic Imagery', description: 'Get stunning photoshoot imagery with lifelike models ready in seconds.' },
  ];


  return (
    <div className="min-h-screen bg-background overflow-x-hidden scroll-smooth">
      {/* Hero Section with Cinematic 3D Parallax */}
      <section className="min-h-screen relative overflow-hidden bg-background">
        <CinematicHero images={heroImages} className="absolute inset-0" />
        
        {/* Gradient overlay - theme neutral */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-black/80 z-10" />
        
        {/* Content */}
        <div className="relative z-20 marta-container min-h-screen flex flex-col justify-center py-24 lg:py-32">
          <ScrollRevealSection animation="fade-left" className="max-w-2xl">
            <span className="marta-label mb-8 block text-white text-base tracking-[0.3em] uppercase font-medium">
              Trustable AI Photography for Jewelry
            </span>

            <div className="mb-8">
              <KineticText as="h1" animation="split" className="marta-headline text-white leading-[0.85]">Your</KineticText>
              <KineticText as="h1" animation="split" delay={200} className="marta-headline text-white leading-[0.85]">Jewelry</KineticText>
              <KineticText as="h1" animation="split" delay={400} className="marta-headline hero-accent-text leading-[0.85]">Unchanged</KineticText>
            </div>

            <ScrollRevealSection animation="fade-up" delay={300}>
              <p className="marta-body text-white/90 max-w-md mb-12 leading-relaxed">
                AI imagery you can trust. No hallucinations. No subtle changes. Ever. 
                Your jewelry accurately shown.
              </p>
            </ScrollRevealSection>

            <ScrollRevealSection animation="fade-up" delay={500}>
              <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={handleStart} className="marta-button-filled magnetic-button">
                  <span>Start Creating</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button onClick={() => navigate('/tutorial')} className="marta-button glass-effect magnetic-button">
                  <Play className="h-4 w-4" />
                  <span>Watch Tutorial</span>
                </button>
              </div>
            </ScrollRevealSection>
          </ScrollRevealSection>
        </div>
      </section>


      {/* Features Section */}
      <section className="marta-section">
        <div className="marta-container">
          <ScrollRevealSection animation="fade-up" className="mb-16 md:mb-24">
            <span className="marta-label mb-6 block">Why FormaNova</span>
            <h2 className="marta-headline-sm">
              <KineticText animation="wave">AI Photography You Can Actually Trust</KineticText>
            </h2>
          </ScrollRevealSection>

          <StaggerContainer className="grid md:grid-cols-3 border-t border-l border-border/20" staggerDelay={150}>
            {features.map((feature, index) => (
              <div key={index} className="marta-block border-r border-b border-border/20 relative group overflow-hidden">
                {/* Background hover effect */}
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative z-10">
                  <h3 className="font-display text-2xl md:text-3xl mb-4 transition-transform duration-300 group-hover:translate-x-2">{feature.title}</h3>
                  <p className="marta-body text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </StaggerContainer>

          {/* Cinematic Video Showcase */}
          <ScrollRevealSection animation="fade-up" delay={300} className="mt-16 md:mt-24">
            <CinematicShowcase />
          </ScrollRevealSection>
        </div>
      </section>

      {/* CTA Section */}
      <section className="marta-section">
        <ScrollRevealSection animation="zoom" className="marta-container text-center">
          <div className="max-w-4xl mx-auto">
            <span className="marta-label mb-12 block">Start Now</span>
            <h2 className="marta-headline mb-8">
              <KineticText animation="split">Ready To Create?</KineticText>
            </h2>
            <p className="marta-body text-muted-foreground max-w-lg mx-auto mb-12">
              Professional photoshoots with mathematically verified accuracy. Your jewelry, perfectly preserved.
            </p>
            <button onClick={handleStart} className="marta-button-filled magnetic-button">
              <span>Start Your Photoshoot</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </ScrollRevealSection>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/20">
        <div className="marta-section border-b border-border/20">
          <div className="marta-container text-center">
            <span className="marta-label">Featured In</span>
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 mt-12 mb-16">
              {[
                { name: 'CNN', url: 'https://cnn.com' },
                { name: 'TECHCRUNCH', url: 'https://techcrunch.com' },
                { name: 'THE TELEGRAPH', url: 'https://telegraph.co.uk' },
                { name: 'HUFFPOST', url: 'https://huffpost.com' },
              ].map((brand) => (
                <a 
                  key={brand.name} 
                  href={brand.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-display text-2xl md:text-3xl text-foreground/30 hover:text-foreground/60 transition-colors duration-300 cursor-pointer"
                >
                  {brand.name}
                </a>
              ))}
            </div>
            <p className="font-display text-3xl md:text-4xl mb-12">
              Trusted by <span className="hero-accent-text">70+</span> Brands
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
              {[
                { name: 'HUGO BOSS', url: 'https://hugoboss.com' },
                { name: 'ATOIR', url: 'https://atoirthelabel.com' },
                { name: 'TULLEEN', url: 'https://tulleen.com' },
                { name: 'MANGO', url: 'https://mango.com' },
              ].map((brand) => (
                <a 
                  key={brand.name} 
                  href={brand.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-display text-2xl md:text-3xl text-foreground/20 hover:text-foreground/50 transition-colors duration-300 cursor-pointer"
                >
                  {brand.name}
                </a>
              ))}
            </div>
          </div>
        </div>
        
        <div className="marta-container py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <img src={formanovaLogo} alt="FormaNova" className="h-8 w-auto object-contain logo-adaptive" />
            <nav className="flex items-center gap-8">
              <Link to="/studio" className="marta-label marta-link hover:text-foreground">Studio</Link>
              <Link to="/tutorial" className="marta-label marta-link hover:text-foreground">Tutorial</Link>
              <a href="https://linkedin.com/company/rare-sense-inc" target="_blank" rel="noopener noreferrer" className="marta-label marta-link hover:text-foreground">LinkedIn</a>
            </nav>
            <p className="marta-label">© {new Date().getFullYear()} FormaNova</p>
          </div>
        </div>
      </footer>
    </div>
  );
}