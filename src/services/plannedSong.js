export const isPlannedSpecial = (item) => item?.kind === "special";

export const plannedSongLabel = (item) => isPlannedSpecial(item) ? "Especial del evento" : "Canto nuevo";

export const plannedServiceOptions = [
  { value: "domingo_am", label: "Domingo AM" },
  { value: "domingo_pm", label: "Domingo PM" },
  { value: "miercoles", label: "Miércoles" },
  { value: "especial", label: "Especial" },
  { value: "otro", label: "Otro" }
];

export const plannedServiceLabel = (value) => plannedServiceOptions.find((option) => option.value === value)?.label || value || "Servicio";

export const plannedSongStatusLabel = (item) => item.status === "estrenado" && isPlannedSpecial(item)
  ? "Cantado"
  : { planeado: "Planeado", listo: "Listo", estrenado: "Estrenado", pospuesto: "Pospuesto" }[item.status] || item.status || "Planeado";
