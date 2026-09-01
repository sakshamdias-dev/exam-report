import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { OsmPageAnnotations, OsmSessionData } from '../types/osm';
import { drawSmoothStrokeOnCanvas } from './strokeHelper';
import { getSubmissionFileStorage } from './fileStorage';

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

      page.drawText('EXAMINATION ANSWER SCRIPT / EVALUATION BOOKLET', {
        x: 40,
        y: pageHeight - 55,
        size: 13,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      page.drawText('Official Digital Submission Record for On-Screen Marking (OSM)', {
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

      page.drawText(`Candidate: ${studentName || studentId}`, {
        x: 35,
        y: pageHeight - 140,
        size: 10,
        font: fontBold,
        color: rgb(0.1, 0.15, 0.25),
      });

      page.drawText(`Roll / Student ID: ${studentId}`, {
        x: 35,
        y: pageHeight - 165,
        size: 10,
        font: fontBold,
        color: rgb(0.0, 0.5, 0.8),
      });

      page.drawText(`Exam Code: ${examId || 'N/A'}`, {
        x: 320,
        y: pageHeight - 140,
        size: 10,
        font: fontBold,
        color: rgb(0.1, 0.15, 0.25),
      });

      page.drawText(`Subject: ${subject || 'General Assessment'}`, {
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
          page.drawText(`[ Question ${lineNum / 4} Candidate Answer Space ]`, {
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

      page.drawText(`Candidate: ${studentName || studentId} (${studentId})  |  Exam: ${examId || 'N/A'}`, {
        x: 35,
        y: pageHeight - 43,
        size: 9,
        font: fontBold,
        color: rgb(0.1, 0.2, 0.35),
      });

      page.drawText(`Page ${pageNum} of ${pageCount}`, {
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
          page.drawText(`[ Answer Page ${pageNum} - Line ${lineNum} ]`, {
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
    page.drawText(`Candidate ID: ${studentId} • On-Screen Marking Booklet • Page ${pageNum} of ${pageCount}`, {
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
 * Generate a Checked PDF with all annotations overlaid on top of original pages or images
 */
export async function generateCheckedPdfBlob(
  originalPdfUrlOrData: string,
  sessionData: OsmSessionData,
  renderedPageDimensions: { width: number; height: number }[],
  imagePages?: string[]
): Promise<string> {
  try {
    let pdfDoc: PDFDocument;

    if (imagePages && imagePages.length > 0) {
      pdfDoc = await PDFDocument.create();
      for (let i = 0; i < imagePages.length; i++) {
        const imgDataUrl = imagePages[i];
        const dim = renderedPageDimensions[i] || { width: 595.28, height: 841.89 };
        const page = pdfDoc.addPage([dim.width, dim.height]);

        if (imgDataUrl) {
          try {
            const isPng = imgDataUrl.includes('image/png');
            const base64Data = imgDataUrl.includes(',') ? imgDataUrl.split(',')[1] : imgDataUrl;
            const binaryString = atob(base64Data);
            const len = binaryString.length;
            const imgBytes = new Uint8Array(len);
            for (let k = 0; k < len; k++) {
              imgBytes[k] = binaryString.charCodeAt(k);
            }

            let embeddedImg;
            if (isPng) {
              embeddedImg = await pdfDoc.embedPng(imgBytes);
            } else {
              embeddedImg = await pdfDoc.embedJpg(imgBytes);
            }

            page.drawImage(embeddedImg, {
              x: 0,
              y: 0,
              width: dim.width,
              height: dim.height,
            });
          } catch (imgEmbedErr) {
            console.warn(`Error embedding student image page ${i + 1} into PDF:`, imgEmbedErr);
          }
        }
      }
    } else {
      // Try loading original PDF bytes
      let originalBytes: ArrayBuffer | null = null;
      if (originalPdfUrlOrData.startsWith('data:application/pdf;base64,')) {
        const base64Data = originalPdfUrlOrData.split(',')[1];
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        originalBytes = bytes.buffer;
      } else if (originalPdfUrlOrData.startsWith('data:')) {
        const base64Data = originalPdfUrlOrData.split(',')[1];
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        originalBytes = bytes.buffer;
      } else {
        try {
          const res = await fetch(originalPdfUrlOrData);
          if (res.ok) {
            originalBytes = await res.arrayBuffer();
          }
        } catch (err) {
          console.warn('Could not fetch original PDF bytes via CORS:', err);
        }
      }

      if (originalBytes) {
        pdfDoc = await PDFDocument.load(originalBytes);
      } else {
        // Create new document with standard pages matching dimensions
        pdfDoc = await PDFDocument.create();
        for (let i = 0; i < sessionData.totalPages; i++) {
          const dim = renderedPageDimensions[i] || { width: 595.28, height: 841.89 }; // A4 default
          pdfDoc.addPage([dim.width, dim.height]);
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
 * Assemble a clean PDF from raw student images or original PDF for teacher's local download
 */
export async function generateStudentBookletPdf(
  originalPdfUrlOrData: string,
  imagePages?: string[],
  fallbackInfo?: { studentId: string; studentName?: string; examId?: string; subject?: string }
): Promise<Blob> {
  try {
    let pdfDoc: PDFDocument;

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
            const isPng = imgDataUrl.includes('image/png');
            const base64Data = imgDataUrl.includes(',') ? imgDataUrl.split(',')[1] : imgDataUrl;
            const binaryString = atob(base64Data);
            const len = binaryString.length;
            const imgBytes = new Uint8Array(len);
            for (let k = 0; k < len; k++) {
              imgBytes[k] = binaryString.charCodeAt(k);
            }

            let embeddedImg;
            if (isPng) {
              embeddedImg = await pdfDoc.embedPng(imgBytes);
            } else {
              embeddedImg = await pdfDoc.embedJpg(imgBytes);
            }

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
          } catch (embedErr) {
            console.warn(`Error embedding image page ${i + 1} into booklet:`, embedErr);
          }
        }
      }
      const pdfBytes = await pdfDoc.save();
      return new Blob([pdfBytes as any], { type: 'application/pdf' });
    }

    if (originalPdfUrlOrData) {
      if (originalPdfUrlOrData.startsWith('data:')) {
        const base64Data = originalPdfUrlOrData.split(',')[1];
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return new Blob([bytes as any], { type: 'application/pdf' });
      }

      try {
        const res = await fetch(originalPdfUrlOrData);
        if (res.ok) {
          const ab = await res.arrayBuffer();
          return new Blob([ab], { type: 'application/pdf' });
        }
      } catch (e) {
        console.warn('Could not fetch PDF URL via CORS:', e);
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

