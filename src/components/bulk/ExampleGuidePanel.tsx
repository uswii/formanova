import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

// Necklace examples
import necklaceAllowed1 from '@/assets/examples/necklace-allowed-1.webp';
import necklaceAllowed2 from '@/assets/examples/necklace-allowed-2.webp';
import necklaceAllowed3 from '@/assets/examples/necklace-allowed-3.webp';
import necklaceNotAllowed1 from '@/assets/examples/necklace-notallowed-1.webp';
import necklaceNotAllowed2 from '@/assets/examples/necklace-notallowed-2.webp';
import necklaceNotAllowed3 from '@/assets/examples/necklace-notallowed-3.webp';

// Earring examples
import earringAllowed1 from '@/assets/examples/earring-allowed-1.webp';
import earringAllowed2 from '@/assets/examples/earring-allowed-2.webp';
import earringAllowed3 from '@/assets/examples/earring-allowed-3.webp';
import earringNotAllowed1 from '@/assets/examples/earring-notallowed-1.webp';
import earringNotAllowed2 from '@/assets/examples/earring-notallowed-2.webp';
import earringNotAllowed3 from '@/assets/examples/earring-notallowed-3.webp';

// Bracelet examples
import braceletAllowed1 from '@/assets/examples/bracelet-allowed-1.webp';
import braceletAllowed2 from '@/assets/examples/bracelet-allowed-2.webp';
import braceletAllowed3 from '@/assets/examples/bracelet-allowed-3.webp';
import braceletNotAllowed1 from '@/assets/examples/bracelet-notallowed-1.webp';
import braceletNotAllowed2 from '@/assets/examples/bracelet-notallowed-2.webp';
import braceletNotAllowed3 from '@/assets/examples/bracelet-notallowed-3.webp';

// Watch examples
import watchAllowed1 from '@/assets/examples/watch-allowed-1.webp';
import watchAllowed2 from '@/assets/examples/watch-allowed-2.webp';
import watchAllowed3 from '@/assets/examples/watch-allowed-3.webp';
import watchNotAllowed1 from '@/assets/examples/watch-notallowed-1.webp';
import watchNotAllowed2 from '@/assets/examples/watch-notallowed-2.webp';
import watchNotAllowed3 from '@/assets/examples/watch-notallowed-3.webp';

// Ring examples
import ringAllowed1 from '@/assets/examples/ring-allowed-1.webp';
import ringAllowed2 from '@/assets/examples/ring-allowed-2.webp';
import ringAllowed3 from '@/assets/examples/ring-allowed-3.webp';
import ringNotAllowed1 from '@/assets/examples/ring-notallowed-1.webp';
import ringNotAllowed2 from '@/assets/examples/ring-notallowed-2.webp';
import ringNotAllowed3 from '@/assets/examples/ring-notallowed-3.webp';

interface ExampleGuidePanelProps {
  categoryName?: string;
  categoryType?: string;
}

const CATEGORY_EXAMPLES: Record<string, { allowed: string[]; notAllowed: string[] }> = {
  necklace: {
    allowed: [necklaceAllowed1, necklaceAllowed2, necklaceAllowed3],
    notAllowed: [necklaceNotAllowed1, necklaceNotAllowed2, necklaceNotAllowed3],
  },
  earrings: {
    allowed: [earringAllowed1, earringAllowed2, earringAllowed3],
    notAllowed: [earringNotAllowed1, earringNotAllowed2, earringNotAllowed3],
  },
  bracelets: {
    allowed: [braceletAllowed1, braceletAllowed2, braceletAllowed3],
    notAllowed: [braceletNotAllowed1, braceletNotAllowed2, braceletNotAllowed3],
  },
  watches: {
    allowed: [watchAllowed1, watchAllowed2, watchAllowed3],
    notAllowed: [watchNotAllowed1, watchNotAllowed2, watchNotAllowed3],
  },
  rings: {
    allowed: [ringAllowed1, ringAllowed2, ringAllowed3],
    notAllowed: [ringNotAllowed1, ringNotAllowed2, ringNotAllowed3],
  },
};

// Default to necklace for other categories until we have their examples
const DEFAULT_EXAMPLES = CATEGORY_EXAMPLES.necklace;

const ExampleGuidePanel = ({ categoryName = 'Jewelry', categoryType = 'earrings' }: ExampleGuidePanelProps) => {
  const examples = CATEGORY_EXAMPLES[categoryType] || DEFAULT_EXAMPLES;
  const isNecklace = categoryType === 'necklace';
  const goodLabel = isNecklace
    ? 'Good examples (jewelry should be worn on person/mannequin)'
    : 'Good examples (jewelry should be worn on person)';
  const badLabel = 'Not Accepted (no product shots please)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 lg:space-y-8"
    >
      {/* Allowed examples */}
      <div className="space-y-3 lg:space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check className="w-3 h-3 text-green-500" />
          </div>
          <span className="text-sm font-medium text-foreground">{goodLabel}</span>
        </div>
      <div className="grid grid-cols-3 gap-3">
          {examples.allowed.map((img, index) => (
            <div
              key={`allowed-${index}`}
              className="relative aspect-[3/4] overflow-hidden border-2 border-green-500/40 bg-muted/20 min-w-0 min-h-[140px] lg:min-h-[180px]"
            >
              <img
                src={img}
                alt={`Good example ${index + 1}`}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-1.5 right-1.5 w-5 h-5 bg-green-500 flex items-center justify-center shadow-lg">
                <Check className="w-3 h-3 text-white" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Not allowed examples */}
      <div className="space-y-3 lg:space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-destructive/20 flex items-center justify-center">
            <X className="w-3 h-3 text-destructive" />
          </div>
          <span className="text-sm font-medium text-foreground">{badLabel}</span>
        </div>
      <div className="grid grid-cols-3 gap-3">
          {examples.notAllowed.map((img, index) => (
            <div
              key={`notallowed-${index}`}
              className="relative aspect-[3/4] overflow-hidden border-2 border-destructive/40 bg-muted/20 min-w-0 min-h-[140px] lg:min-h-[180px]"
            >
              <img
                src={img}
                alt={`Not accepted ${index + 1}`}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-1.5 right-1.5 w-5 h-5 bg-destructive flex items-center justify-center shadow-lg">
                <X className="w-3 h-3 text-white" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default ExampleGuidePanel;
