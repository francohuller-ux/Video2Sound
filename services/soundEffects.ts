export interface SoundEffect {
  id: string;
  name: string;
  base64: string;
  description: string;
}

// --- Audio Generation Utilities ---

const SAMPLE_RATE = 24000;
const DURATION_SECONDS = 2;

/**
 * Encodes a Uint8Array into a base64 string.
 * @param bytes The Uint8Array to encode.
 * @returns A base64 encoded string.
 */
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Generates raw PCM data for a sine wave tone.
 * @param frequency The frequency of the tone in Hz.
 * @param volume The volume (amplitude), from 0.0 to 1.0.
 * @returns A Uint8Array of the raw PCM data.
 */
function generateTone(frequency: number, volume: number): Uint8Array {
  const frameCount = SAMPLE_RATE * DURATION_SECONDS;
  const buffer = new Int16Array(frameCount);

  for (let i = 0; i < frameCount; i++) {
    // Math.sin generates values between -1 and 1. We multiply by volume and then scale to 16-bit integer range.
    const value = Math.sin((i / SAMPLE_RATE) * frequency * 2 * Math.PI) * volume;
    buffer[i] = value * 32767;
  }

  return new Uint8Array(buffer.buffer);
}

/**
 * Generates raw PCM data for white noise.
 * @param volume The volume (amplitude), from 0.0 to 1.0.
 * @returns A Uint8Array of the raw PCM data.
 */
function generateNoise(volume: number): Uint8Array {
    const frameCount = SAMPLE_RATE * DURATION_SECONDS;
    const buffer = new Int16Array(frameCount);

    for (let i = 0; i < frameCount; i++) {
        // Generate a random number between -1 and 1, apply volume, and scale to 16-bit.
        const value = (Math.random() * 2 - 1) * volume;
        buffer[i] = value * 32767;
    }
    return new Uint8Array(buffer.buffer);
}


// --- Sound Effect Library ---

export const soundEffects: SoundEffect[] = [
  {
    id: 'beep',
    name: 'Beep',
    base64: encode(generateTone(880, 0.3)),
    description: 'A sharp, high-pitched electronic beep. Good for alerts, sci-fi interfaces, or comical moments.',
  },
  {
    id: 'rumble',
    name: 'Rumble',
    base64: encode(generateTone(60, 0.6)),
    description: 'A deep, low-frequency rumble. Ideal for creating tension, indicating large machinery, earthquakes, or distant explosions.',
  },
  {
    id: 'static',
    name: 'Static',
    base64: encode(generateNoise(0.2)),
    description: 'White noise static, like an old TV or radio. Useful for transitions, horror scenes, or malfunctioning electronics.',
  },
];