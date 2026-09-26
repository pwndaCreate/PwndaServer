import { describe, it, expect } from "vitest";
import { ALL_COINS, COINS, hardwarePhrase, minerCommandFor, type CoinId } from "@/lib/coins";
import { GLYPH8, COIN_COLOR } from "@/lib/coin-art";
import { MINE_PATH, ROUTES } from "@/routes";

/*  Guards the pool facts the site ADVERTISES against what the pools actually do.
 *
 *  These are promises to miners, and they have drifted before: the site claimed
 *  PPLNS for a pool running PROP, and "14+" payout coins against a real 19. A
 *  fee is the one most worth guarding - advertising 0% while charging 0.5% is
 *  the difference between a low-fee pool and a dishonest one.
 *
 *  The live pools publish these at /pool-api/stats and /zano-api/stats as
 *  `config.fee` and `config.payoutScheme`, so a human can check in one curl:
 *
 *    curl -s https://pwnda.org/pool-api/stats | python3 -m json.tool | grep -E 'fee|payoutScheme'
 *
 *  The Xelis pool publishes `pool_fee_percent`, `payment_threshold` and
 *  `pplns_window_seconds` on its master API (no solo mode exists there):
 *
 *    curl -s https://pwnda.org/xelis-api/stats | python3 -m json.tool | grep -E 'fee|threshold|pplns'
 *
 *  These are PUBLIC facts pinned as constants on purpose - the tests never read
 *  a pool's config.json, which also holds secrets.
 */

// Mirror of each pool's config.json: zph/zano 2026-09-05, xel 2026-09-16 (live
// /stats: pool_fee_percent 0.5, payment_threshold 0.05; xelis-pool has no solo).
const POOL_CONFIG_FEE_PCT: Record<CoinId, number> = { zph: 0.5, zano: 0.5, xel: 0.5 };
const POOL_CONFIG_SOLO_FEE_PCT: Record<CoinId, number> = { zph: 0, zano: 0, xel: 0 };
const POOL_CONFIG_SOLO_ENABLED: Record<CoinId, boolean> = { zph: true, zano: true, xel: false };

describe("pool coin registry", () => {
  it("lists every coin once, in display order", () => {
    expect(ALL_COINS.map((c) => c.id)).toEqual(["zph", "zano", "xel"]);
    expect(Object.keys(COINS).sort()).toEqual(ALL_COINS.map((c) => c.id).sort());
  });

  it("pins the Xelis public facts", () => {
    const x = COINS.xel;
    expect(x.symbol).toBe("XEL");
    expect(x.apiBase).toBe("/xelis-api");
    expect(x.tier).toBe("cpu");
    expect(x.algo).toBe("xelishashv3");
    // Mined on GPUs AND CPUs (SRBMiner: xelishashv3 [C A N I]); the admin tab says GPU+CPU too.
    expect(x.hardware).toBe("GPU+CPU");
    expect(x.algoLabel).toBe("XelisHashV3 - GPU+CPU");
    expect(hardwarePhrase(x)).toBe("GPU or CPU");
    expect(hardwarePhrase(COINS.zph)).toBe("CPU");
    // The leaderboard still files it under the cpu tier (tiers are per coin).
    expect(x.tier).toBe("cpu");
    expect(x.blockTimeS).toBe(5);
    expect(x.atomicUnits).toBe(100_000_000);
    expect(x.stratum).toBe("xel.pwnda.org:17706");
    expect(x.minPayout).toBe("0.05 XEL"); // live payment_threshold 0.05
    expect(x.coinGeckoId).toBe("xelis");
    expect(x.payoutEvery).toBe("4 hours"); // WITHDRAW_INTERVAL = 4 * 60 * 60
    expect(x.maturityConfs).toBe(200);
  });

  it("keeps the cryptonote coins on 1e12 atomic units", () => {
    expect(COINS.zph.atomicUnits).toBe(1e12);
    expect(COINS.zano.atomicUnits).toBe(1e12);
  });

  it("says only the Xelis pool lacks per-worker stats", () => {
    expect(COINS.zph.workerStats).toBe(true);
    expect(COINS.zano.workerStats).toBe(true);
    expect(COINS.xel.workerStats).toBe(false);
  });

  it("never claims the Pwnda Wallet handles XEL", () => {
    // The wallet repo had no Xelis code on 2026-09-16. Flip this only together
    // with a wallet release that actually mines and swaps XEL.
    expect(COINS.xel.pwndaWallet).toBe(false);
    expect(COINS.zph.pwndaWallet).toBe(true);
    expect(COINS.zano.pwndaWallet).toBe(true);
  });

  it("gives every pool coin its own glyph and brand colour", () => {
    for (const coin of ALL_COINS) {
      expect(GLYPH8[coin.symbol], `${coin.symbol} has no glyph`).toBeDefined();
      expect(COIN_COLOR[coin.symbol], `${coin.symbol} has no colour`).toBeDefined();
    }
    // Two different X-shaped marks must not collapse into one.
    expect(GLYPH8.XEL).not.toEqual(GLYPH8.XRP);
  });

  it("has a routed guide page for every coin", () => {
    for (const coin of ALL_COINS) {
      const path = MINE_PATH[coin.id];
      expect(ROUTES.some((r) => r.path === path && !r.noIndex), `${path} is not routed`).toBe(true);
    }
    expect(ROUTES.find((r) => r.path === "/mine/xelis")?.page).toBe("MineXelis");
  });

  it("builds the published SRBMiner command for Xelis", () => {
    const linux = minerCommandFor(COINS.xel, "linux");
    expect(linux).toBe(
      "./SRBMiner-MULTI --algorithm xelishashv3 --pool xel.pwnda.org:17706 --tls true " +
        "--wallet YOUR_XELIS_ADDRESS.worker1 --password x",
    );
    expect(minerCommandFor(COINS.xel, "windows")).toMatch(/^SRBMiner-MULTI\.exe --algorithm xelishashv3 /);
  });
});

