import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { TerminalNav, SiteFooter } from "@/components/terminal";
import { NextBlockLine } from "@/components/terminal/NextBlock";
import {
  ALL_COINS,
  COINS,
  DEFAULT_COIN,
  minerCommandFor,
  walletWithWorker,
  type CoinId,
  type CoinSpec,
} from "@/lib/coins";

// /start - the pool setup guide, rebuilt 2026-09 from the redesign mockup.
//
// Two ways in: the wallet does it for you (easy mode), or you point your own
// miner at the public stratum endpoints (manual mode). The pool picker swaps
// the entire manual walkthrough between ZEPH/CPU, ZANO/GPU and XEL/CPU. XEL is
// manual mode only - the Pwnda Wallet does not handle it (CoinSpec.pwndaWallet).
//
// EVERY factual value here - stratum, commands, min payout, worker-name rule,
// fixed-difficulty suffix - is read from src/lib/coins.ts. Nothing about the
// pools is hardcoded in this file, so the guide cannot drift from what the
// pool actually accepts. Only prose lives here.

interface Guide {
  configLabel: string;
  configText: string;
  /** Replaces the whole "anything after the dot" sentence when set. */
  workerLine?: string;
  workerNote: string;
  /** "Fixed" on the cnp pools; "Starting" on XEL, where a number only seeds varDiff. */
  diffKind: "Fixed" | "Starting";
  diffQualifier: string;
  diffSuffix: string;
  diffNote: string;
  /**
   * The legacy password form that still sets a worker name, for miners who pin
   * difficulty on the address. Absent when the pool has no such form (XEL).
   */
  oldWorkerForm?: string;
  /** Real console output. null when none has been captured yet - never invent one. */
  sampleOutput: string | null;
  troubleshoot: string;
  /** Appended to the "How do payouts work?" answer. */
  payoutExtra?: string;
  hardwareQ: string;
  hardwareA: string;
  hashrateHint: string;
}

