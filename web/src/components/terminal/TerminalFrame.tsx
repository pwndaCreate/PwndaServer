import { cn } from "@/lib/utils";

// A card wrapped in an ASCII box-drawing frame, with its title notched into
// the top rail: ┌─[ TITLE ]──────┐ ... └──────┘
//
// How it works: the card carries a real 1px border, and the two rails are
// absolutely positioned to straddle it at -9px. The title span paints the PAGE
// background (#0a0a0a, not the card's #121212), which is what punches the gap
// in the border line behind the label.
//
// The filler is a deliberately over-long run of ─ inside an overflow-hidden
// flex:1 span, so the rail fits any width with no JS measuring. Both rails are
// pointer-events:none so they never eat a click.
//
// Box-drawing characters are the one allowed exception to the estate's
// plain-ASCII rule - they are the terminal motif itself, not prose.

const FILL = "─".repeat(120);

interface TerminalFrameProps {
  title: string;
  children: React.ReactNode;
  /** Brighter glow, for the primary CTA cards. */
  strong?: boolean;
  className?: string;
}

export function TerminalFrame({ title, children, strong = false, className }: TerminalFrameProps) {
  return (
    <div className={cn("relative", strong ? "pw-card-strong" : "pw-card", className)}>
      {/* top rail */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-[9px] left-0 right-0 flex items-center text-[12px] leading-none"
      >
        <span className="text-[#f2f2f2]">{"┌─["}</span>
        <span className="pw-glow-text bg-[#0a0a0a] px-1 text-[#e6e6e6]">{title}</span>
        <span className="text-[#f2f2f2]">]</span>
        <span className="flex-1 overflow-hidden whitespace-nowrap text-[#f2f2f2]">{FILL}</span>
        <span className="text-[#f2f2f2]">{"┐"}</span>
      </div>

      {children}

      {/* bottom rail */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[9px] left-0 right-0 flex text-[12px] leading-none text-[#f2f2f2]"
      >
        <span>{"└"}</span>
        <span className="flex-1 overflow-hidden whitespace-nowrap">{FILL}</span>
        <span>{"┘"}</span>
      </div>
    </div>
  );
}
