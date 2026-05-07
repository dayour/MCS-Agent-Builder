import { callModel } from './modelClient';

/**
 * Returns 6 autocomplete completions for the user's partial prompt.
 * Each completion starts with the exact typed text, then completes it
 * with a different business automation scenario.
 */
export async function generatePromptSuggestions(
  partialInput: string,
): Promise<string[]> {
  const trimmed = partialInput.trim();
  if (!trimmed) return [];

  // Sanitize before inserting into the prompt — strip newlines and replace
  // double-quotes so adversarial input cannot escape the quoted context.
  const sanitized = trimmed.replace(/[\r\n]+/g, ' ').replace(/"/g, "'");

  try {
    const text = await callModel({
      model: 'fast',
      maxTokens: 300,
      system: `You are an autocomplete engine for a business automation platform. Complete the user's partial prompt in 6 different ways.

Rules:
- Each completion MUST begin with the user's EXACT typed text, character for character
- Add a specific ending (5-12 words) covering a different domain each time: customer service, HR, sales, IT, operations, finance, legal, etc.
- One completion per line — no numbers, no bullets, no extra formatting`,
      messages: [
        {
          role: 'user',
          content: `"${sanitized}"`,
        },
      ],
    });

    if (typeof text !== 'string' || !text) return [];
    const prefixLower = trimmed.toLowerCase();
    return text
      .split('\n')
      .map(l => l.trim().replace(/^\d+[.)]\s*/, '').replace(/^[-•*]\s*/, ''))
      .filter(l => l.length > 0 && l.toLowerCase().startsWith(prefixLower))
      .slice(0, 6);
  } catch (err) {
    console.error('[generatePromptSuggestions] Failed:', err);
    return [];
  }
}
