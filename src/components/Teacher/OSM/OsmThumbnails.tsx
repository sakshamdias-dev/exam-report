import React from 'react';
import { ChevronLeft, ChevronRight, FileText, CheckCircle, Edit3 } from 'lucide-react';
import { OsmPageAnnotations } from '../../../types/osm';

interface OsmThumbnailsProps {
  totalPages: number;
  currentPage: number;
  isOpen: boolean;
  annotationsPerPage: Record<number, OsmPageAnnotations>;
  onToggle: () => void;
  onSelectPage: (pageIndex: number) => void;
}

export const OsmThumbnails: React.FC<OsmThumbnailsProps> = ({
  totalPages,
  currentPage,
  isOpen,
  annotationsPerPage,
  onToggle,
  onSelectPage,
}) => {
  return (
    <aside
      className={`bg-slate-900 border-r border-slate-800 transition-all duration-200 flex flex-col shrink-0 select-none z-20 ${
        isOpen ? 'w-48 sm:w-56' : 'w-10'
      }`}
    >
      {/* Header */}
      <div className="p-2 border-b border-slate-800 flex items-center justify-between">
        {isOpen && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <FileText className="w-3.5 h-3.5 text-sky-400" />
            <span>Pages ({totalPages})</span>
          </div>
        )}

        <button
          type="button"
          onClick={onToggle}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors ml-auto"
          title={isOpen ? 'Collapse Pages' : 'Expand Pages'}
        >
          {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Thumbnails list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {Array.from({ length: totalPages }).map((_, idx) => {
          const isActive = currentPage === idx;
          const pageAnn = annotationsPerPage[idx];
          const strokeCount = (pageAnn?.strokes?.length || 0) + (pageAnn?.highlighters?.length || 0);
          const notesCount = (pageAnn?.texts?.length || 0) + (pageAnn?.stamps?.length || 0);
          const hasAnnotations = strokeCount > 0 || notesCount > 0 || (pageAnn?.shapes?.length || 0) > 0;

          if (!isOpen) {
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectPage(idx)}
                className={`w-full py-2 rounded flex flex-col items-center justify-center transition-colors ${
                  isActive
                    ? 'bg-sky-600 text-white font-bold'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
                title={`Page ${idx + 1}`}
              >
                <span className="text-[11px] font-mono">{idx + 1}</span>
                {hasAnnotations && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1" />
                )}
              </button>
            );
          }

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectPage(idx)}
              className={`w-full text-left p-2.5 rounded-lg border transition-all flex flex-col gap-1.5 ${
                isActive
                  ? 'bg-sky-950/60 border-sky-500 ring-1 ring-sky-500/50'
                  : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className={`font-mono font-bold ${isActive ? 'text-sky-300' : 'text-slate-200'}`}>
                  Page {idx + 1}
                </span>
                {hasAnnotations ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800/60">
                    <CheckCircle className="w-2.5 h-2.5" />
                    <span>Checked</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 italic">Unmarked</span>
                )}
              </div>

              {/* Annotation Metrics */}
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                {hasAnnotations ? (
                  <>
                    <span className="flex items-center gap-1">
                      <Edit3 className="w-2.5 h-2.5 text-sky-400" />
                      <span>{strokeCount + notesCount} marks</span>
                    </span>
                  </>
                ) : (
                  <span>No annotations</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
