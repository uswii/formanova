import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

// Necklace examples
import necklaceAllowed1 from '@/assets/examples/necklace-allowed-1.jpg';
import necklaceAllowed2 from '@/assets/examples/necklace-allowed-2.jpg';
import necklaceAllowed3 from '@/assets/examples/necklace-allowed-3.jpg';
import necklaceNotAllowed1 from '@/assets/examples/necklace-notallowed-1.png';
import necklaceNotAllowed2 from '@/assets/examples/necklace-notallowed-2.png';
import necklaceNotAllowed3 from '@/assets/examples/necklace-notallowed-3.png';

// Earring examples
import earringAllowed1 from '@/assets/examples/earring-allowed-1.jpg';
import earringAllowed2 from '@/assets/examples/earring-allowed-2.jpg';
import earringAllowed3 from '@/assets/examples/earring-allowed-3.jpg';
import earringNotAllowed1 from '@/assets/examples/earring-notallowed-1.png';
import earringNotAllowed2 from '@/assets/examples/earring-notallowed-2.png';
import earringNotAllowed3 from '@/assets/examples/earring-notallowed-3.png';

// Bracelet examples
import braceletAllowed1 from '@/assets/examples/bracelet-allowed-1.jpg';
import braceletAllowed2 from '@/assets/examples/bracelet-allowed-2.jpg';
import braceletAllowed3 from '@/assets/examples/bracelet-allowed-3.jpg';
import braceletNotAllowed1 from '@/assets/examples/bracelet-notallowed-1.png';
import braceletNotAllowed2 from '@/assets/examples/bracelet-notallowed-2.png';
import braceletNotAllowed3 from '@/assets/examples/bracelet-notallowed-3.png';

// Watch examples
import watchAllowed1 from '@/assets/examples/watch-allowed-1.jpg';
import watchAllowed2 from '@/assets/examples/watch-allowed-2.jpg';
import watchAllowed3 from '@/assets/examples/watch-allowed-3.png';
import watchNotAllowed1 from '@/assets/examples/watch-notallowed-1.png';
import watchNotAllowed2 from '@/assets/examples/watch-notallowed-2.png';
import watchNotAllowed3 from '@/assets/examples/watch-notallowed-3.png';

// Ring examples
import ringAllowed1 from '@/assets/examples/ring-allowed-1.png';
import ringAllowed2 from '@/assets/examples/ring-allowed-2.png';
import ringAllowed3 from '@/assets/examples/ring-allowed-3.jpg';
import ringNotAllowed1 from '@/assets/examples/ring-notallowed-1.png';
import ringNotAllowed2 from '@/assets/examples/ring-notallowed-2.png';
import ringNotAllowed3 from '@/assets/examples/ring-notallowed-3.png';

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
      className="space-y-6 lg:space-y-10 p-2"
    >
      {/* Allowed examples */}
      <div className="space-y-3 lg:space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check className="w-3 h-3 text-green-500" />
          </div>
          <span className="text-sm font-medium text-foreground">{goodLabel}</span>
        </div>
        <div className="grid grid-cols-3 gap-3 lg:gap-6">
          {examples.allowed.map((img, index) => (
            <div
              key={`allowed-${index}`}
              className="relative aspect-[3/4] rounded-lg overflow-hidden border-2 border-green-500/40 bg-muted/20 p-0.5 lg:p-1 min-w-0"
            >
              <img
                src={img}
                alt={`Good example ${index + 1}`}
                className="w-full h-full object-cover rounded"
              />
              <div className="absolute bottom-1 right-1 lg:bottom-2 lg:right-2 w-5 h-5 lg:w-7 lg:h-7 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                <Check className="w-3 h-3 lg:w-4 lg:h-4 text-white" />
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
        <div className="grid grid-cols-3 gap-3 lg:gap-6">
          {examples.notAllowed.map((img, index) => (
            <div
              key={`notallowed-${index}`}
              className="relative aspect-[3/4] rounded-lg overflow-hidden border-2 border-destructive/40 bg-muted/20 p-0.5 lg:p-1 min-w-0"
            >
              <img
                src={img}
                alt={`Not accepted ${index + 1}`}
                className="w-full h-full object-cover rounded"
              />
              <div className="absolute bottom-1 right-1 lg:bottom-2 lg:right-2 w-5 h-5 lg:w-7 lg:h-7 rounded-full bg-destructive flex items-center justify-center shadow-lg">
                <X className="w-3 h-3 lg:w-4 lg:h-4 text-white" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default ExampleGuidePanel;
