import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { TerminalNav } from "@/components/terminal/TerminalNav";
import { SiteFooter } from "@/components/terminal/SiteFooter";
import { TerminalCard, TerminalOutput, ASCIISpinner } from "@/components/terminal";
import { formatHashrate } from "@/lib/utils";
import { coinById, type CoinId, type CoinSpec } from "@/lib/coins";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  usePoolSummary,
  usePoolAddressStats,
  usePoolMinerHashrate,
  atomicToCoin,
  type PoolWorker,
  type PoolPayment,
  type HashratePoint,
  type MinerHashrate,
} from "@/hooks/usePoolStats";

// /pool - public "miner lookup" for all three pools (ZEPH, ZANO, XEL). A
// visitor pastes an address and sees their hashrate (current + 1h/6h/24h),
// their workers, pending balance + total paid, and recent payments. A
// pool-wide summary card always sits up top. The coin is detected server-side
// (/api/v1/pool/miner); the rest is read from that pool's own read-only API
// through its same-origin nginx prefix, normalised in hooks/usePoolStats.ts.

function relativeAgo(sec: number): string {
  if (!sec) return "never";
  const d = Math.max(0, Math.floor(Date.now() / 1000 - sec));
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

// active-now = a share within the pool's hashrate window (600s = 10 min)
const ONLINE_WINDOW_S = 600;
const isOnline = (lastShare: number) =>
  lastShare > 0 && Date.now() / 1000 - lastShare <= ONLINE_WINDOW_S;

// A worker with no share for a day is a decommissioned rig, not a status. The
// pool keeps every worker name it has ever seen for an address, so a rig that
// was renamed or retired sat in this table as OFFLINE indefinitely - the
// operator saw one with a 10-day-old last share listed beside the live ones,
// which makes the table read as broken rather than informative. Hide those,
// but SAY how many were hidden: a row that vanishes silently is worse than a
// stale one. Exported for the test.
export const STALE_AFTER_S = 24 * 3600;
export const isStale = (lastShare: number, now = Date.now() / 1000) =>
  !(lastShare > 0) || now - lastShare > STALE_AFTER_S;

// Prefer the canonical (api-server) hashrate - the same source the leaderboard
// reads - and fall back to the pool API's own figure only until the canonical
// endpoint has data for this address (e.g. a brand-new miner).
function canonHR(
  canon: MinerHashrate | undefined,
  key: "hashrate_live" | "hashrate_1h" | "hashrate_6h" | "hashrate_24h",
  fallback: number
): number {
  if (canon && canon.found) return Number(canon[key]) || 0;
  return fallback || 0;
}

// Every amount goes through the coin's own atomicUnits (1e12 for ZEPH/ZANO,
// 1e8 for XEL) - a shared 1e12 divisor would show XEL 10,000x too small.
function fmtCoin(atomic: number, coin: CoinSpec): string {
  return `${atomicToCoin(atomic, coin).toFixed(4)} ${coin.symbol}`;
}

// How often each pool adds a point to the per-address hashrate chart:
// cryptonote-nodejs-pool's chartsDataCollector ~30 min, xelis-pool every
// 15 min (STATS_INTERVAL). Both keep 24 h.
const CHART_STEP_MIN: Record<CoinId, number> = { zph: 30, zano: 30, xel: 15 };

// Persist the last looked-up address so navigating away from /pool and back
// (the nav "MY STATS" link goes to /pool with no ?address=) restores the user's
// stats instead of clearing the field. A URL ?address= still takes precedence.
const LS_ADDRESS_KEY = "zeph_pool_last_address";
function readStoredAddress(): string {
  try {
    return localStorage.getItem(LS_ADDRESS_KEY) ?? "";
  } catch {
    return "";
  }
}

const Pool = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlAddress = searchParams.get("address") ?? "";

  // `input` is the live text field; `query` is the address actually being
  // looked up (set on submit or from the URL). Keeping them separate means
  // typing doesn't fire a request on every keystroke.
  // Seed from the URL, else the last-used address saved in localStorage.
  const [input, setInput] = useState(() => urlAddress || readStoredAddress());
  const [query, setQuery] = useState<string | null>(
    () => urlAddress || readStoredAddress() || null
  );

  // Honor ?address= on first load / back-forward nav.
  useEffect(() => {
    if (urlAddress && urlAddress !== query) {
      setInput(urlAddress);
      setQuery(urlAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlAddress]);

  // ONE address box, no coin selector. This query is what identifies the coin:
  // the api-server reads the address prefix and tells us which pool it belongs
  // to. Everything below keys off `coin`, so a ZEPHYR... address and a Zx...
  // address light up completely different backends with no UI change and no
  // address parsing in the browser.
  const { hashrate: canon } = usePoolMinerHashrate(query);
  const coin: CoinSpec = coinById(canon?.coin);

  // Both of these follow the detected coin. Until the detection round-trip
  // lands, `coin` is the default (Zephyr) - which is also what an empty page
  // should show, so there is no flicker for the common case.
  const { summary } = usePoolSummary(coin.id);
  const { stats, isLoading, error, notFound } = usePoolAddressStats(query, coin.id);

  // On first mount, if the address came from localStorage (no ?address= in the
  // URL on arrival), reflect it in the URL so a refresh or shared link works.
  useEffect(() => {
    if (!urlAddress && query) {
      setSearchParams({ address: query }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const addr = input.trim();
    if (!addr) return;
    setQuery(addr);
    try {
      localStorage.setItem(LS_ADDRESS_KEY, addr);
    } catch {
      /* ignore storage failures (private mode, quota) */
    }
    setSearchParams({ address: addr }, { replace: true });
  };

  // A non-"not found" error means the pool API was unreachable / errored.
  const fetchError = error && !notFound;

  return (
    <div className="min-h-screen bg-background">
      <TerminalNav />

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="text-center mb-4">
          <h1 className="text-2xl text-primary glow-text font-bold mb-2">
            * {coin.symbol} POOL | MY STATS *
          </h1>
          <p className="text-muted-foreground text-sm">
            Look up your {coin.name} ({coin.symbol}) hashrate &amp; payouts
          </p>
        </div>

        {/* ─── Pool-wide summary (always shown) ─── */}
        <div className="max-w-5xl mx-auto">
          <TerminalCard title="POOL_SUMMARY">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 pt-2">
              <SummaryStat
                label="POOL HASHRATE"
                value={formatHashrate(summary?.hashrate ?? 0)}
                accent
              />
              <SummaryStat
                label="MINERS / WORKERS"
                value={`${summary?.miners ?? 0} / ${summary?.workers ?? 0}`}
              />
              <SummaryStat label="BLOCKS FOUND" value={`${summary?.totalBlocks ?? 0}`} />
              <SummaryStat
                label="LAST BLOCK"
                value={summary?.lastblock?.height ? `#${summary.lastblock.height}` : " - "}
              />
              <SummaryStat
                label="NET DIFFICULTY"
                value={
                  summary?.network?.difficulty
                    ? summary.network.difficulty.toLocaleString()
                    : " - "
                }
              />
            </div>
            <div className="text-[10px] text-muted-foreground/70 tracking-wide mt-3 pt-2 border-t border-border/30">
              {coin.id === "xel"
                ? "~ Pool hashrate is a smoothed average of recent shares"
                : "~ Hashrate is a ~10-minute rolling average"}{" "}
              - short-term readings swing above and below your sustained rate. It reflects
              current work, not a total of coins mined.
            </div>
          </TerminalCard>
        </div>

        {/* ─── Address lookup ─── */}
        <div className="max-w-5xl mx-auto">
          <TerminalCard title="MINER_LOOKUP">
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-2">
                  root@pwnda:~$ enter_mining_address
                </label>
                <div className="flex items-center gap-2 border border-border bg-muted/30 p-2">
                  <span className="text-primary">&gt;</span>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    className="flex-1 bg-transparent outline-none text-foreground text-sm font-mono"
                    placeholder="ZEPHYR..., Zx... or xel:..."
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="bg-primary text-primary-foreground px-4 py-1 text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {isLoading ? <ASCIISpinner /> : "LOOK UP"}
                  </button>
                </div>
              </div>

              {fetchError && (
                <TerminalOutput variant="error">
                  Could not reach the pool API. Try again in a moment.
                </TerminalOutput>
              )}
              {notFound && (
                <TerminalOutput variant="error">
                  No mining activity found for that address yet. Double-check it, or
                  start mining - stats appear after your first share.
                </TerminalOutput>
              )}
            </form>
          </TerminalCard>
        </div>

        {/* ─── Miner results ─── */}
        {stats && !notFound && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Hashrate row - CANONICAL (Sum accepted difficulty / window),
                served by the api-server so these match the miner's leaderboard
                row exactly. 1H is the stable headline; LIVE is the fast-moving
                10-min ticker. Falls back to the pool API's own figures if the
                canonical endpoint has no data yet for this address. */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <HashrateStat label="HASHRATE (1H)" value={canonHR(canon, "hashrate_1h", stats.hashrate_1h)} accent />
              <HashrateStat label="LIVE" value={canonHR(canon, "hashrate_live", stats.hashrate)} sub="~10 min | fluctuates" />
              <HashrateStat label="6H AVG" value={canonHR(canon, "hashrate_6h", stats.hashrate_6h)} />
              <HashrateStat label="24H AVG" value={canonHR(canon, "hashrate_24h", stats.hashrate_24h)} />
            </div>

            {/* Hashrate history chart (24h, ~30-min steps from the pool's chartsDataCollector) */}
            <TerminalCard title="HASHRATE_HISTORY_24H">
              <HashrateChart data={stats.hashrateChart} stepMin={CHART_STEP_MIN[coin.id]} />
            </TerminalCard>

            {/* Balance row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TerminalCard title="PENDING_BALANCE" glowing>
                <div className="text-center py-4">
                  <div className="text-3xl text-primary glow-text font-bold">
                    {fmtCoin(stats.balance, coin)}
                  </div>
                  <div className="text-[10px] text-muted-foreground tracking-wider mt-1">
                    UNPAID - accrues until the payout threshold
                  </div>
                  {/* Only xelis-pool splits out the immature (unconfirmed-block)
                      share; show it so a new XEL miner does not read a 0 above
                      as "nothing earned". */}
                  {(stats.balancePending ?? 0) > 0 && (
                    <div className="text-[10px] text-muted-foreground/80 tracking-wider mt-1">
                      + {fmtCoin(stats.balancePending ?? 0, coin)} awaiting {coin.maturityConfs} block
                      confirmations
                    </div>
                  )}
                </div>
              </TerminalCard>
              <TerminalCard title="TOTAL_PAID">
                <div className="text-center py-4">
                  <div className="text-3xl text-secondary glow-text-cyan font-bold">
                    {fmtCoin(stats.paid, coin)}
                  </div>
                  <div className="text-[10px] text-muted-foreground tracking-wider mt-1">
                    {/* xelis-pool reports no last-share time (lastShare 0);
                        the canonical endpoint's last_seen covers it. */}
                    LIFETIME | last share{" "}
                    {relativeAgo(stats.lastShare || (canon?.found ? Number(canon.last_seen) || 0 : 0))}
                  </div>
                </div>
              </TerminalCard>
            </div>

            {/* Estimated earnings - projected from this miner's 24h-avg
                hashrate vs. current network difficulty. An ESTIMATE only. */}
            <EstimatedEarnings
              minerHashrate={canonHR(canon, "hashrate_24h", stats.hashrate_24h)}
              difficulty={summary?.network?.difficulty ?? 0}
              // lastblock.reward is in ATOMIC units and is always present (the network's
              // last block; for XEL the mapping fills it with the CURRENT network reward).
              // network.reward is in whole ZEPH on the cnp pools but is frequently null -
              // using it here would zero out the estimate, so don't.
              rewardAtomic={summary?.lastblock?.reward ?? 0}
              coin={coin}
            />

            {/* Workers */}
            <TerminalCard title="WORKERS">
              {coin.workerStats ? (
                <WorkersTable workers={stats.workers} />
              ) : (
                <div className="py-6 text-center text-muted-foreground text-sm">
                  the {coin.symbol} pool reports per-address totals only - no per-worker breakdown
                </div>
              )}
            </TerminalCard>

            {/* Recent payments */}
            <TerminalCard title="RECENT_PAYMENTS">
              <PaymentsList payments={stats.payments} coin={coin} />
            </TerminalCard>
          </div>
        )}

        {/* Empty state - nothing looked up yet */}
        {!query && !stats && (
          <div className="text-center text-muted-foreground py-12">
            <div className="text-4xl mb-4">*</div>
            <p>
              Enter your Zephyr (ZEPHYR...), Zano (Zx...) or Xelis (xel:...) address above - the
              pool is detected automatically.
            </p>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

function HashrateChart({ data, stepMin }: { data: HashratePoint[]; stepMin: number }) {
  const points = data.map((p) => ({
    time: new Date(p.ts * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    value: p.hashrate,
  }));
  // The pool records a point every `stepMin` minutes; a brand-new / brief miner
  // has <2, which can't draw a line - show a clear "building" message instead.
  if (points.length < 2) {
    return (
      <div className="h-48 flex flex-col items-center justify-center text-center px-4">
        <div className="text-sm text-muted-foreground tracking-wider mb-1">
          :: BUILDING HASHRATE HISTORY ::
        </div>
        <div className="text-[10px] text-muted-foreground/70 max-w-md">
          the chart fills in as you keep mining - the pool records a point roughly every{" "}
          {stepMin}&nbsp;min, up to 24&nbsp;h.
        </div>
      </div>
    );
  }
  return (
    <div className="h-56 pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
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
    </div>
  );
}

// ── Estimated earnings ───────────────────────────────────────────────────
// Projects this miner's share of network hashrate onto the daily block
// emission, NET of the pool fee. Naive: assumes constant difficulty and average luck,
// and real payouts swing with both. Uses the 24h-avg hashrate (more stable
// than "now").
//
// Block time comes from the coin spec, not a constant. Zephyr and Zano use a
// 120 s PoW target and Xelis 5 s - and for Zano specifically it must be the POW
// target, not the ~60 s chain average the interleaved PoS blocks produce,
// because only PoW blocks are minable.
function EstimatedEarnings({
  minerHashrate,
  difficulty,
  rewardAtomic,
  coin,
}: {
  minerHashrate: number;
  difficulty: number;
  rewardAtomic: number;
  coin: CoinSpec;
}) {
  const blocksPerDay = 86400 / coin.blockTimeS;
  const blockReward = atomicToCoin(rewardAtomic, coin);
  const networkHashrate = difficulty / coin.blockTimeS;
  const canEstimate =
    minerHashrate > 0 && networkHashrate > 0 && blockReward > 0;

  // NET of the pool fee - see the same note in Calculator.tsx. Projecting gross
  // emission would overstate what actually lands in a miner's balance.
  const estDaily = canEstimate
    ? (minerHashrate / networkHashrate) * blocksPerDay * blockReward * (1 - coin.poolFeePct / 100)
    : null;

  const fmt = (v: number | null): string =>
    v == null ? " - " : `${v.toFixed(4)} ${coin.symbol}`;

  return (
    <TerminalCard title="ESTIMATED_EARNINGS">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <EstStat label="EST. DAILY" value={fmt(estDaily)} accent />
        <EstStat label="EST. WEEKLY" value={fmt(estDaily == null ? null : estDaily * 7)} />
        <EstStat label="EST. MONTHLY" value={fmt(estDaily == null ? null : estDaily * 30)} />
      </div>
      <div className="text-[10px] text-muted-foreground/80 tracking-wider mt-3 leading-relaxed border-t border-border/30 pt-2">
        :: ESTIMATE - based on your 24&nbsp;h average hashrate vs. current network
        difficulty, net of the {coin.poolFeePct}% pool fee. Real payouts vary with
        luck and network changes.
      </div>
    </TerminalCard>
  );
}

function EstStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="text-center py-2">
      <div
        className={
          accent
            ? "text-2xl text-primary glow-text font-bold"
            : "text-2xl text-secondary glow-text-cyan font-bold"
        }
      >
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground tracking-wider mt-1">{label}</div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="text-center py-1">
      <div
        className={
          accent
            ? "text-xl text-primary glow-text font-bold"
            : "text-xl text-foreground font-bold"
        }
      >
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground tracking-wider mt-1">{label}</div>
    </div>
  );
}

function HashrateStat({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: number;
  accent?: boolean;
  sub?: string;
}) {
  return (
    <TerminalCard title={label} className="hover-glow">
      <div className="text-center py-2">
        <div
          className={
            accent
              ? "text-2xl text-primary glow-text font-bold"
              : "text-2xl text-secondary glow-text-cyan font-bold"
          }
        >
          {formatHashrate(value)}
        </div>
        {sub && (
          <div className="text-[10px] text-muted-foreground tracking-wider mt-1">{sub}</div>
        )}
      </div>
    </TerminalCard>
  );
}

/**
 * A miner that sends no worker name is stored by the pool under the LITERAL
 * string "undefined" - that is upstream cryptonote-nodejs-pool's sentinel, not a
 * JS value that leaked. `w.name || ...` does not catch it because it is truthy,
 * so the table used to print the word "undefined" at people, which reads like a
 * bug in the site.
 *
 * More miners land here since 2026-09-02: the pools stopped treating the
 * placeholder password `x` as a worker name, so `-p x` (what a miner sends when
 * given no password) is now correctly "unnamed" instead of a worker called "x".
 * Give it a worker name with `-u ADDRESS.rig1`.
 * See PwndaVault analyses/pool-worker-names-and-passwords.md.
 */
function workerLabel(name: string | undefined | null): string {
  const n = (name ?? "").trim();
  return !n || n === "undefined" ? "(default)" : n;
}

function WorkersTable({ workers: all }: { workers: PoolWorker[] }) {
  const workers = all.filter((w) => !isStale(w.lastShare));
  const hidden = all.length - workers.length;
  const hiddenNote = hidden > 0 ? (
    <div className="pt-2 text-[11px] text-muted-foreground">
      {hidden} worker{hidden === 1 ? "" : "s"} with no share in 24h hidden
    </div>
  ) : null;

  if (!all.length) {
    return (
      <div className="py-6 text-center text-muted-foreground text-sm">
        no workers reported - connect a miner to this address
      </div>
    );
  }
  if (!workers.length) {
    // Everything this address ever ran has gone quiet. Say that, not "no
    // workers" - the difference matters to someone whose rig just died.
    return (
      <div className="py-6 text-center text-muted-foreground text-sm">
        no shares from any worker in the last 24h
        {hiddenNote}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto pt-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-border">
            <th className="text-left py-2 px-2">WORKER</th>
            <th className="text-left py-2 px-2">STATUS</th>
            <th className="text-right py-2 px-2">HASHRATE</th>
            <th className="text-right py-2 px-2">LAST SHARE</th>
          </tr>
        </thead>
        <tbody>
          {workers.map((w, i) => {
            const online = isOnline(w.lastShare);
            return (
              <tr
                key={`${w.name}-${i}`}
                className="border-b border-border/50 hover:bg-muted/30 transition-colors"
              >
                <td className="py-2 px-2 text-foreground font-mono">{workerLabel(w.name)}</td>
                <td className="py-2 px-2">
                  <span
                    className={`px-2 py-0.5 text-[10px] border ${
                      online
                        ? "border-green-500/50 text-green-500"
                        : "border-destructive/50 text-destructive"
                    }`}
                  >
                    {online ? "ACTIVE" : "OFFLINE"}
                  </span>
                </td>
                <td className="py-2 px-2 text-right text-secondary glow-text-cyan">
                  {formatHashrate(w.hashrate ?? 0)}
                </td>
                <td className="py-2 px-2 text-right text-muted-foreground">
                  {relativeAgo(w.lastShare)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {hiddenNote}
    </div>
  );
}

function PaymentsList({ payments, coin }: { payments: PoolPayment[]; coin: CoinSpec }) {
  if (!payments.length) {
    return (
      <div className="py-6 text-center text-muted-foreground text-sm">
        no payments yet - they appear once your balance crosses the payout threshold
      </div>
    );
  }
  return (
    <div className="space-y-2 pt-2">
      {payments.slice(0, 10).map((p, i) => (
        <div
          key={`${p.txHash || "p"}-${p.time}-${i}`}
          className="flex items-center justify-between text-xs py-1 border-b border-border/30"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-muted-foreground whitespace-nowrap">
              {p.time ? new Date(p.time * 1000).toLocaleString() : " - "}
            </span>
            {p.txHash && (
              <span className="text-muted-foreground/70 font-mono truncate">
                {p.txHash.slice(0, 12)}...
              </span>
            )}
          </div>
          <span className="text-primary font-bold whitespace-nowrap">
            {fmtCoin(p.amount, coin)}
          </span>
        </div>
      ))}
      {payments.length > 10 && (
        <div className="text-center text-muted-foreground text-[10px] pt-1">
          showing 10 of {payments.length} payments
        </div>
      )}
    </div>
  );
}

export default Pool;
