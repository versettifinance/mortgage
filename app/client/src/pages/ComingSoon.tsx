import React from "react";

export default function ComingSoon({ title }: { title: string }) {
  return (
    <div>
      <div className="page-header">
        <div className="page-title">{title}</div>
      </div>
      <div className="card coming-soon">
        <span className="badge">Phase 2</span>
        <p style={{ fontSize: 15, fontWeight: 600 }}>This feature is coming in Phase 2.</p>
        <p style={{ fontSize: 13 }}>The data model already supports it — the interactive UI isn't built yet, so no numbers are shown here.</p>
      </div>
    </div>
  );
}
