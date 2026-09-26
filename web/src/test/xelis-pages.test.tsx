import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import MineXelis from "@/pages/MineXelis";
import MineZephyr from "@/pages/MineZephyr";
import GetStarted from "@/pages/GetStarted";
import Pool from "@/pages/Pool";
import Index from "@/pages/Index";
import { COINS } from "@/lib/coins";
import { render as renderRoute } from "@/entry-server";

/*  Render-level checks for the XEL pages: the mapping tests prove the numbers,
 *  these prove the pages print them through the right units and never make a
 *  claim the XEL pool or the wallet cannot back (solo, per-worker stats, a
 *  wallet swap).
 */

beforeEach(() => {
  // recharts' ResponsiveContainer needs this and jsdom does not ship it.
  // Stubbed per test because afterEach unstubs every global.
  if (!("ResizeObserver" in globalThis)) {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

function wrap(ui: ReactNode, url = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const text = () => document.body.textContent ?? "";

describe("/mine/xelis", () => {
  it("states the Xelis pool facts", () => {
    wrap(<MineXelis />, "/mine/xelis");
    const t = text();
    expect(t).toContain("Mine Xelis on your GPU or CPU");
    expect(t).toContain("xel.pwnda.org:17706");
    expect(t).toContain("0.5% (pooled only - no solo mode)");
    expect(t).toContain("PPLNS over a 1 h window");
    expect(t).toContain("every 4 hours once a block has 200 confirmations (~17 min)");
    expect(t).toContain("0.05 XEL");
    expect(t).toContain("a flat network fee is deducted from each payout");
    expect(t).toContain(
      "SRBMiner-MULTI.exe --algorithm xelishashv3 --pool xel.pwnda.org:17706 --tls true --wallet YOUR_XELIS_ADDRESS.worker1 --password x",
    );
    expect(t).toContain("--disable-gpu");
    expect(t).toContain("xel: prefix");
    expect(screen.getByRole("link", { name: "Genesix wallet" })).toHaveAttribute(
      "href",
      COINS.xel.walletUrl,
    );
  });

  it("makes no claim the XEL pool or the wallet cannot back", () => {
    wrap(<MineXelis />, "/mine/xelis");
    const t = text();
    expect(t).not.toContain("solo:");
    expect(t).not.toContain("creates one");
    expect(t).not.toContain("let the wallet swap");
    expect(t).not.toContain("take the payout in BTC");
    expect(t).toContain("The Pwnda Wallet does not handle XEL");
  });

  it("compares with Zephyr: both use the CPU, XEL can also take the GPU", () => {
    wrap(<MineXelis />, "/mine/xelis");
    const t = text();
    expect(t).toContain("Xelis is GPU or CPU work (XelisHashV3)");
    expect(t).toContain(
      "Both can use the CPU; a machine with a GPU as well can mine Xelis on the GPU and Zephyr on the CPU at the same time",
    );
    expect(t).not.toContain("Both want the CPU");
    expect(screen.getByRole("link", { name: "Mine Zano on your GPU" })).toHaveAttribute("href", "/mine/zano");
  });
});

describe("prerender entry", () => {
  // scripts/prerender.mjs calls this exact function per route; a page missing
  // from entry-server's map would render the 404 body here instead.
  // React marks text boundaries with <!-- --> in server output; drop them so
  // the assertions read like the page.
  const ssr = (url: string) => renderRoute(url).replace(/<!-- -->/g, "");

  it("server-renders /mine/xelis as the Xelis guide", () => {
    const html = ssr("/mine/xelis");
    expect(html).toContain("Mine Xelis on your GPU or CPU");
    expect(html).toContain("xel.pwnda.org:17706");
    expect(html).not.toMatch(/page not found/i);
  });

  it("server-renders /start with the XEL walkthrough in the HTML", () => {
    const html = ssr("/start");
    expect(html).toContain('id="setup-xel"');
    expect(html).toContain("--algorithm xelishashv3");
    // The default XEL command mines on CPU AND GPU; --disable-gpu is only offered as an option.
    const xelBlock = html.slice(html.indexOf('id="setup-xel"'));
    expect(xelBlock).toContain("add --disable-gpu for CPU only");
    expect(xelBlock).not.toMatch(/--password x \^\s+--disable-gpu/);
  });
});

describe("/mine/zephyr is unchanged by the XEL work", () => {
  it("keeps its own facts and wallet copy", () => {
    wrap(<MineZephyr />, "/mine/zephyr");
    const t = text();
    expect(t).toContain("0.5% pooled / 0% solo");
    expect(t).toContain("every 30 min once a block has 60 confirmations (~2h)");
    expect(t).toContain("creates one");
    expect(t).toContain("take the payout in BTC");
    expect(t).toContain("A machine with both a good CPU and a good GPU can mine both at once");
    expect(screen.getByRole("link", { name: "Mine Xelis on your GPU or CPU" })).toHaveAttribute("href", "/mine/xelis");
  });
});

describe("/start", () => {
  it("offers all three pools and renders every walkthrough for crawlers", () => {
    wrap(<GetStarted />, "/start");
    for (const label of ["ZEPH / CPU", "ZANO / GPU", "XEL / GPU+CPU"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    const xel = document.getElementById("setup-xel");
    expect(xel).not.toBeNull();
    expect(xel!.textContent).toContain("./SRBMiner-MULTI --algorithm xelishashv3");
    expect(xel!.textContent).toContain("Manual mode only");
    expect(xel!.textContent).toContain("0.05 XEL - every ~4 hours");
    expect(xel!.textContent).toContain("Starting difficulty");
    expect(xel!.textContent).not.toContain("x@worker1");
    expect(text()).toContain("except Xelis, which is manual mode only");
  });
});

describe("/ live pools", () => {
  it("lists the XEL pool as bring-your-own-miner, apart from the wallet's pools", () => {
    // Pools unreachable: the cards must show "-", never a fake zero.
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 502 })));
    wrap(<Index />, "/");
    const t = text();
    expect(t).toContain(
      "The pools behind the wallet are public: Zephyr (RandomX, CPU) and Zano (ProgPowZ, GPU) - payouts about every 30 min.",
    );
    expect(t).toContain("Xelis (XelisHashV3, GPU+CPU) is a bring-your-own-miner pool, paid every 4 hours.");
    expect(t).toContain("All 3: 0.5% fee, TLS-only.");
    expect(t).toContain("XEL / GPU+CPU");
    expect(t).toContain("xel.pwnda.org:17706");
    // The hero and route selector describe what the WALLET mines - no XEL there.
    expect(screen.queryByRole("button", { name: /XEL$/ })).toBeNull();
  });
});

describe("/pool with a Xelis address", () => {
  const ADDR = `xel:${"q".repeat(59)}`;
  const DIFFICULTY = 244861370.84028706;
  const now = Math.floor(Date.now() / 1000);

  function routeFetch(url: string): Response {
    const json = (b: unknown, status = 200) =>
      new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
    if (url.startsWith("/api/v1/pool/miner")) {
      return json({
        found: true,
        coin: "xel",
        symbol: "XEL",
        tier: "cpu",
        hashrate_live: 10000,
        hashrate_1h: 9000,
        hashrate_6h: 8500,
        hashrate_24h: 8000,
        last_seen: now - 30,
      });
    }
    if (url === "/xelis-api/stats") {
      return json({
        pool_hr: 10000,
        connected_addresses: 1,
        connected_workers: 1,
        num_blocks_found: 0,
        height: 8922545,
        reward: 0.312,
        difficulty: DIFFICULTY,
        withdrawals: [],
        last_block: { height: 0, timestamp: 0, reward: 0, hash: "" },
      });
    }
    if (url === `/xelis-api/stats/${ADDR}`) {
      return json({
        hashrate: 10000,
        balance: 0.0123,
        balance_pending: 0.004,
        paid: 1.5,
        est_pending: 0.002,
        hr_chart: [
          { t: now - 1800, h: 9000 },
          { t: now - 900, h: 10000 },
        ],
        withdrawals: [{ amount: 0.25, txid: "deadbeefcafe0123", time: now - 3600 }],
      });
    }
    // The page queries the default (Zephyr) pool until detection lands.
    if (url === "/pool-api/stats") return json({ pool: {}, network: {}, lastblock: {} });
    if (url.startsWith("/pool-api/stats_address")) return json({ error: "Not found" });
    return json({}, 404);
  }

  it("prints XEL amounts through 1e8, not 1e12, and explains the missing worker list", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => routeFetch(String(u))));
    wrap(<Pool />, `/pool?address=${ADDR}`);

    await waitFor(() => expect(text()).toContain("0.0123 XEL"));
    const t = text();
    expect(t).toContain("1.5000 XEL"); // total paid
    expect(t).toContain("0.2500 XEL"); // the payment row
    expect(t).toContain("+ 0.0040 XEL awaiting 200 block");
    expect(t).toContain("the XEL pool reports per-address totals only - no per-worker breakdown");
    expect(t).not.toContain("no workers reported");
    // lastShare is 0 from xelis-pool; the canonical last_seen fills it in.
    expect(t).toMatch(/last share \d+s ago/);
    expect(t).not.toContain("last share never");
    // Estimate: 24h canonical rate vs difficulty / 5 s, x 17280 blocks x 0.312, net of 0.5%.
    const daily = (8000 / (DIFFICULTY / 5)) * (86400 / 5) * 0.312 * 0.995;
    expect(t).toContain(`${daily.toFixed(4)} XEL`);
  });
});
