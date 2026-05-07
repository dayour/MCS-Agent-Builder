import { callModel } from './modelClient';

const SVG_SYSTEM = `You are an icon generator. Create a multi-layer colored SVG in the Microsoft Fluent System Color style.

RULES:
- 48×48 canvas, viewBox tightly cropped to content
- Structure: nested <svg> elements per color layer, each with x, y, width, height, viewBox
- Every shape uses gradient fills (linear or radial), NEVER flat colors
- 2-4 layers with depth overlays (duplicate path with radial gradient fading to stop-opacity="0")
- Gradient IDs must be unique
- Shapes use smooth bezier curves, rounded corners — no sharp edges
- Keep it simple and recognizable at small sizes (24px)

COLOR PALETTES (choose based on concept):
- People/Social: #9C6CFE→#7A41DC, depth overlay #885EDB(opacity 0)→#E362F8
- Communication/Chat: #0FAFFF→#367AF2 or #0FAFFF→#CC23D1
- Sales/Business: #FF6F47→#FFCD0F (radial), #EB4824 accents
- Documents/Data: #6CE0FF→#4894FE, depth #4A43CB radial
- Security: #0FAFFF→#367AF2→#5750E2→#CC23D1 (4-stop radial)
- Nature/Green: #52D17C→#22918B with #0A1852 depth overlay at 0.4 opacity
- AI/Creative: #8C48FF→#F2598A→#FFB152 (3-stop radial)
- Tools/Work: #2BDABE→#0067BF or #FFA43D→#FB5937
- Awards/Gold: #FFE06B→#FFA43D→#E67505 (radial)
- Alerts/Warm: #FFCD0F→#FE8401

DEPTH TECHNIQUE — render the same path twice:
<g id="Color N">
  <path d="..." fill="url(#primary)"/>
  <path d="..." fill="url(#shadow)" fill-opacity="0.4"/>
</g>
Shadow gradient: radial, dark color fading to stop-opacity="0"

EXAMPLE — heart (1 layer, simple):
<svg viewBox="2 6 44 38" fill="none" xmlns="http://www.w3.org/2000/svg">
<svg x="4" y="8" width="40" height="34" viewBox="0 0 40 34" fill="none">
<path d="M17.26 2.18C13.57-.61 8.51-.73 4.69 1.88C-.96 5.75-1.62 13.83 3.33 18.56L19.14 33.65C19.62 34.11 20.38 34.11 20.87 33.65L36.67 18.56C41.62 13.83 40.96 5.75 35.31 1.88C31.49-.73 26.43-.61 22.73 2.18L20 4.24 17.26 2.18Z" fill="url(#g1)"/>
<defs><linearGradient id="g1" x1="-8.75" y1="-9.71" x2="11.69" y2="34.43" gradientUnits="userSpaceOnUse">
<stop stop-color="#F97DBD"/><stop offset="1" stop-color="#D7257D"/>
</linearGradient></defs></svg></svg>

EXAMPLE — briefcase (4 layers, complex):
<svg viewBox="4 2 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
<svg x="15.91" y="4" width="16.72" height="12.7" viewBox="0 0 16.72 12.7" fill="none">
<path fill-rule="evenodd" clip-rule="evenodd" d="M11.84 0C14.18 0 16.09 1.9 16.09 4.25V8H16.72L8.59 12.7 0 8H.09V4.25C.09 1.9 1.99 0 4.34 0H11.84ZM4.34 2.5C3.37 2.5 2.59 3.28 2.59 4.25V8H13.59V4.25C13.59 3.28 12.8 2.5 11.84 2.5H4.34Z" fill="url(#g1)"/>
<defs><linearGradient id="g1" x1="-.76" y1="1.27" x2="3.76" y2="14.7" gradientUnits="userSpaceOnUse">
<stop stop-color="#0094F0"/><stop offset="1" stop-color="#163697"/>
</linearGradient></defs></svg>
<svg x="6" y="21" width="36" height="19" viewBox="0 0 36 19" fill="none">
<g><path d="M0 0H36V12.75C36 16.2 33.2 19 29.75 19H6.25C2.8 19 0 16.2 0 12.75V0Z" fill="url(#g2)"/>
<path d="M0 0H36V12.75C36 16.2 33.2 19 29.75 19H6.25C2.8 19 0 16.2 0 12.75V0Z" fill="url(#g3)"/></g>
<defs><linearGradient id="g2" x1="1.3" y1="3.56" x2="12" y2="38.25" gradientUnits="userSpaceOnUse">
<stop stop-color="#0FAFFF"/><stop offset="1" stop-color="#CC23D1"/>
</linearGradient>
<radialGradient id="g3" cx="0" cy="0" r="1" gradientTransform="translate(18) rotate(90) scale(19 40)" gradientUnits="userSpaceOnUse">
<stop offset=".34" stop-color="#194694"/><stop offset=".75" stop-color="#367AF2" stop-opacity="0"/>
</radialGradient></defs></svg>
<svg x="6" y="12" width="36" height="16" viewBox="0 0 36 16" fill="none">
<path d="M0 6.25C0 2.8 2.8 0 6.25 0H29.75C33.2 0 36 2.8 36 6.25V12.25C36 14.32 34.32 16 32.25 16H3.75C1.68 16 0 14.32 0 12.25V6.25Z" fill="url(#g4)"/>
<defs><linearGradient id="g4" x1="3.6" y1=".66" x2="21.25" y2="20.75" gradientUnits="userSpaceOnUse">
<stop stop-color="#80F1E6"/><stop offset=".55" stop-color="#40C4F5"/><stop offset="1" stop-color="#00A2FA"/>
</linearGradient></defs></svg>
<svg x="20" y="23" width="8" height="8" viewBox="0 0 8 8" fill="none">
<path d="M6 0H2C.9 0 0 .9 0 2V6C0 7.1.9 8 2 8H6C7.1 8 8 7.1 8 6V2C8 .9 7.1 0 6 0Z" fill="url(#g5)"/>
<defs><linearGradient id="g5" x1="4" y1="0" x2="4" y2="8" gradientUnits="userSpaceOnUse">
<stop stop-color="#B8F5FF"/><stop offset=".84" stop-color="#7CECFF"/>
</linearGradient></defs></svg></svg>

Return ONLY raw SVG XML. No markdown, no backticks, no explanation.`;

