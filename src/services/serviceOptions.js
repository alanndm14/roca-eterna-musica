export const defaultWorshipLeaderOptions = [
  "Ps. José Campos",
  "Ps. Eduardo",
  "Adrián",
  "Esaú"
];

export const defaultServiceTypeOptions = [
  { value: "miercoles-oracion", label: "Miércoles de oración", time: "19:00", weekday: 3 },
  { value: "domingo-manana", label: "Domingo mañana", time: "11:00", weekday: 0 },
  { value: "domingo-tarde", label: "Domingo tarde", time: "17:00", weekday: 0 },
  { value: "especial", label: "Especial / aniversario / conferencia / otro", time: "", weekday: null, special: true }
];

const slugify = (value = "") => String(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

export function getWorshipLeaderOptions(settings = {}) {
  const configured = Array.isArray(settings.worshipLeaderOptions)
    ? settings.worshipLeaderOptions.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  return configured.length ? configured : defaultWorshipLeaderOptions;
}

export function normalizeServiceTypeOption(option, index = 0) {
  const label = String(option?.label || option?.name || "").trim();
  if (!label) return null;
  return {
    value: String(option?.value || slugify(label) || `servicio-${index + 1}`),
    label,
    time: String(option?.time || ""),
    weekday: option?.weekday === null || option?.weekday === "" || option?.weekday === undefined
      ? null
      : Number(option.weekday),
    special: Boolean(option?.special || option?.value === "especial")
  };
}

export function getServiceTypeOptions(settings = {}) {
  const configured = Array.isArray(settings.serviceTypeOptions)
    ? settings.serviceTypeOptions.map(normalizeServiceTypeOption).filter(Boolean)
    : [];
  return configured.length ? configured : defaultServiceTypeOptions;
}

export function getAssistantServiceOptions(settings = {}) {
  return getServiceTypeOptions(settings).map((option) => ({
    ...option,
    assistantLabel: option.label,
    serviceType: option.value,
    serviceLabel: option.label
  }));
}
