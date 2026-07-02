import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { downloadBlob } from "./mergeServicePdfs";

const styles = StyleSheet.create({
  page: {
    padding: 42,
    fontFamily: "Helvetica",
    fontSize: 11,
    lineHeight: 1.45,
    color: "#171717"
  },
  songBlock: {
    marginBottom: 20
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 6
  },
  meta: {
    fontSize: 9,
    color: "#6b6b6b",
    marginBottom: 12
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: "#b6945f",
    textTransform: "uppercase",
    marginBottom: 4
  },
  lyrics: {
    whiteSpace: "pre-wrap",
    marginBottom: 12
  },
  empty: {
    color: "#777777",
    fontStyle: "italic"
  }
});

function sanitizeFileName(value = "archivo") {
  return String(value || "archivo")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "archivo";
}

function getSongLyricsSections(song = {}) {
  const sections = Array.isArray(song.lyricsSections)
    ? song.lyricsSections
        .map((section) => ({
          type: String(section?.type || "Letra").trim(),
          text: String(section?.text || "").trim()
        }))
        .filter((section) => section.text)
    : [];
  if (sections.length) return sections;

  const fallbackText = String(song.lyricsText || song.manualLyrics || song.lyrics || "").trim();
  return fallbackText ? [{ type: "Letra", text: fallbackText }] : [];
}

function SongLyricsBlock({ song, first = false }) {
  const sections = getSongLyricsSections(song);
  return (
    <View style={styles.songBlock} break={!first}>
      <Text style={styles.title}>{song.title || "Canto sin título"}</Text>
      {song.artistOrSource ? <Text style={styles.meta}>{song.artistOrSource}</Text> : null}
      {sections.length ? (
        sections.map((section, index) => (
          <View key={`${section.type}-${index}`} wrap={false}>
            {section.type ? <Text style={styles.sectionLabel}>{section.type}</Text> : null}
            <Text style={styles.lyrics}>{section.text}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>Sin letra manual registrada.</Text>
      )}
    </View>
  );
}

function LyricsDocument({ songs = [] }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap>
        {songs.map((song, index) => (
          <SongLyricsBlock key={song.id || `${song.title}-${index}`} song={song} first={index === 0} />
        ))}
      </Page>
    </Document>
  );
}

export async function downloadSongLyricsPdf(song = {}) {
  const blob = await pdf(<LyricsDocument songs={[song]} />).toBlob();
  downloadBlob(blob, `Letra de ${sanitizeFileName(song.title || "canto")}.pdf`);
}

export async function downloadRepertoireLyricsPdf(songs = []) {
  const sortedSongs = [...(Array.isArray(songs) ? songs : [])]
    .filter((song) => song && !song.deleted)
    .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "es", { sensitivity: "base" }));
  const blob = await pdf(<LyricsDocument songs={sortedSongs} />).toBlob();
  downloadBlob(blob, `Letras del repertorio Roca Eterna.pdf`);
}
