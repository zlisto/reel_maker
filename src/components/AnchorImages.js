import React from 'react';

export default function AnchorImages({ anchorImages, onAnchorChange }) {
  const handleFile = (index, file) => {
    if (file) onAnchorChange(index, file);
  };

  const handleDrop = (index, e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file?.type?.startsWith('image/')) handleFile(index, file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-400">
        Drag or upload up to 3 reference images. In scene descriptions, reference them as <strong className="text-slate-300">image 1</strong>, <strong className="text-slate-300">image 2</strong>, <strong className="text-slate-300">image 3</strong>.
      </p>
      <div className="flex gap-3 flex-wrap">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex flex-col items-center">
            <label
              className="flex flex-col items-center justify-center w-24 h-24 rounded-lg border-2 border-dashed border-slate-600 bg-slate-800/50 cursor-pointer hover:border-slate-500 overflow-hidden transition-colors"
              onDrop={(e) => handleDrop(n - 1, e)}
              onDragOver={handleDragOver}
            >
              {anchorImages[n - 1] ? (
                <img src={URL.createObjectURL(anchorImages[n - 1])} alt={`Anchor ${n}`} className="w-full h-full object-cover" />
              ) : (
                <span className="text-slate-500 text-xs">Drag or click</span>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleFile(n - 1, e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            <span className="text-xs text-slate-500 mt-1">image {n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
