interface Props {
  active: boolean;
  onToggle: () => void;
  size?: "sm" | "md";
}

export function PreviewButton({ active, onToggle, size = "md" }: Props) {
  return (
    <button
      className={`preview ${size} ${active ? "active" : ""}`}
      onClick={onToggle}
      title={active ? "Hide preview" : "Preview"}
    >
      {active ? "✕" : "▶"}
    </button>
  );
}

interface EmbedProps {
  trackId: string;
}

export function SpotifyEmbed({ trackId }: EmbedProps) {
  return (
    <iframe
      className="spotify-embed"
      src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&autoplay=1`}
      width="100%"
      height="80"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
      title="Spotify preview"
    />
  );
}
