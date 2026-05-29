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
const brassColor = "#b6945f";
const navyColor = "#17324f";
const blackColor = "#161616";

export const SPECIAL_PROGRAM_TYPE_COLORS = {
  "Predicaci贸n": brassColor,
  "Participaci贸n especial": navyColor
};

const normalizeHexColor = (value = "") => {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "";
};

export function getSpecialProgramTypeDefaultColor(type = "") {
  return SPECIAL_PROGRAM_TYPE_COLORS[type] || blackColor;
}

export function getSpecialProgramItemColor(item = {}) {
  return normalizeHexColor(item.categoryColor || item.typeColor || item.color) || getSpecialProgramTypeDefaultColor(item.type);
}

function cleanPrintableNotes(value = "") {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^tema sugerido:/i.test(line) && !/^posición sugerida:/i.test(line) && !/^posicion sugerida:/i.test(line))
    .join("\n");
}

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
    position: SPECIAL_SONG_POSITIONS[1],
    categoryColor: getSpecialProgramTypeDefaultColor("Canto")
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
      notes: cleanPrintableNotes(item.notes || ""),
      songId: item.songId || "",
      position: getSpecialSongPosition(index, source.length, item),
      categoryColor: getSpecialProgramItemColor(item)
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
    notes: cleanPrintableNotes(entry.notes || ""),
    songId: entry.songId || "",
    position: getSpecialSongPosition(index, scheduleSongs.length),
    categoryColor: getSpecialProgramTypeDefaultColor("Canto")
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

function getScheduleNotes(schedule = {}) {
  return cleanPrintableNotes(schedule.specialProgramNotes || schedule.programNotes || schedule.generalNotes || "");
}

const styles = StyleSheet.create({
  page: {
    padding: 38,
    fontFamily: "Helvetica",
    color: "#161616",
    backgroundColor: "#ffffff"
  },
  header: {
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    borderBottom: "1px solid #b6945f",
    paddingBottom: 14,
    marginBottom: 20,
    textAlign: "center"
  },
  logo: {
    width: 78,
    height: 78,
    objectFit: "contain"
  },
  church: {
    fontFamily: "Times-Bold",
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  churchSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: "#555",
    textAlign: "center"
  },
  event: {
    marginTop: 5,
    fontFamily: "Times-Bold",
    fontSize: 25,
    color: "#8b6a31",
    fontWeight: 700,
    textAlign: "center"
  },
  meta: {
    marginTop: 3,
    fontSize: 11,
    color: "#555",
    textAlign: "center"
  },
  row: {
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    paddingVertical: 10,
    borderBottom: "1px solid #eeeeee",
    textAlign: "center"
  },
  number: {
    fontSize: 12,
    color: "#8b6a31",
    fontWeight: 700,
    textAlign: "center"
  },
  itemBody: {
    alignItems: "center",
    textAlign: "center",
    width: "100%"
  },
  itemTitle: {
    fontFamily: "Times-Bold",
    fontSize: 16,
    fontWeight: 700,
    textAlign: "center"
  },
  itemType: {
    fontSize: 10,
    marginBottom: 2,
    textTransform: "uppercase",
    textAlign: "center"
  },
  notes: {
    marginTop: 3,
    fontSize: 11,
    color: "#555",
    lineHeight: 1.35,
    textAlign: "center"
  },
  footer: {
    position: "absolute",
    left: 38,
    right: 38,
    bottom: 24,
    borderTop: "1px solid #eeeeee",
    paddingTop: 8,
    fontSize: 9,
    color: "#777",
    textAlign: "center"
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
    padding: 16,
    justifyContent: "space-between",
    alignItems: "center",
    textAlign: "center"
  },
  miniHeader: {
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
    width: "100%",
    textAlign: "center"
  },
  miniHeaderText: {
    width: "100%",
    alignItems: "center",
    textAlign: "center"
  },
  miniContentRoot: {
    height: "100%",
    width: "100%",
    alignItems: "center",
    textAlign: "center"
  },
  miniLogo: {
    width: 28,
    height: 28,
    objectFit: "contain"
  },
  miniEvent: {
    fontSize: 10,
    fontFamily: "Times-Bold",
    fontWeight: 700,
    textAlign: "center",
    letterSpacing: 0.4
  },
  miniMeta: {
    marginTop: 2,
    fontSize: 7,
    color: "#666",
    textAlign: "center"
  },
  miniItem: {
    fontSize: 7.5,
    marginBottom: 3,
    lineHeight: 1.25,
    textAlign: "center",
    width: "100%"
  },
  miniBody: {
    flexGrow: 1,
    marginTop: 3,
    width: "100%",
    alignItems: "center"
  },
  miniRow: {
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    width: "100%",
    alignSelf: "stretch"
  },
  miniRowText: {
    width: "100%",
    alignItems: "center",
    textAlign: "center"
  },
  miniNumber: {
    color: "#8b6a31",
    fontWeight: 700,
    textAlign: "center"
  },
  miniType: {
    fontWeight: 700,
    textTransform: "uppercase",
    textAlign: "center",
    width: "100%"
  },
  miniTitle: {
    color: "#161616",
    fontFamily: "Times-Bold",
    fontWeight: 700,
    textAlign: "center",
    width: "100%"
  },
  miniPosition: {
    color: "#8b6a31",
    textAlign: "center"
  },
  miniNotes: {
    marginTop: 6,
    paddingTop: 5,
    borderTop: "1px solid #eee4d4",
    fontSize: 7,
    color: "#555",
    lineHeight: 1.25,
    textAlign: "center",
    width: "100%"
  }
});

