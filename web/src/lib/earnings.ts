import type { CoinSpec } from "@/lib/coins";

// The earnings projection, in one place. /calculator has always computed
// "your share of network hashrate x blocks per day x live block reward, net of
// the pool fee"; /unmineable now shows the same number for a typical rig as a
// single line of proof above its buttons, and /start and /mine/<coin> show how
// long the pool takes to find a block. Three pages, one formula - so a change
// here moves all of them and none can drift.
//
// Assumes constant difficulty and average luck. PPLNS pays only when the pool
// finds a block, so real payouts arrive in lumps around this average.

export const UNIT_MULT = { h: 1, kh: 1_000, mh: 1_000_000 } as const;

export interface EarningsInputs {
  /** The rig, in H/s. */
  minerHs: number;
  /** Network difficulty as the pool API reports it. */
  difficulty: number;
  /** Target PoW block time in seconds (CoinSpec.blockTimeS). */
  blockTimeS: number;
  /** Block reward in WHOLE coins (the caller converts from atomic). */
  blockRewardCoin: number;
  poolFeePct: number;
}

/** Coins per day for the rig, or null when any input is missing or zero. */
export function dailyCoinEstimate(i: EarningsInputs): number | null {
  const networkHs = i.blockTimeS > 0 ? i.difficulty / i.blockTimeS : 0;
  if (!(i.minerHs > 0) || !(networkHs > 0) || !(i.blockRewardCoin > 0)) return null;
  const blocksPerDay = 86400 / i.blockTimeS;
  return (i.minerHs / networkHs) * blocksPerDay * i.blockRewardCoin * (1 - i.poolFeePct / 100);
}

/** The calculator's default rig for a coin (calcHashrate + calcUnit), in H/s. */
export function calcDefaultHs(coin: Pick<CoinSpec, "calcHashrate" | "calcUnit">): number {
  const n = parseFloat(coin.calcHashrate);
  return Number.isFinite(n) ? n * UNIT_MULT[coin.calcUnit] : 0;
}

/**
 * Expected seconds between blocks for a pool (or a lone rig) at `hs` H/s. A
 * block takes `difficulty` hashes on average, so this is difficulty / hashrate.
 * Null when either is unknown or zero.
 */
export function expectedSecondsToBlock(difficulty: number, hs: number): number | null {
  if (!(difficulty > 0) || !(hs > 0)) return null;
  return difficulty / hs;
}

/** "about 40 minutes", "about 14 hours", "about 15 days". Coarse on purpose: it is an average. */
export function humanDuration(seconds: number): string {
  if (!(seconds > 0)) return "-";
  const min = seconds / 60;
  if (min < 90) {
    const m = Math.max(1, Math.round(min));
    return `about ${m} minute${m === 1 ? "" : "s"}`;
  }
  const h = seconds / 3600;
  if (h < 36) return `about ${Math.round(h)} hours`;
  const d = seconds / 86400;
  if (d < 60) return `about ${Math.round(d)} days`;
  return `about ${Math.round(d / 30)} months`;
}

/** "$3.53" under ten dollars, "$12" above: an estimate, not an invoice. */
export function formatMonthlyUsd(v: number): string {
  return v < 10 ? `$${v.toFixed(2)}` : `$${Math.round(v)}`;
}
