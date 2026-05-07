/**
 * Maps a file extension to the connector app key used by openFileNatively.
 */
export function extToApp(ext: string): string {
  const map: Record<string, string> = { docx: 'word', xlsx: 'excel', pptx: 'powerpoint', pdf: 'pdf', csv: 'csv', png: 'image' };
  return map[ext] ?? 'file';
}

/**
 * Opens a file natively:
 * - Office files (Word/Excel/PowerPoint): fires the ms-* URI scheme via a
 *   hidden anchor click so the SPA frame is never navigated away.
 * - All other files (PDF, CSV, SharePoint, Outlook, Teams…): opens in a new
 *   browser tab.
 *
 * @param app   Connector key: 'word' | 'excel' | 'powerpoint' | 'onenote' | …
 * @param url   Root-relative path (/demo-files/file.docx) or full URL
 */
export function openFileNatively(app: string, url?: string): void {
  if (!url) return;

  // Resolve root-relative paths to absolute so URI schemes work
  const absoluteUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url;
  const key = app.toLowerCase();

  if (key === 'word' || key === 'excel' || key === 'powerpoint') {
    // Fire the ms-* protocol handler via a hidden anchor so the SPA main frame
    // is never navigated — avoids blank-page risk when Office isn't installed.
    const scheme = key === 'word' ? 'ms-word' : key === 'excel' ? 'ms-excel' : 'ms-powerpoint';
    const link = document.createElement('a');
    link.href = `${scheme}:ofe|u|${absoluteUrl}`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  if (key === 'onenote') {
    window.open(`onenote:${absoluteUrl}`, '_blank');
    return;
  }

  // PDF, CSV, SharePoint, Outlook, Teams, OneDrive, etc. — open in browser tab
  window.open(absoluteUrl, '_blank');
}
