import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

// ─────────────────────────────────────────────────────────────────────────
// LEGACY (archived 2026-07-09): this hook fed the old multi-coin homepage
// and worker dashboard from the retired Go api-server endpoints
// (/api/stats, /api/workers, /api/hashrate/history) with a fake demo-data
// fallback. No LIVE page uses it anymore - the homepage now reads the ZEPH
// pool via usePoolStats. Kept only for the archived pages
// (pages/Dashboard.tsx). Do not use in live pages.
// ─────────────────────────────────────────────────────────────────────────

export interface Worker {
  id: string;
  name: string;
  coin: string;
  hashrate: number;
  status: "online" | "offline" | "idle";
  lastSeen: Date;
  shares: { accepted: number; rejected: number };
  temperature: number;
}

export interface MiningStats {
  totalHashrate: number;
  activeWorkers: number;
  totalShares: { accepted: number; rejected: number };
  estimatedDaily: number;
  workers: Worker[];
  hashrateHistory: { time: string; value: number }[];
}

// ============================================================
// API Fetch (real backend data)
// ============================================================

interface APIPoolStats {
  total_miners: number;
  active_sessions: number;
  total_valid_shares: number;
  total_invalid_shares: number;
  coins_supported: string[];
}

interface APIWorker {
  miner_id: number;
  worker_id: string;
  coin_mined: string;
  connected_at: string;
  ip_address: string;
  worker_name: string;
}

// APILeaderboardEntry removed 2026-05-24 - see
// archive/old-leaderboard-2026-05-24.zip. Replaced by AttestEntry in
// hooks/useAttestedLeaderboard.ts.
interface _APILeaderboardEntry_DEPRECATED {
  miner_id: number;
  worker_name: string;
  coin_mined: string;
  hashrate_hps: number;
  valid_shares: number;
  invalid_shares: number;
  last_seen: string;
  is_online: boolean;
}

async function fetchPoolStats(): Promise<APIPoolStats> {
  const res = await fetch("/api/stats");
  if (!res.ok) throw new Error("API unavailable");
  return res.json();
}

async function fetchActiveWorkers(): Promise<APIWorker[]> {
  const res = await fetch("/api/workers");
  if (!res.ok) throw new Error("API unavailable");
  return res.json();
}

// fetchLeaderboard() removed 2026-05-24 - the in-pool /api/leaderboard
// endpoint was retired. Dashboard's worker table now derives from the
// /api/workers payload (presence only, no hashrate rank). The ranked
// leaderboard view lives at /leaderboard (formerly /attest) and
// consumes /api/v1/attest/top via useAttestedLeaderboard.

async function fetchHashrateHistory(): Promise<{ time: string; value: number }[]> {
  const res = await fetch("/api/hashrate/history?hours=24");
  if (!res.ok) throw new Error("API unavailable");
  return res.json();
}

/**
 * Parse a date string from the SQLite backend into a JS Date.
 * Handles both "YYYY-MM-DD HH:MM:SS" (SQLite CURRENT_TIMESTAMP)
 * and "YYYY-MM-DDTHH:MM:SSZ" (ISO 8601 with timezone) formats.
 * Avoids the double-Z bug from blindly appending "Z" to a string that already has it.
 */
function parseDbDate(s: string): Date {
  if (!s) return new Date(0);
  // Already has timezone info (ends with Z or +HH:MM)
  if (s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s);
  // Has T separator but no timezone - treat as UTC
  if (s.includes("T")) return new Date(s + "Z");
  // SQLite space-separated format: "2026-03-09 15:34:15"
  return new Date(s.replace(" ", "T") + "Z");
}

// ============================================================
// Demo Data Generators (fallback when API is unavailable)
// ============================================================

function generateWorkers(count: number): Worker[] {
  const names = [
    "RIG-001", "RIG-002", "RIG-003", "MINER-A", "MINER-B",
    "GPU-FARM-1", "GPU-FARM-2", "ASIC-01", "ASIC-02", "NODE-X"
  ];

  const coins = ["XMR", "RVN", "CFX", "XMR", "RVN", "CFX", "XMR", "RVN", "CFX", "XMR"];
  return names.slice(0, count).map((name, i) => ({
    id: `worker-${i}`,
    name,
    coin: coins[i] ?? "XMR",
    hashrate: Math.random() * 100 + 50, // 50-150 MH/s
    status: Math.random() > 0.15 ? "online" : Math.random() > 0.5 ? "idle" : "offline",
    lastSeen: new Date(Date.now() - Math.random() * 300000), // Within last 5 mins
    shares: {
      accepted: Math.floor(Math.random() * 10000) + 1000,
      rejected: Math.floor(Math.random() * 100),
    },
    temperature: Math.floor(Math.random() * 20) + 55, // 55-75C
  }));
}

function generateHashrateHistory(): { time: string; value: number }[] {
  const history = [];
  const now = new Date();
  const baseHashrate = 450;

  for (let i = 23; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 3600000);
    const fluctuation = (Math.random() - 0.5) * 100;
    history.push({
      time: time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      value: Math.max(0, baseHashrate + fluctuation),
    });
  }
  return history;
}

