/**
 * @fileoverview Control real time music with a MIDI controller
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PlaybackState, Prompt } from './types';
import { GoogleGenAI } from '@google/genai';
import { PromptDjMidi } from './components/PromptDjMidi';
import { ToastMessage } from './components/ToastMessage';
import { LiveMusicHelper } from './utils/LiveMusicHelper';
import { AudioAnalyser } from './utils/AudioAnalyser';

// FIX: Initialize with `process.env.API_KEY` and remove `apiVersion` as per Gemini API guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'lyria-realtime-exp';

function main() {
  const initialPresets = buildInitialPresets();

  const pdjMidi = new PromptDjMidi(initialPresets);
  // FIX: Cast to `any` to fix missing DOM types error.
  // FIX: Use globalThis to access document, as it is not available in the current scope.
  (globalThis as any).document.body.appendChild(pdjMidi);

  const toastMessage = new ToastMessage();
  // FIX: Cast to `any` to fix missing DOM types error.
  // FIX: Use globalThis to access document, as it is not available in the current scope.
  (globalThis as any).document.body.appendChild(toastMessage);

  const liveMusicHelper = new LiveMusicHelper(ai, model);
  liveMusicHelper.setWeightedPrompts(initialPresets.get('Ambient Dreams')!);

  const audioAnalyser = new AudioAnalyser(liveMusicHelper.audioContext);
  liveMusicHelper.extraDestination = audioAnalyser.node;

  // FIX: Cast to `any` to fix missing `addEventListener` property due to lack of DOM types.
  (pdjMidi as any).addEventListener('prompts-changed', ((e: Event) => {
    const customEvent = e as CustomEvent<Map<string, Prompt>>;
    const prompts = customEvent.detail;
    liveMusicHelper.setWeightedPrompts(prompts);
  }));

  // FIX: Cast to `any` to fix missing `addEventListener` property due to lack of DOM types.
  (pdjMidi as any).addEventListener('play-pause', () => {
    liveMusicHelper.playPause();
  });

  liveMusicHelper.addEventListener('playback-state-changed', ((e: Event) => {
    const customEvent = e as CustomEvent<PlaybackState>;
    const playbackState = customEvent.detail;
    pdjMidi.playbackState = playbackState;
    playbackState === 'playing' ? audioAnalyser.start() : audioAnalyser.stop();
  }));

  liveMusicHelper.addEventListener('filtered-prompt', ((e: Event) => {
    const customEvent = e as CustomEvent<any>;
    const filteredPrompt = customEvent.detail;
    toastMessage.show(filteredPrompt.filteredReason!)
    pdjMidi.addFilteredPrompt(filteredPrompt.text!);
  }));

  const errorToast = ((e: Event) => {
    const customEvent = e as CustomEvent<string>;
    const error = customEvent.detail;
    toastMessage.show(error);
  });

  liveMusicHelper.addEventListener('error', errorToast);
  // FIX: Cast to `any` to fix missing `addEventListener` property due to lack of DOM types.
  (pdjMidi as any).addEventListener('error', errorToast);

  audioAnalyser.addEventListener('audio-level-changed', ((e: Event) => {
    const customEvent = e as CustomEvent<number>;
    const level = customEvent.detail;
    pdjMidi.audioLevel = level;
  }));

}

function buildInitialPresets() {
  const presets = new Map<string, Map<string, Prompt>>();
  for (const [name, prompts] of Object.entries(DEFAULT_PRESETS)) {
    const promptMap = new Map<string, Prompt>();
    for (let i = 0; i < prompts.length; i++) {
      const promptId = `prompt-${i}`;
      const prompt = prompts[i];
      const { text, color, weight } = prompt;
      promptMap.set(promptId, {
        promptId,
        text,
        weight: weight ?? 0,
        cc: i,
        color,
      });
    }
    presets.set(name, promptMap);
  }
  return presets;
}

const DEFAULT_PRESETS = {
  'Ambient Dreams': [
    { color: '#3dffab', text: 'Lush Strings', weight: 1 },
    { color: '#d8ff3e', text: 'Sparkling Arpeggios', weight: 1 },
    { color: '#9900ff', text: 'Warm Pads' },
    { color: '#5200ff', text: 'Ethereal Vocals' },
    { color: '#ff25f6', text: 'Deep Bass Drone' },
    { color: '#2af6de', text: 'Gentle Piano Melody' },
    { color: '#ffdd28', text: 'Slow Attack Cello' },
    { color: '#d9b2ff', text: 'Glassy FM Synthesis' },
    { color: '#9900ff', text: 'Chimes' },
    { color: '#3dffab', text: 'Reverb Washed Guitar' },
    { color: '#d8ff3e', text: 'Subtle White Noise' },
    { color: '#ff25f6', text: 'Harp Glissandos' },
    { color: '#5200ff', text: 'Sine Wave Bass' },
    { color: '#2af6de', text: 'Kalimba' },
    { color: '#ffdd28', text: 'Ominous Choir' },
    { color: '#d9b2ff', text: 'Rainstick' },
  ],
  'Synthwave Drive': [
    { color: '#ff25f6', text: 'Gated Reverb Drums', weight: 1 },
    { color: '#2af6de', text: 'Driving Bassline', weight: 1 },
    { color: '#ffdd28', text: 'Sawtooth Lead Synth', weight: 0.5 },
    { color: '#9900ff', text: 'Analog Brass Stabs' },
    { color: '#5200ff', text: '80s Movie Score' },
    { color: '#3dffab', text: 'Retro Electric Guitar' },
    { color: '#d8ff3e', text: 'FM Bells' },
    { color: '#d9b2ff', text: 'Sequenced Arpeggio' },
    { color: '#ff25f6', text: 'LinnDrum Machine' },
    { color: '#2af6de', text: 'Vocoder' },
    { color: '#ffdd28', text: 'Neon Pad' },
    { color: '#9900ff', text: 'Power Drums' },
    { color: '#5200ff', text: 'Cyberpunk Atmosphere' },
    { color: '#3dffab', text: 'Synth Flute' },
    { color: '#d8ff3e', text: 'Dark Synth Drone' },
    { color: '#d9b2ff', text: 'Laser Sounds' },
  ],
  'Lo-Fi Beats': [
    { color: '#d8ff3e', text: 'Jazzy Electric Piano', weight: 1 },
    { color: '#ffdd28', text: 'Vinyl Crackle', weight: 0.8 },
    { color: '#3dffab', text: 'Boom Bap Drums', weight: 1 },
    { color: '#9900ff', text: 'Mellow Trumpet' },
    { color: '#5200ff', text: 'Upright Bass' },
    { color: '#ff25f6', text: 'MPC Sampled Vocals' },
    { color: '#2af6de', text: 'Relaxing Guitar Lick' },
    { color: '#d9b2ff', text: 'Tape Hiss' },
    { color: '#d8ff3e', text: 'Wobbly Synth Pad' },
    { color: '#ffdd28', text: 'Organ' },
    { color: '#3dffab', text: 'Finger Snaps' },
    { color: '#9900ff', text: 'Saxophone Riff' },
    { color: '#5200ff', text: 'Sub Bass' },
    { color: '#ff25f6', text: 'Flute Melody' },
    { color: '#2af6de', text: 'Gameboy Sounds' },
    { color: '#d9b2ff', text: 'Muffled Kick Drum' },
  ],
};


main();