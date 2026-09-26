import type { ReactNode } from "react";

// Shared building blocks for the guide pages (/mine/zephyr, /mine/zano,
// /mine/xelis, /unmineable). Added 2026-09-10 with the subject-matter pages the SEO plan
// identified as the binding constraint: the site had no page that was ABOUT
// mining Zephyr or Zano, so it could not rank for anything mining-qualified.
//
// Design rule for every page built from these: answer first, numbers concrete,
// nothing that needs a scroll to find the point. Anything longer than a
// paragraph goes inside <Faq>, which is a native <details>: collapsed for the
// reader, but server-rendered, so a crawler gets the full text with full
// weight. That is how these pages carry enough substance to rank without
// becoming the wall of text the operator does not want.

export function Card({
  children,
  strong = false,
  className = "",
}: {
  children: ReactNode;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`border ${
        strong ? "border-[#f2f2f2]/30 bg-[#0f0f0f]" : "border-[#404040] bg-[#0a0a0a]"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** A small uppercase section label in the site's terminal style. */
export function Label({ children }: { children: ReactNode }) {
  return (
    <h2 className="pw-glow-text mb-4 text-[13px] uppercase tracking-[0.1em] text-[#f2f2f2]">
      {children}
    </h2>
  );
}

/** Key/value rows - the facts table every guide opens with. */
export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-[#808080]">{k}</dt>
          <dd className="m-0 text-[#e6e6e6]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Numbered steps. Kept to one line each on purpose. */
export function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="m-0 list-none space-y-2 p-0 text-[13px] leading-[1.7] text-[#e6e6e6]">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span className="shrink-0 text-[#808080]">{String(i + 1).padStart(2, "0")}</span>
          <span>{it}</span>
        </li>
      ))}
    </ol>
  );
}

/** A command the reader copies. */
export function Cmd({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto border border-[#404040] bg-black p-3 text-[12px] leading-[1.6] text-[#e6e6e6]">
      {children}
    </pre>
  );
}

/**
 * One FAQ entry. A native <details>, so it is collapsed for the reader but the
 * answer is in the HTML for a crawler - and it can be mirrored into FAQPage
 * JSON-LD by scripts/prerender.mjs. Keep the question phrased the way people
 * type it into a search box.
 */
export function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="border-b border-[#404040]/50 py-2.5">
      <summary className="cursor-pointer list-none text-[13px] font-bold text-[#e6e6e6] [&::-webkit-details-marker]:hidden">
        <span className="mr-2 text-[#808080]">&gt;</span>
        {q}
      </summary>
      <div className="mt-2 pl-5 text-[13px] leading-[1.7] text-[#a0a0a0]">{children}</div>
    </details>
  );
}
