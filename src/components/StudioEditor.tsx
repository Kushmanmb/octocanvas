import { useState } from "preact/hooks";
import { PrimerSelect, TextInput, Checkbox } from "./ui/FormControls";
import { PrimaryButton, SecondaryButton } from "./ui/Button";
import {
  BUILT_IN_PRESETS,
  type StudioSettings,
  type StudioStyle,
  type PatternId,
  type AlignId,
} from "../utils/repoStudio";
import styles from "./RepoStudio.module.css";

export interface CustomPreset {
  id: string;
  label: string;
  style: StudioStyle;
}

interface ColorFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColorField({ id, label, value, onChange }: ColorFieldProps) {
  return (
    <div className={styles.ColorField}>
      <label htmlFor={id} className={styles.FieldLabel}>
        {label}
      </label>
      <input
        id={id}
        type="color"
        className={styles.ColorInput}
        value={value}
        onInput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
      />
    </div>
  );
}

interface RangeFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

export function RangeField({ id, label, value, min, max, step = 1, unit = "", onChange }: RangeFieldProps) {
  return (
    <div>
      <label htmlFor={id} className={styles.FieldLabel}>
        {label}: <output htmlFor={id}>{value}{unit}</output>
      </label>
      <input
        id={id}
        type="range"
        className={styles.Range}
        min={min}
        max={max}
        step={step}
        value={value}
        onInput={(e) => onChange(Number((e.currentTarget as HTMLInputElement).value))}
      />
    </div>
  );
}

interface StudioEditorProps {
  settings: StudioSettings;
  onChange: (patch: Partial<StudioSettings>) => void;
  customPresets: CustomPreset[];
  onApplyStyle: (style: StudioStyle) => void;
  onSavePreset: (label: string) => void;
  onDeletePreset: (id: string) => void;
  onReset: () => void;
}

export function StudioEditor({
  settings,
  onChange,
  customPresets,
  onApplyStyle,
  onSavePreset,
  onDeletePreset,
  onReset,
}: StudioEditorProps) {
  const [presetName, setPresetName] = useState("");
  const [presetChoice, setPresetChoice] = useState("");

  const applyChoice = (id: string) => {
    setPresetChoice(id);
    const found = [...BUILT_IN_PRESETS, ...customPresets].find((p) => p.id === id);
    if (found) onApplyStyle(found.style);
  };

  const isCustomChoice = customPresets.some((p) => p.id === presetChoice);

  return (
    <>
      <section className={styles.Group} aria-labelledby="studio-text-heading">
        <h2 id="studio-text-heading" className={styles.GroupTitle}>
          Text
        </h2>
        <TextInput
          id="studio-title"
          label="Title"
          value={settings.title}
          onChange={(title) => onChange({ title })}
          placeholder="Defaults to repository name"
        />
        <TextInput
          id="studio-subtitle"
          label="Subtitle"
          value={settings.subtitle}
          onChange={(subtitle) => onChange({ subtitle })}
          placeholder="Defaults to repository description"
        />
        <PrimerSelect
          id="studio-align"
          label="Alignment"
          value={settings.align}
          onChange={(v) => onChange({ align: v as AlignId })}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </PrimerSelect>
        <RangeField
          id="studio-title-scale"
          label="Title size"
          value={settings.titleScale}
          min={50}
          max={150}
          step={5}
          unit="%"
          onChange={(titleScale) => onChange({ titleScale })}
        />
        <div className={styles.CheckRow}>
          <Checkbox
            id="studio-show-owner"
            label="Owner"
            checked={settings.showOwner}
            onChange={(showOwner) => onChange({ showOwner })}
          />
          <Checkbox
            id="studio-show-stats"
            label="Stats"
            checked={settings.showStats}
            onChange={(showStats) => onChange({ showStats })}
          />
        </div>
      </section>

      <section className={styles.Group} aria-labelledby="studio-style-heading">
        <h2 id="studio-style-heading" className={styles.GroupTitle}>
          Background
        </h2>
        <div className={styles.ColorGrid}>
          <ColorField id="studio-color-a" label="Start" value={settings.colorA} onChange={(colorA) => onChange({ colorA })} />
          <ColorField id="studio-color-b" label="End" value={settings.colorB} onChange={(colorB) => onChange({ colorB })} />
          <ColorField id="studio-color-text" label="Text" value={settings.textColor} onChange={(textColor) => onChange({ textColor })} />
          <ColorField id="studio-color-accent" label="Accent" value={settings.accentColor} onChange={(accentColor) => onChange({ accentColor })} />
        </div>
        <RangeField
          id="studio-angle"
          label="Gradient angle"
          value={settings.angle}
          min={0}
          max={360}
          step={5}
          unit="°"
          onChange={(angle) => onChange({ angle })}
        />
        <PrimerSelect
          id="studio-pattern"
          label="Pattern"
          value={settings.pattern}
          onChange={(v) => onChange({ pattern: v as PatternId })}
        >
          <option value="none">None</option>
          <option value="grid">Grid</option>
          <option value="dots">Dots</option>
          <option value="diagonal">Diagonal stripes</option>
          <option value="squares">Contribution squares</option>
        </PrimerSelect>
        <RangeField
          id="studio-pattern-opacity"
          label="Pattern strength"
          value={Math.round(settings.patternOpacity * 100)}
          min={0}
          max={100}
          step={1}
          unit="%"
          onChange={(v) => onChange({ patternOpacity: v / 100 })}
        />
      </section>

      <section className={styles.Group} aria-labelledby="studio-presets-heading">
        <h2 id="studio-presets-heading" className={styles.GroupTitle}>
          Style presets
        </h2>
        <PrimerSelect
          id="studio-preset-select"
          label="Apply a preset"
          value={presetChoice}
          onChange={applyChoice}
        >
          <option value="" disabled>
            Choose a preset
          </option>
          <optgroup label="Built-in">
            {BUILT_IN_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </optgroup>
          {customPresets.length > 0 && (
            <optgroup label="My presets">
              {customPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          )}
        </PrimerSelect>
        {isCustomChoice && (
          <SecondaryButton
            onClick={() => {
              onDeletePreset(presetChoice);
              setPresetChoice("");
            }}
            fullWidth
          >
            Delete selected preset
          </SecondaryButton>
        )}
        <TextInput
          id="studio-preset-name"
          label="Save current style as"
          value={presetName}
          onChange={setPresetName}
          placeholder="Preset name"
        />
        <PrimaryButton
          disabled={!presetName.trim()}
          onClick={() => {
            onSavePreset(presetName.trim());
            setPresetName("");
          }}
          fullWidth
        >
          Save preset
        </PrimaryButton>
        <SecondaryButton onClick={onReset} fullWidth>
          Reset editor
        </SecondaryButton>
      </section>
    </>
  );
}
