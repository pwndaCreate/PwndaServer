import { Component, Suspense, lazy, type ComponentType, type ReactNode } from "react";
import { Routes, Route } from "react-router-dom";
import { ROUTES, type PageKey } from "./routes";
import Index from "./pages/Index";

// STALE TABS AFTER A DEPLOY.
//
// Every build renames every chunk (content hashes) and update-site.sh swaps
// dist/ atomically, so the old chunks are gone the moment a deploy lands. A tab
// that loaded the site BEFORE the deploy still holds the old index.js, whose
// lazy imports point at the old names. Its next client-side navigation to a
// lazy route requests a chunk that now 404s, the import() rejects, and with no
// error boundary React unmounts the whole tree: the URL changes, the page goes
// black, and a refresh "fixes" it because the refresh fetches the new
// index.html. The operator hit exactly this on /unmineable -> /mine/zephyr on
// 2026-09-10 after three deploys in one day.
//
// Fix, in two layers:
//   1. lazyWithReload: if a chunk fails to load, reload the page ONCE. The
//      reload gets the new index.html and the new chunk names. A sessionStorage
//      flag stops a genuinely broken deploy from reload-looping.
//   2. RouteErrorBoundary: anything that still throws renders a visible
//      "reload" message instead of a black page.
const RELOAD_FLAG = "pw-chunk-reload";

function lazyWithReload<T extends ComponentType>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().then(
      (mod) => {
        try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* storage blocked */ }
        return mod;
      },
      (err) => {
        let already = false;
        try {
          already = sessionStorage.getItem(RELOAD_FLAG) === "1";
          if (!already) sessionStorage.setItem(RELOAD_FLAG, "1");
        } catch { /* storage blocked: fall through to the boundary */ }
        if (!already) {
          window.location.reload();
          // Never resolves; the reload is already under way.
          return new Promise<{ default: T }>(() => {});
        }
        throw err;
      }
    )
  );
}

class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
                    flexDirection: "column", gap: 12, color: "#a0a0a0", background: "#0a0a0a",
                    fontFamily: "monospace", fontSize: 13 }}>
        <div>this page failed to load - the site was probably just updated</div>
        <button onClick={() => window.location.reload()}
                style={{ border: "1px solid #404040", background: "#0f0f0f", color: "#e6e6e6",
                         padding: "8px 16px", cursor: "pointer", fontFamily: "inherit" }}>
          reload
        </button>
      </div>
    );
  }
}

// /download/:slug is NOT in routes.ts on purpose. It is a counted redirect to a
// GitHub release asset, not a page: nothing to prerender, and it must stay out
// of the sitemap. Registered directly below the generated routes.
const Download = lazyWithReload(() => import("./pages/Download"));

// Browser route table. Pages are lazy so a visitor landing on / does not
// download the calculator, leaderboard and wallet chunks too. The path list
// lives in routes.ts, shared with the prerender entry.
//
// Typing this as Record<PageKey, ...> is deliberate: adding a page to
// routes.ts without adding it here is a compile error, not a 404 in prod.
const PAGES: Record<PageKey, ComponentType> = {
  Index,
  GetStarted: lazyWithReload(() => import("./pages/GetStarted")),
  Wallet: lazyWithReload(() => import("./pages/Wallet")),
  Calculator: lazyWithReload(() => import("./pages/Calculator")),
  Leaderboard: lazyWithReload(() => import("./pages/Leaderboard")),
  Pool: lazyWithReload(() => import("./pages/Pool")),
  MineZephyr: lazyWithReload(() => import("./pages/MineZephyr")),
  MineZano: lazyWithReload(() => import("./pages/MineZano")),
  MineXelis: lazyWithReload(() => import("./pages/MineXelis")),
  Unmineable: lazyWithReload(() => import("./pages/Unmineable")),
  NotFound: lazyWithReload(() => import("./pages/NotFound")),
};

const RouteFallback = () => (
  <div
    style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#888",
    }}
  >
    Loading...
  </div>
);

export default function AppRoutes() {
  return (
    <RouteErrorBoundary>
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {ROUTES.map(({ path, page }) => {
          const Page = PAGES[page];
          return <Route key={path} path={path} element={<Page />} />;
        })}
        <Route path="/download" element={<Download />} />
        <Route path="/download/:slug" element={<Download />} />
      </Routes>
    </Suspense>
    </RouteErrorBoundary>
  );
}
