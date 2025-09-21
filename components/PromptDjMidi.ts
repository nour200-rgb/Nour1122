/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import { throttle } from '../utils/throttle';

import './PromptController';
import './PlayPauseButton';
import type { PlaybackState, Prompt } from '../types';
import { MidiDispatcher } from '../utils/MidiDispatcher';

/** The grid of prompt inputs. */
@customElement('prompt-dj-midi')
export class PromptDjMidi extends LitElement {
  static override styles = css`
    :host {
      height: 100%;
      width: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      box-sizing: border-box;
      position: relative;
      color: #fff;
      --glass-bg: #ffffff1a;
      --glass-border: 1px solid #ffffff4d;
      --glass-shadow: 0 4px 30px #0000001a;
      --glass-blur: backdrop-filter: blur(5px);
    }
    #background {
      will-change: background-image;
      position: absolute;
      height: 100%;
      width: 100%;
      z-index: -1;
      background: #1a1a1a;
    }
    #main-panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3vmin;
      padding: 3vmin;
      border-radius: 20px;
      background: var(--glass-bg);
      border: var(--glass-border);
      box-shadow: var(--glass-shadow);
      -webkit-backdrop-filter: var(--glass-blur);
      backdrop-filter: var(--glass-blur);
    }
    #grid {
      width: 80vmin;
      height: 80vmin;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2.5vmin;
    }
    prompt-controller {
      width: 100%;
    }
    play-pause-button {
      width: 15vmin;
    }
    #header {
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      width: 95%;
      max-width: 900px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 20px;
      border-radius: 15px;
      background: var(--glass-bg);
      border: var(--glass-border);
      box-shadow: var(--glass-shadow);
      -webkit-backdrop-filter: var(--glass-blur);
      backdrop-filter: var(--glass-blur);
    }
    #midi-controls, #preset-controls {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    button, select {
      font-family: 'Poppins', sans-serif;
      font-weight: 500;
      cursor: pointer;
      color: #fff;
      background: #ffffff26;
      border: 1px solid #ffffff73;
      -webkit-font-smoothing: antialiased;
      border-radius: 8px;
      user-select: none;
      padding: 6px 12px;
      transition: background 0.2s, color 0.2s;
      outline: none;
      
      &:hover {
        background: #ffffff4d;
      }
      &.active {
        background-color: #fff;
        color: #000;
      }
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background: #ffffff1a;
      }
    }
    select {
      -webkit-appearance: none;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='white' class='bi bi-chevron-down' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 10px center;
      padding-right: 30px;
    }
    .icon-button {
      padding: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon-button svg {
      width: 18px;
      height: 18px;
      fill: #fff;
    }
    .icon-button:disabled svg {
      fill: #fffa;
    }
  `;

  private readonly PRESETS_STORAGE_KEY = 'prompt-dj-presets-v2';
  @state() private presets: Map<string, Map<string, Prompt>> = new Map();
  @state() private activePresetName = '';
  private readonly defaultPresets: Map<string, Map<string, Prompt>>;

  private prompts: Map<string, Prompt>;
  private midiDispatcher: MidiDispatcher;

  @property({ type: Boolean }) private showMidi = false;
  @property({ type: String }) public playbackState: PlaybackState = 'stopped';
  @state() public audioLevel = 0;
  @state() private midiInputIds: string[] = [];
  @state() private activeMidiInputId: string | null = null;

  @property({ type: Object })
  private filteredPrompts = new Set<string>();

  constructor(
    defaultPresets: Map<string, Map<string, Prompt>>,
  ) {
    super();
    this.defaultPresets = defaultPresets;
    this.activePresetName = this.defaultPresets.keys().next().value;
    this.prompts = new Map(this.defaultPresets.get(this.activePresetName)!);
    this.midiDispatcher = new MidiDispatcher();
  }

  override connectedCallback() {
    super.connectedCallback();
    this.loadPresets();
  }

  private serializePresets(presets: Map<string, Map<string, Prompt>>): string {
    const obj: Record<string, Array<[string, Prompt]>> = {};
    for (const [name, promptMap] of presets.entries()) {
      obj[name] = Array.from(promptMap.entries());
    }
    return JSON.stringify(obj);
  }

