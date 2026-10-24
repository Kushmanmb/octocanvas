import { useState, useEffect, useMemo } from "preact/hooks";
import { RepoPicker } from "./RepoPicker";
import { StudioEditor, type CustomPreset } from "./StudioEditor";
import { ExportPanel } from "./ExportPanel";
import { downloadBlob, svgToPngBlob } from "../utils/imageExport";
import {
  REPO_OWNERS,
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  PRESETS_KEY,
  buildRepoSvg,
  buildFileName,
  getExportPreset,
  parseRepoInput,
  pickStyle,
  sanitizeSettings,
  storageRead,
  storageWrite,
  toRepoInfo,
  type RepoInfo,
  type StudioSettings,
  type StudioStyle,
} from "../utils/repoStudio";
import styles from "./RepoStudio.module.css";

const LAST_REPO_KEY = "octocanvas:repo-studio:last-repo:v1";
const API = "https://api.github.com";

const fetchOwnerRepos = async (owner: string): Promise<RepoInfo[]> => {
  const res = await fetch(
    `${API}/users/${encodeURIComponent(owner)}/repos?per_page=100&sort=updated&type=owner`,
    { headers: { Accept: "application/vnd.github+json" } }
  );
  if (!res.ok) {
    throw new Error(
      res.status === 403 || res.status === 429
        ? "GitHub API rate limit reached."
        : `Could not load repositories for ${owner}.`
    );
  }
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map((r) => toRepoInfo(r, owner));
};

const stubRepo = (owner: string, name: string): RepoInfo => ({
  owner,
  name,
  description: null,
  stars: 0,
  forks: 0,
  language: null,
  defaultBranch: "main",
});

export default function RepoStudio() {
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS);
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const loadRepos = async () => {
    setLoading(true);
    setLoadError("");
    const results = await Promise.allSettled(REPO_OWNERS.map(fetchOwnerRepos));
    const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    const failed = results.find((r) => r.status === "rejected") as
      | PromiseRejectedResult
      | undefined;
    setRepos(all);
    if (failed) {
      setLoadError(
        `${failed.reason?.message ?? "Could not load repositories."} You can still enter a repository manually.`
      );
    }
    setLoading(false);
    return all;
  };

  // Hydrate from localStorage, then load repositories.
  useEffect(() => {
    setSettings(sanitizeSettings(storageRead(SETTINGS_KEY, null)));
    setCustomPresets(storageRead<CustomPreset[]>(PRESETS_KEY, []));
    setHydrated(true);

    const last = storageRead<string>(LAST_REPO_KEY, "");
    loadRepos().then((all) => {
      const parsed = last ? parseRepoInput(last, REPO_OWNERS[0]) : null;
      const match = parsed
        ? all.find(
            (r) =>
              r.owner.toLowerCase() === parsed.owner.toLowerCase() &&
              r.name.toLowerCase() === parsed.name.toLowerCase()
          )
        : undefined;
      setRepo(match ?? (parsed ? stubRepo(parsed.owner, parsed.name) : all[0] ?? null));
    });
  }, []);

  useEffect(() => {
    if (hydrated) storageWrite(SETTINGS_KEY, settings);
  }, [settings, hydrated]);

  useEffect(() => {
    if (hydrated) storageWrite(PRESETS_KEY, customPresets);
  }, [customPresets, hydrated]);

  const selectRepo = (next: RepoInfo) => {
    setRepo(next);
    storageWrite(LAST_REPO_KEY, `${next.owner}/${next.name}`);
    setSettings((s) => ({ ...s, branch: next.defaultBranch || s.branch }));
  };

  const useManual = async (input: string): Promise<string | null> => {
    const parsed = parseRepoInput(input, REPO_OWNERS[0]);
    if (!parsed) return "Enter a name like owner/repo.";
    try {
      const res = await fetch(`${API}/repos/${parsed.owner}/${parsed.name}`);
      if (res.status === 404) return "Repository not found or not public.";
      selectRepo(res.ok ? toRepoInfo(await res.json(), parsed.owner) : stubRepo(parsed.owner, parsed.name));
    } catch {
      selectRepo(stubRepo(parsed.owner, parsed.name));
    }
    return null;
  };

  const patch = (p: Partial<StudioSettings>) => setSettings((s) => ({ ...s, ...p }));

  const applyStyle = (style: StudioStyle) => patch(style);

  const savePreset = (label: string) => {
    const id = `custom-${Date.now()}`;
    setCustomPresets((list) => [...list, { id, label, style: pickStyle(settings) }]);
    setStatus(`Saved preset "${label}".`);
  };

  const deletePreset = (id: string) => {
    setCustomPresets((list) => list.filter((p) => p.id !== id));
    setStatus("Preset deleted.");
  };

  const preset = getExportPreset(settings.exportPresetId);

  const svg = useMemo(
    () => (repo ? buildRepoSvg(repo, settings, preset.width, preset.height) : ""),
    [repo, settings, preset.width, preset.height]
  );

  const download = async () => {
    if (!repo || busy) return;
    setBusy(true);
    setStatus("");
    try {
      const name = buildFileName(repo, preset, settings.format);
      const blob =
        settings.format === "svg"
          ? new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
          : await svgToPngBlob(svg, preset.width, preset.height);
      downloadBlob(blob, name);
      setStatus(`Downloaded ${name}.`);
    } catch (err) {
      setStatus(err instanceof Error ? `Export failed: ${err.message}` : "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`${what} copied to clipboard.`);
    } catch {
      setStatus(`Could not copy automatically. Select the ${what} text and copy it manually.`);
    }
  };

  return (
    <div className={styles.Studio}>
      <div className={styles.AreaPicker}>
        <RepoPicker
          repos={repos}
          loading={loading}
          error={loadError}
          selected={repo}
          onSelect={selectRepo}
          onReload={loadRepos}
          onManual={useManual}
        />
      </div>

      <div className={styles.AreaPreview}>
        <div className={styles.PreviewFrame}>
          <h2 className={styles.GroupTitle}>
            Live preview{repo ? `: ${repo.owner}/${repo.name}` : ""}
          </h2>
          {repo ? (
            <div
              className={styles.Preview}
              data-testid="studio-preview"
              style={{ aspectRatio: `${preset.width} / ${preset.height}` }}
              // SVG is built from escaped text and validated colors in buildRepoSvg.
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <p className={styles.Help}>Select or enter a repository to begin.</p>
          )}
        </div>
        <p role="status" aria-live="polite" className={styles.Status}>
          {status}
        </p>
      </div>

      <div className={styles.AreaControls}>
        <StudioEditor
          settings={settings}
          onChange={patch}
          customPresets={customPresets}
          onApplyStyle={applyStyle}
          onSavePreset={savePreset}
          onDeletePreset={deletePreset}
          onReset={() => setSettings({ ...DEFAULT_SETTINGS, branch: repo?.defaultBranch ?? "main" })}
        />
        {repo && (
          <ExportPanel
            repo={repo}
            settings={settings}
            onChange={patch}
            busy={busy}
            onDownload={download}
            onCopy={copy}
          />
        )}
      </div>
    </div>
  );
}
