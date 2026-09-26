import type { ComponentType } from "react";
import { renderToString } from "react-dom/server";
import { Routes, Route } from "react-router-dom";
import { StaticRouter } from "react-router-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ROUTES, type PageKey } from "./routes";

// Pages are imported EAGERLY here, unlike the browser entry. renderToString
// does not resolve Suspense boundaries, so a React.lazy page would prerender
// as the "Loading..." fallback - shipping crawlers an empty page, which is
// exactly the failure prerendering exists to prevent.
import Index from "./pages/Index";
import GetStarted from "./pages/GetStarted";
import Wallet from "./pages/Wallet";
import Calculator from "./pages/Calculator";
import Leaderboard from "./pages/Leaderboard";
import Pool from "./pages/Pool";
import MineZephyr from "./pages/MineZephyr";
import MineZano from "./pages/MineZano";
import MineXelis from "./pages/MineXelis";
import Unmineable from "./pages/Unmineable";
import NotFound from "./pages/NotFound";

const PAGES: Record<PageKey, ComponentType> = {
  Index,
  GetStarted,
  Wallet,
  Calculator,
  Leaderboard,
  Pool,
  MineZephyr,
  MineZano,
  MineXelis,
  Unmineable,
  NotFound,
};

// Server entry for build-time prerendering.
//
// Deliberately does NOT reuse App.tsx: App owns BrowserRouter, the toasters
// and the live pool-status banner, none of which can run in a static render.
//
// Data is intentionally not fetched. Each page renders its empty state and
// fills in live pool numbers after hydration - the marketing copy is what
// crawlers need, and a hashrate frozen at build time would be worse than none.
// StrictMode is omitted: it double-renders, which doubles prerender cost for
// no benefit when there is no client to catch side effects in.
export function render(url: string): string {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnMount: false } },
  });

  return renderToString(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <StaticRouter location={url}>
          <Routes>
            {ROUTES.map(({ path, page }) => {
              const Page = PAGES[page];
              return <Route key={path} path={path} element={<Page />} />;
            })}
          </Routes>
        </StaticRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
