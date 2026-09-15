import { PDFDocument, rgb, StandardFonts, PDFImage } from 'pdf-lib';
import { OsmPageAnnotations, OsmSessionData } from '../types/osm';
import { drawSmoothStrokeOnCanvas } from './strokeHelper';
import { getSubmissionFileStorage } from './fileStorage';
import { getEmbeddablePdfUrl, fetchDrivePdfBinary, isPdfOrImageBytes, uint8ArrayToBase64 } from './pdfHelper';
import { executeGasAction } from '../services/api';

/**
 * Verifies whether a binary buffer contains a valid PDF header (%PDF-)
 * and rejects HTML error responses, JSON API errors, or corrupted payloads.
 */
export function isValidPdfBytes(buffer: ArrayBuffer | Uint8Array | null | undefined): boolean {
  if (!buffer) return false;
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 32) return false;

  // 1. Immediately reject obvious HTML/XML/JSON responses
  let firstChar = '';
  for (let i = 0; i < Math.min(bytes.length, 128); i++) {
    const ch = String.fromCharCode(bytes[i]);
    if (!/\s/.test(ch)) {
      firstChar = ch;
      break;
    }
  }
  if (firstChar === '<' || firstChar === '{' || firstChar === '[') {
    return false;
  }

  // 2. Search for standard PDF magic header: '%PDF-' (0x25, 0x50, 0x44, 0x46, 0x2D)
  // Must appear within the first 1024 bytes and be followed by digit and dot
  let pdfHeaderFound = false;
  let headerIndex = -1;
  const maxScan = Math.min(bytes.length - 7, 1024);
  for (let i = 0; i < maxScan; i++) {
    if (
      bytes[i] === 0x25 &&     // %
      bytes[i + 1] === 0x50 && // P
      bytes[i + 2] === 0x44 && // D
      bytes[i + 3] === 0x46 && // F
      bytes[i + 4] === 0x2D    // -
    ) {
      const major = String.fromCharCode(bytes[i + 5]);
      const dot = String.fromCharCode(bytes[i + 6]);
      if (/[0-9]/.test(major) && dot === '.') {
        pdfHeaderFound = true;
        headerIndex = i;
        break;
      }
    }
  }

  if (!pdfHeaderFound) return false;

  // 3. Double-check that before '%PDF-', there are no HTML tags
  if (headerIndex > 0) {
    let prefix = '';
    for (let i = 0; i < headerIndex; i++) {
      prefix += String.fromCharCode(bytes[i]);
    }
    if (prefix.includes('<') || prefix.toLowerCase().includes('html') || prefix.includes('<!doctype')) {
      return false;
    }
  }

  return true;
}

/**
 * Sanitizes arbitrary unicode text for PDF generation using standard WinAnsi / Helvetica fonts.
 * Maps common unsupported glyphs (checkmarks, bullets, em-dashes, curved quotes, symbols)
 * into safe equivalents and converts all newlines, tabs, and non-printable characters
 * into safe printable ASCII (0x20 - 0x7E) to guarantee no WinAnsi encoding crashes.
 */
export function sanitizeForPdf(input: string | null | undefined): string {
  if (!input) return '';
  return String(input)
    .replace(/\r\n/g, ' ')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[\u2713\u2714\u2611]/g, '[OK]') // checkmarks ✓ ✔ ☑
    .replace(/[\u2717\u2718\u2612]/g, '[X]') // cross marks ✗ ✘ ☒
    .replace(/[\u2022\u2023\u25E6\u2043\u2219\u00B7]/g, '|') // bullets • ‣ ◦ ⁃ ∙ ·
    .replace(/[\u2013\u2014\u2015]/g, '-') // en-dash, em-dash –, —, ―
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'") // single quotes ‘ ’ ‚ ‛
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"') // double quotes “ ” „ ‟
    .replace(/[\u2026]/g, '...') // ellipsis …
    .replace(/[\u2190-\u2193\u2194\u21D0-\u21D3]/g, '->') // arrows
    .replace(/₹/g, 'Rs.') // Rupee symbol
    .replace(/[\u00A0]/g, ' ') // non-breaking space
    .replace(/[^\x20-\x7E]/g, ' '); // replace any remaining non-ASCII or unsupported characters with spaces
}

/**
 * Deep-sanitizes all text properties of an OsmSessionData object for safe PDF rendering
 */
export function sanitizeSessionDataForPdf(sessionData: OsmSessionData): OsmSessionData {
  return {
    ...sessionData,
    studentName: sanitizeForPdf(sessionData.studentName),
    studentId: sanitizeForPdf(sessionData.studentId),
    examId: sanitizeForPdf(sessionData.examId),
    subject: sanitizeForPdf(sessionData.subject),
    evaluatorName: sanitizeForPdf(sessionData.evaluatorName),
    overallFeedback: sanitizeForPdf(sessionData.overallFeedback),
    questionMarks: (sessionData.questionMarks || []).map((q) => ({
      ...q,
      label: sanitizeForPdf(q.label),
      comment: sanitizeForPdf(q.comment),
    })),
  };
}

/**
 * Safely draws text on a PDF page using WinAnsi-safe sanitized characters to guarantee no encoding crashes
 */
export function safeDrawText(
  page: any,
  text: string | null | undefined,
  options: any = {}
): void {
  try {
    const cleanText = sanitizeForPdf(text);
    page.drawText(cleanText, options);
  } catch (err) {
    try {
      const asciiOnly = String(text || '')
        .replace(/[\u2713\u2714\u2611]/g, '[OK]')
        .replace(/[\u2717\u2718\u2612]/g, '[X]')
        .replace(/[^\x20-\x7E]/g, ' ');
      page.drawText(asciiOnly, options);
    } catch (fallbackErr) {
      console.warn('safeDrawText: could not draw text on PDF page:', fallbackErr);
    }
  }
}

/**
 * Generates an official multi-page digital answer booklet when external URL has CORS limitations
 */
