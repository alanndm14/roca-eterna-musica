import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatDate, getServiceDisplayLabel } from "./dateUtils";
import { getServiceDownloadFileName } from "./serviceSheetPdf";
import { resolvePublicAssetUrl } from "./songUtils";

export const SPECIAL_PROGRAM_TYPES = [
  "Bienvenida",
  "Oración",
  "Lectura bíblica",
  "Canto",
  "Ofrendas",
  "Predicación",
  "Santa cena",
  "Anuncios",
  "Participación especial",
  "Otro"
];

export const SPECIAL_SONG_POSITIONS = [
  "Apertura",
  "Antes de la prédica",
  "Después de la prédica"
];

const specialWords = /(especial|aniversario|congreso|vigilia|evento|conferencia|santa cena especial|retiro|campamento)/i;

export function isSpecialService(schedule = {}) {
  return Boolean(
    schedule.isSpecialService === true
    || schedule.serviceType === "especial"
    || specialWords.test([schedule.serviceLabel, schedule.type, schedule.name].filter(Boolean).join(" "))
  );
}

export function emptySpecialProgramItem(order = 1) {
  return {
    order,
    type: "Canto",
    title: "",
    notes: "",
    songId: "",
    position: "Antes de la prédica"
  };
}

export function getSpecialSongPosition(index = 0, total = 1, item = {}) {
  if (SPECIAL_SONG_POSITIONS.includes(item.position)) return item.position;
  if (index === 0) return "Apertura";
  if (index === Math.max(0, total - 1)) return "Después de la prédica";
  return "Antes de la prédica";
}

export function normalizeSpecialProgramItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item, index, source) => ({
      order: Number(item.order || index + 1),
      type: item.type === "Avisos" ? "Anuncios" : item.type || "Otro",
      title: item.title || item.description || "",
      notes: item.notes || "",
      songId: item.songId || "",
      position: getSpecialSongPosition(index, source.length, item)
    }))
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index + 1 }));
}

export function buildSpecialProgramFromSchedule(schedule = {}) {
  const scheduleSongs = Array.isArray(schedule.songs) ? schedule.songs : [];
  return normalizeSpecialProgramItems(scheduleSongs.map((entry, index) => ({
    order: index + 1,
    type: "Canto",
    title: entry.titleSnapshot || "",
    notes: entry.notes || "",
    songId: entry.songId || "",
    position: getSpecialSongPosition(index, scheduleSongs.length)
  })));
}

export function getSpecialProgramItems(schedule = {}) {
  const savedItems = normalizeSpecialProgramItems(schedule?.specialProgram || []);
  return savedItems.length ? savedItems : buildSpecialProgramFromSchedule(schedule);
}

export function getSpecialProgramFileName(schedule, suffix = "") {
  const base = getServiceDownloadFileName(schedule).replace(/\.pdf$/i, "");
  return `${base}${suffix}.pdf`;
}

function getLogoUrl(settings = {}) {
  return resolvePublicAssetUrl(settings.logoLightUrl || "icons/roca-eterna-logo-light.png");
}

function getScheduleTheme(schedule = {}) {
  const directTheme = schedule.theme || schedule.mainTheme || schedule.serviceTheme || "";
  if (directTheme) return directTheme;
  const match = String(schedule.generalNotes || "").match(/Tema sugerido:\s*([^.\n]+)/i);
  return match?.[1]?.trim() || "";
}

function getScheduleNotes(schedule = {}) {
  return schedule.specialProgramNotes || schedule.programNotes || schedule.generalNotes || "";
}

const styles = StyleSheet.create({
  page: {
    padding: 38,
    fontFamily: "Helvetica",
    color: "#161616",
    backgroundColor: "#ffffff"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottom: "1px solid #b6945f",
    paddingBottom: 14,
    marginBottom: 20
  },
  logo: {
    width: 56,
    height: 56,
    objectFit: "contain"
  },
  church: {
    fontSize: 18,
    fontWeight: 700
  },
  churchSubtitle: {
    marginTop: 2,
    fontSize: 9,
    color: "#555"
  },
  event: {
    marginTop: 5,
    fontSize: 15,
    color: "#8b6a31",
    fontWeight: 700
  },
  meta: {
    marginTop: 3,
    fontSize: 9,
    color: "#555"
  },
  row: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 8,
    borderBottom: "1px solid #eeeeee"
  },
  number: {
    width: 24,
    fontSize: 10,
    color: "#8b6a31",
    fontWeight: 700
  },
  itemBody: {
    flex: 1
  },
  itemTitle: {
    fontSize: 11,
    fontWeight: 700
  },
  itemType: {
    fontSize: 8,
    color: "#777",
    marginBottom: 2,
    textTransform: "uppercase"
  },
  notes: {
    marginTop: 3,
    fontSize: 9,
    color: "#555",
    lineHeight: 1.35
  },
  footer: {
    position: "absolute",
    left: 38,
    right: 38,
    bottom: 24,
    borderTop: "1px solid #eeeeee",
    paddingTop: 8,
    fontSize: 8,
    color: "#777"
  },
  miniPage: {
    padding: 24,
    fontFamily: "Helvetica",
    color: "#161616",
    backgroundColor: "#ffffff"
  },
  miniGrid: {
    flexDirection: "row",
    gap: 14,
    height: "100%"
  },
  miniCard: {
    flex: 1,
    height: "100%",
    border: "1.2px solid #b6945f",
    padding: 14
  },
  miniHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8
  },
  miniLogo: {
    width: 28,
    height: 28,
    objectFit: "contain"
  },
  miniEvent: {
    fontSize: 10,
    fontWeight: 700
  },
  miniMeta: {
    marginTop: 2,
    fontSize: 7,
    color: "#666"
  },
  miniItem: {
    fontSize: 7.5,
    marginBottom: 3,
    lineHeight: 1.25
  },
  miniNotes: {
    marginTop: 6,
    paddingTop: 5,
    borderTop: "1px solid #eee4d4",
    fontSize: 7,
    color: "#555",
    lineHeight: 1.25
  }
});

