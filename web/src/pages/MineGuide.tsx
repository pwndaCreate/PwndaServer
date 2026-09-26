import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { TerminalNav, SiteFooter } from "@/components/terminal";
import { Card, Cmd, Facts, Faq, Label, Steps } from "@/components/terminal/Guide";
import { NextBlockLine } from "@/components/terminal/NextBlock";
import { COINS, hardwareParts, hardwarePhrase, minerCommandFor, type CoinId, type CoinSpec } from "@/lib/coins";
import { MINE_PATH } from "@/routes";

// /mine/zephyr, /mine/zano and /mine/xelis - the subject-matter pages.
//
// WHY THESE EXIST. The SEO plan's second Search Console pull (2026-09-09) had
// zero impressions for any mining-qualified query, and the reason was plain:
// /start is a setup guide and /pool is a lookup, so no page on the site was
// ABOUT mining Zephyr or Zano as a subject. These are. The competitive field
// for "zephyr mining pool" or "how to mine zano" is a handful of sites, which
// is a fight this size of site can actually win.
//
// EVERY factual value - algorithm, stratum, fee, payout scheme, minimum payout,
// miner name, hashrate hints - comes from src/lib/coins.ts, which the tests
// check against the live pool APIs. Nothing about the pool is typed here twice.
//
// The vocabulary is deliberate: "PC", "desktop", "laptop", "gaming GPU",
// "CPU mining", "ASIC-resistant". All three algorithms are designed to keep
// ASICs out, which makes PC miners the intended audience and is a true claim.
//
// XEL differs from the other two in ways the page must not paper over: the
// Pwnda Wallet does not handle it (CoinSpec.pwndaWallet), the pool has no solo
// mode and no per-worker stats, and it pays every 4 hours, not every 30 min.
// Each of those is read from the coin spec below, never assumed.

/** Payout-timing row: interval, confirmations, and roughly how long that is. */
function payoutTiming(coin: CoinSpec): string {
  const sec = coin.maturityConfs * coin.blockTimeS;
  const approx = sec >= 3600 ? `~${Math.round(sec / 3600)}h` : `~${Math.round(sec / 60)} min`;
  return `every ${coin.payoutEvery} once a block has ${coin.maturityConfs} confirmations (${approx})`;
}

interface Prose {
  hardwareLine: string;
  hashrateLine: string;
  threadsTip: string;
  asicAnswer: string;
  laptopAnswer: string;
  /** The coin the "how does X compare" FAQ and the footer link lead with. */
  compareWith: CoinId;
  /** Appended to the payout scheme in the facts table, e.g. the PPLNS window. */
  schemeDetail?: string;
  /** Extra facts-table rows for this coin only. */
  extraFacts?: [string, ReactNode][];
  /** Replaces the default "Replace ADDRESS / worker name" paragraph. */
  addressNote?: ReactNode;
  /** Added to the PPLNS FAQ answer. */
  pplnsNote?: string;
}