  private deserializePresets(jsonString: string): Map<string, Map<string, Prompt>> {
    const obj: Record<string, Array<[string, Prompt]>> = JSON.parse(jsonString);
    const presets = new Map<string, Map<string, Prompt>>();
    for (const name in obj) {
      if (Object.hasOwn(obj, name)) {
        presets.set(name, new Map(obj[name]));
      }
    }
    return presets;
  }

  private savePresetsToStorage() {
    const userPresets = new Map<string, Map<string, Prompt>>();
    for (const [name, presetMap] of this.presets.entries()) {
      if (!this.defaultPresets.has(name)) {
        userPresets.set(name, presetMap);
      }
    }
    localStorage.setItem(this.PRESETS_STORAGE_KEY, this.serializePresets(userPresets));
    this.requestUpdate();
  }

  private loadPresets() {
    const storedPresets = localStorage.getItem(this.PRESETS_STORAGE_KEY);
    const userPresets = storedPresets ? this.deserializePresets(storedPresets) : new Map();
    this.presets = new Map([...this.defaultPresets, ...userPresets]);
    this.loadActivePreset();
  }

  private loadActivePreset() {
    const presetPrompts = this.presets.get(this.activePresetName);
    if (presetPrompts) {
      this.prompts = new Map(presetPrompts);
      // FIX: Cast `this` to `any` to call dispatchEvent due to missing DOM types.
      (this as any).dispatchEvent(
        new CustomEvent('prompts-changed', { detail: this.prompts }),
      );
      this.requestUpdate();
    }
  }

  private handlePresetChange(e: Event) {
    // FIX: Cast `e.target` to `any` to access value property.
    this.activePresetName = (e.target as any).value;
    this.loadActivePreset();
  }
  
  private saveCurrentPreset() {
    // FIX: Cast `window` to `any` to call prompt due to missing DOM types.
    let name = (window as any).prompt('Save preset as:');
    if (!name) return;
    name = name.trim();
    if (!name) return;

    if (this.defaultPresets.has(name)) {
      // FIX: Cast `window` to `any` to call alert due to missing DOM types.
      (window as any).alert(`Cannot overwrite default preset "${name}". Please choose a different name.`);
      return;
    }

    if (this.presets.has(name) && !this.defaultPresets.has(name)) {
      // FIX: Cast `window` to `any` to call confirm due to missing DOM types.
      if (!(window as any).confirm(`Preset "${name}" already exists. Overwrite?`)) {
        return;
      }
    }
    
    this.presets.set(name, new Map(this.prompts));
    this.activePresetName = name;
    this.savePresetsToStorage();
  }

  private deleteCurrentPreset() {
    if (this.defaultPresets.has(this.activePresetName)) {
      // FIX: Cast `window` to `any` to call alert due to missing DOM types.
      (window as any).alert('Cannot delete a default preset.');
      return;
    }

    // FIX: Cast `window` to `any` to call confirm due to missing DOM types.
    if ((window as any).confirm(`Are you sure you want to delete the "${this.activePresetName}" preset?`)) {
      this.presets.delete(this.activePresetName);
      this.activePresetName = this.defaultPresets.keys().next().value;
      this.loadActivePreset();
      this.savePresetsToStorage();
    }
  }

  private handlePromptChanged(e: CustomEvent<Prompt>) {
    const { promptId, text, weight, cc } = e.detail;
    const prompt = this.prompts.get(promptId);

    if (!prompt) {
      console.error('prompt not found', promptId);
      return;
    }

    prompt.text = text;
    prompt.weight = weight;
    prompt.cc = cc;

    const newPrompts = new Map(this.prompts);
    newPrompts.set(promptId, prompt);

    this.prompts = newPrompts;
    this.requestUpdate();

    // FIX: Cast `this` to `any` to call dispatchEvent due to missing DOM types.
    (this as any).dispatchEvent(
      new CustomEvent('prompts-changed', { detail: this.prompts }),
    );
  }

  /** Generates radial gradients for each prompt based on weight and color. */
  private readonly makeBackground = throttle(
    () => {
      const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

      const MAX_WEIGHT = 0.5;
      const MAX_ALPHA = 0.6;

      const bg: string[] = [];

      [...this.prompts.values()].forEach((p, i) => {
        const alphaPct = clamp01(p.weight / MAX_WEIGHT) * MAX_ALPHA;
        const alpha = Math.round(alphaPct * 0xff)
          .toString(16)
          .padStart(2, '0');

        const stop = p.weight / 2;
        const x = (i % 4) / 3;
        const y = Math.floor(i / 4) / 3;
        const s = `radial-gradient(circle at ${x * 100}% ${y * 100}%, ${p.color}${alpha} 0px, ${p.color}00 ${stop * 100}%)`;

        bg.push(s);
      });

      return bg.join(', ');
    },
    30, // don't re-render more than once every XXms
  );

