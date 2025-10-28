import React, { useState, useEffect, useRef, useCallback } from 'react';

interface AudioPlayerProps {
  audioBuffer: AudioBuffer;
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


export const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioBuffer }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
      sourceNodeRef.current?.stop();
      audioContextRef.current?.close();
    };
  }, []);

  const play = useCallback(() => {
    if (!audioContextRef.current || !audioBuffer) return;

    if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
        setIsPlaying(false);
        sourceNodeRef.current = null;
    };
    source.start(0);
    sourceNodeRef.current = source;
    setIsPlaying(true);
  }, [audioBuffer]);

  const pause = useCallback(() => {
    sourceNodeRef.current?.stop();
    setIsPlaying(false);
  }, []);

  const togglePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  return (
    <div className="flex items-center justify-center p-4 bg-gray-700 rounded-lg w-full">
      <button
        onClick={togglePlayPause}
        className="flex items-center gap-2 px-6 py-2 text-lg font-semibold rounded-full bg-purple-600 hover:bg-purple-700 transition-colors"
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
        <span>{isPlaying ? 'Pause Sound' : 'Play Generated Sound'}</span>
      </button>
    </div>
  );
};
