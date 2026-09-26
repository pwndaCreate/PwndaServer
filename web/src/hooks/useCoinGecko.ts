import { useQuery } from "@tanstack/react-query";

const COINGECKO_API = "https://api.coingecko.com/api/v3";

export interface CoinPrice {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number | null;
  price_change_percentage_24h: number | null;
  market_cap: number | null;
  market_cap_rank: number | null;
  total_volume: number | null;
}

export interface CoinDetail {
  id: string;
  symbol: string;
  name: string;
  image: { large: string; small: string; thumb: string };
  market_data: {
    current_price: { usd: number };
    price_change_percentage_24h: number;
    market_cap: { usd: number };
    total_volume: { usd: number };
  };
}

// ─────────────────────────────────────────────────────────────────────────
// LEGACY (archived 2026-07-09): the old multi-coin mine->payout system's coin
// lists. The live site is Zephyr-only; these are kept ONLY because the
// archived pages (pages/Coins.tsx, pages/Wallet.tsx, pages/Dashboard.tsx,
// pages/Calculator pre-rework) referenced them. Do not use in live pages.
// ─────────────────────────────────────────────────────────────────────────

// Coins users could be paid out in (legacy AutoPayout system - retired)
export const PAYOUT_COINS = [
  "bitcoin", "ethereum", "ripple", "algorand", "avalanche-2",
  "dogecoin", "matic-network", "solana", "flare-networks", "cardano",
  "hedera-hashgraph", "tether", "monero", "ravencoin", "conflux-token"
];

// Coins users could mine (legacy HeroMiners proxy system - retired)
export const MINEABLE_COINS = [
  "ravencoin", "conflux-token", "monero"
];

// All coins (union for fetching prices)
export const ALL_COINS = [...new Set([...PAYOUT_COINS, ...MINEABLE_COINS])];

// ─────────────────────────────────────────────────────────────────────────
// LIVE: the coins this server actually mines. Every id was checked against
// the CoinGecko markets endpoint rather than guessed from the ticker - "zano"
// and "xelis" happen to be the slugs (xelis checked 2026-09-16 via
// /coins/markets?ids=xelis and /search?query=xelis), but "zeph" is NOT (it is
// "zephyr-protocol"). The per-coin id lives on CoinSpec.coinGeckoId in
// lib/coins.ts.
// ─────────────────────────────────────────────────────────────────────────
export const ZEPH_COINGECKO_ID = "zephyr-protocol";

async function fetchCoinPrices(coinIds: string[]): Promise<CoinPrice[]> {
  const ids = coinIds.join(",");
  const response = await fetch(
    `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h`
  );
  
  if (!response.ok) {
    throw new Error("Failed to fetch coin prices");
  }
  
  return response.json();
}

async function fetchTopCoins(limit: number = 50): Promise<CoinPrice[]> {
  const response = await fetch(
    `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h`
  );
  
  if (!response.ok) {
    throw new Error("Failed to fetch top coins");
  }
  
  return response.json();
}

async function fetchCoinDetail(coinId: string): Promise<CoinDetail> {
  const response = await fetch(
    `${COINGECKO_API}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`
  );
  
  if (!response.ok) {
    throw new Error("Failed to fetch coin detail");
  }
  
  return response.json();
}

export function useCoinPrices(coinIds: string[] = ALL_COINS) {
  return useQuery({
    queryKey: ["coinPrices", coinIds],
    queryFn: () => fetchCoinPrices(coinIds),
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

/**
 * Live ZEPH market data (price, 24h change, market cap) from CoinGecko.
 * Returns `undefined` while loading / on failure - callers must render a
 * fallback (" - ") so the site degrades gracefully if CoinGecko is down or
 * rate-limits (the free tier does).
 */
export function useZephPrice() {
  return useCoinPrice(ZEPH_COINGECKO_ID);
}

/**
 * Live market data for ONE coin by its CoinGecko id.
 *
 * Same contract as useZephPrice (which is now a thin wrapper): `price` is
 * `undefined` while loading and on failure, so every caller must render a
 * fallback. The query key is per-id, so switching coins on a page swaps to a
 * separately cached result instead of refetching over the top of the other.
 *
 * `zeph` is kept as an alias of `price` so the pre-existing callers that
 * destructure it keep compiling.
 */
export function useCoinPrice(coinGeckoId: string) {
  const query = useQuery({
    queryKey: ["coinPrices", [coinGeckoId]],
    queryFn: () => fetchCoinPrices([coinGeckoId]),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: 1,
  });
  return { ...query, price: query.data?.[0], zeph: query.data?.[0] };
}

export function useTopCoins(limit: number = 50) {
  return useQuery({
    queryKey: ["topCoins", limit],
    queryFn: () => fetchTopCoins(limit),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useCoinDetail(coinId: string) {
  return useQuery({
    queryKey: ["coinDetail", coinId],
    queryFn: () => fetchCoinDetail(coinId),
    staleTime: 60 * 1000,
    enabled: !!coinId,
  });
}

// Utility function to format price (null-safe)
export function formatPrice(price: number | null | undefined): string {
  if (price == null || typeof price !== "number" || isNaN(price)) {
    return " - ";
  }
  if (price >= 1) {
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (price >= 0.01) {
    return `$${price.toFixed(4)}`;
  } else if (price > 0) {
    return `$${price.toFixed(8)}`;
  }
  return " - ";
}

// Utility function to format large numbers (null-safe)
export function formatMarketCap(value: number | null | undefined): string {
  if (value == null || typeof value !== "number" || isNaN(value) || value < 0) {
    return " - ";
  }
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}
