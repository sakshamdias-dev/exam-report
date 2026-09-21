import React from 'react';
import {
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Save,
  CheckCircle2,
  PenTool,
  Highlighter,
  Eraser,
  Type,
  Square,
  Stamp,
  MousePointer,
  ChevronLeft,
  ChevronRight,
  X,
  FileCheck,
  RotateCcw,
  Sparkles,
  Download,
} from 'lucide-react';
import {
  OsmTool,
  OsmShapeType,
  OsmStampType,
  OSM_PEN_COLORS,
  OSM_HIGHLIGHTER_COLORS,
} from '../../../types/osm';

interface OsmToolbarProps {
  studentName?: string;
  studentId: string;
  examId: string;
  subject?: string;
  currentPage: number;
  totalPages: number;
  zoom: number;
  isFullscreen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  activeTool: OsmTool;
  penColor: string;
  penSize: number;
  highlighterColor: string;
  highlighterSize: number;
  shapeType: OsmShapeType;
  shapeWidth: number;
  selectedStamp: OsmStampType;
  isSaving: boolean;
  lastSavedText: string;
  totalAwardedMarks: number | '';
  maxExamMarks: number;
  onToolChange: (tool: OsmTool) => void;
  onPenColorChange: (color: string) => void;
  onPenSizeChange: (size: number) => void;
  onHighlighterColorChange: (color: string) => void;
  onHighlighterSizeChange: (size: number) => void;
  onShapeTypeChange: (shape: OsmShapeType) => void;
  onStampTypeChange: (stamp: OsmStampType) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomFitWidth: () => void;
  onToggleFullscreen: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onGoToPage: (page: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSaveDraft: () => void;
  onFinishChecking: () => void;
  onDownloadBooklet?: () => void;
  onClose: () => void;
}

export const OsmToolbar: React.FC<OsmToolbarProps> = ({
  studentName,
  studentId,
  examId,
  subject,
  currentPage,
  totalPages,
  zoom,
  isFullscreen,
  canUndo,
  canRedo,
  activeTool,
  penColor,
  penSize,
  highlighterColor,
  highlighterSize,
  shapeType,
  shapeWidth,
  selectedStamp,
  isSaving,
  lastSavedText,
  totalAwardedMarks,
  maxExamMarks,
  onToolChange,
  onPenColorChange,
  onPenSizeChange,
  onHighlighterColorChange,
  onHighlighterSizeChange,
  onShapeTypeChange,
  onStampTypeChange,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onZoomFitWidth,
  onToggleFullscreen,
  onPrevPage,
  onNextPage,
  onGoToPage,
  onUndo,
  onRedo,
  onSaveDraft,
  onFinishChecking,
  onDownloadBooklet,
  onClose,
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 select-none shadow-md shrink-0 z-30">
      {/* Row 1: Document & Candidate Info Bar */}
      <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between gap-4 text-xs">
        {/* Left: Candidate & Exam Details */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800/80 font-mono">
              OSM
            </span>
            <span className="font-bold text-slate-100 truncate text-sm">
              {studentName || studentId}
            </span>
            <span className="text-slate-400 font-mono text-[11px]">
              ({studentId})
            </span>
          </div>

          <span className="text-slate-600 hidden sm:inline">•</span>

          <div className="hidden sm:flex items-center gap-2 text-slate-300">
            <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-semibold text-slate-200">
              {examId}
            </span>
            {subject && <span className="truncate max-w-[180px] text-slate-300 font-medium">{subject}</span>}
          </div>
        </div>

        {/* Center: Live Marks Summary */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 px-3 py-1 rounded-md text-xs font-semibold">
            <span className="text-slate-400">Total Marks:</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">
              {totalAwardedMarks !== '' ? totalAwardedMarks : 0}
            </span>
            <span className="text-slate-500 font-mono">/ {maxExamMarks}</span>
          </div>

          {/* Auto-save status */}
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-400">
            {isSaving ? (
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Saving draft...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>{lastSavedText || 'All changes saved'}</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Primary Finish & Close Actions */}
        <div className="flex items-center gap-2">
          {onDownloadBooklet && (
            <button
              type="button"
              onClick={onDownloadBooklet}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              title="Download clean answer booklet PDF to check offline on local machine"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden md:inline">Download Booklet PDF</span>
              <span className="md:hidden">Download</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSaveDraft}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors cursor-pointer"
            title="Save evaluation draft"
          >
            <Save className="w-3.5 h-3.5 text-slate-400" />
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            onClick={onFinishChecking}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-sm cursor-pointer active:scale-95"
            title="Compile checked paper with annotations and finalize marks"
          >
            <FileCheck className="w-4 h-4" />
            <span>Finish Checking</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer ml-1"
            title="Exit OSM interface"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Row 2: Interactive Tool Controls, Annotations Palette, Navigation & Zoom */}
      <div className="px-4 py-1.5 flex items-center justify-between gap-2 overflow-x-auto text-xs">
        {/* Tool Selector Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onToolChange('select')}
            className={`p-2 rounded-md transition-colors flex items-center gap-1 ${
              activeTool === 'select'
                ? 'bg-sky-600 text-white shadow-xs font-bold'
                : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="Select & Move (V)"
          >
            <MousePointer className="w-4 h-4" />
            <span className="hidden lg:inline text-[11px]">Select</span>
          </button>

          {/* Pen Tool */}
          <button
            type="button"
            onClick={() => onToolChange('pen')}
            className={`p-2 rounded-md transition-colors flex items-center gap-1 ${
              activeTool === 'pen'
                ? 'bg-sky-600 text-white shadow-xs font-bold'
                : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="Pen Tool (P) - Smooth Red / Blue / Green marking strokes"
          >
            <PenTool className="w-4 h-4" />
            <span className="hidden lg:inline text-[11px]">Pen</span>
          </button>

          {/* Highlighter Tool */}
          <button
            type="button"
            onClick={() => onToolChange('highlighter')}
            className={`p-2 rounded-md transition-colors flex items-center gap-1 ${
              activeTool === 'highlighter'
                ? 'bg-sky-600 text-white shadow-xs font-bold'
                : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="Highlighter (H) - Transparent text highlighter"
          >
            <Highlighter className="w-4 h-4" />
            <span className="hidden lg:inline text-[11px]">Highlighter</span>
          </button>

          {/* Text Tool */}
          <button
            type="button"
            onClick={() => onToolChange('text')}
            className={`p-2 rounded-md transition-colors flex items-center gap-1 ${
              activeTool === 'text'
                ? 'bg-sky-600 text-white shadow-xs font-bold'
                : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="Text Tool (T) - Click anywhere on paper to type remarks"
          >
            <Type className="w-4 h-4" />
            <span className="hidden lg:inline text-[11px]">Text Note</span>
          </button>

          {/* Shapes Tool */}
          <button
            type="button"
            onClick={() => onToolChange('shape')}
            className={`p-2 rounded-md transition-colors flex items-center gap-1 ${
              activeTool === 'shape'
                ? 'bg-sky-600 text-white shadow-xs font-bold'
                : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="Shapes Tool (S) - Line, Arrow, Rect, Circle, Checkmark, Cross"
          >
            <Square className="w-4 h-4" />
            <span className="hidden lg:inline text-[11px]">Shapes</span>
          </button>

          {/* Stamps Tool */}
          <button
            type="button"
            onClick={() => onToolChange('stamp')}
            className={`p-2 rounded-md transition-colors flex items-center gap-1 ${
              activeTool === 'stamp'
                ? 'bg-sky-600 text-white shadow-xs font-bold'
                : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="Quick Evaluation Stamps (+1, +2, ✓, ✗, Half)"
          >
            <Stamp className="w-4 h-4" />
            <span className="hidden lg:inline text-[11px]">Marks Stamps</span>
          </button>

          {/* Eraser Tool */}
          <button
            type="button"
            onClick={() => onToolChange('eraser')}
            className={`p-2 rounded-md transition-colors flex items-center gap-1 ${
              activeTool === 'eraser'
                ? 'bg-amber-600 text-white shadow-xs font-bold'
                : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="Eraser (E) - Erase teacher annotations only"
          >
            <Eraser className="w-4 h-4" />
            <span className="hidden lg:inline text-[11px]">Eraser</span>
          </button>

          <div className="h-5 w-px bg-slate-700 mx-1" />

          {/* Undo / Redo */}
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded-md hover:bg-slate-800 disabled:opacity-40 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-md hover:bg-slate-800 disabled:opacity-40 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Contextual Properties Palette (Pen Colors / Highlighter Colors / Shapes / Stamps) */}
        <div className="flex items-center gap-3 shrink-0 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
          {activeTool === 'pen' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Pen Color:</span>
              <div className="flex items-center gap-1">
                {OSM_PEN_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => onPenColorChange(c.value)}
                    className={`w-4 h-4 rounded-full transition-transform ${c.bgClass} ${
                      penColor === c.value ? 'ring-2 ring-white scale-125' : 'hover:scale-110 opacity-80'
                    }`}
                    title={c.name}
                  />
                ))}
              </div>
              <div className="h-4 w-px bg-slate-700 mx-0.5" />
              <span className="text-[10px] text-slate-400 font-semibold">Size:</span>
              <select
                value={penSize}
                onChange={(e) => onPenSizeChange(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs px-1.5 py-0.5 focus:outline-none focus:border-sky-500"
              >
                <option value={2}>Fine (2px)</option>
                <option value={3}>Medium (3px)</option>
                <option value={4}>Regular (4px)</option>
                <option value={6}>Thick (6px)</option>
                <option value={8}>Bold (8px)</option>
              </select>
            </div>
          )}

          {activeTool === 'highlighter' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Tint:</span>
              <div className="flex items-center gap-1">
                {OSM_HIGHLIGHTER_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => onHighlighterColorChange(c.value)}
                    className={`w-4 h-4 rounded-full transition-transform ${c.bgClass} ${
                      highlighterColor === c.value ? 'ring-2 ring-white scale-125' : 'hover:scale-110 opacity-80'
                    }`}
                    title={c.name}
                  />
                ))}
              </div>
              <div className="h-4 w-px bg-slate-700 mx-0.5" />
              <span className="text-[10px] text-slate-400 font-semibold">Width:</span>
              <select
                value={highlighterSize}
                onChange={(e) => onHighlighterSizeChange(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs px-1.5 py-0.5 focus:outline-none focus:border-sky-500"
              >
                <option value={14}>Narrow (14px)</option>
                <option value={20}>Standard (20px)</option>
                <option value={28}>Wide (28px)</option>
                <option value={36}>Extra Wide (36px)</option>
              </select>
            </div>
          )}

          {activeTool === 'shape' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Shape:</span>
              <div className="flex items-center gap-1">
                {(['tick', 'cross', 'line', 'arrow', 'rect', 'circle'] as OsmShapeType[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => onShapeTypeChange(st)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize transition-colors ${
                      shapeType === st ? 'bg-sky-600 text-white' : 'hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {st === 'tick' ? '✓ Tick' : st === 'cross' ? '✗ Cross' : st}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTool === 'stamp' && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Stamp:</span>
              <div className="flex items-center gap-1">
                {(
                  [
                    { type: 'plus1', label: '+1' },
                    { type: 'plus2', label: '+2' },
                    { type: 'plus3', label: '+3' },
                    { type: 'plus4', label: '+4' },
                    { type: 'plus5', label: '+5' },
                    { type: 'half', label: '½' },
                    { type: 'zero', label: '0' },
                    { type: 'correct', label: '✓ Correct' },
                    { type: 'wrong', label: '✗ Wrong' },
                  ] as { type: OsmStampType; label: string }[]
                ).map((s) => (
                  <button
                    key={s.type}
                    type="button"
                    onClick={() => onStampTypeChange(s.type)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                      selectedStamp === s.type
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTool === 'text' && (
            <div className="flex items-center gap-2 text-slate-300 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Click anywhere on the answer paper to place a comment box</span>
            </div>
          )}

          {activeTool === 'select' && (
            <div className="flex items-center gap-2 text-slate-400 text-[11px]">
              <span>Click any text or shape to drag, edit, or delete</span>
            </div>
          )}

          {activeTool === 'eraser' && (
            <div className="flex items-center gap-2 text-amber-300 text-[11px]">
              <span>Click or drag over annotations to erase them</span>
            </div>
          )}
        </div>

        {/* Page Navigator & Zoom Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Page Navigation */}
          <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
            <button
              type="button"
              onClick={onPrevPage}
              disabled={currentPage <= 0}
              className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="font-mono text-[11px] text-slate-200 font-semibold px-1">
              Page {currentPage + 1} / {totalPages || 1}
            </span>

            <button
              type="button"
              onClick={onNextPage}
              disabled={currentPage >= totalPages - 1}
              className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-700">
            <button
              type="button"
              onClick={onZoomOut}
              className="p-1 rounded hover:bg-slate-700 text-slate-300"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onZoomReset}
              className="px-1.5 py-0.5 text-[11px] font-mono text-slate-200 font-semibold hover:bg-slate-700 rounded"
              title="Reset Zoom to 100%"
            >
              {Math.round(zoom * 100)}%
            </button>

            <button
              type="button"
              onClick={onZoomIn}
              className="p-1 rounded hover:bg-slate-700 text-slate-300"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onZoomFitWidth}
              className="px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700 rounded font-semibold"
              title="Fit to Window Width"
            >
              Fit
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </header>
  );
};
