import { Link } from "react-router-dom";
import { TerminalNav, SiteFooter, TerminalFrame } from "@/components/terminal";
import { DOWNLOAD_TARGETS, RELEASES_URL, VERSION, downloadPath } from "@/lib/wallet-release";
import { MiningRig } from "@/components/terminal/MiningRig";
import { useElapsed } from "@/hooks/useElapsed";

// /wallet - the download funnel, new in the 2026-09 redesign.
//
// This is the primary CTA of the whole site: the homepage and the setup guide
// both funnel here. The old /wallet (a legacy multi-coin address lookup) was
// archived long ago and now lives at pages/WalletLegacy.tsx, unrouted.

const H1 = "A wallet that works for you - literally.";

const FEATURES = [
  {
    title: "Earn - mine X, receive Y",
    body:
      "Mine Monero or Zephyr on CPU, Zano on GPU. The EARN tab converts rewards into your chosen coin through a two-hop decentralized route - atomic swap to LTC/BCH, then NEAR intents to BTC, ETH, SOL, BNB and 11 more. You confirm each rate.",
    img: "/wallet/wallet-earn.png",
    alt: "EARN tab route: XMR to LTC to BNB",
  },
  {
    title: "Swap - atomic exchange",
    body:
      "Swap between chains without an exchange account: peer-to-peer atomic swaps, NEAR-routed pairs, and Zephyr conversions. Non-custodial, no KYC, atomic lock - the trade either completes or refunds.",
    img: "/wallet/wallet-swap.png",
    alt: "SWAP tab: atomic exchange between ETH and BTC",
  },
  {
    title: "Mine - opt-in, one click",
    body:
      "The wallet installs and manages the standard miners for you - XMRig (RandomX/CPU), SRBMiner-MULTI (ProgPowZ/GPU), lolMiner - and points them at the low-fee PWNDA pools. Pick hardware and intensity; start and stop any time.",
    img: "/wallet/wallet-settings.png",
    alt: "Settings: mining software management, privacy wallet nodes, swap node",
  },
];

const FACTS: [string, string][] = [
  ["Status", `Released - v${VERSION} available now`],
  ["Version", VERSION],
  ["Platform", "Windows and Linux (desktop)"],
  ["Price", "Free, open source"],
  ["Custody", "Non-custodial - keys stored locally"],
  ["Mineable coins", "XMR + ZEPH (CPU, RandomX) - ZANO (GPU, ProgPowZ)"],
  ["Payout coins", "BTC, ETH, USDC, SOL, XRP, ADA, AVAX + more (19)"],
  ["Swap route", "Atomic swap to LTC/BCH, then NEAR intents - 2 hops, no KYC"],
  ["Pool fee", "0.5% - TLS-only - payouts every ~30 min"],
];

