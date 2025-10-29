import React, { forwardRef } from 'react';

interface VideoPlayerProps {
  src: string;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(({ src }, ref) => {
  return (
    <video
      ref={ref}
      className="w-full h-full object-contain"
      src={src}
      playsInline
    >
      Your browser does not support the video tag.
    </video>
  );
});