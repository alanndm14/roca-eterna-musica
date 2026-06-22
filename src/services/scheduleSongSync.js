import {
  getSongExternalChordsUrl,
  getSongPdfUrl,
  getSongPreviewUrl,
  getSongSpotifyUrl,
  getSongYoutubeUrl,
  normalizeSong
} from "./songUtils";

export function createSongLookup(songs = []) {
  return new Map((Array.isArray(songs) ? songs : []).map((song) => [song.id, song]));
}

export function resolveScheduledSong(entry = {}, songsOrLookup = [], keyPreference = "sharps", index = 0) {
  const lookup = songsOrLookup instanceof Map ? songsOrLookup : createSongLookup(songsOrLookup);
  const source = entry.songId ? lookup.get(entry.songId) : null;
  const liveSong = source ? normalizeSong(source, keyPreference) : null;
  const fallback = normalizeSong({
    ...entry,
    id: entry.songId || "",
    title: entry.titleSnapshot || entry.title || "",
    mainKey: entry.keySnapshot || entry.mainKey || "",
    keyWithCapo: entry.keySnapshot || entry.keyWithCapo || "",
    internalNotes: entry.notes || ""
  }, keyPreference);
  const song = liveSong || fallback;

  return {
    index: index + 1,
    entry,
    full: liveSong || null,
    songId: entry.songId || song.id || "",
    title: song.title || entry.titleSnapshot || "Canto sin título",
    artistOrSource: song.artistOrSource || "",
    mainKey: song.mainKey || "",
    capo: Number(song.capo || 0),
    keyWithCapo: song.keyWithCapo || song.mainKey || "",
    hasKeyChange: Boolean(song.hasKeyChange),
    notes: song.internalNotes || "",
    pdfUrl: liveSong ? getSongPdfUrl(song) : entry.pdfUrl || getSongPdfUrl(song),
    previewUrl: liveSong
      ? getSongPreviewUrl(song) || getSongPdfUrl(song)
      : entry.pdfUrl || getSongPreviewUrl(song) || getSongPdfUrl(song),
    localPdfPath: song.localPdfPath || (!liveSong ? entry.localPdfPath || "" : ""),
    pdfVersion: song.pdfVersion || (!liveSong ? entry.pdfVersion || "" : ""),
    youtubeUrl: getSongYoutubeUrl(song),
    spotifyUrl: getSongSpotifyUrl(song),
    externalChordsUrl: getSongExternalChordsUrl(song),
    coverImagePath: song.coverImagePath || "",
    coverFileName: song.coverFileName || "",
    coverVersion: song.coverVersion || "",
    coverEnabled: song.coverEnabled !== false,
    coverPosition: song.coverPosition || "center",
    coverIntensity: song.coverIntensity || "subtle",
    coverBackgroundMode: song.coverBackgroundMode || "image",
    coverBackgroundOpacity: Number(song.coverBackgroundOpacity || 22),
    coverAccentColor: song.coverAccentColor || "",
    category: song.category || "",
    mainTheme: song.mainTheme || "",
    merged: song,
    sourceExists: Boolean(liveSong)
  };
}

export function resolveScheduleSongs(schedule = {}, songs = [], keyPreference = "sharps") {
  const lookup = createSongLookup(songs);
  return (schedule?.songs || []).map((entry, index) => (
    resolveScheduledSong(entry, lookup, keyPreference, index)
  ));
}
