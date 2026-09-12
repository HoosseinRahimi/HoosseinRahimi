export const compact = (value) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);

export const truncate = (value, length) =>
  value.length > length ? `${value.slice(0, length - 1)}…` : value;

export const sumBy = (items, select) => items.reduce((sum, item) => sum + select(item), 0);

export const isoDate = (value) => new Date(value).toISOString().slice(0, 10);

export const shortDate = (value) =>
  new Date(value).toLocaleDateString("en", { month: "short", day: "numeric" });