const GUIDES: Record<CoinId, Guide> = {
  zph: {
    configLabel: "...or edit config.json in the XMRig folder",
    configText: `{
  "pools": [{
    "url": "pool.pwnda.org:17706",
    "algo": "rx/0",
    "user": "YOUR_ZEPHYR_ADDRESS.worker1",
    "tls": true,
    "keepalive": true
  }]
}`,
    workerNote: ", and a bare -p worker1 still works if you prefer the old form",
    diffKind: "Fixed",
    oldWorkerForm: "-p worker1",
    diffQualifier: "(optional, for very large or very small rigs)",
    diffSuffix: "500000",
    diffNote: "Otherwise varDiff tunes automatically.",
    sampleOutput: `[2026-07-09 16:20:31] net      new job from pool.pwnda.org:17706 diff 5000 algo rx/0
[2026-07-09 16:20:44] cpu      accepted (1/0) diff 5000 (42 ms)`,
    troubleshoot:
      'Seeing "unknown algorithm" or instant disconnects? Make sure -a rx/0 and --tls are both set, and your address starts with ZEPHYR.',
    hardwareQ: "GPU or ASIC for Zephyr?",
    hardwareA:
      "RandomX is CPU-optimized by design - modern desktop CPUs with big caches do best. GPUs are wildly inefficient on it; there are no RandomX ASICs.",
    hashrateHint: "XMRig prints it as speed 10s/60s/15m",
  },
  zano: {
    configLabel: "...or save this as start.bat next to SRBMiner-MULTI.exe",
    configText: `@echo off
SRBMiner-MULTI.exe ^
  --algorithm progpow_zano ^
  --pool zano.pwnda.org:17706 ^
  --tls true ^
  --wallet YOUR_ZANO_ADDRESS.worker1
pause`,
    workerNote: ", and the old --password x@worker1 form still works",
    diffKind: "Fixed",
    oldWorkerForm: "--password x@worker1",
    diffQualifier: "(recommended)",
    diffSuffix: "500000000",
    diffNote:
      "Pinning near your steady rate stops varDiff drift - a 26 MH/s card wants roughly 500000000.",
    sampleOutput: `[2026-08-28 13:37:00] Job received [0xdea9bcf1...] block height 3835922 [progpow_zano][0]
[2026-08-28 13:37:01] GPU0[t0] share accepted [  312ms] [progpow_zano][0]`,
    troubleshoot:
      'Seeing instant disconnects or "invalid address"? Make sure --algorithm progpow_zano and --tls true are both set, and your address starts with Zx.',
    hardwareQ: "CPU or ASIC for Zano?",
    hardwareA:
      "ProgPowZ is GPU-friendly and ASIC-resistant. A CPU will technically hash it but at a rate that is not worth the power; there are no ProgPowZ ASICs. 4 GB of VRAM is enough.",
    hashrateHint: "SRBMiner prints it on the GPU0 line, in MH/s",
  },
  // Xelis, 2026-09-16. Command and suffix rules from the pool's own source
  // (xelis-pool cmd/slave/stratum.go) and the go-live notes; no sample console
  // output yet, because no public SRBMiner session has been captured.
  xel: {
    configLabel: "...or save this as start.bat next to SRBMiner-MULTI.exe (mines on every supported GPU and the CPU)",
    configText: `@echo off
SRBMiner-MULTI.exe ^
  --algorithm xelishashv3 ^
  --pool xel.pwnda.org:17706 ^
  --tls true ^
  --wallet YOUR_XELIS_ADDRESS.worker1 ^
  --password x
pause`,
    workerLine:
      "Your address must include the xel: prefix. Anything after the dot is a worker label for your own reference - the XEL pool reports per-address totals only. SRBMiner mines on the CPU and the GPUs together: add --disable-gpu for CPU only, --disable-cpu for GPU only, --gpu-id 0,1 to pick cards (--list-devices shows them), and --cpu-threads N to leave some threads free",
    workerNote: "",
    diffKind: "Starting",
    diffQualifier: "(optional)",
    diffSuffix: "2000000",
    diffNote:
      "Without it the pool starts at 300,000 (about one desktop CPU) and varDiff tunes from there within a few shares - a GPU rig can start higher. The number goes first (address.2000000.worker1) and is capped at 10,000,000.",
    sampleOutput: null,
    troubleshoot:
      'Seeing instant disconnects or "invalid wallet address"? Make sure --algorithm xelishashv3 and --tls true are both set, and your address starts with xel: - the prefix is part of the address.',
    payoutExtra: " On XEL the share window is the last hour, and a flat network fee is deducted from each payout.",
    hardwareQ: "GPU, CPU or ASIC for Xelis?",
    hardwareA:
      "GPU and CPU. The XELIS project describes its algorithm as CPU/GPU friendly and built for FPGA and ASIC resistance, so there are no ASICs to compete with. SRBMiner mines it on the CPU and on AMD, NVIDIA and Intel GPUs at the same time; --disable-gpu or --disable-cpu picks one.",
    hashrateHint: "use the hashrate SRBMiner reports",
  },
};

function Card({
  children,
  strong = false,
  className = "",
}: {
  children: React.ReactNode;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div className={`${strong ? "pw-card-strong" : "pw-card"} ${className}`}>{children}</div>
  );
}

function Code({ children, small = false }: { children: string; small?: boolean }) {
  return (
    <code
      className={`block overflow-x-auto whitespace-pre border border-[#404040] bg-[#0a0a0a] ${
        small ? "p-3 text-[11px] text-[#808080]" : "p-3.5 text-[12px] text-[#b3b3b3]"
      }`}
    >
      {children}
    </code>
  );
}

function Faq({ q, a, last = false }: { q: string; a: React.ReactNode; last?: boolean }) {
  return (
    <details
      className={`border-t border-[#404040] py-3.5 ${last ? "border-b" : ""}`}
    >
      <summary className="cursor-pointer list-none text-[13px] font-bold text-[#e6e6e6] [&::-webkit-details-marker]:hidden">
        <span className="pw-glow-text text-[#f2f2f2]">+ </span>
        {q}
      </summary>
      <p className="mt-3 text-[13px] leading-[1.7] text-[#808080]">{a}</p>
    </details>
  );
}

