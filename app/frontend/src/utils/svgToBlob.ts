/**
 * Renders a system-color SVG icon onto a canvas and returns it as a PNG Blob.
 * Used to upload agent icons as Entra profile photos.
 *
 * Note: SVGs loaded via <img> cannot execute scripts or reference external resources
 * (fonts, other SVGs, etc.). This works for our simple system-color icons but would
 * fail for complex SVGs with external dependencies.
 *
 * @param svgUrl - Full URL to the SVG file (e.g. /icons/system-color/agents.svg)
 * @param size - Output image size in pixels (square). Default 256.
 * @param bgColor - Background fill color. Default white.
 */
export async function svgToPngBlob(svgUrl: string, size = 256, bgColor = '#FFFFFF'): Promise<Blob> {
  // Fetch the SVG
  const resp = await fetch(svgUrl);
  if (!resp.ok) throw new Error(`Failed to fetch SVG: ${resp.status}`);
  const svgText = await resp.text();

  // Create an image from the SVG
  const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return; }

      // Fill background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);

      // Draw icon centered with padding
      const padding = size * 0.15;
      const iconSize = size - padding * 2;
      ctx.drawImage(img, padding, padding, iconSize, iconSize);

      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob returned null'));
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG as image'));
    };
    img.src = url;
  });
}
