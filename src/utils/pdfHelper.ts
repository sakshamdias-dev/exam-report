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
