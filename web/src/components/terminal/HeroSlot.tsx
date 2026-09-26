import { CoinIcon } from "./CoinIcon";
import { coinColor } from "@/lib/coin-art";

// The animated ticker slot and its scramble effect. Extracted from Index.tsx
// on 2026-09-10 so /unmineable can rotate its own receive coin with the same
// effect the homepage uses, instead of carrying a second copy that drifts.
//
// The timing constants are shared on purpose: a visitor who goes from the
// homepage to /unmineable should feel one animation, not two similar ones.

export const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ01#$%&";
export const PERIOD = 2600;
export const SCRAMBLE_MS = 500;

/** The first `progress` of the target is locked in; the rest is random glyphs. */
export function scrambleFrame(target: string, progress: number): string {
  const lock = Math.floor(target.length * progress);
  let out = target.slice(0, lock);
  for (let i = lock; i < target.length; i++) {
    out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  }
  return out;
}

export const glow = (hex: string) => hex + "66";

/** One animated ticker slot in a headline: icon + symbol + white period. */
export function HeroSlot({ shown, sym }: { shown: string; sym: string }) {
  const color = coinColor(sym);
  return (
    <span
      className="inline-block min-w-[4ch] text-left"
      style={{ color, textShadow: `0 0 8px ${glow(color)}` }}
    >
      <span className="mr-2 inline-block align-middle">
        <CoinIcon symbol={sym} cell={2.4} title="" />
      </span>
      {shown}
      <span className="text-white">.</span>
    </span>
  );
}
