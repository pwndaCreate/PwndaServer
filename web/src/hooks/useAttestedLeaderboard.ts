import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

// Data hook for the wallet-attested leaderboard at /attest. Polls
// GET /api/v1/attest/top every 30 seconds (the same cadence the server
// caches at). Lives in its own hook (not folded into useMiningStats)
// because the two leaderboards answer fundamentally different questions:
//
//   useMiningStats -> "Who's mining through Pwnda's pool right now?"
//   useAttestedLeaderboard -> "Which wallets have proven work?"

export interface AttestEntry {
  rank: number;
  display_name_or_short_id: string;
  coin: string;  // "xmr" | "zph" | "rvn" | "cfx" | "ergo"
  algo: string;  // "randomx" | "kawpow" | "octopus" | "autolykos2"
  avg_hashrate_hs: number;
  total_shares: number;
  last_seen: number;
  verification: "pow" | "api_reported";
  verified: boolean;
}

export interface AttestTopResponse {
  period: "24h" | "7d" | "30d";
  coin: string;
  algo: string;
  generated_at: number;
  entries: AttestEntry[];
}

export type AttestPeriod = "1h" | "6h" | "24h" | "7d" | "30d";

interface UseAttestedLeaderboardArgs {
  coin?: string;
  algo?: string;
  period: AttestPeriod;
}

async function fetchAttestedTop(args: UseAttestedLeaderboardArgs): Promise<AttestTopResponse> {
  const params = new URLSearchParams();
  if (args.coin) params.set("coin", args.coin);
  if (args.algo) params.set("algo", args.algo);
  params.set("period", args.period);
  const url = `/api/v1/attest/top?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`attest /top: ${res.status}`);
  return res.json();
}

// ── Hashrate history (chart data) ────────────────────────────────────────

export interface AttestHashratePoint {
  hour_ts: number;       // unix seconds, hour-aligned
  hashrate_hs: number;   // average H/s for that hour
  client_count: number;  // distinct wallets active that hour
}

export interface AttestHashrateHistory {
  tier: "cpu" | "gpu" | "";
  hours: number;
  bucket_seconds: number; // 60 / 300 / 900 / 3600 depending on hours
  generated_at: number;
  points: AttestHashratePoint[];
}

interface UseAttestHashrateHistoryArgs {
  tier: "cpu" | "gpu";
  hours: number;
}

async function fetchAttestHashrateHistory(args: UseAttestHashrateHistoryArgs): Promise<AttestHashrateHistory> {
  const params = new URLSearchParams({
    tier: args.tier,
    hours: String(args.hours),
  });
  const res = await fetch(`/api/v1/attest/hashrate/history?${params.toString()}`);
  if (!res.ok) throw new Error(`attest /hashrate/history: ${res.status}`);
  return res.json();
}

export function useAttestedHashrateHistory(args: UseAttestHashrateHistoryArgs) {
  // Refresh cadence tracks the underlying data's actual refresh rate:
  //   <=24h -> 60s   (raw lb_samples, refreshed by the bridge every 60s - so
  //                  the chart tracks the ranking's cadence instead of lagging
  //                  5 min behind it)
  //   >24h -> 300s  (hourly aggregate; faster polling is wasted work)
  // Matches the server's tiered Cache-Control header so the response is served
  // from cache for the full TTL anyway.
  const refresh = args.hours <= 24 ? 60_000 : 300_000;
  const query = useQuery({
    queryKey: ["attestHashrateHistory", args.tier, args.hours],
    queryFn: () => fetchAttestHashrateHistory(args),
    staleTime: refresh,
    refetchInterval: refresh,
    refetchOnWindowFocus: false,
  });

  // Demo-data fallback fires ONLY when the API is unreachable (query.error).
  // A successful response with `points: []` means "no recent mining activity"
  // - render that honestly instead of synthesizing a random-noise curve that
  // tricks the viewer into thinking miners are still online.
  //
  // Old behavior conflated these two cases under a single "empty = demo"
  // branch and produced a misleading active-looking chart for ~26h after the
  // last miner went offline. See PwndaVault/wiki/log.md 2026-05-26 entry.
  const realPoints = query.data?.points ?? [];
  // No demo fallback: on error OR a successful empty response, render an honest
  // "no recent activity" message rather than a synthesized curve.
  const points: AttestHashratePoint[] = realPoints;

  return {
    points,
    generatedAt: query.data?.generated_at,
    isLoading: query.isLoading,
    error: query.error,
    isDemo: false,
    // True once loaded with no real points (empty response or API error)  - 
    // caller renders a clear "no recent activity" message.
    isEmpty: !query.isLoading && realPoints.length === 0,
  };
}

export interface EligiblePools {
  pools: Record<string, string[]>;
}

async function fetchEligiblePools(): Promise<EligiblePools> {
  const res = await fetch("/api/v1/attest/eligible-pools");
  if (!res.ok) throw new Error(`attest /eligible-pools: ${res.status}`);
  return res.json();
}

export function useAttestedLeaderboard(args: UseAttestedLeaderboardArgs) {
  // Poll cadence matches the server's edge cache TTL - polling faster
  // just hands the user the same JSON repeatedly. /top moved to 60s as
  // part of the scale-out work; halves Cloudflare -> origin pressure
  // without affecting perceived freshness on a leaderboard.
  const query = useQuery({
    queryKey: ["attestTop", args.coin ?? "", args.algo ?? "", args.period],
    queryFn: () => fetchAttestedTop(args),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    entries: query.data?.entries ?? [],
    generatedAt: query.data?.generated_at,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useEligiblePools() {
  const query = useQuery({
    queryKey: ["attestEligiblePools"],
    queryFn: fetchEligiblePools,
    // Whitelist changes rarely - long stale time, no auto-refetch.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  // Returns array of distinct (coin, algo) keys for filter dropdowns.
  const coinAlgoOptions = useMemo<{ coin: string; algo: string }[]>(() => {
    const opts: { coin: string; algo: string }[] = [];
    Object.keys(query.data?.pools ?? {}).forEach((k) => {
      const [coin, algo] = k.split("|");
      if (coin && algo) opts.push({ coin, algo });
    });
    return opts;
  }, [query.data]);

  return {
    pools: query.data?.pools ?? {},
    coinAlgoOptions,
    isLoading: query.isLoading,
    error: query.error,
  };
}

// No demo fallback: on API error or empty, callers render an honest empty/error
// state rather than fake wallets. (The old demo showed wallet-01... at impossible
// hashrates whenever the api-server was down - confusing, and it mislabeled a
// healthy single-miner pool as a crowd. Removed 2026-06-29.)
export function useAttestedLeaderboardWithFallback(args: UseAttestedLeaderboardArgs) {
  return useAttestedLeaderboard(args);
}
