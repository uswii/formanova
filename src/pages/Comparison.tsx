import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PUBLISH_DATE = 'March 29, 2026';
const READING_TIME = '7 min read';
const CANONICAL = 'https://formanova.ai/blog/ai-jewelry-photography-comparison';

type Score = 'full' | 'partial' | 'none';

interface Tool {
  name: string;
  tagline: string;
  focus: string;
  geometryScore: Score;
  designFidelity: Score;
  jewelrySpecific: Score;
  ringTest: Score;
  pricingNote: string;
  outputImage: string;
  note: string;
}

const TOOLS: Tool[] = [
  {
    name: 'FormaNova',
    tagline: 'Purpose-built AI for jewelry photography',
    focus: 'Jewelry photography — rings, necklaces, earrings, bracelets, watches',
    geometryScore: 'full',
    designFidelity: 'full',
    jewelrySpecific: 'full',
    ringTest: 'full',
    pricingNote: 'From $9/mo',
    outputImage: '/comparison/formanova-output.png',
    note:
      "FormaNova preserved the ring's defining characteristics: the wide dome silhouette, the scattered baguette diamond placement, and the overall proportions of the original design. The model and scene quality match the other tools — but the jewelry itself is recognizably the same piece. This is the result of jewelry-specific training that treats geometry as a non-negotiable constraint, not a creative variable.",
  },
  {
    name: 'SellerPic',
    tagline: 'Best for social selling & Shopify DTC',
    focus: 'Multi-category product imagery, social media',
    geometryScore: 'partial',
    designFidelity: 'partial',
    jewelrySpecific: 'none',
    ringTest: 'partial',
    pricingNote: 'Free trial, paid plans vary',
    outputImage: '/comparison/sellerpic-output.png',
    note:
      'SellerPic produces clean on-model results for fashion and accessories. On our ring test, it generated a model shot but simplified the ring down to a thin plain gold band — the distinctive wide dome profile, brushed texture, and scattered baguette diamonds were not carried through. A common outcome when apparel-trained models encounter complex three-dimensional jewelry.',
  },
  {
    name: 'Claid',
    tagline: 'Best overall AI fashion photography',
    focus: 'E-commerce fashion & apparel',
    geometryScore: 'partial',
    designFidelity: 'partial',
    jewelrySpecific: 'none',
    ringTest: 'partial',
    pricingNote: 'From $9/mo',
    outputImage: '/comparison/claid-output.webp',
    note:
      'Claid delivers polished results for clothing and lifestyle photography. On the ring test, it placed a gold band with stones in a linear channel arrangement — visually clean, but structurally different from the original dome-cut ring with scattered baguette stones. The model quality is excellent; the jewelry geometry interpretation is where the challenge lies.',
  },
  {
    name: 'Caimera',
    tagline: 'AI-powered product photography',
    focus: 'Product photography across categories',
    geometryScore: 'partial',
    designFidelity: 'partial',
    jewelrySpecific: 'none',
    ringTest: 'partial',
    pricingNote: 'Credit-based',
    outputImage: '/comparison/caimera-output.png',
    note:
      'Caimera generated a high-quality model shot with a ring that reads as multi-band or stacked — different from the single wide-dome original. The stone arrangement and overall silhouette were altered. This reflects a pattern across general-purpose tools: they understand "ring" as a category but interpret specific geometry from training priors rather than the actual product structure.',
  },
  {
    name: 'The New Black',
    tagline: 'AI fashion design & product visualization',
    focus: 'Fashion design generation & styling',
    geometryScore: 'partial',
    designFidelity: 'partial',
    jewelrySpecific: 'none',
    ringTest: 'partial',
    pricingNote: 'Subscription-based',
    outputImage: '/comparison/newblack-output.png',
    note:
      'The New Black produced a dramatically different output — a wide rectangular brick-shaped ring with large geometric panels, showing no resemblance to the original dome profile. Its generative strength is in fashion concept and apparel direction; intricate jewelry with specific geometry is outside its trained domain.',
  },
];

