import React from 'react';

export const availableVoices = [
  'Kore',
  'Puck',
  'Charon',
  'Fenrir',
  'Zephyr',
];

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  disabled: boolean;
}

const VoiceIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93V15a1 1 0 001 1h.01a1 1 0 00.99-1.124l-.07-1.48a6.992 6.992 0 00-4.86 0l-.07 1.48A1 1 0 007.99 16H8a1 1 0 001-1v-.07A7.001 7.001 0 001 8V7a1 1 0 012 0v1a5 5 0 0010 0V7a1 1 0 112 0v1a7.001 7.001 0 01-6 6.93z" clipRule="evenodd" />
    </svg>
);


export const VoiceSelector: React.FC<VoiceSelectorProps> = ({ selectedVoice, onVoiceChange, disabled }) => {
  return (
    <div className="w-full p-4 bg-gray-700/50 rounded-lg">
      <h3 className="font-semibold text-purple-300 mb-3 flex items-center gap-2">
        <VoiceIcon />
        Select AI Voice
      </h3>
      <div className="relative">
        <select
          value={selectedVoice}
          onChange={(e) => onVoiceChange(e.target.value)}
          disabled={disabled}
          className="w-full appearance-none bg-gray-900/40 border border-gray-600 text-gray-300 py-2 px-3 pr-8 rounded-md leading-tight focus:outline-none focus:bg-gray-700/50 focus:border-purple-500"
        >
          {availableVoices.map((voice) => (
            <option key={voice} value={voice}>
              {voice}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
        </div>
      </div>
    </div>
  );
};