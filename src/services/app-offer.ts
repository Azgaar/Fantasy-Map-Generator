// The Desktop App dialog: what the app is and which file this visitor needs

import { t } from "@/utils/i18n";
import { isMobile } from "./platform";

const RELEASES_API = "https://api.github.com/repos/Azgaar/Fantasy-Map-Generator/releases/latest";
const RELEASES_PAGE = "https://github.com/Azgaar/Fantasy-Map-Generator/releases/latest";

type Os = "windows" | "mac" | "linux";
type Asset = { name: string; browser_download_url: string; size: number };
type Release = { version: string; assets: Asset[] };

/**
 * Suffix of the artifact name each system needs, see electron-builder.yml. Note that electron-builder
 * spells x64 the way each package format does: `x86_64` for AppImage, `amd64` for deb
 */
const DOWNLOADS: { os: Os; label: string; suffix: string }[] = [
  { os: "windows", label: "Windows", suffix: "-win-x64.exe" },
  { os: "windows", label: t("Windows on ARM"), suffix: "-win-arm64.exe" },
  { os: "mac", label: t("Mac with Apple silicon"), suffix: "-mac-arm64.dmg" },
  { os: "mac", label: t("Mac with Intel"), suffix: "-mac-x64.dmg" },
  { os: "linux", label: "Linux", suffix: "-linux-x86_64.AppImage" },
  { os: "linux", label: t("Debian or Ubuntu"), suffix: "-linux-amd64.deb" }
];

const INTRO = /* html */ `<p>${t("The Desktop App is the Generator packaged as a program for your computer. It has the same features as this page, but runs in its own window and works without an internet connection. It checks for new versions on its own and installs them for you, except on macOS and Debian, where it points you at the download.")}</p>`;

async function open(): Promise<void> {
  $("#alert").dialog({
    resizable: false,
    title: t("Desktop App"),
    width: "30em",
    position: { my: "center", at: "center", of: window },
    buttons: {
      [t("Close")]: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });

  alertMessage.innerHTML = `<p>${t("Checking the latest version…")}</p>`;
  alertMessage.innerHTML = await renderOffer();
}

/** A narrow desktop window is not a phone: ask the device before trusting the viewport width */
function isHandheld(): boolean {
  const mobile = (navigator as any).userAgentData?.mobile;
  return mobile ?? (isMobile() && matchMedia("(pointer: coarse)").matches);
}

/** Which file this visitor needs, so that nobody has to know what an architecture is */
async function detectTarget(): Promise<string | undefined> {
  const agent = (navigator as any).userAgentData;
  const signature = `${agent?.platform ?? navigator.platform ?? ""} ${navigator.userAgent}`;

  const os: Os | undefined = /win/i.test(signature)
    ? "windows"
    : /mac/i.test(signature)
      ? "mac"
      : /linux|x11|cros/i.test(signature)
        ? "linux"
        : undefined;
  if (!os) return undefined;

  let arm = false;
  try {
    const { architecture } = (await agent?.getHighEntropyValues?.(["architecture"])) ?? {};
    arm = architecture === "arm";
  } catch {
    // Chromium-only API, other browsers fall back to the defaults below
  }
  // Safari reports Intel even on Apple silicon, so an undetectable Mac gets the ARM build, the common one since 2020
  if (os === "mac" && !agent) arm = true;

  if (os === "windows") return arm ? "-win-arm64.exe" : "-win-x64.exe";
  if (os === "mac") return arm ? "-mac-arm64.dmg" : "-mac-x64.dmg";
  return "-linux-x86_64.AppImage";
}

/** Opening the dialog is a deliberate, one-off action, so it always asks GitHub for the current release */
async function loadRelease(): Promise<Release | undefined> {
  try {
    const response = await fetch(RELEASES_API);
    if (!response.ok) return undefined;

    const { tag_name, assets } = await response.json();
    return {
      version: String(tag_name).replace(/^v/, ""),
      assets: assets.map(({ name, browser_download_url, size }: Asset) => ({ name, browser_download_url, size }))
    };
  } catch {
    return undefined;
  }
}

function renderDownloads(release: Release, target: string | undefined): string {
  const find = (suffix: string) => release.assets.find(({ name }) => name.endsWith(suffix));
  const primary = target ? find(target) : undefined;
  const primaryLabel = DOWNLOADS.find(({ suffix }) => suffix === target)?.label;

  const others = DOWNLOADS.filter(({ suffix }) => suffix !== target)
    .map(({ label, suffix }) => ({ label, asset: find(suffix) }))
    .filter(({ asset }) => asset)
    .map(({ label, asset }) => `<a href="${asset!.browser_download_url}" target="_blank">${label}</a>`)
    .join(" &middot; ");
  if (!primary && !others) return "";

  const main = primary
    ? /* html */ `<p>${t("Your system is {{system}}", { system: primaryLabel })}:
        <b><a href="${primary.browser_download_url}" target="_blank">${t("download version {{version}}", { version: release.version })}</a></b>
        ${t("({{size}} MB). The file goes to your Downloads folder, open it to install the app.", { size: Math.round(primary.size / 1024 / 1024) })}</p>`
    : "";

  const rest = others ? `<p>${primary ? t("Other systems") : t("Downloads")}: ${others}.</p>` : "";
  return `${main}${rest}`;
}

async function renderOffer(): Promise<string> {
  if (isHandheld()) return `<p>${t("The Desktop App is made for computers, there is no phone or tablet version.")}</p>`;

  const [release, target] = await Promise.all([loadRelease(), detectTarget()]);
  const downloads = release ? renderDownloads(release, target) : "";

  if (!downloads) {
    const reason = release
      ? t("The Desktop App is not published yet.")
      : t("The list of downloads could not be loaded right now.");
    return `<span>${t("{{- reason}} Everything released so far is on the {{- releases}} on GitHub.", {
      reason,
      releases: `<a href="${RELEASES_PAGE}" target="_blank">${t("releases page")}</a>`
    })}</span>`;
  }

  return /* html */ `${INTRO}${downloads}
    <p>${t("The app and this page keep their maps and settings apart, so what you have here does not appear there. To move a map over, save it as a .map file and load it in the app.")}</p>
    <p>${t("Windows and macOS will warn about an unknown developer the first time, because the app is not signed yet: on Windows click “More info” and then “Run anyway”, on macOS right-click the app and choose “Open”.")}</p>`;
}

export const AppOffer = { open };
