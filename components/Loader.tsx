import React from 'react';

interface LoaderProps {
  message: string;
}

export const Loader: React.FC<LoaderProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-gray-700/50 rounded-lg">
      <div className="w-10 h-10 border-4 border-purple-400 border-t-transparent border-solid rounded-full animate-spin"></div>
      <p className="mt-4 text-lg text-gray-300">{message}</p>
    </div>
  );
};
