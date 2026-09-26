import { useState } from "react";
import { Link } from "react-router-dom";
import { TerminalNav } from "@/components/terminal/TerminalNav";
import { SiteFooter } from "@/components/terminal/SiteFooter";
import { TerminalCard, TerminalOutput, CoinSelector } from "@/components/terminal";
import { useCoinPrice, formatPrice } from "@/hooks/useCoinGecko";
import { usePoolSummary, atomicToCoin } from "@/hooks/usePoolStats";
import { formatHashrate } from "@/lib/utils";
import { dailyCoinEstimate } from "@/lib/earnings";
import { COINS, DEFAULT_COIN, hardwarePhrase, type CoinId } from "@/lib/coins";

// /calculator - profitability calculator for all three pools (reworked
// 2026-07-09, made coin-aware 2026-08-28, XEL added 2026-09-16). Uses the SAME
// projection as the /pool page's ESTIMATED_EARNINGS card - your share of
// network hashrate x daily block emission x live block reward - with live
// difficulty + reward from that pool's own API and live price from CoinGecko.
//
// Zephyr and Zano target 120 s PoW blocks -> 720 blocks/day; Xelis 5 s ->
// 17280/day. For Zano the 120 is DIFFICULTY_POW_TARGET specifically: the CHAIN
// averages ~60 s because PoS blocks interleave, but only PoW blocks are
// minable, so 120 is the right divisor for a miner's estimate. The number
// comes from coins.ts either way.
//
// Estimate assumes constant difficulty and average luck; PPLNS reality swings
// around it.

const UNITS = [
  { id: "h", label: "H/s", mult: 1 },
  { id: "kh", label: "KH/s", mult: 1_000 },
  { id: "mh", label: "MH/s", mult: 1_000_000 },
] as const;

type UnitId = (typeof UNITS)[number]["id"];

