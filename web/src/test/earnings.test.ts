import { describe, it, expect } from "vitest";
import {
  calcDefaultHs,
  dailyCoinEstimate,
  expectedSecondsToBlock,
  formatMonthlyUsd,
  humanDuration,
} from "@/lib/earnings";
import { COINS } from "@/lib/coins";

// Live ZEPH inputs from /pool-api/stats on 2026-09-24: difficulty 5,348,509,285,
// last block reward 3.9831 ZEPH, 120 s blocks, 0.5% fee. A 5 KH/s CPU's share
// of the 44.57 MH/s network is 1.1218e-4; x 720 blocks x 3.9831 x 0.995 = 0.3201.
const ZEPH = { difficulty: 5_348_509_285, blockTimeS: 120, blockRewardCoin: 3.9831059056, poolFeePct: 0.5 };

describe("dailyCoinEstimate", () => {
  it("matches the calculator's formula on live ZEPH numbers", () => {
    const v = dailyCoinEstimate({ minerHs: 5000, ...ZEPH });
    expect(v).not.toBeNull();
    expect(v as number).toBeCloseTo(0.3201, 3);
  });

  it("is null when the rig, the difficulty or the reward is missing", () => {
    expect(dailyCoinEstimate({ minerHs: 0, ...ZEPH })).toBeNull();
    expect(dailyCoinEstimate({ minerHs: 5000, ...ZEPH, difficulty: 0 })).toBeNull();
    expect(dailyCoinEstimate({ minerHs: 5000, ...ZEPH, blockRewardCoin: 0 })).toBeNull();
    expect(dailyCoinEstimate({ minerHs: 5000, ...ZEPH, blockTimeS: 0 })).toBeNull();
  });

  it("deducts the pool fee", () => {
    const gross = dailyCoinEstimate({ minerHs: 5000, ...ZEPH, poolFeePct: 0 }) as number;
    const half = dailyCoinEstimate({ minerHs: 5000, ...ZEPH, poolFeePct: 50 }) as number;
    expect(half).toBeCloseTo(gross / 2, 6);
  });
});

describe("calcDefaultHs", () => {
  it("reads the calculator's default rig per coin in H/s", () => {
    expect(calcDefaultHs(COINS.zph)).toBe(5000);
    expect(calcDefaultHs(COINS.zano)).toBe(26_000_000);
  });
});

describe("expectedSecondsToBlock", () => {
  it("is difficulty over hashrate", () => {
    // 100 kH/s against the live difficulty: 53,485 s, about 15 hours - the
    // pool's situation when the ad-driven miners were on it.
    expect(expectedSecondsToBlock(5_348_509_285, 100_000)).toBeCloseTo(53485.09, 1);
  });
  it("is null with no difficulty or no hashrate", () => {
    expect(expectedSecondsToBlock(0, 100)).toBeNull();
    expect(expectedSecondsToBlock(100, 0)).toBeNull();
  });
});

describe("humanDuration", () => {
  it("rounds to the unit a reader would use", () => {
    expect(humanDuration(60)).toBe("about 1 minute");
    expect(humanDuration(600)).toBe("about 10 minutes");
    expect(humanDuration(53485)).toBe("about 15 hours");
    expect(humanDuration(5_348_509_285 / 3856)).toBe("about 16 days");
    expect(humanDuration(86400 * 120)).toBe("about 4 months");
    expect(humanDuration(0)).toBe("-");
  });
});

describe("formatMonthlyUsd", () => {
  it("keeps cents under ten dollars and drops them above", () => {
    expect(formatMonthlyUsd(3.526)).toBe("$3.53");
    expect(formatMonthlyUsd(12.3)).toBe("$12");
  });
});
