import React from "react";

export function Progress({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="pf-progress" aria-label="progress">
      <div style={{ width: `${v}%` }} />
    </div>
  );
}

