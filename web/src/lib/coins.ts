// Coin registry for the three self-hosted pools (Zephyr, Zano, Xelis).
//
// DETECTION IS SERVER-SIDE. The My Stats page has ONE address box and no coin
// selector; /api/v1/pool/miner reads the address prefix and returns the coin it
// resolved (see GoPwnda.org/poolcoins). This file deliberately does NOT
// re-implement that prefix table - a second copy would be a second thing to keep
// in sync with the coins' own source, and the two would drift silently.
//
// What lives here is only what the BROWSER needs once the server has answered:
// which API prefix to read the rest of the page from, and how to label things.
export type CoinId = "zph" | "zano" | "xel";

export interface CoinSpec {
  id: CoinId;
  symbol: string;
  name: string;
  /**
   * nginx location prefix for this pool's read-only API. Zephyr and Zano run
   * cryptonote-nodejs-pool; Xelis runs xelis-pool, whose API has a different
   * shape (hooks/usePoolStats.ts branches on the coin id to read it).
   */
  apiBase: string;
  /**
   * Leaderboard tier (which board and history curve the coin's miners land
   * on) - Zephyr is RandomX/cpu, Zano is ProgPowZ/gpu. Xelis is filed under
   * cpu because the tiers are per coin, not per device, but it is mined on
   * CPUs AND GPUs - see `hardware`.
   */
  tier: "cpu" | "gpu";
  algo: string;
  /**
   * PoW block target in seconds, used by the earnings estimate.
   * Zephyr and Zano are 120s: Zephyr's block time, and Zano's
   * DIFFICULTY_POW_TARGET. Zano's *chain* averages 60s because PoS blocks
   * interleave, but only PoW blocks are minable, so 120 is the right number for
   * a miner's estimate. Xelis is 5s (xelis.io; the pool API's net_hr is exactly
   * difficulty / 5).
   */
  blockTimeS: number;
  /** Reward per PoW block, for the earnings estimate. */
  blockReward: number;
  /** Atomic units per coin. ZEPH and ZANO use 1e12, XEL uses 1e8. */
  atomicUnits: number;
  /**
   * Whether the pool reports per-WORKER stats. cryptonote-nodejs-pool (Zephyr,
   * Zano) lists every rig under an address; xelis-pool reports per-ADDRESS
   * totals only - no worker list, no last-share time, no 1h/6h/24h averages -
   * so My Stats shows a note instead of an empty worker table.
   */
  workerStats: boolean;
  /**
   * Whether the Pwnda Wallet itself handles this coin (creates the address,
   * mines it, swaps the payout). True for ZEPH and ZANO. FALSE for XEL: the
   * wallet repo has no Xelis code as of 2026-09-16, so the XEL pool is
   * bring-your-own-miner only and no page may promise the wallet does it.
   */
  pwndaWallet: boolean;
  /** How often the payout run happens, for display ("30 min", "4 hours"). */
  payoutEvery: string;
  /** Confirmations a found block needs before its reward can be paid. */
  maturityConfs: number;

  // ---- presentation facts, used by Home / Get Started / Calc -------------
  // These live here so the three static pages never hardcode a coin again.
  // Every value below was read off the pool's own config.json, not guessed.

