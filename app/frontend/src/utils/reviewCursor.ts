/**
 * Cursor save/restore utilities for the HA review state.
 *
 * The instructions editor is re-keyed (remounted) when review highlights are
 * added or removed, which destroys and recreates the DOM. These helpers
 * save the caret position before the re-key and restore it after — skipping
 * data-review-deleted subtrees so the offset reflects only visible content.
 */

/** Returns the character offset of the caret within `root`, skipping data-review-deleted subtrees. */
export function saveCursorOffset(root: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return -1;
  const range = sel.getRangeAt(0);
  let offset = 0;
  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      if ((node as HTMLElement).hasAttribute('data-review-deleted')) return false;
      for (const child of Array.from(node.childNodes)) {
        if (walk(child)) return true;
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      if (node === range.startContainer) {
        offset += range.startOffset;
        return true;
      }
      offset += (node.textContent || '').length;
    }
    return false;
  };
  const found = walk(root);
  return found ? offset : -1;
}

/** Restores the caret to `offset` characters into `root`, skipping data-review-deleted subtrees. */
export function restoreCursorOffset(root: HTMLElement, offset: number): void {
  if (offset < 0) return;
  let remaining = offset;
  let found = false;
  const walk = (node: Node): void => {
    if (found) return;
    if (node.nodeType === Node.ELEMENT_NODE) {
      if ((node as HTMLElement).hasAttribute('data-review-deleted')) return;
      for (const child of Array.from(node.childNodes)) walk(child);
    } else if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent || '').length;
      if (remaining <= len) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        found = true;
      } else {
        remaining -= len;
      }
    }
  };
  walk(root);
  if (!found) {
    // Offset past end — collapse to end of root
    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }
}
