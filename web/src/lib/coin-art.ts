// PWNDA ASCII coin art - ported verbatim from the redesign package's
// assets/coin-art.js, which is itself a port of the wallet app's CoinIcon.tsx.
//
// One shared 12x12 outer pixel ring (RING_12, rendered dim) plus a unique 8x8
// inner glyph per ticker drawn at offset (2,2) in that coin's accent colour.
// Text-kind glyphs (M, Z, B-with-bars, L-stroke, D-stroke) are hand-bitmapped
// to 8x8 so the whole family stays two-tone pixel art.
//
// Each pixel renders as TWO monospace characters ("##") so cells read square -
// a monospace glyph is roughly half as wide as it is tall.
//
// COLOUR RULE: these are the ONLY colours on the site. Everything else is the
// black-and-white terminal palette. Values come from each project's own brand
// (ZANO is zano.org's #274CFF lightened for contrast on #0a0a0a).

export const RING_12: readonly string[] = [
  "....####....",
  "..##....##..",
  ".##......##.",
  "##........##",
  "#..........#",
  "#..........#",
  "#..........#",
  "#..........#",
  "##........##",
  ".##......##.",
  "..##....##..",
  "....####....",
];

export const GLYPH8: Record<string, readonly string[]> = {
  XMR: ["##....##", "###..###", "########", "##.##.##", "##....##", "##....##", "##....##", "........"],
  // ZEPH carries a CROSSBAR: the mark is a Z struck through, which is Zephyr's own
  // branding, not a plain Z. Ported from the wallet's ZEPHYR_MARK (the origin of this
  // whole table) on 2026-09-07 after the two were compared - the site had been drawing
  // a bare Z for the pool's primary coin. Recompressed from the wallet's 8 rows to the
  // 7-row-plus-blank house style every other glyph here uses.
  ZEPH: ["########", "......##", ".....##.", "########", "...##...", "..##....", "########", "........"],
  ZANO: ["########", ".....##.", "....##..", ".######.", "..##....", ".##.....", "########", "........"],
  // XELIS's mark is a diamond outline whose top vertex is replaced by two spikes
  // that run down the middle and meet at the bottom point (the logo on
  // CoinGecko / xelis.io). Drawn 2026-09-16 in the house style: 7 rows plus a
  // blank. Deliberately not a plain X, which would read as XRP's glyph.
  XEL: ["..#..#..", ".##..##.", "#.#..#.#", "#..##..#", ".#.##.#.", "..####..", "...##...", "........"],
  BTC: ["..#..#..", ".######.", ".##...##", ".######.", ".##...##", ".######.", "..#..#..", "........"],
  BCH: ["..#..#..", ".######.", ".##...##", ".######.", ".##...##", ".######.", "..#..#..", "........"],
  ETH: ["...##...", "..####..", ".######.", "##.##.##", "##....##", ".######.", "..####..", "...##..."],
  SOL: ["........", ".######.", "######..", "........", "..######", ".######.", "######..", "........"],
  BNB: ["...##...", "..####..", ".##..##.", "##.##.##", "##.##.##", ".##..##.", "..####..", "...##..."],
  LTC: ["..##....", "..##....", "..##.#..", "..###...", ".###....", "#.##....", "..#####.", "........"],
  DOGE: [".#####..", ".##..##.", ".##...##", "####..##", ".##...##", ".##..##.", ".#####..", "........"],
  // Payout coins added to the hero rotation 2026-09-05. Same two-tone 8x8 rule:
  // a brand silhouette where the coin has one (AVAX mountain, POL hexagon, SUI
  // droplet, XRP cross, USDT tether-T), a letterform where it does not (ADA),
  // and a currency mark for the stablecoins. TRX was drawn here as a plain
  // triangle and has since been replaced by the wallet's angular mark - see
  // its own note below.
  // Redrawn 2026-09-07: this was the only glyph in the file using 6 rows and sitting
  // off-centre (blank row top AND bottom). Same Avalanche mountain, filling rows 0-6.
  AVAX: ["...##...", "..####..", "..#..#..", ".##..##.", ".##..##.", "##.##.##", "########", "........"],
  ADA: ["...##...", "..####..", ".##..##.", "##....##", "########", "##....##", "##....##", "........"],
  POL: ["..####..", ".##..##.", "##....##", "##....##", "##....##", ".##..##.", "..####..", "........"],
  SUI: ["...##...", "..####..", "..####..", ".######.", ".######.", "########", ".######.", "..####.."],
  // TRON's mark is angular and does not taper evenly - ported from the wallet, which
  // had it right, in place of the plain downward triangle drawn here on 2026-09-05.
  TRX: ["########", "##....##", ".##..##.", "..####..", "...##...", "..####..", ".######.", "........"],
  XRP: ["##....##", ".##..##.", "..####..", "...##...", "..####..", ".##..##.", "##....##", "........"],
  USDC: ["...##...", "..#####.", ".##.##..", "..####..", "...##.##", ".#####..", "...##...", "........"],
  USDT: ["########", "...##...", "...##...", ".######.", "...##...", "...##...", "...##...", "........"],
  "+7": ["........", "...##...", "...##...", ".######.", ".######.", "...##...", "...##...", "........"],
};