function getCompactTypography(items = [], notes = "") {
  const itemCount = items.length || 1;
  const textLoad = items.reduce((total, item) => (
    total + String(item.title || "").length + String(item.notes || "").length + String(item.type || "").length
  ), String(notes || "").length);

  if (itemCount <= 5 && textLoad < 420) {
    return {
      logo: 54,
      event: 16,
      meta: 10,
      title: 14,
      type: 8.5,
      notes: 10,
      rowPadding: 8.5,
      bodyJustify: "space-around",
      lineHeight: 1.35
    };
  }
  if (itemCount <= 9 && textLoad < 760) {
    return {
      logo: 46,
      event: 14,
      meta: 9,
      title: 12,
      type: 7.8,
      notes: 9,
      rowPadding: 6.8,
      bodyJustify: "space-around",
      lineHeight: 1.3
    };
  }
  if (itemCount <= 14 && textLoad < 1200) {
    return {
      logo: 38,
      event: 12,
      meta: 8,
      title: 10,
      type: 6.8,
      notes: 8,
      rowPadding: 4.8,
      bodyJustify: "flex-start",
      lineHeight: 1.22
    };
  }
  return {
    logo: 32,
    event: 10.5,
    meta: 7,
    title: 8.6,
    type: 6,
    notes: 7,
    rowPadding: 3.4,
    bodyJustify: "flex-start",
    lineHeight: 1.14
  };
}

function itemTitle(item, songs = []) {
  if (item.type === "Canto" && item.songId) {
    const song = songs.find((entry) => entry.id === item.songId);
    return item.title || song?.title || "Canto";
  }
  return item.title || item.type || "Elemento";
}

function ProgramContent({ schedule, songs, settings, compact = false }) {
  const items = getSpecialProgramItems(schedule);
  const logo = getLogoUrl(settings);
  const title = getServiceDisplayLabel(schedule);
  const notes = getScheduleNotes(schedule);
  const meta = [
    formatDate(schedule?.date),
    schedule?.time,
    schedule?.leader ? `Líder: ${schedule.leader}` : ""
  ].filter(Boolean).join(" · ");
  const churchName = settings?.churchName || "";
  const showChurchSubtitle = churchName && churchName.toLowerCase() !== "roca eterna";

  if (compact) {
    const compactType = getCompactTypography(items, notes);
    return (
      <View style={styles.miniContentRoot}>
        <View style={styles.miniHeader}>
          {logo ? <Image src={logo} style={[styles.miniLogo, { width: compactType.logo, height: compactType.logo }]} /> : null}
          <View style={styles.miniHeaderText}>
            <Text style={[styles.miniEvent, { fontSize: compactType.event }]}>Roca Eterna</Text>
            {showChurchSubtitle ? <Text style={styles.miniMeta}>{churchName}</Text> : null}
            <Text style={[styles.miniEvent, { fontSize: compactType.event }]}>{title}</Text>
            <Text style={[styles.miniMeta, { fontSize: compactType.meta }]}>{meta}</Text>
          </View>
        </View>
        <View style={[styles.miniBody, { justifyContent: compactType.bodyJustify }]}>
          {items.map((item) => (
            <View
              key={`${item.order}-${item.type}-${item.title}`}
              style={[styles.miniRow, { paddingVertical: compactType.rowPadding }]}
            >
              <View style={styles.miniRowText}>
                <Text style={[styles.miniType, { color: getSpecialProgramItemColor(item), fontSize: compactType.type, lineHeight: compactType.lineHeight }]}>{item.type}</Text>
                <Text style={[styles.miniTitle, { fontSize: compactType.title, lineHeight: compactType.lineHeight }]}>
                  {itemTitle(item, songs)}
                </Text>
                {item.notes ? (
                  <Text style={[styles.miniItem, { fontSize: compactType.notes, lineHeight: compactType.lineHeight }]}>
                    {item.notes}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
        {notes ? <Text style={[styles.miniNotes, { fontSize: compactType.notes, lineHeight: compactType.lineHeight }]}>{notes}</Text> : null}
      </View>
    );
  }

  return (
    <>
      <View style={styles.header}>
        {logo ? <Image src={logo} style={styles.logo} /> : null}
        <View style={{ width: "100%", alignItems: "center", textAlign: "center" }}>
          <Text style={styles.church}>Roca Eterna</Text>
          {showChurchSubtitle ? <Text style={styles.churchSubtitle}>{churchName}</Text> : null}
          <Text style={styles.event}>{title}</Text>
          <Text style={styles.meta}>{meta}</Text>
        </View>
      </View>
      {items.length ? items.map((item) => (
        <View key={`${item.order}-${item.type}-${item.title}`} style={styles.row} wrap={false}>
          <View style={styles.itemBody}>
            <Text style={[styles.itemType, { color: getSpecialProgramItemColor(item) }]}>{item.type}</Text>
            <Text style={styles.itemTitle}>{itemTitle(item, songs)}</Text>
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
