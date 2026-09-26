import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

// Site nav, rebuilt 2026-09 for the redesign. Identical on every page:
// wordmark, six links, and a white DOWNLOAD button pointing at the wallet.
//
// The nav is deliberately shared rather than per-page - the redesign brief
// specifies one nav everywhere, and having two coexisting during a staged
// rollout is how they drift.
const navItems = [
  { path: "/", label: "HOME" },
  { path: "/wallet", label: "WALLET" },
  { path: "/start", label: "START MINING" },
  { path: "/calculator", label: "CALC" },
  { path: "/leaderboard", label: "LEADERBOARD" },
  { path: "/pool", label: "MY STATS" },
  // Archived and intentionally not linked:
  //   /dashboard (2026-06-28 old worker dashboard)
  //   /coins     (2026-07-09 legacy multi-coin list)
];

export function TerminalNav() {
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 border-b border-[#404040] bg-[#121212]/60 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
        {/* Wordmark */}
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="text-base font-bold text-[#f2f2f2]">&gt;_</span>
          <span className="font-display text-[11px] text-white">PWNDA</span>
        </Link>

        {/* Links - horizontally scrollable rather than wrapping on narrow screens,
            so the bar keeps its 56px height at every width. */}
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-[12px] uppercase [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap border px-3 py-2 transition-colors",
                  isActive
                    ? "pw-nav-active pw-glow-text text-[#f2f2f2]"
                    : "border-transparent text-[#808080] hover:border-[#f2f2f2]/50 hover:text-[#e6e6e6]"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Primary CTA */}
        <Link
          to="/wallet"
          className="pw-btn shrink-0 px-4 py-2 text-[12px] font-bold uppercase"
        >
          Download
        </Link>
      </div>
    </nav>
  );
}
