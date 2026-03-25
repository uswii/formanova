// Normalise plural or singular jewelry type URL params → singular for PostHog events and API payloads.
// Both forms accepted so routes like /studio/rings and /studio/ring both work.
export const TO_SINGULAR: Record<string, string> = {
  necklace: 'necklace', necklaces: 'necklace',
  earring: 'earring',   earrings: 'earring',
  ring: 'ring',         rings: 'ring',
  bracelet: 'bracelet', bracelets: 'bracelet',
  watch: 'watch',       watches: 'watch',
};