  /** CoinGecko id for the price widget. Verified against the live API. */
  coinGeckoId: string;
  /** Human algorithm label, e.g. "RandomX (rx/0) - CPU". */
  algoLabel: string;
  /**
   * The hardware this coin is mined on: "CPU", "GPU" or "GPU+CPU" (XEL - SRBMiner
   * mines xelishashv3 on CPUs and on AMD, NVIDIA and Intel GPUs). Shown as-is in
   * labels ("XEL / GPU+CPU", matching the admin dashboard); in sentences use
   * hardwarePhrase() ("GPU or CPU").
   */
  hardware: string;
  /**
   * Public stratum endpoint. All pools share :17706; nginx splits on SNI, and
   * the pool-coin-router splits SNI-less miners on their first stratum line.
   */
  stratum: string;
  /** Minimum automatic payout, formatted for display. */
  minPayout: string;
  /**
   * Payout scheme, per coin. Kept per-coin rather than hardcoded because the two
   * pools were genuinely different for a while and the site claimed otherwise.
   * Zephyr and Zano run PPLNS as of 2026-09-02: Zephyr via a local
   * lib/blockUnlocker.js patch, Zano via the same algorithm ported into a
   * vendored blockUnlocker.js that the systemd unit bind-mounts over the
   * container's stock copy. Xelis is xelis-pool's own PPLNS over a 1 h window
   * (its /stats publishes `pplns_window_seconds`). The pool APIs publish
   * `payoutScheme` too, so this label can be checked against the live pool rather
   * than trusted - see PwndaVault analyses/zephyr-pool/p2pool-comparison.md.
   */
  payoutScheme: "PPLNS" | "PROP";
  /**
   * Pool fee, percent. SINGLE SOURCE for every fee claim on the site and for the
   * earnings estimates, which used to hardcode a 0% assumption in two places and
   * would silently overstate payouts the moment this moved.
   *
   * Must match `blockUnlocker.poolFee` in each pool's config.json - the live pool
   * APIs publish it as `config.fee`, so it can be checked against the real pool
   * rather than trusted. Raised 0 -> 0.5 on 2026-09-05 by operator request.
   * Xelis publishes it as `pool_fee_percent` on /xelis-api/stats.
   *
   * This is the POOLED (prop/PPLNS) fee, which is what every flow on this site
   * describes. Solo mining is a separate rate - see `soloFeePct`.
   */
  poolFeePct: number;
  /**
   * Solo-mining fee, percent, and whether solo is offered at all.
   *
   * Solo is a genuinely different mode: the whole block goes to whoever found
   * it, so it is a lottery rather than a wage, and it is NOT what the earnings
   * estimates on this site model - those project a proportional share and would
   * be meaningless for a solo miner.
   *
   * Enabled on Zephyr and Zano 2026-09-05 at 0%. xelis-pool has no solo mode at
   * all, so XEL is soloEnabled false (its soloFeePct is 0 only to keep the
   * "solo never costs more than pooled" invariant simple). Mirrors `blockUnlocker.soloFee` and
   * `poolServer.soloEnabled`; the pool APIs publish both as `config.soloFee` and
   * `config.soloEnabled`. NOTE the pools' own fallback is
   * `soloFee >= 0 ? soloFee : poolFee`, so an ABSENT soloFee key silently bills
   * solo at the pool rate - both configs now set it explicitly for that reason.
   */
  soloFeePct: number;
  soloEnabled: boolean;
  /** What the address looks like, for the "check your address" hints. */
  addressHint: string;
  /** Placeholder used inside example miner commands. */
  addressPlaceholder: string;
  /** Miner software name and download page. */
  minerName: string;
  minerUrl: string;
  /** Wallet name and download page. */
  walletName: string;
  walletUrl: string;
  /** Bare host shown as the wallet link's visible text. */
  walletSite: string;
  /** Which platforms the miner ships for. */
  minerPlatforms: string;
  /** One-line description shown under the price. */
  blurb: string;
  /** Starting difficulty on the default port, for the facts table. */
  startDifficulty: string;
  /** Calculator defaults - a sane starting point for this coin's hardware. */
  calcHashrate: string;
  calcUnit: "h" | "kh" | "mh";
  calcPowerW: string;
  /** Typical hashrate wording for the calculator's helper line. */
  calcHint: string;
}

