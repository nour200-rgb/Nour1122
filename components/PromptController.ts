/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import './WeightKnob';
import type { WeightKnob } from './WeightKnob';

import type { MidiDispatcher } from '../utils/MidiDispatcher';
import type { Prompt, ControlChange } from '../types';

/** A single prompt input associated with a MIDI CC. */
@customElement('prompt-controller')
export class PromptController extends LitElement {
  static override styles = css`
    .prompt {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    weight-knob {
      width: 70%;
      flex-shrink: 0;
    }
    #midi {
      font-family: monospace;
      text-align: center;
      font-size: 1.4vmin;
      border: 1px solid #fff8;
      border-radius: 4px;
      padding: 1px 5px;
      color: #fff;
      background: #0006;
      cursor: pointer;
      visibility: hidden;
      user-select: none;
      margin-top: 1vmin;
      .learn-mode & {
        color: #ffb84d;
        border-color: #ffb84d;
      }
      .show-cc & {
        visibility: visible;
      }
    }
    #text {
      font-weight: 500;
      font-size: 1.8vmin;
      max-width: 17vmin;
      min-width: 2vmin;
      padding: 0.2em 0.5em;
      margin-top: 0.75vmin;
      flex-shrink: 0;
      border-radius: 5px;
      text-align: center;
      white-space: pre;
      overflow: hidden;
      border: none;
      outline: none;
      -webkit-font-smoothing: antialiased;
      background: #ffffff1a;
      color: #fff;
      border: 1px solid #ffffff4d;
      box-shadow: 0 2px 5px #00000033;
      &:not(:focus) {
        text-overflow: ellipsis;
      }
      &:focus {
        background: #ffffff33;
      }
    }
    :host([filtered]) {
      weight-knob { 
        opacity: 0.5;
      }
      #text {
        background: #da2000;
        z-index: 1;
      }
    }
    @media only screen and (max-width: 600px) {
      #text {
        font-size: 2.3vmin;
      }
      weight-knob {
        width: 60%;
      }
    }
  `;

  @property({ type: String }) promptId = '';
  @property({ type: String }) text = '';
  @property({ type: Number }) weight = 0;
  @property({ type: String }) color = '';
  @property({ type: Boolean, reflect: true }) filtered = false;

  @property({ type: Number }) cc = 0;
  @property({ type: Number }) channel = 0; // Not currently used

  @property({ type: Boolean }) learnMode = false;
  @property({ type: Boolean }) showCC = false;

  @query('weight-knob') private weightInput!: WeightKnob;
  @query('#text') private textInput!: HTMLInputElement;

  @property({ type: Object })
  midiDispatcher: MidiDispatcher | null = null;

  @property({ type: Number }) audioLevel = 0;

  private lastValidText!: string;

  override connectedCallback() {
    super.connectedCallback();
    this.midiDispatcher?.addEventListener('cc-message', (e: Event) => {
      const customEvent = e as CustomEvent<ControlChange>;
      const { channel, cc, value } = customEvent.detail;
      if (this.learnMode) {
        this.cc = cc;
        this.channel = channel;
        this.learnMode = false;
        this.dispatchPromptChange();
      } else if (cc === this.cc) {
        this.weight = (value / 127) * 2;
        this.dispatchPromptChange();
      }
    });
  }

  override firstUpdated() {
    // contenteditable is applied to textInput so we can "shrink-wrap" to text width
    // It's set here and not render() because Lit doesn't believe it's a valid attribute.
    // FIX: Cast textInput to any to access setAttribute due to missing DOM types.
    (this.textInput as any).setAttribute('contenteditable', 'plaintext-only');

    // contenteditable will do weird things if this is part of the template.
    // FIX: Cast textInput to any to access textContent due to missing DOM types.
    (this.textInput as any).textContent = this.text;
    this.lastValidText = this.text;
  }

  update(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('showCC') && !this.showCC) {
      this.learnMode = false;
    }
    if (changedProperties.has('text') && this.textInput) {
      // FIX: Cast textInput to any to access textContent due to missing DOM types.
      (this.textInput as any).textContent = this.text;
    }
    super.update(changedProperties);
  }

  private dispatchPromptChange() {
    // FIX: Cast this to any to access dispatchEvent due to missing DOM types.
    (this as any).dispatchEvent(
      new CustomEvent<Prompt>('prompt-changed', {
        detail: {
          promptId: this.promptId,
          text: this.text,
          weight: this.weight,
          cc: this.cc,
          color: this.color,
        },
      }),
    );
  }

  private onKeyDown(e: KeyboardEvent) {
    // FIX: Cast event to any to access key property.
    if ((e as any).key === 'Enter') {
      e.preventDefault();
      // FIX: Cast textInput to any to access blur method due to missing DOM types.
      (this.textInput as any).blur();
    }
    // FIX: Cast event to any to access key property.
    if ((e as any).key === 'Escape') {
      e.preventDefault();
      this.resetText();
      // FIX: Cast textInput to any to access blur method due to missing DOM types.
      (this.textInput as any).blur();
    }
  }

  private resetText() {
    this.text = this.lastValidText;
    // FIX: Cast textInput to any to access textContent due to missing DOM types.
    (this.textInput as any).textContent = this.lastValidText;
  }

  private async updateText() {
    // FIX: Cast textInput to any to access textContent due to missing DOM types.
    const newText = (this.textInput as any).textContent?.trim();
    if (!newText) {
      this.resetText();
    } else {
      this.text = newText;
      this.lastValidText = newText;
    }
    this.dispatchPromptChange();
    // Show the prompt from the beginning if it's cropped
    // FIX: Cast textInput to any to access scrollLeft due to missing DOM types.
    (this.textInput as any).scrollLeft = 0;
  }

  private onFocus() {
    // .select() for contenteditable doesn't work.
    // FIX: Cast window to any to access getSelection due to missing DOM types.
    const selection = (window as any).getSelection();
    if (!selection) return;
    // FIX: Cast document to any to access createRange due to missing DOM types.
    // FIX: Use globalThis to access document as it is not defined in the current scope.
    const range = (globalThis as any).document.createRange();
    range.selectNodeContents(this.textInput);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  private updateWeight() {
    this.weight = this.weightInput.value;
    this.dispatchPromptChange();
  }

  private toggleLearnMode() {
    this.learnMode = !this.learnMode;
  }

  override render() {
    const classes = classMap({
      'prompt': true,
      'learn-mode': this.learnMode,
      'show-cc': this.showCC,
    });
    return html`<div class=${classes}>
      <weight-knob
        id="weight"
        value=${this.weight}
        color=${this.filtered ? '#888' : this.color}
        audioLevel=${this.filtered ? 0 : this.audioLevel}
        @input=${this.updateWeight}></weight-knob>
      <span
        id="text"
        spellcheck="false"
        @focus=${this.onFocus}
        @keydown=${this.onKeyDown}
        @blur=${this.updateText}></span>
      <div id="midi" @click=${this.toggleLearnMode}>
        ${this.learnMode ? 'Learn' : `CC:${this.cc}`}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'prompt-controller': PromptController;
  }
}