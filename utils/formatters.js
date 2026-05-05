/* =========================================================
  formatters.js
  Utilidades de formato para Brújula
  Dinero, texto, porcentajes, HTML seguro y helpers visuales
========================================================= */

/* =========================================================
  CONSTANTES
========================================================= */

export const DEFAULT_LOCALE = "es-CO";
export const DEFAULT_CURRENCY = "COP $";

export const CURRENCY_SYMBOLS = {
  "COP $": "$",
  "USD $": "$",
  "EUR €": "€",
  "MXN $": "$",
  "ARS $": "$",
  "BRL R$": "R$",
};

export const STATUS_LABELS = {
  sonando: "Soñándolo",
  planificando: "Planeándolo",
  reservado: "Reservado",
  "en-camino": "En camino",
  viviendo: "Viviéndolo",
  completado: "Ya fue, pero quedó en el alma",
};

export const STATUS_ICONS = {
  sonando: "💭",
  planificando: "🗓️",
  reservado: "✅",
  "en-camino": "🚀",
  viviendo: "🌟",
  completado: "📸",
};

export const ROLE_LABELS = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

export const ROLE_PUBLIC_LABELS = {
  owner: "Mío",
  editor: "Editor",
  viewer: "Compartido",
};

/* =========================================================
  NÚMEROS
========================================================= */

export function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

export function clampNumber(value, min = 0, max = 100) {
  const number = toNumber(value);

  return Math.min(Math.max(number, min), max);
}

export function roundNumber(value, decimals = 0) {
  const number = toNumber(value);
  const factor = 10 ** decimals;

  return Math.round(number * factor) / factor;
}

export function formatNumber(
  value,
  {
    locale = DEFAULT_LOCALE,
    fallback = "0",
    maximumFractionDigits = 0,
    minimumFractionDigits = 0,
  } = {}
) {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;

  return number.toLocaleString(locale, {
    maximumFractionDigits,
    minimumFractionDigits,
  });
}