export const COINS: Record<CoinId, CoinSpec> = {
  zph: {
    id: "zph",
    symbol: "ZEPH",
    name: "Zephyr",
    apiBase: "/pool-api",
    tier: "cpu",
    algo: "randomx",
    blockTimeS: 120,
    blockReward: 4.11,
    atomicUnits: 1_000_000_000_000,
    workerStats: true,
    pwndaWallet: true,
    payoutEvery: "30 min", // paymentsInterval: 1800
    maturityConfs: 60,

    coinGeckoId: "zephyr-protocol",
    algoLabel: "RandomX (rx/0) - CPU",
    hardware: "CPU",
    stratum: "pool.pwnda.org:17706",
    minPayout: "0.01 ZEPH",
    payoutScheme: "PPLNS",
    poolFeePct: 0.5,
    soloFeePct: 0,
    soloEnabled: true,
    addressHint: "ZEPHYR...",
    addressPlaceholder: "YOUR_ZEPHYR_ADDRESS",
    minerName: "XMRig",
    minerUrl: "https://github.com/xmrig/xmrig/releases",
    walletName: "Zephyr Protocol",
    walletUrl: "https://www.zephyrprotocol.com/",
    walletSite: "zephyrprotocol.com",
    minerPlatforms: "Windows / Linux / macOS",
    blurb: "Zephyr Protocol - a private, untraceable stablecoin ecosystem.",
    startDifficulty: "auto (varDiff, start 5000)",
    calcHashrate: "5000",
    calcUnit: "h",
    calcPowerW: "120",
    calcHint: 'XMRig prints this as "speed 10s/60s/15m" - a typical desktop CPU does 2-15 KH/s',
  },
  zano: {
    id: "zano",
    symbol: "ZANO",
    name: "Zano",
    apiBase: "/zano-api",
    tier: "gpu",
    algo: "progpowz",
    blockTimeS: 120,
    blockReward: 1.0,
    atomicUnits: 1_000_000_000_000,
    workerStats: true,
    pwndaWallet: true,
    payoutEvery: "30 min", // paymentsInterval: 1800
    maturityConfs: 60,

    coinGeckoId: "zano",
    algoLabel: "ProgPowZ - GPU",
    hardware: "GPU",
    stratum: "zano.pwnda.org:17706",
    minPayout: "0.2 ZANO",
    payoutScheme: "PPLNS",
    poolFeePct: 0.5,
    soloFeePct: 0,
    soloEnabled: true,
    addressHint: "Zx...",
    addressPlaceholder: "YOUR_ZANO_ADDRESS",
    minerName: "SRBMiner-MULTI",
    minerUrl: "https://github.com/doktor83/SRBMiner-Multi/releases",
    walletName: "Zano",
    walletUrl: "https://zano.org/downloads",
    walletSite: "zano.org/downloads",
    minerPlatforms: "Windows / Linux, AMD and NVIDIA",
    blurb: "Zano - a private, scalable chain with confidential assets.",
    startDifficulty: "auto (varDiff, start 250 MH)",
    calcHashrate: "26",
    calcUnit: "mh",
    calcPowerW: "180",
    calcHint: "SRBMiner prints this as the GPU line - a modern gaming card does 15-35 MH/s",
  },
  // Xelis - added 2026-09-16. Values from the live /xelis-api/stats (reward,
  // fee, threshold, PPLNS window), the xelis-pool source (payout interval,
  // confirmations, starting difficulty) and the pages cited inline.
  xel: {
    id: "xel",
    symbol: "XEL",
    name: "Xelis",
    apiBase: "/xelis-api",
    tier: "cpu",
    algo: "xelishashv3",
    blockTimeS: 5,
    // Live /stats `reward`, 2026-09-16: the miner reward after the chain's 5%
    // dev fee. The pages read the live value; this is only the fallback.
    blockReward: 0.312,
    atomicUnits: 100_000_000,
    workerStats: false,
    pwndaWallet: false,
    payoutEvery: "4 hours", // xelis-pool WITHDRAW_INTERVAL = 4 * 60 * 60
    maturityConfs: 200,

    // Checked 2026-09-16: /coins/markets?ids=xelis returns {id: "xelis",
    // symbol: "xel", name: "Xelis"}, and /search?query=xelis returns only that id.
    coinGeckoId: "xelis",
    algoLabel: "XelisHashV3 - GPU+CPU",
    hardware: "GPU+CPU",
    stratum: "xel.pwnda.org:17706",
    minPayout: "0.05 XEL",
    payoutScheme: "PPLNS",
    poolFeePct: 0.5,
    soloFeePct: 0,
    soloEnabled: false,
    addressHint: "xel:...",
    addressPlaceholder: "YOUR_XELIS_ADDRESS",
    minerName: "SRBMiner-MULTI",
    minerUrl: "https://github.com/doktor83/SRBMiner-Multi/releases",
    // Genesix is the official XELIS wallet (xelis.io roadmap: "New official
    // XELIS wallet"). xelis.io itself links no download; docs.xelis.io's Genesix
    // guide points at this repository's releases (Windows, Linux, Android).
    walletName: "Genesix",
    walletUrl: "https://github.com/xelis-project/xelis-genesix-wallet/releases",
    walletSite: "github.com/xelis-project/xelis-genesix-wallet",
    minerPlatforms: "Windows / Linux (CPU; AMD, NVIDIA and Intel GPUs also supported)",
    // xelis.io: "BlockDAG", ElGamal homomorphic encryption of "amounts and
    // balances", "Block Time 5s".
    blurb: "Xelis - a BlockDAG with encrypted balances and 5-second blocks.",
    // xelis-pool InitialDifficulty (effective since XelisPool patch 0007, 2026-09-16).
    startDifficulty: "auto (varDiff, start 300,000)",
    // hashrate.no, XelisHashV3: Ryzen 7 7800X3D 8.38 KH/s at 70 W
    // (hashrate.no/cpus/7800x3d), Ryzen 9 9950X 19.29 KH/s at 190 W
    // (hashrate.no/cpus/9950x). The default is the smaller of the two.
    calcHashrate: "8",
    calcUnit: "kh",
    calcPowerW: "70",
    calcHint:
      "Use the number SRBMiner prints for your CPU and GPUs - hashrate.no lists about 8 KH/s for a Ryzen 7 7800X3D and 19 KH/s for a Ryzen 9 9950X; GPU rates vary by card",
  },
};