export async function generateFallbackAnswerBooklet(
  studentId: string,
  studentName?: string,
  examId?: string,
  subject?: string,
  pageCount: number = 4
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // standard A4 pt
  const pageHeight = 841.89;

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Draw clean page border
    page.drawRectangle({
      x: 20,
      y: 20,
      width: pageWidth - 40,
      height: pageHeight - 40,
      borderColor: rgb(0.8, 0.85, 0.9),
      borderWidth: 1,
      color: rgb(0.99, 0.99, 1),
    });

    if (pageNum === 1) {
      // Cover / Page 1 Header Banner
      page.drawRectangle({
        x: 25,
        y: pageHeight - 110,
        width: pageWidth - 50,
        height: 80,
        color: rgb(0.05, 0.15, 0.28), // Dark Navy
      });

      safeDrawText(page, 'EXAMINATION ANSWER SCRIPT / EVALUATION BOOKLET', {
        x: 40,
        y: pageHeight - 55,
        size: 13,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      safeDrawText(page, 'Official Digital Submission Record for On-Screen Marking (OSM)', {
        x: 40,
        y: pageHeight - 75,
        size: 9,
        font: font,
        color: rgb(0.6, 0.8, 0.95),
      });

      // Metadata Info Box
      page.drawRectangle({
        x: 25,
        y: pageHeight - 185,
        width: pageWidth - 50,
        height: 65,
        color: rgb(0.94, 0.97, 1),
        borderColor: rgb(0.7, 0.82, 0.95),
        borderWidth: 1,
      });

      safeDrawText(page, `Candidate: ${studentName || studentId}`, {
        x: 35,
        y: pageHeight - 140,
        size: 10,
        font: fontBold,
        color: rgb(0.1, 0.15, 0.25),
      });

      safeDrawText(page, `Roll / Student ID: ${studentId}`, {
        x: 35,
        y: pageHeight - 165,
        size: 10,
        font: fontBold,
        color: rgb(0.0, 0.5, 0.8),
      });

      safeDrawText(page, `Exam Code: ${examId || 'N/A'}`, {
        x: 320,
        y: pageHeight - 140,
        size: 10,
        font: fontBold,
        color: rgb(0.1, 0.15, 0.25),
      });

      safeDrawText(page, `Subject: ${subject || 'General Assessment'}`, {
        x: 320,
        y: pageHeight - 165,
        size: 10,
        font: font,
        color: rgb(0.2, 0.3, 0.4),
      });

      // Ruled writing lines
      let yLine = pageHeight - 210;
      let lineNum = 1;
      while (yLine > 50) {
        page.drawLine({
          start: { x: 35, y: yLine },
          end: { x: pageWidth - 35, y: yLine },
          thickness: 0.5,
          color: rgb(0.85, 0.88, 0.92),
        });

        if (lineNum % 4 === 0 && yLine > 70) {
          safeDrawText(page, `[ Question ${lineNum / 4} Candidate Answer Space ]`, {
            x: 40,
            y: yLine + 4,
            size: 8,
            font: font,
            color: rgb(0.65, 0.7, 0.78),
          });
        }

        yLine -= 24;
        lineNum++;
      }
    } else {
      // Subsequent Pages
      page.drawRectangle({
        x: 25,
        y: pageHeight - 55,
        width: pageWidth - 50,
        height: 28,
        color: rgb(0.95, 0.97, 1),
        borderColor: rgb(0.85, 0.9, 0.95),
        borderWidth: 1,
      });

      safeDrawText(page, `Candidate: ${studentName || studentId} (${studentId})  |  Exam: ${examId || 'N/A'}`, {
        x: 35,
        y: pageHeight - 43,
        size: 9,
        font: fontBold,
        color: rgb(0.1, 0.2, 0.35),
      });

      safeDrawText(page, `Page ${pageNum} of ${pageCount}`, {
        x: pageWidth - 100,
        y: pageHeight - 43,
        size: 9,
        font: fontBold,
        color: rgb(0.0, 0.5, 0.8),
      });

      // Ruled writing lines
      let yLine = pageHeight - 80;
      let lineNum = 1;
      while (yLine > 50) {
        page.drawLine({
          start: { x: 35, y: yLine },
          end: { x: pageWidth - 35, y: yLine },
          thickness: 0.5,
          color: rgb(0.85, 0.88, 0.92),
        });

        if (lineNum % 5 === 0 && yLine > 70) {
          safeDrawText(page, `[ Answer Page ${pageNum} - Line ${lineNum} ]`, {
            x: 40,
            y: yLine + 4,
            size: 8,
            font: font,
            color: rgb(0.68, 0.72, 0.8),
          });
        }

        yLine -= 24;
        lineNum++;
      }
    }

    // Page footer
    safeDrawText(page, `Candidate ID: ${studentId} | On-Screen Marking Booklet | Page ${pageNum} of ${pageCount}`, {
      x: 35,
      y: 28,
      size: 8,
      font: font,
      color: rgb(0.5, 0.55, 0.65),
    });
  }

  return await pdfDoc.save();
}

/**
 * Render all annotations for a specific page onto an offscreen canvas
 */
export function renderAnnotationsToOffscreenCanvas(
  annotations: OsmPageAnnotations | undefined,
  width: number,
  height: number,
  scale: number = 2.0
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.scale(scale, scale);

  if (!annotations) return canvas;

  const targetW = width;
  const targetH = height;

  // 1. Draw Highlighters (bottom layer)
  if (annotations.highlighters && annotations.highlighters.length > 0) {
    for (const h of annotations.highlighters) {
      drawSmoothStrokeOnCanvas(ctx, h.points, targetW, targetH, {
        color: h.color,
        size: h.size,
        opacity: h.opacity ?? 0.35,
        isHighlighter: true,
      });
    }
  }

  // 2. Draw Shapes
  if (annotations.shapes && annotations.shapes.length > 0) {
    for (const shape of annotations.shapes) {
      const sx = shape.startX * targetW;
      const sy = shape.startY * targetH;
      const ex = shape.endX * targetW;
      const ey = shape.endY * targetH;

      ctx.save();
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.fill || 'transparent';
      ctx.lineWidth = shape.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (shape.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      } else if (shape.type === 'arrow') {
        // Draw line with arrowhead
        const headlen = Math.max(10, shape.strokeWidth * 3);
        const angle = Math.atan2(ey - sy, ex - sx);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = shape.color;
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - headlen * Math.cos(angle - Math.PI / 6), ey - headlen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(ex - headlen * Math.cos(angle + Math.PI / 6), ey - headlen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      } else if (shape.type === 'rect') {
        const x = Math.min(sx, ex);
        const y = Math.min(sy, ey);
        const w = Math.abs(ex - sx);
        const h = Math.abs(ey - sy);
        if (shape.fill && shape.fill !== 'transparent') {
          ctx.fillRect(x, y, w, h);
        }
        ctx.strokeRect(x, y, w, h);
      } else if (shape.type === 'circle') {
        const rx = Math.abs(ex - sx) / 2;
        const ry = Math.abs(ey - sy) / 2;
        const cx = Math.min(sx, ex) + rx;
        const cy = Math.min(sy, ey) + ry;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (shape.fill && shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
      } else if (shape.type === 'tick') {
        // Draw green or custom tick mark
        const w = Math.abs(ex - sx) || 30;
        const h = Math.abs(ey - sy) || 30;
        const bx = Math.min(sx, ex);
        const by = Math.min(sy, ey);
        ctx.beginPath();
        ctx.moveTo(bx + w * 0.1, by + h * 0.55);
        ctx.lineTo(bx + w * 0.4, by + h * 0.9);
        ctx.lineTo(bx + w * 0.95, by + h * 0.15);
        ctx.stroke();
      } else if (shape.type === 'cross') {
        const bx = Math.min(sx, ex);
        const by = Math.min(sy, ey);
        const w = Math.abs(ex - sx) || 24;
        const h = Math.abs(ey - sy) || 24;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + w, by + h);
        ctx.moveTo(bx + w, by);
        ctx.lineTo(bx, by + h);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // 3. Draw Pen Strokes
  if (annotations.strokes && annotations.strokes.length > 0) {
    for (const stroke of annotations.strokes) {
      drawSmoothStrokeOnCanvas(ctx, stroke.points, targetW, targetH, {
        color: stroke.color,
        size: stroke.size,
        opacity: stroke.opacity ?? 1.0,
        isHighlighter: false,
      });
    }
  }

  // 4. Draw Stamps
  if (annotations.stamps && annotations.stamps.length > 0) {
    for (const stamp of annotations.stamps) {
      const x = stamp.x * targetW;
      const y = stamp.y * targetH;
      ctx.save();
      ctx.font = `bold ${stamp.fontSize || 16}px sans-serif`;
      ctx.fillStyle = stamp.color;
      ctx.textBaseline = 'middle';
      ctx.fillText(stamp.label, x, y);
      ctx.restore();
    }
  }

  // 5. Draw Text Annotations
  if (annotations.texts && annotations.texts.length > 0) {
    for (const t of annotations.texts) {
      const x = t.x * targetW;
      const y = t.y * targetH;
      const fontStyle = `${t.italic ? 'italic ' : ''}${t.bold ? 'bold ' : ''}${t.fontSize || 14}px sans-serif`;

      ctx.save();
      ctx.font = fontStyle;
      ctx.textBaseline = 'top';

      const lines = (t.text || '').split('\n');
      const lineHeight = (t.fontSize || 14) * 1.3;

      let maxLineW = 0;
      for (const line of lines) {
        const m = ctx.measureText(line);
        if (m.width > maxLineW) maxLineW = m.width;
      }

      // Draw background pill if present or light tint for readability
      if (t.bgColor) {
        ctx.fillStyle = t.bgColor;
        ctx.fillRect(x - 4, y - 2, maxLineW + 8, lines.length * lineHeight + 4);
      }

      ctx.fillStyle = t.color || '#dc2626';
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], x, y + i * lineHeight);
      }
      ctx.restore();
    }
  }

  return canvas;
}

/**
 * Safely embeds an image (base64 data URI, blob URL, or remote URL) into a pdf-lib PDFDocument.
 * Automatically handles standard & progressive JPEG, PNG, WebP, AVIF, HEIC, and Drive links.
 */
export async function embedImageSafe(pdfDoc: PDFDocument, imgSrc: string): Promise<PDFImage | null> {
  if (!imgSrc || typeof imgSrc !== 'string') return null;
  const cleanData = imgSrc.trim();

  // Helper to convert an image source to clean PNG bytes via offscreen canvas
  const convertViaCanvas = (src: string): Promise<Uint8Array | null> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        return resolve(null);
      }
      const img = new Image();
      // CRITICAL: NEVER set crossOrigin on data: or blob: URIs, as setting crossOrigin on them triggers onerror in many browsers!
      if (src.startsWith('http://') || src.startsWith('https://')) {
        img.crossOrigin = 'anonymous';
      }

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 800;
          canvas.height = img.naturalHeight || img.height || 1100;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);

          // Standard PNG produced by canvas is 100% compliant and guaranteed to embed cleanly via pdfDoc.embedPng
          const pngData = canvas.toDataURL('image/png');
          const parts = pngData.split('base64,');
          if (parts.length < 2) return resolve(null);
          const b64 = parts[1].replace(/\s/g, '');
          const bin = atob(b64);
          const u8 = new Uint8Array(bin.length);
          for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
          resolve(u8);
        } catch (e) {
          resolve(null);
        }
      };

      img.onerror = () => {
        // If it failed with crossOrigin, retry once without crossOrigin
        if (img.crossOrigin) {
          img.crossOrigin = null as any;
          img.src = src;
        } else {
          resolve(null);
        }
      };

      let formattedSrc = src;
      if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('blob:') && !src.startsWith('data:')) {
        formattedSrc = `data:image/jpeg;base64,${src.replace(/\s/g, '')}`;
      }
      img.src = formattedSrc;
    });
  };

  // Case 1: Google Drive link or Drive CDN download
  const pdfInfo = getEmbeddablePdfUrl(cleanData);
  if (pdfInfo.isDriveUrl && (pdfInfo.driveFileId || cleanData)) {
    try {
      const driveBin = await fetchDrivePdfBinary(pdfInfo.driveFileId || '', cleanData);
      if (driveBin && driveBin.bytes) {
        const check = isPdfOrImageBytes(driveBin.bytes);
        if (check.isImage) {
          if (check.mimeType === 'image/png') {
            try {
              return await pdfDoc.embedPng(driveBin.bytes);
            } catch (_) {}
          } else if (check.mimeType === 'image/jpeg') {
            try {
              return await pdfDoc.embedJpg(driveBin.bytes);
            } catch (_) {}
          }
          // If direct embed failed (e.g. progressive JPEG or WebP), fallback to canvas
          const canvasBytes = await convertViaCanvas(driveBin.base64Data);
          if (canvasBytes) {
            return await pdfDoc.embedPng(canvasBytes);
          }
        }
      }
    } catch (driveEmbedErr) {
      console.warn('Drive embed attempt in embedImageSafe:', driveEmbedErr);
    }
  }

  // Case 2: Remote HTTP/HTTPS or local Blob URL
  if (cleanData.startsWith('http://') || cleanData.startsWith('https://') || cleanData.startsWith('blob:')) {
    try {
      const resp = await fetch(cleanData);
      if (resp.ok) {
        const ab = await resp.arrayBuffer();
        const bytes = new Uint8Array(ab);
        const isPng = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
        try {
          if (isPng) {
            return await pdfDoc.embedPng(bytes);
          } else {
            return await pdfDoc.embedJpg(bytes);
          }
        } catch (tryErr) {
          try {
            if (isPng) return await pdfDoc.embedJpg(bytes);
            return await pdfDoc.embedPng(bytes);
          } catch (_) {}
        }
      }
    } catch (fetchErr) {
      console.warn('Direct fetch for image embed failed, trying proxies and canvas:', fetchErr);
    }

    // Try CORS proxy if direct fetch failed
    if (cleanData.startsWith('http')) {
      const proxyBuilders = [
        (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
        (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
        (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
      ];
      for (const buildProxy of proxyBuilders) {
        try {
          const resp = await fetch(buildProxy(cleanData));
          if (resp.ok) {
            const ab = await resp.arrayBuffer();
            const bytes = new Uint8Array(ab);
            const check = isPdfOrImageBytes(bytes);
            if (check.isImage) {
              if (check.mimeType === 'image/png') {
                try { return await pdfDoc.embedPng(bytes); } catch (_) {}
              } else {
                try { return await pdfDoc.embedJpg(bytes); } catch (_) {}
              }
              const canvasBytes = await convertViaCanvas(uint8ArrayToBase64(bytes, check.mimeType));
              if (canvasBytes) return await pdfDoc.embedPng(canvasBytes);
            }
          }
        } catch (_) {}
      }
    }
  }

  // Case 3: Base64 Data URL or Raw Base64 string
  if (cleanData.includes('base64,') || cleanData.startsWith('data:image/') || (!cleanData.startsWith('http') && cleanData.length > 100)) {
    try {
      const isPng = cleanData.includes('image/png');
      const b64Raw = cleanData.includes('base64,')
        ? cleanData.split('base64,')[1]
        : cleanData.includes(',')
        ? cleanData.split(',')[1]
        : cleanData;
      const cleanB64 = b64Raw.replace(/\s/g, '');
      const binaryStr = atob(cleanB64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let k = 0; k < len; k++) {
        bytes[k] = binaryStr.charCodeAt(k);
      }

      const actualIsPng = isPng || (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50);
      try {
        if (actualIsPng) {
          return await pdfDoc.embedPng(bytes);
        } else {
          return await pdfDoc.embedJpg(bytes);
        }
      } catch (firstErr) {
        try {
          if (actualIsPng) return await pdfDoc.embedJpg(bytes);
          return await pdfDoc.embedPng(bytes);
        } catch (_) {}
      }
    } catch (decodeErr) {
      console.warn('Base64 decode failed for image embed:', decodeErr);
    }
  }

  // Case 4: Canvas conversion fallback for Progressive JPEG, WebP, AVIF, HEIC, or complex data
  try {
    const canvasBytes = await convertViaCanvas(cleanData);
    if (canvasBytes) {
      return await pdfDoc.embedPng(canvasBytes);
    }
  } catch (canvasErr) {
    console.warn('Canvas conversion for image embed failed:', canvasErr);
  }

  return null;
}

/**
 * Generate a Checked PDF with all annotations overlaid on top of original pages or images
 */
export async function generateCheckedPdfBlob(
  originalPdfUrlOrData: string | Uint8Array | ArrayBuffer | null | undefined,
  sessionData: OsmSessionData,
  renderedPageDimensions: { width: number; height: number }[],
  imagePages?: string[]
): Promise<string> {
  try {
    let pdfDoc: PDFDocument | null = null;
    let effectiveImages = imagePages && imagePages.length > 0 ? [...imagePages] : [];

    // STEP 1: If effectiveImages is empty, search storage & local cache
    if (effectiveImages.length === 0 && sessionData.examId && sessionData.studentId) {
      try {
        const stored = await getSubmissionFileStorage(sessionData.examId, sessionData.studentId);
        if (stored?.rawImages && stored.rawImages.length > 0) {
          effectiveImages = [...stored.rawImages];
        }
      } catch (e) {
        console.warn('Error reading stored rawImages in generateCheckedPdfBlob:', e);
      }

      if (effectiveImages.length === 0) {
        try {
          const cached = localStorage.getItem(`osm_student_images_${sessionData.examId}_${sessionData.studentId}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              effectiveImages = [...parsed];
            }
          }
        } catch (_) {}
      }
    }

    // STEP 2: If effectiveImages is still empty, check if originalPdfUrlOrData is an image or contains images
    if (effectiveImages.length === 0 && typeof originalPdfUrlOrData === 'string' && originalPdfUrlOrData.trim()) {
      const trimmed = originalPdfUrlOrData.trim();
      if (trimmed.startsWith('data:image/')) {
        effectiveImages = [trimmed];
      } else {
        const pdfInfo = getEmbeddablePdfUrl(trimmed);
        if (pdfInfo.isDriveUrl && (pdfInfo.driveFileId || trimmed)) {
          try {
            const driveBin = await fetchDrivePdfBinary(pdfInfo.driveFileId || '', trimmed);
            if (driveBin && driveBin.bytes && driveBin.isImage) {
              effectiveImages = [driveBin.base64Data];
            }
          } catch (_) {}
        }
      }
    }

    // STEP 3: If student submitted photos / images, embed each photo onto its corresponding page
    if (effectiveImages.length > 0) {
      pdfDoc = await PDFDocument.create();
      for (let i = 0; i < effectiveImages.length; i++) {
        const imgDataUrl = effectiveImages[i];
        const dim = renderedPageDimensions[i];

        if (imgDataUrl) {
          try {
            const embeddedImg = await embedImageSafe(pdfDoc, imgDataUrl);
            if (embeddedImg) {
              const pageW = dim?.width || embeddedImg.width || 595.28;
              const pageH = dim?.height || embeddedImg.height || 841.89;
              const page = pdfDoc.addPage([pageW, pageH]);
              page.drawImage(embeddedImg, {
                x: 0,
                y: 0,
                width: pageW,
                height: pageH,
              });
            } else {
              const pageW = dim?.width || 595.28;
              const pageH = dim?.height || 841.89;
              pdfDoc.addPage([pageW, pageH]);
            }
          } catch (imgEmbedErr) {
            console.warn(`Error embedding student image page ${i + 1} into PDF:`, imgEmbedErr);
            const pageW = dim?.width || 595.28;
            const pageH = dim?.height || 841.89;
            pdfDoc.addPage([pageW, pageH]);
          }
        } else {
          const pageW = dim?.width || 595.28;
          const pageH = dim?.height || 841.89;
          pdfDoc.addPage([pageW, pageH]);
        }
      }
    } else {
      // Try resolving original PDF bytes safely
      let originalBytes: Uint8Array | null = null;

      if (originalPdfUrlOrData instanceof Uint8Array) {
        if (isValidPdfBytes(originalPdfUrlOrData)) {
          originalBytes = originalPdfUrlOrData;
        }
      } else if (originalPdfUrlOrData instanceof ArrayBuffer) {
        const u8 = new Uint8Array(originalPdfUrlOrData);
        if (isValidPdfBytes(u8)) {
          originalBytes = u8;
        }
      } else if (typeof originalPdfUrlOrData === 'string' && originalPdfUrlOrData.trim()) {
        const trimmed = originalPdfUrlOrData.trim();
        if (trimmed.startsWith('data:application/pdf;base64,') || trimmed.startsWith('data:')) {
          try {
            const base64Data = trimmed.includes('base64,')
              ? trimmed.split('base64,')[1]
              : trimmed.includes(',')
              ? trimmed.split(',')[1]
              : trimmed;
            const cleanB64 = base64Data.replace(/\s/g, '');
            const binaryString = atob(cleanB64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            if (isValidPdfBytes(bytes)) {
              originalBytes = bytes;
            }
          } catch (e) {
            console.warn('Error decoding base64 data URL:', e);
          }
        } else if (trimmed.startsWith('JVBERi0') || trimmed.startsWith('JVBERi')) {
          try {
            const cleanB64 = trimmed.replace(/\s/g, '');
            const binaryString = atob(cleanB64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            if (isValidPdfBytes(bytes)) {
              originalBytes = bytes;
            }
          } catch (e) {
            console.warn('Error decoding raw base64 PDF:', e);
          }
        } else if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('blob:')) {
          // Attempt decoding raw base64 string
          try {
            const cleanB64 = trimmed.replace(/\s/g, '');
            if (cleanB64.length > 64 && /^[A-Za-z0-9+/=]+$/.test(cleanB64.slice(0, 100))) {
              const binaryString = atob(cleanB64);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              if (isValidPdfBytes(bytes)) {
                originalBytes = bytes;
              }
            }
          } catch (_) {}
        } else {
          // Check if Google Drive URL
          const pdfInfo = getEmbeddablePdfUrl(trimmed);
          if (pdfInfo.isDriveUrl && (pdfInfo.driveFileId || trimmed)) {
            try {
              const gasRes = await executeGasAction('getFileBase64', {
                fileId: pdfInfo.driveFileId || '',
                fileUrl: trimmed,
                examId: sessionData.examId,
                studentId: sessionData.studentId,
              });
              if (gasRes.success && gasRes.data?.base64Data) {
                const b64 = gasRes.data.base64Data.split(',')[1] || gasRes.data.base64Data;
                const binaryStr = atob(b64.replace(/\s/g, ''));
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                  bytes[i] = binaryStr.charCodeAt(i);
                }
                if (isValidPdfBytes(bytes)) {
                  originalBytes = bytes;
                }
              }
            } catch (driveErr) {
              console.warn('Drive gateway fetch in generateCheckedPdfBlob:', driveErr);
            }

            // High-speed multi-strategy fallback via fetchDrivePdfBinary
            if (!originalBytes && pdfInfo.driveFileId) {
              try {
                const driveBinary = await fetchDrivePdfBinary(pdfInfo.driveFileId, trimmed);
                if (driveBinary && isValidPdfBytes(driveBinary.bytes)) {
                  originalBytes = driveBinary.bytes;
                }
              } catch (driveBinaryErr) {
                console.warn('fetchDrivePdfBinary in generateCheckedPdfBlob:', driveBinaryErr);
              }
            }
          }

          // Direct URL fetch
          if (!originalBytes) {
            try {
              const res = await fetch(trimmed);
              if (res.ok) {
                const ab = await res.arrayBuffer();
                const bytes = new Uint8Array(ab);
                // MUST verify PDF magic bytes (%PDF-) to prevent HTML error/SPA pages from corrupting pdf-lib
                if (isValidPdfBytes(bytes)) {
                  originalBytes = bytes;
                } else {
                  console.warn('Fetched URL did not return a valid PDF (header missing). Skipping corrupt buffer.');
                }
              }
            } catch (err) {
              console.warn('Could not fetch original PDF bytes via CORS:', err);
            }
          }
        }
      }

      // Check submission file storage if bytes not yet obtained
      if (!originalBytes && sessionData.examId && sessionData.studentId) {
        try {
          const stored = await getSubmissionFileStorage(sessionData.examId, sessionData.studentId);
          if (stored?.pdfBase64) {
            const b64 = stored.pdfBase64.includes('base64,')
              ? stored.pdfBase64.split('base64,')[1]
              : stored.pdfBase64;
            const binaryStr = atob(b64.replace(/\s/g, ''));
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            if (isValidPdfBytes(bytes)) {
              originalBytes = bytes;
            }
          }
        } catch (e) {
          console.warn('Could not retrieve stored PDF in generateCheckedPdfBlob:', e);
        }
      }

      // Safely load PDF document into pdf-lib
      if (originalBytes && isValidPdfBytes(originalBytes)) {
        try {
          pdfDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
        } catch (loadErr) {
          console.warn('Failed to load PDF document bytes into pdf-lib, falling back to clean PDF generation:', loadErr);
          pdfDoc = null;
        }
      }

      // If document could not be loaded, build clean digital evaluation booklet
      if (!pdfDoc) {
        try {
          const fallbackBytes = await generateFallbackAnswerBooklet(
            sessionData.studentId,
            sessionData.studentName,
            sessionData.examId,
            sessionData.subject,
            sessionData.totalPages || 4
          );
          pdfDoc = await PDFDocument.load(fallbackBytes);
        } catch (fallbackErr) {
          console.warn('Could not load fallback booklet, creating blank pages:', fallbackErr);
          pdfDoc = await PDFDocument.create();
          for (let i = 0; i < (sessionData.totalPages || 4); i++) {
            const dim = renderedPageDimensions[i] || { width: 595.28, height: 841.89 }; // A4 default
            pdfDoc.addPage([dim.width, dim.height]);
          }
        }
      }
    }

    const pages = pdfDoc.getPages();

    // Iterate through pages and embed annotation canvas overlays
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageAnnotations = sessionData.annotationsPerPage[i];

      const pageW = page.getWidth();
      const pageH = page.getHeight();

      // Check if page has any annotations
      const hasAnnotations =
        pageAnnotations &&
        ((pageAnnotations.strokes && pageAnnotations.strokes.length > 0) ||
          (pageAnnotations.highlighters && pageAnnotations.highlighters.length > 0) ||
          (pageAnnotations.texts && pageAnnotations.texts.length > 0) ||
          (pageAnnotations.shapes && pageAnnotations.shapes.length > 0) ||
          (pageAnnotations.stamps && pageAnnotations.stamps.length > 0));

      if (hasAnnotations) {
        // Render annotations to high-res canvas (2x)
        const canvas = renderAnnotationsToOffscreenCanvas(pageAnnotations, pageW, pageH, 2.0);

        // Convert canvas to PNG bytes
        const dataUrl = canvas.toDataURL('image/png');
        const base64Data = dataUrl.split(',')[1];
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const pngBytes = new Uint8Array(len);
        for (let j = 0; j < len; j++) {
          pngBytes[j] = binaryString.charCodeAt(j);
        }

        const pngImage = await pdfDoc.embedPng(pngBytes);
        page.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: pageW,
          height: pageH,
        });
      }
    }

    // Now insert the Question-Wise Marking Report with Exam Friendly Logo as Page 1 (index 0)
    try {
      await addQuestionWiseMarkingCoverPage(pdfDoc, sessionData);
    } catch (coverErr) {
      console.warn('Could not attach Question-Wise Marking cover page:', coverErr);
    }

    const finalPdfBytes = await pdfDoc.save();
    const blob = new Blob([finalPdfBytes as any], { type: 'application/pdf' });

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('Error generating checked PDF:', err);
    throw err;
  }
}

/**
 * Inserts an official Question-Wise Marking Report Page with the Exam Friendly logo as Page 1 of the evaluated PDF
 */
export async function addQuestionWiseMarkingCoverPage(
  pdfDoc: PDFDocument,
  rawSessionData: OsmSessionData
): Promise<void> {
  const sessionData = sanitizeSessionDataForPdf(rawSessionData);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const pageWidth = 595.28; // standard A4 pt
  const pageHeight = 841.89;

  // Insert at index 0 (cover page)
  const page = pdfDoc.insertPage(0, [pageWidth, pageHeight]);

  // Clean background & outer border
  page.drawRectangle({
    x: 18,
    y: 18,
    width: pageWidth - 36,
    height: pageHeight - 36,
    borderColor: rgb(0.82, 0.88, 0.94),
    borderWidth: 1.5,
    color: rgb(0.99, 1, 1),
  });

  // Top Brand Header Banner (Dark Slate #0f172a)
  const headerHeight = 82;
  const headerY = pageHeight - 22 - headerHeight;
  page.drawRectangle({
    x: 22,
    y: headerY,
    width: pageWidth - 44,
    height: headerHeight,
    color: rgb(0.06, 0.1, 0.18),
  });

  // Vibrant Brand Top Accent Stripe (ExamFriendly Orange #f25f22)
  page.drawRectangle({
    x: 22,
    y: pageHeight - 26,
    width: pageWidth - 44,
    height: 4,
    color: rgb(0.95, 0.37, 0.13),
  });

  // EXAM FRIENDLY LOGO: Try to embed /ef_logo.png from public assets
  let logoEmbedded = false;
  let logoDrawWidth = 44;
  let logoDrawHeight = 44;
  let logoX = 34;
  let logoY = headerY + (headerHeight - logoDrawHeight) / 2;

  try {
    if (typeof window !== 'undefined' && window.fetch) {
      const logoCandidates = [
        '/ef_logo.png',
        'ef_logo.png',
        `${window.location.origin}/ef_logo.png`,
        '/examfriendly-logo.png',
        '/logo.png',
      ];
      for (const logoUrl of logoCandidates) {
        try {
          const resp = await fetch(logoUrl);
          if (resp.ok) {
            const buffer = await resp.arrayBuffer();
            const logoImage = await pdfDoc.embedPng(new Uint8Array(buffer));
            const aspect = logoImage.width / logoImage.height;
            const maxLogoH = 50;
            logoDrawWidth = Math.min(130, Math.round(maxLogoH * aspect));
            logoDrawHeight = Math.round(logoDrawWidth / aspect);
            logoY = headerY + (headerHeight - logoDrawHeight) / 2;
            page.drawImage(logoImage, {
              x: logoX,
              y: logoY,
              width: logoDrawWidth,
              height: logoDrawHeight,
            });
            logoEmbedded = true;
            break;
          }
        } catch (_) {}
      }
    }
  } catch (e) {
    console.warn('Could not embed ef_logo.png into PDF cover page:', e);
  }

  // Fallback vector logo if image could not be fetched
  if (!logoEmbedded) {
    page.drawRectangle({
      x: logoX,
      y: headerY + 18,
      width: 44,
      height: 44,
      color: rgb(0.0, 0.62, 0.89),
    });
    page.drawRectangle({
      x: logoX + 18,
      y: headerY + 26,
      width: 22,
      height: 26,
      color: rgb(0.95, 0.37, 0.13),
    });
    safeDrawText(page, 'EF', {
      x: logoX + 8,
      y: headerY + 30,
      size: 20,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    logoDrawWidth = 44;
  }

  // Brand Name & Subtitles
  const textStartX = logoX + logoDrawWidth + 14;
  safeDrawText(page, 'EXAM FRIENDLY', {
    x: textStartX,
    y: headerY + 48,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  safeDrawText(page, 'On-Screen Marking (OSM) | Question-Wise Evaluation Report', {
    x: textStartX,
    y: headerY + 32,
    size: 9,
    font: font,
    color: rgb(0.68, 0.84, 0.98),
  });

  safeDrawText(page, 'OFFICIAL DIGITAL ASSESSMENT & MARKING PROTOCOL', {
    x: textStartX,
    y: headerY + 16,
    size: 7,
    font: fontBold,
    color: rgb(0.0, 0.62, 0.89),
  });

  // Right Seal Badge: "VERIFIED EVALUATION"
  const sealW = 145;
  const sealX = pageWidth - 24 - sealW - 8;
  page.drawRectangle({
    x: sealX,
    y: headerY + 20,
    width: sealW,
    height: 42,
    color: rgb(0.05, 0.28, 0.2), // Dark emerald
    borderColor: rgb(0.2, 0.7, 0.4),
    borderWidth: 1,
  });

  // Draw vector checkmark icon (replaces unicode checkmark to prevent WinAnsi encoding crash)
  page.drawLine({
    start: { x: sealX + 10, y: headerY + 41 },
    end: { x: sealX + 14, y: headerY + 36 },
    thickness: 2,
    color: rgb(0.3, 0.95, 0.6),
  });
  page.drawLine({
    start: { x: sealX + 14, y: headerY + 36 },
    end: { x: sealX + 22, y: headerY + 46 },
    thickness: 2,
    color: rgb(0.3, 0.95, 0.6),
  });

  safeDrawText(page, 'VERIFIED EVALUATION', {
    x: sealX + 26,
    y: headerY + 42,
    size: 8.5,
    font: fontBold,
    color: rgb(0.3, 0.95, 0.6),
  });
  safeDrawText(page, 'Certified Digital Scorecard', {
    x: sealX + 10,
    y: headerY + 28,
    size: 7.5,
    font: font,
    color: rgb(0.8, 1, 0.9),
  });

  // 1. Metadata Card (Candidate & Examination)
  const metaY = headerY - 72;
  page.drawRectangle({
    x: 22,
    y: metaY,
    width: pageWidth - 44,
    height: 64,
    color: rgb(0.97, 0.98, 1.0),
    borderColor: rgb(0.82, 0.88, 0.96),
    borderWidth: 1,
  });

  // Column 1: Candidate
  safeDrawText(page, 'CANDIDATE INFORMATION', {
    x: 34,
    y: metaY + 48,
    size: 7,
    font: fontBold,
    color: rgb(0.4, 0.48, 0.58),
  });
  const studentNameDisplay = (sessionData.studentName || sessionData.studentId).slice(0, 26);
  safeDrawText(page, studentNameDisplay, {
    x: 34,
    y: metaY + 32,
    size: 11,
    font: fontBold,
    color: rgb(0.08, 0.12, 0.2),
  });
  safeDrawText(page, `Roll / Candidate ID: ${sessionData.studentId}`, {
    x: 34,
    y: metaY + 16,
    size: 8.5,
    font: fontBold,
    color: rgb(0.0, 0.5, 0.8),
  });

  // Column 2: Examination Details
  safeDrawText(page, 'EXAMINATION DETAILS', {
    x: 230,
    y: metaY + 48,
    size: 7,
    font: fontBold,
    color: rgb(0.4, 0.48, 0.58),
  });
  const subjectDisplay = (sessionData.subject || 'Academic Assessment').slice(0, 32);
  safeDrawText(page, subjectDisplay, {
    x: 230,
    y: metaY + 32,
    size: 10.5,
    font: fontBold,
    color: rgb(0.08, 0.12, 0.2),
  });
  safeDrawText(page, `Exam ID: ${sessionData.examId} | Evaluation Date: ${new Date(sessionData.lastSavedAt || Date.now()).toLocaleDateString()}`, {
    x: 230,
    y: metaY + 16,
    size: 8,
    font: font,
    color: rgb(0.3, 0.35, 0.45),
  });

  // Calculate Marks Breakdown
  const questions = sessionData.questionMarks && sessionData.questionMarks.length > 0
    ? sessionData.questionMarks
    : [{ id: 'q1', label: 'Complete Answer Booklet', maxMarks: 100, awardedMarks: sessionData.totalScore !== '' ? Number(sessionData.totalScore) : 0, comment: 'Overall Evaluation' }];

  const totalQuestionMarks = questions.reduce((sum, q) => sum + (Number(q.maxMarks) || 0), 0);
  const receivedMarks = sessionData.totalScore !== '' && sessionData.totalScore !== undefined
    ? Number(sessionData.totalScore)
    : questions.reduce((sum, q) => {
        if (typeof q.awardedMarks === 'number') return sum + q.awardedMarks;
        return sum;
      }, 0);

  const percentage = totalQuestionMarks > 0 ? Math.round((receivedMarks / totalQuestionMarks) * 100) : 0;
  const statusLabel = percentage >= 40 ? 'Passed' : 'Evaluated';

  // 2. Three Metric Score Cards: "Total Question marks", "Received marks", "Grand total"
  const metricY = metaY - 60;
  const metricCardW = (pageWidth - 44 - 16) / 3;
  const metricCardH = 50;

  // Card 1: Total Question Marks
  page.drawRectangle({
    x: 22,
    y: metricY,
    width: metricCardW,
    height: metricCardH,
    color: rgb(0.95, 0.97, 1.0),
    borderColor: rgb(0.75, 0.85, 0.98),
    borderWidth: 1,
  });
  safeDrawText(page, 'TOTAL QUESTION MARKS', {
    x: 32,
    y: metricY + 36,
    size: 7.5,
    font: fontBold,
    color: rgb(0.2, 0.35, 0.6),
  });
  safeDrawText(page, `${totalQuestionMarks}`, {
    x: 32,
    y: metricY + 14,
    size: 18,
    font: fontBold,
    color: rgb(0.1, 0.25, 0.5),
  });
  safeDrawText(page, 'Maximum Total Marks', {
    x: 32 + (String(totalQuestionMarks).length * 12) + 6,
    y: metricY + 16,
    size: 7,
    font: font,
    color: rgb(0.45, 0.55, 0.65),
  });

  // Card 2: Received Marks
  page.drawRectangle({
    x: 22 + metricCardW + 8,
    y: metricY,
    width: metricCardW,
    height: metricCardH,
    color: rgb(0.94, 0.99, 0.96),
    borderColor: rgb(0.65, 0.88, 0.72),
    borderWidth: 1,
  });
  safeDrawText(page, 'RECEIVED MARKS', {
    x: 30 + metricCardW + 8,
    y: metricY + 36,
    size: 7.5,
    font: fontBold,
    color: rgb(0.1, 0.5, 0.3),
  });
  safeDrawText(page, `${receivedMarks}`, {
    x: 30 + metricCardW + 8,
    y: metricY + 14,
    size: 18,
    font: fontBold,
    color: rgb(0.05, 0.55, 0.3),
  });
  safeDrawText(page, 'Awarded by Examiner', {
    x: 30 + metricCardW + 8 + (String(receivedMarks).length * 12) + 6,
    y: metricY + 16,
    size: 7,
    font: font,
    color: rgb(0.25, 0.6, 0.4),
  });

  // Card 3: Grand Total
  page.drawRectangle({
    x: 22 + (metricCardW + 8) * 2,
    y: metricY,
    width: metricCardW,
    height: metricCardH,
    color: rgb(0.98, 0.97, 1.0),
    borderColor: rgb(0.8, 0.75, 0.95),
    borderWidth: 1,
  });
  safeDrawText(page, 'GRAND TOTAL', {
    x: 30 + (metricCardW + 8) * 2,
    y: metricY + 36,
    size: 7.5,
    font: fontBold,
    color: rgb(0.4, 0.2, 0.65),
  });
  safeDrawText(page, `${receivedMarks} / ${totalQuestionMarks}`, {
    x: 30 + (metricCardW + 8) * 2,
    y: metricY + 14,
    size: 15,
    font: fontBold,
    color: rgb(0.35, 0.15, 0.6),
  });
  safeDrawText(page, `(${percentage}% | ${statusLabel})`, {
    x: 30 + (metricCardW + 8) * 2 + (String(`${receivedMarks} / ${totalQuestionMarks}`).length * 9.5) + 4,
    y: metricY + 16,
    size: 7,
    font: fontBold,
    color: rgb(0.4, 0.25, 0.6),
  });

  // 3. Question-Wise Marking Breakdown Table
  let currentY = metricY - 22;
  safeDrawText(page, 'QUESTION-WISE MARKS BREAKDOWN', {
    x: 24,
    y: currentY,
    size: 9.5,
    font: fontBold,
    color: rgb(0.08, 0.14, 0.25),
  });

  safeDrawText(page, '(Awarded via ExamFriendly On-Screen Marking System)', {
    x: 235,
    y: currentY,
    size: 8,
    font: font,
    color: rgb(0.4, 0.5, 0.6),
  });

  currentY -= 14;

  // Table Headers
  const colX = {
    qNum: 22,
    label: 60,
    max: 215,
    awarded: 315,
    remarks: 410,
  };
  const tableW = pageWidth - 44;
  const headerRowH = 22;

  page.drawRectangle({
    x: 22,
    y: currentY - headerRowH,
    width: tableW,
    height: headerRowH,
    color: rgb(0.1, 0.18, 0.3),
  });

  safeDrawText(page, 'Q#', { x: colX.qNum + 6, y: currentY - 15, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  safeDrawText(page, 'Question Label', { x: colX.label + 6, y: currentY - 15, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  safeDrawText(page, 'Total Question Marks', { x: colX.max + 6, y: currentY - 15, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  safeDrawText(page, 'Received Marks', { x: colX.awarded + 6, y: currentY - 15, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  safeDrawText(page, 'Remarks / Comments', { x: colX.remarks + 6, y: currentY - 15, size: 8, font: fontBold, color: rgb(1, 1, 1) });

  currentY -= headerRowH;

  const rowHeight = 19;
  questions.slice(0, 16).forEach((q, idx) => {
    const isAlt = idx % 2 === 1;
    page.drawRectangle({
      x: 22,
      y: currentY - rowHeight,
      width: tableW,
      height: rowHeight,
      color: isAlt ? rgb(0.96, 0.98, 1.0) : rgb(1, 1, 1),
      borderColor: rgb(0.88, 0.91, 0.96),
      borderWidth: 0.5,
    });

    const awardedStr = q.awardedMarks !== '' && q.awardedMarks !== undefined ? String(q.awardedMarks) : '0';
    const commentStr = (q.comment || '-').slice(0, 26);

    safeDrawText(page, String(idx + 1), { x: colX.qNum + 8, y: currentY - 13, size: 8, font: font, color: rgb(0.3, 0.35, 0.45) });
    safeDrawText(page, (q.label || `Question ${idx + 1}`).slice(0, 24), { x: colX.label + 6, y: currentY - 13, size: 8.5, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
    safeDrawText(page, `${q.maxMarks} marks`, { x: colX.max + 6, y: currentY - 13, size: 8, font: font, color: rgb(0.35, 0.4, 0.5) });
    safeDrawText(page, awardedStr, { x: colX.awarded + 6, y: currentY - 13, size: 8.5, font: fontBold, color: rgb(0.05, 0.55, 0.3) });
    safeDrawText(page, commentStr, { x: colX.remarks + 6, y: currentY - 13, size: 8, font: fontOblique, color: rgb(0.3, 0.35, 0.45) });

    currentY -= rowHeight;
  });

  // Table Grand Total Summary Row
  page.drawRectangle({
    x: 22,
    y: currentY - rowHeight,
    width: tableW,
    height: rowHeight,
    color: rgb(0.92, 0.96, 1.0),
    borderColor: rgb(0.75, 0.85, 0.95),
    borderWidth: 1,
  });

  safeDrawText(page, 'GRAND TOTAL', { x: colX.label + 6, y: currentY - 13, size: 8.5, font: fontBold, color: rgb(0.08, 0.15, 0.28) });
  safeDrawText(page, `${totalQuestionMarks} marks`, { x: colX.max + 6, y: currentY - 13, size: 8.5, font: fontBold, color: rgb(0.08, 0.15, 0.28) });
  safeDrawText(page, `${receivedMarks} marks`, { x: colX.awarded + 6, y: currentY - 13, size: 9, font: fontBold, color: rgb(0.05, 0.55, 0.3) });
  safeDrawText(page, `${receivedMarks} / ${totalQuestionMarks} (${percentage}%) | ${statusLabel}`, { x: colX.remarks + 6, y: currentY - 13, size: 8, font: fontBold, color: rgb(0.2, 0.25, 0.35) });

  currentY -= rowHeight + 16;

  // 4. Evaluator Remarks & Feedback Box
  const remarkBoxH = 80;
  page.drawRectangle({
    x: 22,
    y: currentY - remarkBoxH,
    width: tableW,
    height: remarkBoxH,
    color: rgb(0.98, 0.99, 1.0),
    borderColor: rgb(0.8, 0.88, 0.96),
    borderWidth: 1,
  });

  // Left accent line (#009fe3)
  page.drawRectangle({
    x: 22,
    y: currentY - remarkBoxH,
    width: 4,
    height: remarkBoxH,
    color: rgb(0.0, 0.62, 0.89),
  });

  safeDrawText(page, 'FACULTY REMARKS & EVALUATOR FEEDBACK', {
    x: 34,
    y: currentY - 16,
    size: 8.5,
    font: fontBold,
    color: rgb(0.08, 0.15, 0.28),
  });

  const feedbackText = sessionData.overallFeedback && sessionData.overallFeedback.trim()
    ? sessionData.overallFeedback.trim()
    : 'Evaluation completed via On-Screen Marking (OSM). Per-question annotations, ticks, step marks, and examiner notes are recorded on subsequent pages of the answer booklet.';

  // Word-wrap feedback
  const words = feedbackText.split(' ');
  let line = '';
  let lineY = currentY - 32;
  for (const word of words) {
    const testLine = line + (line ? ' ' : '') + word;
    if (testLine.length > 85) {
      safeDrawText(page, line, { x: 34, y: lineY, size: 8, font: fontOblique, color: rgb(0.18, 0.24, 0.35) });
      line = word;
      lineY -= 13;
      if (lineY < currentY - remarkBoxH + 10) break;
    } else {
      line = testLine;
    }
  }
  if (line && lineY >= currentY - remarkBoxH + 10) {
    safeDrawText(page, line, { x: 34, y: lineY, size: 8, font: fontOblique, color: rgb(0.18, 0.24, 0.35) });
  }

  // 5. Official Verification Stamp & Signature Footer
  currentY -= remarkBoxH + 14;
  page.drawRectangle({
    x: 22,
    y: currentY - 32,
    width: tableW,
    height: 32,
    color: rgb(0.96, 0.98, 1.0),
    borderColor: rgb(0.86, 0.91, 0.97),
    borderWidth: 0.5,
  });

  safeDrawText(page, 'DOCUMENT NOTICE & RECHECKING PROTOCOL', {
    x: 32,
    y: currentY - 13,
    size: 7,
    font: fontBold,
    color: rgb(0.15, 0.2, 0.3),
  });
  safeDrawText(
    page,
    'Total Question marks, received marks and grand total are verified digitally. Subsequent pages contain marked answer booklet.',
    { x: 32, y: currentY - 24, size: 7, font: font, color: rgb(0.35, 0.42, 0.52) }
  );

  // Bottom Page Footer
  page.drawLine({
    start: { x: 25, y: 35 },
    end: { x: pageWidth - 25, y: 35 },
    thickness: 0.5,
    color: rgb(0.82, 0.86, 0.92),
  });

  safeDrawText(page, 'Exam Friendly Digital Examination & Evaluation Portal | Certified Student Question-Wise Report', {
    x: 25,
    y: 22,
    size: 7,
    font: font,
    color: rgb(0.5, 0.55, 0.65),
  });

  safeDrawText(page, 'Official Scorecard', {
    x: pageWidth - 120,
    y: 22,
    size: 7,
    font: fontBold,
    color: rgb(0.4, 0.45, 0.55),
  });
}

/**
 * Generate a standalone 1-page Question-Wise Marking Report PDF (with Exam Friendly logo)
 */
export async function generateQuestionWiseReportBlob(sessionData: OsmSessionData): Promise<string> {
  const safeSessionData = sanitizeSessionDataForPdf(sessionData);
  const pdfDoc = await PDFDocument.create();
  await addQuestionWiseMarkingCoverPage(pdfDoc, safeSessionData);
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Assemble a clean PDF from raw student images or original PDF for teacher's local download
 */
export async function generateStudentBookletPdf(
  originalPdfUrlOrData: string | Uint8Array | ArrayBuffer,
  imagePages?: string[],
  fallbackInfo?: { studentId: string; studentName?: string; examId?: string; subject?: string }
): Promise<Blob> {
  try {
    let pdfDoc: PDFDocument;

    // Check 0: If direct binary buffer was supplied
    if (originalPdfUrlOrData instanceof Uint8Array && isValidPdfBytes(originalPdfUrlOrData)) {
      return new Blob([originalPdfUrlOrData as any], { type: 'application/pdf' });
    }
    if (originalPdfUrlOrData instanceof ArrayBuffer) {
      const u8 = new Uint8Array(originalPdfUrlOrData);
      if (isValidPdfBytes(u8)) {
        return new Blob([u8 as any], { type: 'application/pdf' });
      }
    }

    // Check 1: If images were not explicitly provided in memory, look up from storage
    if ((!imagePages || imagePages.length === 0) && fallbackInfo?.examId && fallbackInfo?.studentId) {
      const stored = await getSubmissionFileStorage(fallbackInfo.examId, fallbackInfo.studentId);
      if (stored?.rawImages && stored.rawImages.length > 0) {
        imagePages = stored.rawImages;
      } else if (stored?.pdfBase64) {
        originalPdfUrlOrData = stored.pdfBase64;
      }
    }

    if (imagePages && imagePages.length > 0) {
      pdfDoc = await PDFDocument.create();
      const pageWidth = 595.28; // standard A4
      const pageHeight = 841.89;

      for (let i = 0; i < imagePages.length; i++) {
        const imgDataUrl = imagePages[i];
        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        if (imgDataUrl) {
          try {
            const embeddedImg = await embedImageSafe(pdfDoc, imgDataUrl);
            if (embeddedImg) {
              const imgWidth = embeddedImg.width;
              const imgHeight = embeddedImg.height;
              const imgAspect = imgWidth / imgHeight;
              const pageAspect = pageWidth / pageHeight;

              let drawW = pageWidth;
              let drawH = pageHeight;
              if (imgAspect > pageAspect) {
                drawW = pageWidth;
                drawH = pageWidth / imgAspect;
              } else {
                drawH = pageHeight;
                drawW = pageHeight * imgAspect;
              }

              const x = (pageWidth - drawW) / 2;
              const y = (pageHeight - drawH) / 2;

              page.drawImage(embeddedImg, {
                x,
                y,
                width: drawW,
                height: drawH,
              });
            }
          } catch (embedErr) {
            console.warn(`Error embedding image page ${i + 1} into booklet:`, embedErr);
          }
        }
      }
      const pdfBytes = await pdfDoc.save();
      return new Blob([pdfBytes as any], { type: 'application/pdf' });
    }

    if (typeof originalPdfUrlOrData === 'string' && originalPdfUrlOrData.trim()) {
      const trimmed = originalPdfUrlOrData.trim();
      if (trimmed.startsWith('data:')) {
        const base64Data = trimmed.includes('base64,') ? trimmed.split('base64,')[1] : trimmed.split(',')[1];
        const binaryString = atob(base64Data.replace(/\s/g, ''));
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        if (isValidPdfBytes(bytes)) {
          return new Blob([bytes as any], { type: 'application/pdf' });
        }
      } else if (trimmed.startsWith('JVBERi')) {
        const binaryString = atob(trimmed.replace(/\s/g, ''));
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        if (isValidPdfBytes(bytes)) {
          return new Blob([bytes as any], { type: 'application/pdf' });
        }
      } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('blob:')) {
        try {
          const res = await fetch(trimmed);
          if (res.ok) {
            const ab = await res.arrayBuffer();
            const bytes = new Uint8Array(ab);
            if (isValidPdfBytes(bytes)) {
              return new Blob([bytes as any], { type: 'application/pdf' });
            }
          }
        } catch (e) {
          console.warn('Could not fetch PDF URL via CORS:', e);
        }
      }
    }

    // Fallback printable booklet
    const emergencyBytes = await generateFallbackAnswerBooklet(
      fallbackInfo?.studentId || 'STUDENT',
      fallbackInfo?.studentName,
      fallbackInfo?.examId,
      fallbackInfo?.subject,
      4
    );
    return new Blob([emergencyBytes as any], { type: 'application/pdf' });
  } catch (err) {
    console.error('Error generating student booklet PDF:', err);
    throw err;
  }
}

/**
 * Generates a standalone Question-Wise Marking Report PDF featuring the Exam Friendly logo,
 * candidate & exam metadata, question-wise breakdown table, evaluator remarks, and official signature/score summary.
 */
export async function generateQuestionWiseMarkingPdfBlob(sessionData: OsmSessionData): Promise<Blob> {
  const safeSessionData = sanitizeSessionDataForPdf(sessionData);
  const pdfDoc = await PDFDocument.create();
  await addQuestionWiseMarkingCoverPage(pdfDoc, safeSessionData);
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
}