export const COIN_COLOR: Record<string, string> = {
  XMR: "#FF6600",
  ZEPH: "#5B9DFF",
  ZANO: "#4A78FF",
  // xelis.io's accent (#02FFCF, the most-used colour in its stylesheet). Already
  // bright, so it reads on #0a0a0a without lightening.
  XEL: "#02FFCF",
  BTC: "#F7931A",
  ETH: "#8FA7FF",
  SOL: "#9945FF",
  BNB: "#F3BA2F",
  LTC: "#B8C0C8",
  BCH: "#0AC18E",
  DOGE: "#C2A633",
  // Added 2026-09-05 with the glyphs above, same brand-provenance rule.
  AVAX: "#E84142",
  ADA: "#0D9BE8",
  POL: "#8247E5",
  SUI: "#4DA2FF",
  TRX: "#EF0027",
  XRP: "#D8DEE4", // XRP brands monochrome; a light neutral is the honest read
  USDC: "#2775CA",
  USDT: "#26A17B",
  "+7": "#808080",
};

// NOTE ON THE BLUES. Six entries here are blue (ZEPH, ZANO, ETH, ADA, SUI,
// USDC) because six of these projects genuinely brand blue. They are never
// shown side by side - the hero renders ONE coin at a time and the selector
// row labels every chip - so brand accuracy was kept over forcing artificial
// separation. Do not "fix" this by inventing off-brand colours.

/** The dim colour the shared ring is drawn in. */
export const RING_COLOR = "rgba(242,242,242,0.4)";

/** Double every pixel into two chars so cells read square in a monospace font. */
function dbl(rows: readonly string[]): string {
  return rows.map((r) => r.split("").map((c) => (c === "#" ? "##" : "  ")).join("")).join("\n");
}

/** The 8x8 glyph placed at (2,2) inside an otherwise empty 12x12 grid. */
function glyphGrid(sym: string): string[] {
  const g = GLYPH8[sym] || GLYPH8["+7"];
  const rows: string[] = [];
  for (let y = 0; y < 12; y++) {
    let row = "";
    for (let x = 0; x < 12; x++) {
      const inner = y >= 2 && y < 10 && x >= 2 && x < 10 && g[y - 2][x - 2] === "#";
      row += inner ? "#" : ".";
    }
    rows.push(row);
  }
  return rows;
}

function combinedGrid(sym: string): string[] {
  const g = glyphGrid(sym);
  return RING_12.map((r, y) =>
    r.split("").map((c, x) => (c === "#" || g[y][x] === "#" ? "#" : ".")).join("")
  );
}

/** Dim outer ring layer. */
export function ringArt(): string {
  return dbl(RING_12);
}

/** Accent glyph layer, drawn over the ring. */
export function glyphArt(sym: string): string {
  return dbl(glyphGrid(sym));
}

/** Ring and glyph merged into one single-tone grid - used by the rig animation. */
export function coinArt(sym: string): string {
  return dbl(combinedGrid(sym));
}

export function coinColor(sym: string): string {
  return COIN_COLOR[sym] || COIN_COLOR["+7"];
}