// ============================================================
// Main Hook
// ============================================================

export function useMiningStats() {
  // Try fetching from real API
  const { data: apiPoolStats } = useQuery({
    queryKey: ["poolStats"],
    queryFn: fetchPoolStats,
    staleTime: 10_000,
    refetchInterval: 10_000,
    retry: false,
  });

  const { data: apiWorkers } = useQuery({
    queryKey: ["activeWorkers"],
    queryFn: fetchActiveWorkers,
    staleTime: 10_000,
    refetchInterval: 10_000,
    retry: false,
  });

  const { data: apiHashrateHistory } = useQuery({
    queryKey: ["hashrateHistory"],
    queryFn: fetchHashrateHistory,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  });

  // Demo data (used as fallback)
  const [demoStats, setDemoStats] = useState<MiningStats>(() => {
    const workers = generateWorkers(6);
    const activeWorkers = workers.filter((w) => w.status === "online").length;
    const totalHashrate = workers
      .filter((w) => w.status === "online")
      .reduce((sum, w) => sum + w.hashrate, 0);
    const totalShares = workers.reduce(
      (acc, w) => ({
        accepted: acc.accepted + w.shares.accepted,
        rejected: acc.rejected + w.shares.rejected,
      }),
      { accepted: 0, rejected: 0 }
    );

    return {
      totalHashrate,
      activeWorkers,
      totalShares,
      estimatedDaily: totalHashrate * 0.00001 * 24,
      workers,
      hashrateHistory: generateHashrateHistory(),
    };
  });

  // Simulate live updates for demo mode
  useEffect(() => {
    // Skip demo simulation if API is providing data
    if (apiPoolStats) return;

    const interval = setInterval(() => {
      setDemoStats((prev) => {
        const updatedWorkers = prev.workers.map((worker) => {
          if (worker.status === "online") {
            return {
              ...worker,
              hashrate: Math.max(0, worker.hashrate + (Math.random() - 0.5) * 10),
              shares: {
                accepted: worker.shares.accepted + Math.floor(Math.random() * 3),
                rejected: worker.shares.rejected + (Math.random() > 0.95 ? 1 : 0),
              },
              lastSeen: new Date(),
              temperature: Math.min(85, Math.max(45, worker.temperature + (Math.random() - 0.5) * 2)),
            };
          }
          return worker;
        });

        const totalHashrate = updatedWorkers
          .filter((w) => w.status === "online")
          .reduce((sum, w) => sum + w.hashrate, 0);

        const totalShares = updatedWorkers.reduce(
          (acc, w) => ({
            accepted: acc.accepted + w.shares.accepted,
            rejected: acc.rejected + w.shares.rejected,
          }),
          { accepted: 0, rejected: 0 }
        );

        // Update hashrate history
        const newHistory = [...prev.hashrateHistory.slice(1)];
        newHistory.push({
          time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          value: totalHashrate,
        });

        return {
          ...prev,
          workers: updatedWorkers,
          totalHashrate,
          totalShares,
          estimatedDaily: totalHashrate * 0.00001 * 24,
          hashrateHistory: newHistory,
        };
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [apiPoolStats]);

  // Build stats from API data if available, otherwise use demo.
  // Worker table is now driven by /api/workers (presence-only, no
  // hashrate rank). For the ranked leaderboard see /leaderboard which
  // uses useAttestedLeaderboard against /api/v1/attest/top.
  const stats: MiningStats = apiPoolStats
    ? (() => {
        const workersList = apiWorkers ?? [];
        const activeWorkers = workersList.length;
        return {
          totalHashrate: 0, // No longer derived here - pool's true hashrate
                            // requires the now-removed /api/leaderboard;
                            // /leaderboard's attested view is the canonical
                            // hashrate display.
          activeWorkers,
          totalShares: {
            accepted: apiPoolStats.total_valid_shares,
            rejected: apiPoolStats.total_invalid_shares,
          },
          estimatedDaily: 0,
          workers: workersList.map((w, i) => ({
            id: `worker-${w.miner_id}-${w.coin_mined}`,
            name: w.worker_name || w.worker_id || `Worker-${i}`,
            coin: w.coin_mined,
            hashrate: 0, // not available on /api/workers
            status: "online" as const,
            lastSeen: parseDbDate(w.connected_at),
            shares: { accepted: 0, rejected: 0 },
            temperature: 0,
          })),
          hashrateHistory: apiHashrateHistory ?? demoStats.hashrateHistory,
        };
      })()
    : demoStats;

  const toggleWorkerStatus = useCallback((workerId: string) => {
    setDemoStats((prev) => ({
      ...prev,
      workers: prev.workers.map((w) =>
        w.id === workerId
          ? { ...w, status: w.status === "online" ? "offline" : "online" }
          : w
      ),
    }));
  }, []);

  return { stats, toggleWorkerStatus };
}
