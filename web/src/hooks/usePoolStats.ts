import { useQuery } from "@tanstack/react-query";
import { coinById, DEFAULT_COIN, type CoinId, type CoinSpec } from "@/lib/coins";

// Data hooks for the public /pool "miner lookup" page and the pool cards on
// Home / Calculator. Each coin's pool has its own read-only API behind a
// same-origin nginx prefix (CoinSpec.apiBase):
//
//   zph  /pool-api/   -> cryptonote-nodejs-pool :8117
//   zano /zano-api/   -> cryptonote-nodejs-pool :8118
//   xel  /xelis-api/  -> xelis-pool master API :8119 (allow-list: /stats,
//                        /stats/<xel:address>, /info - everything else 404)
//
//   usePoolSummary(coin)        -> GET <apiBase>/stats
//   usePoolAddressStats(a, coin)-> GET <apiBase>/stats_address?address=a  (cnp)
//                                  GET <apiBase>/stats/<a>                (xel)
//
// ALL shape differences are absorbed HERE: the fetchers branch on the coin id
// and return the same PoolSummary / MinerStats types, in ATOMIC units, for
// every coin. Pages never see a raw pool response.
//
// Not-found detection differs per pool:
//   - cryptonote-nodejs-pool returns HTTP 200 with {"error":"Not found"}, so
//     success is the *absence* of an `error` key, not res.ok.
//   - xelis-pool returns HTTP 200 with all zeros for an address it has never
//     seen, and HTTP 404 {"error":{...}} for the pool's own address.

// ── Atomic-unit conversion ───────────────────────────────────────────────
// ZEPH uses 1e12 atomic units per coin (config.coinUnits). Balances/payments
// from the pool API are in atomic units; UI shows whole ZEPH.
export const ZEPH_UNITS = 1_000_000_000_000;

export function atomicToZeph(atomic: number | string | undefined | null): number {
  return atomicToCoin(atomic, ZEPH_UNITS);
}

/**
 * Atomic units -> whole coins for ANY pool coin. ZEPH and ZANO use 1e12, XEL
 * 1e8 - dividing an XEL amount by 1e12 would show every balance 10,000x too
 * small, so pages must go through this, never atomicToZeph, for a non-ZEPH coin.
 * Accepts a CoinSpec or a bare units number.
 */
export function atomicToCoin(
  atomic: number | string | undefined | null,
  coin: CoinSpec | number,
): number {
  const units = typeof coin === "number" ? coin : coin.atomicUnits;
  const n = typeof atomic === "string" ? Number(atomic) : atomic ?? 0;
  if (!n || Number.isNaN(n) || !units) return 0;
  return n / units;
}

/**
 * Whole coins -> atomic units. xelis-pool reports WHOLE XEL (floats), while the
 * shared PoolSummary / MinerStats types carry atomic amounts, so the Xelis
 * mapping converts on the way in. Rounded so 0.1 + 0.2 style float noise never
 * leaks into an "atomic" integer.
 */
export function coinToAtomic(whole: number | string | undefined | null, coin: CoinSpec): number {
  const n = typeof whole === "string" ? Number(whole) : whole ?? 0;
  if (!n || !Number.isFinite(n)) return 0;
  return Math.round(n * coin.atomicUnits);
}

// ── Pool-wide summary (GET /stats) ───────────────────────────────────────

export interface PoolNetwork {
  difficulty?: number;
  height?: number;
  /** cnp: as the pool reports it (often null). xel: ATOMIC current block reward. */
  reward?: number;
}

/**
 * The NETWORK's latest block, as the pages use it: `reward` (atomic) is the
 * per-block reward every earnings estimate multiplies by. For XEL this is
 * built from the current network height and reward - NOT xelis-pool's own
 * `last_block`, which is the pool's last FOUND block and all zeros until the
 * pool finds one.
 */
export interface PoolLastBlock {
  difficulty?: number;
  height?: number;
  timestamp?: number;
  reward?: number;
  hash?: string;
}

