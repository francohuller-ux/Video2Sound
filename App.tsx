import React, { useState, useCallback, useEffect } from 'react';
import { FileUploader } from './components/FileUploader';
import { VideoPlayer } from './components/VideoPlayer';
import { AudioPlayer } from './components/AudioPlayer';
import { Loader } from './components/Loader';
import { SoundEffectSelector } from './components/SoundEffectSelector';
import { VoiceSelector, availableVoices } from './components/VoiceSelector';
import { CustomSoundPrompt } from './components/CustomSoundPrompt';
import { generateSoundDescription, generateAudioFromText, suggestSoundEffects } from './services/geminiService';
import { soundEffects } from './services/soundEffects';
import { fileToBase64 } from './utils/fileUtils';
import { decode, decodeAudioData, createWavBlob, mixAudio } from './utils/audioUtils';

// Define loading steps for better user feedback
type LoadingStep = 'Analyzing Video' | 'Generating Sound' | 'Generating Custom Sound' | 'Mixing Audio' | 'Suggesting Sounds' | '';

export default function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [generatedAudioBuffer, setGeneratedAudioBuffer] = useState<AudioBuffer | null>(null);
  const [rawAudioData, setRawAudioData] = useState<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<LoadingStep>('');
  const [error, setError] = useState<string | null>(null);
  const [soundDescription, setSoundDescription] = useState<string>('');
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const [suggestedEffects, setSuggestedEffects] = useState<string[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>(availableVoices[0]);
  const [customSoundPrompt, setCustomSoundPrompt] = useState<string>('');
  const [retryAfter, setRetryAfter] = useState<number>(0);
  const [retryAttempts, setRetryAttempts] = useState<number>(0);

  useEffect(() => {
    if (retryAfter > 0) {
      const timer = setTimeout(() => setRetryAfter(retryAfter - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [retryAfter]);

  const handleFileChange = (file: File) => {
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      setVideoPreviewUrl(URL.createObjectURL(file));
      resetState(true);
    } else {
      setError('Please upload a valid video file.');
      setVideoFile(null);
      setVideoPreviewUrl(null);
    }
  };

  const handleSuggestSounds = useCallback(async () => {
    if (!videoFile) return;

    setIsLoading(true);
    setLoadingStep('Suggesting Sounds');
    setError(null);
    setSuggestedEffects([]);

    try {
      const videoBase64 = await fileToBase64(videoFile);
      const suggestions = await suggestSoundEffects(videoBase64, videoFile.type);
      setSuggestedEffects(suggestions);
      setSelectedEffects(suggestions); // Automatically select the suggested effects
    } catch (err) {
      console.error(err);
      let errorMessage = 'Could not suggest sounds. Please try again.';
      if (err instanceof Error) {
        errorMessage = `An error occurred while suggesting sounds: ${err.message}`;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  }, [videoFile]);

  const handleGenerateSound = useCallback(async () => {
    if (!videoFile) return;

    setIsLoading(true);
    setError(null);
    setGeneratedAudioBuffer(null);
    setSoundDescription('');
    setRawAudioData(null);

    try {
      // Step 1: Analyze video and generate sound description
      setLoadingStep('Analyzing Video');
      const videoBase64 = await fileToBase64(videoFile);
      const description = await generateSoundDescription(videoBase64, videoFile.type);
      setSoundDescription(description);

      // Step 2: Generate audio from the description
      setLoadingStep('Generating Sound');
      const audioBase64 = await generateAudioFromText(description, selectedVoice);
      const mainAudioBytes = decode(audioBase64);
      
      const additionalAudioTracks: Uint8Array[] = [];

      // Step 3: Generate custom sound effect if prompt is provided
      if (customSoundPrompt.trim() !== '') {
        setLoadingStep('Generating Custom Sound');
        const customSoundBase64 = await generateAudioFromText(customSoundPrompt, selectedVoice);
        additionalAudioTracks.push(decode(customSoundBase64));
      }

      // Step 4: Add selected library sound effects
      const selectedEffectsBytes = soundEffects
        .filter(effect => selectedEffects.includes(effect.id))
        .map(effect => decode(effect.base64));
      additionalAudioTracks.push(...selectedEffectsBytes);

      let finalAudioBytes = mainAudioBytes;

      // Step 5: Mix all sounds if any were added
      if (additionalAudioTracks.length > 0) {
        setLoadingStep('Mixing Audio');
        const allTracks = [mainAudioBytes, ...additionalAudioTracks];
        finalAudioBytes = mixAudio(allTracks);
      }

      // Step 6: Decode final audio data for playback and download
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      setRawAudioData(finalAudioBytes); // Save for download
      const buffer = await decodeAudioData(finalAudioBytes, audioContext, 24000, 1);
      setGeneratedAudioBuffer(buffer);
      setRetryAttempts(0); // Reset attempts on success

    } catch (err) {
      console.error(err);
      let errorMessage = 'An unknown error occurred. Please try again.';
      if (err instanceof Error) {
        const lowerCaseMessage = err.message.toLowerCase();

        if (lowerCaseMessage.includes('quota') || lowerCaseMessage.includes('resource_exhausted') || lowerCaseMessage.includes('429')) {
          const newRetryAttempts = retryAttempts + 1;
          setRetryAttempts(newRetryAttempts);
          // Exponential backoff (2^n seconds) with jitter, capped at 60 seconds.
          const backoffSeconds = Math.min(60, Math.pow(2, newRetryAttempts) + Math.random());
          const roundedBackoff = Math.ceil(backoffSeconds);

          errorMessage = `API rate limit exceeded. Please wait ${roundedBackoff}s before trying again.`;
          setRetryAfter(roundedBackoff);
        } else if (lowerCaseMessage.includes('failed to fetch')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (lowerCaseMessage.includes('invalid') && (lowerCaseMessage.includes('argument') || lowerCaseMessage.includes('format') || lowerCaseMessage.includes('unsupported'))) {
          errorMessage = 'The uploaded video file appears to be invalid or in an unsupported format. Please try a different video.';
        } else if (lowerCaseMessage.includes('safety') || lowerCaseMessage.includes('blocked')) {
          errorMessage = 'The content could not be processed due to safety policies. Please try a different video.';
        } else if (lowerCaseMessage.includes('500') || lowerCaseMessage.includes('503') || lowerCaseMessage.includes('server error')) {
          errorMessage = 'A server error occurred. The AI model seems to be unavailable. Please try again in a few moments.';
        } else {
          errorMessage = `An unexpected error occurred: ${err.message}. Please try again.`;
        }
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  }, [videoFile, retryAttempts, selectedEffects, selectedVoice, customSoundPrompt]);
  
  const handleDownload = () => {
    if (!rawAudioData) return;

    // The audio is 16-bit PCM, 1 channel, 24000Hz sample rate
    const blob = createWavBlob(rawAudioData, 24000, 1, 16);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'generated-sound.wav';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const resetState = (keepVideo = false) => {
    if (!keepVideo) {
      setVideoFile(null);
      setVideoPreviewUrl(null);
    }
    setGeneratedAudioBuffer(null);
    setIsLoading(false);
    setError(null);
    setSoundDescription('');
    setSelectedEffects([]);
    setSuggestedEffects([]);
    setSelectedVoice(availableVoices[0]);
    setCustomSoundPrompt('');
    setRetryAfter(0);
    setRawAudioData(null);
    setRetryAttempts(0);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 sm:p-6 md:p-8">
      <header className="w-full max-w-4xl mb-6 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
          Video to Sound AI
        </h1>
        <p className="mt-2 text-lg text-gray-400">Upload a video, let AI create its soundscape, and add your own effects.</p>
      </header>

      <main className="w-full max-w-2xl bg-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8 transition-all duration-300">
        {!videoFile ? (
          <FileUploader onFileSelect={handleFileChange} />
        ) : (
          <div className="flex flex-col gap-6">
            <div className="w-full aspect-video rounded-lg overflow-hidden bg-black">
              <VideoPlayer src={videoPreviewUrl!} />
            </div>
            
            <SoundEffectSelector 
              effects={soundEffects}
              selectedEffects={selectedEffects}
              suggestedEffects={suggestedEffects}
              onSelectionChange={setSelectedEffects}
              disabled={isLoading}
            />
            
            <div className="flex justify-center -mt-4">
              <button
                onClick={handleSuggestSounds}
                disabled={isLoading || !videoFile}
                className="bg-gray-600 hover:bg-gray-500 text-purple-300 text-sm font-semibold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Suggest Sounds
              </button>
            </div>


            <VoiceSelector
              selectedVoice={selectedVoice}
              onVoiceChange={setSelectedVoice}
              disabled={isLoading}
            />

            <CustomSoundPrompt
              prompt={customSoundPrompt}
              onPromptChange={setCustomSoundPrompt}
              disabled={isLoading}
            />

            {error && <div className="p-3 bg-red-800/50 border border-red-600 text-red-200 rounded-lg text-center">{error}</div>}

            {isLoading && <Loader message={`${loadingStep}...`} />}

            {soundDescription && !isLoading && (
              <div className="p-4 bg-gray-700/50 rounded-lg">
                <h3 className="font-semibold text-purple-300 mb-2">Generated Sound Script:</h3>
                <p className="text-gray-300 text-sm italic">{soundDescription}</p>
              </div>
            )}
            
            {generatedAudioBuffer && !isLoading && (
              <AudioPlayer audioBuffer={generatedAudioBuffer} />
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleGenerateSound}
                disabled={isLoading || !videoFile || retryAfter > 0}
                className="w-full flex-grow bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
              >
                {isLoading
                  ? 'Generating...'
                  : retryAfter > 0
                  ? `Try again in ${retryAfter}s`
                  : generatedAudioBuffer
                  ? '✨ Regenerate Sound'
                  : '✨ Generate Sound'}
              </button>

              {generatedAudioBuffer && !isLoading && (
                <button
                  onClick={handleDownload}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Download
                </button>
              )}

              <button
                onClick={() => resetState(false)}
                disabled={isLoading}
                className="w-full sm:w-auto bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-colors disabled:opacity-50"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </main>
      <footer className="mt-8 text-center text-gray-500 text-sm">
        <p>Powered by Google Gemini</p>
      </footer>
    </div>
  );
}