import React from 'react';

export default function MovieInput({ value, onChange, disabled }) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-300">Movie Idea</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe your movie idea... e.g. A documentary about a day in the life of a coffee shop in Brooklyn"
        className="w-full min-h-[120px] px-4 py-3 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-y"
        disabled={disabled}
      />
    </div>
  );
}
