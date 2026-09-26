import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TerminalNav, SiteFooter, TerminalFrame, CoinIcon } from "@/components/terminal";
import { useElapsed } from "@/hooks/useElapsed";
import { HeroSlot, PERIOD, SCRAMBLE_MS, glow, scrambleFrame } from "@/components/terminal/HeroSlot";
import { usePoolSummary } from "@/hooks/usePoolStats";
import { formatHashrate } from "@/lib/utils";
import { COINS } from "@/lib/coins";
import { coinColor } from "@/lib/coin-art";

// / - the landing page, rebuilt 2026-09 from the Home B2 mockup.
//
// Repositioning: PWNDA leads as a non-custodial wallet with built-in mining
// that pays out in the coin you want. The public pools are still here, but as
// the secondary path - raw miner commands now live on /start, not here.
//
// SEO: every word below is real DOM at first paint. The scramble headline is
// progressive enhancement over a static, complete <h1>, and the FAQ is native
// <details> with its answers in the initial HTML - never JS-injected - so a
// crawler that does not run JS still reads the whole page.

// ── hero animation data ──────────────────────────────────────────────────
export const MINE_ALL = ["XMR", "ZEPH", "ZANO"];

/*  The hero's RECEIVE rotation.
 *
 *  TWO RULES, both load-bearing - see hero-rotation.test.ts, which fails on either.
 *
 *  1. EVERY SYMBOL MUST BE A REAL PAYOUT DESTINATION. These come from the
 *     wallet's `PWNDA_INTENTS_DESTINATION_TICKERS` (swap-data.ts) - the 19
 *     tickers NEAR Intents can deliver to an address Pwnda derives. Putting a
 *     coin here that is not on that list advertises a payout the wallet cannot
 *     make. ARB is the near miss: NEAR Intents lists the ARB token, but the
 *     wallet's destination allowlist does not include it, so it is NOT here.
 *
 *  2. THE LENGTH MUST NOT BE DIVISIBLE BY 3. The index below advances by
 *     `pair * 3 + 1`, so with a length that shares the factor 3 only a third of
 *     this list would ever be shown on screen. 13 is prime, so all 13 appear.
 *
 *  Ordered most-recognisable first, since a first-time visitor reads the first
 *  few rotations and leaves. LTC and BCH were deliberately dropped from the
 *  rotation for that reason (they remain selectable payout coins, and keep their
 *  art and colours); BTC stays as the anchor.
 */
// ORDER IS LOAD-BEARING, AND IT IS NOT THE DISPLAY ORDER.
// The rotation steps by 3 (`pair * 3 + 1`), so the first three pairs read indices
// 1, 4 and 7 - not 0, 1, 2. TRX, SOL and ETH sit at those positions deliberately:
// they are the first three coins a visitor sees, and index 1 is also what the
// server-rendered <h1> carries to every crawler.
// Do not "tidy" this into alphabetical or any other order without recomputing
// which slots the first pairs land on.
export const RECV_ALL = [
  //  0      1 (1st)   2        3        4 (2nd)  5        6
  "BTC", "TRX", "USDC", "XRP", "SOL", "ADA", "AVAX",
  //  7 (3rd)  8      9       10      11     12
  "ETH", "POL", "USDT", "SUI", "BNB", "DOGE",
];
/**
 * The pair rendered server-side and on the first client frame - pair 0 of the
 * rotation, computed with the SAME index maths the animation uses so the two can
 * never drift apart. This is what a crawler reads as the page's <h1>.
 */
// The pair the hero SETTLES ON at t=0, derived from the same index maths the
// animation uses below (pair 0 -> mine index 0, recv index `pair * 3 + 1`).
// Exported so a test can prove the two cannot drift apart: when they did, the
// server-rendered <h1> read "MINE MP& . RECEIVE T#L ." - scramble output frozen
// into the only heading a non-JS crawler ever sees.
export const FIRST_PAIR = {
  mine: MINE_ALL[0],
  recv: RECV_ALL[1 % RECV_ALL.length],   // (pair * 3 + 1) at pair = 0
};

const TYPED = "mine on your own hardware. get paid in the coin you want.";

