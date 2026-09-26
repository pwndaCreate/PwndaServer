import { Link } from "react-router-dom";
import { COINS } from "@/lib/coins";

// Shared footer, on every page. The stratum endpoints are load-bearing
// content, not decoration: they are the only place on the site a miner can
// read every public endpoint at once, and the redesign brief requires them on
// every page. They come from lib/coins.ts so they cannot drift from what the
// setup guide tells people to type.
export function SiteFooter() {
  return (
    <footer className="border-t border-[#404040] px-4 py-8 text-[11px] text-[#666666] sm:px-6">
      <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-6">
        <div>
          <div className="mb-2 text-[#808080]">
            PWNDA - non-custodial mining wallet + Zephyr, Zano and Xelis mining pools
          </div>
          <div>
            ZEPH stratum: {COINS.zph.stratum} (TLS) | ZANO stratum: {COINS.zano.stratum} (TLS) | XEL
            stratum: {COINS.xel.stratum} (TLS)
          </div>
        </div>
        <div className="flex flex-wrap gap-5">
          <Link to="/wallet" className="text-[#808080] hover:text-[#f2f2f2]">
            Wallet
          </Link>
          <Link to="/start" className="text-[#808080] hover:text-[#f2f2f2]">
            Setup guide
          </Link>
          <Link to="/calculator" className="text-[#808080] hover:text-[#f2f2f2]">
            Calculator
          </Link>
          <Link to="/leaderboard" className="text-[#808080] hover:text-[#f2f2f2]">
            Leaderboard
          </Link>
          <Link to="/pool" className="text-[#808080] hover:text-[#f2f2f2]">
            My stats
          </Link>
          {/* Subject-matter pages (2026-09-10). Linked from every page so a
              crawler discovers them from the homepage, not only the sitemap. */}
          <Link to="/mine/zephyr" className="text-[#808080] hover:text-[#f2f2f2]">
            Mine ZEPH
          </Link>
          <Link to="/mine/zano" className="text-[#808080] hover:text-[#f2f2f2]">
            Mine ZANO
          </Link>
          <Link to="/mine/xelis" className="text-[#808080] hover:text-[#f2f2f2]">
            Mine XEL
          </Link>
          <Link to="/unmineable" className="text-[#808080] hover:text-[#f2f2f2]">
            Unmineable coins
          </Link>
        </div>
      </div>
    </footer>
  );
}
