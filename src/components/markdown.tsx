import React from "react";

/** Tiny, safe markdown subset: ##/### headings, - bullets, > quotes, **bold**, _italic_. No HTML passthrough. */
function inline(s: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_)/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0];
    out.push(t.startsWith("**") ? <strong key={`${key}-${i++}`}>{t.slice(2, -2)}</strong> : <em key={`${key}-${i++}`}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export function Markdown({ text, className = "" }: { text: string | null | undefined; className?: string }) {
  const lines = (text ?? "").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  let para: string[] = [];
  const flush = (k: number) => {
    if (list.length) { blocks.push(<ul key={`u${k}`}>{list.map((l, i) => <li key={i}>{inline(l, `l${k}${i}`)}</li>)}</ul>); list = []; }
    if (para.length) { blocks.push(<p key={`p${k}`}>{inline(para.join(" "), `p${k}`)}</p>); para = []; }
  };
  lines.forEach((raw, k) => {
    const l = raw.trimEnd();
    if (/^\s*[-*•]\s+/.test(l)) { if (para.length) flush(k); list.push(l.replace(/^\s*[-*•]\s+/, "")); return; }
    flush(k);
    if (!l.trim()) return;
    if (l.startsWith("### ")) blocks.push(<h3 key={k}>{inline(l.slice(4), `h${k}`)}</h3>);
    else if (l.startsWith("## ")) blocks.push(<h2 key={k}>{inline(l.slice(3), `h${k}`)}</h2>);
    else if (l.startsWith("# ")) blocks.push(<h2 key={k}>{inline(l.slice(2), `h${k}`)}</h2>);
    else if (l.startsWith("> ")) blocks.push(<blockquote key={k}>{inline(l.slice(2), `q${k}`)}</blockquote>);
    else para.push(l);
  });
  flush(lines.length);
  return <div className={`prose-aerara ${className}`}>{blocks}</div>;
}
