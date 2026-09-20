import { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { setExporting } from '@/store/editorSlice';
import { addToast } from '@/store/uiSlice';
import { X, Download, CheckCircle2, Zap, Loader2, ExternalLink } from 'lucide-react';
import { getMediaUrl } from '@/lib/api';
import { downloadMediaFile } from '@/lib/utils';

export function ExportModal() {
  const dispatch = useAppDispatch();
  const { isExporting, exportProgress, exportUrl, exportEta, exportStatus } = useAppSelector(
    (state) => state.editor,
  );
  const [isDownloading, setIsDownloading] = useState(false);

  const getFilenameFromUrl = (url?: string | null): string => {
    if (!url || typeof url !== 'string') return `export_${Date.now()}.mp4`;
    const cleanUrl = url.split('?')[0] || '';
    const parts = cleanUrl.split('/uploads/');
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.trim().length > 0) {
      return lastPart.split('/').pop() || lastPart;
    }
    const slashParts = cleanUrl.split('/');
    return slashParts[slashParts.length - 1] || `export_${Date.now()}.mp4`;
  };

  const formatEta = (totalSeconds: number): string => {
    const rounded = Math.max(0, Math.round(totalSeconds));
    if (rounded <= 0) return 'Almost done...';

    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const seconds = rounded % 60;

    if (hours > 0) {
      return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
    }

    if (minutes > 0) {
      return seconds > 0 ? `${minutes} min ${seconds} s` : `${minutes} min`;
    }

    return `${seconds} s`;
  };

  const handleDownload = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!exportUrl || isDownloading) return;

    const filename = getFilenameFromUrl(exportUrl);
    setIsDownloading(true);
    dispatch(addToast({ type: 'info', message: `Starting download for "${filename}"...` }));

    try {
      await downloadMediaFile(exportUrl, filename);
      dispatch(addToast({ type: 'success', message: `Download initiated for "${filename}"!` }));
    } catch (err) {
      console.error('Download error:', err);
      dispatch(addToast({ type: 'error', message: 'Failed to download file directly. Opening in new tab.' }));
      window.open(getMediaUrl(exportUrl), '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  // Automatically trigger download on export completion
  useEffect(() => {
    if (exportUrl && isExporting) {
      handleDownload();
    }
  }, [exportUrl]);

  if (!isExporting) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-md flex flex-col items-center relative overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Top close button */}
        <button
          onClick={() => dispatch(setExporting(false))}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-md transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-500 dark:text-blue-400 mb-4">
          {exportUrl ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
          ) : (
            <Zap className="w-6 h-6 text-blue-500 dark:text-blue-400 animate-pulse" />
          )}
        </div>

        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
          {exportUrl ? 'Export Masterpiece Complete!' : 'Exporting Video Project'}
        </h2>

        {exportUrl ? (
          <div className="flex flex-col items-center w-full mt-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-4">
              Your video was composited and rendered successfully. Ready to save or share!
            </p>

            <div className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-lg p-2.5 mb-4 flex items-center justify-between text-xs">
              <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[240px]">
                {getFilenameFromUrl(exportUrl)}
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                Ready
              </span>
            </div>

            {/* Main Download Button */}
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-2.5 px-6 rounded-lg w-full text-center transition-all shadow-lg hover:shadow-blue-500/25 flex items-center justify-center gap-2 mb-2 cursor-pointer text-sm disabled:opacity-70"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Download Video File
                </>
              )}
            </button>

            {/* Direct Open Link fallback */}
            <a
              href={getMediaUrl(exportUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 mb-4 py-1"
            >
              <ExternalLink className="w-3 h-3" /> Open Video in New Tab
            </a>

            <button
              onClick={() => dispatch(setExporting(false))}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs py-1.5 transition-colors cursor-pointer"
            >
              Back to Studio Editor
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center mt-2">
            {/* Progress bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 mb-3 overflow-hidden relative border border-slate-200 dark:border-slate-700/60">
              <div
                className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full transition-all duration-300 relative rounded-full"
                style={{ width: `${Math.max(4, exportProgress)}%` }}
              >
                <div className="absolute top-0 bottom-0 left-0 right-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:16px_16px] animate-[move-stripes_1s_linear_infinite]" />
              </div>
            </div>

            <div className="flex justify-between w-full text-xs text-slate-700 dark:text-slate-300 font-medium mb-1">
              <span>{Math.round(exportProgress)}% Completed</span>
              {exportEta !== null && (
                <span>Remaining time: {formatEta(exportEta)}</span>
              )}
            </div>

            <p className="text-slate-500 dark:text-slate-400 text-[11px] text-center mb-6">
              {exportStatus || 'Orchestrating render pipeline across distributed nodes...'}
            </p>

            <button
              onClick={() => dispatch(setExporting(false))}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Cancel Render
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExportModal;