const FAQS = [
  {
    q: 'Why do general AI photography tools struggle with jewelry geometry?',
    a: 'Most AI photography tools are primarily trained on apparel and lifestyle imagery, where a degree of creative interpretation is acceptable. Jewelry is structurally different: a ring is a precise three-dimensional object where geometry carries design intent. Without jewelry-specific training, AI models tend to fill in detail from learned priors, producing something that reads as a ring but does not faithfully represent the actual product.',
  },
  {
    q: 'What ring was used in the comparison test?',
    a: 'We used a wide dome-cut ring in brushed yellow gold with scattered baguette diamonds set at varying orientations across the dome surface — a geometrically complex design that tests whether an AI can preserve three-dimensional silhouette, surface texture, and irregular stone placement simultaneously.',
  },
  {
    q: 'Does FormaNova support jewelry categories beyond rings?',
    a: 'Yes. FormaNova supports rings, necklaces, earrings, bracelets, and watches — all with the same geometric fidelity focus. Each category has its own placement and rendering pipeline trained on real jewelry photography.',
  },
  {
    q: 'Can I use FormaNova if I already use Claid or SellerPic for clothing?',
    a: 'Absolutely. Many brands use general-purpose tools for their apparel and FormaNova specifically for their jewelry line, where design accuracy matters most for product listings, campaign imagery, and customer trust.',
  },
  {
    q: 'How much does FormaNova cost?',
    a: 'FormaNova uses credit-based pricing starting at $9 for 100 credits (approximately 10 photos). Standard is $39 for 500 credits, and Pro is $99 for 1,500 credits.',
  },
];

function ScoreIcon({ score }: { score: Score }) {
  if (score === 'full')
    return <CheckCircle2 className="h-4 w-4 text-formanova-success" strokeWidth={1.5} />;
  if (score === 'partial')
    return <AlertCircle className="h-4 w-4 text-formanova-warning" strokeWidth={1.5} />;
  return <XCircle className="h-4 w-4 text-muted-foreground/40" strokeWidth={1.5} />;
}

