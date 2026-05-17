export const todayString = () => new Date().toISOString().slice(0, 10);

export const formatDate = (dateString) => {
  if (!dateString) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${dateString}T00:00:00`));
};

export const daysUntil = (dateString) => {
  if (!dateString) return null;
  const today = new Date(`${todayString()}T00:00:00`);
  const target = new Date(`${dateString}T00:00:00`);
  return Math.ceil((target - today) / 86400000);
};

export const inferServiceType = (schedule = {}) => {
  if (schedule.serviceType) return schedule.serviceType;
  const weekday = schedule.date ? new Date(`${schedule.date}T00:00:00`).getDay() : null;
  const time = schedule.time || "";
  if (weekday === 0 && time.startsWith("11")) return "domingo-manana";
  if (weekday === 0 && time.startsWith("17")) return "domingo-tarde";
  if (weekday === 3 && time.startsWith("19")) return "miercoles-oracion";
  return "especial";
};

export const getServiceDisplayLabel = (schedule = {}) => {
  const type = inferServiceType(schedule);
  if (type === "domingo-manana") return "Domingo AM";
  if (type === "domingo-tarde") return "Domingo PM";
  if (type === "miercoles-oracion") return "Miércoles de oración";
  return schedule.serviceLabel || schedule.type || "Servicio especial";
};

export const formatScheduleDateWithService = (schedule = {}) => {
  const date = formatDate(schedule.date);
  const service = getServiceDisplayLabel(schedule);
  return service ? `${date} · ${service}` : date;
};

export const getScheduleStartDate = (schedule = {}) => {
  if (!schedule.date) return null;
  const time = schedule.time || "00:00";
  const date = new Date(`${schedule.date}T${time}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getEstimatedServiceEndDate = (schedule = {}) => {
  const start = getScheduleStartDate(schedule);
  if (!start) return null;
  const type = inferServiceType(schedule);
  const minutesByType = {
    "domingo-manana": 120,
    "domingo-tarde": 70,
    "miercoles-oracion": 90
  };
  const minutes = minutesByType[type] || 120;
  return new Date(start.getTime() + minutes * 60 * 1000);
};

export const getCurrentOrNextSchedule = (schedules = [], now = new Date()) => {
  const candidates = [...schedules]
    .map((schedule) => ({
      schedule,
      start: getScheduleStartDate(schedule),
      end: getEstimatedServiceEndDate(schedule)
    }))
    .filter((entry) => entry.start && entry.end && entry.end.getTime() > now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  return candidates[0]?.schedule || null;
};

export const getUpcomingSchedule = (schedules) => {
  return getCurrentOrNextSchedule(schedules);
};

export const getPastSchedules = (schedules = [], now = new Date()) => {
  return [...schedules]
    .map((schedule) => ({
      schedule,
      start: getScheduleStartDate(schedule),
      end: getEstimatedServiceEndDate(schedule)
    }))
    .filter((entry) => entry.end && entry.end.getTime() <= now.getTime())
    .sort((a, b) => (b.start?.getTime() || 0) - (a.start?.getTime() || 0))
    .map((entry) => entry.schedule);
};