/** Parse SVGs from raw LLM output */
export function parseSvgResponse(raw: string): string[] {
  const svgs: string[] = [];
  // Try to find complete SVGs with xmlns
  const regex = /<svg[^>]*xmlns[^>]*>[\s\S]*?<\/svg>\s*(?=<svg[^>]*xmlns|$)/gi;
  const matches = raw.match(regex);
  if (matches) {
    for (const m of matches) svgs.push(m.trim());
  } else {
    // Fallback: strip any surrounding text
    const cleaned = raw.replace(/^[\s\S]*?(<svg)/i, '$1').replace(/(<\/svg>)[\s\S]*$/i, '$1').trim();
    if (cleaned.startsWith('<svg')) svgs.push(cleaned);
  }
  return svgs;
}

/** Convert raw SVG XML to a data URL */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

/** Generate a single colored icon SVG for a prompt. Returns a data URL or null. */
export async function generateIcon(prompt: string): Promise<string | null> {
  const result = await callModel({
    model: 'balanced',
    maxTokens: 2000,
    system: SVG_SYSTEM,
    messages: [
      { role: 'user', content: `Create one colored multi-layer icon for: "${prompt}"` },
    ],
  });
  const svgs = parseSvgResponse(result);
  return svgs[0] ? svgToDataUrl(svgs[0]) : null;
}

/** Generate multiple colored icon SVGs. Returns data URLs. */
export async function generateIconVariations(prompt: string, count = 3): Promise<string[]> {
  const result = await callModel({
    model: 'balanced',
    maxTokens: count * 2000,
    system: SVG_SYSTEM,
    messages: [
      { role: 'user', content: `Generate ${count} different colored multi-layer icon variations for: "${prompt}". Each should use different shapes and color palettes. Return all SVGs consecutively, no explanations.` },
    ],
  });
  return parseSvgResponse(result).map(svgToDataUrl);
}
