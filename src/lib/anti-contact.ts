// Patterns that must be censored
const PATTERNS: RegExp[] = [
  // Phone numbers (Italian + international)
  /(\+?\d[\s\-.]?){7,15}/g,
  // Email addresses
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  // URLs (http, https, www)
  /https?:\/\/[^\s]+/gi,
  /(?<!\S)www\.[^\s]+/gi,
  // Common social handles (@username)
  /@[a-zA-Z0-9_]{2,}/g,
  // WhatsApp / Telegram / Signal mentions
  /\b(whatsapp|telegram|signal|instagram|facebook|tiktok|snapchat)\b/gi,
];

const REPLACEMENT = "***";

/**
 * Returns the censored version of the message content.
 * If no patterns matched, returns the original string unchanged.
 */
export function filterMessage(content: string): string {
  let filtered = content;
  for (const pattern of PATTERNS) {
    filtered = filtered.replace(pattern, REPLACEMENT);
  }
  return filtered;
}

/**
 * Returns true if the original content contained any restricted pattern.
 */
export function detectViolation(content: string): boolean {
  return PATTERNS.some((p) => {
    p.lastIndex = 0; // reset stateful regex
    return p.test(content);
  });
}
