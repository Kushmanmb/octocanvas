/**
 * Pure helpers for Repo Studio: repo parsing, SVG generation, export presets,
 * Markdown snippets and local persistence. No DOM access except `storage*`.
 */

export const REPO_OWNERS = ["Kushmanmb", "kushmanmb-eth"] as const;

export interface RepoInfo {
  owner: string;
  name: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  defaultBranch: string;
}

export type PatternId = "none" | "grid" | "dots" | "diagonal" | "squares";
export type AlignId = "left" | "center" | "right";

/** Visual style fields: these are what style presets capture. */
export interface StudioStyle {
  colorA: string;
  colorB: string;
  textColor: string;
  accentColor: string;
  angle: number;
  pattern: PatternId;
  patternOpacity: number;
  align: AlignId;
  titleScale: number;
  showOwner: boolean;
  showStats: boolean;
}

export interface StudioSettings extends StudioStyle {
  title: string;
  subtitle: string;
  exportPresetId: ExportPresetId;
  format: "png" | "svg";
  branch: string;
  folder: string;
}

export type ExportPresetId =
  | "readme-banner"
  | "social-preview"
  | "desktop"
  | "mobile";

export interface ExportPreset {
  id: ExportPresetId;
  label: string;
  width: number;
  height: number;
  slug: string;
  hint: string;
}

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: "readme-banner",
    label: "README banner",
    width: 1280,
    height: 320,
    slug: "readme-banner",
    hint: "Embed in README.md",
  },
  {
    id: "social-preview",
    label: "Social preview",
    width: 1280,
    height: 640,
    slug: "social-preview",
    hint: "Upload in Settings > Social preview",
  },
  {
    id: "desktop",
    label: "Desktop wallpaper",
    width: 2560,
    height: 1440,
    slug: "desktop-wallpaper",
    hint: "2560 x 1440",
  },
  {
    id: "mobile",
    label: "Mobile wallpaper",
    width: 1170,
    height: 2532,
    slug: "mobile-wallpaper",
    hint: "1170 x 2532 (iPhone)",
  },
];

export const getExportPreset = (id: string): ExportPreset =>
  EXPORT_PRESETS.find((p) => p.id === id) ?? EXPORT_PRESETS[0];

export interface StylePreset {
  id: string;
  label: string;
  style: StudioStyle;
}

const baseStyle: StudioStyle = {
  colorA: "#0d1117",
  colorB: "#12662a",
  textColor: "#ffffff",
  accentColor: "#5fed83",
  angle: 135,
  pattern: "grid",
  patternOpacity: 0.12,
  align: "left",
  titleScale: 100,
  showOwner: true,
  showStats: true,
};

export const BUILT_IN_PRESETS: StylePreset[] = [
  { id: "universe-green", label: "Universe Green", style: baseStyle },
  {
    id: "universe-blue",
    label: "Universe Blue",
    style: {
      ...baseStyle,
      colorA: "#0a1128",
      colorB: "#1f6feb",
      accentColor: "#79c0ff",
      pattern: "dots",
    },
  },
  {
    id: "github-dark",
    label: "GitHub Dark",
    style: {
      ...baseStyle,
      colorA: "#0d1117",
      colorB: "#161b22",
      accentColor: "#58a6ff",
      pattern: "squares",
      patternOpacity: 0.35,
    },
  },
  {
    id: "octo-purple",
    label: "Octo Purple",
    style: {
      ...baseStyle,
      colorA: "#1b0b3a",
      colorB: "#8957e5",
      accentColor: "#d2a8ff",
      pattern: "diagonal",
      align: "center",
    },
  },
  {
    id: "sunset",
    label: "Sunset",
    style: {
      ...baseStyle,
      colorA: "#3a0f1d",
      colorB: "#f0883e",
      accentColor: "#ffd8a8",
      angle: 90,
      pattern: "none",
      align: "center",
    },
  },
  {
    id: "paper",
    label: "Light Paper",
    style: {
      ...baseStyle,
      colorA: "#ffffff",
      colorB: "#dde7f0",
      textColor: "#1f2328",
      accentColor: "#0969da",
      angle: 160,
      pattern: "grid",
      patternOpacity: 0.08,
    },
  },
];

