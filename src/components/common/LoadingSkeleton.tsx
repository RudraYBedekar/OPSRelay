import React from 'react';

export const LoadingSkeleton: React.FC<{ type?: string }> = ({ type = 'card' }) => {
  if (type === 'table') {
    return (
      <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 rounded-lg border border-ops-border bg-white">
              <div className="h-full rounded-lg bg-ops-cardHover/80 m-3" />
            </div>
          ))}
        </div>
        <div className="h-72 rounded-lg border border-ops-border bg-white">
          <div className="h-10 border-b border-ops-border bg-ops-bg" />
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 rounded-md bg-ops-cardHover/80" />
            ))}
          </div>
        </div>
      </div>
    );
  }
  return <div className="h-48 rounded-lg border border-ops-border bg-ops-cardHover/60 animate-pulse" aria-busy="true" />;
};
