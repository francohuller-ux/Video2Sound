import React from 'react';
import type { SoundEffect } from '../services/soundEffects';

interface SoundEffectSelectorProps {
  effects: SoundEffect[];
  selectedEffects: string[];
  suggestedEffects: string[];
  onSelectionChange: (selected: string[]) => void;
  disabled: boolean;
}

const MusicNoteIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
        <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3V3z" />
    </svg>
);

const StarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
);

export const SoundEffectSelector: React.FC<SoundEffectSelectorProps> = ({ effects, selectedEffects, suggestedEffects, onSelectionChange, disabled }) => {
  const handleToggle = (effectId: string) => {
    const newSelection = selectedEffects.includes(effectId)
      ? selectedEffects.filter((id) => id !== effectId)
      : [...selectedEffects, effectId];
    onSelectionChange(newSelection);
  };

  return (
    <div className="w-full p-4 bg-gray-700/50 rounded-lg">
      <h3 className="font-semibold text-purple-300 mb-3 flex items-center gap-2">
        <MusicNoteIcon />
        Add Sound Effects
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {effects.map((effect) => {
          const isSuggested = suggestedEffects.includes(effect.id);
          const isSelected = selectedEffects.includes(effect.id);

          return (
            <label
              key={effect.id}
              className={`flex items-center gap-2 p-3 rounded-md transition-all duration-200 cursor-pointer text-sm font-medium border ${
                disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-600/50'
              } ${isSelected ? 'bg-purple-800/60 text-white border-purple-600' : 'bg-gray-900/40 text-gray-300 border-gray-700'}
              ${isSuggested && !isSelected ? 'border-purple-400 border-dashed' : ''}
              `}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggle(effect.id)}
                disabled={disabled}
                className="w-4 h-4 text-purple-500 bg-gray-600 border-gray-500 rounded focus:ring-purple-600 focus:ring-2"
              />
              <span className="flex-grow">{effect.name}</span>
              {isSuggested && <StarIcon />}
            </label>
          );
        })}
      </div>
    </div>
  );
};