export interface PoolSummary {
  hashrate: number; // pool H/s
  miners: number;
  workers: number;
  totalBlocks: number;
  totalPayments: number;
  totalMinersPaid: number;
  network: PoolNetwork;
  lastblock: PoolLastBlock;
  symbol: string;
  /**
   * Epoch ms of the POOL's last found block (cnp `pool.lastBlockFound`). 0 when
   * the pool has never found one; undefined for XEL, whose API reports it in a
   * shape this hook does not map yet. Drives the "next block" line on /start.
   */
  lastBlockFound?: number;
}

interface RawPoolStats {
  config?: { symbol?: string };
  pool?: {
    hashrate?: number;
    miners?: number;
    workers?: number;
    totalBlocks?: number;
    totalPayments?: number;
    totalMinersPaid?: number;
    lastBlockFound?: number | string;
  };
  network?: PoolNetwork;
  lastblock?: PoolLastBlock;
}

// xelis-pool master API GET /stats (cmd/master/api.go). Amounts are WHOLE XEL.
interface RawXelisStats {
  pool_hr?: number;
  net_hr?: number;
  connected_addresses?: number;
  connected_workers?: number;
  num_blocks_found?: number;
  height?: number;
  /** Current network block reward, WHOLE XEL. */
  reward?: number;
  /** Network difficulty (net_hr == difficulty / 5). */
  difficulty?: number;
  /** The POOL's last found block - zeros until it finds one. Not used. */
  last_block?: { height?: number; timestamp?: number; reward?: number; hash?: string };
  withdrawals?: { txid?: string; time?: number; amount?: number; destinations?: number }[] | null;
  pool_fee_percent?: number;
  payment_threshold?: number;
  pplns_window_seconds?: number;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function mapXelisSummary(d: RawXelisStats): PoolSummary {
  const coin = coinById("xel");
  const withdrawals = Array.isArray(d.withdrawals) ? d.withdrawals : [];
  const rewardAtomic = coinToAtomic(d.reward, coin);
  return {
    hashrate: num(d.pool_hr),
    miners: num(d.connected_addresses),
    workers: num(d.connected_workers),
    totalBlocks: num(d.num_blocks_found),
    totalPayments: withdrawals.length,
    totalMinersPaid: withdrawals.reduce((sum, w) => sum + num(w?.destinations), 0),
    network: {
      difficulty: num(d.difficulty),
      height: num(d.height),
      reward: rewardAtomic,
    },
    // Deliberately the CURRENT network height + reward, never d.last_block -
    // see PoolLastBlock. The estimate reads lastblock.reward.
    lastblock: {
      height: num(d.height),
      reward: rewardAtomic,
    },
    symbol: coin.symbol,
  };
}

export async function fetchPoolSummary(coin: CoinId = DEFAULT_COIN): Promise<PoolSummary> {
  const res = await fetch(`${coinById(coin).apiBase}/stats`);
  if (!res.ok) throw new Error(`pool /stats: ${res.status}`);
  if (coin === "xel") return mapXelisSummary(await res.json());
  const d: RawPoolStats = await res.json();
  const p = d.pool ?? {};
  return {
    hashrate: p.hashrate ?? 0,
    miners: p.miners ?? 0,
    workers: p.workers ?? 0,
    totalBlocks: p.totalBlocks ?? 0,
    totalPayments: p.totalPayments ?? 0,
    totalMinersPaid: p.totalMinersPaid ?? 0,
    network: d.network ?? {},
    lastblock: d.lastblock ?? {},
    symbol: d.config?.symbol ?? "ZEPH",
    lastBlockFound: num(p.lastBlockFound),
  };
}

// coin defaults to Zephyr so a caller that passes nothing keeps the original
// behaviour and query key. As of 2026-08-28 the only such caller left is the
// site-wide status banner (usePoolOnline); Index, Calculator and My Stats all
// pass a coin explicitly.
export function usePoolSummary(coin: CoinId = DEFAULT_COIN) {
  const query = useQuery({
    queryKey: ["poolSummary", coin],
    queryFn: () => fetchPoolSummary(coin),
    // pool API recomputes on a similar cadence; 30s keeps it fresh without
    // hammering :8117 (matches the /api/stats edge-cache TTL).
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });
  return {
    summary: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}

// ── Pool up/down signal (drives the site-wide PoolStatusBanner) ──────────
// Reuses the shared usePoolSummary query (same queryKey -> no extra requests).
// The pool API (:8117) is unreachable during the ~5-min post-boot delayed-start
// window and during any pool outage; fetchPoolSummary throws on a non-200
// (nginx returns 502 when :8117 is down), so a *settled* react-query error means
// the pool is genuinely down. We report "down" only once a fetch has actually
// failed (never during the initial load, to avoid a flash), and it clears
// automatically on the next successful 30 s refetch.
export function usePoolOnline() {
  const { summary, isLoading, error } = usePoolSummary();
  return {
    down: !isLoading && Boolean(error),
    online: !error,
    checking: isLoading && summary === undefined,
  };
}

// ── Per-miner stats (GET /stats_address?address=...) ───────────────────────

export interface PoolWorker {
  name: string;
  hashrate: number;
  lastShare: number;
  hashes: number;
  hashrate_1h?: number;
  hashrate_6h?: number;
  hashrate_24h?: number;
}

export interface PoolPayment {
  time: number; // unix seconds
  amount: number; // atomic units
  txHash: string;
}

export interface HashratePoint {
  ts: number; // unix seconds
  hashrate: number; // H/s
}

export interface MinerStats {
  hashrate: number;
  hashrate_1h: number;
  hashrate_6h: number;
  hashrate_24h: number;
  lastShare: number; // unix seconds; 0 = the pool does not report it (xel)
  balance: number; // pending, atomic units
  /** Immature (unconfirmed-block) balance, atomic. Only xelis-pool reports it. */
  balancePending?: number;
  paid: number; // total paid, atomic units
  hashes: number;
  workers: PoolWorker[];
  payments: PoolPayment[];
  hashrateChart: HashratePoint[];
}

// The pool's zrevrange WITHSCORES returns a flat MEMBER-FIRST array:
//   [ "txHash:amount:fee:ringSize", score, "txHash:...", score, ... ]
// where the member's first chunk is the tx hash, the SECOND is the atomic
// amount, and the score is the unix time. (An earlier version assumed
// [ time, "amount:...:txHash" ] and read the timestamp score as the atomic
// amount - e.g. showing a 4.086 ZEPH payout as 0.0018 ZEPH.)
function parsePayments(raw: unknown): PoolPayment[] {
  if (!Array.isArray(raw)) return [];
  const out: PoolPayment[] = [];

  // Shape A: flat [member, score, member, score, ...] (member has colons; the
  // score is a bare number). member = "txHash:amount:fee:ringSize".
  if (raw.length && typeof raw[0] === "string" && String(raw[0]).includes(":")) {
    for (let i = 0; i + 1 < raw.length; i += 2) {
      const parts = String(raw[i]).split(":");
      const txHash = parts[0] || "";
      const amount = Number(parts[1]) || 0; // atomic units
      const time = Number(raw[i + 1]) || 0; // score = unix seconds
      out.push({ time, amount, txHash });
    }
    return out;
  }

  // Shape B: array of row arrays [[time, "detail"], ...] - same field meaning
  for (const row of raw) {
    if (Array.isArray(row)) {
      const time = Number(row[0]) || 0;
      const parts = String(row[1] ?? "").split(/[:.]/);
      const amount = Number(parts[0]) || 0;
      const txHash = parts.length > 1 ? parts[parts.length - 1] : "";
      out.push({ time, amount, txHash });
    } else if (row && typeof row === "object") {
      // Shape C: array of objects (defensive - some forks do this)
      const r = row as Record<string, unknown>;
      out.push({
        time: Number(r.time ?? r.ts) || 0,
        amount: Number(r.amount) || 0,
        txHash: String(r.hash ?? r.txHash ?? r.tx ?? ""),
      });
    }
  }
  return out;
}

interface RawAddressStats {
  error?: string;
  stats?: {
    hashrate?: number;
    hashrate_1h?: number;
    hashrate_6h?: number;
    hashrate_24h?: number;
    lastShare?: number | string;
    balance?: number | string;
    paid?: number | string;
    hashes?: number | string;
  };
  workers?: PoolWorker[];
  payments?: unknown;
  charts?: { hashrate?: unknown };
}

// charts.hashrate from the pool API is [[unix_ts, hashrate_Hs, sampleCount], ...]
// (one point per chart step - user-hashrate is ~30-min steps over 24h). Map to
// {ts, hashrate}, drop malformed/zero-ts rows, sort ascending by time.
function parseHashrateChart(raw: unknown): HashratePoint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) =>
      Array.isArray(p) ? { ts: Number(p[0]) || 0, hashrate: Number(p[1]) || 0 } : null
    )
    .filter((p): p is HashratePoint => p !== null && p.ts > 0)
    .sort((a, b) => a.ts - b.ts);
}

