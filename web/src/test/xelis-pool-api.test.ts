import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COINS } from "@/lib/coins";
import {
  AddressNotFoundError,
  atomicToCoin,
  atomicToZeph,
  coinToAtomic,
  fetchAddressStats,
  fetchPoolSummary,
} from "@/hooks/usePoolStats";

/*  The Xelis pool's API is xelis-pool's own, not cryptonote-nodejs-pool's, and
 *  it reports WHOLE XEL where the site's types carry ATOMIC units. These pin the
 *  mapping in usePoolStats.ts so the pages keep seeing one shape for all coins.
 *
 *  Fixtures are shaped like the live master API on 2026-09-16
 *  (curl -s https://pwnda.org/xelis-api/stats); the per-address numbers are made up.
 */

// Live /stats, 2026-09-16, plus two withdrawals so the payment totals are tested.
const XEL_STATS = {
  chart: { addresses: [], hashrate: [], workers: [] },
  connected_addresses: 3,
  connected_workers: 5,
  difficulty: 244861370.84028706,
  effort: 0,
  hashes: 0,
  height: 8922545,
  last_block: { height: 0, timestamp: 0, reward: 0, hash: "" },
  net_hr: 48972274.16805741,
  num_blocks_found: 2,
  payment_threshold: 0.05,
  pool_fee_percent: 0.5,
  pool_hr: 41000,
  pplns_window_seconds: 3600,
  recent_blocks_found: null,
  reward: 0.312,
  withdrawals: [
    { txid: "aa", time: 1789000000, amount: 0.4, destinations: 3 },
    { txid: "bb", time: 1789014400, amount: 0.2, destinations: 2 },
  ],
};

// Synthetic, not a real address - only its shape matters here.
const ADDR = `xel:${"q".repeat(59)}`;

const EMPTY_ADDRESS = {
  balance: 0,
  balance_pending: 0,
  est_pending: 0,
  hashrate: 0,
  hr_chart: null,
  paid: 0,
  withdrawals: [],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("atomic unit conversion", () => {
  it("divides by each coin's own atomicUnits", () => {
    expect(atomicToCoin(31_200_000, COINS.xel)).toBeCloseTo(0.312, 12);
    expect(atomicToCoin(4_110_000_000_000, COINS.zph)).toBeCloseTo(4.11, 12);
    expect(atomicToCoin(1e12, COINS.zano)).toBe(1);
    expect(atomicToCoin("100000000", COINS.xel)).toBe(1);
    expect(atomicToCoin(100_000_000, 1e8)).toBe(1);
  });

  it("returns 0 for missing or junk input", () => {
    expect(atomicToCoin(undefined, COINS.xel)).toBe(0);
    expect(atomicToCoin(null, COINS.xel)).toBe(0);
    expect(atomicToCoin("nope", COINS.xel)).toBe(0);
  });

  it("keeps atomicToZeph as the 1e12 conversion", () => {
    expect(atomicToZeph(4_086_000_000_000)).toBeCloseTo(4.086, 12);
    expect(atomicToZeph(null)).toBe(0);
  });

  it("converts whole XEL to integer atomic units", () => {
    expect(coinToAtomic(0.312, COINS.xel)).toBe(31_200_000);
    expect(coinToAtomic(0.1 + 0.2, COINS.xel)).toBe(30_000_000); // float noise rounded away
    expect(coinToAtomic(0.00000001, COINS.xel)).toBe(1);
    expect(coinToAtomic(undefined, COINS.xel)).toBe(0);
    expect(coinToAtomic(Number.NaN, COINS.xel)).toBe(0);
  });
});

describe("Xelis pool summary", () => {
  it("reads /xelis-api/stats and maps it onto PoolSummary", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(XEL_STATS));
    const s = await fetchPoolSummary("xel");

    expect(fetchMock).toHaveBeenCalledWith("/xelis-api/stats");
    expect(s.hashrate).toBe(41000);
    expect(s.miners).toBe(3);
    expect(s.workers).toBe(5);
    expect(s.totalBlocks).toBe(2);
    expect(s.totalPayments).toBe(2);
    expect(s.totalMinersPaid).toBe(5);
    expect(s.symbol).toBe("XEL");
    expect(s.network).toEqual({
      difficulty: 244861370.84028706,
      height: 8922545,
      reward: 31_200_000,
    });
  });

  it("uses the CURRENT network reward, never the pool's zeroed last_block", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(XEL_STATS));
    const s = await fetchPoolSummary("xel");
    // last_block is all zeros until the pool finds a block; the estimate reads
    // lastblock.reward, so a zero here would blank every XEL estimate.
    expect(s.lastblock.reward).toBe(31_200_000);
    expect(s.lastblock.height).toBe(8922545);
    expect(atomicToCoin(s.lastblock.reward, COINS.xel)).toBeCloseTo(0.312, 12);
  });

  it("matches the pool's own network hashrate through the 5 s block time", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(XEL_STATS));
    const s = await fetchPoolSummary("xel");
    // The pages derive network H/s as difficulty / blockTimeS; the pool
    // publishes net_hr == difficulty / 5. A wrong blockTimeS breaks this.
    expect(s.network.difficulty! / COINS.xel.blockTimeS).toBeCloseTo(XEL_STATS.net_hr, 3);
  });

  it("tolerates null withdrawals and missing fields", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ withdrawals: null, height: 5 }));
    const s = await fetchPoolSummary("xel");
    expect(s.totalPayments).toBe(0);
    expect(s.totalMinersPaid).toBe(0);
    expect(s.hashrate).toBe(0);
    expect(s.lastblock.reward).toBe(0);
    expect(s.network.height).toBe(5);
  });

  it("throws on a non-200 so the status banner can see the pool is down", async () => {
    fetchMock.mockResolvedValueOnce(new Response("bad gateway", { status: 502 }));
    await expect(fetchPoolSummary("xel")).rejects.toThrow("502");
  });

  it("leaves the cryptonote summary mapping alone", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        config: { symbol: "ZEPH" },
        pool: { hashrate: 9000, miners: 4, workers: 6, totalBlocks: 7, totalPayments: 8, totalMinersPaid: 9 },
        network: { difficulty: 100, height: 200 },
        lastblock: { height: 199, reward: 4_110_000_000_000 },
      }),
    );
    const s = await fetchPoolSummary("zph");
    expect(fetchMock).toHaveBeenCalledWith("/pool-api/stats");
    expect(s.hashrate).toBe(9000);
    expect(s.totalMinersPaid).toBe(9);
    expect(s.lastblock.reward).toBe(4_110_000_000_000);
  });
});