const PROSE: Record<CoinId, Prose> = {
  zph: {
    hardwareLine: "any x86-64 desktop or laptop CPU - more cores and more L3 cache mine faster",
    hashrateLine: "a typical desktop CPU does 2-15 KH/s; a modern 8-core with large cache sits at the top of that range",
    threadsTip: "Add -t 4 (or half your thread count) to keep the machine usable while it mines.",
    asicAnswer:
      "Yes. RandomX is built around CPU cache and branch behaviour that an ASIC cannot copy cheaply - it is the same algorithm Monero uses for the same reason. An office desktop or a gaming PC is the intended hardware, and a CPU earns a fair share of the network rather than being drowned out by purpose-built machines.",
    laptopAnswer:
      "Yes. The limit is heat, not the algorithm. Run fewer threads than the CPU has (-t 4 on an 8-thread laptop), keep the vents clear, and expect the lower end of the hashrate range.",
    compareWith: "zano",
  },
  zano: {
    hardwareLine: "any modern gaming GPU, AMD or NVIDIA, with 4 GB or more of memory",
    hashrateLine: "a modern gaming card does 15-35 MH/s; older or entry cards land below that",
    threadsTip: "Leave the CPU alone - ProgPowZ is GPU work, and the miner uses almost none of it.",
    asicAnswer:
      "Yes. ProgPowZ is a ProgPow variant, a family designed so the fastest possible hardware for it IS a graphics card. There is no ASIC advantage to buy, so a gaming GPU competes on equal terms with everything else on the network.",
    laptopAnswer:
      "Only with a discrete GPU, and the thermal ceiling is low. A gaming laptop will mine; an integrated GPU will not earn anything worth the power.",
    compareWith: "zph",
  },
  xel: {
    hardwareLine:
      "GPU and CPU - AMD, NVIDIA or Intel graphics cards and desktop or laptop CPUs (SRBMiner-MULTI mines on both at once)",
    // hashrate.no XelisHashV3 figures, 2026-09-16 (see calcHint in coins.ts).
    hashrateLine:
      "hashrate.no lists about 8 KH/s for a Ryzen 7 7800X3D and 19 KH/s for a Ryzen 9 9950X; smaller CPUs land below that, and GPU rates vary by card - SRBMiner prints each device's rate",
    threadsTip:
      "To mine on the CPU only, add --disable-gpu; add --cpu-threads N (for example half your thread count) to keep the machine usable.",
    // xelis.io: "XELIS Hash - A new CPU/GPU friendly algorithm. FPGAs and ASIC resistance".
    asicAnswer:
      "Yes, by design. The XELIS project describes its XELIS Hash algorithm as CPU/GPU friendly and built for FPGA and ASIC resistance, so a gaming GPU or a desktop CPU is intended hardware rather than an afterthought.",
    laptopAnswer:
      "Yes. The limit is heat, not the algorithm. Run fewer threads than the CPU has (--cpu-threads 4 on an 8-thread laptop), add --disable-gpu, keep the vents clear, and expect a lower hashrate than a desktop.",
    compareWith: "zph",
    schemeDetail: "over a 1 h window",
    extraFacts: [
      ["Network fee", "a flat network fee is deducted from each payout"],
      ["Address", <span key="a">must include the <code>xel:</code> prefix</span>],
      [
        "Stats",
        <span key="s">
          per address on{" "}
          <Link to="/pool" className="text-[#e6e6e6] underline">
            My Stats
          </Link>{" "}
          - no per-worker breakdown
        </span>,
      ],
    ],
    addressNote: (
      <>
        Replace <code>YOUR_XELIS_ADDRESS</code> with your full address, including the <code>xel:</code>{" "}
        prefix. The part after the dot is a label for your own reference - the pool reports per-address
        totals, not per worker - and a number there sets your starting difficulty instead. Your address
        shows on the{" "}
        <Link to="/pool" className="text-[#e6e6e6] underline">
          pool lookup
        </Link>{" "}
        shortly after your first accepted shares.
      </>
    ),
    pplnsNote: "On the XEL pool the window is the last hour of shares.",
  },
};

