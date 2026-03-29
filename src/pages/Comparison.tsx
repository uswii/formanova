import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/* ─── Types ─────────────────────────────────────────────────── */
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

/* ─── Data ───────────────────────────────────────────────────── */
const TOOLS: Tool[] = [
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
      'FormaNova preserved the ring\'s defining characteristics: the wide dome silhouette, the scattered baguette diamond placement, and the overall proportions of the original design. The model and scene quality match the other tools — but the jewelry itself is recognizably the same piece. This is the result of jewelry-specific training that treats geometry as a non-negotiable constraint, not a creative variable.',
  },
];

const FAQS = [
  {
    q: 'Why do general AI photography tools struggle with jewelry geometry?',
    a: 'Most AI photography tools are primarily trained on apparel and lifestyle imagery, where a degree of creative interpretation is acceptable. Jewelry is structurally different: a ring is a precise three-dimensional object where geometry carries design intent. The number of stones, their orientation, the profile of the band — these define the piece. Without jewelry-specific training, AI models tend to "fill in" detail from learned priors, producing something that reads as a ring but does not faithfully represent the actual product.',
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

/* ─── Helpers ────────────────────────────────────────────────── */
function ScoreIcon({ score }: { score: Score }) {
  if (score === 'full')
    return <CheckCircle2 className="h-5 w-5 text-formanova-success mx-auto" strokeWidth={1.5} />;
  if (score === 'partial')
    return <AlertCircle className="h-5 w-5 text-formanova-warning mx-auto" strokeWidth={1.5} />;
  return <XCircle className="h-5 w-5 text-muted-foreground/50 mx-auto" strokeWidth={1.5} />;
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function Comparison() {
  const formanova = TOOLS.find((t) => t.name === 'FormaNova')!;
  const competitors = TOOLS.filter((t) => t.name !== 'FormaNova');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Best AI Jewelry Photography Tools 2026 — Compared | FormaNova</title>
        <meta
          name="description"
          content="Compare the best AI jewelry photography tools in 2026: Claid, SellerPic, Caimera, The New Black, and FormaNova. See how each handles complex jewelry geometry and design fidelity on a real ring test."
        />
        <link rel="canonical" href="https://formanova.ai/comparison" />
        <meta property="og:title" content="Best AI Jewelry Photography Tools 2026 — Compared" />
        <meta
          property="og:description"
          content="A detailed comparison of AI photography tools for jewelry — testing geometric fidelity, design preservation, and on-model accuracy on a complex dome ring."
        />
      </Helmet>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'Best AI Jewelry Photography Tools 2026 — Compared',
            description:
              'A detailed comparison of AI photography tools for jewelry, testing geometric fidelity and design preservation on a complex ring.',
            publisher: { '@type': 'Organization', name: 'FormaNova', url: 'https://formanova.ai' },
            datePublished: '2026-01-01',
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

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="border-b border-border/30">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-20 md:py-28">
          <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase mb-6">
            Comparison · 2026
          </p>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl uppercase tracking-wide leading-[0.95] max-w-4xl mb-8">
            Best AI Jewelry<br />Photography Tools<br />in 2026
          </h1>
          <p className="font-body text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed mb-10">
            AI photography has transformed e-commerce — but jewelry presents a unique technical challenge
            that most tools aren't designed to solve. We tested the leading platforms on a geometrically
            complex ring to see which ones preserve the design and which ones don't.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button asChild size="lg" className="font-mono text-[10px] tracking-[0.2em] uppercase">
              <Link to="/login">
                Try FormaNova Free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="font-mono text-[10px] tracking-[0.2em] uppercase">
              <a href="#comparison-table">See Full Comparison</a>
            </Button>
          </div>
        </div>
      </section>

      {/* ── The Challenge ─────────────────────────────────────── */}
      <section className="border-b border-border/30">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-20 md:py-28">
          <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase mb-4">
            The Core Challenge
          </p>
          <h2 className="font-display text-4xl md:text-5xl uppercase tracking-wide mb-10">
            Jewelry Geometry Is Hard for AI
          </h2>
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div className="space-y-5">
              <p className="font-body text-base text-muted-foreground leading-relaxed text-justify">
                Most AI photography tools are built primarily around apparel and lifestyle categories. In
                those domains, a degree of creative interpretation is acceptable — a collar can be rendered
                slightly differently without changing the product's identity.
              </p>
              <p className="font-body text-base text-muted-foreground leading-relaxed text-justify">
                Jewelry is structurally different. A ring is a three-dimensional object where every prong,
                every stone, every curve of the shank carries design intent. When AI models encounter
                geometry they weren't specifically trained on, they fill in from learned priors — producing
                something that reads as "a ring" but does not represent the actual piece.
              </p>
              <p className="font-body text-base text-muted-foreground leading-relaxed text-justify">
                This is a well-understood challenge in generative AI. It's not a flaw — it's an alignment
                problem. Tools trained on broad e-commerce imagery are optimized for breadth, not for the
                structural precision that jewelry photography requires.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {[
                { label: 'Dome profile flattened or lost', detail: 'Three-dimensional ring silhouettes are often simplified to flat bands' },
                { label: 'Stone arrangement altered', detail: 'Scattered or irregular stone placements are regularized or removed' },
                { label: 'Surface texture not preserved', detail: 'Brushed, hammered, or engraved finishes are smoothed over' },
                { label: 'Overall proportions shifted', detail: 'Band width, stone scale, and ring height can all shift from the original' },
              ].map(({ label, detail }) => (
                <div key={label} className="border border-border/30 p-5 flex gap-4 items-start">
                  <AlertCircle className="h-4 w-4 text-formanova-warning flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div>
                    <p className="font-mono text-[9px] tracking-[0.15em] text-foreground uppercase mb-1">{label}</p>
                    <p className="font-body text-xs text-muted-foreground leading-relaxed">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Ring Test ─────────────────────────────────────────── */}
      <section className="border-b border-border/30">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-20 md:py-28">
          <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase mb-4">
            The Ring Test
          </p>
          <h2 className="font-display text-4xl md:text-5xl uppercase tracking-wide mb-4">
            Same Ring. Five Tools.
          </h2>
          <p className="font-body text-base text-muted-foreground max-w-2xl leading-relaxed mb-12 text-justify">
            We submitted one ring to all five platforms: a wide dome-cut ring in brushed yellow gold with
            scattered baguette diamonds set at varying orientations. A deliberately complex geometry —
            dome profile, irregular stone placement, textured surface — to stress-test design preservation.
          </p>

          {/* Input ring */}
          <div className="mb-14">
            <p className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase mb-3">
              Input — Original Design
            </p>
            <div className="w-64 border border-border/30 overflow-hidden">
              <img
                src="/comparison/ring-input.png"
                alt="Wide dome gold ring with scattered baguette diamonds — input used for AI photography comparison test"
                className="w-full object-cover aspect-square"
              />
            </div>
            <p className="font-body text-xs text-muted-foreground mt-3 max-w-xs leading-relaxed">
              Wide dome-cut brushed gold ring with scattered baguette diamond setting.
              Complex geometry across all three axes.
            </p>
          </div>

          {/* Competitor outputs */}
          <p className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase mb-6">
            Competitor Outputs
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-14">
            {competitors.map((tool) => (
              <div key={tool.name} className="space-y-3">
                <div className="border border-border/30 overflow-hidden">
                  <img
                    src={tool.outputImage}
                    alt={`${tool.name} AI output for dome ring — geometry altered`}
                    className="w-full object-cover aspect-square"
                  />
                </div>
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-formanova-warning flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div>
                    <p className="font-mono text-[9px] tracking-[0.12em] uppercase">{tool.name}</p>
                    <p className="font-mono text-[8px] tracking-[0.1em] text-muted-foreground uppercase">Design altered</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* FormaNova output — featured */}
          <div className="border border-foreground/25 p-6 md:p-10">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div className="border border-border/20 overflow-hidden">
                <img
                  src={formanova.outputImage}
                  alt="FormaNova AI output — dome ring geometry and stone placement preserved"
                  className="w-full object-cover aspect-square"
                />
              </div>
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-formanova-success flex-shrink-0" strokeWidth={1.5} />
                  <p className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase">
                    FormaNova — Design preserved
                  </p>
                </div>
                <h3 className="font-display text-3xl md:text-4xl uppercase tracking-wide">
                  Geometry Preserved.<br />Design Intact.
                </h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed text-justify">
                  FormaNova's jewelry-specific model preserved the ring's dome silhouette, the scattered
                  baguette stone placement, and the overall proportions of the original design. The result
                  is recognizably the same piece — not a generic ring that fits the prompt.
                </p>
                <p className="font-body text-sm text-muted-foreground leading-relaxed text-justify">
                  This is the practical difference between a general-purpose AI tool and one trained
                  specifically on jewelry: geometry is treated as a constraint to preserve, not a detail
                  to fill in.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tool Breakdowns ───────────────────────────────────── */}
      <section className="border-b border-border/30">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-20 md:py-28">
          <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase mb-4">
            Tool Breakdown
          </p>
          <h2 className="font-display text-4xl md:text-5xl uppercase tracking-wide mb-12">
            Each Tool, Assessed
          </h2>
          <div className="space-y-6">
            {TOOLS.map((tool) => (
              <div
                key={tool.name}
                className={`border p-6 md:p-8 grid md:grid-cols-3 gap-8 items-start ${
                  tool.name === 'FormaNova'
                    ? 'border-foreground/25 bg-foreground/[0.02]'
                    : 'border-border/30'
                }`}
              >
                <div className="md:col-span-2 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-display text-2xl uppercase tracking-wide">{tool.name}</p>
                    {tool.name === 'FormaNova' && (
                      <span className="font-mono text-[8px] tracking-[0.2em] uppercase border border-foreground/30 px-2 py-0.5">
                        Jewelry Specialist
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[9px] tracking-[0.15em] text-muted-foreground uppercase">
                    {tool.tagline}
                  </p>
                  <p className="font-body text-sm text-muted-foreground leading-relaxed text-justify">{tool.note}</p>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Geometry accuracy', score: tool.geometryScore },
                    { label: 'Design fidelity', score: tool.designFidelity },
                    { label: 'Jewelry-specific training', score: tool.jewelrySpecific },
                    { label: 'Ring test', score: tool.ringTest },
                  ].map(({ label, score }) => (
                    <div key={label} className="flex justify-between items-center border-b border-border/20 pb-2.5">
                      <p className="font-mono text-[9px] tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
                      <ScoreIcon score={score} />
                    </div>
                  ))}
                  <p className="font-mono text-[9px] tracking-[0.12em] text-muted-foreground uppercase pt-1">
                    {tool.pricingNote}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison Table ──────────────────────────────────── */}
      <section id="comparison-table" className="border-b border-border/30">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-20 md:py-28">
          <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase mb-4">
            Side by Side
          </p>
          <h2 className="font-display text-4xl md:text-5xl uppercase tracking-wide mb-8">
            Full Comparison Table
          </h2>

          {/* Legend */}
          <div className="flex flex-wrap gap-6 mb-10">
            {[
              { icon: <CheckCircle2 className="h-4 w-4 text-formanova-success" strokeWidth={1.5} />, label: 'Preserved / Supported' },
              { icon: <AlertCircle className="h-4 w-4 text-formanova-warning" strokeWidth={1.5} />, label: 'Partial — common challenge in this category' },
              { icon: <XCircle className="h-4 w-4 text-muted-foreground/40" strokeWidth={1.5} />, label: 'Not a primary focus' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                {icon}
                <span className="font-mono text-[9px] tracking-[0.15em] text-muted-foreground uppercase">{label}</span>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border/30">
                  {['Tool', 'Primary Focus', 'Jewelry-Specific', 'Geometry Accuracy', 'Design Fidelity', 'Ring Test', 'Pricing'].map((h) => (
                    <th key={h} className="text-left py-3 px-3 first:pl-0 last:pr-0 font-mono text-[9px] tracking-[0.15em] text-muted-foreground uppercase font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TOOLS.map((tool) => (
                  <tr
                    key={tool.name}
                    className={`border-b border-border/20 ${tool.name === 'FormaNova' ? 'bg-foreground/[0.02]' : ''}`}
                  >
                    <td className="py-4 px-3 pl-0">
                      <span className={`font-mono text-[10px] tracking-[0.15em] uppercase ${tool.name === 'FormaNova' ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {tool.name}
                      </span>
                    </td>
                    <td className="py-4 px-3 font-mono text-[9px] tracking-[0.1em] text-muted-foreground uppercase max-w-[160px]">
                      {tool.focus}
                    </td>
                    <td className="py-4 px-3"><ScoreIcon score={tool.jewelrySpecific} /></td>
                    <td className="py-4 px-3"><ScoreIcon score={tool.geometryScore} /></td>
                    <td className="py-4 px-3"><ScoreIcon score={tool.designFidelity} /></td>
                    <td className="py-4 px-3"><ScoreIcon score={tool.ringTest} /></td>
                    <td className="py-4 px-3 pr-0 font-mono text-[9px] tracking-[0.1em] text-muted-foreground uppercase">
                      {tool.pricingNote}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Who Should Use Each Tool ──────────────────────────── */}
      <section className="border-b border-border/30">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-20 md:py-28">
          <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase mb-4">
            Choosing the Right Tool
          </p>
          <h2 className="font-display text-4xl md:text-5xl uppercase tracking-wide mb-12">
            Which Tool Is Right for You?
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                condition: 'You sell jewelry exclusively',
                recommendation: 'FormaNova',
                reason: 'Jewelry-specific training means rings, necklaces, and earrings are handled with the precision your products require. Design geometry is preserved by default.',
              },
              {
                condition: 'You sell jewelry alongside clothing',
                recommendation: 'FormaNova for jewelry + general tool for apparel',
                reason: 'Many brands use a specialized tool for their jewelry category and a broader platform for apparel. FormaNova integrates cleanly alongside existing workflows.',
              },
              {
                condition: 'You primarily sell apparel and accessories',
                recommendation: 'Claid, SellerPic, or Caimera',
                reason: 'For clothing-first brands, general-purpose AI photography tools perform very well. The geometric precision requirement is less critical for soft goods.',
              },
              {
                condition: 'You need virtual try-on for fashion',
                recommendation: 'FASHN or SellerPic',
                reason: 'For apparel try-on workflows at scale, FASHN and SellerPic are well-built for that use case. FormaNova focuses on jewelry product photography, not apparel try-on.',
              },
            ].map((item) => (
              <div key={item.condition} className="border border-border/30 p-6 space-y-3">
                <p className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase">If…</p>
                <h3 className="font-display text-xl uppercase tracking-wide">{item.condition}</h3>
                <p className="font-mono text-[9px] tracking-[0.15em] uppercase">→ {item.recommendation}</p>
                <p className="font-body text-sm text-muted-foreground leading-relaxed text-justify">{item.reason}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section className="border-b border-border/30">
        <div className="max-w-3xl mx-auto px-6 md:px-12 lg:px-16 py-20 md:py-28">
          <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase mb-4">FAQ</p>
          <h2 className="font-display text-4xl md:text-5xl uppercase tracking-wide mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-0">
            {FAQS.map((f) => (
              <div key={f.q} className="border-b border-border/20 py-8">
                <h3 className="font-display text-xl uppercase tracking-wide mb-3">{f.q}</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed text-justify">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section>
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-20 md:py-28 text-center space-y-8">
          <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
            Built for Jewelry
          </p>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl uppercase tracking-wide max-w-3xl mx-auto leading-[0.95]">
            Your Designs.<br />Preserved.<br />Every Time.
          </h2>
          <p className="font-body text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            FormaNova is the only AI jewelry photography tool trained specifically to understand and
            preserve three-dimensional jewelry geometry. Try it on your most complex design.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button asChild size="lg" className="font-mono text-[10px] tracking-[0.2em] uppercase">
              <Link to="/login">
                Try FormaNova Free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="font-mono text-[10px] tracking-[0.2em] uppercase">
              <Link to="/pricing">View Pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