describe("Xelis per-address stats", () => {
  const FOUND = {
    hashrate: 12345,
    balance: 0.0123,
    balance_pending: 0.004,
    paid: 1.5,
    est_pending: 0.002,
    hr_chart: [
      { t: 1789001800, h: 11000 },
      { t: 1789000900, h: 10000 },
      { t: 0, h: 999 }, // malformed - dropped
    ],
    withdrawals: [{ amount: 0.25, txid: "deadbeef", time: 1789014400 }],
  };

  it("requests /xelis-api/stats/<address> with the xel: colon intact", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(FOUND));
    await fetchAddressStats(ADDR, "xel");
    // nginx's allow-list matches a literal "stats/xel:[a-z0-9]{20,120}".
    expect(fetchMock).toHaveBeenCalledWith(`/xelis-api/stats/${ADDR}`);
  });

  it("maps whole XEL to atomic and fills the fields the pool does not have", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(FOUND));
    const m = await fetchAddressStats(ADDR, "xel");

    expect(m.hashrate).toBe(12345);
    expect(m.balance).toBe(1_230_000);
    expect(m.balancePending).toBe(400_000);
    expect(m.paid).toBe(150_000_000);
    expect(m.hashes).toBe(0);
    expect(m.workers).toEqual([]);
    expect(m.lastShare).toBe(0);
    expect(m.hashrate_1h).toBe(0);
    expect(m.hashrate_6h).toBe(0);
    expect(m.hashrate_24h).toBe(0);
    expect(m.payments).toEqual([{ time: 1789014400, amount: 25_000_000, txHash: "deadbeef" }]);
  });

  it("sorts the chart by time and drops points with no timestamp", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(FOUND));
    const m = await fetchAddressStats(ADDR, "xel");
    expect(m.hashrateChart).toEqual([
      { ts: 1789000900, hashrate: 10000 },
      { ts: 1789001800, hashrate: 11000 },
    ]);
  });

  it("treats the all-zero answer for an unknown address as not found", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(EMPTY_ADDRESS));
    await expect(fetchAddressStats(ADDR, "xel")).rejects.toBeInstanceOf(AddressNotFoundError);
  });

  it("treats an all-zero answer with an empty chart array as not found too", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...EMPTY_ADDRESS, hr_chart: [], withdrawals: null }));
    await expect(fetchAddressStats(ADDR, "xel")).rejects.toBeInstanceOf(AddressNotFoundError);
  });

  it("treats HTTP 404 (the pool's own address) as not found", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { code: 1, message: "address not found" } }, 404),
    );
    await expect(fetchAddressStats(ADDR, "xel")).rejects.toBeInstanceOf(AddressNotFoundError);
  });

  it("reports other HTTP errors as errors, not as an unknown miner", async () => {
    fetchMock.mockResolvedValueOnce(new Response("oops", { status: 500 }));
    const err = await fetchAddressStats(ADDR, "xel").catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(AddressNotFoundError);
  });

  it("counts a miner with any history as found", async () => {
    // Only a paid total - a miner who stopped and was paid out.
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...EMPTY_ADDRESS, paid: 0.3 }));
    expect((await fetchAddressStats(ADDR, "xel")).paid).toBe(30_000_000);

    // Only chart points - a miner whose hashrate has just dropped to zero.
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...EMPTY_ADDRESS, hr_chart: [{ t: 1789000900, h: 0 }] }),
    );
    expect((await fetchAddressStats(ADDR, "xel")).hashrateChart).toHaveLength(1);

    // Only a withdrawal still in the pool's recent list.
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...EMPTY_ADDRESS, withdrawals: [{ amount: 0.05, txid: "t", time: 1 }] }),
    );
    expect((await fetchAddressStats(ADDR, "xel")).payments).toHaveLength(1);

    // Only an immature balance - a brand-new miner before 200 confirmations.
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...EMPTY_ADDRESS, balance_pending: 0.001 }));
    expect((await fetchAddressStats(ADDR, "xel")).balancePending).toBe(100_000);
  });

  it("leaves the cryptonote address lookup alone", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Not found" }));
    await expect(fetchAddressStats("ZEPHYRabc", "zph")).rejects.toBeInstanceOf(AddressNotFoundError);
    expect(fetchMock).toHaveBeenCalledWith("/pool-api/stats_address?address=ZEPHYRabc");
  });
});