// Every coin walkthrough is rendered into the DOM and the inactive ones are
// hidden, rather than swapping a single panel's contents. That is deliberate:
// /start is the page targeting "zano mining pool" as much as "zephyr mining
// pool", and a crawler that does not click the picker would otherwise never
// see the Zano (or Xelis) commands at all. Standard tab semantics - every panel
// is real content the visitor can switch to.
function PoolWalkthrough({ coinId, active }: { coinId: CoinId; active: boolean }) {
  const coin = COINS[coinId];
  const g = GUIDES[coinId];
  const cmd = minerCommandFor(coin, "linux");
  const cmdWindows = minerCommandFor(coin, "windows");
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const copyCmd = () => {
    // Swallow both the sync throw (no API / insecure context) and the async
    // rejection - neither should surface as a broken button.
    try {
      void navigator.clipboard?.writeText(cmd).catch(() => {});
    } catch {
      /* clipboard unavailable */
    }
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div hidden={!active} id={`setup-${coinId}`}>
      {!coin.pwndaWallet && (
        <p className="mb-4 text-[12px] leading-[1.7] text-[#808080]">
          Manual mode only: the Pwnda Wallet does not handle {coin.symbol}, so this pool is for your own
          miner and a {coin.name} wallet.
        </p>
      )}
      {/* Facts strip */}
      <Card className="mb-6 px-6 py-2">
        <div className="grid grid-cols-2 gap-2 py-3 text-[12px] sm:grid-cols-4">
          {[
            ["Stratum", coin.stratum],
            ["Algorithm", coin.algoLabel],
            ["Fee / scheme", `${coin.poolFeePct}% / ${coin.payoutScheme}`],
            ["Min payout", `${coin.minPayout} - every ~${coin.payoutEvery}`],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-[10px] uppercase text-[#666666]">{k}</div>
              <div className="mt-1 text-[#e6e6e6]">{v}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <Card className="px-6 py-5">
          <div className="mb-2 text-[13px] font-bold text-white">
            <span className="text-[#f2f2f2]">[1]</span> Get a {coin.name} address
          </div>
          <p className="m-0 text-[13px] leading-[1.7] text-[#808080]">
            Grab an official wallet from{" "}
            <a href={coin.walletUrl} target="_blank" rel="noopener noreferrer" className="text-[#f2f2f2] hover:underline">
              {coin.walletSite}
            </a>
            , back up the seed phrase, and copy your public address (starts with{" "}
            <span className="text-[#e6e6e6]">{coin.addressHint}</span>). Rewards are sent on-chain
            to this address - never mine to an exchange deposit address.
          </p>
        </Card>

        <Card className="px-6 py-5">
          <div className="mb-2 text-[13px] font-bold text-white">
            <span className="text-[#f2f2f2]">[2]</span> Download {coin.minerName}
          </div>
          <p className="m-0 text-[13px] leading-[1.7] text-[#808080]">
            Latest release at{" "}
            <a href={coin.minerUrl} target="_blank" rel="noopener noreferrer" className="text-[#f2f2f2] hover:underline">
              GitHub
            </a>{" "}
            ({coin.minerPlatforms}). Unpack anywhere. Antivirus flagging the download is normal for
            miners - whitelist the folder.
          </p>
        </Card>

        <Card className="px-6 py-5">
          <div className="mb-3 text-[13px] font-bold text-white">
            <span className="text-[#f2f2f2]">[3]</span> Connect - one command
          </div>
          <div className="relative mb-3">
            <Code>{cmd}</Code>
            <button
              type="button"
              onClick={copyCmd}
              className="absolute right-2 top-2 border border-[#404040] bg-[#0a0a0a]/90 px-2.5 py-[3px] text-[10px] text-[#808080] hover:border-[#f2f2f2]/50 hover:text-[#f2f2f2]"
            >
              {copied ? "COPIED +" : "COPY"}
            </button>
          </div>
          <p className="mb-2 text-[12px] leading-[1.7] text-[#808080]">
            Replace <span className="text-[#e6e6e6]">{coin.addressPlaceholder}</span> with your
            address.{" "}
            {g.workerLine ?? (
              <>
                Anything after the dot is your <b className="text-[#e6e6e6]">worker name</b> - no
                password flag needed{g.workerNote}
              </>
            )}
            . TLS is required.
          </p>
          <details className="mt-2.5 border-t border-[#404040]/50 pt-2.5">
            <summary className="cursor-pointer list-none text-[12px] text-[#808080] [&::-webkit-details-marker]:hidden">
              <span className="pw-glow-text text-[#f2f2f2]">+ </span>
              Windows command, config file, and {g.diffKind.toLowerCase()} difficulty
            </summary>
            <div className="flex flex-col gap-2.5 pt-3">
              <div className="text-[11px] uppercase text-[#666666]">Windows</div>
              <Code small>{cmdWindows}</Code>
              <div className="text-[11px] uppercase text-[#666666]">{g.configLabel}</div>
              <Code small>{g.configText}</Code>
              <p className="m-0 text-[12px] leading-[1.7] text-[#808080]">
                <b className="text-[#e6e6e6]">{g.diffKind} difficulty</b> {g.diffQualifier}: append to the
                address -{" "}
                <span className="text-[#e6e6e6]">
                  {coin.addressPlaceholder}.{g.diffSuffix}
                </span>
                . {g.diffNote}{" "}
                {g.oldWorkerForm ? (
                  <>
                    The suffix is one or the other: a number pins difficulty, a name sets the worker.
                    To use both, pin the difficulty on the address and pass the worker name the old
                    way ({g.oldWorkerForm}).
                  </>
                ) : (
                  <>The suffix is one or the other: a number sets the starting difficulty, anything else is a label.</>
                )}
              </p>
            </div>
          </details>
        </Card>

        <Card className="px-6 py-5">
          <div className="mb-2 text-[13px] font-bold text-white">
            <span className="text-[#f2f2f2]">[4]</span> Verify
          </div>
          <p className="mb-3 text-[13px] leading-[1.7] text-[#808080]">
            Within a minute the console shows <span className="text-[#f2f2f2]">accepted</span>{" "}
            shares. Then paste your address on{" "}
            <Link to="/pool" className="text-[#f2f2f2] hover:underline">
              My Stats
            </Link>{" "}
            {coin.workerStats
              ? "- hashrate, workers and pending balance appear after the first accepted share."
              : "- hashrate and pending balance appear shortly after your first accepted shares, as totals for the address (no per-worker view)."}
          </p>
          <details>
            <summary className="cursor-pointer list-none text-[12px] text-[#808080] [&::-webkit-details-marker]:hidden">
              <span className="pw-glow-text text-[#f2f2f2]">+ </span>
              {g.sampleOutput ? "Sample output and troubleshooting" : "Troubleshooting"}
            </summary>
            <div className="pt-3">
              {g.sampleOutput && <Code small>{g.sampleOutput}</Code>}
              <p className={`${g.sampleOutput ? "mt-3" : "mt-0"} text-[12px] leading-[1.7] text-[#ff4444]`}>
                {g.troubleshoot}
              </p>
            </div>
          </details>
        </Card>
      </div>
    </div>
  );
}

const GetStarted = () => {
  const [coinId, setCoinId] = useState<CoinId>(DEFAULT_COIN);
  const coin: CoinSpec = COINS[coinId];
  const g = GUIDES[coinId];
  const workerExample = walletWithWorker(coin, "rig2");
  const manualOnly = ALL_COINS.filter((c) => !c.pwndaWallet);
  const cpuSyms = ALL_COINS.filter((c) => c.tier === "cpu").map((c) => c.symbol);
  const gpuSyms = ALL_COINS.filter((c) => c.tier === "gpu").map((c) => c.symbol);

  const poolBtn = (active: boolean) =>
    `flex-1 border px-3 py-2 text-[12px] transition-colors ${
      active
        ? "border-[#f2f2f2]/50 bg-[#f2f2f2]/[0.08] text-[#f2f2f2]"
        : "border-[#404040] bg-[#0a0a0a] text-[#a0a0a0] hover:text-[#e6e6e6]"
    }`;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <TerminalNav />

      <main className="mx-auto max-w-[900px] px-4 pb-6 sm:px-6">
        {/* Hero */}
        <section className="py-10 text-center sm:py-14">
          <h1 className="mb-3 text-[24px] font-bold text-white sm:text-[28px]">
            Start mining in ~10 minutes
          </h1>
          <p className="mx-auto max-w-[60ch] text-[13px] leading-[1.7] text-[#808080]">
            Two ways in: let the wallet do the setup, or point your own miner at the pools. Same
            low-fee pools either way
            {manualOnly.length
              ? ` - except ${manualOnly.map((c) => c.name).join(" and ")}, which is manual mode only`
              : ""}
            .
          </p>
        </section>

        {/* Easy vs manual */}
        <section className="mb-12 grid gap-5 md:grid-cols-2">
          <Card strong className="p-6">
            <div className="mb-3 text-[11px] tracking-[0.1em] text-[#f2f2f2]">
              &gt; EASY MODE - the wallet does it
            </div>
            <ol className="mb-4 list-decimal pl-5 text-[13px] leading-[2] text-[#808080]">
              <li>Download Pwnda Wallet, create a vault, back up the seed.</li>
              <li>Open MINE, pick CPU or GPU, press START MINING.</li>
              <li>Open EARN to route rewards into the coin you want.</li>
            </ol>
            <Link
              to="/wallet"
              className="pw-btn inline-block px-6 py-2.5 text-[12px] font-bold uppercase"
            >
              &gt; Get the wallet
            </Link>
          </Card>

          <Card className="p-6">
            <div className="mb-3 text-[11px] tracking-[0.1em] text-[#808080]">
              &gt; MANUAL MODE - your own miner
            </div>
            <p className="mb-4 text-[13px] leading-[1.7] text-[#808080]">
              Run {COINS.zph.minerName} or {COINS.zano.minerName} against the public stratum
              endpoints with your own address. Full walkthrough below - pick a pool to load the
              matching setup.
            </p>
            <a
              href="#manual"
              className="pw-btn-ghost inline-block px-6 py-2.5 text-[12px] uppercase"
            >
              Jump to setup &gt;
            </a>
          </Card>
        </section>

        {/* Manual walkthrough */}
        <section id="manual">
          <div className="mb-5 flex items-center gap-3">
            <span className="text-[12px] uppercase text-[#666666]">Pool</span>
            <div className="flex max-w-[420px] flex-1 gap-2">
              {ALL_COINS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-controls={`setup-${c.id}`}
                  aria-selected={coinId === c.id}
                  onClick={() => setCoinId(c.id)}
                  className={poolBtn(coinId === c.id)}
                >
                  {c.symbol} / {c.hardware}
                </button>
              ))}
            </div>
          </div>

          {ALL_COINS.map((c) => (
            <PoolWalkthrough key={c.id} coinId={c.id} active={coinId === c.id} />
          ))}
        </section>

        {/* Payouts and FAQ */}
        <section className="pb-2 pt-12">
          <h2 className="pw-glow-text mb-5 text-[13px] uppercase tracking-[0.1em] text-[#f2f2f2]">
            [ Payouts &amp; FAQ ]
          </h2>
          <div className="flex flex-col">
            <Faq q="When is my first payout?" a={<NextBlockLine coinId={coinId} />} />
            <Faq
              q="How do payouts work?"
              a={`${coin.payoutScheme} with a ${coin.poolFeePct}% pool fee: ${
                coin.payoutScheme === "PPLNS"
                  ? "block rewards are split across the recent share window in proportion to your work"
                  : "each block is split across that round's shares in proportion to your work"
              }. Rewards unlock after ${coin.maturityConfs} confirmations; the payout run happens every ~${coin.payoutEvery} and sends any balance over ${coin.minPayout}.${g.payoutExtra ?? ""} On a young pool expect variance between blocks - shares are never lost.`}
            />
            <Faq
              q="Can I run multiple rigs or mine more than one coin?"
              a={`Yes. Put a different worker name after your address on each rig (${workerExample}) - ${
                coin.workerStats
                  ? "no password flag needed, and each shows separately on My Stats"
                  : `the ${coin.symbol} pool shows the address total on My Stats, not each rig`
              }. ${cpuSyms.join(" and ")} want CPUs and ${gpuSyms.join(" and ")} wants GPUs, so a GPU coin never competes with a CPU coin for hardware (two CPU coins do). My Stats detects the pool from your address automatically.`}
            />
            <Faq q={g.hardwareQ} a={g.hardwareA} />
            <Faq
              last
              q="How much will I earn?"
              a={
                <>
                  Run the{" "}
                  <Link to="/calculator" className="text-[#f2f2f2] hover:underline">
                    calculator
                  </Link>{" "}
                  with your rig's hashrate ({g.hashrateHint}). A typical desktop CPU does 2-15 KH/s
                  on RandomX; a modern GPU does 15-35 MH/s on ProgPowZ; on XelisHashV3, hashrate.no
                  lists about 8 KH/s for a Ryzen 7 7800X3D.
                </>
              }
            />
          </div>
        </section>

        <div className="my-12 text-center text-[12px] text-[#808080]">
          Rather skip all of this?{" "}
          <Link to="/wallet" className="text-[#f2f2f2] hover:underline">
            The wallet sets up mining in one click &gt;
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default GetStarted;