export const DEFAULT_SETTINGS: StudioSettings = {
  ...baseStyle,
  title: "",
  subtitle: "",
  exportPresetId: "readme-banner",
  format: "png",
  branch: "main",
  folder: ".github/assets",
};

// ---------------------------------------------------------------------------
// Repo parsing
// ---------------------------------------------------------------------------

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * Accepts "repo", "owner/repo", or a github.com URL. Returns null when
 * invalid. A bare name uses `defaultOwner`.
 */
export const parseRepoInput = (
  input: string,
  defaultOwner: string
): { owner: string; name: string } | null => {
  let value = input.trim();
  value = value.replace(/^https?:\/\/(www\.)?github\.com\//i, "");
  value = value.replace(/\/+$/, "").replace(/\.git$/i, "");
  const parts = value.split("/").filter(Boolean);
  let owner = defaultOwner;
  let name: string;
  if (parts.length === 1) {
    name = parts[0];
  } else if (parts.length >= 2) {
    owner = parts[0];
    name = parts[1];
  } else {
    return null;
  }
  if (!OWNER_RE.test(owner) || !REPO_RE.test(name) || name === "." || name === "..") {
    return null;
  }
  return { owner, name };
};

export const toRepoInfo = (raw: any, owner: string): RepoInfo => ({
  owner: String(raw?.owner?.login ?? owner),
  name: String(raw?.name ?? ""),
  description: raw?.description ?? null,
  stars: Number(raw?.stargazers_count) || 0,
  forks: Number(raw?.forks_count) || 0,
  language: raw?.language ?? null,
  defaultBranch: String(raw?.default_branch ?? "main"),
});

// ---------------------------------------------------------------------------
// SVG generation
// ---------------------------------------------------------------------------

export const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const safeColor = (value: string, fallback: string) =>
  /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));

export const wrapText = (text: string, maxChars: number, maxLines: number) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] =
      kept[maxLines - 1].slice(0, Math.max(1, maxChars - 1)).trimEnd() + "…";
    return kept;
  }
  return lines;
};

// Deterministic pseudo-random so a repo always gets the same pattern.
const seeded = (seed: string) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export const buildStatsLine = (repo: RepoInfo) => {
  const parts = [`${repo.stars} stars`, `${repo.forks} forks`];
  if (repo.language) parts.push(repo.language);
  return parts.join("  ·  ");
};

