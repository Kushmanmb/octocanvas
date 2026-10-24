import { useState } from "preact/hooks";
import { PrimerSelect, TextInput } from "./ui/FormControls";
import { SecondaryButton } from "./ui/Button";
import { REPO_OWNERS, type RepoInfo } from "../utils/repoStudio";
import styles from "./RepoStudio.module.css";

interface RepoPickerProps {
  repos: RepoInfo[];
  loading: boolean;
  error: string;
  selected: RepoInfo | null;
  onSelect: (repo: RepoInfo) => void;
  onReload: () => void;
  onManual: (input: string) => Promise<string | null>;
}

export function RepoPicker({
  repos,
  loading,
  error,
  selected,
  onSelect,
  onReload,
  onManual,
}: RepoPickerProps) {
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState("");
  const [manualBusy, setManualBusy] = useState(false);

  const value = selected ? `${selected.owner}/${selected.name}` : "";

  const submitManual = async (e: Event) => {
    e.preventDefault();
    setManualBusy(true);
    setManualError((await onManual(manual)) ?? "");
    setManualBusy(false);
  };

  return (
    <section className={styles.Group} aria-labelledby="studio-repo-heading">
      <h2 id="studio-repo-heading" className={styles.GroupTitle}>
        Repository
      </h2>

      <PrimerSelect
        id="studio-repo-select"
        label="Public repositories"
        value={value}
        disabled={loading || repos.length === 0}
        onChange={(v) => {
          const repo = repos.find((r) => `${r.owner}/${r.name}` === v);
          if (repo) onSelect(repo);
        }}
      >
        <option value="" disabled>
          {loading ? "Loading repositories..." : "Choose a repository"}
        </option>
        {REPO_OWNERS.map((owner) => {
          const list = repos.filter((r) => r.owner.toLowerCase() === owner.toLowerCase());
          if (!list.length) return null;
          return (
            <optgroup key={owner} label={owner}>
              {list.map((r) => (
                <option key={r.name} value={`${r.owner}/${r.name}`}>
                  {r.name}
                </option>
              ))}
            </optgroup>
          );
        })}
        {selected && !repos.some((r) => r.owner === selected.owner && r.name === selected.name) && (
          <option value={value}>{value}</option>
        )}
      </PrimerSelect>

      {error && (
        <p role="alert" className={styles.Error}>
          {error}{" "}
          <button type="button" className={styles.LinkButton} onClick={onReload}>
            Retry
          </button>
        </p>
      )}

      <form onSubmit={submitManual} className={styles.ManualForm}>
        <TextInput
          id="studio-repo-manual"
          label="Or enter a repository"
          value={manual}
          onChange={setManual}
          placeholder="owner/repo or repo"
          error={!!manualError}
          errorMessage={manualError}
        />
        <SecondaryButton type="submit" disabled={manualBusy || !manual.trim()} fullWidth>
          {manualBusy ? "Loading..." : "Use repository"}
        </SecondaryButton>
      </form>
    </section>
  );
}