const WalletPage = () => {
  const { elapsed, reduced, animating } = useElapsed(100);
  // 300ms delay, then 28ms/char. Wall-clock derived like everything else here.
  //
  // Before the first tick - i.e. in the prerendered HTML and on the first
  // client render - the FULL headline is rendered. That is the whole point:
  // an h1 that starts empty prerenders empty, and this page's h1 is its
  // single most important piece of copy.
  const typedN =
    reduced || !animating
      ? H1.length
      : Math.max(0, Math.min(H1.length, Math.floor((elapsed - 300) / 28)));

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <TerminalNav />

      <main className="mx-auto max-w-[1200px] px-4 sm:px-6">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="grid items-center gap-12 py-12 md:grid-cols-[1fr_1.1fr] md:py-16">
          <div className="pw-rise pw-rise-1">
            <div className="mb-5 text-[11px] uppercase tracking-[0.15em] text-[#b3b3b3]">
              &gt; pwnda wallet v{VERSION} - available now
            </div>

            {/* min-height reserves exactly two lines so the typing cannot
                shift the layout underneath it (CLS). */}
            <h1
              className="mb-5 min-h-[88px] text-[26px] font-bold leading-[1.3] text-white sm:text-[34px]"
              style={{ textShadow: "0 0 6px rgba(242,242,242,0.35), 0 0 14px rgba(242,242,242,0.15)" }}
            >
              {H1.slice(0, typedN)}
              <span className="pw-cursor text-[#f2f2f2]" />
            </h1>

            <p className="mb-7 max-w-[52ch] text-[14px] leading-[1.7] text-[#808080]">
              Pwnda Wallet is a non-custodial, multi-chain desktop wallet with opt-in mining built
              in. Hold BTC, ETH, SOL, XMR and more; mine on your CPU or GPU when you choose to; swap
              anything to anything through decentralized routes. Keys never leave your machine.
            </p>

            {/* Anchors to the download card rather than pretending to be a
                download. Swap back to a real installer href at release. */}
            <a href="/download" className="pw-btn-ghost inline-block px-8 py-3.5 text-[13px] font-bold">
              &gt; RELEASE STATUS
            </a>
            <div className="mt-3.5 text-[11px] text-[#666666]">
              Windows and Linux | free | open source | no account | no KYC
            </div>
          </div>

          <TerminalFrame title="MINING_RIG" className="pw-rise pw-rise-3 px-5 pb-3 pt-6">
            <MiningRig />
          </TerminalFrame>
        </section>

        {/* ── What's inside ──────────────────────────────────────── */}
        <section className="pb-2 pt-10">
          <h2 className="pw-glow-text mb-8 text-[13px] uppercase tracking-[0.1em] text-[#f2f2f2]">
            [ What's inside ]
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="pw-card p-6">
                <div className="pw-glow-text mb-2.5 text-[11px] uppercase tracking-[0.1em] text-[#f2f2f2]">
                  {f.title}
                </div>
                <p className="mb-4 text-[13px] leading-[1.7] text-[#808080]">{f.body}</p>
                <img
                  src={f.img}
                  alt={f.alt}
                  width={1200}
                  height={800}
                  loading="lazy"
                  className="block h-auto w-full border border-[#404040]"
                />
              </div>
            ))}

            {/* VAULT has no screenshot - it is the claim, not a UI tour. */}
            <div className="pw-card flex flex-col p-6">
              <div className="pw-glow-text mb-2.5 text-[11px] uppercase tracking-[0.1em] text-[#f2f2f2]">
                Vault - your keys, local
              </div>
              <p className="mb-4 text-[13px] leading-[1.7] text-[#808080]">
                Multi-chain vault with BIP39 seed import, per-chain derivation paths, and dedicated
                privacy-coin nodes for Monero, Zephyr and Zano. Everything is generated and
                encrypted on your machine - there is no server-side account to breach.
              </p>
              <div className="flex flex-1 items-center justify-center border border-[#404040] bg-[#0a0a0a] p-6">
                <div className="text-left text-[12px] leading-[2] text-[#808080]">
                  {[
                    "non-custodial - keys on disk, encrypted",
                    "no account, no email, no KYC",
                    "mining strictly opt-in",
                    "open source on GitHub (releases soon)",
                  ].map((l) => (
                    <div key={l}>
                      <span className="text-[#f2f2f2]">&gt;</span> {l}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Facts ──────────────────────────────────────────────── */}
        <section className="max-w-[820px] pb-2 pt-14">
          <h2 className="pw-glow-text mb-6 text-[13px] uppercase tracking-[0.1em] text-[#f2f2f2]">
            [ Facts ]
          </h2>
          <div className="pw-card px-6 py-2">
            {FACTS.map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between gap-4 border-b border-[#404040]/50 py-2.5 text-[12px]"
              >
                <span className="uppercase text-[#666666]">{k}</span>
                <span className="text-right text-[#e6e6e6]">{v}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Download ───────────────────────────────────────────── */}
        <section id="download" className="my-14 scroll-mt-20">
          <TerminalFrame title="DOWNLOAD" strong className="mx-auto max-w-[860px] p-8 text-center sm:p-12">
            <h2
              className="my-2 font-display text-[12px] text-white sm:text-[16px]"
              style={{ textShadow: "0 0 6px rgba(242,242,242,0.35)" }}
            >
              DOWNLOAD PWNDA WALLET
            </h2>
            <p className="mx-auto mb-7 mt-4 max-w-[56ch] text-[13px] leading-[1.7] text-[#808080]">
              Version {VERSION}, free and open source. Create a vault, back up your seed phrase,
              and you are mining in minutes - or just use it as a plain multi-chain wallet.
            </p>

            {/* Every button points at /download/<slug> on THIS origin rather than
                straight at github.com. That is what makes a download click a
                request our own logs can count - see src/lib/wallet-release.ts. */}
            <div className="mx-auto flex max-w-[520px] flex-col gap-2.5">
              {DOWNLOAD_TARGETS.filter((t) => t.os === "windows").map((t, i) => (
                <a
                  key={t.slug}
                  href={downloadPath(t.slug)}
                  className={`${i === 0 ? "pw-btn" : "pw-btn-ghost"} px-8 py-3.5 text-[13px] font-bold`}
                >
                  &gt; {t.label} - {t.size}
                </a>
              ))}
            </div>

            <details className="mx-auto mt-5 max-w-[520px] text-left">
              <summary className="cursor-pointer list-none text-center text-[12px] text-[#808080] hover:text-[#e6e6e6] [&::-webkit-details-marker]:hidden">
                <span className="text-[#f2f2f2]">+ </span>Linux builds
              </summary>
              <div className="mt-3 flex flex-col gap-2.5">
                {DOWNLOAD_TARGETS.filter((t) => t.os === "linux").map((t) => (
                  <a
                    key={t.slug}
                    href={downloadPath(t.slug)}
                    className="pw-btn-ghost px-8 py-3 text-[12px]"
                  >
                    &gt; {t.label} - {t.size}
                    {t.note ? <span className="ml-2 text-[#666666]">({t.note})</span> : null}
                  </a>
                ))}
              </div>
            </details>

            <p className="mx-auto mt-5 max-w-[56ch] text-[11px] leading-[1.7] text-[#666666]">
              Downloads are served from{" "}
              <a
                href={RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#808080] hover:text-[#e6e6e6] hover:underline"
              >
                GitHub releases
              </a>
              , where every build is published with a signature file you can verify. Antivirus may
              flag the bundled miners - that is expected for mining software. On Windows, SmartScreen
              adds an unknown-publisher prompt because the installer is not code-signed yet: choose
              More info, then Run anyway.
            </p>
          </TerminalFrame>
        </section>

        <div className="mb-14 text-center text-[12px] text-[#808080]">
          Prefer your own miner?{" "}
          <Link to="/start" className="text-[#f2f2f2] hover:underline">
            Connect directly to the pools &gt;
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default WalletPage;