const Calculator = () => {
  const [coinId, setCoinId] = useState<CoinId>(DEFAULT_COIN);
  const coin = COINS[coinId];

  const [hashrate, setHashrate] = useState(COINS[DEFAULT_COIN].calcHashrate);
  const [unit, setUnit] = useState<UnitId>(COINS[DEFAULT_COIN].calcUnit);
  const [powerW, setPowerW] = useState(COINS[DEFAULT_COIN].calcPowerW);
  const [elecCost, setElecCost] = useState("0.10");

  // Switching coin re-seeds the rig inputs. A CPU default of 5000 H/s left in
  // place while the page says ZANO would quietly estimate a rig 5000x too
  // small, which reads as "Zano is worthless" rather than "wrong input".
  const selectCoin = (id: CoinId) => {
    setCoinId(id);
    setHashrate(COINS[id].calcHashrate);
    setUnit(COINS[id].calcUnit);
    setPowerW(COINS[id].calcPowerW);
  };

  const { summary } = usePoolSummary(coinId);
  const { price } = useCoinPrice(coin.coinGeckoId);

  const blocksPerDay = 86400 / coin.blockTimeS;

  const difficulty = summary?.network?.difficulty ?? 0;
  // lastblock.reward is atomic and always present; network.reward is often
  // null (same gotcha the /pool page documents) - don't use it. Converted with
  // THIS coin's atomicUnits (XEL is 1e8, not 1e12).
  const blockRewardCoin = atomicToCoin(summary?.lastblock?.reward ?? 0, coin);
  const coinUsd = price?.current_price ?? null;

  const unitMult = UNITS.find((u) => u.id === unit)?.mult ?? 1;
  const minerHs = (parseFloat(hashrate) || 0) * unitMult;
  const networkHs = difficulty / coin.blockTimeS;

  // NET of the pool fee, through the shared projection in src/lib/earnings.ts
  // (the same function feeds the proof line on /unmineable). This used to be
  // inline and projected gross emission with a 0% fee hardcoded in the
  // surrounding copy, so the moment the fee moved off zero the estimate
  // silently overstated every payout. Driven off the coin spec now.
  const dailyCoin = dailyCoinEstimate({
    minerHs,
    difficulty,
    blockTimeS: coin.blockTimeS,
    blockRewardCoin,
    poolFeePct: coin.poolFeePct,
  });
  const canEstimate = dailyCoin != null;

  const dailyElec =
    ((parseFloat(powerW) || 0) / 1000) * 24 * (parseFloat(elecCost) || 0);

  const rows = [
    { label: "HOURLY", mult: 1 / 24 },
    { label: "DAILY", mult: 1 },
    { label: "WEEKLY", mult: 7 },
    { label: "MONTHLY", mult: 30 },
  ];

  const fmtCoin = (v: number | null) =>
    v == null ? " - " : `${v.toFixed(4)} ${coin.symbol}`;
  const fmtUsd = (v: number | null) => (v == null ? " - " : `$${v.toFixed(2)}`);

  return (
    <div className="min-h-screen bg-background">
      <TerminalNav />

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl text-primary glow-text font-bold mb-2">
            * {coin.symbol} MINING CALCULATOR *
          </h1>
          <p className="text-muted-foreground text-sm">
            Live estimate from current network difficulty, block reward, and {coin.symbol} price
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <TerminalCard title="PICK_A_POOL">
            <div className="pt-2">
              <CoinSelector label="POOL" value={coinId} onChange={selectCoin} />
              <p className="text-[11px] text-muted-foreground mt-3">
                Switching pools re-seeds the rig inputs below with a typical {hardwarePhrase(coin)} for
                that coin. Overwrite them with your own numbers.
              </p>
            </div>
          </TerminalCard>
        </div>

        {/* Live network inputs the estimate is based on */}
        <div className="max-w-3xl mx-auto">
          <TerminalCard title="LIVE_NETWORK">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 text-center">
              <div>
                <div className="text-lg text-primary glow-text font-bold">
                  {difficulty ? difficulty.toLocaleString() : " - "}
                </div>
                <div className="text-[10px] text-muted-foreground tracking-wider mt-1">NET DIFFICULTY</div>
              </div>
              <div>
                <div className="text-lg text-secondary glow-text-cyan font-bold">
                  {networkHs > 0 ? formatHashrate(networkHs) : " - "}
                </div>
                <div className="text-[10px] text-muted-foreground tracking-wider mt-1">NET HASHRATE</div>
              </div>
              <div>
                <div className="text-lg text-foreground font-bold">
                  {/* XEL's reward is ~0.3, which 2 decimals would round away */}
                  {blockRewardCoin > 0 ? blockRewardCoin.toFixed(blockRewardCoin < 1 ? 3 : 2) : " - "}
                </div>
                <div className="text-[10px] text-muted-foreground tracking-wider mt-1">
                  BLOCK REWARD ({coin.symbol})
                </div>
              </div>
              <div>
                <div className="text-lg text-foreground font-bold">{formatPrice(coinUsd)}</div>
                <div className="text-[10px] text-muted-foreground tracking-wider mt-1">
                  {coin.symbol} PRICE
                </div>
              </div>
            </div>
          </TerminalCard>
        </div>

        {/* Inputs */}
        <div className="max-w-3xl mx-auto">
          <TerminalCard title="YOUR_RIG">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="sm:col-span-1">
                <label className="text-xs text-muted-foreground block mb-2">HASHRATE</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    value={hashrate}
                    onChange={(e) => setHashrate(e.target.value)}
                    className="w-full border border-border bg-muted/30 p-2 text-sm text-foreground outline-none focus:border-primary/50"
                  />
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as UnitId)}
                    className="border border-border bg-muted/30 p-2 text-sm text-foreground outline-none"
                  >
                    {UNITS.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">{coin.calcHint}</div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-2">POWER (WATTS)</label>
                <input
                  type="number"
                  min="0"
                  value={powerW}
                  onChange={(e) => setPowerW(e.target.value)}
                  className="w-full border border-border bg-muted/30 p-2 text-sm text-foreground outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-2">ELECTRICITY ($/kWh)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={elecCost}
                  onChange={(e) => setElecCost(e.target.value)}
                  className="w-full border border-border bg-muted/30 p-2 text-sm text-foreground outline-none focus:border-primary/50"
                />
              </div>
            </div>
          </TerminalCard>
        </div>

        {/* Results */}
        <div className="max-w-3xl mx-auto">
          <TerminalCard title="ESTIMATED_EARNINGS" glowing>
            {!canEstimate ? (
              <div className="py-6">
                <TerminalOutput variant="default">
                  {minerHs <= 0
                    ? "Enter your hashrate above to estimate earnings."
                    : "Waiting for live network data from the pool..."}
                </TerminalOutput>
              </div>
            ) : (
              <div className="overflow-x-auto pt-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-2 px-2">PERIOD</th>
                      <th className="text-right py-2 px-2">{coin.symbol}</th>
                      <th className="text-right py-2 px-2">USD</th>
                      <th className="text-right py-2 px-2">POWER COST</th>
                      <th className="text-right py-2 px-2">PROFIT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const coinAmt = dailyCoin == null ? null : dailyCoin * r.mult;
                      const usdAmt =
                        coinAmt == null || coinUsd == null ? null : coinAmt * coinUsd;
                      const elec = dailyElec * r.mult;
                      const profit = usdAmt == null ? null : usdAmt - elec;
                      return (
                        <tr key={r.label} className="border-b border-border/50">
                          <td className="py-2 px-2 text-muted-foreground">{r.label}</td>
                          <td className="py-2 px-2 text-right text-primary glow-text font-bold">
                            {fmtCoin(coinAmt)}
                          </td>
                          <td className="py-2 px-2 text-right text-secondary glow-text-cyan">
                            {fmtUsd(usdAmt)}
                          </td>
                          <td className="py-2 px-2 text-right text-muted-foreground">
                            {fmtUsd(elec)}
                          </td>
                          <td
                            className={`py-2 px-2 text-right font-bold ${
                              profit != null && profit < 0 ? "text-destructive" : "text-foreground"
                            }`}
                          >
                            {fmtUsd(profit)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="text-[10px] text-muted-foreground/80 tracking-wider mt-3 leading-relaxed border-t border-border/30 pt-2">
              :: ESTIMATE - your share of network hashrate x {blocksPerDay} blocks/day x live
              block reward. Assumes constant difficulty and average luck; the pool is {coin.payoutScheme} with
              a {coin.poolFeePct}% pool fee already deducted, so real payouts arrive as the pool finds blocks. USD figures move with
              the {coin.symbol} price.
              {coin.id === "zano" && (
                <>
                  {" "}
                  Zano interleaves PoS blocks, so the chain advances faster than this - only the
                  PoW blocks counted here are minable.
                </>
              )}
            </div>
          </TerminalCard>
        </div>

        {/* CTA */}
        <div className="text-center text-xs text-muted-foreground pt-4">
          Numbers look good?{" "}
          <Link to="/start" className="text-primary hover:underline">
            Get started mining
          </Link>{" "}
          | Already mining?{" "}
          <Link to="/pool" className="text-primary hover:underline">
            Check your stats
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Calculator;