describe("advertised pool facts", () => {
  it("states the same fee the pool configs charge", () => {
    for (const coin of ALL_COINS) {
      expect(coin.poolFeePct, `${coin.symbol} fee drifted from the pool config`)
        .toBe(POOL_CONFIG_FEE_PCT[coin.id]);
    }
  });

  it("states the same solo fee and solo availability the pools are configured for", () => {
    for (const coin of ALL_COINS) {
      expect(coin.soloFeePct, `${coin.symbol} solo fee drifted from the pool config`)
        .toBe(POOL_CONFIG_SOLO_FEE_PCT[coin.id]);
      expect(coin.soloEnabled, `${coin.symbol} solo availability drifted`)
        .toBe(POOL_CONFIG_SOLO_ENABLED[coin.id]);
    }
  });

  it("never lets the solo fee exceed the pooled fee without that being deliberate", () => {
    // Solo carries no pooling service, so charging MORE for it would be odd.
    // If this ever fails, it is a config mistake far more often than a decision.
    for (const coin of ALL_COINS) {
      expect(coin.soloFeePct).toBeLessThanOrEqual(coin.poolFeePct);
    }
  });

  it("keeps the fee a sane percentage, not a fraction or basis points", () => {
    // 0.005 (a fraction) or 50 (basis points) would render as "0.005%" / "50%"
    // and quietly wreck the earnings math rather than throwing.
    for (const coin of ALL_COINS) {
      expect(coin.poolFeePct).toBeGreaterThanOrEqual(0);
      expect(coin.poolFeePct).toBeLessThan(5);
    }
  });

  it("nets the fee out of an earnings estimate", () => {
    // Reproduces the estimator: gross emission scaled by (1 - fee).
    const coin = COINS.zph;
    const gross = 100;
    const net = gross * (1 - coin.poolFeePct / 100);
    expect(net).toBeLessThan(gross);
    expect(net).toBeCloseTo(99.5, 10);
  });

  it("declares a payout scheme the pools actually run", () => {
    for (const coin of ALL_COINS) {
      expect(["PPLNS", "PROP"]).toContain(coin.payoutScheme);
    }
  });
});

// ---------------------------------------------------------------------------
// Download targets. A target whose asset is not published is a 404 behind a
// download button - worse than not offering the build. v0.6.0 shipped an .msi
// that was removed when the release was rebuilt, and the site kept linking to
// it. These are the checks that can run offline; the asset list itself must be
// confirmed against the release (command in wallet-release.ts).
// ---------------------------------------------------------------------------
import { DOWNLOAD_TARGETS, VERSION, RELEASES_URL, downloadPath, targetBySlug } from "@/lib/wallet-release";

describe("wallet download targets", () => {
  it("points every target at the version this file declares", () => {
    for (const t of DOWNLOAD_TARGETS) {
      expect(t.url, `${t.slug} URL does not carry v${VERSION}`).toContain(`/v${VERSION}/`);
      expect(t.url).toContain(`PwndaWallet-${VERSION}-`);
    }
  });

  it("has no duplicate slugs - the slug is what gets counted in the log", () => {
    const slugs = DOWNLOAD_TARGETS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("resolves every slug back to its target", () => {
    for (const t of DOWNLOAD_TARGETS) {
      expect(targetBySlug(t.slug)).toBe(t);
      expect(downloadPath(t.slug)).toBe(`/download/${t.slug}`);
    }
  });

  it("offers at least one build per advertised platform", () => {
    for (const os of ["windows", "linux"] as const) {
      expect(DOWNLOAD_TARGETS.filter((t) => t.os === os).length,
        `no ${os} build offered`).toBeGreaterThan(0);
    }
  });

  it("falls back to the releases page for an unknown slug", () => {
    expect(targetBySlug("nope")).toBeUndefined();
    expect(RELEASES_URL).toMatch(/^https:\/\/github\.com\/.+\/releases$/);
  });
});
