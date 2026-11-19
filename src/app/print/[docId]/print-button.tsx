"use client";
export function PrintButton() {
  return <button className="btn btn-primary" onClick={() => window.print()}>Export PDF</button>;
}
