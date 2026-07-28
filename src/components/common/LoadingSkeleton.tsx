import React from 'react';

export const LoadingSkeleton: React.FC<{ type?: string }> = ({ type = 'card' }) => {
  if (type === 'table') {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-slate-200/60" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-slate-200/60" />
      </div>
    );
  }
  return <div className="h-48 rounded-xl bg-slate-200/60 animate-pulse" />;
};