// Thrown for the "valid request, unknown miner" case (HTTP 200 + {error}).
export class AddressNotFoundError extends Error {
  constructor() {
    super("not found");
    this.name = "AddressNotFoundError";
  }
}

// xelis-pool master API GET /stats/<address>. Amounts are WHOLE XEL.
interface RawXelisAddressStats {
  error?: unknown;
  hashrate?: number;
  balance?: number;
  balance_pending?: number;
  paid?: number;
  est_pending?: number;
  hr_chart?: { t?: number; h?: number }[] | null;
  withdrawals?: { amount?: number; txid?: string; time?: number }[] | null;
}

/**
 * Map a xelis-pool per-address response, or throw AddressNotFoundError.
 *
 * xelis-pool answers 200 with all zeros for an address it has never seen, so
 * "every numeric field 0, no chart points, no withdrawals" IS the not-found
 * answer. A miner with any history at all has at least one of those.
 *
 * The pool has no per-worker data, no last-share time and no 1h/6h/24h
 * averages; those come back as [] / 0 and My Stats prefers the canonical
 * /api/v1/pool/miner numbers for the averages anyway.
 */
export function mapXelisAddressStats(d: RawXelisAddressStats): MinerStats {
  if (!d || typeof d !== "object" || d.error) throw new AddressNotFoundError();
  const coin = coinById("xel");
  const chart = Array.isArray(d.hr_chart) ? d.hr_chart : [];
  const withdrawals = Array.isArray(d.withdrawals) ? d.withdrawals : [];
  const allZero = [d.hashrate, d.balance, d.balance_pending, d.paid, d.est_pending].every(
    (v) => num(v) === 0,
  );
  const hashrateChart = chart
    .map((p) => ({ ts: num(p?.t), hashrate: num(p?.h) }))
    .filter((p) => p.ts > 0)
    .sort((a, b) => a.ts - b.ts);
  if (allZero && hashrateChart.length === 0 && withdrawals.length === 0) {
    throw new AddressNotFoundError();
  }
  return {
    hashrate: num(d.hashrate),
    hashrate_1h: 0,
    hashrate_6h: 0,
    hashrate_24h: 0,
    lastShare: 0,
    balance: coinToAtomic(d.balance, coin),
    balancePending: coinToAtomic(d.balance_pending, coin),
    paid: coinToAtomic(d.paid, coin),
    hashes: 0,
    workers: [],
    payments: withdrawals.map((w) => ({
      time: num(w?.time),
      amount: coinToAtomic(w?.amount, coin),
      txHash: String(w?.txid ?? ""),
    })),
    hashrateChart,
  };
}

