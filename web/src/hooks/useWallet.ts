import { useState, useEffect, useCallback } from "react";

export interface Payout {
  id: string;
  amount: number;
  coin: string;
  txHash: string;
  timestamp: Date;
  status: "confirmed" | "pending" | "processing";
}

export interface CoinBalance {
  coin: string;
  balance: number;
  totalEarned: number;
  totalFeesPaid: number;
  totalWithdrawn: number;
}

export interface PendingEarning {
  coin: string;
  estimated: number;
  effortPct: number;
}

export interface EarningRecord {
  id: number;
  coin: string;
  effortPercentage: number;
  grossAmount: number;
  serverFee: number;
  netAmount: number;
  createdAt: string;
  payoutTxHash: string;
  payoutAmount: number;
  payoutTimestamp: number;
}

export interface FeeSchedule {
  serverFeePct: number;
  exchangeFeePct: number;
  slippagePct: number;
  networkFees: Record<string, number>;
}

export interface PayoutBalance {
  targetCoin: string;
  balance: number;
  totalConverted: number;
  totalWithdrawn: number;
  totalNetworkFees: number;
  lastUpdated: string;
}

export interface ActiveBucket {
  bucketId: number;
  coinMined: string;
  targetCoin: string;
  myContribution: number;
  bucketTotal: number;
  myPct: number;
  status: string;
  createdAt: string;
}

export interface Disbursement {
  id: number;
  targetCoin: string;
  amount: number;
  networkFee: number;
  payoutAddress: string;
  hotWalletTxHash: string | null;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

export interface MinerWorker {
  minerID: number;
  coinMined: string;
  workerName: string;
  connectedAt: string;
  lastActivity: string;
  ipAddress: string;
  isOnline: boolean;
  hashrateHps: number;
  algorithm: string;
}

export interface WalletData {
  address: string;
  minerHash: string;
  balance: number;
  pendingBalance: number;
  payoutThreshold: number;
  totalPaid: number;
  payouts: Payout[];
  coin: string;
  coinBalances: CoinBalance[];
  pending: PendingEarning[];
  earnings: EarningRecord[];
  feeSchedule: FeeSchedule | null;
  payoutBalances: PayoutBalance[];
  activeBuckets: ActiveBucket[];
  disbursements: Disbursement[];
  workers: MinerWorker[];
}

// CoinGecko IDs mapped to our symbols
export const COIN_SYMBOL_TO_GECKO: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", XRP: "ripple", ALGO: "algorand",
  AVAX: "avalanche-2", DOGE: "dogecoin", SOL: "solana", FLR: "flare-networks",
  ADA: "cardano", HBAR: "hedera-hashgraph", USDT: "tether",
  XMR: "monero", RVN: "ravencoin", CFX: "conflux-token",
  MATIC: "matic-network",
};

// Minimum payout thresholds per coin (defaults, overridden by API)
const DEFAULT_MINIMUM_PAYOUTS: Record<string, number> = {
  BTC: 0.0005, ETH: 0.01, XRP: 10, ALGO: 5,
  AVAX: 0.5, DOGE: 50, SOL: 0.1, FLR: 100,
  ADA: 10, HBAR: 50, USDT: 10,
  XMR: 0.01, RVN: 50, CFX: 10,
};

// Live minimums fetched from the server (updated on load)
export let MINIMUM_PAYOUTS: Record<string, number> = { ...DEFAULT_MINIMUM_PAYOUTS };

// Fetch live minimums from the API (non-blocking, updates in background)
fetch("/api/payout-minimums")
  .then((r) => r.ok ? r.json() : null)
  .then((data) => {
    if (data && typeof data === "object") {
      MINIMUM_PAYOUTS = { ...DEFAULT_MINIMUM_PAYOUTS, ...data };
    }
  })
  .catch(() => { /* use defaults */ });

