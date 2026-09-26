// The published PwndaWallet release, and the download routes that point at it.
//
// ONE PLACE TO BUMP. GitHub has no versionless alias for a release asset - the
// filename carries the version - so a direct link breaks on every release. Change
// VERSION and the asset names here and every button follows.
//
// WHY THE BUTTONS GO THROUGH /download/* INSTEAD OF STRAIGHT TO GITHUB.
// A link straight to github.com is never seen by our nginx, so it cannot be
// counted, and `wallet-download-stats.py` would read zero forever. Routing the
// click through a path on this origin makes it one logged request; the Download
// page then sends the browser on to GitHub. No nginx change was needed - the SPA
// fallback already serves /download/* and logs the exact path.
//
// GitHub's own per-asset download_count is the other half of the picture: it
// counts completions we cannot see once the browser leaves our origin. Our log
// counts intent, GitHub counts delivery.

export const REPO_URL = "https://github.com/pwndaCreate/PwndaWallet";
export const VERSION = "0.6.5";

const ASSET_BASE = `${REPO_URL}/releases/download/v${VERSION}`;

export interface DownloadTarget {
  /** Path segment under /download/ - this is what gets counted in the log. */
  slug: string;
  label: string;
  /** Platform grouping for the UI. */
  os: "windows" | "linux";
  /** Human size, from the release assets. */
  size: string;
  note?: string;
  url: string;
}

// KEEP THIS LIST IN STEP WITH THE ACTUAL RELEASE ASSETS. A target whose asset is
// not published is a 404 behind a download button, which is worse than not
// offering the build at all. v0.6.0 originally shipped an .msi as well; it was
// dropped when the release was rebuilt on 2026-09-06, so the Windows entry is
// the .exe alone. Verify with:
//   curl -s https://api.github.com/repos/pwndaCreate/PwndaWallet/releases/latest \
//     | python3 -c "import json,sys;[print(a['name']) for a in json.load(sys.stdin)['assets']]"
export const DOWNLOAD_TARGETS: DownloadTarget[] = [
  {
    slug: "windows",
    label: "Windows installer (.exe)",
    os: "windows",
    size: "154 MB",
    note: "Windows 10 and 11, 64-bit",
    url: `${ASSET_BASE}/PwndaWallet-${VERSION}-Setup-x64.exe`,
  },
  {
    slug: "linux-appimage",
    label: "Linux (.AppImage)",
    os: "linux",
    size: "296 MB",
    note: "Runs on most distributions",
    url: `${ASSET_BASE}/PwndaWallet-${VERSION}-x86_64.AppImage`,
  },
  {
    slug: "linux-deb",
    label: "Linux (.deb)",
    os: "linux",
    size: "205 MB",
    note: "Debian, Ubuntu",
    url: `${ASSET_BASE}/PwndaWallet-${VERSION}-amd64.deb`,
  },
  {
    slug: "linux-rpm",
    label: "Linux (.rpm)",
    os: "linux",
    size: "205 MB",
    note: "Fedora, RHEL, openSUSE",
    url: `${ASSET_BASE}/PwndaWallet-${VERSION}-x86_64.rpm`,
  },
];

/** Every release asset, for people who want checksums, signatures or an older build. */
export const RELEASES_URL = `${REPO_URL}/releases`;

/** `/download/<slug>` - the countable path a button points at. */
export function downloadPath(slug: string): string {
  return `/download/${slug}`;
}

export function targetBySlug(slug: string | undefined): DownloadTarget | undefined {
  return DOWNLOAD_TARGETS.find((t) => t.slug === slug);
}
