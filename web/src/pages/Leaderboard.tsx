import { useMemo, useState } from "react";
import { TerminalNav } from "@/components/terminal/TerminalNav";
import { SiteFooter } from "@/components/terminal/SiteFooter";
import { TerminalCard } from "@/components/terminal";
import {
  useAttestedLeaderboardWithFallback,
  useAttestedHashrateHistory,
  AttestPeriod,
  AttestEntry,
} from "@/hooks/useAttestedLeaderboard";
import { formatHashrate, cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

// /leaderboard - wallet-attested miner leaderboard. Single-coin Zephyr pool:
// every miner runs RandomX (xmr / zph), verification === "pow". One merged
// CPU ranking - no tiers, no GPU subsections.
//
// Top of the page shows cumulative network hashrate + wallet count, modeled
// after the old in-pool dashboard's stat row. Underneath is the per-wallet
// ranking. Verified entries get a small + next to their hashrate - no badges,
// no separator rows, no in-page explainers.

const PERIODS: AttestPeriod[] = ["1h", "6h", "24h", "7d", "30d"];

function periodHours(period: AttestPeriod): number {
  switch (period) {
    case "1h":
      return 1;
    case "6h":
      return 6;
    case "7d":
      return 24 * 7;
    case "30d":
      return 24 * 30;
    default:
      return 24;
  }
}

// This board is the hosted Zephyr (ZEPH) pool only - coin=zph. Other RandomX
// coins (xmr) come from the separate, deprecated wallet-attest layer and are NOT
// shown here: the operator's requirement is "only the hosted zephyr pool".
// Three self-hosted pools, one board each. Zephyr is RandomX/CPU, Zano is
// ProgPowZ/GPU, Xelis is XelisHashV3 on GPUs AND CPUs (filed in the cpu tier:
// tiers are per coin, so a GPU XEL rig lands on this board too). Hashrates are NOT comparable across
// algorithms - a RandomX CPU does a few KH/s while a ProgPowZ GPU does tens of
// MH/s, and an XelisHashV3 H/s is a different unit of work again - so each coin
// gets its own board rather than one merged ranking. formatHashrate()
// auto-scales H/KH/MH/GH, so no board needs special casing.
//
// The history chart is per TIER (the /attest/hashrate/history endpoint takes no
// coin), so with XEL in the cpu tier the ZEPH and XEL boards draw the same
// combined CPU curve until that endpoint grows a coin filter.
const BOARDS = [
  { coin: "zph", label: "ZEPH / CPU", tier: "cpu" as const, algo: "RandomX" },
  { coin: "zano", label: "ZANO / GPU", tier: "gpu" as const, algo: "ProgPowZ" },
  { coin: "xel", label: "XEL / GPU+CPU", tier: "cpu" as const, algo: "XelisHashV3" },
];

// A wallet counts as "online" / active-now if its most recent share (last_seen)
// is within the pool's hashrate window (600 s = 10 min). The period board still
// lists everyone who contributed within the window (24h/7d/...); this only drives
// the "active now" stat + the per-row online dot.
const ONLINE_WINDOW_S = 600;
const isOnline = (lastSeen: number) =>
  lastSeen > 0 && Date.now() / 1000 - lastSeen <= ONLINE_WINDOW_S;

function relativeAgo(sec: number): string {
  if (!sec) return " - ";
  const d = Math.max(0, Math.floor(Date.now() / 1000 - sec));
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

const Leaderboard = () => {
  // Default to the 1h view: it's the canonical rolling window served from the
  // pre-aggregated rollup (fast) and it tracks a miner's current rate closely,
  // so it matches the number on their My Stats page.
  const [period, setPeriod] = useState<AttestPeriod>("1h");
  const [boardIdx, setBoardIdx] = useState(0);
  const board = BOARDS[boardIdx];

  // Server-side filter to the selected board's coin. Same endpoint, same
  // polling (60 s), same aggregation as before - only the coin differs.
  const { entries, generatedAt, isLoading, error } = useAttestedLeaderboardWithFallback({
    period,
    coin: board.coin,
  });

  // Defensive client-side filter: the server already filters by coin, but a
  // client mining two coins would otherwise be able to surface a row from the
  // other board if the API ever loosened.
  const cpuEntries = useMemo<AttestEntry[]>(
    () => entries.filter((e) => e.coin === board.coin),
    [entries, board.coin]
  );

  // One merged ranking, sorted by hashrate.
  const cpuRanked = useMemo<AttestEntry[]>(
    () =>
      [...cpuEntries]
        .sort((a, b) => b.avg_hashrate_hs - a.avg_hashrate_hs)
        .map((e, i) => ({ ...e, rank: i + 1 })),
    [cpuEntries]
  );

  const cumulativeHashrate = useMemo(
    () => cpuEntries.reduce((sum, e) => sum + e.avg_hashrate_hs, 0),
    [cpuEntries]
  );
  const totalShares = useMemo(
    () => cpuEntries.reduce((sum, e) => sum + e.total_shares, 0),
    [cpuEntries]
  );
  const totalWallets = useMemo(
    () => new Set(cpuEntries.map((e) => e.display_name_or_short_id)).size,
    [cpuEntries]
  );
  const onlineWallets = useMemo(
    // "active now" = distinct wallets whose most recent share is within ONLINE_WINDOW_S
    () =>
      new Set(
        cpuEntries.filter((e) => isOnline(e.last_seen)).map((e) => e.display_name_or_short_id)
      ).size,
    [cpuEntries]
  );

  // Hashrate time-series for the chart card - backed by /hashrate/history,
  // cpu tier. Falls back to a demo curve ONLY when the API is unreachable. A
  // successful empty response (no recent mining activity) sets `isEmpty` and we
  // render a clear message instead of a synthesized curve.
  const {
    points: hashratePoints,
    isEmpty: hashrateIsEmpty,
  } = useAttestedHashrateHistory({
    tier: board.tier,
    hours: periodHours(period),
  });
  const chartData = useMemo(
    () =>
      hashratePoints.map((p) => ({
        time: formatChartTick(p.hour_ts, period),
        value: p.hashrate_hs,
        clients: p.client_count,
      })),
    [hashratePoints, period]
  );

  return (
    <div className="min-h-screen bg-background">
      <TerminalNav />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="text-center mb-4">
          <h1 className="text-2xl text-primary glow-text font-bold mb-2">
            # WALLET LEADERBOARD #
          </h1>
          {/* /dashboard pointer removed 2026-06-28 - old worker dashboard taken out of the UI */}
        </div>

        {/* Stats row - cumulative hashrate across all RandomX wallets */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          <TerminalCard title="AVG HASHRATE" className="hover-glow">
            <div className="text-center py-2">
              <div className="text-2xl text-primary glow-text font-bold">
                {formatHashrate(cumulativeHashrate)}
              </div>
              <div className="text-[10px] text-muted-foreground tracking-wider mt-1">
                {board.label.split(" / ")[1]} | avg over {period}
              </div>
            </div>
          </TerminalCard>

          <TerminalCard title="WALLETS" className="hover-glow">
            <div className="text-center py-2">
              <div className="text-2xl text-secondary glow-text-cyan font-bold">
                {onlineWallets}
              </div>
              <div className="text-[10px] text-muted-foreground tracking-wider mt-1">
                ACTIVE NOW
              </div>
              <div className="text-[9px] text-muted-foreground/60 mt-0.5">
                {totalWallets} in {period}
              </div>
            </div>
          </TerminalCard>

          <TerminalCard title="SHARES" className="hover-glow col-span-2 md:col-span-1">
            <div className="text-center py-2">
              <div className="text-2xl text-primary glow-text font-bold">
                {totalShares.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground tracking-wider mt-1">
                TOTAL
              </div>
            </div>
          </TerminalCard>
        </div>

        {/* Hashrate chart - same shape as the old Dashboard's
            HASHRATE_HISTORY_24H card. Reads from /api/v1/attest/hashrate/history
            which buckets lb_hashrate_hourly per hour for the cpu tier. */}
        <div className="max-w-4xl mx-auto">
          <TerminalCard title={`HASHRATE_HISTORY_${board.tier.toUpperCase()}_${period.toUpperCase()}`}>
            <div className="h-64 pt-4">
              {hashrateIsEmpty ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="text-sm text-muted-foreground tracking-wider mb-2">
                    :: NO RECENT MINING ACTIVITY ::
                  </div>
                  <div className="text-[10px] text-muted-foreground/70 max-w-md">
                    no {board.tier.toUpperCase()}-tier attestations landed in the last {period}.
                    the chart will refresh automatically as soon as miners reconnect.
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis
                      dataKey="time"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => formatHashrate(v)}
                      width={70}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "4px",
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: "12px",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      itemStyle={{ color: "hsl(var(--primary))" }}
                      formatter={(value: number) => [formatHashrate(value), "Hashrate"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </TerminalCard>
        </div>

        {/* Period toggle - coin filter dropped; the board is a single flat
            RandomX ranking (xmr+zph hashrate values are comparable). */}
        <div className="max-w-4xl mx-auto">
          <TerminalCard title="FILTERS">
            <div className="pt-2">
              <FilterField label="POOL">
                <div className="flex gap-1">
                  {BOARDS.map((b, i) => (
                    <button
                      key={b.coin}
                      type="button"
                      onClick={() => setBoardIdx(i)}
                      title={`${b.label} (${b.algo})`}
                      className={cn(
                        "flex-1 px-2 py-1 text-xs font-mono border transition-colors",
                        boardIdx === i
                          ? "text-primary glow-text bg-primary/10 border-primary/50"
                          : "text-muted-foreground border-border hover:text-foreground"
                      )}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </FilterField>
              <FilterField label="PERIOD">
                <div className="flex gap-1">
                  {PERIODS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriod(p)}
                      className={cn(
                        "flex-1 px-2 py-1 text-xs font-mono border transition-colors",
                        period === p
                          ? "text-primary glow-text bg-primary/10 border-primary/50"
                          : "text-muted-foreground border-border hover:text-foreground"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </FilterField>
            </div>
          </TerminalCard>
        </div>

        {/* Ranking - single merged RandomX table. */}
        <div className="max-w-4xl mx-auto">
          <TerminalCard title="RANKING">
            <RankingTable
              rows={cpuRanked}
              period={period}
              isLoading={isLoading}
              emptyLabel={
                error
                  ? "leaderboard temporarily unavailable - retrying..."
                  : "no miners in this window yet"
              }
            />
            <div className="text-[10px] text-muted-foreground/70 tracking-wide mt-3 pt-2 border-t border-border/30">
              ~ HASHRATE here is the AVERAGE over the selected period (from ~10-min rolling
              samples), not your instantaneous rate - it lags a live spike or a pool restart and
              climbs back as the window fills. For your current/live rate, open MY STATS.
            </div>
          </TerminalCard>
        </div>

        {generatedAt && (
          <div className="max-w-4xl mx-auto text-[10px] text-muted-foreground text-right">
            generated_at: {new Date(generatedAt * 1000).toLocaleTimeString()}  - 
            refreshes every 60s
          </div>
        )}

      </main>
      <SiteFooter />
    </div>
  );
};

function RankingTable({
  rows,
  period,
  isLoading,
  emptyLabel,
}: {
  rows: AttestEntry[];
  period: AttestPeriod;
  isLoading: boolean;
  emptyLabel: string;
}) {
  return (
    <div className="overflow-x-auto pt-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-border">
            <th className="text-left py-2 px-2 w-16">RANK</th>
            <th className="text-left py-2 px-2">WALLET</th>
            <th className="text-right py-2 px-2">AVG HASHRATE ({period})</th>
            <th className="text-right py-2 px-2">SHARES</th>
            <th className="text-right py-2 px-2">LAST SEEN</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-4 text-center text-muted-foreground">
                loading...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-6 text-center text-muted-foreground">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((entry) => (
              <LeaderboardRow
                key={`${entry.coin}-${entry.display_name_or_short_id}-${entry.rank}`}
                entry={entry}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function LeaderboardRow({ entry }: { entry: AttestEntry }) {
  const isVerified = entry.verification === "pow";
  const online = isOnline(entry.last_seen);
  return (
    <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
      <td className="py-2 px-2 text-primary font-bold">#{entry.rank}</td>
      <td className="py-2 px-2 text-foreground font-bold">
        <span
          className={cn("mr-1.5", online ? "text-primary glow-text" : "text-muted-foreground/40")}
          title={online ? "Online - mined within the last 10 min" : "Offline - no recent shares"}
          aria-label={online ? "online" : "offline"}
        >
          *
        </span>
        {entry.display_name_or_short_id}
      </td>
      <td className="py-2 px-2 text-right">
        <span className="text-secondary glow-text-cyan">
          {formatHashrate(entry.avg_hashrate_hs)}
        </span>
        {isVerified && (
          <span
            className="ml-1.5 text-primary glow-text"
            title="Hashrate independently verified from cryptographic share attestations."
            aria-label="verified"
          >
            +
          </span>
        )}
      </td>
      <td className="py-2 px-2 text-right text-muted-foreground">
        {entry.total_shares.toLocaleString()}
      </td>
      <td className="py-2 px-2 text-right">
        {online ? (
          <span className="text-primary">online</span>
        ) : (
          <span className="text-muted-foreground/70">{relativeAgo(entry.last_seen)}</span>
        )}
      </td>
    </tr>
  );
}

function formatChartTick(hourTS: number, period: AttestPeriod): string {
  const d = new Date(hourTS * 1000);
  // Sub-day windows (1h, 6h, 24h): time-of-day labels. 1h was missing here, so
  // it fell through to the date branch and every tick showed today's date.
  if (period === "1h" || period === "6h" || period === "24h") {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  // 7d / 30d: calendar-date labels
  return d.toLocaleDateString([], { month: "2-digit", day: "2-digit" });
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] tracking-wider text-muted-foreground font-mono">
        {label}
      </label>
      {children}
    </div>
  );
}

export default Leaderboard;