export default function Comparison() {
  const formanova = TOOLS[0]; // FormaNova always first
  const competitors = TOOLS.slice(1);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Best AI Jewelry Photography Tools Comparison 2026 | FormaNova</title>
        <meta
          name="description"
          content="We tested the best AI jewelry photography tools — FormaNova, SellerPic, Claid, Caimera, and The New Black — on a complex ring. See which ones preserve jewelry geometry and which ones don't."
        />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:title" content="Best AI Jewelry Photography Tools 2026 — Compared" />
        <meta property="og:description" content="We tested the leading AI photography tools on a complex ring. Here's what happened to the geometry." />
        <meta property="og:type" content="article" />
        <meta property="article:published_time" content="2026-03-29" />
      </Helmet>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: '5 Best AI Jewelry Photography Tools in 2026 — Compared',
            description: 'We tested the leading AI photography tools on a complex ring to see which ones preserve jewelry geometry.',
            datePublished: '2026-03-29',
            author: { '@type': 'Organization', name: 'FormaNova' },
            publisher: { '@type': 'Organization', name: 'FormaNova', url: 'https://formanova.ai' },
            mainEntityOfPage: CANONICAL,
          }),
        }}
      />
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

      {/* ── Article header ──────────────────────────────────── */}
      <article>
        <header className="border-b border-border/30">
          <div className="max-w-3xl mx-auto px-6 md:px-8 py-16 md:py-20">
            <div className="flex items-center gap-4 mb-6">
              <span className="font-mono text-[9px] tracking-[0.25em] text-muted-foreground uppercase border border-border/40 px-2.5 py-1">
                Jewelry AI
              </span>
              <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase">
                {PUBLISH_DATE}
              </span>
              <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase">
                {READING_TIME}
              </span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl uppercase tracking-wide leading-[0.95] mb-8">
              Best AI Jewelry Photography Tools — Comparison 2026
            </h1>
            <p className="font-body text-base md:text-lg text-muted-foreground leading-relaxed text-justify">
              AI photography tools have transformed e-commerce — but most were built for clothing.
              We put the leading platforms to a real test: one complex ring, five tools, and a clear
              question: which ones actually understand jewelry geometry?
            </p>
          </div>
        </header>

        {/* ── Article body ────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto px-6 md:px-8 py-14 space-y-16">

          {/* Intro */}
          <section className="space-y-5">
            <p className="font-body text-base text-muted-foreground leading-relaxed text-justify">
              Jewelry photography has always been one of the most technically demanding disciplines in
              product imaging. The combination of reflective surfaces, precise stone settings, and
              complex three-dimensional geometry makes jewelry uniquely difficult to photograph — and
              equally difficult for AI to reproduce faithfully.
            </p>
            <p className="font-body text-base text-muted-foreground leading-relaxed text-justify">
              Most AI photography platforms have been optimized for apparel and lifestyle imagery, where
              a degree of creative interpretation is acceptable. A shirt collar rendered slightly
              differently doesn't change the product. But a ring with its prongs reshaped, its stone
              count altered, or its dome profile flattened is a different product entirely.
            </p>
            <p className="font-body text-base text-muted-foreground leading-relaxed text-justify">
              We tested five of the most widely used AI photography tools on a single, geometrically
              complex ring. Here's what we found.
            </p>
          </section>

          {/* The ring */}
          <section className="space-y-6">
            <h2 className="font-display text-3xl md:text-4xl uppercase tracking-wide">
              The Test: A Complex Ring
            </h2>
            <p className="font-body text-base text-muted-foreground leading-relaxed text-justify">
              We chose a wide dome-cut ring in brushed yellow gold with scattered baguette diamonds
              set at varying orientations across the dome surface. This design was selected deliberately
              for its complexity: an unusual three-dimensional silhouette, irregular stone placement,
              mixed surface textures, and a distinctive overall profile that would be immediately
              recognizable if altered.
            </p>
            <div className="grid grid-cols-2 gap-4 not-prose">
              <div className="space-y-2">
                <div className="border border-border/30 overflow-hidden">
                  <img
                    src="/comparison/ring-input.png"
                    alt="Wide dome gold ring with scattered baguette diamonds — original input design"
                    className="w-full object-cover aspect-square"
                  />
                </div>
                <p className="font-mono text-[8px] tracking-[0.15em] text-muted-foreground uppercase">
                  Input — original design
                </p>
              </div>
              <div className="space-y-2">
                <div className="border border-foreground/25 overflow-hidden">
                  <img
                    src={formanova.outputImage}
                    alt="FormaNova output — dome ring geometry, stone placement, and proportions preserved"
                    className="w-full object-cover aspect-square"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-formanova-success flex-shrink-0" strokeWidth={1.5} />
                  <p className="font-mono text-[8px] tracking-[0.15em] uppercase">FormaNova — design preserved</p>
                </div>
              </div>
            </div>
          </section>

          {/* The geometry problem */}
          <section className="space-y-5">
            <h2 className="font-display text-3xl md:text-4xl uppercase tracking-wide">
              Why AI Struggles with Jewelry Geometry
            </h2>
            <p className="font-body text-base text-muted-foreground leading-relaxed text-justify">
              Generative AI models learn distributions from training data. When they encounter a product
              type they've seen thousands of times — a t-shirt, a sneaker, a handbag — they can
              reproduce it faithfully because the training signal is strong and the geometry is familiar.
            </p>
            <p className="font-body text-base text-muted-foreground leading-relaxed text-justify">
              Jewelry is a different story. Most AI photography platforms are trained primarily on apparel
              imagery. When their models encounter a complex ring — particularly one with an unusual
              silhouette or irregular stone placement — they fall back on learned priors: what a ring
              "usually" looks like. The result reads as a ring, but it's not <em>your</em> ring.
            </p>
            <p className="font-body text-base text-muted-foreground leading-relaxed text-justify">
              This isn't a flaw in any particular tool. It's an alignment problem: a tool trained for
              breadth across product categories will naturally trade geometric precision for generalization.
              The solution is jewelry-specific training — models that treat stone count, band profile, and
              surface detail as constraints to preserve, not variables to fill in.
            </p>
          </section>

          {/* Tools */}
          <section className="space-y-10">
            <h2 className="font-display text-3xl md:text-4xl uppercase tracking-wide">
              The Tools We Tested
            </h2>

            {/* FormaNova — always first */}
            <div className="space-y-4">
              <h3 className="font-display text-2xl uppercase tracking-wide">
                1. FormaNova — {formanova.tagline}
              </h3>
              <p className="font-mono text-[9px] tracking-[0.15em] text-muted-foreground uppercase">
                Primary focus: {formanova.focus} · {formanova.pricingNote}
              </p>
              <div className="border border-foreground/20 p-1">
                <div className="grid grid-cols-2 gap-4 not-prose">
                  <div className="space-y-1">
                    <div className="grid grid-cols-2 gap-0 overflow-hidden">
                      <div>
                        <img
                          src="/comparison/ring-input.png"
                          alt="Input ring design"
                          className="w-full object-cover aspect-square"
                        />
                      </div>
                      <div>
                        <img
                          src={formanova.outputImage}
                          alt="FormaNova AI output — dome ring geometry, stone placement, and proportions preserved from original"
                          className="w-full object-cover aspect-square"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-0">
                      <p className="font-mono text-[7px] tracking-[0.12em] text-muted-foreground uppercase text-center">Input</p>
                      <p className="font-mono text-[7px] tracking-[0.12em] text-muted-foreground uppercase text-center">Output</p>
                    </div>
                  </div>
                  <div className="p-5 flex flex-col justify-between">
                    <div className="space-y-3">
                      {[
                        { label: 'Geometry accuracy', score: formanova.geometryScore },
                        { label: 'Design fidelity', score: formanova.designFidelity },
                        { label: 'Jewelry-specific', score: formanova.jewelrySpecific },
                        { label: 'Ring test', score: formanova.ringTest },
                      ].map(({ label, score }) => (
                        <div key={label} className="flex items-center justify-between border-b border-border/20 pb-2">
                          <span className="font-mono text-[8px] tracking-[0.1em] text-muted-foreground uppercase">{label}</span>
                          <ScoreIcon score={score} />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-start gap-2 mt-4">
                      <CheckCircle2 className="h-3.5 w-3.5 text-formanova-success flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                      <p className="font-mono text-[8px] tracking-[0.1em] uppercase">Design preserved</p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="font-body text-sm text-muted-foreground leading-relaxed text-justify">
                {formanova.note}
              </p>
            </div>

            {/* Competitors */}
            {competitors.map((tool, i) => (
              <div key={tool.name} className="space-y-4">
                <h3 className="font-display text-2xl uppercase tracking-wide">
                  {i + 2}. {tool.name} — {tool.tagline}
                </h3>
                <p className="font-mono text-[9px] tracking-[0.15em] text-muted-foreground uppercase">
                  Primary focus: {tool.focus} · {tool.pricingNote}
                </p>
                <div className="grid grid-cols-2 gap-4 not-prose">
                  <div className="space-y-1">
                    <div className="grid grid-cols-2 gap-0 border border-border/30 overflow-hidden">
                      <div>
                        <img
                          src="/comparison/ring-input.png"
                          alt="Input ring design"
                          className="w-full object-cover aspect-square"
                        />
                      </div>
                      <div>
                        <img
                          src={tool.outputImage}
                          alt={`${tool.name} AI output for the dome ring test — geometry altered from original`}
                          className="w-full object-cover aspect-square"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-0">
                      <p className="font-mono text-[7px] tracking-[0.12em] text-muted-foreground uppercase text-center">Input</p>
                      <p className="font-mono text-[7px] tracking-[0.12em] text-muted-foreground uppercase text-center">Output</p>
                    </div>
                  </div>
                  <div className="border border-border/30 p-5 flex flex-col justify-between">
                    <div className="space-y-3">
                      {[
                        { label: 'Geometry accuracy', score: tool.geometryScore },
                        { label: 'Design fidelity', score: tool.designFidelity },
                        { label: 'Jewelry-specific', score: tool.jewelrySpecific },
                      ].map(({ label, score }) => (
                        <div key={label} className="flex items-center justify-between border-b border-border/20 pb-2">
                          <span className="font-mono text-[8px] tracking-[0.1em] text-muted-foreground uppercase">{label}</span>
                          <ScoreIcon score={score} />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-start gap-2 mt-4">
                      <AlertCircle className="h-3.5 w-3.5 text-formanova-warning flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                      <p className="font-mono text-[8px] tracking-[0.1em] text-muted-foreground uppercase">
                        Ring geometry altered
                      </p>
                    </div>
                  </div>
                </div>
                <p className="font-body text-sm text-muted-foreground leading-relaxed text-justify">
                  {tool.note}
                </p>
              </div>
            ))}
          </section>

          {/* Full comparison table */}
          <section className="space-y-6" id="comparison-table">
            <h2 className="font-display text-3xl md:text-4xl uppercase tracking-wide">
              Full Comparison Table
            </h2>

            {/* Legend */}
            <div className="flex flex-wrap gap-5">
              {[
                { icon: <CheckCircle2 className="h-3.5 w-3.5 text-formanova-success" strokeWidth={1.5} />, label: 'Preserved' },
                { icon: <AlertCircle className="h-3.5 w-3.5 text-formanova-warning" strokeWidth={1.5} />, label: 'Partial' },
                { icon: <XCircle className="h-3.5 w-3.5 text-muted-foreground/40" strokeWidth={1.5} />, label: 'Not a focus' },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  {icon}
                  <span className="font-mono text-[8px] tracking-[0.15em] text-muted-foreground uppercase">{label}</span>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto not-prose">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border/30">
                    {['Tool', 'Jewelry-Specific', 'Geometry', 'Design Fidelity', 'Ring Test', 'Price'].map((h) => (
                      <th key={h} className="text-left py-2.5 px-3 first:pl-0 font-mono text-[8px] tracking-[0.15em] text-muted-foreground uppercase font-normal whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TOOLS.map((tool) => (
                    <tr key={tool.name} className={`border-b border-border/20 ${tool.name === 'FormaNova' ? 'bg-foreground/[0.025]' : ''}`}>
                      <td className="py-3.5 px-3 pl-0 font-mono text-[9px] tracking-[0.15em] uppercase whitespace-nowrap">
                        {tool.name}
                      </td>
                      <td className="py-3.5 px-3"><ScoreIcon score={tool.jewelrySpecific} /></td>
                      <td className="py-3.5 px-3"><ScoreIcon score={tool.geometryScore} /></td>
                      <td className="py-3.5 px-3"><ScoreIcon score={tool.designFidelity} /></td>
                      <td className="py-3.5 px-3"><ScoreIcon score={tool.ringTest} /></td>
                      <td className="py-3.5 px-3 font-mono text-[8px] tracking-[0.1em] text-muted-foreground uppercase whitespace-nowrap">
                        {tool.pricingNote}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Verdict */}
          <section className="space-y-5">
            <h2 className="font-display text-3xl md:text-4xl uppercase tracking-wide">
              Verdict
            </h2>
            <p className="font-body text-base text-muted-foreground leading-relaxed text-justify">
              All five tools produce professional-quality model photography. For apparel, lifestyle imagery,
              and simple jewelry like plain bands, any of the platforms reviewed here will deliver good
              results.
            </p>
            <p className="font-body text-base text-muted-foreground leading-relaxed text-justify">
              The difference emerges with geometrically complex jewelry — the kind of pieces that define
              a fine jewelry brand. Irregular stone placement, dimensional band profiles, mixed surface
              textures: these are the details that general-purpose AI tools consistently struggle to
              preserve, and that FormaNova was specifically built to handle.
            </p>
            <p className="font-body text-base text-muted-foreground leading-relaxed text-justify">
              If jewelry is your primary product category, geometric fidelity is the metric that matters
              most for customer trust and product accuracy. On that metric, purpose-built beats
              general-purpose — consistently.
            </p>
          </section>

          {/* FAQ */}
          <section className="space-y-0 border-t border-border/30 pt-12">
            <h2 className="font-display text-3xl md:text-4xl uppercase tracking-wide mb-8">
              Frequently Asked Questions
            </h2>
            {FAQS.map((f) => (
              <div key={f.q} className="border-b border-border/20 py-6">
                <h3 className="font-display text-lg uppercase tracking-wide mb-2">{f.q}</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed text-justify">{f.a}</p>
              </div>
            ))}
          </section>

          {/* CTA */}
          <section className="border border-border/30 p-8 md:p-10 space-y-5 text-center">
            <p className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase">
              Built for Jewelry
            </p>
            <h2 className="font-display text-3xl md:text-4xl uppercase tracking-wide">
              Try FormaNova on Your Most Complex Design
            </h2>
            <p className="font-body text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
              Upload any ring, necklace, or earring and see the geometry preserved — not reinterpreted.
            </p>
            <div className="flex flex-wrap gap-4 justify-center pt-2">
              <Button asChild size="lg" className="font-mono text-[10px] tracking-[0.2em] uppercase">
                <Link to="/login">
                  Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="font-mono text-[10px] tracking-[0.2em] uppercase">
                <Link to="/pricing">View Pricing</Link>
              </Button>
            </div>
          </section>

        </div>
      </article>
    </div>
  );
}
