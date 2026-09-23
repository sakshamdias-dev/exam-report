import { getQuestionPaperStorage, getSubmissionFileStorage, getGradedPaperStorage } from './fileStorage';

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
 * Converts a Base64 data URL string or raw base64 string to a temporary Blob Object URL
 * which provides native browser PDF viewer rendering support.
 */
export function base64ToBlobUrl(base64Data: string | null | undefined): string | null {
  if (!base64Data || typeof base64Data !== 'string') return null;

  try {
    let contentType = 'application/pdf';
    let base64String = base64Data.trim();

    if (base64String.startsWith('data:')) {
      const parts = base64String.split(';base64,');
      if (parts.length >= 2) {
        contentType = (parts[0].split(':')[1]) || 'application/pdf';
        base64String = parts[1];
      } else if (base64String.includes(',')) {
        base64String = base64String.split(',')[1];
      }
    }

    base64String = base64String.replace(/\s/g, ''); // remove any whitespace or linebreaks
    const raw = window.atob(base64String);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);

    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }

    const blob = new Blob([uInt8Array], { type: contentType });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn('Could not convert base64 to Blob URL, falling back:', err);
    return null;
  }
}

/**
 * Decodes a base64 string (data URI or raw base64) into Uint8Array
 */
export function base64ToUint8Array(base64Data: string): Uint8Array | null {
  try {
    let rawStr = base64Data.trim();
    if (rawStr.startsWith('data:')) {
      if (rawStr.includes('base64,')) {
        rawStr = rawStr.split('base64,')[1];
      } else if (rawStr.includes(',')) {
        rawStr = rawStr.split(',')[1];
      }
    }
    const cleanB64 = rawStr.replace(/\s/g, '');
    const binaryStr = window.atob(cleanB64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.warn('Failed to decode base64 string to Uint8Array:', e);
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

  // Priority 1: High-speed server-side proxy (bypasses browser CORS & virus download warnings)
  try {
    const proxyApiUrl = `/api/proxy-pdf?fileId=${encodeURIComponent(cleanId)}${_directUrl ? `&url=${encodeURIComponent(_directUrl)}` : ''}`;
    const resp = await fetch(proxyApiUrl, { method: 'GET' });
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
  } catch (proxyApiErr) {
    console.warn('Local proxy-pdf attempt failed, trying direct & fallback gateways:', proxyApiErr);
  }

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

export interface ResolvedPdfSource {
  bytes: Uint8Array | null;
  blobUrl: string | null;
  dataUri: string | null;
  mimeType: string;
  isPdf: boolean;
  isImage: boolean;
  imageSrc: string | null;
  imagePages: string[];
  totalPages: number;
  sourceType: 'bytes' | 'dataUri' | 'drive' | 'storage' | 'remote' | 'image' | 'unknown';
  error?: string | null;
}

/**
 * Robustly resolves any PDF or image source (Data URI, raw base64, Google Drive URL,
 * IndexedDB storage key, or remote HTTP URL) into Uint8Array bytes and a safe Blob URL.
 */
export async function resolvePdfBytesAndUrl(
  source: string | Uint8Array | null | undefined,
  options?: { examId?: string | null; studentId?: string | null }
): Promise<ResolvedPdfSource> {
  // Case 1: Direct Uint8Array bytes
  if (source instanceof Uint8Array) {
    const check = isPdfOrImageBytes(source);
    const mime = check.mimeType || 'application/pdf';
    const blob = new Blob([source], { type: mime });
    const blobUrl = URL.createObjectURL(blob);
    return {
      bytes: source,
      blobUrl,
      dataUri: uint8ArrayToBase64(source, mime),
      mimeType: mime,
      isPdf: check.isPdf,
      isImage: check.isImage,
      imageSrc: check.isImage ? blobUrl : null,
      imagePages: check.isImage ? [blobUrl] : [],
      totalPages: 1,
      sourceType: 'bytes',
    };
  }

  const rawStr = typeof source === 'string' ? source.trim() : '';

  // Case 2: Image Data URI
  if (rawStr.startsWith('data:image/')) {
    const blobUrl = base64ToBlobUrl(rawStr);
    return {
      bytes: null,
      blobUrl,
      dataUri: rawStr,
      mimeType: rawStr.split(';')[0].replace('data:', '') || 'image/jpeg',
      isPdf: false,
      isImage: true,
      imageSrc: rawStr,
      imagePages: [rawStr],
      totalPages: 1,
      sourceType: 'image',
    };
  }

  // Case 3: PDF Data URI
  if (rawStr.startsWith('data:application/pdf') || rawStr.startsWith('data:')) {
    const bytes = base64ToUint8Array(rawStr);
    if (bytes) {
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      return {
        bytes,
        blobUrl,
        dataUri: rawStr,
        mimeType: 'application/pdf',
        isPdf: true,
        isImage: false,
        imageSrc: null,
        imagePages: [],
        totalPages: 1,
        sourceType: 'dataUri',
      };
    }
  }

  // Case 4: Raw Base64 string without "data:" prefix (e.g. JVBERi0x...)
  if (rawStr.startsWith('JVBERi') || (rawStr.length > 80 && !rawStr.startsWith('http') && !rawStr.includes('/') && !rawStr.includes(':'))) {
    const bytes = base64ToUint8Array(rawStr);
    if (bytes) {
      const check = isPdfOrImageBytes(bytes);
      const mime = check.mimeType || 'application/pdf';
      const blob = new Blob([bytes], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      const dataUri = `data:${mime};base64,${rawStr.replace(/\s/g, '')}`;
      return {
        bytes,
        blobUrl,
        dataUri,
        mimeType: mime,
        isPdf: check.isPdf,
        isImage: check.isImage,
        imageSrc: check.isImage ? dataUri : null,
        imagePages: check.isImage ? [dataUri] : [],
        totalPages: 1,
        sourceType: 'dataUri',
      };
    }
  }

  // Case 5: Google Drive URL
  const driveInfo = getEmbeddablePdfUrl(rawStr);
  if (driveInfo.isDriveUrl && driveInfo.driveFileId) {
    try {
      const driveBinary = await fetchDrivePdfBinary(driveInfo.driveFileId);
      if (driveBinary && driveBinary.bytes) {
        const blob = new Blob([driveBinary.bytes], { type: driveBinary.mimeType });
        const blobUrl = URL.createObjectURL(blob);
        return {
          bytes: driveBinary.bytes,
          blobUrl,
          dataUri: driveBinary.base64Data,
          mimeType: driveBinary.mimeType,
          isPdf: driveBinary.isPdf,
          isImage: driveBinary.isImage,
          imageSrc: driveBinary.isImage ? driveBinary.base64Data : null,
          imagePages: driveBinary.isImage ? [driveBinary.base64Data] : [],
          totalPages: 1,
          sourceType: 'drive',
        };
      }
    } catch (driveErr) {
      console.warn('Could not fetch drive binary:', driveErr);
    }
  }

  // Case 6: Stored file reference or fallback to IndexedDB
  const isStoredRef = rawStr.startsWith('stored://') || rawStr.startsWith('QP_') || rawStr.startsWith('qp_');
  if (isStoredRef || !rawStr) {
    let cleanExamId = options?.examId || (rawStr.startsWith('QP_') ? rawStr.replace(/^QP_/i, '') : null);
    let cleanStudentId = options?.studentId || null;

    if (rawStr.startsWith('stored://')) {
      const match = rawStr.match(/^stored:\/\/(?:submission|graded|qp)\/([^/]+)(?:\/([^/]+))?/i);
      if (match) {
        if (!cleanExamId && match[1]) cleanExamId = match[1];
        if (!cleanStudentId && match[2]) cleanStudentId = match[2];
      }
    }

    if (cleanExamId) {
      // Check graded paper storage if explicitly requested
      if (rawStr.startsWith('stored://graded') && cleanStudentId) {
        try {
          const storedGraded = await getGradedPaperStorage(cleanExamId, cleanStudentId);
          if (storedGraded) {
            const bytes = base64ToUint8Array(storedGraded);
            if (bytes) {
              const blob = new Blob([bytes], { type: 'application/pdf' });
              return {
                bytes,
                blobUrl: URL.createObjectURL(blob),
                dataUri: storedGraded,
                mimeType: 'application/pdf',
                isPdf: true,
                isImage: false,
                imageSrc: null,
                imagePages: [],
                totalPages: 1,
                sourceType: 'storage',
              };
            }
          }
        } catch (e) {
          console.warn('IndexedDB graded paper lookup notice:', e);
        }
      }

      // Check student submission first if studentId provided
      if (cleanStudentId) {
        try {
          const stored = await getSubmissionFileStorage(cleanExamId, cleanStudentId);
          if (stored?.rawImages && stored.rawImages.length > 0) {
            return {
              bytes: null,
              blobUrl: null,
              dataUri: stored.rawImages[0],
              mimeType: 'image/jpeg',
              isPdf: false,
              isImage: true,
              imageSrc: stored.rawImages[0],
              imagePages: stored.rawImages,
              totalPages: stored.rawImages.length,
              sourceType: 'storage',
            };
          }
          if (stored?.pdfBase64) {
            const bytes = base64ToUint8Array(stored.pdfBase64);
            if (bytes) {
              const blob = new Blob([bytes], { type: 'application/pdf' });
              return {
                bytes,
                blobUrl: URL.createObjectURL(blob),
                dataUri: stored.pdfBase64,
                mimeType: 'application/pdf',
                isPdf: true,
                isImage: false,
                imageSrc: null,
                imagePages: [],
                totalPages: 1,
                sourceType: 'storage',
              };
            }
          }
        } catch (e) {
          console.warn('IndexedDB submission lookup notice:', e);
        }
      }

      // Check question paper storage
      try {
        const storedQp = await getQuestionPaperStorage(cleanExamId);
        if (storedQp) {
          const bytes = base64ToUint8Array(storedQp);
          if (bytes) {
            const blob = new Blob([bytes], { type: 'application/pdf' });
            return {
              bytes,
              blobUrl: URL.createObjectURL(blob),
              dataUri: storedQp,
              mimeType: 'application/pdf',
              isPdf: true,
              isImage: false,
              imageSrc: null,
              imagePages: [],
              totalPages: 1,
              sourceType: 'storage',
            };
          }
        }
      } catch (e) {
        console.warn('IndexedDB QP lookup notice:', e);
      }
    }
  }

  // Case 7: Blob URL
  if (rawStr.startsWith('blob:')) {
    try {
      const resp = await fetch(rawStr);
      if (resp.ok) {
        const ab = await resp.arrayBuffer();
        const bytes = new Uint8Array(ab);
        const check = isPdfOrImageBytes(bytes);
        return {
          bytes,
          blobUrl: rawStr,
          dataUri: null,
          mimeType: check.mimeType || 'application/pdf',
          isPdf: check.isPdf,
          isImage: check.isImage,
          imageSrc: check.isImage ? rawStr : null,
          imagePages: check.isImage ? [rawStr] : [],
          totalPages: 1,
          sourceType: 'bytes',
        };
      }
    } catch (_) {}
    return {
      bytes: null,
      blobUrl: rawStr,
      dataUri: null,
      mimeType: 'application/pdf',
      isPdf: true,
      isImage: false,
      imageSrc: null,
      imagePages: [],
      totalPages: 1,
      sourceType: 'remote',
    };
  }

  // Case 8: Direct remote HTTP / HTTPS URL
  if (rawStr.startsWith('http://') || rawStr.startsWith('https://')) {
    try {
      const directResp = await fetch(rawStr, { mode: 'cors' });
      if (directResp.ok) {
        const ab = await directResp.arrayBuffer();
        const bytes = new Uint8Array(ab);
        const check = isPdfOrImageBytes(bytes);
        const mime = check.mimeType || 'application/pdf';
        const blob = new Blob([bytes], { type: mime });
        return {
          bytes,
          blobUrl: URL.createObjectURL(blob),
          dataUri: uint8ArrayToBase64(bytes, mime),
          mimeType: mime,
          isPdf: check.isPdf,
          isImage: check.isImage,
          imageSrc: check.isImage ? rawStr : null,
          imagePages: check.isImage ? [rawStr] : [],
          totalPages: 1,
          sourceType: 'remote',
        };
      }
    } catch (corsErr) {
      console.warn('Direct fetch failed, trying CORS proxies:', corsErr);
    }

    // Try CORS proxies for external non-Drive URLs
    const proxyUrls = [
      `https://corsproxy.io/?url=${encodeURIComponent(rawStr)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(rawStr)}`,
    ];
    for (const proxyUrl of proxyUrls) {
      try {
        const pResp = await fetch(proxyUrl);
        if (pResp.ok) {
          const ab = await pResp.arrayBuffer();
          const bytes = new Uint8Array(ab);
          const check = isPdfOrImageBytes(bytes);
          const mime = check.mimeType || 'application/pdf';
          const blob = new Blob([bytes], { type: mime });
          return {
            bytes,
            blobUrl: URL.createObjectURL(blob),
            dataUri: uint8ArrayToBase64(bytes, mime),
            mimeType: mime,
            isPdf: check.isPdf,
            isImage: check.isImage,
            imageSrc: check.isImage ? rawStr : null,
            imagePages: check.isImage ? [rawStr] : [],
            totalPages: 1,
            sourceType: 'remote',
          };
        }
      } catch (_) {}
    }
  }

  // Fallback: Could not decode binary directly
  return {
    bytes: null,
    blobUrl: rawStr && rawStr.startsWith('http') ? rawStr : null,
    dataUri: rawStr.startsWith('data:') ? rawStr : null,
    mimeType: 'application/pdf',
    isPdf: true,
    isImage: false,
    imageSrc: null,
    imagePages: [],
    totalPages: 1,
    sourceType: 'unknown',
    error: 'Could not resolve document stream.',
  };
}