async function fetchXelisAddressStats(address: string): Promise<MinerStats> {
  // The nginx allow-list matches a literal `xel:` in the path, so keep the
  // colon readable and escape everything else.
  const path = encodeURIComponent(address).replace(/%3A/gi, ":");
  const res = await fetch(`${coinById("xel").apiBase}/stats/${path}`);
  // 404 = the pool's own address (hidden by the master) or a malformed address
  // the nginx allow-list refused. Either way there are no stats to show.
  if (res.status === 404) throw new AddressNotFoundError();
  if (!res.ok) throw new Error(`pool /stats/<address>: ${res.status}`);
  return mapXelisAddressStats(await res.json());
}

export async function fetchAddressStats(address: string, coin: CoinId = DEFAULT_COIN): Promise<MinerStats> {
  if (coin === "xel") return fetchXelisAddressStats(address);
  const res = await fetch(
    `${coinById(coin).apiBase}/stats_address?address=${encodeURIComponent(address)}`,
  );
  if (!res.ok) throw new Error(`pool /stats_address: ${res.status}`);
  const d: RawAddressStats = await res.json();
  // Pool returns 200 + {"error":"Not found"} for an address it has never seen.
  if (d.error || !d.stats) throw new AddressNotFoundError();
  const s = d.stats;
  return {
    hashrate: Number(s.hashrate) || 0,
    hashrate_1h: Number(s.hashrate_1h) || 0,
    hashrate_6h: Number(s.hashrate_6h) || 0,
    hashrate_24h: Number(s.hashrate_24h) || 0,
    lastShare: Number(s.lastShare) || 0,
    balance: Number(s.balance) || 0,
    paid: Number(s.paid) || 0,
    hashes: Number(s.hashes) || 0,
    workers: Array.isArray(d.workers) ? d.workers : [],
    payments: parsePayments(d.payments),
    hashrateChart: parseHashrateChart(d.charts?.hashrate),
  };
}

