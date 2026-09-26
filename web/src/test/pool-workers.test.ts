import { describe, it, expect } from "vitest";
import { isStale, STALE_AFTER_S } from "@/pages/Pool";

// The user-facing worker table hides rigs with no share in 24h. The operator
// reported a worker with a 10-day-old last share listed beside the active ones,
// which read as a broken page rather than a retired rig. These pin the cutoff
// so it cannot drift to "hide anything that missed the 10-minute window",
// which would make a rig that is merely restarting disappear.
describe("stale worker cutoff", () => {
  const now = 1_800_000_000; // any fixed instant; the helper takes `now`

  it("is 24 hours, not the 10-minute online window", () => {
    expect(STALE_AFTER_S).toBe(86_400);
  });

  it("keeps a worker that shared within the last 24h, even if offline right now", () => {
    expect(isStale(now - 600, now)).toBe(false);        // 10 min - online
    expect(isStale(now - 3 * 3600, now)).toBe(false);   // 3h - offline but recent
    expect(isStale(now - 86_399, now)).toBe(false);     // one second inside the window
  });

  it("hides a worker whose last share is older than 24h", () => {
    expect(isStale(now - 86_401, now)).toBe(true);           // one second past
    expect(isStale(now - 10 * 86_400, now)).toBe(true);      // the reported 10-day case
  });

  it("treats a missing or zero last-share timestamp as stale", () => {
    expect(isStale(0, now)).toBe(true);
    expect(isStale(-1, now)).toBe(true);
    expect(isStale(NaN, now)).toBe(true);
  });
});
