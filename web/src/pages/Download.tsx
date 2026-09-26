import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { TerminalNav, SiteFooter, TerminalFrame } from "@/components/terminal";
import {
  DOWNLOAD_TARGETS,
  RELEASES_URL,
  VERSION,
  downloadPath,
  targetBySlug,
} from "@/lib/wallet-release";

// /download            -> a chooser. Windows and Linux builds side by side.
// /download/<slug>     -> the counted hand-off for the build the visitor picked.
//
// WHY A CHOOSER RATHER THAN AN IMMEDIATE DOWNLOAD. The release ships Windows and
// Linux installers, and guessing from the user agent gets it wrong for exactly
// the people most likely to care - a Linux user on a borrowed machine, someone
// wanting the .msi for a managed install. Showing the options costs one click
// and never hands anyone the wrong file. The hand-off page below only runs once
// a specific build has been CHOSEN.
//
// Both paths are on this origin, so the choice is visible in the access log:
// /download tells us someone opened the chooser, /download/<slug> tells us which
// platform they took. See src/lib/wallet-release.ts.

function Handoff({ slug }: { slug: string }) {
  const target = targetBySlug(slug);
  const href = target?.url ?? RELEASES_URL;
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    // replace() so Back returns to the chooser, not this hop.
    const t = setTimeout(() => window.location.replace(href), 60);
    const s = setTimeout(() => setStalled(true), 2500);
    return () => {
      clearTimeout(t);
      clearTimeout(s);
    };
  }, [href]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-[13px] text-[#808080]">
        {target ? (
          <>
            Starting your download of{" "}
            <span className="text-[#e6e6e6]">{target.label}</span> (v{VERSION})...
          </>
        ) : (
          <>Taking you to the PwndaWallet releases...</>
        )}
      </div>
      <a href={href} className="pw-btn-ghost px-6 py-3 text-[13px] font-bold">
        {stalled ? "Download did not start - click here" : "Click here if nothing happens"}
      </a>
      {/* Said here, where the person is when the file lands, not only in the
          chooser's footer. The installer is not code-signed, so Windows shows
          an unknown-publisher prompt; a reader who was not warned reads that
          as "this is malware" and stops. Roughly two of three download clicks
          never became installs (wiki: marketing-4chan-campaigns-sep-2026). */}
      {target?.os === "windows" ? (
        <p className="max-w-[52ch] text-[12px] leading-[1.7] text-[#666666]">
          Windows will show a SmartScreen prompt when you run it, because the installer is not
          code-signed yet: choose More info, then Run anyway. The .sig file on GitHub lets you
          verify the download first.
        </p>
      ) : null}
      <Link to="/download" className="text-[12px] text-[#666666] hover:text-[#e6e6e6]">
        pick a different build
      </Link>
    </main>
  );
}

function OptionRow({ slug, label, size, note }: {
  slug: string; label: string; size: string; note?: string;
}) {
  return (
    <a
      href={downloadPath(slug)}
      className="flex items-baseline justify-between gap-4 border border-[#404040] bg-[#0a0a0a] px-5 py-3.5 text-left transition-colors hover:border-[#808080]"
    >
      <span className="text-[13px] text-[#e6e6e6]">
        {label}
        {note ? <span className="ml-2 text-[11px] text-[#666666]">{note}</span> : null}
      </span>
      <span className="shrink-0 text-[12px] text-[#808080]">{size}</span>
    </a>
  );
}

export default function Download() {
  const { slug } = useParams();
  if (slug) return <Handoff slug={slug} />;

  const windows = DOWNLOAD_TARGETS.filter((t) => t.os === "windows");
  const linux = DOWNLOAD_TARGETS.filter((t) => t.os === "linux");

  return (
    <div className="min-h-screen">
      <TerminalNav />
      <main className="mx-auto max-w-[760px] px-6 pb-20 pt-10">
        <h1
          className="my-2 text-center font-display text-[13px] text-white sm:text-[17px]"
          style={{ textShadow: "0 0 6px rgba(242,242,242,0.35)" }}
        >
          DOWNLOAD PWNDA WALLET
        </h1>
        <p className="mx-auto mb-8 mt-4 max-w-[56ch] text-center text-[13px] leading-[1.7] text-[#808080]">
          Version {VERSION}, free and open source. Pick the build for your system - nothing
          downloads until you choose one.
        </p>

        <TerminalFrame title="WINDOWS" className="mb-5 p-6">
          <div className="flex flex-col gap-2.5">
            {windows.map((t) => (
              <OptionRow key={t.slug} slug={t.slug} label={t.label} size={t.size} note={t.note} />
            ))}
          </div>
        </TerminalFrame>

        <TerminalFrame title="LINUX" className="mb-5 p-6">
          <div className="flex flex-col gap-2.5">
            {linux.map((t) => (
              <OptionRow key={t.slug} slug={t.slug} label={t.label} size={t.size} note={t.note} />
            ))}
          </div>
        </TerminalFrame>

        <p className="mx-auto max-w-[60ch] text-center text-[11px] leading-[1.7] text-[#666666]">
          On Linux, the <span className="text-[#808080]">.AppImage</span> runs almost anywhere if
          you are unsure which to take. Every build is published on{" "}
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#808080] hover:text-[#e6e6e6] hover:underline"
          >
            GitHub releases
          </a>{" "}
          with a signature file you can verify. Antivirus may flag the bundled miners - that is
          expected for mining software. On Windows, SmartScreen adds an unknown-publisher prompt because the installer is not code-signed yet: choose More info, then Run anyway.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
