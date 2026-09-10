import { getStroke } from 'perfect-freehand';
import { OsmNormalizedPoint } from '../types/osm';

/**
 * Convert an array of outline points into an SVG path or Canvas 2D path
 */
export function getSvgPathFromStroke(strokePoints: number[][]): string {
  if (!strokePoints.length) return '';

  const d = strokePoints.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...strokePoints[0], 'Q']
  );

  d.push('Z');
  return d.join(' ');
}

/**
 * Render a smooth stroke onto an HTML5 2D Canvas context
 */
export function drawSmoothStrokeOnCanvas(
  ctx: CanvasRenderingContext2D,
  points: OsmNormalizedPoint[],
  pageWidth: number,
  pageHeight: number,
  options: {
    color: string;
    size: number; // in screen pixels
    opacity?: number;
    isHighlighter?: boolean;
    simulatePressure?: boolean;
  }
) {
  if (!points || points.length === 0) return;

  const rawPoints = points.map((p) => [
    p.x * pageWidth,
    p.y * pageHeight,
    p.pressure !== undefined ? p.pressure : 0.5,
  ]);

  if (rawPoints.length === 1) {
    // Single dot
    const [x, y] = rawPoints[0];
    const radius = options.isHighlighter ? options.size / 2 : Math.max(1.5, options.size / 2);
    ctx.save();
    ctx.fillStyle = options.color;
    ctx.globalAlpha = options.opacity ?? (options.isHighlighter ? 0.35 : 1.0);
    if (options.isHighlighter) {
      ctx.globalCompositeOperation = 'multiply';
    }
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Use perfect-freehand for natural calligraphic/smooth freehand strokes
  const strokeOptions = {
    size: options.size,
    thinning: options.isHighlighter ? 0 : 0.4,
    smoothing: 0.65,
    streamline: 0.55,
    easing: (t: number) => t,
    start: {
      taper: options.isHighlighter ? 0 : 4,
      cap: true,
    },
    end: {
      taper: options.isHighlighter ? 0 : 4,
      cap: true,
    },
    simulatePressure: options.simulatePressure ?? true,
  };

  const outlinePoints = getStroke(rawPoints, strokeOptions);
  if (!outlinePoints || outlinePoints.length < 3) {
    // Fallback to simple bezier line
    ctx.save();
    ctx.strokeStyle = options.color;
    ctx.lineWidth = options.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = options.opacity ?? (options.isHighlighter ? 0.35 : 1.0);
    if (options.isHighlighter) ctx.globalCompositeOperation = 'multiply';

    ctx.beginPath();
    ctx.moveTo(rawPoints[0][0], rawPoints[0][1]);
    for (let i = 1; i < rawPoints.length - 1; i++) {
      const xc = (rawPoints[i][0] + rawPoints[i + 1][0]) / 2;
      const yc = (rawPoints[i][1] + rawPoints[i + 1][1]) / 2;
      ctx.quadraticCurveTo(rawPoints[i][0], rawPoints[i][1], xc, yc);
    }
    ctx.lineTo(rawPoints[rawPoints.length - 1][0], rawPoints[rawPoints.length - 1][1]);
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.fillStyle = options.color;
  ctx.globalAlpha = options.opacity ?? (options.isHighlighter ? 0.35 : 1.0);
  if (options.isHighlighter) {
    ctx.globalCompositeOperation = 'multiply';
  }

  ctx.beginPath();
  ctx.moveTo(outlinePoints[0][0], outlinePoints[0][1]);

  for (let i = 1; i < outlinePoints.length; i++) {
    const [x0, y0] = outlinePoints[i];
    const [x1, y1] = outlinePoints[(i + 1) % outlinePoints.length];
    const midX = (x0 + x1) / 2;
    const midY = (y0 + y1) / 2;
    ctx.quadraticCurveTo(x0, y0, midX, midY);
  }

  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Check if a point is close to any line segment in a stroke (for Eraser tool)
 */
export function isPointNearStroke(
  px: number, // normalized 0-1
  py: number, // normalized 0-1
  strokePoints: OsmNormalizedPoint[],
  thresholdNorm: number = 0.02
): boolean {
  for (let i = 0; i < strokePoints.length; i++) {
    const pt = strokePoints[i];
    const distSq = (pt.x - px) ** 2 + (pt.y - py) ** 2;
    if (distSq <= thresholdNorm ** 2) {
      return true;
    }
  }
  return false;
}
