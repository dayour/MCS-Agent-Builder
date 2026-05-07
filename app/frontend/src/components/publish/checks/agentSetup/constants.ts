export const DEFAULT_NAMES = ['new agent', 'untitled', 'untitled agent'];

// Local publish-readiness safety limit until a platform-wide source of truth exists.
export const MAX_INSTRUCTION_LENGTH = 8000;

export const PLACEHOLDER_PATTERNS = [
  /^enter\s+(your\s+)?instructions\s+here$/i,
  /^add\s+(your\s+)?instructions$/i,
  /^todo\b/i,
  /^placeholder$/i,
  /^replace\s+this/i,
  /^your\s+instructions\s+go\s+here$/i,
  /^type\s+(your\s+)?instructions$/i,
  /^instructions?\s*$/i,
  /^test$/i,
  /^asdf$/i,
  /^lorem ipsum/i,
];