export const buildRepoSvg = (
  repo: RepoInfo,
  settings: StudioSettings,
  width: number,
  height: number
): string => {
  const colorA = safeColor(settings.colorA, baseStyle.colorA);
  const colorB = safeColor(settings.colorB, baseStyle.colorB);
  const text = safeColor(settings.textColor, baseStyle.textColor);
  const accent = safeColor(settings.accentColor, baseStyle.accentColor);
  const angle = (clamp(settings.angle, 0, 360) * Math.PI) / 180;
  const patternOpacity = clamp(settings.patternOpacity, 0, 1);
  const scale = clamp(settings.titleScale, 50, 150) / 100;

  const unit = Math.min(width, height * 2.5) / 100;
  const pad = unit * 6;
  const innerWidth = width - pad * 2;

  // Gradient vector across the bounding box.
  const dx = Math.cos(angle) / 2;
  const dy = Math.sin(angle) / 2;
  const gradient = `<linearGradient id="bg" x1="${(0.5 - dx).toFixed(3)}" y1="${(
    0.5 - dy
  ).toFixed(3)}" x2="${(0.5 + dx).toFixed(3)}" y2="${(0.5 + dy).toFixed(
    3
  )}"><stop offset="0" stop-color="${colorA}"/><stop offset="1" stop-color="${colorB}"/></linearGradient>`;

  const cell = unit * 4;
  let defs = gradient;
  let overlay = "";
  switch (settings.pattern) {
    case "grid":
      defs += `<pattern id="pat" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse"><path d="M ${cell} 0 L 0 0 0 ${cell}" fill="none" stroke="${accent}" stroke-width="${Math.max(
        1,
        unit * 0.12
      )}"/></pattern>`;
      overlay = `<rect width="${width}" height="${height}" fill="url(#pat)" opacity="${patternOpacity}"/>`;
      break;
    case "dots":
      defs += `<pattern id="pat" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse"><circle cx="${
        cell / 2
      }" cy="${cell / 2}" r="${unit * 0.3}" fill="${accent}"/></pattern>`;
      overlay = `<rect width="${width}" height="${height}" fill="url(#pat)" opacity="${patternOpacity}"/>`;
      break;
    case "diagonal":
      defs += `<pattern id="pat" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${
        unit * 0.5
      }" height="${cell}" fill="${accent}"/></pattern>`;
      overlay = `<rect width="${width}" height="${height}" fill="url(#pat)" opacity="${patternOpacity}"/>`;
      break;
    case "squares": {
      const rand = seeded(`${repo.owner}/${repo.name}`);
      const size = unit * 2.4;
      const step = unit * 3;
      const cols = Math.ceil(width / step);
      const rows = Math.ceil(height / step);
      const levels = [0.25, 0.5, 0.75, 1];
      let rects = "";
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const v = rand();
          if (v < 0.45) continue;
          const level = levels[Math.min(3, Math.floor((v - 0.45) * 7.3))];
          rects += `<rect x="${(c * step).toFixed(1)}" y="${(r * step).toFixed(
            1
          )}" width="${size}" height="${size}" rx="${unit * 0.4}" opacity="${level}"/>`;
        }
      }
      overlay = `<g fill="${accent}" opacity="${patternOpacity}">${rects}</g>`;
      break;
    }
    default:
      break;
  }

  // Text layout.
  const title = (settings.title.trim() || repo.name || "repository").slice(0, 80);
  const subtitle = (
    settings.subtitle.trim() ||
    repo.description ||
    ""
  ).slice(0, 240);

  const titleSize = Math.min(
    unit * 8 * scale,
    innerWidth / (Math.max(title.length, 1) * 0.58)
  );
  const subSize = unit * 3.2;
  const metaSize = unit * 2.6;
  const maxChars = Math.max(10, Math.floor(innerWidth / (subSize * 0.55)));
  const subLines = subtitle
    ? wrapText(subtitle, maxChars, height > width ? 4 : 2)
    : [];

  const ownerLine = settings.showOwner ? repo.owner.toUpperCase() : "";
  const statsLine = settings.showStats ? buildStatsLine(repo) : "";

  const blocks: Array<{ size: number; gapBefore: number }> = [];
  if (ownerLine) blocks.push({ size: metaSize, gapBefore: 0 });
  blocks.push({ size: titleSize, gapBefore: ownerLine ? unit * 1 : 0 });
  subLines.forEach((_, i) =>
    blocks.push({ size: subSize, gapBefore: i === 0 ? unit * 1.2 : unit * 0.4 })
  );
  if (statsLine) blocks.push({ size: metaSize, gapBefore: unit * 2 });
  const totalHeight = blocks.reduce((s, b) => s + b.size * 1.1 + b.gapBefore, 0);

  const anchor =
    settings.align === "center" ? "middle" : settings.align === "right" ? "end" : "start";
  const x =
    settings.align === "center" ? width / 2 : settings.align === "right" ? width - pad : pad;

  let y = (height - totalHeight) / 2;
  let i = 0;
  let textOut = "";
  const place = (content: string, fill: string, weight: number, extra = "") => {
    const b = blocks[i++];
    y += b.gapBefore + b.size * 1.1;
    textOut += `<text x="${x.toFixed(1)}" y="${(y - b.size * 0.2).toFixed(
      1
    )}" font-family="${FONT}" font-size="${b.size.toFixed(
      1
    )}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${extra}>${escapeXml(
      content
    )}</text>`;
  };
  if (ownerLine) place(ownerLine, accent, 700, ` letter-spacing="${(unit * 0.3).toFixed(1)}"`);
  place(title, text, 800);
  subLines.forEach((line) => place(line, text, 400, ' fill-opacity="0.85"'));
  if (statsLine) place(statsLine, accent, 600);

  const accentBar = `<rect x="0" y="${height - unit}" width="${width}" height="${unit}" fill="${accent}"/>`;
  const label = escapeXml(`${repo.owner}/${repo.name}`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}"><defs>${defs}</defs><rect width="${width}" height="${height}" fill="url(#bg)"/>${overlay}${accentBar}${textOut}</svg>`;
};

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

