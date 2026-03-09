import { Link } from 'react-router-dom';
import { ArrowRight, Layers, PenTool, Box, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OptimizedImage } from '@/components/ui/optimized-image';
import cadCardImg from '@/assets/cad-studio/text-to-cad-card.webp';

const FAQS = [
  {
    q: 'What is text-to-CAD for jewelry?',
    a: 'Text-to-CAD lets you describe a jewelry piece in natural language — for example, "a solitaire diamond ring with a thin gold band" — and our AI generates a 3D CAD model you can refine and export.',
  },
  {
    q: 'What types of jewelry can I generate?',
    a: 'You can generate rings, necklaces, earrings, bracelets, and more. The AI understands gemstone placements, prong settings, band styles, and other jewelry-specific design elements.',
  },
  {
    q: 'How much does text-to-CAD cost?',
    a: 'Text-to-CAD uses the same credit system as photoshoots. Plans start at $9 for 100 credits. See the pricing page for details.',
  },
  {
    q: 'Can I edit the generated CAD model?',
    a: 'Yes. After generation, you can refine the model in our built-in CAD studio — adjust materials, lighting, and export for manufacturing or rendering.',
  },
];

export default function AIJewelryCAD() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* JSON-LD FAQPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQS.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }),
        }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/30">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
              AI-Powered Jewelry Design
            </p>
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl uppercase tracking-wide leading-[0.95]">
              AI Jewelry<br />CAD<br />Generator
            </h1>
            <p className="font-body text-base md:text-lg text-muted-foreground max-w-md leading-relaxed">
              Describe your jewelry design in plain text and get a 3D CAD model in minutes. From concept to manufacturable model — powered by AI.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="font-mono text-[10px] tracking-[0.2em] uppercase">
                <Link to="/login">
                  Try Text-to-CAD <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="font-mono text-[10px] tracking-[0.2em] uppercase">
                <Link to="/pricing">View Pricing</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <OptimizedImage
              src={cadCardImg}
              alt="AI-generated 3D CAD model of a jewelry ring"
              className="w-full object-cover border border-border/20"
              priority
              aspectRatio="4/3"
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-20 md:py-28">
        <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase mb-4">How It Works</p>
        <h2 className="font-display text-4xl md:text-5xl uppercase tracking-wide mb-16">
          Text → 3D Model → Export
        </h2>
        <div className="grid md:grid-cols-4 gap-8">
          {[
            { icon: PenTool, title: 'Describe', desc: 'Write a natural language description of your jewelry design — materials, gemstones, style, dimensions.' },
            { icon: Layers, title: 'AI Generates', desc: 'Our AI interprets your prompt and generates a detailed 3D CAD model with accurate geometry.' },
            { icon: Box, title: 'Refine', desc: 'Use the built-in CAD studio to adjust materials, apply textures, and perfect your design.' },
            { icon: Download, title: 'Export', desc: 'Download your model for 3D printing, rendering, or manufacturing workflows.' },
          ].map((f) => (
            <div key={f.title} className="space-y-4">
              <f.icon className="h-6 w-6 text-foreground" strokeWidth={1.5} />
              <h3 className="font-display text-2xl uppercase tracking-wide">{f.title}</h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Use Cases */}
      <section className="border-t border-border/30">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-20 md:py-28">
          <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase mb-4">Use Cases</p>
          <h2 className="font-display text-4xl md:text-5xl uppercase tracking-wide mb-12">
            Built for Jewelry Professionals
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: 'Designers', desc: 'Rapidly prototype designs before committing to traditional CAD software. Iterate on concepts in minutes.' },
              { title: 'Manufacturers', desc: 'Generate production-ready models from client descriptions. Reduce back-and-forth design cycles.' },
              { title: 'Retailers', desc: 'Create custom designs on demand. Offer AI-assisted customization to your customers.' },
            ].map((u) => (
              <div key={u.title} className="border border-border/30 p-8 space-y-4">
                <h3 className="font-display text-2xl uppercase tracking-wide">{u.title}</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">{u.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing snapshot */}
      <section className="border-t border-border/30">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-20 md:py-28">
          <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase mb-4">Pricing</p>
          <h2 className="font-display text-4xl md:text-5xl uppercase tracking-wide mb-12">
            Credit-Based Plans
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Basic', price: '$9', credits: '100' },
              { name: 'Standard', price: '$39', credits: '500' },
              { name: 'Pro', price: '$99', credits: '1,500' },
            ].map((p) => (
              <div key={p.name} className="border border-border/30 p-8 space-y-4">
                <p className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground uppercase">{p.name}</p>
                <p className="font-display text-4xl uppercase tracking-tight">{p.price}</p>
                <p className="font-mono text-sm text-muted-foreground">{p.credits} credits</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Button asChild size="lg" className="font-mono text-[10px] tracking-[0.2em] uppercase">
              <Link to="/pricing">See Full Pricing <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border/30">
        <div className="max-w-3xl mx-auto px-6 md:px-12 lg:px-16 py-20 md:py-28">
          <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase mb-4">FAQ</p>
          <h2 className="font-display text-4xl md:text-5xl uppercase tracking-wide mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-8">
            {FAQS.map((f) => (
              <div key={f.q} className="space-y-2">
                <h3 className="font-display text-xl uppercase tracking-wide">{f.q}</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border/30">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-20 md:py-28 text-center space-y-8">
          <h2 className="font-display text-4xl md:text-5xl uppercase tracking-wide">
            Ready to Design with AI?
          </h2>
          <Button asChild size="lg" className="font-mono text-[10px] tracking-[0.2em] uppercase">
            <Link to="/login">Try Text-to-CAD Now <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
