import { ringArt, glyphArt, coinArt, coinColor, RING_COLOR } from "@/lib/coin-art";

// Two-tone ASCII coin icon: a dim shared ring with the coin's glyph over it in
// that coin's brand colour. Rendered as two absolutely-stacked <pre> layers so
// the ring never picks up the accent colour.
//
// Sizing is driven by `cell` - the width in px of ONE logical pixel. Each
// logical pixel is two monospace characters, so a character is cell/2 wide and
// a monospace character is ~0.6em, giving fontSize = cell / 1.2. lineHeight is
// set to exactly `cell` so rows are square.
//
// The grid is 12x12 logical pixels, so the box is 12*cell on both axes.

interface CoinIconProps {
  /** Ticker: XMR, ZEPH, ZANO, XEL, BTC, ETH, SOL, BNB, LTC, BCH, DOGE, ... or "+7". */
  symbol: string;
  /** Width in px of one logical pixel. Hero 2.4, picker chips 2, rig 2.6. */
  cell?: number;
  /** Render as a single tone in the coin colour (used by the rig animation). */
  solid?: boolean;
  className?: string;
  /** Accessible label. Defaults to the ticker; pass "" to mark decorative. */
  title?: string;
}

export function CoinIcon({ symbol, cell = 2, solid = false, className, title }: CoinIconProps) {
  const size = cell * 12;
  const color = coinColor(symbol);
  const label = title === undefined ? symbol : title;

  const preBase: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    margin: 0,
    fontSize: `${cell / 1.2}px`,
    lineHeight: `${cell}px`,
    letterSpacing: 0,
    whiteSpace: "pre",
    fontFamily:
      "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  };

  return (
    <span
      className={className}
      style={{ position: "relative", display: "inline-block", width: size, height: size }}
      role={label ? "img" : "presentation"}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      {solid ? (
        <pre style={{ ...preBase, color }}>{coinArt(symbol)}</pre>
      ) : (
        <>
          <pre style={{ ...preBase, color: RING_COLOR }}>{ringArt()}</pre>
          <pre style={{ ...preBase, color }}>{glyphArt(symbol)}</pre>
        </>
      )}
    </span>
  );
}
