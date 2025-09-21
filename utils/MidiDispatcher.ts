/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import type { ControlChange } from '../types';

/** Simple class for dispatching MIDI CC messages as events. */
export class MidiDispatcher extends EventTarget {
  // FIX: Change MIDIAccess to `any` due to missing Web MIDI API types.
  private access: any | null = null;
  activeMidiInputId: string | null = null;

  async getMidiAccess(): Promise<string[]> {

    if (this.access) {
      return [...this.access.inputs.keys()];
    }

    // FIX: Cast navigator to `any` to access requestMIDIAccess.
    if (!(navigator as any).requestMIDIAccess) {
      throw new Error('Your browser does not support the Web MIDI API. For a list of compatible browsers, see https://caniuse.com/midi');
    }

    // FIX: Cast navigator to `any` to access requestMIDIAccess.
    this.access = await (navigator as any)
      .requestMIDIAccess({ sysex: false })
      .catch((error: any) => error);

    if (this.access === null) {
      throw new Error('Unable to acquire MIDI access.');
    }

    const inputIds = [...this.access.inputs.keys()];

    if (inputIds.length > 0 && this.activeMidiInputId === null) {
      this.activeMidiInputId = inputIds[0];
    }

    for (const input of this.access.inputs.values()) {
      // FIX: Change MIDIMessageEvent to `any` due to missing Web MIDI API types.
      input.onmidimessage = (event: any) => {
        if (input.id !== this.activeMidiInputId) return;

        const { data } = event;
        if (!data) {
          console.error('MIDI message has no data');
          return;
        }

        const statusByte = data[0];
        const channel = statusByte & 0x0f;
        const messageType = statusByte & 0xf0;

        const isControlChange = messageType === 0xb0;
        if (!isControlChange) return;

        const detail: ControlChange = { cc: data[1], value: data[2], channel };
        this.dispatchEvent(
          new CustomEvent<ControlChange>('cc-message', { detail }),
        );
      };
    }

    return inputIds;
  }

  getDeviceName(id: string): string | null {
    if (!this.access) {
      return null;
    }
    const input = this.access.inputs.get(id);
    return input ? input.name : null;
  }
}
