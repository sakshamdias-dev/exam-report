export type OsmTool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'text' | 'shape' | 'stamp';

export type OsmShapeType = 'line' | 'arrow' | 'rect' | 'circle' | 'tick' | 'cross' | 'star';

export type OsmStampType = 'tick' | 'cross' | 'plus1' | 'plus2' | 'plus3' | 'plus4' | 'plus5' | 'half' | 'zero' | 'correct' | 'wrong' | 'explain' | 'recheck';

export interface OsmNormalizedPoint {
  x: number; // 0.0 to 1.0 (relative to page original width)
  y: number; // 0.0 to 1.0 (relative to page original height)
  pressure?: number; // 0.0 to 1.0
}

export interface OsmPenStroke {
  id: string;
  points: OsmNormalizedPoint[];
  color: string;
  size: number; // stroke radius in points/px at 100% scale
  opacity: number;
  createdAt: number;
}

export interface OsmHighlighterStroke {
  id: string;
  points: OsmNormalizedPoint[];
  color: string;
  size: number;
  opacity: number;
  createdAt: number;
}

export interface OsmTextAnnotation {
  id: string;
  x: number; // 0.0 to 1.0
  y: number; // 0.0 to 1.0
  text: string;
  color: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  bgColor?: string;
  createdAt: number;
}

export interface OsmShapeAnnotation {
  id: string;
  type: OsmShapeType;
  startX: number; // 0.0 to 1.0
  startY: number; // 0.0 to 1.0
  endX: number;   // 0.0 to 1.0
  endY: number;   // 0.0 to 1.0
  color: string;
  strokeWidth: number;
  fill?: string;
  createdAt: number;
}

export interface OsmStampAnnotation {
  id: string;
  x: number; // 0.0 to 1.0
  y: number; // 0.0 to 1.0
  stampType: OsmStampType;
  label: string;
  color: string;
  fontSize: number;
  createdAt: number;
}

export interface OsmPageAnnotations {
  pageIndex: number; // 0-indexed
  strokes: OsmPenStroke[];
  highlighters: OsmHighlighterStroke[];
  texts: OsmTextAnnotation[];
  shapes: OsmShapeAnnotation[];
  stamps: OsmStampAnnotation[];
  pageScore?: number;
}

export interface OsmQuestionScore {
  id: string;
  label: string;
  maxMarks: number;
  awardedMarks: number | '';
  comment?: string;
}

export interface OsmSessionData {
  examId: string;
  studentId: string;
  studentName?: string;
  subject?: string;
  totalPages: number;
  annotationsPerPage: Record<number, OsmPageAnnotations>;
  questionMarks: OsmQuestionScore[];
  overallFeedback: string;
  totalScore: number | '';
  isCompleted: boolean;
  lastSavedAt: string;
}

export interface OsmColorOption {
  name: string;
  value: string;
  bgClass: string;
}

export const OSM_PEN_COLORS: OsmColorOption[] = [
  { name: 'Red', value: '#dc2626', bgClass: 'bg-red-600' },
  { name: 'Blue', value: '#2563eb', bgClass: 'bg-blue-600' },
  { name: 'Green', value: '#16a34a', bgClass: 'bg-green-600' },
  { name: 'Black', value: '#0f172a', bgClass: 'bg-slate-900' },
  { name: 'Orange', value: '#ea580c', bgClass: 'bg-orange-600' },
  { name: 'Purple', value: '#9333ea', bgClass: 'bg-purple-600' },
];

export const OSM_HIGHLIGHTER_COLORS: OsmColorOption[] = [
  { name: 'Yellow', value: '#facc15', bgClass: 'bg-yellow-400' },
  { name: 'Green', value: '#4ade80', bgClass: 'bg-green-400' },
  { name: 'Pink', value: '#f472b6', bgClass: 'bg-pink-400' },
  { name: 'Cyan', value: '#38bdf8', bgClass: 'bg-sky-400' },
  { name: 'Orange', value: '#fb923c', bgClass: 'bg-orange-400' },
  { name: 'Purple', value: '#c084fc', bgClass: 'bg-purple-400' },
];

export const OSM_QUICK_COMMENTS = [
  '✓ Correct',
  '✗ Wrong calculation',
  'Good explanation!',
  'Explain this step clearly',
  'Recheck formula & units',
  'Step marks awarded',
  'Incomplete solution',
  'Excellent presentation!',
];
