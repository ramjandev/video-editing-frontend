import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getMediaUrl } from "./api";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Robust cross-origin & direct media file downloader.
 * Fetches content as blob to force browser "Save As" file download dialog
 * rather than opening inside a new tab.
 */
export async function downloadMediaFile(url?: string | null, suggestedName?: string): Promise<boolean> {
  if (!url) return false;

  const fullUrl = getMediaUrl(url);
  const cleanUrl = fullUrl.split('?')[0] || '';
  const urlParts = cleanUrl.split('/');
  const defaultFilename = urlParts[urlParts.length - 1] || `video_${Date.now()}.mp4`;
  const filename = (suggestedName || defaultFilename).replace(/[/\\?%*:|"<>]/g, '_');

  try {
    const response = await fetch(fullUrl, { credentials: 'omit' });
    if (!response.ok) {
      throw new Error(`Download HTTP error: ${response.status}`);
    }
    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => window.URL.revokeObjectURL(objectUrl), 2000);
    return true;
  } catch (err) {
    console.warn('Direct blob fetch failed, falling back to window anchor click:', err);
    // Fallback: direct anchor with download attribute
    const a = document.createElement('a');
    a.href = fullUrl;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }
}