/** The pool shown before the user has entered any address. */
export const DEFAULT_COIN: CoinId = "zph";

/**
 * Resolve a coin id that came back from the server. Anything unrecognised
 * (including "" for an address that matched no coin) falls back to the default,
 * so the page renders a sane shell rather than blowing up on a bad string.
 */
export function coinById(id: string | undefined | null): CoinSpec {
  if (id && id in COINS) return COINS[id as CoinId];
  return COINS[DEFAULT_COIN];
}

/** The devices a coin is mined on, e.g. ["GPU", "CPU"] for XEL. */
export function hardwareParts(coin: CoinSpec): string[] {
  return coin.hardware.split("+");
}

/** `hardware` for use inside a sentence: "CPU", "GPU" or "GPU or CPU". */
export function hardwarePhrase(coin: CoinSpec): string {
  return hardwareParts(coin).join(" or ");
}

/** All coins, in display order. */
export const ALL_COINS: CoinSpec[] = [COINS.zph, COINS.zano, COINS.xel];

/**
 * How a worker name reaches the pool.
 *
 * Both cryptonote pools now read it off the ADDRESS as `ADDRESS.workerID`
 * (patched 2026-09-02), so NO password flag is needed on either, and the two
 * pools no longer need different rules.
 *
 * Before that patch the worker name could only arrive through the stratum
 * password field, and the pools disagreed about how: Zephyr's
 * cryptonote-nodejs-pool ended its Miner constructor with
 * `this.workerName = pass`, so a bare `-p rig1` worked, while zano-pool
 * assigned that value to `workerName2` - a field nothing ever reads - leaving
 * `x@rig1` as the only form that registered a Zano worker at all.
 *
 * The suffix is classified by CONTENT, not position, because `.` is also the
 * fixed-difficulty separator: an all-digits suffix still pins difficulty
 * (`ADDRESS.500000000`), anything else is a worker name. Both pools still
 * accept the old password forms, so published commands can change without
 * stranding anyone already mining.
 *
 * xelis-pool (XEL) reads the same `ADDRESS.suffix` form - it turns `.` into
 * `+` - but a numeric suffix there sets the STARTING difficulty (capped at
 * 10,000,000) and anything else is ignored. It keeps no per-worker stats, so on
 * XEL the worker name is only a label on the miner's own side.
 *
 * See PwndaVault analyses/pool-worker-names-and-passwords.md.
 */
export function walletWithWorker(coin: CoinSpec, worker = "worker1"): string {
  return worker ? `${coin.addressPlaceholder}.${worker}` : coin.addressPlaceholder;
}

/** The one-line miner command for a coin, used on the home page. */
export function minerCommand(coin: CoinSpec, worker = "worker1"): string {
  const wallet = walletWithWorker(coin, worker);
  if (coin.id === "xel") {
    return [
      "SRBMiner-MULTI --algorithm xelishashv3 \\",
      `  --pool ${coin.stratum} --tls true \\`,
      `  --wallet ${wallet} --password x`,
    ].join("\n");
  }
  if (coin.id === "zano") {
    return [
      "SRBMiner-MULTI --algorithm progpow_zano \\",
      `  --pool ${coin.stratum} --tls true \\`,
      `  --wallet ${wallet}`,
    ].join("\n");
  }
  return [
    `xmrig -o ${coin.stratum} --tls -a rx/0 \\`,
    `      -u ${wallet} -k`,
  ].join("\n");
}

/** Platform-specific launch command, for the Get Started page. */
export function minerCommandFor(
  coin: CoinSpec,
  platform: "linux" | "windows",
  worker = "worker1"
): string {
  const wallet = walletWithWorker(coin, worker);
  if (coin.id === "xel") {
    // CPU-only miners add --disable-gpu (and optionally --cpu-threads N); the
    // guide pages say so next to the command rather than baking it in here.
    const exe = platform === "windows" ? "SRBMiner-MULTI.exe" : "./SRBMiner-MULTI";
    return `${exe} --algorithm xelishashv3 --pool ${coin.stratum} --tls true --wallet ${wallet} --password x`;
  }
  if (coin.id === "zano") {
    const exe = platform === "windows" ? "SRBMiner-MULTI.exe" : "./SRBMiner-MULTI";
    return `${exe} --algorithm progpow_zano --pool ${coin.stratum} --tls true --wallet ${wallet}`;
  }
  const exe = platform === "windows" ? "xmrig.exe" : "./xmrig";
  return `${exe} -o ${coin.stratum} --tls -a rx/0 -u ${wallet} -k`;
}
