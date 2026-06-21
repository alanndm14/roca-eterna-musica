import { SiSpotify, SiYoutube } from "react-icons/si";

const platformStyles = {
  youtube: {
    Icon: SiYoutube,
    iconClass: "text-[#ff0000]",
    label: "YouTube"
  },
  spotify: {
    Icon: SiSpotify,
    iconClass: "text-[#1ed760]",
    label: "Spotify"
  }
};

function PlatformLink({ platform, url, songTitle = "", compact = true, onClick }) {
  if (!url) return null;
  const config = platformStyles[platform];
  const Icon = config.Icon;
  const title = `Abrir${songTitle ? ` ${songTitle}` : ""} en ${config.label}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      aria-label={title}
      title={title}
      className={`inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-ink/10 bg-white/80 text-ink shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-soft active:scale-95 dark:border-white/15 dark:bg-black/80 dark:hover:bg-black ${compact ? "px-3" : "gap-2.5 px-3.5"}`}
    >
      <Icon className={`h-6 w-6 shrink-0 ${config.iconClass}`} aria-hidden="true" />
      {!compact ? <span className="text-sm font-bold">{config.label}</span> : <span className="sr-only">{config.label}</span>}
    </a>
  );
}

export function SongExternalLinks({
  youtubeUrl = "",
  spotifyUrl = "",
  songTitle = "",
  compact = true,
  className = "",
  onClick
}) {
  if (!youtubeUrl && !spotifyUrl) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <PlatformLink platform="youtube" url={youtubeUrl} songTitle={songTitle} compact={compact} onClick={onClick} />
      <PlatformLink platform="spotify" url={spotifyUrl} songTitle={songTitle} compact={compact} onClick={onClick} />
    </div>
  );
}