function itemTitle(item, songs = []) {
  if (item.type === "Canto" && item.songId) {
    const song = songs.find((entry) => entry.id === item.songId);
    const tone = song?.keyWithCapo || song?.mainKey || "";
    return `${item.title || song?.title || "Canto"}${tone ? ` (${tone})` : ""}`;
  }
  return item.title || item.type || "Elemento";
}

function ProgramContent({ schedule, songs, settings, compact = false }) {
  const items = getSpecialProgramItems(schedule);
  const logo = getLogoUrl(settings);
  const title = getServiceDisplayLabel(schedule);
  const theme = getScheduleTheme(schedule);
  const notes = getScheduleNotes(schedule);
  const meta = [
    formatDate(schedule?.date),
    schedule?.time,
    schedule?.leader ? `Líder: ${schedule.leader}` : "",
    theme ? `Tema: ${theme}` : ""
  ].filter(Boolean).join(" · ");
  const churchName = settings?.churchName || "";
  const showChurchSubtitle = churchName && churchName.toLowerCase() !== "roca eterna";

  if (compact) {
    return (
      <View>
        <View style={styles.miniHeader}>
          {logo ? <Image src={logo} style={styles.miniLogo} /> : null}
          <View>
            <Text style={styles.miniEvent}>Roca Eterna</Text>
            {showChurchSubtitle ? <Text style={styles.miniMeta}>{churchName}</Text> : null}
            <Text style={styles.miniEvent}>{title}</Text>
            <Text style={styles.miniMeta}>{meta}</Text>
          </View>
        </View>
        {items.map((item) => (
          <Text key={`${item.order}-${item.type}-${item.title}`} style={styles.miniItem}>
            {item.order}. {item.type === "Canto" ? `${item.position}: ` : ""}{itemTitle(item, songs)}
          </Text>
        ))}
        {notes ? <Text style={styles.miniNotes}>{notes}</Text> : null}
      </View>
    );
  }

  return (
    <>
      <View style={styles.header}>
        {logo ? <Image src={logo} style={styles.logo} /> : null}
        <View>
          <Text style={styles.church}>Roca Eterna</Text>
          {showChurchSubtitle ? <Text style={styles.churchSubtitle}>{churchName}</Text> : null}
          <Text style={styles.event}>{title}</Text>
          <Text style={styles.meta}>{meta}</Text>
        </View>
      </View>
      {items.length ? items.map((item) => (
        <View key={`${item.order}-${item.type}-${item.title}`} style={styles.row} wrap={false}>
          <Text style={styles.number}>{item.order}</Text>
          <View style={styles.itemBody}>
            <Text style={styles.itemType}>{item.type}</Text>
            <Text style={styles.itemTitle}>{itemTitle(item, songs)}</Text>
            {item.type === "Canto" ? <Text style={styles.notes}>{item.position}</Text> : null}
            {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
          </View>
        </View>
      )) : (
        <Text style={styles.notes}>Aún no hay elementos en el programa especial.</Text>
      )}
      {notes ? <Text style={styles.notes}>{notes}</Text> : null}
      <Text style={styles.footer}>Programa generado desde Roca Eterna Música.</Text>
    </>
  );
}

export function SpecialProgramDocument({ schedule, songs, settings }) {
  return (
    <Document title={getSpecialProgramFileName(schedule).replace(".pdf", "")}>
      <Page size="LETTER" style={styles.page}>
        <ProgramContent schedule={schedule} songs={songs} settings={settings} />
      </Page>
    </Document>
  );
}

export function SpecialProgramFourUpDocument({ schedule, songs, settings }) {
  return (
    <Document title={getSpecialProgramFileName(schedule, " 2 por hoja").replace(".pdf", "")}>
      <Page size="LETTER" orientation="landscape" style={styles.miniPage}>
        <View style={styles.miniGrid}>
          {[0, 1].map((copy) => (
            <View key={copy} style={styles.miniCard}>
              <ProgramContent schedule={schedule} songs={songs} settings={settings} compact />
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