// ── Per-miner CANONICAL hashrate (GET /api/v1/pool/miner) ─────────────────
// Single source of truth shared with the leaderboard: the api-server computes
// hashrate one way (total accepted difficulty / window) from lb_samples, so the
// number here is IDENTICAL to the miner's leaderboard row. Balance/payments/
// workers still come from the pool API (usePoolAddressStats); only hashrate is
// unified here. Edge-cached (max-age=30) so viewer load stays flat.

export interface MinerHashrate {
  found: boolean;
  /**
   * Coin the SERVER resolved from the address prefix - "" if it matched none.
   * This is the page's source of truth for which pool to read the rest of the
   * stats from; the browser never parses the address itself.
   */
  coin?: string;
  symbol?: string;
  algo?: string;
  tier?: "cpu" | "gpu" | "";
  hashrate_live: number; // canonical over 600s (live ticker - fluctuates)
  hashrate_1h: number;   // canonical over 3600s (stable headline)
  hashrate_6h: number;
  hashrate_24h: number;
  last_seen: number;
}

async function fetchMinerHashrate(address: string): Promise<MinerHashrate> {
  const res = await fetch(`/api/v1/pool/miner?address=${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error(`pool/miner: ${res.status}`);
  return res.json();
}

export function usePoolMinerHashrate(address: string | null) {
  const trimmed = (address ?? "").trim();
  const enabled = trimmed.length > 0;
  const query = useQuery({
    queryKey: ["poolMinerHashrate", trimmed],
    queryFn: () => fetchMinerHashrate(trimmed),
    enabled,
    staleTime: 30_000,
    refetchInterval: enabled ? 60_000 : false,
    refetchOnWindowFocus: false,
  });
  return {
    hashrate: query.data,
    isLoading: enabled && query.isLoading,
    error: query.error,
  };
}

// Address lookup is enabled only once a (trimmed, non-empty) address is set,
// so the query stays idle until the user actually submits one.
export function usePoolAddressStats(address: string | null, coin: CoinId = DEFAULT_COIN) {
  const trimmed = (address ?? "").trim();
  const enabled = trimmed.length > 0;
  const query = useQuery({
    // coin is part of the key: the same address must never serve a cached
    // response from the other pool.
    queryKey: ["poolAddressStats", trimmed, coin],
    queryFn: () => fetchAddressStats(trimmed, coin),
    enabled,
    // Don't retry the "unknown miner" case - it's a definitive answer.
    retry: (_count, err) => !(err instanceof AddressNotFoundError),
    staleTime: 30_000,
    refetchInterval: enabled ? 60_000 : false,
    refetchOnWindowFocus: false,
  });
  return {
    stats: query.data,
    isLoading: enabled && query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    notFound: query.error instanceof AddressNotFoundError,
  };
}
