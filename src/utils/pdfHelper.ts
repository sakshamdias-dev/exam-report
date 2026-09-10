/**
 * PDF URL and Google Drive link helper utilities
 */

export function getEmbeddablePdfUrl(rawUrl: string | null | undefined): {
  embedUrl: string;
  isDriveUrl: boolean;
  driveFileId: string | null;
  directDownloadUrl: string;
} {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      embedUrl: '',
      isDriveUrl: false,
      driveFileId: null,
      directDownloadUrl: '',
    };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      embedUrl: '',
      isDriveUrl: false,
      driveFileId: null,
      directDownloadUrl: '',
    };
  }

  // If Base64 data URL
  if (trimmed.startsWith('data:')) {
    return {
      embedUrl: trimmed,
      isDriveUrl: false,
      driveFileId: null,
      directDownloadUrl: trimmed,
    };
  }

  // Check if it's a Google Drive link
  // Matches:
  // - https://drive.google.com/file/d/FILE_ID/view...
  // - https://drive.google.com/open?id=FILE_ID
  // - https://drive.google.com/uc?id=FILE_ID...
  // - https://drive.google.com/file/d/FILE_ID/preview
  // - https://docs.google.com/file/d/FILE_ID/...
  const driveRegex = /(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?.*?id=)|docs\.google\.com\/(?:file\/d\/))([a-zA-Z0-9_-]{15,})/;
  const match = trimmed.match(driveRegex);

  if (match && match[1]) {
    const fileId = match[1];
    return {
      embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      isDriveUrl: true,
      driveFileId: fileId,
      directDownloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
    };
  }

  // Direct PDF URL - can use directly
  return {
    embedUrl: trimmed,
    isDriveUrl: false,
    driveFileId: null,
    directDownloadUrl: trimmed,
  };
}

/**
 * Converts a Base64 data URL string to a temporary Blob Object URL
 * which provides native browser PDF viewer rendering support.
 */
export function base64ToBlobUrl(base64Data: string | null | undefined): string | null {
  if (!base64Data || typeof base64Data !== 'string') return null;

  try {
    if (!base64Data.startsWith('data:')) return null;

    const parts = base64Data.split(';base64,');
    if (parts.length < 2) return null;

    const contentType = (parts[0].split(':')[1]) || 'application/pdf';
    const base64String = parts[1].replace(/\s/g, ''); // remove any whitespace or linebreaks
    const raw = window.atob(base64String);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);

    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }

    const blob = new Blob([uInt8Array], { type: contentType });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn('Could not convert base64 to Blob URL, falling back to data URL directly:', err);
    return null;
  }
}

/**
 * Converts Uint8Array bytes to a data URI string efficiently in chunks
 */
export function uint8ArrayToBase64(bytes: Uint8Array, mimeType: string = 'application/pdf'): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

/**
 * Inspects magic bytes to verify if buffer is a valid PDF or Image
 */
export function isPdfOrImageBytes(bytes: Uint8Array): {
  isValid: boolean;
  isPdf: boolean;
  isImage: boolean;
  mimeType: string;
} {
  if (!bytes || bytes.length < 10) {
    return { isValid: false, isPdf: false, isImage: false, mimeType: '' };
  }
  // Check PDF (%PDF-)
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { isValid: true, isPdf: true, isImage: false, mimeType: 'application/pdf' };
  }
  // Check JPEG (FF D8 FF)
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { isValid: true, isPdf: false, isImage: true, mimeType: 'image/jpeg' };
  }
  // Check PNG (89 50 4E 47)
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { isValid: true, isPdf: false, isImage: true, mimeType: 'image/png' };
  }
  // Check WebP (RIFF....WEBP)
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { isValid: true, isPdf: false, isImage: true, mimeType: 'image/webp' };
  }
  return { isValid: false, isPdf: false, isImage: false, mimeType: '' };
}

/**
 * Resilient multi-strategy Google Drive binary file downloader.
 * Supports direct download and multiple CORS proxies with virus confirmation bypass.
 */
export async function fetchDrivePdfBinary(
  driveFileId: string,
  _directUrl?: string
): Promise<{
  bytes: Uint8Array;
  base64Data: string;
  mimeType: string;
  isPdf: boolean;
  isImage: boolean;
} | null> {
  const cleanId = (driveFileId || '').trim();
  if (!cleanId) return null;

  // Potential download URLs from Google Drive CDN with bypass confirmation
  const targetUrls = [
    `https://drive.usercontent.google.com/download?id=${cleanId}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${cleanId}&confirm=t`,
    `https://docs.google.com/uc?export=download&id=${cleanId}&confirm=t`,
  ];

  // Try direct fetch first
  for (const url of targetUrls) {
    try {
      const resp = await fetch(url, { method: 'GET', mode: 'cors' });
      if (resp.ok) {
        const ab = await resp.arrayBuffer();
        const bytes = new Uint8Array(ab);
        const check = isPdfOrImageBytes(bytes);
        if (check.isValid) {
          const base64Data = uint8ArrayToBase64(bytes, check.mimeType);
          return {
            bytes,
            base64Data,
            mimeType: check.mimeType,
            isPdf: check.isPdf,
            isImage: check.isImage,
          };
        }
      }
    } catch (_) {}
  }

  // Proxies that allow downloading binary streams from external URLs
  const proxyBuilders = [
    (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  ];

  for (const buildProxy of proxyBuilders) {
    for (const url of targetUrls) {
      try {
        const proxyUrl = buildProxy(url);
        const resp = await fetch(proxyUrl, { method: 'GET' });
        if (resp.ok) {
          const ab = await resp.arrayBuffer();
          const bytes = new Uint8Array(ab);
          const check = isPdfOrImageBytes(bytes);
          if (check.isValid) {
            const base64Data = uint8ArrayToBase64(bytes, check.mimeType);
            return {
              bytes,
              base64Data,
              mimeType: check.mimeType,
              isPdf: check.isPdf,
              isImage: check.isImage,
            };
          }
        }
      } catch (_) {}
    }
  }

  return null;
}
