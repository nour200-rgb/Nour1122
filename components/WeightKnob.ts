/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

/** Maps prompt weight to halo size. */
const MIN_HALO_SCALE = 1;
const MAX_HALO_SCALE = 2;

/** The amount of scale to add to the halo based on audio level. */
const HALO_LEVEL_MODIFIER = 1;

/** A knob for adjusting and visualizing prompt weight. */
@customElement('weight-knob')
export class WeightKnob extends LitElement {
  static override styles = css`
    :host {
      cursor: grab;
      position: relative;
      width: 100%;
      aspect-ratio: 1;
      flex-shrink: 0;
      touch-action: none;
    }
    svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    .interactive-layer {
      pointer-events: all;
    }
    #halo {
      position: absolute;
      z-index: -1;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      mix-blend-mode: lighten;
      transform: scale(2);
      will-change: transform;
    }
  `;

  @property({ type: Number }) value = 0;
  @property({ type: String }) color = '#000';
  @property({ type: Number }) audioLevel = 0;

  private dragStartPos = 0;
  private dragStartValue = 0;

  constructor() {
    super();
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
  }

  private handlePointerDown(e: PointerEvent) {
    e.preventDefault();
    // FIX: Cast event to `any` to access `clientY` due to missing DOM types.
    this.dragStartPos = (e as any).clientY;
    this.dragStartValue = this.value;
    // FIX: Cast document to `any` to access body due to missing DOM types.
    // FIX: Use globalThis to access document as it is not defined in the current scope.
    (globalThis as any).document.body.classList.add('dragging');
    // FIX: Cast window to `any` to access addEventListener due to missing DOM types.
    (window as any).addEventListener('pointermove', this.handlePointerMove);
    // FIX: Cast window to `any` to access addEventListener due to missing DOM types.
    (window as any).addEventListener('pointerup', this.handlePointerUp);
  }

  private handlePointerMove(e: PointerEvent) {
    // FIX: Cast event to `any` to access `clientY` due to missing DOM types.
    const delta = this.dragStartPos - (e as any).clientY;
    this.value = this.dragStartValue + delta * 0.01;
    this.value = Math.max(0, Math.min(2, this.value));
    // FIX: Cast `this` to `any` to call dispatchEvent due to missing DOM types.
    (this as any).dispatchEvent(new CustomEvent<number>('input', { detail: this.value }));
  }

  private handlePointerUp() {
    // FIX: Cast window to `any` to access removeEventListener due to missing DOM types.
    (window as any).removeEventListener('pointermove', this.handlePointerMove);
    // FIX: Cast window to `any` to access removeEventListener due to missing DOM types.
    (window as any).removeEventListener('pointerup', this.handlePointerUp);
    // FIX: Cast document to `any` to access body due to missing DOM types.
    // FIX: Use globalThis to access document as it is not defined in the current scope.
    (globalThis as any).document.body.classList.remove('dragging');
  }

  private handleWheel(e: WheelEvent) {
    // FIX: Cast event to `any` to access `deltaY` due to missing DOM types.
    const delta = (e as any).deltaY;
    this.value = this.value + delta * -0.0025;
    this.value = Math.max(0, Math.min(2, this.value));
    // FIX: Cast `this` to `any` to call dispatchEvent due to missing DOM types.
    (this as any).dispatchEvent(new CustomEvent<number>('input', { detail: this.value }));
  }

  private describeArc(
    centerX: number,
    centerY: number,
    startAngle: number,
    endAngle: number,
    radius: number,
  ): string {
    const startX = centerX + radius * Math.cos(startAngle);
    const startY = centerY + radius * Math.sin(startAngle);
    const endX = centerX + radius * Math.cos(endAngle);
    const endY = centerY + radius * Math.sin(endAngle);

    const largeArcFlag = endAngle - startAngle <= Math.PI ? '0' : '1';

    return (
      `M ${startX} ${startY}` +
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`
    );
  }

  override render() {
    const rotationRange = Math.PI * 2 * 0.75;
    const minRot = -rotationRange / 2 - Math.PI / 2;
    const maxRot = rotationRange / 2 - Math.PI / 2;
    const rot = minRot + (this.value / 2) * (maxRot - minRot);
    const dotStyle = styleMap({
      transform: `translate(40px, 40px) rotate(${rot}rad)`,
    });

    let scale = (this.value / 2) * (MAX_HALO_SCALE - MIN_HALO_SCALE);
    scale += MIN_HALO_SCALE;
    scale += this.audioLevel * HALO_LEVEL_MODIFIER;

    const haloStyle = styleMap({
      display: this.value > 0 ? 'block' : 'none',
      background: this.color,
      transform: `scale(${scale})`,
    });

    return html`
      <div id="halo" style=${haloStyle}></div>
      <!-- Static SVG elements -->
      ${this.renderStaticSvg()}
      <!-- SVG elements that move, separated to limit redraws -->
      <svg class="interactive-layer"
        viewBox="0 0 80 80"
        @pointerdown=${this.handlePointerDown}
        @wheel=${this.handleWheel}>
        <g style=${dotStyle}>
          <circle cx="14" cy="0" r="2" fill="#000" />
        </g>
        <path
          d=${this.describeArc(40, 40, minRot, maxRot, 34.5)}
          fill="none"
          stroke="#0003"
          stroke-width="3"
          stroke-linecap="round" />
        <path
          d=${this.describeArc(40, 40, minRot, rot, 34.5)}
          fill="none"
          stroke="#fff"
          stroke-width="3"
          stroke-linecap="round" />
      </svg>
    `;
  }
  
  private renderStaticSvg() { 
    return html`<svg viewBox="0 0 80 80">
      <defs>
        <radialGradient id="grad1" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" style="stop-color:#4e4e4e;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1c1c1c;stop-opacity:1" />
        </radialGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
          <feOffset in="blur" dx="2" dy="4" result="offsetBlur" />
          <feFlood flood-color="#000" flood-opacity="0.5" result="offsetColor"/>
          <feComposite in="offsetColor" in2="offsetBlur" operator="in" result="offsetBlur"/>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="40" cy="40" r="40" fill="url(#grad1)" filter="url(#shadow)" />
      <circle cx="40" cy="40" r="32" stroke="#222" stroke-width="1"/>
      <circle cx="40" cy="40" r="31" stroke="#666" stroke-width="1"/>
    </svg>`
  }

}

declare global {
  interface HTMLElementTagNameMap {
    'weight-knob': WeightKnob;
  }
}