// Estimate payout in chosen coin using USD prices
export function estimatePayout(
  coinBalances: CoinBalance[],
  pending: PendingEarning[],
  payoutCoin: string,
  prices: Map<string, number>, // symbol -> USD price
  feeSchedule: FeeSchedule | null,
): { estimatedAmount: number; breakdown: { label: string; value: string }[] } {
  // Sum all confirmed + pending balances into USD
  let totalUSD = 0;
  for (const bal of coinBalances) {
    const price = prices.get(bal.coin) ?? 0;
    totalUSD += bal.balance * price;
  }
  for (const p of pending) {
    const price = prices.get(p.coin) ?? 0;
    totalUSD += p.estimated * price;
  }

  const payoutPrice = prices.get(payoutCoin) ?? 0;
  if (payoutPrice === 0 || totalUSD === 0) {
    return { estimatedAmount: 0, breakdown: [] };
  }

  const rawAmount = totalUSD / payoutPrice;
  const exchangeFee = feeSchedule?.exchangeFeePct ?? 1.5;
  const slippage = feeSchedule?.slippagePct ?? 0.5;
  const networkFee = feeSchedule?.networkFees?.[payoutCoin] ?? 0;

  const afterExchange = rawAmount * (1 - exchangeFee / 100);
  const afterSlippage = afterExchange * (1 - slippage / 100);
  const estimatedAmount = Math.max(0, afterSlippage - networkFee);

  const breakdown = [
    { label: "Server fee (5%)", value: "Already deducted" },
    { label: `Exchange fee (~${exchangeFee}%)`, value: `-${(rawAmount * exchangeFee / 100).toFixed(8)} ${payoutCoin}` },
    { label: `Slippage (~${slippage}%)`, value: `-${(afterExchange * slippage / 100).toFixed(8)} ${payoutCoin}` },
    { label: "Network fee", value: `-${networkFee} ${payoutCoin}` },
  ];

  return { estimatedAmount, breakdown };
}

// ============================================================
// Main Hook
// ============================================================

