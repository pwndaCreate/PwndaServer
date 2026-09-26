import { describe, it, expect } from "vitest";
import { FIRST_PAIR, MINE_ALL, RECV_ALL, RECV_OPTS, TOTAL_DESTINATIONS } from "@/pages/Index";
import { GLYPH8, COIN_COLOR, coinColor } from "@/lib/coin-art";
import { DESTINATIONS } from "@/lib/destinations";

/*  Guards the home page's "MINE x. RECEIVE y." rotation.
 *
 *  Two classes of bug this catches, both of which ship silently:
 *
 *  1. A coin added to the rotation with no art or colour. `glyphGrid` falls back
 *     to the "+7" plus-icon and `coinColor` to grey, so the page still renders -
 *     it just shows a generic grey plus where a coin should be. Nothing throws.
 *
 *  2. A coin advertised that the wallet cannot actually pay out in. The hero is
 *     a promise; the destination allowlist is what the wallet will honour.
 */

// Mirror of PWNDA_INTENTS_DESTINATION_TICKERS in the wallet repo at
// src/features/swap/swap-data.ts - the tickers NEAR Intents can deliver to an
// address Pwnda derives. Duplicated here because the two repos ship separately;
// if that list changes, this one must be updated with it.
const WALLET_DESTINATIONS = [
  "BTC", "ETH", "SOL", "LTC", "BCH", "DOGE", "XRP", "TRX",
  "USDC", "USDT", "DAI", "MON", "BNB", "DASH", "XLM", "SUI",
  "AVAX", "POL", "ADA",
] as const;

const FALLBACK_SYM = "+7";

