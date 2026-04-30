import { useState, useRef } from "react";
import { Play, Pause } from "lucide-react";

interface AudioMessageProps {
  audioUrl: string;
  isOwn?: boolean;
}

const MOCK_WAVEFORM = [
  3, 6, 4, 8, 5, 10, 7, 4, 9, 6, 8, 5, 10, 4, 7, 5, 8, 3, 6, 4, 9, 5, 7, 4, 8, 6, 10, 5, 7, 4,
];

export default function AudioMessage({ audioUrl, isOwn = false }: AudioMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const dur = audioRef.current.duration;
      // Tránh lỗi NaN nếu audio không tải được duration hợp lệ
      setDuration(Number.isFinite(dur) ? dur : 0);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const formatTime = (time: number) => {
    if (!Number.isFinite(time) || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const displayTime = isPlaying || currentTime > 0 ? currentTime : duration;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`flex items-center gap-2.5 py-0.5 ${isOwn ? "text-white" : "text-gray-800"}`}>
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        hidden
      />

      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-full border-2 ${
          isOwn 
            ? "border-white text-white hover:bg-white/10" 
            : "border-blue-500 text-blue-500 hover:bg-blue-50"
        } transition-colors`}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4" fill="currentColor" strokeWidth={0} />
        ) : (
          <Play className="w-4 h-4 ml-0.5" fill="currentColor" strokeWidth={0} />
        )}
      </button>

      <div className="flex-1 flex items-center gap-[3px] h-6">
        {MOCK_WAVEFORM.map((height, index) => {
          const barPercent = (index / MOCK_WAVEFORM.length) * 100;
          const isPlayed = barPercent <= progressPercent;
          return (
            <div
              key={index}
              className={`w-[3px] rounded-full transition-colors duration-150 ${
                isPlayed
                  ? isOwn
                    ? "bg-white"
                    : "bg-blue-500"
                  : isOwn
                  ? "bg-white/30"
                  : "bg-gray-300"
              }`}
              style={{ height: `${Math.max(20, height * 10)}%` }}
            />
          );
        })}
      </div>

      <div className={`text-[13px] font-semibold w-10 shrink-0 text-right pr-1 ${isOwn ? "text-white" : "text-gray-500"}`}>
        {formatTime(displayTime)}
      </div>
    </div>
  );
}