export const buildFileName = (
  repo: RepoInfo,
  preset: ExportPreset,
  format: "png" | "svg"
) => `${repo.name.toLowerCase()}-${preset.slug}.${format}`;

const cleanFolder = (folder: string) =>
  folder
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s && s !== "." && s !== "..")
    .join("/");

export interface EmbedSnippets {
  rawUrl: string;
  pagesUrl: string;
  markdown: string;
  html: string;
  pagesMarkdown: string;
  path: string;
}

export const buildEmbedSnippets = (
  repo: RepoInfo,
  settings: Pick<StudioSettings, "branch" | "folder">,
  fileName: string
): EmbedSnippets => {
  const folder = cleanFolder(settings.folder);
  const branch = encodeURIComponent(settings.branch.trim() || "main");
  const path = folder ? `${folder}/${fileName}` : fileName;
  const alt = `${repo.name} banner`;
  const rawUrl = `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${branch}/${path}`;
  const pagesUrl = `https://${repo.owner.toLowerCase()}.github.io/${repo.name}/${fileName}`;
  return {
    rawUrl,
    pagesUrl,
    path,
    markdown: `![${alt}](${rawUrl})`,
    html: `<p align="center">\n  <img src="${rawUrl}" alt="${alt}" width="100%">\n</p>`,
    pagesMarkdown: `![${alt}](${pagesUrl})`,
  };
};

// ---------------------------------------------------------------------------
// Local persistence (no API keys; failures are non-fatal, e.g. Safari private mode)
// ---------------------------------------------------------------------------

export const SETTINGS_KEY = "octocanvas:repo-studio:settings:v1";
export const PRESETS_KEY = "octocanvas:repo-studio:presets:v1";

export const storageRead = <T>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const storageWrite = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / privacy-mode errors
  }
};

/** Merge stored data over defaults, keeping only known keys with matching types. */
export const sanitizeSettings = (stored: unknown): StudioSettings => {
  const out: any = { ...DEFAULT_SETTINGS };
  if (stored && typeof stored === "object") {
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      const v = (stored as any)[key];
      if (typeof v === typeof (DEFAULT_SETTINGS as any)[key]) out[key] = v;
    }
  }
  if (!["png", "svg"].includes(out.format)) out.format = "png";
  if (!EXPORT_PRESETS.some((p) => p.id === out.exportPresetId)) {
    out.exportPresetId = "readme-banner";
  }
  if (!["none", "grid", "dots", "diagonal", "squares"].includes(out.pattern)) {
    out.pattern = "grid";
  }
  if (!["left", "center", "right"].includes(out.align)) out.align = "left";
  return out as StudioSettings;
};

export const pickStyle = (s: StudioSettings): StudioStyle => ({
  colorA: s.colorA,
  colorB: s.colorB,
  textColor: s.textColor,
  accentColor: s.accentColor,
  angle: s.angle,
  pattern: s.pattern,
  patternOpacity: s.patternOpacity,
  align: s.align,
  titleScale: s.titleScale,
  showOwner: s.showOwner,
  showStats: s.showStats,
});