  private toggleShowMidi() {
    return this.setShowMidi(!this.showMidi);
  }

  public async setShowMidi(show: boolean) {
    this.showMidi = show;
    if (!this.showMidi) return;
    try {
      const inputIds = await this.midiDispatcher.getMidiAccess();
      this.midiInputIds = inputIds;
      this.activeMidiInputId = this.midiDispatcher.activeMidiInputId;
    } catch (e) {
      this.showMidi = false;
      // FIX: Cast `this` to `any` to call dispatchEvent due to missing DOM types.
      (this as any).dispatchEvent(new CustomEvent('error', {detail: (e as any).message}));
    }
  }

  private handleMidiInputChange(event: Event) {
    // FIX: Cast `event.target` to `any` to handle missing DOM types.
    const selectElement = event.target as any;
    const newMidiId = selectElement.value;
    this.activeMidiInputId = newMidiId;
    this.midiDispatcher.activeMidiInputId = newMidiId;
  }

  private playPause() {
    // FIX: Cast `this` to `any` to call dispatchEvent due to missing DOM types.
    (this as any).dispatchEvent(new CustomEvent('play-pause'));
  }

  public addFilteredPrompt(prompt: string) {
    this.filteredPrompts = new Set([...this.filteredPrompts, prompt]);
  }

  override render() {
    const bg = styleMap({
      backgroundImage: this.makeBackground(),
    });

    const saveIcon = svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v4.5h2a.5.5 0 0 1 .354.854l-2.5 2.5a.5.5 0 0 1-.708 0l-2.5-2.5A.5.5 0 0 1 5.5 6.5h2V2a2 2 0 0 1 2-2H14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h2.5a.5.5 0 0 1 0 1z"/></svg>`;
    const deleteIcon = svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/></svg>`;

    return html`
      <div id="background" style=${bg}></div>
      <header id="header">
        <div id="preset-controls">
          <select @change=${this.handlePresetChange} .value=${this.activePresetName}>
            ${[...this.presets.keys()].map(
              (name) => html`<option .value=${name}>${name}</option>`
            )}
          </select>
          <button class="icon-button" @click=${this.saveCurrentPreset} title="Save As...">${saveIcon}</button>
          <button class="icon-button" @click=${this.deleteCurrentPreset} ?disabled=${this.defaultPresets.has(this.activePresetName)} title="Delete Preset">${deleteIcon}</button>
        </div>
        <div id="midi-controls">
          <button
            @click=${this.toggleShowMidi}
            class=${this.showMidi ? 'active' : ''}
            >MIDI</button
          >
          <select
            @change=${this.handleMidiInputChange}
            .value=${this.activeMidiInputId || ''}
            style=${this.showMidi ? '' : 'visibility: hidden'}>
            ${this.midiInputIds.length > 0
              ? this.midiInputIds.map(
                  (id) =>
                    html`<option value=${id}>
                      ${this.midiDispatcher.getDeviceName(id)}
                    </option>`,
                )
              : html`<option value="">No devices found</option>`}
          </select>
        </div>
      </header>
      <main id="main-panel">
        <div id="grid">${this.renderPrompts()}</div>
        <play-pause-button .playbackState=${this.playbackState} @click=${this.playPause}></play-pause-button>
      </main>
      `;
  }

  private renderPrompts() {
    return [...this.prompts.values()].map((prompt) => {
      return html`<prompt-controller
        promptId=${prompt.promptId}
        ?filtered=${this.filteredPrompts.has(prompt.text)}
        cc=${prompt.cc}
        text=${prompt.text}
        weight=${prompt.weight}
        color=${prompt.color}
        .midiDispatcher=${this.midiDispatcher}
        .showCC=${this.showMidi}
        audioLevel=${this.audioLevel}
        @prompt-changed=${this.handlePromptChanged}>
      </prompt-controller>`;
    });
  }
}