export default function MineGuide({ coinId }: { coinId: CoinId }) {
  const coin = COINS[coinId];
  const p = PROSE[coinId];
  const other = COINS[p.compareWith];
  const otherPath = MINE_PATH[p.compareWith];
  // Every other guide, compared-with coin first, for the bottom link row.
  const others = [p.compareWith, ...(Object.keys(MINE_PATH) as CoinId[])]
    .filter((id, i, all) => id !== coinId && all.indexOf(id) === i)
    .map((id) => COINS[id]);
  const hw = hardwarePhrase(coin); // "CPU" | "GPU" | "GPU or CPU"
  const hwWho = hardwareParts(coin)
    .map((h) => (h === "CPU" ? "desktop or laptop CPU" : "gaming GPU"))
    .join(" or a ");
  // How this coin and the compared one share a machine.
  const mine = hardwareParts(coin);
  const theirs = hardwareParts(other);
  const common = mine.filter((h) => theirs.includes(h));
  let sharing: string;
  if (common.length === 0) {
    sharing = " A machine with both a good CPU and a good GPU can mine both at once - see ";
  } else if (mine.length === theirs.length && common.length === mine.length) {
    sharing = ` Both want the ${common.join(" and ")}, so a machine mines one or the other at a time - see `;
  } else {
    const wider = mine.length > theirs.length ? coin : other;
    const narrower = wider === coin ? other : coin;
    const spare = hardwareParts(wider).filter((h) => !common.includes(h)).join(" and ");
    sharing = ` Both can use the ${common.join(" and ")}; a machine with a GPU as well can mine ${wider.name} on the ${spare} and ${narrower.name} on the ${common.join(" and ")} at the same time - see `;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <TerminalNav />

      <main className="mx-auto max-w-[900px] px-4 pb-6 sm:px-6">
        {/* Hero: the answer, first. */}
        <section className="py-10 text-center sm:py-14">
          <h1 className="mb-3 text-[24px] font-bold text-white sm:text-[28px]">
            Mine {coin.name} on your {hw}
          </h1>
          <p className="mx-auto max-w-[62ch] text-[13px] leading-[1.7] text-[#808080]">
            {coin.algoLabel.split(" - ")[0]} is ASIC-resistant, so a {hwWho} competes on
            equal terms. {coin.poolFeePct}% fee, {coin.payoutScheme}, paid to your own address from{" "}
            {coin.minPayout}. No account, no email - your wallet address is your login.
          </p>
        </section>

        {/* Facts */}
        <section className="mb-10">
          <Card strong className="p-6">
            <Label>{coin.symbol} pool facts</Label>
            <Facts
              rows={[
                ["Algorithm", coin.algoLabel],
                ["Hardware", p.hardwareLine],
                ["Pool", <code key="s">{coin.stratum}</code>],
                ["Encryption", "TLS on - your shares are not sent in the clear"],
                [
                  "Fee",
                  coin.soloEnabled
                    ? `${coin.poolFeePct}% pooled / ${coin.soloFeePct}% solo`
                    : `${coin.poolFeePct}% (pooled only - no solo mode)`,
                ],
                ["Reward scheme", `${coin.payoutScheme}${p.schemeDetail ? ` ${p.schemeDetail}` : ""} - see below`],
                ["Minimum payout", coin.minPayout],
                ["Payout timing", payoutTiming(coin)],
                ...(p.extraFacts ?? []),
                ["Difficulty", coin.startDifficulty],
                ["Miner", `${coin.minerName} - ${coin.minerPlatforms}`],
              ]}
            />
          </Card>
        </section>

        {/* Quick start */}
        <section className="mb-10">
          <Label>Start mining {coin.symbol} in three steps</Label>
          <Card className="p-6">
            <Steps
              items={[
                coin.pwndaWallet ? (
                  <>
                    Get a {coin.name} address. The{" "}
                    <Link to="/wallet" className="text-[#e6e6e6] underline">
                      Pwnda Wallet
                    </Link>{" "}
                    creates one, or use the official{" "}
                    <a href={coin.walletUrl} className="text-[#e6e6e6] underline" rel="noopener">
                      {coin.walletName} wallet
                    </a>
                    .
                  </>
                ) : (
                  <>
                    Get a {coin.name} address from the official{" "}
                    <a href={coin.walletUrl} className="text-[#e6e6e6] underline" rel="noopener">
                      {coin.walletName} wallet
                    </a>
                    . The Pwnda Wallet does not handle {coin.symbol}, so this pool is bring-your-own-miner.
                  </>
                ),
                <>
                  Download{" "}
                  <a href={coin.minerUrl} className="text-[#e6e6e6] underline" rel="noopener">
                    {coin.minerName}
                  </a>{" "}
                  and unzip it.
                </>,
                <>Run it with your address as the username. {p.threadsTip}</>,
              ]}
            />
            <div className="mt-4">
              <div className="mb-1 text-[11px] uppercase tracking-[0.1em] text-[#808080]">Windows</div>
              <Cmd>{minerCommandFor(coin, "windows")}</Cmd>
              <div className="mb-1 mt-3 text-[11px] uppercase tracking-[0.1em] text-[#808080]">Linux</div>
              <Cmd>{minerCommandFor(coin, "linux")}</Cmd>
            </div>
            <p className="mt-4 text-[13px] leading-[1.7] text-[#808080]">
              {p.addressNote ?? (
                <>
                  Replace <code>{coin.addressPlaceholder}</code> with your address. The part after the dot is the
                  worker name - anything you like. Your address shows on the{" "}
                  <Link to="/pool" className="text-[#e6e6e6] underline">
                    pool lookup
                  </Link>{" "}
                  within a minute of the first accepted share.
                </>
              )}
            </p>
          </Card>
        </section>

        {/* What to expect */}
        <section className="mb-10 grid gap-5 md:grid-cols-2">
          <Card className="p-6">
            <Label>What a PC earns</Label>
            <p className="text-[13px] leading-[1.7] text-[#a0a0a0]">
              Hashrate: {p.hashrateLine}. {coin.minerName} prints yours in its first minute. Put it into the{" "}
              <Link to="/calculator" className="text-[#e6e6e6] underline">
                mining calculator
              </Link>{" "}
              for a daily estimate against the live network difficulty and price.
            </p>
            <p className="mt-3 text-[13px] leading-[1.7] text-[#a0a0a0]">
              <NextBlockLine coinId={coinId} />
            </p>
          </Card>
          {coin.pwndaWallet ? (
            <Card className="p-6">
              <Label>Get paid in a different coin</Label>
              <p className="text-[13px] leading-[1.7] text-[#a0a0a0]">
                Would rather hold TRX, SOL, ETH or a stablecoin? Mine {coin.symbol} here and let the wallet swap the
                payout automatically. That is how a PC earns{" "}
                <Link to="/unmineable" className="text-[#e6e6e6] underline">
                  coins that cannot be mined
                </Link>
                .
              </p>
            </Card>
          ) : (
            <Card className="p-6">
              <Label>Check your stats</Label>
              <p className="text-[13px] leading-[1.7] text-[#a0a0a0]">
                Paste your <code>{coin.addressHint}</code> address on{" "}
                <Link to="/pool" className="text-[#e6e6e6] underline">
                  My Stats
                </Link>{" "}
                for hashrate, pending balance and payouts. The {coin.symbol} pool reports totals per address,
                not per worker, and pays every {coin.payoutEvery} once your balance reaches {coin.minPayout}.
              </p>
            </Card>
          )}
        </section>

        {/* FAQ - collapsed for readers, full text for crawlers. */}
        <section className="mb-10">
          <Label>{coin.name} mining questions</Label>
          <Card className="px-6 py-3">
            <Faq q={`Is ${coin.name} ASIC-resistant?`}>{p.asicAnswer}</Faq>
            <Faq q={`Can I mine ${coin.name} on a laptop?`}>{p.laptopAnswer}</Faq>
            <Faq q="What does PPLNS mean for my payout?">
              Pay Per Last N Shares. When the pool finds a block, the reward is split by each miner's share of
              the work in the window leading up to it - not just the shares in that round. Steady miners get a
              steady payout, and joining or leaving mid-round does not cost you what you already contributed.
              {p.pplnsNote ? ` ${p.pplnsNote}` : null}
            </Faq>
            <Faq q={`Can I solo mine ${coin.name} here?`}>
              {coin.soloEnabled ? (
                <>
                  Yes, at {coin.soloFeePct}% fee. Prefix your address with <code>solo:</code> and you keep the whole
                  block reward - but only when your own hashrate finds a block, which at PC hashrates can take a
                  long time. Pooled {coin.payoutScheme} is the steady option; solo is the lottery ticket.
                </>
              ) : (
                <>
                  No. The {coin.symbol} pool is pooled {coin.payoutScheme} only - there is no solo mode, so every
                  miner shares each block by their work in the window.
                </>
              )}
            </Faq>
            <Faq q="Do I need an account or an email?">
              No. There is no signup. Your {coin.name} address is the account, and payouts go to it directly - the
              pool never holds a balance for you beyond the {coin.minPayout} threshold.
            </Faq>
            <Faq q={`Why not just mine Bitcoin with my ${hw}?`}>
              Because Bitcoin's SHA-256 is dominated by ASICs - a {hw} earns effectively nothing against them.
              {" "}{coin.name} uses an algorithm designed to make that hardware pointless, so your {hw} keeps a
              fair share.
              {coin.pwndaWallet ? ` If you want Bitcoin anyway, mine ${coin.symbol} and take the payout in BTC.` : null}
            </Faq>
            <Faq q={`How does ${coin.name} compare with ${other.name} mining?`}>
              {coin.name} is {hw} work ({coin.algoLabel.split(" - ")[0]}); {other.name} is {hardwarePhrase(other)} work (
              {other.algoLabel.split(" - ")[0]}). Same pool operator, same {other.poolFeePct}% fee, same {other.payoutScheme}.
              {sharing}
              <Link to={otherPath} className="text-[#e6e6e6] underline">
                mining {other.name}
              </Link>
              .
            </Faq>
          </Card>
        </section>

        <section className="pb-8 text-center text-[13px] text-[#808080]">
          <Link to="/start" className="text-[#e6e6e6] underline">
            Full setup guide
          </Link>
          {" | "}
          <Link to="/pool" className="text-[#e6e6e6] underline">
            Pool stats
          </Link>
          {others.map((o) => (
            <span key={o.id}>
              {" | "}
              <Link to={MINE_PATH[o.id]} className="text-[#e6e6e6] underline">
                Mine {o.name} on your {hardwarePhrase(o)}
              </Link>
            </span>
          ))}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