describe("hero rotation art", () => {
  it("gives every rotating coin its own glyph, never the fallback plus icon", () => {
    for (const sym of [...MINE_ALL, ...RECV_ALL]) {
      expect(GLYPH8[sym], `${sym} has no glyph and would render the "+7" plus icon`).toBeDefined();
      expect(GLYPH8[sym]).not.toBe(GLYPH8[FALLBACK_SYM]);
    }
  });

  it("gives every rotating coin its own colour, never the fallback grey", () => {
    for (const sym of [...MINE_ALL, ...RECV_ALL]) {
      expect(COIN_COLOR[sym], `${sym} has no colour and would render grey`).toBeDefined();
      expect(coinColor(sym)).not.toBe(COIN_COLOR[FALLBACK_SYM]);
    }
  });

  it("draws every glyph as a well-formed 8x8 grid", () => {
    for (const [sym, rows] of Object.entries(GLYPH8)) {
      expect(rows, `${sym} is not 8 rows`).toHaveLength(8);
      for (const row of rows) {
        expect(row, `${sym} has a row that is not 8 columns: "${row}"`).toHaveLength(8);
        expect(row, `${sym} has a row with characters other than # and .`).toMatch(/^[#.]{8}$/);
      }
    }
  });

  it("uses a valid hex colour for every entry", () => {
    for (const [sym, hex] of Object.entries(COIN_COLOR)) {
      expect(hex, `${sym} colour is not #RRGGBB`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe("hero rotation coverage", () => {
  // Index.tsx picks the destination with `RECV_ALL[(pair * 3 + 1) % length]`.
  // A length divisible by 3 shares a factor with that step, so only a third of
  // the list is ever reachable - the other coins are dead config.
  it("shows every coin in the list, not just a subset", () => {
    const seen = new Set<string>();
    for (let pair = 0; pair < RECV_ALL.length * 3; pair++) {
      seen.add(RECV_ALL[(pair * 3 + 1) % RECV_ALL.length]);
    }
    expect(
      [...seen].sort(),
      `only ${seen.size}/${RECV_ALL.length} coins are reachable - the step of 3 shares a factor with the length`,
    ).toEqual([...RECV_ALL].sort());
  });

  it("keeps the length coprime with the step, stated directly", () => {
    expect(RECV_ALL.length % 3).not.toBe(0);
  });

  it("pairs each mined coin with the destinations over a full cycle", () => {
    const pairs = new Set<string>();
    for (let pair = 0; pair < MINE_ALL.length * RECV_ALL.length; pair++) {
      pairs.add(`${MINE_ALL[pair % MINE_ALL.length]}->${RECV_ALL[(pair * 3 + 1) % RECV_ALL.length]}`);
    }
    expect(pairs.size).toBe(MINE_ALL.length * RECV_ALL.length);
  });
});

describe("hero rotation honesty", () => {
  it("only advertises coins the wallet can actually pay out in", () => {
    for (const sym of RECV_ALL) {
      expect(
        WALLET_DESTINATIONS as readonly string[],
        `${sym} is in the hero rotation but not in the wallet's destination allowlist`,
      ).toContain(sym);
    }
  });

  it("only offers selectable chips the wallet can pay out in", () => {
    for (const opt of RECV_OPTS) {
      if (opt.sym.startsWith("+")) continue; // the "and N more" count chip
      expect(WALLET_DESTINATIONS as readonly string[]).toContain(opt.sym);
    }
  });

  it("states a destination count that matches the allowlist", () => {
    expect(TOTAL_DESTINATIONS).toBe(WALLET_DESTINATIONS.length);
  });

  it("never puts a mined coin in the receive rotation", () => {
    // Mining ZEPH to receive ZEPH is not a swap, and the pools pay those out
    // directly - a rotation that offered it would be describing a no-op.
    for (const sym of MINE_ALL) {
      expect(RECV_ALL).not.toContain(sym);
    }
  });
});

// The <h1> is the one heading a non-JS crawler ever sees, and for a while it
// served scramble output: "MINE MP& . RECEIVE T#L .". The headline rendered its
// ANIMATING state during the server render and the first client render, while
// the typed subline right below it correctly rendered its settled state. These
// tests pin the settled pair to the same index maths the animation uses, so the
// two cannot drift apart again silently.
describe("hero first paint", () => {
  const PAIR_STEP = 3;

  // The operator chose the first three receive coins deliberately (2026-09-09).
  // They are NOT the first three entries of RECV_ALL: the rotation steps by 3, so
  // they live at indices 1, 4 and 7. Reordering the array alphabetically - or
  // inserting a coin near the front - silently changes what every visitor sees
  // first and what the <h1> tells crawlers. This test is the tripwire.
  it("opens on the chosen coins: TRX, then SOL, then ETH", () => {
    const first3 = [0, 1, 2].map((p) => RECV_ALL[(p * PAIR_STEP + 1) % RECV_ALL.length]);
    expect(first3).toEqual(["TRX", "SOL", "ETH"]);
  });

  it("pairs those with XMR, ZEPH and ZANO in order", () => {
    const pairs = [0, 1, 2].map((p) => [
      MINE_ALL[p % MINE_ALL.length],
      RECV_ALL[(p * PAIR_STEP + 1) % RECV_ALL.length],
    ]);
    expect(pairs).toEqual([["XMR", "TRX"], ["ZEPH", "SOL"], ["ZANO", "ETH"]]);
  });

  it("settles on the pair the animation itself shows at t=0", () => {
    expect(FIRST_PAIR.mine).toBe(MINE_ALL[0 % MINE_ALL.length]);
    expect(FIRST_PAIR.recv).toBe(RECV_ALL[(0 * PAIR_STEP + 1) % RECV_ALL.length]);
  });

  it("names real coins, never scramble characters", () => {
    for (const sym of [FIRST_PAIR.mine, FIRST_PAIR.recv]) {
      expect(sym).toMatch(/^[A-Z0-9]{2,5}$/);
      expect(GLYPH8).toHaveProperty(sym);
    }
  });

  it("does not receive a coin it also mines", () => {
    expect(MINE_ALL).not.toContain(FIRST_PAIR.recv);
  });
});

// /unmineable renders every coin in src/lib/destinations.ts. That file mirrors
// the wallet's allowlist a second time (this test file is the first mirror), so
// pin the two together: a coin added to one and not the other fails here rather
// than shipping a payout option the wallet cannot deliver, or hiding one it can.
describe("destination registry", () => {
  it("lists exactly the wallet's payout allowlist", () => {
    const syms = DESTINATIONS.map((d) => d.sym).sort();
    expect(syms).toEqual([...WALLET_DESTINATIONS].sort());
  });

  it("classifies every coin as either no-PoW or ASIC-only", () => {
    for (const d of DESTINATIONS) expect(["pos", "asic"]).toContain(d.why);
  });

  it("does not call a rotation coin unmineable-by-ASIC when it is not PoW", () => {
    // The ASIC group is the short list of real PoW coins; everything else has no
    // mining at all. A miscategorised coin is a false claim on a public page.
    const asic = DESTINATIONS.filter((d) => d.why === "asic").map((d) => d.sym).sort();
    expect(asic).toEqual(["BCH", "BTC", "DASH", "DOGE", "LTC"]);
  });
});

// /unmineable rotates its own receive line. Two things must hold: the rotation
// is exactly the payout allowlist (no coin shown that cannot be delivered, none
// hidden), and a URL hash selects where it starts - that is how an ad reading
// "Want SOL? Mine it." lands on a page whose first resolved coin is SOL.
import { RECV_ROTATION, pinnedCoinForHash, startIndexForHash } from "@/pages/Unmineable";

describe("/unmineable rotation", () => {
  it("rotates exactly the wallet's payout allowlist", () => {
    expect([...RECV_ROTATION].sort()).toEqual([...WALLET_DESTINATIONS].sort());
  });

  it("has a prime length so a step of 1 visits every coin", () => {
    const n = RECV_ROTATION.length;
    expect(n).toBe(19);
    for (let d = 2; d < n; d++) expect(n % d).not.toBe(0);
  });

  it("starts on the coin the hash names, case-insensitively", () => {
    expect(RECV_ROTATION[startIndexForHash("#sol")]).toBe("SOL");
    expect(RECV_ROTATION[startIndexForHash("#USDT")]).toBe("USDT");
    expect(RECV_ROTATION[startIndexForHash("trx")]).toBe("TRX");
  });

  it("opens on the chosen coins: TRX, then SOL, then ETH", () => {
    // Step is 1 here, so these are the first three a cold visitor sees.
    expect(RECV_ROTATION.slice(0, 3)).toEqual(["TRX", "SOL", "ETH"]);
  });

  it("falls back to the first coin for no hash or an unknown one", () => {
    expect(startIndexForHash("")).toBe(0);
    expect(startIndexForHash("#nope")).toBe(0);
    expect(RECV_ROTATION[0]).toBe("TRX");
  });
});

// Since 2026-09-24 a hash that names a coin PINS the receive slot instead of
// only choosing where the rotation starts: the coin from the ad stays on
// screen. No hash, or one naming nothing the wallet pays out in, still rotates.
describe("/unmineable pin", () => {
  it("pins exactly the coin a hash names, case-insensitively", () => {
    expect(pinnedCoinForHash("#trx")).toBe("TRX");
    expect(pinnedCoinForHash("#USDT")).toBe("USDT");
    expect(pinnedCoinForHash("sol")).toBe("SOL");
  });

  it("pins nothing for no hash, an unknown coin, or a mined coin", () => {
    expect(pinnedCoinForHash("")).toBeNull();
    expect(pinnedCoinForHash("#nope")).toBeNull();
    expect(pinnedCoinForHash("#zeph")).toBeNull();
  });

  it("agrees with the start index for every rotation coin", () => {
    for (const sym of RECV_ROTATION) {
      const hash = "#" + sym.toLowerCase();
      expect(pinnedCoinForHash(hash)).toBe(RECV_ROTATION[startIndexForHash(hash)]);
    }
  });
});
