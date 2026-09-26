import { usePoolOnline } from "@/hooks/usePoolStats";
import { cn } from "@/lib/utils";

// Site-wide banner shown when the ZEPH pool API (reached via /pool-api/) is
// unreachable. The website boots/serves before the pool - the pool is gated to
// start a few minutes after boot by a delayed-start timer - so during that
// window, and during any pool outage,
// this tells visitors/miners the pool is coming back rather than showing empty
// stats. Polls every 30 s (shared with usePoolSummary) and auto-hides as soon
// as the pool answers again. Not dismissible by design.
export default function PoolStatusBanner() {
  const { down } = usePoolOnline();
  if (!down) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "w-full border-b border-amber-500/40 bg-amber-500/10",
        "px-4 py-2 font-mono text-xs sm:text-sm text-amber-400",
        "flex items-center justify-center gap-2 text-center",
      )}
    >
      <span
        className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-400"
        aria-hidden="true"
      />
      <span>
        <span className="font-semibold">POOL OFFLINE</span>
        {" - the mining pool is starting up or temporarily down. Miners reconnect "}
        automatically; live pool stats may be unavailable.
      </span>
    </div>
  );
}