// The wordmark. Kept as an array so the trailing space on line 1 survives any
// formatter that trims line ends.
const PWNDA_ASCII = [
  "██████╗ ██╗    ██╗███╗   ██╗██████╗  █████╗ ",
  "██╔══██╗██║    ██║████╗  ██║██╔══██╗██╔══██╗",
  "██████╔╝██║ █╗ ██║██╔██╗ ██║██║  ██║███████║",
  "██╔═══╝ ██║███╗██║██║╚██╗██║██║  ██║██╔══██║",
  "██║     ╚███╔███╔╝██║ ╚████║██████╔╝██║  ██║",
  "╚═╝      ╚══╝╚══╝ ╚═╝  ╚═══╝╚═════╝ ╚═╝  ╚═╝",
].join("\n");

const MINE_OPTS: Record<"cpu" | "gpu", { sym: string; name: string }[]> = {
  cpu: [
    { sym: "XMR", name: "Monero" },
    { sym: "ZEPH", name: "Zephyr" },
  ],
  gpu: [{ sym: "ZANO", name: "Zano" }],
};

// The chip row under "2 | coin I want". Seven concrete coins plus a count chip.
// TOTAL_DESTINATIONS is the wallet's PWNDA_INTENTS_DESTINATION_TICKERS length,
// so the "+N" is derived and cannot drift from reality the way the old hardcoded
// "+7" did (it implied 14 when the real number was already 19).
export const TOTAL_DESTINATIONS = 19;

const RECV_SHOWN = [
  { sym: "BTC", name: "Bitcoin" },
  { sym: "ETH", name: "Ethereum" },
  { sym: "USDC", name: "USD Coin" },
  { sym: "SOL", name: "Solana" },
  { sym: "XRP", name: "XRP" },
  { sym: "ADA", name: "Cardano" },
  { sym: "TRX", name: "Tron" },
];

const MORE_SYM = `+${TOTAL_DESTINATIONS - RECV_SHOWN.length}`;

export const RECV_OPTS = [...RECV_SHOWN, { sym: MORE_SYM, name: "more" }];

