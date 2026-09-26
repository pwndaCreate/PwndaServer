import { cn } from "@/lib/utils";
import { ALL_COINS, type CoinId } from "@/lib/coins";

// A pool switch (ZEPH / ZANO / XEL - one button per entry in ALL_COINS) for
// the pages that have no address to detect a coin from (calculator).
//
// The My Stats page deliberately has NO selector - it detects the coin from
// the address the user pastes. This is for the other direction: pages that
// are pure reference material and need the reader to pick.
//
// Styling matches the active-nav treatment in TerminalNav so a selected coin
// reads the same as a selected page.

interface CoinSelectorProps {
  value: CoinId;
  onChange: (id: CoinId) => void;
  /** Optional label rendered to the left, e.g. "POOL". */
  label?: string;
  className?: string;
}

export function CoinSelector({ value, onChange, label, className }: CoinSelectorProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {label && (
        <span className="text-xs text-muted-foreground font-mono shrink-0">{label}</span>
      )}
      <div className="flex gap-1 flex-1">
        {ALL_COINS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            title={`${c.name} (${c.algoLabel})`}
            aria-pressed={value === c.id}
            className={cn(
              "flex-1 px-3 py-1.5 text-xs font-mono border transition-colors",
              value === c.id
                ? "text-primary glow-text bg-primary/10 border-primary/50"
                : "text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {c.symbol} / {c.hardware}
          </button>
        ))}
      </div>
    </div>
  );
}
