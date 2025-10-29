import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FileUploader } from './components/FileUploader';
import { VideoPlayer } from './components/VideoPlayer';
import { Loader } from './components/Loader';
import { CustomSoundPrompt } from './components/CustomSoundPrompt';
import { generateDialogueScript, generateAudioForDialogueLine } from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';
import { decode, stitchAudioClips } from './utils/audioUtils';

type LoadingStep = 'Analyzing Lip Movements' | 'Generating Dialogue Audio' | 'Synchronizing Dialogue' | '';

export interface DialogueLine {
  time: number;
  speaker: string;
  age: string;
  gender: string;
  performanceCue: string;
  text: string;
}

const PlayIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const PauseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);


export default function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<LoadingStep>('');
  const [error, setError] = useState<string | null>(null);
  const [dialogueScript, setDialogueScript] = useState<string>('');
  const [dialogueGuidance, setDialogueGuidance] = useState<string>('');
  const [retryAfter, setRetryAfter] = useState<number>(0);
  const [retryAttempts, setRetryAttempts] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (retryAfter > 0) {
      const timer = setTimeout(() => setRetryAfter(retryAfter - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [retryAfter]);
  
  useEffect(() => {
    const videoElement = videoRef.current;
    const audio = audioRef.current;
    
    const handlePlaybackEnd = () => {
      setIsPlaying(false);
      if (videoElement) videoElement.currentTime = 0;
      if (audio) audio.currentTime = 0;
    };
    
    if (videoElement) {
        videoElement.addEventListener('ended', handlePlaybackEnd);
        videoElement.addEventListener('pause', () => setIsPlaying(false));
    }

    return () => {
        if (videoElement) {
            videoElement.removeEventListener('ended', handlePlaybackEnd);
            videoElement.removeEventListener('pause', () => setIsPlaying(false));
        }
    };
  }, []);

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
  
  const parseScript = (script: string): DialogueLine[] => {
    const lines = script.split('\n');
    const parsedLines: DialogueLine[] = [];
    // Updated regex to capture the performance cue, e.g., [shouting]
    const dialogueRegex = /\[(\d+\.?\d*)\] DIALOGUE: (Speaker \d+): \(([^,]+), ([^)]+)\) \[([^\]]+)\] (.*)/;

    for (const line of lines) {
      const dialogueMatch = line.match(dialogueRegex);
      if (dialogueMatch) {
        parsedLines.push({
          time: parseFloat(dialogueMatch[1]),
          speaker: dialogueMatch[2],
          age: dialogueMatch[3].trim(),
          gender: dialogueMatch[4].trim(),
          performanceCue: dialogueMatch[5].trim(),
          text: dialogueMatch[6].trim(),
        });
      }
    }
    return parsedLines;
  };

  const getVideoDuration = (videoEl: HTMLVideoElement): Promise<number> => {
    return new Promise((resolve, reject) => {
      if (videoEl.duration && isFinite(videoEl.duration)) {
        resolve(videoEl.duration);
        return;
      }
      if (videoEl.readyState >= 1) {
          if (videoEl.duration) {
            resolve(videoEl.duration);
            return;
          }
      }
      
      const onLoadedMetadata = () => {
        videoEl.removeEventListener('loadedmetadata', onLoadedMetadata);
        if (videoEl.duration && isFinite(videoEl.duration)) {
          resolve(videoEl.duration);
        } else {
          reject(new Error("Could not determine video duration after metadata loaded."));
        }
      };

      videoEl.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
      
      setTimeout(() => {
          reject(new Error("Timeout waiting for video metadata."));
      }, 5000);
    });
  };

  const handleGenerateDialogue = useCallback(async () => {
    if (!videoFile || !videoRef.current) return;

    setIsLoading(true);
    setError(null);
    if(generatedAudioUrl) URL.revokeObjectURL(generatedAudioUrl);
    setGeneratedAudioUrl(null);
    setDialogueScript('');
    setIsPlaying(false);

    try {
      setLoadingStep('Analyzing Lip Movements');
      const videoBase64 = await fileToBase64(videoFile);
      const script = await generateDialogueScript(videoBase64, videoFile.type, dialogueGuidance);
      setDialogueScript(script);

      const parsedLines = parseScript(script);

      if (parsedLines.length === 0) {
        setError(script.trim() ? `AI could not generate a valid script. Response: "${script}"` : "AI did not detect any dialogue in the video.");
        setIsLoading(false);
        setLoadingStep('');
        return;
      }

      setLoadingStep('Generating Dialogue Audio');
      const settledClips = await Promise.all(
        parsedLines.map(line =>
          generateAudioForDialogueLine(line)
            .then(audioBase64 => {
              if (audioBase64) {
                return {
                  time: line.time,
                  audioData: decode(audioBase64),
                };
              }
              return null;
            })
        )
      );

      const audioClips = settledClips.filter(clip => clip !== null) as { time: number; audioData: Uint8Array }[];

      if (audioClips.length === 0 && parsedLines.length > 0) {
        setError("Failed to generate audio for any script lines. The script may contain only unsupported text.");
        setIsLoading(false);
        setLoadingStep('');
        return;
      }


      setLoadingStep('Synchronizing Dialogue');
      const videoDuration = await getVideoDuration(videoRef.current);
      
      const audioBlob = await stitchAudioClips(audioClips, videoDuration);
      const url = URL.createObjectURL(audioBlob);
      setGeneratedAudioUrl(url);

      setRetryAttempts(0);

    } catch (err) {
      console.error(err);
      let errorMessage = 'An unknown error occurred. Please try again.';
      if (err instanceof Error) {
        const lowerCaseMessage = err.message.toLowerCase();

        if (lowerCaseMessage.includes('quota') || lowerCaseMessage.includes('resource_exhausted') || lowerCaseMessage.includes('429')) {
          const newRetryAttempts = retryAttempts + 1;
          setRetryAttempts(newRetryAttempts);
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
  }, [videoFile, retryAttempts, dialogueGuidance, generatedAudioUrl]);
  
  const handleDownload = () => {
    if (!generatedAudioUrl) return;
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = generatedAudioUrl;
    a.download = 'generated-dialogue.wav';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  
  const handlePlayPause = () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (video && audio) {
        if (isPlaying) {
            video.pause();
            audio.pause();
        } else {
            if (video.ended) { 
                 video.currentTime = 0;
                 audio.currentTime = 0;
            }
            video.play();
            audio.play();
        }
        setIsPlaying(!isPlaying);
    }
  };

  const resetState = (keepVideo = false) => {
    if (!keepVideo) {
      setVideoFile(null);
      if(videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl(null);
    }
    if (generatedAudioUrl) {
      URL.revokeObjectURL(generatedAudioUrl);
    }
    setGeneratedAudioUrl(null);
    setIsLoading(false);
    setError(null);
    setDialogueScript('');
    setDialogueGuidance('');
    setRetryAfter(0);
    setRetryAttempts(0);
    setIsPlaying(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 sm:p-6 md:p-8">
      <audio ref={audioRef} src={generatedAudioUrl ?? ''} className="hidden" />
      <header className="w-full max-w-4xl mb-6 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
          Video to Dialogue AI
        </h1>
        <p className="mt-2 text-lg text-gray-400">Upload a video, and let AI analyze lip movements to generate synchronized dialogue.</p>
      </header>

      <main className="w-full max-w-2xl bg-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8 transition-all duration-300">
        {!videoFile ? (
          <FileUploader onFileSelect={handleFileChange} />
        ) : (
          <div className="flex flex-col gap-6">
            <div className="w-full aspect-video rounded-lg overflow-hidden bg-black">
              <VideoPlayer ref={videoRef} src={videoPreviewUrl!} />
            </div>
            
            <CustomSoundPrompt
              prompt={dialogueGuidance}
              onPromptChange={setDialogueGuidance}
              disabled={isLoading}
            />

            {error && <div className="p-3 bg-red-800/50 border border-red-600 text-red-200 rounded-lg text-center">{error}</div>}

            {isLoading && <Loader message={`${loadingStep}...`} />}

            {dialogueScript && !isLoading && (
              <div className="p-4 bg-gray-700/50 rounded-lg max-h-48 overflow-y-auto">
                <h3 className="font-semibold text-purple-300 mb-2">Generated Dialogue Script:</h3>
                <p className="text-gray-300 text-sm whitespace-pre-wrap italic">{dialogueScript}</p>
              </div>
            )}
            
            {generatedAudioUrl && !isLoading && (
              <div className="flex items-center justify-center p-4 bg-gray-700 rounded-lg w-full">
                <button
                  onClick={handlePlayPause}
                  className="flex items-center gap-2 px-6 py-2 text-lg font-semibold rounded-full bg-purple-600 hover:bg-purple-700 transition-colors"
                >
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                  <span>{isPlaying ? 'Pause' : 'Play with Dialogue'}</span>
                </button>
              </div>
            )}


            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleGenerateDialogue}
                disabled={isLoading || !videoFile || retryAfter > 0}
                className="w-full flex-grow bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
              >
                {isLoading
                  ? 'Generating...'
                  : retryAfter > 0
                  ? `Try again in ${retryAfter}s`
                  : generatedAudioUrl
                  ? '✨ Regenerate Dialogue'
                  : '✨ Generate Dialogue'}
              </button>

              {generatedAudioUrl && !isLoading && (
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