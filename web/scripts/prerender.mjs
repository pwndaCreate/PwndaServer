#!/usr/bin/env node
/*
 * Build-time prerendering. Zero new dependencies - react-dom/server is already
 * in the tree, so this needs no framework migration.
 *
 * WHY THIS EXISTS: AI crawlers (GPTBot, ClaudeBot, PerplexityBot) and some
 * search crawlers do NOT execute JavaScript. A Vite SPA serves them an empty
 * <div id="root">, so every word of marketing copy is invisible. After this
 * runs, View Source on each route shows the full page.
 *
 * Pipeline:
 *   1. vite build                        -> dist/          (client bundle)
 *   2. vite build --ssr entry-server     -> dist-ssr/      (render function)
 *   3. this script                       -> dist/<route>/index.html
 *
 * Output shape is <route>/index.html because the live nginx already does
 *   try_files $uri $uri/ /index.html;
 * so /wallet resolves to /wallet/index.html with no server change needed.
 *
 * Live numbers are NOT baked in. Each page prerenders its empty state and
 * fills in pool stats after hydration - the copy is what crawlers need, and a
 * stale hashrate in static HTML would be worse than none.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = process.env.PRERENDER_DIST || join(root, "dist");
const SITE = "https://pwnda.org";
const ROOT_DIV = '<div id="root"></div>';

// Per-route head. Titles are keyword-front-loaded and ~55 chars; descriptions
// ~155. Kept here rather than in the components because it has to be injected
// into raw HTML, before React ever runs.
const ROUTES = [
  {
    path: "/",
    title: "Mine XMR, ZEPH or ZANO on Your PC - Get Paid in Any Coin | PWNDA",
    description:
      "Mine Monero or Zephyr on your CPU, Zano on your GPU, and receive Bitcoin, Ethereum, USDC, XRP or 15 more coins. PWNDA is a free non-custodial wallet with built-in mining and decentralized swaps. 0.5% pool fee, no KYC.",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          name: "PWNDA",
          url: SITE,
          // sameAs is how Google links a brand to its other properties and
          // promotes it from a string to an entity. Entities are
          // language-independent, so this is the cheapest thing on the site that
          // helps non-English searchers find the brand.
          sameAs: ["https://github.com/pwndaCreate/PwndaWallet"],
          // The site ranks 42.9 for its OWN NAME (measured 2026-09-09), which means
          // Google has not tied the string "pwnda" to this site as an entity.
          // alternateName declares the casings and the domain to be the same thing,
          // so a query for any of them has one target instead of three unrelated
          // strings. Cheap and correct, but NOT the fix: a brand ranks for its own
          // name on off-site corroboration, and nothing currently mentions this one.
          alternateName: ["Pwnda", "pwnda.org", "PWNDA Mining"],
          description:
            "Non-custodial mining pool and wallet: mine Monero, Zephyr or Zano and " +
            "receive payment in any of 19 coins.",
        },
        { "@type": "WebSite", name: "PWNDA - Mine X, Receive Y", url: SITE,
          alternateName: "PWNDA" },
        {
          "@type": "SoftwareApplication",
          name: "Pwnda Wallet",
          operatingSystem: "Windows",
          applicationCategory: "FinanceApplication",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        },
        {
          "@type": "FAQPage",
          mainEntity: [
            [
              "How can I mine Bitcoin on a normal PC?",
              "You can't mine Bitcoin itself on a PC - it needs ASICs. The practical route is mining an ASIC-resistant coin your hardware is good at (Monero or Zephyr on CPU, Zano on GPU) and swapping rewards into BTC. PWNDA automates that with decentralized swaps, so no exchange account is involved.",
            ],
            [
              "Which coins can I receive?",
              "BTC, ETH, USDC, SOL, XRP, ADA, AVAX and more - 19 destination coins today, including USDC and USDT. You mine XMR, ZEPH or ZANO; the wallet's EARN tab handles the two-hop conversion and you confirm each rate before it executes.",
            ],
            [
              'Is this custodial like other "mine X get Y" sites?',
              "No. PWNDA never holds a balance for you. Mining pays out on-chain to your own address, and swaps settle wallet-to-wallet via atomic swaps and NEAR intents. There is no account to create and nothing to withdraw.",
            ],
            [
              "What does it cost?",
              "The wallet is free and open source, and the Zephyr and Zano pools charge a 0.5% fee. Swaps carry only network fees and the market spread of the route - roughly ~1% on the P2P leg - shown before you confirm.",
            ],
          ].map(([q, a]) => ({
            "@type": "Question",
            name: q,
            acceptedAnswer: { "@type": "Answer", text: a },
          })),
        },
      ],
    },
  },
  {
    path: "/wallet",
    title: "Pwnda Wallet - XMR, ZEPH & ZANO Mining Wallet, Non-Custodial",
    // The caution about not leading with "Download" applied while the build was
    // unpublished. v0.6.0 shipped 2026-09-06, so the page can now deliver what
    // the snippet promises.
    description:
      "Pwnda Wallet is a free, open-source, non-custodial multi-chain crypto wallet with opt-in CPU/GPU mining, atomic swaps, and no KYC. Mine Monero, Zephyr or Zano and get paid in BTC, ETH, SOL and more. Free download for Windows and Linux.",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Pwnda Wallet",
      operatingSystem: "Windows",
      applicationCategory: "FinanceApplication",
      softwareVersion: "2.0.1",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
  },
  {
    path: "/start",
    title: "Start Mining Zephyr (CPU) or Zano (GPU) - Low Fee Pool Setup",
    description:
      "Start mining Zephyr (CPU, RandomX), Zano (GPU, ProgPowZ) or Xelis (GPU+CPU, XelisHashV3) in about 10 minutes. Easy mode: the Pwnda Wallet sets up ZEPH and ZANO. Manual mode: point XMRig or SRBMiner at the 0.5%-fee PWNDA pools.",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "How to mine Zephyr, Zano or Xelis on the PWNDA pools",
      step: [
        "Get a wallet address",
        "Download a miner",
        "Connect to the pool",
        "Verify accepted shares",
      ].map((name) => ({ "@type": "HowToStep", name })),
    },
  },
  {
    path: "/calculator",
    title: "ZEPH, ZANO & XEL Mining Calculator - CPU/GPU Profit Estimate",
    description:
      "Estimate Zephyr, Zano and Xelis mining earnings from live network difficulty, block reward and price. Enter your hashrate and power cost to see hourly, daily, weekly and monthly returns.",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "PWNDA Mining Calculator",
      url: SITE + "/calculator",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      description:
        "Estimates Zephyr (RandomX, CPU), Zano (ProgPowZ, GPU) and Xelis (XelisHashV3, GPU+CPU) mining returns from live network difficulty, block reward and price, net of the 0.5% pool fee.",
    },
  },
  {
    path: "/leaderboard",
    title: "ZEPH, ZANO & XEL Mining Leaderboard - Top Miners by Hashrate",
    description:
      "Live leaderboard of PWNDA miners across the Zephyr (CPU, RandomX), Zano (GPU, ProgPowZ) and Xelis (GPU+CPU, XelisHashV3) pools, ranked by hashrate.",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "PWNDA Mining Leaderboard",
      url: SITE + "/leaderboard",
      description:
        "Miners on the PWNDA Zephyr and Zano pools ranked by attested hashrate.",
      // ItemList without itemListElement is deliberate: the rows are fetched at
      // runtime, and schema must describe what is actually in the HTML.
      mainEntity: { "@type": "ItemList", name: "Top miners by hashrate" },
    },
  },
  {
    path: "/pool",
    title: "My Stats - Look Up Your ZEPH or ZANO Mining Stats",
    description:
      "Paste your Zephyr or Zano address to see your live hashrate, workers, pending balance and payout history. The pool is detected automatically from the address.",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "PWNDA Miner Stats Lookup",
      url: SITE + "/pool",
      applicationCategory: "UtilityApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      description:
        "Look up live hashrate, workers, pending balance and payout history for a Zephyr or Zano mining address. The pool is detected from the address prefix.",
    },
  },
  // Subject-matter pages, 2026-09-10. The second Search Console pull had zero
  // impressions for any mining-qualified query because no page was ABOUT mining
  // Zephyr or Zano. These are. Titles front-load the qualifier so the junk
  // "calculator" tail does not repeat here, and every number matches
  // src/lib/coins.ts - which the tests check against the live pools.
  {
    path: "/mine/zephyr",
    title: "Mine Zephyr on Your CPU - ZEPH RandomX Pool, 0.5% Fee",
    description:
      "How to mine Zephyr (ZEPH) with a desktop or laptop CPU. RandomX is ASIC-resistant. XMRig setup in 3 steps, 0.5% fee, PPLNS, paid from 0.01 ZEPH to your own wallet - no account.",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "HowTo",
          name: "How to mine Zephyr (ZEPH) on a CPU",
          step: ["Get a Zephyr address", "Download XMRig", "Run it with your address as the username"]
            .map((name) => ({ "@type": "HowToStep", name })),
        },
        {
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Is Zephyr ASIC-resistant?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. RandomX is built around CPU cache and branch behaviour that an ASIC cannot copy cheaply - the same algorithm Monero uses. A desktop or gaming PC is the intended hardware.",
              },
            },
            {
              "@type": "Question",
              name: "Do I need an account to mine Zephyr on PWNDA?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "No. There is no signup and no email. Your Zephyr address is the account, and payouts go to it directly from 0.01 ZEPH.",
              },
            },
          ],
        },
      ],
    },
  },
  {
    path: "/mine/zano",
    title: "Mine Zano on Your GPU - ZANO ProgPowZ Pool, 0.5% Fee",
    description:
      "How to mine Zano (ZANO) with a gaming GPU, AMD or NVIDIA. ProgPowZ is ASIC-resistant. SRBMiner setup in 3 steps, 0.5% fee, PPLNS, paid from 0.2 ZANO to your own wallet - no account.",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "HowTo",
          name: "How to mine Zano (ZANO) on a GPU",
          step: ["Get a Zano address", "Download SRBMiner-MULTI", "Run it with your address as the wallet"]
            .map((name) => ({ "@type": "HowToStep", name })),
        },
        {
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Is Zano ASIC-resistant?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. ProgPowZ is a ProgPow variant designed so the fastest hardware for it is a graphics card. There is no ASIC advantage to buy, so a gaming GPU competes on equal terms.",
              },
            },
            {
              "@type": "Question",
              name: "Do I need an account to mine Zano on PWNDA?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "No. There is no signup and no email. Your Zano address is the account, and payouts go to it directly from 0.2 ZANO.",
              },
            },
          ],
        },
      ],
    },
  },
  // Added with the XEL pool, 2026-09-16. Mirrors src/pages/MineGuide.tsx (the
  // xel prose) and src/lib/coins.ts. Without this entry nginx answers 404 for a
  // direct visit to /mine/xelis (try_files ... =404) and the page is not in the
  // sitemap. XEL is bring-your-own-miner: the Pwnda Wallet does not handle it,
  // so nothing here may promise a wallet swap.
  {
    path: "/mine/xelis",
    title: "Mine Xelis on Your GPU or CPU - XEL XelisHashV3 Pool, 0.5% Fee",
    description:
      "How to mine Xelis (XEL) on a gaming GPU or a desktop CPU. SRBMiner setup in 3 steps, 0.5% fee, PPLNS over a 1 h window, paid every 4 hours from 0.05 XEL to your own wallet - no account.",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "HowTo",
          name: "How to mine Xelis (XEL) on a GPU or CPU",
          step: ["Get a Xelis address", "Download SRBMiner-MULTI", "Run it with your address as the wallet"]
            .map((name) => ({ "@type": "HowToStep", name })),
        },
        {
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Is Xelis ASIC-resistant?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes, by design. The XELIS project describes its XELIS Hash algorithm as CPU/GPU friendly and built for FPGA and ASIC resistance, so a gaming GPU or a desktop CPU is intended hardware rather than an afterthought.",
              },
            },
            {
              "@type": "Question",
              name: "Do I need an account to mine Xelis on PWNDA?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "No. There is no signup and no email. Your Xelis address is the account, and payouts go to it directly from 0.05 XEL.",
              },
            },
          ],
        },
      ],
    },
  },
  {
    path: "/unmineable",
    title: "Mine Unmineable Coins on Your PC - Earn TRX, SOL, XRP, ADA",
    description:
      "Tron, XRP, Solana and Cardano have no proof-of-work; Bitcoin and Dogecoin are ASIC-only. Mine Zephyr on your CPU or Zano on your GPU and get paid in any of 19 coins, to a wallet only you hold.",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Can I mine Tron, XRP or Solana on my PC?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "No - none of them use proof-of-work, so nothing mines them on any hardware. A PC can mine Zephyr or Zano, which are ASIC-resistant, and have the payout delivered as TRX, XRP or SOL.",
              },
            },
            {
              "@type": "Question",
              name: "Can I mine Dogecoin or Bitcoin on a PC?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Technically yes, practically no: both are ASIC networks and a desktop earns fractions of a cent. Mining Zephyr or Zano and taking the payout in DOGE or BTC ends with more of the coin you wanted.",
              },
            },
          ],
        },
        {
          "@type": "ItemList",
          name: "Coins a PC can be paid in by mining Zephyr or Zano",
          itemListElement: [
            "BTC", "ETH", "SOL", "LTC", "BCH", "DOGE", "XRP", "TRX", "USDC", "USDT",
            "DAI", "MON", "BNB", "DASH", "XLM", "SUI", "AVAX", "POL", "ADA",
          ].map((sym, i) => ({ "@type": "ListItem", position: i + 1, name: sym })),
        },
      ],
    },
  },
  {
    // NOT a real route. `path` is a deliberate non-match so react-router falls
    // through to the catch-all NotFound page; the result is written to
    // dist/404.html, which nginx serves via `error_page 404` WITH a 404 status.
    //
    // Why this exists: every unknown path used to answer 200 with the homepage
    // body (`try_files ... /index.html`). That is a soft 404 - Google treats it
    // as a duplicate of the homepage, and a typo'd link looked like a real page
    // to crawlers. Kept out of sitemap.xml and marked noindex.
    path: "/__not-found__",
    file: "404.html",
    noindex: true,
    title: "Page Not Found | PWNDA",
    description:
      "That page does not exist. Browse the PWNDA mining pool, the non-custodial wallet, or the mining calculator.",
  },
];

// The 404 is prerendered but is not a URL, so it never enters sitemap.xml.
const SITEMAP_ROUTES = ROUTES.filter((r) => !r.noindex);

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function main() {
  const templatePath = join(dist, "index.html");
  if (!existsSync(templatePath)) {
    console.error("prerender: dist/index.html missing - run `vite build` first");
    process.exit(1);
  }
  const template = readFileSync(templatePath, "utf8");

  // The "/" route writes back to this same file, so a second run would
  // otherwise read an ALREADY-PRERENDERED page as its template and silently
  // inject nothing. Assert on the empty mount point instead of discovering it
  // later as a subtly wrong page.
  if (!template.includes(ROOT_DIV)) {
    console.error(
      "prerender: dist/index.html has no empty " + ROOT_DIV + " - it looks already prerendered.\n" +
      "           Run a fresh `vite build` first; this step is not idempotent by design."
    );
    process.exit(1);
  }

  const { render } = await import(process.env.PRERENDER_SSR || join(root, "dist-ssr", "entry-server.js"));

  let failures = 0;
  for (const route of ROUTES) {
    let html;
    try {
      html = render(route.path);
    } catch (err) {
      console.error(`prerender: FAILED ${route.path}\n  ${err?.stack || err}`);
      failures++;
      continue;
    }

    // TRAILING SLASH IS DELIBERATE. Routes are emitted as <route>/index.html,
    // and nginx's `try_files $uri $uri/` 301s /wallet -> /wallet/. The
    // canonical therefore has to be the trailing-slash form: a canonical that
    // redirects somewhere else is a self-conflict, and Google follows the
    // redirect rather than the tag.
    //
    // To serve /wallet WITHOUT the redirect instead, add $uri.html to the
    // nginx try_files and emit <route>.html here - then drop the slash below.
    const canonical = SITE + (route.path === "/" ? "/" : route.path + "/");
    const head = [
      `<title>${esc(route.title)}</title>`,
      `<meta name="description" content="${esc(route.description)}">`,
      // The 404 body is served from many different URLs, so it has no canonical
      // of its own and must never be indexed. Every other page self-canonicalises.
      route.noindex ? `<meta name="robots" content="noindex">` : "",
      route.noindex ? "" : `<link rel="canonical" href="${esc(canonical)}">`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:title" content="${esc(route.title)}">`,
      `<meta property="og:description" content="${esc(route.description)}">`,
      route.noindex ? "" : `<meta property="og:url" content="${esc(canonical)}">`,
      `<meta name="twitter:card" content="summary_large_image">`,
      route.jsonLd
        ? `<script type="application/ld+json">${JSON.stringify(route.jsonLd)}</script>`
        : "",
    ]
      .filter(Boolean)
      .join("\n    ");

    let out = template;
    // NOTE: every replacement below passes a FUNCTION, not a string. In a
    // string replacement, "$&", "$\'" and "$1" are substitution patterns - and
    // the rendered pages are full of "$" (prices, "[$$$$]" in the rig
    // animation), which silently corrupted the output and dropped the markup.
    // A replacer function disables that interpretation entirely.
    out = out.replace(/<title>[\s\S]*?<\/title>/i, () => "");
    // The template also ships its own description / og: / twitter: tags (the
    // pre-redesign "Zephyr Mining Pool" copy). Injecting on top of them left
    // TWO <meta name="description"> per page - the title was stripped, these
    // were not - so a crawler picked one arbitrarily and half the time got
    // copy that predates the wallet repositioning. Strip every tag we are
    // about to re-emit, so injection REPLACES rather than appends.
    for (const attr of [
      'name="description"',
      'property="og:title"',
      'property="og:description"',
      'property="og:type"',
      'property="og:url"',
      'name="twitter:card"',
    ]) {
      out = out.replace(new RegExp(`\\s*<meta ${attr}[^>]*>`, "gi"), () => "");
    }
    out = out.replace(/\s*<link rel="canonical"[^>]*>/gi, () => "");
    out = out.replace("</head>", () => `  ${head}\n  </head>`);
    out = out.replace(ROOT_DIV, () => `<div id="root">${html}</div>`);

    // Strict: the FULL rendered markup must be present, not a prefix. Pages
    // share a nav, so a prefix check passes spuriously across routes.
    if (!out.includes(html)) {
      console.error(`prerender: FAILED ${route.path} - markup did not inject`);
      failures++;
      continue;
    }

    // Exactly one of each head tag a crawler dedupes badly. This is the guard
    // for the strip above: add a tag to `head` without adding it to the strip
    // list and the build fails here instead of shipping two of them.
    const dupe = [
      ["title", /<title>/gi],
      ["description", /<meta name="description"/gi],
      // A noindex page (the 404) deliberately has NO canonical - it is served
      // from every unknown URL, so there is no one URL to point at. Expect 0.
      ["canonical", /<link rel="canonical"/gi, route.noindex ? 0 : 1],
      ["og:description", /<meta property="og:description"/gi],
    ].find(([, re, want = 1]) => (out.match(re) || []).length !== want);
    if (dupe) {
      const n = (out.match(dupe[1]) || []).length;
      const want = dupe[2] === undefined ? 1 : dupe[2];
      console.error(`prerender: FAILED ${route.path} - ${n} <${dupe[0]}> tags, expected ${want}`);
      failures++;
      continue;
    }

    // `route.file` writes ONE named file at the dist root - that is the 404
    // page, which nginx serves via error_page and so cannot live at <route>/.
    // Everything else keeps the <route>/index.html shape try_files resolves.
    if (route.file) {
      writeFileSync(join(dist, route.file), out);
    } else {
      const dir = route.path === "/" ? dist : join(dist, route.path);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "index.html"), out);
    }
    console.log(`  prerendered ${(route.file || route.path).padEnd(14)} ${(out.length / 1024).toFixed(1)} kB`);
  }

  // sitemap + robots, generated from the same route list so they cannot drift
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    SITEMAP_ROUTES.map(
      (r) =>
        `  <url><loc>${SITE}${r.path === "/" ? "/" : r.path + "/"}</loc>` +
        `<changefreq>${r.path === "/" ? "daily" : "weekly"}</changefreq>` +
        `<priority>${r.path === "/" ? "1.0" : "0.8"}</priority></url>`
    ).join("\n") +
    `\n</urlset>\n`;
  writeFileSync(join(dist, "sitemap.xml"), sitemap);
  console.log(`  wrote sitemap.xml (${SITEMAP_ROUTES.length} urls)`);

  if (failures) {
    console.error(`prerender: ${failures} route(s) failed`);
    process.exit(1);
  }
  console.log("prerender: OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
