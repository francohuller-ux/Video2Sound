import React from 'react';

interface CustomSoundPromptProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  disabled: boolean;
}

const MagicWandIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
);


export const CustomSoundPrompt: React.FC<CustomSoundPromptProps> = ({ prompt, onPromptChange, disabled }) => {
  return (
    <div className="w-full p-4 bg-gray-700/50 rounded-lg">
      <h3 className="font-semibold text-purple-300 mb-3 flex items-center gap-2">
        <MagicWandIcon />
        Guide the AI's Performance
      </h3>
      <input
        type="text"
        placeholder="e.g., 'an angry argument', 'a hushed, conspiratorial tone'"
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        disabled={disabled}
        className="w-full bg-gray-900/40 border border-gray-600 text-gray-300 py-2 px-3 rounded-md leading-tight focus:outline-none focus:bg-gray-700/50 focus:border-purple-500 placeholder-gray-500"
      />
    </div>
  );
};