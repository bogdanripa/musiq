import { useEffect, useRef, useState } from "react";

let activeAudio: HTMLAudioElement | null = null;

interface Props {
  url: string | null;
  size?: "sm" | "md";
}

export function PreviewButton({ url, size = "md" }: Props) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (activeAudio === audioRef.current) activeAudio = null;
  }, []);

  if (!url) {
    return (
      <button
        className={`preview ${size} disabled`}
        disabled
        title="No preview available"
      >
        ▶
      </button>
    );
  }

  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.addEventListener("ended", () => setPlaying(false));
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      if (activeAudio && activeAudio !== audioRef.current) {
        activeAudio.pause();
      }
      activeAudio = audioRef.current;
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  return (
    <button className={`preview ${size}`} onClick={toggle} title="Preview">
      {playing ? "⏸" : "▶"}
    </button>
  );
}