export function useWallet(initialAddress: string = "", initialCoin: string = "BTC") {
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWallet = useCallback(async (address: string, coin: string = "BTC") => {
    if (!address || address.length < 10) {
      setError("Invalid wallet address");
      setWalletData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Refresh payout minimums from API on each wallet load
      try {
        const minRes = await fetch("/api/payout-minimums");
        if (minRes.ok) {
          const minData = await minRes.json();
          if (minData && typeof minData === "object") {
            MINIMUM_PAYOUTS = { ...DEFAULT_MINIMUM_PAYOUTS, ...minData };
          }
        }
      } catch { /* use existing minimums */ }

      const res = await fetch(`/api/wallet/${encodeURIComponent(address)}`);
      if (!res.ok) {
        setError("Wallet not found");
        setWalletData(null);
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      const miner = data.miner;
      const payouts = data.payouts || [];

      const totalPaid = payouts.reduce(
        (sum: number, p: { payout_amount?: number; amount_mined?: number }) =>
          sum + (p.payout_amount ?? p.amount_mined ?? 0),
        0
      );

      // Parse workers from the wallet response
      const workers: MinerWorker[] = (data.workers || []).map((w: {
        miner_id: number; coin_mined: string; worker_name: string;
        connected_at: string; last_activity: string; ip_address: string;
        is_online: boolean; hashrate_hps: number; algorithm: string;
      }) => ({
        minerID: w.miner_id,
        coinMined: w.coin_mined,
        workerName: w.worker_name,
        connectedAt: w.connected_at,
        lastActivity: w.last_activity,
        ipAddress: w.ip_address,
        isOnline: w.is_online,
        hashrateHps: w.hashrate_hps,
        algorithm: w.algorithm,
      }));

      // Fetch balance data using the wallet address (consolidates across all miner records)
      let coinBalances: CoinBalance[] = [];
      let pending: PendingEarning[] = [];
      let feeSchedule: FeeSchedule | null = null;
      let earnings: EarningRecord[] = [];
      let payoutBalances: PayoutBalance[] = [];
      let activeBuckets: ActiveBucket[] = [];

      try {
        const balRes = await fetch(`/api/balance/${encodeURIComponent(address)}`);
        if (balRes.ok) {
          const balData = await balRes.json();
          coinBalances = (balData.balances || []).map((b: {
            coin: string; balance: number; total_earned: number;
            total_fees_paid: number; total_withdrawn: number;
          }) => ({
            coin: b.coin,
            balance: b.balance,
            totalEarned: b.total_earned,
            totalFeesPaid: b.total_fees_paid,
            totalWithdrawn: b.total_withdrawn,
          }));
          pending = (balData.pending || []).map((p: {
            coin: string; estimated: number; effort_pct: number;
          }) => ({
            coin: p.coin,
            estimated: p.estimated,
            effortPct: p.effort_pct,
          }));
          if (balData.fee_schedule) {
            feeSchedule = {
              serverFeePct: balData.fee_schedule.server_fee_pct,
              exchangeFeePct: balData.fee_schedule.exchange_fee_pct,
              slippagePct: balData.fee_schedule.slippage_pct,
              networkFees: balData.fee_schedule.network_fees || {},
            };
          }
          // Parse payout balances (target coin balances from conversions)
          payoutBalances = (balData.payout_balances || []).map((pb: {
            target_coin: string; balance: number; total_converted: number;
            total_withdrawn: number; total_network_fees: number; last_updated: string;
          }) => ({
            targetCoin: pb.target_coin,
            balance: pb.balance,
            totalConverted: pb.total_converted,
            totalWithdrawn: pb.total_withdrawn,
            totalNetworkFees: pb.total_network_fees,
            lastUpdated: pb.last_updated,
          }));
          // Parse active conversion buckets
          activeBuckets = (balData.active_buckets || []).map((ab: {
            bucket_id: number; coin_mined: string; target_coin: string;
            my_contribution: number; bucket_total: number; my_pct: number;
            status: string; created_at: string;
          }) => ({
            bucketId: ab.bucket_id,
            coinMined: ab.coin_mined,
            targetCoin: ab.target_coin,
            myContribution: ab.my_contribution,
            bucketTotal: ab.bucket_total,
            myPct: ab.my_pct,
            status: ab.status,
            createdAt: ab.created_at,
          }));
        }
      } catch {
        // Balance API unavailable - continue with empty balances
      }

      // Fetch earnings history
      try {
        const earnRes = await fetch(`/api/earnings/${encodeURIComponent(miner.miner_hash)}?limit=50`);
        if (earnRes.ok) {
          const earnData = await earnRes.json();
          earnings = (earnData || []).map((e: {
            id: number; coin: string; effort_percentage: number;
            gross_amount: number; server_fee: number; net_amount: number;
            created_at: string; payout_tx_hash: string;
            payout_amount: number; payout_timestamp: number;
          }) => ({
            id: e.id,
            coin: e.coin,
            effortPercentage: e.effort_percentage,
            grossAmount: e.gross_amount,
            serverFee: e.server_fee,
            netAmount: e.net_amount,
            createdAt: e.created_at,
            payoutTxHash: e.payout_tx_hash,
            payoutAmount: e.payout_amount,
            payoutTimestamp: e.payout_timestamp,
          }));
        }
      } catch {
        // Earnings API unavailable
      }

      // Fetch disbursement (withdrawal) history
      let disbursements: Disbursement[] = [];
      try {
        const disbRes = await fetch(`/api/disbursements/${encodeURIComponent(address)}`);
        if (disbRes.ok) {
          const disbData = await disbRes.json();
          disbursements = (disbData || []).map((d: {
            id: number; target_coin: string; amount: number; network_fee: number;
            payout_address: string; hot_wallet_tx_hash: string | null;
            status: string; created_at: string; completed_at: string | null;
          }) => ({
            id: d.id,
            targetCoin: d.target_coin,
            amount: d.amount,
            networkFee: d.network_fee,
            payoutAddress: d.payout_address,
            hotWalletTxHash: d.hot_wallet_tx_hash,
            status: d.status,
            createdAt: d.created_at,
            completedAt: d.completed_at,
          }));
        }
      } catch {
        // Disbursements API unavailable
      }

      // Calculate total confirmed balance (sum across mined coins)
      const totalBalance = coinBalances.reduce((sum, b) => sum + b.balance, 0);
      const totalPending = pending.reduce((sum, p) => sum + p.estimated, 0);

      setWalletData({
        address: miner.payout_address || address,
        minerHash: miner.miner_hash,
        balance: totalBalance,
        pendingBalance: totalPending,
        payoutThreshold: MINIMUM_PAYOUTS[coin.toUpperCase()] ?? 0.1,
        totalPaid,
        payouts: payouts.map((p: {
          id: number; payout_amount?: number; amount_mined: number;
          payout_coin: string; txid?: string; created_at: string; status: string;
        }) => ({
          id: `payout-${p.id}`,
          amount: p.payout_amount ?? p.amount_mined,
          coin: p.payout_coin,
          txHash: p.txid || "",
          timestamp: new Date(p.created_at),
          status: p.status === "completed" ? "confirmed" as const : p.status as "pending" | "processing",
        })),
        coin: coin.toUpperCase(),
        coinBalances,
        pending,
        earnings,
        feeSchedule,
        payoutBalances,
        activeBuckets,
        disbursements,
        workers,
      });
      setIsLoading(false);
    } catch {
      setError("Failed to load wallet data");
      setWalletData(null);
      setIsLoading(false);
    }
  }, []);

  const updatePayoutThreshold = (threshold: number) => {
    if (walletData) {
      setWalletData({ ...walletData, payoutThreshold: threshold });
    }
  };

  // Refresh balance + worker data every 30 seconds when wallet is loaded
  useEffect(() => {
    if (!walletData?.address) return;

    const interval = setInterval(async () => {
      try {
        // Fetch consolidated balance by address
        const balRes = await fetch(`/api/balance/${encodeURIComponent(walletData.address)}`);
        if (balRes.ok) {
          const balData = await balRes.json();
          const coinBalances: CoinBalance[] = (balData.balances || []).map((b: {
            coin: string; balance: number; total_earned: number;
            total_fees_paid: number; total_withdrawn: number;
          }) => ({
            coin: b.coin,
            balance: b.balance,
            totalEarned: b.total_earned,
            totalFeesPaid: b.total_fees_paid,
            totalWithdrawn: b.total_withdrawn,
          }));
          const pending: PendingEarning[] = (balData.pending || []).map((p: {
            coin: string; estimated: number; effort_pct: number;
          }) => ({
            coin: p.coin,
            estimated: p.estimated,
            effortPct: p.effort_pct,
          }));

          const payoutBalances: PayoutBalance[] = (balData.payout_balances || []).map((pb: {
            target_coin: string; balance: number; total_converted: number;
            total_withdrawn: number; total_network_fees: number; last_updated: string;
          }) => ({
            targetCoin: pb.target_coin,
            balance: pb.balance,
            totalConverted: pb.total_converted,
            totalWithdrawn: pb.total_withdrawn,
            totalNetworkFees: pb.total_network_fees,
            lastUpdated: pb.last_updated,
          }));
          const activeBuckets: ActiveBucket[] = (balData.active_buckets || []).map((ab: {
            bucket_id: number; coin_mined: string; target_coin: string;
            my_contribution: number; bucket_total: number; my_pct: number;
            status: string; created_at: string;
          }) => ({
            bucketId: ab.bucket_id,
            coinMined: ab.coin_mined,
            targetCoin: ab.target_coin,
            myContribution: ab.my_contribution,
            bucketTotal: ab.bucket_total,
            myPct: ab.my_pct,
            status: ab.status,
            createdAt: ab.created_at,
          }));

          const totalBalance = coinBalances.reduce((sum, b) => sum + b.balance, 0);
          const totalPending = pending.reduce((sum, p) => sum + p.estimated, 0);

          setWalletData(prev => prev ? {
            ...prev,
            balance: totalBalance,
            pendingBalance: totalPending,
            coinBalances,
            pending,
            payoutBalances,
            activeBuckets,
          } : prev);
        }

        // Refresh workers
        const workersRes = await fetch(`/api/workers/${encodeURIComponent(walletData.address)}`);
        if (workersRes.ok) {
          const workersData = await workersRes.json();
          const workers: MinerWorker[] = (workersData || []).map((w: {
            miner_id: number; coin_mined: string; worker_name: string;
            connected_at: string; last_activity: string; ip_address: string;
            is_online: boolean; hashrate_hps: number; algorithm: string;
          }) => ({
            minerID: w.miner_id,
            coinMined: w.coin_mined,
            workerName: w.worker_name,
            connectedAt: w.connected_at,
            lastActivity: w.last_activity,
            ipAddress: w.ip_address,
            isOnline: w.is_online,
            hashrateHps: w.hashrate_hps,
            algorithm: w.algorithm,
          }));

          setWalletData(prev => prev ? { ...prev, workers } : prev);
        }
      } catch {
        // Silent fail for background refresh
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [walletData?.address]);

  return { walletData, isLoading, error, loadWallet, updatePayoutThreshold };
}
