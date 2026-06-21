import { useEffect, useState } from "react";
import { coverObjectPosition, getSongCoverUrl } from "../../services/songCover";

export function SongCoverImage({ song, className = "", wrapperClassName = "" }) {
  const url = getSongCoverUrl(song);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (!url || failed) return null;
  return (
    <span className={`block shrink-0 overflow-hidden bg-ink/8 ${wrapperClassName}`}>
      <img
        src={url}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className={`h-full w-full object-cover ${className}`}
        style={{ objectPosition: coverObjectPosition(song.coverPosition) }}
        onError={() => setFailed(true)}
      />
    </span>
  );
}

export function SongCoverBackdrop({ song, tone = "adaptive" }) {
  const url = getSongCoverUrl(song);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(false);
    if (!url) return undefined;
    let active = true;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (active) setLoaded(true);
    };
    image.onerror = () => {
      if (active) setLoaded(false);
    };
    image.src = url;
    return () => {
      active = false;
    };
  }, [url]);
  if (!url) return null;
  return loaded ? (
    <span
      aria-hidden="true"
      className={`song-cover-backdrop song-cover-backdrop-${song.coverIntensity === "medium" ? "medium" : "subtle"} ${tone === "dark" ? "song-cover-backdrop-dark" : ""}`}
      style={{
        backgroundImage: `url("${url}")`,
        backgroundPosition: coverObjectPosition(song.coverPosition),
        "--song-cover-accent": song.coverAccentColor || "rgb(var(--color-brass))"
      }}
    />
  ) : null;
}

export function songCoverAccentStyle(song = {}) {
  if (!getSongCoverUrl(song)) return undefined;
  const accent = /^#[0-9a-fA-F]{6}$/.test(song.coverAccentColor || "") ? song.coverAccentColor : "#b6945f";
  return {
    borderColor: `${accent}66`,
    boxShadow: `0 18px 50px ${accent}18`
  };
}
