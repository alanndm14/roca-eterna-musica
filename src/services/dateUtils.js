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

export const getUpcomingSchedule = (schedules) => {
  const today = todayString();
  return [...schedules]
    .filter((schedule) => schedule.date >= today)
    .sort((a, b) => `${a.date}${a.time || ""}`.localeCompare(`${b.date}${b.time || ""}`))[0];
};

export const getPastSchedules = (schedules) => {
  const today = todayString();
  return [...schedules]
    .filter((schedule) => schedule.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));
};
