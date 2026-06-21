import { useEffect, useState } from "react";
import {
  coverObjectPosition,
  getSongCoverUrl,
  normalizeCoverBackgroundMode,
  normalizeCoverBackgroundOpacity
} from "../../services/songCover";

const validAccent = (value = "") => /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#b6945f";

function colorWithOpacity(color, opacityPercent) {
  const normalized = validAccent(color).slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgb(${red} ${green} ${blue} / ${normalizeCoverBackgroundOpacity(opacityPercent) / 100})`;
}

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
  const backgroundMode = normalizeCoverBackgroundMode(song.coverBackgroundMode);
  const accent = validAccent(song.coverAccentColor);
  const colorOnly = backgroundMode === "color";
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(false);
    if (!url || colorOnly) return undefined;
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
  }, [colorOnly, url]);
  if (song.coverEnabled === false) return null;
  if (colorOnly) {
    return (
      <span
        aria-hidden="true"
        className={`song-cover-backdrop song-cover-backdrop-color ${tone === "dark" ? "song-cover-backdrop-dark" : ""}`}
        style={{
          background: `linear-gradient(135deg, ${colorWithOpacity(accent, song.coverBackgroundOpacity)} 0%, transparent 82%)`,
          "--song-cover-accent": accent
        }}
      />
    );
  }
  if (!url) return null;
  return loaded ? (
    <span
      aria-hidden="true"
      className={`song-cover-backdrop song-cover-backdrop-${song.coverIntensity === "medium" ? "medium" : "subtle"} ${tone === "dark" ? "song-cover-backdrop-dark" : ""}`}
      style={{
        backgroundImage: `url("${url}")`,
        backgroundPosition: coverObjectPosition(song.coverPosition),
        "--song-cover-accent": accent
      }}
    />
  ) : null;
}

export function songCoverAccentStyle(song = {}) {
  if (song.coverEnabled === false) return undefined;
  if (!getSongCoverUrl(song) && normalizeCoverBackgroundMode(song.coverBackgroundMode) !== "color") return undefined;
  const accent = validAccent(song.coverAccentColor);
  return {
    borderColor: `${accent}66`,
    boxShadow: `0 18px 50px ${accent}18`
  };
}
