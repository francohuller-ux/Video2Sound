import { GoogleGenAI, Modality } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export interface DialogueLine {
  time: number;
  speaker: string;
  age: string;
  gender: string;
  performanceCue: string;
  text: string;
}

/**
 * Acts as an expert lip-reader and director to generate a plausible, time-stamped script of dialogue from a video.
 * @param videoBase64 The base64 encoded video string.
 * @param mimeType The MIME type of the video.
 * @param guidance Optional user-provided guidance for the dialogue's tone or context.
 * @returns A promise that resolves to a full dialogue script.
 */
export async function generateDialogueScript(videoBase64: string, mimeType: string, guidance: string): Promise<string> {
  const model = "gemini-2.5-flash";
  const videoPart = {
    inlineData: {
      data: videoBase64,
      mimeType: mimeType,
    },
  };

  const guidanceText = guidance.trim() !== ''
    ? `The user has provided this guidance for the dialogue's tone and context: '${guidance}'. Please adhere to this guidance when generating dialogue and performance cues.`
    : 'Infer the context, tone, and emotion from the video itself.';
  
  const textPart = {
    text: `Your task is to be an expert phonetician, lip reader, and script director. You will generate a perfectly synchronized dialogue script from the video with performance cues.

    **Your single most important goal is to generate words that phonetically match the visual evidence of the characters' mouth movements.** Do not try to make the dialogue make sense or be coherent. Absurd or nonsensical sentences are perfectly acceptable if they provide a better phonetic match to the lip sync.

    **Instructions:**
    1.  Focus **only on dialogue**. Ignore all other ambient sounds (wind, traffic) or foley sounds (footsteps, doors).
    2.  Analyze mouth movements phonetically (Stops: p,b,t,d; Fricatives: f,v,s,z; Vowels: open shapes, etc.).
    3.  You MUST infer the perceived age (e.g., Child, Teenager, Adult, Senior) and gender (e.g., Male, Female) of each speaker.
    4.  You MUST include a performance cue in brackets \`[]\` after the character description, describing the emotion or intonation (e.g., \`[shouting]\`, \`[whispering]\`, \`[sadly]\`, \`[excitedly]\`).
    5.  Timestamp everything precisely to the millisecond.
    6.  Vocalizations like laughing, crying, coughing should be described like \`*laughs heartily*\`.
    7.  If multiple speakers talk at once, create separate lines for each with their respective start times.
    8.  If there are periods of silence where no one is speaking, do not generate any script lines for those times.

    **Output Format:**
    \`[START_SECONDS.MILLISECONDS] DIALOGUE: Speaker #: (Age, Gender) [Performance Cue] Dialogue_or_Vocalization\`

    **Example Output:**
    [2.350] DIALOGUE: Speaker 1: (Child, Male) [curiously] Pop goes the pebble.
    [5.120] DIALOGUE: Speaker 2: (Adult, Female) [laughing softly] You think so?
    [8.750] DIALOGUE: Speaker 1: (Child, Male) [shouting excitedly] I found it!

    ${guidanceText}`
  };
  
  const response = await ai.models.generateContent({
    model: model,
    contents: [{ parts: [textPart, videoPart] }],
  });

  if (!response.text) {
    throw new Error("Failed to generate dialogue script from video.");
  }

  return response.text.trim();
}

/**
 * Generates audio for a single line of dialogue using performance cues.
 * @param line The parsed dialogue line object from the script.
 * @returns A promise that resolves to the base64 encoded audio string, or null if generation fails.
 */
export async function generateAudioForDialogueLine(line: DialogueLine): Promise<string | null> {
  const model = "gemini-2.5-flash-preview-tts";
  
  const ttsPrompt = `As a voice actor performing as a ${line.age.toLowerCase()} ${line.gender.toLowerCase()}, ${line.performanceCue}, perform this sound or line: "${line.text}"`;

  const voiceName = 'Kore'; 

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: ttsPrompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName as any },
          },
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioData) {
      console.warn(`Could not generate audio for line: "${line.text}". Skipping.`);
      return null;
    }

    return audioData;
  } catch (error) {
    console.error(`An API error occurred while generating audio for line: "${line.text}"`, error);
    return null;
  }
}