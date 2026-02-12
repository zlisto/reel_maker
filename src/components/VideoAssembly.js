import React from 'react';
import AnimatedDots from './AnimatedDots';

export default function VideoAssembly({ onAssemble, assembleProgress, assembleStatus, includeSubtitles, onIncludeSubtitlesChange, outputBlob, projectName }) {
  const [previewUrl, setPreviewUrl] = React.useState(null);

  React.useEffect(() => {
    if (outputBlob) {
      const url = URL.createObjectURL(outputBlob);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [outputBlob]);

  const handleDownload = () => {
    if (!outputBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(outputBlob);
    a.download = `${projectName || 'output'}.mp4`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={onAssemble}
            disabled={assembleProgress !== null && assembleProgress < 1}
            className="px-6 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium transition-colors"
          >
            {assembleProgress !== null && assembleProgress < 1
              ? <AnimatedDots prefix="Generating" />
              : 'Generate Video'}
          </button>
          <button
            type="button"
            onClick={() => onIncludeSubtitlesChange?.(!includeSubtitles)}
            disabled={assembleProgress !== null && assembleProgress < 1}
            className={`px-4 py-2.5 rounded-lg font-medium transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed ${includeSubtitles ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}
            title={includeSubtitles ? 'Subtitles on (click to disable)' : 'Subtitles off (click to enable)'}
          >
            Subs {includeSubtitles ? 'ON' : 'OFF'}
          </button>
        </div>
        {assembleProgress !== null && assembleProgress < 1 && (
          <div className="text-sm text-slate-400">
            <div className="flex justify-between mb-1">
              <span>
                {assembleStatus?.currentScene != null
                  ? `Scene ${assembleStatus.currentScene}/${assembleStatus.totalScenes || ''}`
                  : 'Merging...'}
              </span>
              <span>{Math.round((assembleProgress ?? 0) * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-300"
                style={{ width: `${Math.round((assembleProgress ?? 0) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {assembleProgress === 1 && outputBlob && (
        <div className="space-y-3">
          <div className="aspect-video max-w-2xl rounded-lg overflow-hidden bg-black">
            {previewUrl && (
              <video src={previewUrl} controls className="w-full h-full" />
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              Download
            </button>
            <button
              onClick={() => window.open(previewUrl, '_blank')}
              className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium"
            >
              Replay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
