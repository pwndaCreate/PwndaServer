import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TerminalNav, SiteFooter, CoinIcon } from "@/components/terminal";
import { Card, Faq, Label, Steps } from "@/components/terminal/Guide";
import { HeroSlot, PERIOD, SCRAMBLE_MS, scrambleFrame } from "@/components/terminal/HeroSlot";
import { useElapsed } from "@/hooks/useElapsed";
import { useCoinPrice } from "@/hooks/useCoinGecko";
import { atomicToCoin, usePoolSummary, type PoolSummary } from "@/hooks/usePoolStats";
import { COINS, type CoinSpec } from "@/lib/coins";
import { calcDefaultHs, dailyCoinEstimate, formatMonthlyUsd } from "@/lib/earnings";
import { GLYPH8, coinColor } from "@/lib/coin-art";
import { DESTINATIONS, WHY_LABEL, type WhyNot } from "@/lib/destinations";

// THE ROTATION, AND WHY IT STARTS WHERE THE URL SAYS.
//
// The line under the H1 cycles "MINE ZEPH . RECEIVE <coin> ." through every
// payout coin, with the same scramble the homepage uses. The order is hand-set
// so a cold visitor sees the coins people actually ask about first; 19 is
// prime, so a step of 1 visits all of them before any repeats.
//
// An ad reading "Want SOL? Mine it." links to /unmineable/#sol. If the first
// thing that visitor sees is TRX resolving in the headline, the page has
// contradicted the ad in its first second. So on the client a hash that names
// a coin PINS the receive slot to it: it scrambles in on the first tick and
// then holds, while the mined coin keeps rotating. Until 2026-09-24 the hash
// only chose where the rotation STARTED, so the coin from the ad was on screen
// for one 2.6 s period before the line moved on - roughly how long most ad
// visitors stayed (wiki: analyses/marketing-4chan-campaigns-sep-2026). No hash,
// or one naming nothing the wallet pays out in, rotates from the top as before.
// The server cannot know the hash, so the prerender and the first client render
// show the settled default pair - same on both sides, no hydration mismatch -
// and the first tick scrambles into the hashed coin exactly the way every later
// transition scrambles into the next.
// The H1 itself stays static text: that is the element crawlers weight, and it
// was the lesson of the homepage's "MINE MP& . RECEIVE T#L ." incident.
// The first three are the operator's choice (2026-09-10): TRX, SOL, ETH, matching
// the homepage's opening sequence. Unlike the homepage this list steps by 1, so
// the first three SHOWN are simply the first three entries - but the test pins
// them anyway, because "tidy the list" is how the homepage's order once broke.
export const RECV_ROTATION = [
  "TRX", "SOL", "ETH", "USDT", "XRP", "ADA", "BTC", "DOGE", "AVAX", "POL",
  "SUI", "BNB", "USDC", "XLM", "LTC", "MON", "DAI", "BCH", "DASH",
];
const MINE_ROTATION = ["ZEPH", "ZANO"];

