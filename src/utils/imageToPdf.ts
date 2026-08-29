import { jsPDF } from 'jspdf';

export interface AnswerPageImage {
  id: string;
  file: File;
  previewUrl: string;
  rotation: number; // 0, 90, 180, 270 degrees
  name: string;
  size: number;
}

export interface PdfGenerationOptions {
  pageSize?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  marginMm?: number;
  headerText?: string;
  footerStudentInfo?: string;
  includePageNumbers?: boolean;
}

/**
 * Loads an image from a data URL / Blob URL into an HTMLImageElement
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image for PDF compilation'));
    img.src = src;
  });
}

/**
 * Creates a rotated canvas from an image and returns high-quality JPEG data URL
 */
function getRotatedImageDataUrl(img: HTMLImageElement, rotation: number): { dataUrl: string; width: number; height: number } {
  const normalizedRotation = ((rotation % 360) + 360) % 360;
  
  if (normalizedRotation === 0) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      return {
        dataUrl: canvas.toDataURL('image/jpeg', 0.92),
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
    }
  }

  const canvas = document.createElement('canvas');
  const is90or270 = normalizedRotation === 90 || normalizedRotation === 270;
  canvas.width = is90or270 ? img.naturalHeight : img.naturalWidth;
  canvas.height = is90or270 ? img.naturalWidth : img.naturalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl: img.src, width: img.naturalWidth, height: img.naturalHeight };
  }

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((normalizedRotation * Math.PI) / 180);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Converts an ordered list of images to a perfectly proportional, non-stretched PDF
 */
export async function generatePdfFromImages(
  pages: AnswerPageImage[],
  options: PdfGenerationOptions = {}
): Promise<{ pdfBlob: Blob; pdfBase64: string; pdfUrl: string; totalPages: number }> {
  if (!pages || pages.length === 0) {
    throw new Error('No images provided for PDF generation');
  }

  const {
    marginMm = 10,
    headerText,
    footerStudentInfo,
    includePageNumbers = true,
  } = options;

  // Standard A4: 210mm x 297mm
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const maxContentWidth = pageWidth - marginMm * 2;
  const maxContentHeight = pageHeight - marginMm * 2 - (headerText || footerStudentInfo ? 12 : 0);

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) {
      pdf.addPage('a4', 'portrait');
    }

    const pageItem = pages[i];
    const rawImg = await loadImage(pageItem.previewUrl);
    const { dataUrl, width: imgWidth, height: imgHeight } = getRotatedImageDataUrl(rawImg, pageItem.rotation);

    // Calculate strict aspect-ratio preserving dimensions without stretching or skewing
    const imgAspect = imgWidth / imgHeight;
    const boxAspect = maxContentWidth / maxContentHeight;

    let finalW: number;
    let finalH: number;

    if (imgAspect > boxAspect) {
      // Width is bounding constraint
      finalW = maxContentWidth;
      finalH = maxContentWidth / imgAspect;
    } else {
      // Height is bounding constraint
      finalH = maxContentHeight;
      finalW = maxContentHeight * imgAspect;
    }

    // Perfectly center the image within the printable page bounds
    const startY = marginMm + (headerText ? 6 : 0);
    const posX = marginMm + (maxContentWidth - finalW) / 2;
    const posY = startY + (maxContentHeight - finalH) / 2;

    // Place header text if provided
    if (headerText) {
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139); // Slate-500
      pdf.text(headerText, marginMm, marginMm - 2);
    }

    // Add image onto the PDF page
    pdf.addImage(dataUrl, 'JPEG', posX, posY, finalW, finalH, undefined, 'FAST');

    // Place footer page numbers & candidate info
    if (includePageNumbers || footerStudentInfo) {
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      const footerY = pageHeight - marginMm + 3;

      if (footerStudentInfo) {
        pdf.text(footerStudentInfo, marginMm, footerY);
      }

      if (includePageNumbers) {
        const pageLabel = `Page ${i + 1} of ${pages.length}`;
        pdf.text(pageLabel, pageWidth - marginMm - pdf.getTextWidth(pageLabel), footerY);
      }
    }
  }

  const pdfBlob = pdf.output('blob');
  const pdfBase64 = pdf.output('datauristring');
  const pdfUrl = URL.createObjectURL(pdfBlob);

  return {
    pdfBlob,
    pdfBase64,
    pdfUrl,
    totalPages: pages.length,
  };
}