/** Left-to-right character lock: the resolved prefix grows, the tail stays noise. */
const Index = () => {
  const { elapsed, reduced, animating } = useElapsed(70);

  const [hw, setHw] = useState<"cpu" | "gpu">("cpu");
  const [mine, setMine] = useState("ZEPH");
  const [recv, setRecv] = useState("BTC");
  // Once the visitor touches the selector the headline stops cycling and
  // mirrors their choice. Deliberately one-way: resuming the scramble under
  // someone who just made a selection reads as the page ignoring them.
  const [locked, setLocked] = useState(false);
  const [lockedPair, setLockedPair] = useState({ mine: "ZEPH", recv: "BTC" });

  const zph = usePoolSummary("zph");
  const zano = usePoolSummary("zano");
  const xel = usePoolSummary("xel");

  // Complete before the first tick so the line is in the prerendered HTML.
  const typedN =
    reduced || !animating ? TYPED.length : Math.min(TYPED.length, Math.floor(elapsed / 30));

  // Headline pair. Symbol (colour + icon) snaps to the destination coin at the
  // start of a period while the LETTERS are still resolving - so the icon is
  // never a scrambled coin.
  const hero = useMemo(() => {
    if (locked) {
      return { mineSym: lockedPair.mine, recvSym: lockedPair.recv, mineTxt: lockedPair.mine, recvTxt: lockedPair.recv };
    }
    // SETTLED TEXT BEFORE THE FIRST TICK. `animating` is false during the server
    // render and the first client render; without this branch the prerendered
    // <h1> captured a mid-scramble frame and shipped as literal noise:
    //
    //     h1[0]: "MINE MP& . RECEIVE T#L ."
    //
    // Google recovers on its second render pass, but AI crawlers (GPTBot,
    // ClaudeBot, PerplexityBot) do not execute JavaScript at all, so that string
    // was their entire first impression of the page - and the h1 is the element
    // both search and retrieval weight most. The typed subline below already used
    // `animating` for exactly this reason; the headline was simply missed.
    //
    // Rendering pair 0 rather than a hardcoded pair keeps this identical to what
    // the client shows on its first frame, so hydration cannot mismatch.
    if (reduced || !animating) {
      return { mineSym: FIRST_PAIR.mine, recvSym: FIRST_PAIR.recv,
               mineTxt: FIRST_PAIR.mine, recvTxt: FIRST_PAIR.recv };
    }
    const pair = Math.floor(elapsed / PERIOD);
    const phase = elapsed % PERIOD;
    const tm = MINE_ALL[pair % MINE_ALL.length];
    const tr = RECV_ALL[(pair * 3 + 1) % RECV_ALL.length];
    const done = phase >= SCRAMBLE_MS;
    return {
      mineSym: tm,
      recvSym: tr,
      mineTxt: done ? tm : scrambleFrame(tm, phase / SCRAMBLE_MS),
      recvTxt: done ? tr : scrambleFrame(tr, phase / SCRAMBLE_MS),
    };
  }, [elapsed, locked, lockedPair, reduced, animating]);

  // Pass explicit values rather than reading state after setState - under React
  // 18 batching `this.state` would still hold the pre-update value here.
  const lock = (m: string, r: string) => {
    setLocked(true);
    setLockedPair({ mine: m, recv: r });
  };

  const chip = (active: boolean, sym?: string) => {
    const c = sym ? coinColor(sym) : undefined;
    return {
      className: `flex-1 border px-2 py-2.5 text-center text-[12px] transition-all ${
        active ? "bg-[#f2f2f2]/[0.08]" : "border-[#404040] bg-[#0a0a0a] text-[#808080] hover:text-[#e6e6e6]"
      }`,
      style: active
        ? { borderColor: c || "rgba(242,242,242,0.5)", color: c || "#f2f2f2", textShadow: `0 0 6px ${glow(c || "#f2f2f2")}` }
        : undefined,
    };
  };

  const mineList = MINE_OPTS[hw];
  const mineObj = mineList.find((m) => m.sym === mine) || mineList[0];
  const recvObj = RECV_OPTS.find((r) => r.sym === recv) || RECV_OPTS[0];

  // The live pool cards. XEL is here as a public pool only - it is NOT in the
  // hero or the route selector above, which describe what the Pwnda Wallet
  // mines (CoinSpec.pwndaWallet is false for XEL).
  const pools = [
    { coin: COINS.zph, summary: zph.summary },
    { coin: COINS.zano, summary: zano.summary },
    { coin: COINS.xel, summary: xel.summary },
  ].map((p) => ({ ...p, label: `${p.coin.symbol} / ${p.coin.hardware}` }));
  const walletPools = pools.filter((p) => p.coin.pwndaWallet).map((p) => p.coin);
  const byoPools = pools.filter((p) => !p.coin.pwndaWallet).map((p) => p.coin);
  // "RandomX (rx/0) - CPU" -> "RandomX", so the prose below does not nest brackets.
  const algoOf = (c: (typeof pools)[number]["coin"]) =>
    c.algoLabel.split(" - ")[0].replace(/\s*\(.*\)$/, "");

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <TerminalNav />

      <main className="mx-auto max-w-[1200px] px-4 sm:px-6">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="py-10 text-center sm:py-12">
          <div className="overflow-x-auto pw-rise pw-rise-1">
            {/* THE WORDMARK IS BLOCK ART, SO IT NEEDS A TEXT EQUIVALENT.
                Without one, the most visually prominent element on the site
                contributes a run of box-drawing characters to the page's text and
                the brand name itself is conveyed to nobody - not a crawler, not a
                screen reader. Found 2026-09-09 while investigating why the site
                ranks 42.9 for its OWN NAME. role="img" + aria-label gives it an
                accessible name and costs nothing visually. */}
            <pre
              role="img"
              aria-label="PWNDA"
              className="pw-logo-ascii m-0 inline-block whitespace-pre text-[9px] leading-[1.25] sm:text-[14px]"
            >
              {PWNDA_ASCII}
            </pre>
          </div>

          <div className="pw-rise pw-rise-2 my-5 min-h-[20px] text-[13px] text-[#b3b3b3]">
            <span className="text-[#f2f2f2]">root@pwnda:~$</span> {TYPED.slice(0, typedN)}
            <span className="pw-cursor text-[#f2f2f2]" />
          </div>

          <h1 className="pw-rise pw-rise-3 mx-auto mb-4 max-w-[24ch] font-display text-[18px] leading-[1.6] text-white sm:text-[30px]"
              style={{ textShadow: "0 0 6px rgba(242,242,242,0.35), 0 0 14px rgba(242,242,242,0.15)" }}>
            MINE <HeroSlot shown={hero.mineTxt} sym={hero.mineSym} />
            <br />
            RECEIVE <HeroSlot shown={hero.recvTxt} sym={hero.recvSym} />
          </h1>

          <p className="pw-rise pw-rise-4 mx-auto mb-10 max-w-[64ch] text-[14px] leading-[1.7] text-[#808080]">
            PWNDA is a free non-custodial wallet that mines ASIC-resistant coins on your personal
            hardware and pays you out in{" "}
            <Link to="/unmineable" className="text-[#a0a0a0] underline decoration-[#404040] hover:text-[#e6e6e6]">
              unmineable coins
            </Link>{" "}
            you want through decentralized atomic swaps.
          </p>

          {/* Route selector */}
          <TerminalFrame title="SELECT_ROUTE" strong className="pw-rise pw-rise-5 mx-auto max-w-[860px] p-6 text-left sm:p-8">
            <div className="grid items-stretch gap-6 pt-1.5 md:grid-cols-[1fr_auto_1fr]">
              {/* hardware + mine coin */}
              <div>
                <div className="mb-2.5 text-[10px] uppercase tracking-[0.1em] text-[#808080]">
                  1 | my hardware
                </div>
                <div className="flex gap-2">
                  {(["cpu", "gpu"] as const).map((h) => {
                    const c = chip(hw === h);
                    return (
                      <button
                        key={h}
                        type="button"
                        className={c.className}
                        style={c.style}
                        onClick={() => {
                          const m = h === "cpu" ? "ZEPH" : "ZANO";
                          setHw(h);
                          setMine(m);
                          lock(m, recv);
                        }}
                      >
                        {h.toUpperCase()}
                        <span className="mt-1 block text-[9px] opacity-70">
                          {h === "cpu" ? "desktop / laptop" : "4 GB+ card"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mb-2.5 mt-3.5 text-[10px] uppercase tracking-[0.1em] text-[#808080]">
                  coin to mine
                </div>
                <div className="flex gap-2">
                  {mineList.map((m) => {
                    const c = chip(mine === m.sym, m.sym);
                    return (
                      <button
                        key={m.sym}
                        type="button"
                        className={c.className}
                        style={c.style}
                        onClick={() => {
                          setMine(m.sym);
                          lock(m.sym, recv);
                        }}
                      >
                        <span className="mx-auto mb-1 block w-fit">
                          <CoinIcon symbol={m.sym} cell={2} title="" />
                        </span>
                        {m.sym}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* swap conduit */}
              <div className="flex min-w-[120px] flex-col items-center justify-center gap-2">
                <div className="text-[10px] uppercase text-[#808080]">atomic swap</div>
                <div className="pw-swap-line w-full opacity-60" />
                <div className="text-[10px] text-[#808080]">2 hops | you confirm each rate</div>
              </div>

              {/* receive coin */}
              <div>
                <div className="mb-2.5 text-[10px] uppercase tracking-[0.1em] text-[#808080]">
                  2 | coin I want
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {RECV_OPTS.map((r) => {
                    const isMore = r.sym === MORE_SYM;
                    const c = chip(recv === r.sym && !isMore, r.sym);
                    return (
                      <button
                        key={r.sym}
                        type="button"
                        disabled={isMore}
                        aria-label={isMore ? `and ${TOTAL_DESTINATIONS - RECV_SHOWN.length} more coins` : r.name}
                        className={`${c.className} ${isMore ? "cursor-default" : ""}`}
                        style={c.style}
                        onClick={() => {
                          if (isMore) return;
                          setRecv(r.sym);
                          lock(mine, r.sym);
                        }}
                      >
                        <span className="mx-auto mb-1 block w-fit">
                          <CoinIcon symbol={r.sym} cell={2} title="" />
                        </span>
                        {r.sym}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-[#404040]/60 pt-5">
              <div className="text-[13px] text-[#e6e6e6]">
                &gt; mine{" "}
                <span style={{ color: coinColor(mineObj.sym) }}>
                  {mineObj.name} ({mineObj.sym})
                </span>{" "}
                with your{" "}
                <span className="pw-glow-text text-[#f2f2f2]">{hw.toUpperCase()}</span> - payouts
                arrive as{" "}
                <span style={{ color: coinColor(recvObj.sym) }}>
                  {recvObj.name} ({recvObj.sym})
                </span>{" "}
                at your own address
              </div>
              <Link to="/wallet" className="pw-btn whitespace-nowrap px-7 py-3 text-[13px] font-bold">
                &gt; DOWNLOAD WALLET
              </Link>
            </div>
          </TerminalFrame>

          <p className="pw-rise pw-rise-6 mt-5 text-[11px] text-[#666666]">
            Windows | free &amp; open source | mining is opt-in | or{" "}
            <Link to="/start" className="text-[#b3b3b3] underline hover:text-white">
              connect your own miner to the pools
            </Link>
          </p>
        </section>

        {/* ── Stats strip ────────────────────────────────────────── */}
        <section className="my-8 grid grid-cols-2 gap-px border border-[#404040] bg-[#404040] sm:grid-cols-4">
          {[
            [`${COINS.zph.poolFeePct}%`, "pool fee, every pool"],
            [String(TOTAL_DESTINATIONS), "payout coins"],
            [`~${COINS.zph.payoutEvery}`, "zeph + zano payout runs"],
            ["0", "accounts, KYC, custody"],
          ].map(([v, l]) => (
            <div key={l} className="bg-[#121212] p-5 text-center">
              <div className="pw-glow-text text-[18px] font-bold text-[#f2f2f2]">{v}</div>
              <div className="mt-1 text-[10px] uppercase text-[#808080]">{l}</div>
            </div>
          ))}
        </section>

        {/* ── Not a normal mining pool ───────────────────────────── */}
        <section className="grid items-center gap-12 pb-2 pt-12 md:grid-cols-2">
          <div>
            <h2 className="pw-glow-text mb-4 text-[13px] uppercase tracking-[0.1em] text-[#f2f2f2]">
              [ Not a normal mining pool ]
            </h2>
            <p className="mb-4 text-[14px] leading-[1.7] text-[#808080]">
              Centralized "mine X get paid in Y" platforms credit an internal balance and convert on
              their own books - you trust them to pay out. PWNDA removes the middleman: the wallet
              mines to keys on your machine, and the conversion runs as a decentralized atomic swap
              you confirm rate-by-rate.
            </p>
            <p className="m-0 text-[14px] leading-[1.7] text-[#808080]">
              Mined XMR, ZEPH or ZANO is swapped peer-to-peer into LTC or BCH, then routed through
              NEAR intents into your destination coin. Both legs settle on-chain to addresses you
              hold.
            </p>
          </div>
          <div className="pw-card">
            <div className="flex items-center gap-2 border-b border-[#404040] px-3 py-2 text-[11px] text-[#808080]">
              <span className="inline-block h-1.5 w-1.5 animate-pulse bg-[#f2f2f2]" />
              pwnda@vault : ~/main/earn
            </div>
            <img
              src="/wallet/wallet-earn.png"
              alt="Pwnda Wallet EARN tab routing mined XMR through LTC into BNB via decentralized swaps"
              width={1200}
              height={800}
              loading="lazy"
              className="block h-auto w-full"
            />
          </div>
        </section>

        {/* ── Live pools ─────────────────────────────────────────── */}
        <section className="pb-2 pt-12">
          <h2 className="pw-glow-text mb-4 text-[13px] uppercase tracking-[0.1em] text-[#f2f2f2]">
            [ Live pools - bring your own miner ]
          </h2>
          <p className="mb-6 max-w-[76ch] text-[14px] leading-[1.7] text-[#808080]">
            The pools behind the wallet are public:{" "}
            {walletPools.map((c) => `${c.name} (${algoOf(c)}, ${c.hardware})`).join(" and ")} - payouts
            about every {COINS.zph.payoutEvery}.{" "}
            {byoPools.map((c) => (
              <span key={c.id}>
                {c.name} ({algoOf(c)}, {c.hardware}) is a bring-your-own-miner pool, paid every{" "}
                {c.payoutEvery}.{" "}
              </span>
            ))}
            All {pools.length}: {COINS.zph.poolFeePct}% fee, TLS-only.
          </p>
          <div className="grid gap-5 md:grid-cols-3">
            {pools.map(({ coin, label, summary }) => {
              const miners = summary?.miners;
              return (
                <div
                  key={coin.id}
                  className="pw-card flex flex-wrap items-center justify-between gap-4 px-6 py-5"
                >
                  <div>
                    <div
                      className="mb-1.5 text-[13px] font-bold text-[#f2f2f2]"
                      style={{ textShadow: "0 0 5px rgba(242,242,242,0.3)" }}
                    >
                      {label}
                    </div>
                    <code className="text-[11px] text-[#808080]">{coin.stratum}</code>
                  </div>
                  <div className="text-right text-[12px] text-[#e6e6e6]">
                    {/* A pool that is down renders "-", never a fake zero. */}
                    {summary ? formatHashrate(summary.hashrate ?? 0) : "-"}
                    <div className="mt-0.5 text-[10px] uppercase text-[#666666]">
                      {miners === undefined ? "-" : `${miners} ${miners === 1 ? "miner" : "miners"}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-[12px] text-[#808080]">
            <Link to="/start" className="hover:underline">Full setup guide</Link>
            {" | "}
            <Link to="/calculator" className="hover:underline">earnings calculator</Link>
            {" | "}
            <Link to="/leaderboard" className="hover:underline">wallet leaderboard</Link>
            {" | "}
            <Link to="/pool" className="hover:underline">my stats</Link>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────── */}
        <section className="max-w-[820px] pb-2 pt-14">
          <h2 className="pw-glow-text mb-6 text-[13px] uppercase tracking-[0.1em] text-[#f2f2f2]">
            [ FAQ ]
          </h2>
          <div className="flex flex-col">
            {[
              [
                "How can I mine Bitcoin on a normal PC?",
                "You can't mine Bitcoin itself on a PC - it needs ASICs. The practical route is mining an ASIC-resistant coin your hardware is good at (Monero or Zephyr on CPU, Zano on GPU) and swapping rewards into BTC. PWNDA automates that with decentralized swaps, so no exchange account is involved.",
              ],
              [
                "Which coins can I receive?",
                "BTC, ETH, USDC, SOL, XRP, ADA, AVAX and more - 19 destination coins today, including USDC and USDT. You mine XMR, ZEPH or ZANO; the wallet's EARN tab handles the two-hop conversion and you confirm each rate before it executes.",
              ],
              [
                'Is this custodial like other "mine X get Y" sites?',
                "No. PWNDA never holds a balance for you. Mining pays out on-chain to your own address, and swaps settle wallet-to-wallet via atomic swaps and NEAR intents. There is no account to create and nothing to withdraw.",
              ],
              [
                "What does it cost?",
                "The wallet is free and open source, and the Zephyr and Zano pools charge a 0.5% fee. Swaps carry only network fees and the market spread of the route - roughly ~1% on the P2P leg - shown before you confirm.",
              ],
            ].map(([q, a], i, arr) => (
              <details
                key={q}
                className={`border-t border-[#404040] py-4 ${i === arr.length - 1 ? "border-b" : ""}`}
              >
                <summary className="cursor-pointer list-none text-[14px] font-bold text-[#e6e6e6] [&::-webkit-details-marker]:hidden">
                  <span className="pw-glow-text text-[#f2f2f2]">+ </span>
                  {q}
                </summary>
                <p className="mt-3 text-[13px] leading-[1.7] text-[#808080]">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Final CTA ──────────────────────────────────────────── */}
        <section className="my-14">
          <TerminalFrame title="START_MINING" strong className="mx-auto max-w-[860px] p-8 text-center sm:p-11">
            <div
              className="my-2 font-display text-[12px] text-white sm:text-[16px]"
              style={{ textShadow: "0 0 6px rgba(242,242,242,0.35)" }}
            >
              MINE{" "}
              <span className="inline-block min-w-[4ch]" style={{ color: coinColor(hero.mineSym) }}>
                {hero.mineTxt}
              </span>{" "}
              -&gt; RECEIVE{" "}
              <span className="inline-block min-w-[4ch]" style={{ color: coinColor(hero.recvSym) }}>
                {hero.recvTxt}
              </span>
            </div>
            <p className="mx-auto mb-6 mt-3.5 max-w-[52ch] text-[13px] text-[#808080]">
              One install. Your keys, your hardware, your payout coin.
            </p>
            <Link to="/wallet" className="pw-btn inline-block px-10 py-4 text-[14px] font-bold">
              &gt; DOWNLOAD PWNDA WALLET
            </Link>
          </TerminalFrame>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Index;
