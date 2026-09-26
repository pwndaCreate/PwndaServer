import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import PoolStatusBanner from "./components/PoolStatusBanner";
import AppRoutes from "./AppRoutes";

// Browser entry. The route table itself lives in AppRoutes.tsx so the
// prerender entry (entry-server.tsx) renders exactly the same set of pages -
// a route present in one but not the other would silently ship un-indexed.
//
// Archived pages, deliberately unrouted (files kept on disk):
//   pages/Dashboard.tsx    old worker dashboard      2026-06-28
//   pages/WalletLegacy.tsx multi-coin address lookup 2026-07-04
//   pages/Coins.tsx        legacy supported-coins    2026-07-09

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        {/* Site-wide notice when the ZEPH pool API is down (e.g. the ~5-min
            post-boot delayed-start window, or any pool outage). Auto-hides
            when the pool answers again. */}
        <PoolStatusBanner />
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