/** Index into RECV_ROTATION named by a URL hash like "#sol", or 0. */
export function startIndexForHash(hash: string): number {
  const sym = (hash || "").replace(/^#/, "").toUpperCase();
  const i = RECV_ROTATION.indexOf(sym);
  return i < 0 ? 0 : i;
}

/** The coin a URL hash names, when it is one the page rotates; null otherwise. */
export function pinnedCoinForHash(hash: string): string | null {
  const sym = (hash || "").replace(/^#/, "").toUpperCase();
  return RECV_ROTATION.includes(sym) ? sym : null;
}

/**
 * What the calculator's default rig for `coin` earns per month in USD, from
 * the same live inputs and formula as /calculator (src/lib/earnings.ts).
 * Null until the pool summary and the price have both arrived.
 */
function monthlyUsd(coin: CoinSpec, summary: PoolSummary | undefined, usd: number | null): number | null {
  if (usd == null) return null;
  const daily = dailyCoinEstimate({
    minerHs: calcDefaultHs(coin),
    difficulty: summary?.network?.difficulty ?? 0,
    blockTimeS: coin.blockTimeS,
    blockRewardCoin: atomicToCoin(summary?.lastblock?.reward ?? 0, coin),
    poolFeePct: coin.poolFeePct,
  });
  return daily == null ? null : daily * 30 * usd;
}

// Six destinations (DAI, MON, XLM, DASH, LTC, BCH) have no pixel glyph yet, and
// CoinIcon falls back to the "+7" mark for an unknown symbol - which on a page
// that lists coins would read as a bug. Draw a ticker badge in the coin's colour
// for those, and the real icon where one exists. Adding the six glyphs is
// coin-art work tracked with the wallet repo, not something to improvise here.
function CoinMark({ sym }: { sym: string }) {
  if (sym in GLYPH8) return <CoinIcon symbol={sym} cell={2} />;
  return (
    <span
      className="inline-flex h-6 min-w-6 items-center justify-center border px-1 font-mono text-[10px] font-bold"
      style={{ color: coinColor(sym), borderColor: coinColor(sym) }}
      aria-hidden="true"
    >
      {sym}
    </span>
  );
}

// /unmineable - mine coins that cannot be mined.
//
// The search intent this targets is "how to mine tron / xrp / solana / cardano"
// and "mine unmineable coins on pc". Those are real queries with an honest
// answer nobody gives: you cannot, but a PC can EARN them by mining an
// ASIC-resistant coin and taking the payout in the one you want. The site
// already does exactly this - the page just says so where a search engine can
// read it.
//
// The page draws a distinction the market usually blurs, because it is true
// and it is what the reader actually needs to know:
//   - no proof-of-work at all (ETH, SOL, XRP, TRX...) - there is nothing to mine
//   - proof-of-work but ASIC-only (BTC, LTC, DOGE...) - a PC cannot compete
// Every coin below carries which one it is, from src/lib/destinations.ts.
//
// Each coin has an anchor (#trx, #sol...) so it can be linked directly, and so
// this hub can be split into per-coin pages later if the impressions justify
// it - without changing any URL that already exists.

// The two headings carry the whole distinction; they used to have a lead
// paragraph each, cut 2026-09-10 at the operator's request as unneeded.
const GROUPS: { why: WhyNot; title: string }[] = [
  { why: "pos", title: "No proof-of-work: nothing to mine" },
  { why: "asic", title: "Proof-of-work, but ASIC-only" },
];

export default function Unmineable() {
  const zph = COINS.zph;
  const zano = COINS.zano;

  const { elapsed, reduced, animating } = useElapsed(70);
  // Read once on mount. Before that (server, first client render) it is 0, and
  // `animating` is false on exactly those renders, so the two agree.
  const [start, setStart] = useState(0);
  const [pin, setPin] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setStart(startIndexForHash(window.location.hash));
    setPin(pinnedCoinForHash(window.location.hash));
  }, []);

  // The proof line: what the calculator's default CPU and GPU rigs earn today.
  // A visitor from an ad was promised an outcome; this is its size, before
  // either button asks for anything. Absent until the numbers exist, so the
  // server render and the first client render agree.
  const zphSummary = usePoolSummary("zph").summary;
  const zanoSummary = usePoolSummary("zano").summary;
  const zphUsd = useCoinPrice(zph.coinGeckoId).price?.current_price ?? null;
  const zanoUsd = useCoinPrice(zano.coinGeckoId).price?.current_price ?? null;
  const cpuMonthly = monthlyUsd(zph, zphSummary, zphUsd);
  const gpuMonthly = monthlyUsd(zano, zanoSummary, zanoUsd);

  const hero = useMemo(() => {
    if (reduced || !animating) {
      const recv = pin ?? RECV_ROTATION[0];
      return { mine: MINE_ROTATION[0], recv, mineTxt: MINE_ROTATION[0], recvTxt: recv };
    }
    const pair = Math.floor(elapsed / PERIOD);
    const phase = elapsed % PERIOD;
    const mine = MINE_ROTATION[pair % MINE_ROTATION.length];
    const recv = pin ?? RECV_ROTATION[(start + pair) % RECV_ROTATION.length];
    const done = phase >= SCRAMBLE_MS;
    // A pinned coin scrambles in on the first tick like any other transition,
    // then holds through every later period while the mined coin keeps moving.
    const recvDone = pin ? pair > 0 || done : done;
    return {
      mine, recv,
      mineTxt: done ? mine : scrambleFrame(mine, phase / SCRAMBLE_MS),
      recvTxt: recvDone ? recv : scrambleFrame(recv, phase / SCRAMBLE_MS),
    };
  }, [elapsed, reduced, animating, start, pin]);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <TerminalNav />

      <main className="mx-auto max-w-[900px] px-4 pb-6 sm:px-6">
        <section className="py-10 text-center sm:py-14">
          <h1 className="pw-rise pw-rise-1 mb-4 text-[24px] font-bold text-white sm:text-[28px]">
            Mine coins that cannot be mined
          </h1>

          {/* The animated line. Deliberately NOT the h1 - see the note at the top. */}
          <div
            className="pw-rise pw-rise-2 mx-auto mb-4 font-display text-[18px] leading-[1.6] text-white sm:text-[26px]"
            style={{ textShadow: "0 0 6px rgba(255,255,255,0.25)" }}
            aria-live="off"
          >
            MINE <HeroSlot shown={hero.mineTxt} sym={hero.mine} />
            <span className="mx-2 text-[#808080]">-&gt;</span>
            RECEIVE <HeroSlot shown={hero.recvTxt} sym={hero.recv} />
          </div>

          <p className="pw-rise pw-rise-3 mx-auto max-w-[64ch] text-[13px] leading-[1.7] text-[#808080]">
            Some coins have no mining at all; others are ASIC-only. A PC earns both the same way: mine an
            ASIC-resistant coin, get paid in the one you want.
          </p>

          {/* One line of proof before the ask: the size of the outcome the ad
              sold, from the live inputs the calculator uses, for the rigs the
              calculator defaults to. Rendered only once the numbers exist. */}
          {cpuMonthly != null || gpuMonthly != null ? (
            <p className="pw-rise pw-rise-4 mx-auto mt-4 max-w-[64ch] text-[13px] leading-[1.7] text-[#a0a0a0]">
              {cpuMonthly != null ? (
                <>
                  A desktop CPU earns about{" "}
                  <span className="text-[#e6e6e6]">{formatMonthlyUsd(cpuMonthly)}</span> a month
                </>
              ) : null}
              {cpuMonthly != null && gpuMonthly != null ? ", " : null}
              {gpuMonthly != null ? (
                <>
                  a gaming GPU about <span className="text-[#e6e6e6]">{formatMonthlyUsd(gpuMonthly)}</span>
                </>
              ) : null}{" "}
              at today's difficulty and price, delivered as {pin ?? "the coin you choose"}.
            </p>
          ) : null}
          <p className="pw-rise pw-rise-4 mx-auto mt-2 text-[12px] text-[#808080]">
            Open source. No account, no email, no KYC.
          </p>

          {/* The next action. An ad landing that explains and then stops is a
              bounce; 34 of 35 real visitors from the first campaign left the
              homepage with no second click. Two buttons, nothing else - and
              when a hash names the coin, the first one answers the ad in its
              own words: "Want TRX? Mine it." -> "Want TRX? Get the wallet". */}
          <div className="pw-rise pw-rise-5 mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/wallet" className="pw-btn px-7 py-3 text-[13px] font-bold">
              {pin ? `Want ${pin}? Get the wallet` : "Get the wallet"}
            </Link>
            <Link to="/start" className="pw-btn-ghost px-7 py-3 text-[13px] font-bold">
              Start mining
            </Link>
          </div>
        </section>

        {/* How it works */}
        <section className="pw-rise pw-rise-6 mb-10">
          <Card strong className="p-6">
            <Label>How a PC earns an unmineable coin</Label>
            <Steps
              items={[
                <>
                  Mine{" "}
                  <Link to="/mine/zephyr" className="text-[#e6e6e6] underline">
                    Zephyr on your CPU
                  </Link>{" "}
                  or{" "}
                  <Link to="/mine/zano" className="text-[#e6e6e6] underline">
                    Zano on your GPU
                  </Link>
                  . {zph.poolFeePct}% fee, {zph.payoutScheme}.
                </>,
                <>
                  Get paid to your own address every 30 minutes.
                </>,
                <>
                  The{" "}
                  <Link to="/wallet" className="text-[#e6e6e6] underline">
                    Pwnda Wallet
                  </Link>{" "}
                  swaps it into the coin you chose. Rate quoted first, held only by you.
                </>,
              ]}
            />
            <p className="mt-4 text-[13px] leading-[1.7] text-[#808080]">
              No account, no email, no exchange. Nothing is ever deposited, so there is nothing to withdraw.
            </p>
          </Card>
        </section>

        {/* The coins, grouped by WHY a PC cannot mine them. */}
        {GROUPS.map((g) => {
          const coins = DESTINATIONS.filter((d) => d.why === g.why);
          return (
            <section key={g.why} className="mb-10">
              <Label>{g.title}</Label>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {coins.map((d) => (
                  <Card key={d.sym} className="p-4">
                    <div id={d.sym.toLowerCase()} className="flex items-center gap-3">
                      <CoinMark sym={d.sym} />
                      <div>
                        <div className="text-[13px] font-bold text-[#e6e6e6]">
                          Earn {d.sym} by mining
                        </div>
                        <div className="text-[11px] text-[#808080]">{d.name}</div>
                      </div>
                    </div>
                    {/* One short line, not the whole formula. The group lead above
                        already says how the payout works once; repeating it on
                        nineteen cards is the wall of text this page must not be. */}
                    <p className="mt-2 text-[12px] leading-[1.6] text-[#a0a0a0]">{WHY_LABEL[d.why]}.</p>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}

        {/* FAQ */}
        <section className="mb-10">
          <Label>Unmineable coin questions</Label>
          <Card className="px-6 py-3">
            <Faq q={'What does "unmineable" actually mean?'}>
              Two different things, and the page above keeps them apart. Most coins people ask about - Tron,
              XRP, Solana, Cardano, Ethereum since 2022 - have no proof-of-work, so nothing mines them. Others -
              Bitcoin, Litecoin, Dogecoin - are mineable, but only by ASICs; a PC's share of those networks is
              close to zero. In both cases a PC earns them by mining something else and converting.
            </Faq>
            <Faq q="Can I mine Tron, XRP or Solana on my PC?">
              No - none of them use proof-of-work, so there is no such thing as mining them on any hardware.
              What you can do is mine {zph.name} or {zano.name}, which your PC IS good at, and have the payout
              delivered as TRX, XRP or SOL.
            </Faq>
            <Faq q="Can I mine Dogecoin or Bitcoin on a PC?">
              Technically yes; practically no. Dogecoin's Scrypt and Bitcoin's SHA-256 are ASIC networks, and a
              desktop earns fractions of a cent against them. Mine {zph.symbol} on the CPU or {zano.symbol} on the
              GPU instead and take the payout in DOGE or BTC - you end up with more of the coin you wanted.
            </Faq>
            <Faq q="Which coin should my PC mine?">
              CPU only: {zph.name} (RandomX). Gaming GPU: {zano.name} (ProgPowZ). A machine with both can run
              both miners at once. Both pools charge {zph.poolFeePct}% and pay {zph.payoutScheme}.
            </Faq>
            <Faq q="Does someone hold my coins during the swap?">
              No. The pool pays {zph.symbol} or {zano.symbol} straight to an address in your wallet, and the
              wallet performs the swap from there. There is no platform balance, no deposit, and no withdrawal
              step - which is also why there is no account to create.
            </Faq>
            <Faq q="What does it cost?">
              The pool fee is {zph.poolFeePct}% of mined rewards ({zph.soloFeePct}% for solo). The swap has its
              own network cost, which the wallet quotes before you confirm - so the number you see is the number
              you get.
            </Faq>
          </Card>
        </section>

        <section className="pb-8 text-center text-[13px] text-[#808080]">
          <Link to="/mine/zephyr" className="text-[#e6e6e6] underline">
            Mine Zephyr (CPU)
          </Link>
          {" | "}
          <Link to="/mine/zano" className="text-[#e6e6e6] underline">
            Mine Zano (GPU)
          </Link>
          {" | "}
          <Link to="/calculator" className="text-[#e6e6e6] underline">
            Calculator
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
