/**
 * Decodes a base64 string into a Uint8Array.
 * @param base64 The base64 encoded string.
 * @returns A Uint8Array of the decoded data.
 */
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM audio data into an AudioBuffer.
 * @param data The raw audio data as a Uint8Array.
 * @param ctx The AudioContext to use for creating the buffer.
 * @param sampleRate The sample rate of the audio.
 * @param numChannels The number of audio channels.
 * @returns A promise that resolves to an AudioBuffer.
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  // The data from the API is 16-bit PCM, so we need to interpret the Uint8Array as Int16Array
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Mixes multiple 16-bit PCM audio tracks into a single track.
 * @param tracks An array of Uint8Arrays, each representing a raw PCM audio track.
 * @returns A new Uint8Array with the mixed audio data.
 */
export function mixAudio(tracks: Uint8Array[]): Uint8Array {
  if (tracks.length === 0) return new Uint8Array(0);
  if (tracks.length === 1) return tracks[0];

  const int16Tracks = tracks.map(t => new Int16Array(t.buffer, t.byteOffset, t.byteLength / 2));

  const maxLength = Math.max(...int16Tracks.map(t => t.length));
  const mixedInt16 = new Int16Array(maxLength);

  for (let i = 0; i < maxLength; i++) {
    let sampleSum = 0;
    for (const track of int16Tracks) {
      if (i < track.length) {
        sampleSum += track[i];
      }
    }
    // Clamp the sum to the 16-bit integer range to prevent clipping
    mixedInt16[i] = Math.max(-32768, Math.min(32767, sampleSum));
  }

  return new Uint8Array(mixedInt16.buffer);
}


function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Creates a WAV file Blob from raw PCM audio data.
 * @param pcmData The raw PCM data.
 * @param sampleRate The sample rate of the audio.
 * @param numChannels The number of channels.
 * @param bitsPerSample The number of bits per sample (e.g., 16).
 * @returns A Blob representing the WAV file.
 */
export function createWavBlob(
  pcmData: Uint8Array,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number
): Blob {
  const dataSize = pcmData.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // chunkSize
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // subchunk1Size
  view.setUint16(20, 1, true); // audioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM data from the source Uint8Array
  for (let i = 0; i < dataSize; i++) {
    view.setUint8(44 + i, pcmData[i]);
  }
  
  return new Blob([view], { type: 'audio/wav' });
}