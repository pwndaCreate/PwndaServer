// The single source of truth for which paths exist and which page renders each.
//
// Two consumers need this and they load pages DIFFERENTLY:
//   - AppRoutes.tsx (browser) uses React.lazy, so visitors only download the
//     chunk for the page they landed on.
//   - entry-server.tsx (prerender) imports pages eagerly. It has to:
//     renderToString does not resolve Suspense, so a lazy page prerenders as
//     the "Loading..." fallback and ships ZERO marketing copy to crawlers -
//     which is the one thing prerendering exists to prevent.
//
// Keeping the path list here means the two cannot disagree about which routes
// exist, and typing both component maps as Record<PageKey, ...> means a page
// missing from either map is a compile error rather than a silently
// un-indexed route.

import type { CoinId } from "@/lib/coins";

export type PageKey =
  | "Index"
  | "GetStarted"
  | "Wallet"
  | "Calculator"
  | "Leaderboard"
  | "Pool"
  | "MineZephyr"
  | "MineZano"
  | "MineXelis"
  | "Unmineable"
  | "NotFound";

export interface RouteDef {
  path: string;
  page: PageKey;
  /** Excluded from the sitemap and from prerendering. */
  noIndex?: boolean;
}

export const ROUTES: RouteDef[] = [
  { path: "/", page: "Index" },
  // /start - setup guide for BOTH pools: wallet -> miner -> connect -> verify.
  { path: "/start", page: "GetStarted" },
  // /wallet - wallet product + download funnel, the site's primary CTA. NOT
  // the archived multi-coin lookup, which is unrouted at pages/WalletLegacy.tsx.
  { path: "/wallet", page: "Wallet" },
  { path: "/calculator", page: "Calculator" },
  // /leaderboard serves the wallet-attested view; /attest is kept as an alias
  // for external links that still use the old path.
  { path: "/leaderboard", page: "Leaderboard" },
  { path: "/attest", page: "Leaderboard", noIndex: true },
  // /pool - public miner lookup; the coin is detected server-side from the
  // address, then read from /pool-api/, /zano-api/ or /xelis-api/.
  { path: "/pool", page: "Pool" },
  // Subject-matter pages (2026-09-10). /start is HOW to set up; these are
  // ABOUT mining each coin, which is what a mining-qualified search needs to
  // find. /unmineable targets "how to mine <coin that cannot be mined>".
  { path: "/mine/zephyr", page: "MineZephyr" },
  { path: "/mine/zano", page: "MineZano" },
  // Added 2026-09-16 with the XEL pool. NOTE: nginx answers 404 for any path
  // without a prerendered file, so this route also needs its entry in
  // scripts/prerender.mjs before a direct visit (or the sitemap) can reach it.
  { path: "/mine/xelis", page: "MineXelis" },
  { path: "/unmineable", page: "Unmineable" },
  // Must stay last.
  { path: "*", page: "NotFound", noIndex: true },
];

/**
 * The guide page for each pool coin (MineGuide cross-links them). Typed by
 * CoinId, so a new coin without a guide path is a compile error; the
 * pool-facts test checks each path is also a routed, indexable page.
 */
export const MINE_PATH: Record<CoinId, string> = {
  zph: "/mine/zephyr",
  zano: "/mine/zano",
  xel: "/mine/xelis",
};
