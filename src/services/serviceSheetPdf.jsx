import React from "react";
import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatDate } from "./dateUtils";
import {
  getSongExternalChordsUrl,
  getSongPdfUrl,
  getSongPreviewUrl,
  getSongSpotifyUrl,
  getSongYoutubeUrl,
  normalizeSong
} from "./songUtils";

const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: "Helvetica",
    color: "#171717",
    backgroundColor: "#fbfaf7"
  },
  header: {
    borderBottom: "1px solid #b6945f",
    paddingBottom: 16,
    marginBottom: 18
  },
  church: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: 1
  },
  app: {
    marginTop: 4,
    fontSize: 11,
    color: "#b6945f",
    textTransform: "uppercase"
  },
  title: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: 700
  },
  metaGrid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12
  },
  meta: {
    width: "48%",
    padding: 8,
    border: "1px solid #e6dfd1",
    borderRadius: 8,
    fontSize: 9
  },
  label: {
    color: "#777",
    marginBottom: 3,
    textTransform: "uppercase"
  },
  song: {
    marginTop: 10,
    padding: 12,
    border: "1px solid #e6dfd1",
    borderRadius: 10,
    backgroundColor: "#ffffff"
  },
  songTitleRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10
  },
  songTitle: {
    fontSize: 12,
    fontWeight: 700
  },
  badge: {
    fontSize: 8,
    padding: 4,
    color: "#8b6a31",
    backgroundColor: "#f3ead8",
    borderRadius: 6
  },
  details: {
    marginTop: 7,
    fontSize: 9,
    lineHeight: 1.5,
    color: "#333"
  },
  links: {
    marginTop: 8,
    display: "flex",
    flexDirection: "column",
    gap: 3,
    fontSize: 9
  },
  link: {
    color: "#60717d",
    textDecoration: "none"
  },
  notes: {
    marginTop: 7,
    fontSize: 9,
    color: "#555"
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    borderTop: "1px solid #e6dfd1",
    paddingTop: 8,
    fontSize: 8,
    color: "#777"
  }
});

export function getServiceDisplayLabel(schedule) {
  const label = schedule?.serviceLabel || schedule?.type || "Servicio";
  if (schedule?.serviceType === "domingo-manana") return "Domingo AM";
  if (schedule?.serviceType === "domingo-tarde") return "Domingo PM";
  if (schedule?.serviceType === "miercoles-oracion") return "Miércoles de oración";
  return label;
}

export function getServiceFileName(schedule) {
  const date = schedule?.date ? new Date(`${schedule.date}T00:00:00`) : new Date();
  const day = String(date.getDate()).padStart(2, "0");
  const month = monthNames[date.getMonth()] || "SERVICIO";
  const service = getServiceDisplayLabel(schedule)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/DOMINGO MANANA/g, "DOMINGO-AM")
    .replace(/DOMINGO TARDE/g, "DOMINGO-PM")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${day}-${month}-${service || "SERVICIO"}.pdf`;
}

export function buildServiceSongs(schedule, songs, keyPreference = "sharps") {
  return (schedule?.songs || []).map((entry, index) => {
    const full = normalizeSong(songs.find((song) => song.id === entry.songId) || {}, keyPreference);
    const merged = normalizeSong({ ...full, ...entry, title: full.title || entry.titleSnapshot }, keyPreference);
    return {
      index: index + 1,
      entry,
      full,
      title: entry.titleSnapshot || full.title || "Canto sin título",
      mainKey: full.mainKey || entry.keySnapshot || "",
      capo: Number(full.capo || 0),
      keyWithCapo: full.keyWithCapo || entry.keySnapshot || "",
      hasKeyChange: Boolean(full.hasKeyChange),
      notes: entry.notes || "",
      pdfUrl: entry.pdfUrl || getSongPdfUrl(full),
      previewUrl: getSongPreviewUrl(full) || entry.pdfUrl || getSongPdfUrl(full),
      youtubeUrl: getSongYoutubeUrl(full),
      spotifyUrl: getSongSpotifyUrl(full),
      externalChordsUrl: getSongExternalChordsUrl(full),
      merged
    };
  });
}

function ServiceSong({ song }) {
  return (
    <View style={styles.song} wrap={false}>
      <View style={styles.songTitleRow}>
        <Text style={styles.songTitle}>{song.index}. {song.title}</Text>
        {song.hasKeyChange ? <Text style={styles.badge}>Cambio de tono</Text> : null}
      </View>
      <Text style={styles.details}>
        Tono principal: {song.mainKey || "--"} · Capo: {song.capo || 0} · Tono con capo: {song.keyWithCapo || "--"}
      </Text>
      {song.notes ? <Text style={styles.notes}>Notas: {song.notes}</Text> : null}
      <View style={styles.links}>
        {song.pdfUrl ? <Link src={song.pdfUrl} style={styles.link}>PDF de letra y acordes</Link> : <Text>Sin PDF registrado</Text>}
        {song.youtubeUrl ? <Link src={song.youtubeUrl} style={styles.link}>YouTube</Link> : null}
        {song.spotifyUrl ? <Link src={song.spotifyUrl} style={styles.link}>Spotify</Link> : null}
        {song.externalChordsUrl ? <Link src={song.externalChordsUrl} style={styles.link}>Acordes externos</Link> : null}
      </View>
    </View>
  );
}

export function ServiceSheetDocument({ schedule, songs, settings }) {
  const serviceSongs = buildServiceSongs(schedule, songs, settings?.keyPreference || "sharps");
  return (
    <Document title={getServiceFileName(schedule).replace(".pdf", "")}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.church}>{settings?.churchName || "Roca Eterna"}</Text>
          <Text style={styles.app}>{settings?.appName || "Roca Eterna Música"}</Text>
          <Text style={styles.title}>Hoja del servicio · {getServiceDisplayLabel(schedule)}</Text>
          <View style={styles.metaGrid}>
            <View style={styles.meta}><Text style={styles.label}>Fecha</Text><Text>{formatDate(schedule?.date)}</Text></View>
            <View style={styles.meta}><Text style={styles.label}>Hora</Text><Text>{schedule?.time || "Sin hora"}</Text></View>
            <View style={styles.meta}><Text style={styles.label}>Responsable</Text><Text>{schedule?.leader || "Pendiente"}</Text></View>
            <View style={styles.meta}><Text style={styles.label}>Cantos</Text><Text>{serviceSongs.length}</Text></View>
          </View>
        </View>
        {serviceSongs.map((song) => <ServiceSong key={`${song.index}-${song.title}`} song={song} />)}
        {schedule?.generalNotes ? <Text style={styles.notes}>Notas generales: {schedule.generalNotes}</Text> : null}
        <Text style={styles.footer}>Generado desde Roca Eterna Música. Los PDFs externos se incluyen como enlaces por seguridad y compatibilidad.</Text>
      </Page>
    </Document>
  );
}
