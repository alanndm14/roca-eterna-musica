const parseEmails = (value = "") =>
  value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const INITIAL_ADMIN_EMAILS = parseEmails(import.meta.env.VITE_INITIAL_ADMIN_EMAILS);

export const isInitialAdminEmail = (email) =>
  Boolean(email) && INITIAL_ADMIN_EMAILS.includes(email.toLowerCase());
