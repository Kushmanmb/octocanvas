import { useState } from "preact/hooks";
import { PrimerSelect, TextInput } from "./ui/FormControls";
import { PrimaryButton, SecondaryButton } from "./ui/Button";
import {
  EXPORT_PRESETS,
  getExportPreset,
  buildFileName,
  buildEmbedSnippets,
  type RepoInfo,
  type StudioSettings,
} from "../utils/repoStudio";
import styles from "./RepoStudio.module.css";

interface CodeBlockProps {
  id: string;
  label: string;
  code: string;
  onCopy: (text: string, what: string) => void;
}

function CodeBlock({ id, label, code, onCopy }: CodeBlockProps) {
  return (
    <div>
      <label htmlFor={id} className={styles.FieldLabel}>
        {label}
      </label>
      <textarea
        id={id}
        className={styles.Code}
        readOnly
        rows={code.split("\n").length > 1 ? 4 : 3}
        value={code}
        onFocus={(e) => (e.currentTarget as HTMLTextAreaElement).select()}
      />
      <SecondaryButton onClick={() => onCopy(code, label)} fullWidth>
        Copy {label}
      </SecondaryButton>
    </div>
  );
}

interface ExportPanelProps {
  repo: RepoInfo;
  settings: StudioSettings;
  onChange: (patch: Partial<StudioSettings>) => void;
  busy: boolean;
  onDownload: () => void;
  onCopy: (text: string, what: string) => void;
}

export function ExportPanel({ repo, settings, onChange, busy, onDownload, onCopy }: ExportPanelProps) {
  const [showEmbed, setShowEmbed] = useState(true);
  const preset = getExportPreset(settings.exportPresetId);
  const fileName = buildFileName(repo, preset, settings.format);
  const snippets = buildEmbedSnippets(repo, settings, fileName);
  const isBanner = preset.id === "readme-banner";

  return (
    <section className={styles.Group} aria-labelledby="studio-export-heading">
      <h2 id="studio-export-heading" className={styles.GroupTitle}>
        Export
      </h2>

      <fieldset className={styles.Fieldset}>
        <legend className={styles.FieldLabel}>Size preset</legend>
        <div className={styles.PresetGrid}>
          {EXPORT_PRESETS.map((p) => (
            <label
              key={p.id}
              className={`${styles.PresetOption} ${
                p.id === preset.id ? styles.PresetOptionActive : ""
              }`}
            >
              <input
                type="radio"
                name="studio-export-preset"
                className={styles.VisuallyHidden}
                checked={p.id === preset.id}
                onChange={() => onChange({ exportPresetId: p.id })}
              />
              <span className={styles.PresetName}>{p.label}</span>
              <span className={styles.PresetSize}>
                {p.width} × {p.height}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <PrimerSelect
        id="studio-format"
        label="Format"
        value={settings.format}
        onChange={(v) => onChange({ format: v === "svg" ? "svg" : "png" })}
      >
        <option value="png">PNG</option>
        <option value="svg">SVG</option>
      </PrimerSelect>

      <PrimaryButton onClick={onDownload} disabled={busy} ariaBusy={busy} fullWidth size="large">
        {busy ? "Preparing..." : `Download ${fileName}`}
      </PrimaryButton>

      <p className={styles.Help}>
        {preset.hint}. GitHub does not allow changing a repository page&apos;s
        native background; use these images in your README, social preview, or
        GitHub Pages site.
      </p>

      <button
        type="button"
        className={styles.LinkButton}
        aria-expanded={showEmbed}
        aria-controls="studio-embed"
        onClick={() => setShowEmbed(!showEmbed)}
      >
        {showEmbed ? "Hide" : "Show"} embed code
      </button>

      {showEmbed && (
        <div id="studio-embed" className={styles.Embed}>
          <div className={styles.TwoCol}>
            <TextInput
              id="studio-branch"
              label="Branch"
              value={settings.branch}
              onChange={(branch) => onChange({ branch })}
            />
            <TextInput
              id="studio-folder"
              label="Folder"
              value={settings.folder}
              onChange={(folder) => onChange({ folder })}
            />
          </div>
          <p className={styles.Help}>
            Commit <code>{fileName}</code> to <code>{snippets.path}</code>.
          </p>
          {preset.id === "social-preview" ? (
            <p className={styles.Help}>
              Upload this image under Settings &gt; General &gt; Social preview
              in your repository. No Markdown is needed.
            </p>
          ) : (
            <>
              <CodeBlock id="studio-md" label="Markdown" code={snippets.markdown} onCopy={onCopy} />
              {isBanner && (
                <CodeBlock id="studio-html" label="HTML" code={snippets.html} onCopy={onCopy} />
              )}
              <CodeBlock
                id="studio-pages"
                label="GitHub Pages Markdown"
                code={snippets.pagesMarkdown}
                onCopy={onCopy}
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}