export function formatDecimal(
  value,
  {
    locale = DEFAULT_LOCALE,
    decimals = 1,
    fallback = "0",
  } = {}
) {
  return formatNumber(value, {
    locale,
    fallback,
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

export function formatPercent(
  value,
  {
    decimals = 0,
    fallback = "0%",
    clamp = true,
  } = {}
) {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;

  const safeNumber = clamp ? clampNumber(number, 0, 100) : number;

  return `${formatNumber(safeNumber, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  })}%`;
}

export function calculatePercent(part, total, { clamp = true } = {}) {
  const safePart = toNumber(part);
  const safeTotal = toNumber(total);

  if (safeTotal <= 0) return 0;

  const percent = (safePart / safeTotal) * 100;

  return clamp ? clampNumber(percent, 0, 100) : percent;
}

/* =========================================================
  DINERO
========================================================= */

export function getCurrencySymbol(currency = DEFAULT_CURRENCY) {
  const safeCurrency = String(currency || DEFAULT_CURRENCY).trim();

  if (CURRENCY_SYMBOLS[safeCurrency]) {
    return CURRENCY_SYMBOLS[safeCurrency];
  }

  const parts = safeCurrency.split(" ");

  return parts[1] || "$";
}

export function getCurrencyCode(currency = DEFAULT_CURRENCY) {
  const safeCurrency = String(currency || DEFAULT_CURRENCY).trim();
  const parts = safeCurrency.split(" ");

  return parts[0] || "COP";
}

export function formatMoney(
  value,
  currency = DEFAULT_CURRENCY,
  {
    locale = DEFAULT_LOCALE,
    fallback = "$0",
    decimals = 0,
    compact = false,
  } = {}
) {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;

  if (compact) {
    return formatCompactMoney(number, currency, {
      locale,
      fallback,
    });
  }

  const symbol = getCurrencySymbol(currency);

  return `${symbol}${number.toLocaleString(locale, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  })}`;
}

export function formatCompactMoney(
  value,
  currency = DEFAULT_CURRENCY,
  {
    locale = DEFAULT_LOCALE,
    fallback = "$0",
  } = {}
) {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;

  const symbol = getCurrencySymbol(currency);
  const abs = Math.abs(number);

  if (abs >= 1_000_000_000) {
    return `${symbol}${formatDecimal(number / 1_000_000_000, {
      locale,
      decimals: 1,
    })}B`;
  }

  if (abs >= 1_000_000) {
    return `${symbol}${formatDecimal(number / 1_000_000, {
      locale,
      decimals: 1,
    })}M`;
  }

  if (abs >= 1_000) {
    return `${symbol}${formatNumber(Math.round(number / 1_000), {
      locale,
    })}K`;
  }

  return formatMoney(number, currency, {
    locale,
  });
}

export function formatBudgetRatio(
  spent = 0,
  budget = 0,
  currency = DEFAULT_CURRENCY
) {
  return `${formatMoney(spent, currency)} de ${formatMoney(budget, currency)}`;
}

export function getBudgetStatus(spent = 0, budget = 0) {
  const safeSpent = toNumber(spent);
  const safeBudget = toNumber(budget);

  if (safeBudget <= 0 && safeSpent > 0) {
    return "over";
  }

  if (safeBudget <= 0) {
    return "empty";
  }

  const percent = calculatePercent(safeSpent, safeBudget);

  if (percent < 75) return "ok";
  if (percent < 100) return "warn";
  return "over";
}

export function getBudgetStatusLabel(status) {
  const labels = {
    empty: "Sin presupuesto",
    ok: "Controlado",
    warn: "Cerca del límite",
    over: "Pasado del presupuesto",
  };

  return labels[status] || labels.empty;
}

/* =========================================================
  TEXTO
========================================================= */

export function normalizeText(value) {
  return String(value || "").trim();
}

export function normalizeSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function capitalizeFirst(value) {
  const text = normalizeText(value);

  if (!text) return "";

  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

export function titleCase(value) {
  const text = normalizeText(value).toLowerCase();

  if (!text) return "";

  return text
    .split(" ")
    .filter(Boolean)
    .map((word) => capitalizeFirst(word))
    .join(" ");
}

export function truncateText(value, maxLength = 80, suffix = "…") {
  const text = normalizeText(value);

  if (text.length <= maxLength) return text;

  return `${text.slice(0, Math.max(maxLength - suffix.length, 0)).trim()}${suffix}`;
}

export function fallbackText(value, fallback = "Sin definir") {
  const text = normalizeText(value);

  return text || fallback;
}

export function pluralize(
  count,
  singular,
  plural = `${singular}s`,
  {
    includeCount = true,
  } = {}
) {
  const number = toNumber(count);
  const word = number === 1 ? singular : plural;

  return includeCount ? `${number} ${word}` : word;
}

export function joinList(items = [], fallback = "Sin datos") {
  const cleanItems = items
    .map((item) => normalizeText(item))
    .filter(Boolean);

  if (!cleanItems.length) return fallback;

  if (cleanItems.length === 1) return cleanItems[0];

  if (cleanItems.length === 2) {
    return `${cleanItems[0]} y ${cleanItems[1]}`;
  }

  return `${cleanItems.slice(0, -1).join(", ")} y ${cleanItems.at(-1)}`;
}

/* =========================================================
  ESTADOS / ROLES
========================================================= */

export function formatStatusLabel(status = "planificando") {
  return STATUS_LABELS[status] || STATUS_LABELS.planificando;
}

export function formatStatusIcon(status = "planificando") {
  return STATUS_ICONS[status] || STATUS_ICONS.planificando;
}

export function formatStatus(status = "planificando") {
  return `${formatStatusIcon(status)} ${formatStatusLabel(status)}`;
}

export function formatRoleLabel(role = "viewer") {
  return ROLE_LABELS[role] || ROLE_LABELS.viewer;
}

export function formatPublicRoleLabel(role = "viewer") {
  return ROLE_PUBLIC_LABELS[role] || ROLE_PUBLIC_LABELS.viewer;
}

export function getRoleDescription(role = "viewer") {
  const descriptions = {
    owner: "Puede editar, compartir y eliminar el viaje.",
    editor: "Puede ver y editar el viaje.",
    viewer: "Puede ver el viaje, pero no editarlo.",
  };

  return descriptions[role] || descriptions.viewer;
}

/* =========================================================
  VIAJES
========================================================= */

export function formatTripTitle(trip) {
  return fallbackText(trip?.title, "Sin título");
}

export function formatTripDestination(trip) {
  return fallbackText(trip?.destino, "Destino sin definir");
}

export function formatTravelers(count) {
  const travelers = toNumber(count);

  if (!travelers) return "Viajeros sin definir";

  return pluralize(travelers, "viajero", "viajeros");
}

export function formatNights(count) {
  if (count === null || count === undefined) return "Noches sin definir";

  const nights = toNumber(count);

  return pluralize(nights, "noche", "noches");
}

export function formatActivitiesCount(count) {
  return pluralize(toNumber(count), "actividad", "actividades");
}

export function formatPackingProgress(packed = 0, total = 0) {
  const safePacked = toNumber(packed);
  const safeTotal = toNumber(total);
  const percent = safeTotal > 0
    ? Math.round((safePacked / safeTotal) * 100)
    : 0;

  return {
    packed: safePacked,
    total: safeTotal,
    pending: Math.max(safeTotal - safePacked, 0),
    percent,
    label: `Empaque: ${percent}% (${safePacked}/${safeTotal})`,
    shortLabel: safeTotal ? `${safePacked}/${safeTotal}` : "0",
  };
}

/* =========================================================
  ARRAYS / COLECCIONES
========================================================= */

export function uniqueValues(values = []) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

export function uniqueEmails(emails = []) {
  return Array.from(
    new Set(
      emails
        .map(normalizeEmail)
        .filter(Boolean)
    )
  );
}

export function sortByText(items = [], field = null) {
  return items.slice().sort((a, b) => {
    const textA = normalizeSearch(field ? a?.[field] : a);
    const textB = normalizeSearch(field ? b?.[field] : b);

    return textA.localeCompare(textB);
  });
}

export function groupBy(items = [], getKey) {
  return items.reduce((groups, item) => {
    const key = typeof getKey === "function"
      ? getKey(item)
      : item?.[getKey];

    const safeKey = key || "__empty";

    if (!groups[safeKey]) {
      groups[safeKey] = [];
    }

    groups[safeKey].push(item);

    return groups;
  }, {});
}

/* =========================================================
  HTML SEGURO
========================================================= */

export function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function escapeAttr(value) {
  return escapeHTML(value);
}

export function safeHTML(value, fallback = "") {
  const text = normalizeText(value);

  return text ? escapeHTML(text) : escapeHTML(fallback);
}

export function nl2br(value) {
  return escapeHTML(value).replace(/\n/g, "<br>");
}

export function renderEmptyHTML({
  icon = "✨",
  title = "",
  text = "No hay información todavía.",
  className = "empty",
} = {}) {
  return `
    <div class="${escapeAttr(className)}">
      <div class="ei" aria-hidden="true">${escapeHTML(icon)}</div>
      ${title ? `<h3>${escapeHTML(title)}</h3>` : ""}
      <p>${text}</p>
    </div>
  `;
}

/* =========================================================
  CSS / CLASES
========================================================= */

export function classNames(...values) {
  return values
    .flatMap((value) => {
      if (!value) return [];

      if (typeof value === "string") return [value];

      if (Array.isArray(value)) return value;

      if (typeof value === "object") {
        return Object.entries(value)
          .filter(([, enabled]) => Boolean(enabled))
          .map(([className]) => className);
      }

      return [];
    })
    .filter(Boolean)
    .join(" ");
}

export function statusClass(status = "planificando") {
  return `status-${String(status || "planificando").replaceAll(" ", "-")}`;
}

export function roleClass(role = "viewer") {
  return `role-${String(role || "viewer").replaceAll(" ", "-")}`;
}

export function budgetBarClass(statusOrPercent) {
  if (typeof statusOrPercent === "string") {
    const status = statusOrPercent;

    if (status === "ok") return "bar-ok";
    if (status === "warn") return "bar-warn";
    if (status === "over") return "bar-over";

    return "bar-ok";
  }

  const percent = toNumber(statusOrPercent);

  if (percent < 75) return "bar-ok";
  if (percent < 100) return "bar-warn";
  return "bar-over";
}

/* =========================================================
  ATRIBUTOS / DATASETS
========================================================= */

export function dataAttr(value) {
  return escapeAttr(String(value ?? ""));
}

export function boolAttr(condition, attr = "disabled") {
  return condition ? attr : "";
}

export function selectedAttr(value, expected) {
  return String(value) === String(expected) ? "selected" : "";
}

export function checkedAttr(value) {
  return Boolean(value) ? "checked" : "";
}

/* =========================================================
  FORMULARIOS
========================================================= */

export function getInputValue(id, fallback = "") {
  return document.getElementById(id)?.value ?? fallback;
}

export function setInputValue(id, value = "") {
  const input = document.getElementById(id);

  if (!input) return;

  input.value = value ?? "";
}

export function clearInputs(ids = []) {
  ids.forEach((id) => setInputValue(id, ""));
}

export function setDisabled(selector, disabled = true) {
  document.querySelectorAll(selector).forEach((element) => {
    element.disabled = Boolean(disabled);
  });
}

/* =========================================================
  ERRORES
========================================================= */

export function formatErrorMessage(error, fallback = "Ocurrió un error inesperado.") {
  return (
    error?.friendlyMessage ||
    error?.message ||
    error?.code ||
    fallback
  );
}

/* =========================================================
  DEBUG
========================================================= */

export function prettyJSON(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}