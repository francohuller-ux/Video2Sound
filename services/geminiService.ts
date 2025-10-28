import { GoogleGenAI, Modality } from "@google/genai";
import { soundEffects } from './soundEffects';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Generates a textual description of sounds for a given video.
 * @param videoBase64 The base64 encoded video string.
 * @param mimeType The MIME type of the video.
 * @returns A promise that resolves to the sound description string.
 */
export async function generateSoundDescription(videoBase64: string, mimeType: string): Promise<string> {
  const model = "gemini-2.5-flash";
  const videoPart = {
    inlineData: {
      data: videoBase64,
      mimeType: mimeType,
    },
  };
  const textPart = {
    text: `Analyze this video and provide a detailed script of sounds that should accompany it, formatted for a text-to-speech engine. 
    Describe the sounds, noises, or voices that would fit the scene.
    For example: 'A gentle breeze rustles through the leaves. A small bird chirps happily. Suddenly, a deep voice says, "It is time."'
    Be creative, descriptive, and keep the total description concise and under 100 words.`
  };
  
  const response = await ai.models.generateContent({
    model: model,
    contents: { parts: [textPart, videoPart] },
  });

  if (!response.text) {
    throw new Error("Failed to generate sound description from video.");
  }

  return response.text;
}

/**
 * Generates audio from a given text description.
 * @param description The text to convert to speech.
 * @param voiceName The name of the pre-built voice to use.
 * @returns A promise that resolves to the base64 encoded audio string.
 */
export async function generateAudioFromText(description: string, voiceName: string): Promise<string> {
  const model = "gemini-2.5-flash-preview-tts";
  
  const response = await ai.models.generateContent({
    model: model,
    contents: [{ parts: [{ text: description }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName },
        },
      },
    },
  });

  const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!audioData) {
    throw new Error("Failed to generate audio from text.");
  }

  return audioData;
}

/**
 * Analyzes a video and suggests relevant sound effects from a predefined list.
 * @param videoBase64 The base64 encoded video string.
 * @param mimeType The MIME type of the video.
 * @returns A promise that resolves to an array of sound effect IDs.
 */
export async function suggestSoundEffects(videoBase64: string, mimeType: string): Promise<string[]> {
  const model = "gemini-2.5-flash";

  const effectsDescription = soundEffects.map(e => `- ${e.id}: ${e.description}`).join('\n');

  const videoPart = {
    inlineData: {
      data: videoBase64,
      mimeType: mimeType,
    },
  };

  const textPart = {
    text: `Analyze this video's content and mood. Based on your analysis, suggest which of the following sound effects would be most appropriate to add to a soundtrack.

Available sound effects:
${effectsDescription}

Respond ONLY with a valid JSON array of the string IDs for your suggestions. For example: ["rumble", "static"]. If no effects are suitable, return an empty array [].`
  };
  
  const response = await ai.models.generateContent({
    model: model,
    contents: { parts: [textPart, videoPart] },
    config: {
      responseMimeType: 'application/json',
    }
  });

  if (!response.text) {
    throw new Error("Failed to get a response for sound effect suggestions.");
  }

  try {
    const suggestions = JSON.parse(response.text);
    if (Array.isArray(suggestions) && suggestions.every(item => typeof item === 'string')) {
      const validIds = soundEffects.map(e => e.id);
      return suggestions.filter(id => validIds.includes(id));
    }
    throw new Error("Model returned an invalid format for suggestions.");
  } catch (e) {
    console.error("Failed to parse sound effect suggestions:", response.text, e);
    throw new Error("Failed to parse sound effect suggestions from the AI. Please try again.");
  }
}