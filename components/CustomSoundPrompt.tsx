import React from 'react';

interface CustomSoundPromptProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  disabled: boolean;
}

const SpeechBubbleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" />
    </svg>
);


export const CustomSoundPrompt: React.FC<CustomSoundPromptProps> = ({ prompt, onPromptChange, disabled }) => {
  return (
    <div className="w-full p-4 bg-gray-700/50 rounded-lg">
      <h3 className="font-semibold text-purple-300 mb-3 flex items-center gap-2">
        <SpeechBubbleIcon />
        Add a Custom Sound
      </h3>
      <input
        type="text"
        placeholder="e.g., 'a cat purring softly'"
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        disabled={disabled}
        className="w-full bg-gray-900/40 border border-gray-600 text-gray-300 py-2 px-3 rounded-md leading-tight focus:outline-none focus:bg-gray-700/50 focus:border-purple-500 placeholder-gray-500"
      />
    </div>
  );
};
