import { COINS, type CoinId } from "@/lib/coins";
import { usePoolSummary } from "@/hooks/usePoolStats";
import { calcDefaultHs, expectedSecondsToBlock, humanDuration } from "@/lib/earnings";
import { formatHashrate } from "@/lib/utils";

// How long until a new miner's first payout, honestly. PPLNS pays only when the
// pool finds a block, and on a small pool that can be days: miners who arrived
// from the September 2026 ads at ~100 kH/s left before the first block and
// earned nothing (wiki: analyses/marketing-4chan-campaigns-sep-2026). Telling
// them the expected wait, and to stay through it, is the fix that costs
// nothing. Renders as inline text so the caller chooses the block element;
// the static advice always shows, the live sentence once the pool answers.

const fmtHs = (hs: number) => formatHashrate(hs).replace(".00 ", " ");

export function NextBlockLine({ coinId }: { coinId: CoinId }) {
  const coin = COINS[coinId];
  const { summary } = usePoolSummary(coinId);
  const difficulty = summary?.network?.difficulty ?? 0;
  const poolHs = summary?.hashrate ?? 0;
  const lastMs = summary?.lastBlockFound ?? 0;

  let live: string | null = null;
  const poolSecs = expectedSecondsToBlock(difficulty, poolHs);
  if (poolSecs != null) {
    const ago = lastMs > 0 ? humanDuration((Date.now() - lastMs) / 1000) : null;
    live = `At its current ${fmtHs(poolHs)} the ${coin.symbol} pool finds a block ${humanDuration(poolSecs)} on average${
      ago ? ` (the last one was ${ago} ago)` : ""
    }.`;
  } else if (difficulty > 0) {
    const rigHs = calcDefaultHs(coin);
    const rigSecs = expectedSecondsToBlock(difficulty, rigHs);
    if (rigSecs != null) {
      live = `No one is mining ${coin.symbol} here right now; a lone ${fmtHs(rigHs)} rig would find a block ${humanDuration(rigSecs)} on average.`;
    }
  }

  return (
    <>
      {live ? `${live} ` : null}
      Your first payout follows the first block the pool finds while you are mining, so stay
      through it - {coin.payoutScheme} counts every share in the window, and nothing you
      contributed is lost while you wait.
    </>
  );
}
