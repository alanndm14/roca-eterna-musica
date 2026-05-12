import { Link } from "react-router-dom";

const normalizeTitle = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function findSongForNavigation({ songId, title, songs = [] }) {
  return songs.find((song) => song.id === songId) || songs.find((song) => normalizeTitle(song.title) === normalizeTitle(title));
}

export function SongNameLink({ songId, title, songs = [], children, className = "" }) {
  const song = findSongForNavigation({ songId, title, songs });
  const content = children || title || "Canto";

  if (!song?.id) {
    return (
      <button
        type="button"
        className={`text-left font-semibold text-ink transition hover:text-brass ${className}`}
        onClick={(event) => {
          event.stopPropagation();
          window.alert("No se encontró el canto en el repertorio.");
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      to={`/repertorio/${song.id}`}
      className={`font-semibold text-ink transition hover:text-brass ${className}`}
      onClick={(event) => event.stopPropagation()}
    >
      {content}
    </Link>
  );
}
