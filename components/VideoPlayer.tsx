import React from 'react';

interface VideoPlayerProps {
  src: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src }) => {
  return (
    <video
      className="w-full h-full object-contain"
      controls
      src={src}
      autoPlay
      loop
      muted
    >
      Your browser does not support the video tag.
    </video>
  );
};
