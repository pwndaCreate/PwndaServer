import { useEffect, useState } from "react";

/**
 * Wall-clock elapsed time since mount, in ms, resampled every `intervalMs`.
 *
 * Every animation on this site derives its frame from THIS value rather than
 * counting ticks. That matters: a backgrounded tab throttles timers to ~1 Hz,
 * and a tick-counting animation then stretches out and can freeze mid-frame
 * (the scramble headline would sit on garbage characters). Deriving from
 * Date.now() means a throttled tab simply resumes on the correct frame.
 *
 * Returns 0 and stops ticking when the user prefers reduced motion, so callers
 * can render their finished/static state without a second code path.
 */
export function useElapsed(intervalMs: number): {
  elapsed: number;
  reduced: boolean;
  /**
   * False during the server render AND the first client render, true once the
   * timer has ticked. Callers use it to render their COMPLETE state initially:
   * a typed line that starts empty would otherwise prerender as an empty
   * element, so crawlers and no-JS visitors would never see the text at all.
   * Rendering the same complete state on both sides also keeps hydration from
   * mismatching.
   */
  animating: boolean;
} {
  // Read the preference once at mount rather than at module scope - this file
  // is imported during the prerender build, where matchMedia does not exist.
  const [reduced, setReduced] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const start = Date.now();
    const id = setInterval(() => {
      setElapsed(Date.now() - start);
      setAnimating(true);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, reduced]);

  return { elapsed, reduced, animating };
}
