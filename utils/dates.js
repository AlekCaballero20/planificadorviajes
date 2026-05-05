/* =========================================================
  dates.js
  Utilidades de fechas para Brújula
  Manejo seguro de fechas locales en formato YYYY-MM-DD
========================================================= */

/* =========================================================
  CONSTANTES
========================================================= */

export const DATE_FORMATS = {
  iso: "iso",
  short: "short",
  medium: "medium",
  full: "full",
  weekday: "weekday",
};

export const MS_PER_DAY = 86_400_000;

export const DEFAULT_LOCALE = "es-CO";

/* =========================================================
  FECHA ACTUAL
========================================================= */

export function getTodayDate() {
  const now = new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12,
    0,
    0,
    0
  );
}

export function getTodayISO() {
  return dateToISO(getTodayDate());
}

export function getCurrentYear() {
  return getTodayDate().getFullYear();
}

/* =========================================================
  PARSEO SEGURO
========================================================= */

export function parseLocalDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;

    return new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
      12,
      0,
      0,
      0
    );
  }

  const str = String(value).trim();

  if (!str) return null;

  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;

    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      12,
      0,
      0,
      0
    );

    return isValidDate(date) ? date : null;
  }

  const fallbackDate = new Date(str);

  if (!isValidDate(fallbackDate)) return null;

  return new Date(
    fallbackDate.getFullYear(),
    fallbackDate.getMonth(),
    fallbackDate.getDate(),
    12,
    0,
    0,
    0
  );
}

export function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

export function isValidISODate(value) {
  return Boolean(parseLocalDate(value));
}

/* =========================================================
  CONVERSIÓN
========================================================= */

export function dateToISO(dateValue) {
  const date = parseLocalDate(dateValue);

  if (!date) return "";

  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());

  return `${year}-${month}-${day}`;
}

export function dateToInputValue(dateValue) {
  return dateToISO(dateValue);
}

export function inputValueToDate(value) {
  return parseLocalDate(value);
}

export function pad2(value) {
  return String(value).padStart(2, "0");
}

/* =========================================================
  FORMATO VISUAL
========================================================= */

export function formatDate(
  value,
  {
    locale = DEFAULT_LOCALE,
    format = DATE_FORMATS.medium,
    fallback = "Sin fecha",
  } = {}
) {
  const date = parseLocalDate(value);

  if (!date) return fallback;

  const optionsByFormat = {
    [DATE_FORMATS.short]: {
      day: "numeric",
      month: "short",
    },

    [DATE_FORMATS.medium]: {
      day: "numeric",
      month: "long",
    },

    [DATE_FORMATS.full]: {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    },

    [DATE_FORMATS.weekday]: {
      weekday: "long",
      day: "numeric",
      month: "long",
    },

    [DATE_FORMATS.iso]: null,
  };

  if (format === DATE_FORMATS.iso) {
    return dateToISO(date);
  }

  const options = optionsByFormat[format] || optionsByFormat[DATE_FORMATS.medium];

  return date.toLocaleDateString(locale, options);
}

export function formatShortDate(value, options = {}) {
  return formatDate(value, {
    ...options,
    format: DATE_FORMATS.short,
  });
}

export function formatMediumDate(value, options = {}) {
  return formatDate(value, {
    ...options,
    format: DATE_FORMATS.medium,
  });
}

export function formatFullDate(value, options = {}) {
  return formatDate(value, {
    ...options,
    format: DATE_FORMATS.full,
  });
}

export function formatWeekdayDate(value, options = {}) {
  return formatDate(value, {
    ...options,
    format: DATE_FORMATS.weekday,
  });
}

/* =========================================================
  RANGOS
========================================================= */

export function formatDateRange(
  start,
  end,
  {
    locale = DEFAULT_LOCALE,
    fallback = "Fechas sin definir",
  } = {}
) {
  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);

  if (!startDate && !endDate) return fallback;

  if (startDate && !endDate) {
    return `Desde ${formatMediumDate(startDate, { locale })}`;
  }

  if (!startDate && endDate) {
    return `Hasta ${formatMediumDate(endDate, { locale })}`;
  }

  if (dateToISO(startDate) === dateToISO(endDate)) {
    return formatFullDate(startDate, { locale });
  }

  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth();

  if (sameMonth) {
    return `${startDate.getDate()} al ${endDate.getDate()} de ${endDate.toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
    })}`;
  }

  if (sameYear) {
    return `${formatMediumDate(startDate, { locale })} al ${formatMediumDate(endDate, { locale })}`;
  }

  return `${formatFullDate(startDate, { locale })} al ${formatFullDate(endDate, { locale })}`;
}

/* =========================================================
  CÁLCULOS DE VIAJE
========================================================= */

export function nightsCount(start, end) {
  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);

  if (!startDate || !endDate) return null;

  const diff = diffInDays(startDate, endDate);

  return diff >= 0 ? diff : null;
}

export function daysCountInclusive(start, end) {
  const nights = nightsCount(start, end);

  if (nights === null) return null;

  return nights + 1;
}

export function diffInDays(start, end) {
  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);

  if (!startDate || !endDate) return null;

  return Math.round((endDate - startDate) / MS_PER_DAY);
}

export function daysUntil(value) {
  const date = parseLocalDate(value);
  const today = getTodayDate();

  if (!date) return null;

  return diffInDays(today, date);
}

export function daysSince(value) {
  const date = parseLocalDate(value);
  const today = getTodayDate();

  if (!date) return null;

  return diffInDays(date, today);
}

/* =========================================================
  ESTADOS TEMPORALES
========================================================= */

export function isPastDate(value) {
  const date = parseLocalDate(value);
  const today = getTodayDate();

  if (!date) return false;

  return date < today;
}

export function isToday(value) {
  const date = parseLocalDate(value);
  const today = getTodayDate();

  if (!date) return false;

  return dateToISO(date) === dateToISO(today);
}

export function isFutureDate(value) {
  const date = parseLocalDate(value);
  const today = getTodayDate();

  if (!date) return false;

  return date > today;
}

export function isDateBetween(value, start, end) {
  const date = parseLocalDate(value);
  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);

  if (!date || !startDate || !endDate) return false;

  return date >= startDate && date <= endDate;
}

export function isTripUpcoming(trip) {
  if (!trip?.fechaSalida) return false;
  if (trip.estado === "completado") return false;

  return isToday(trip.fechaSalida) || isFutureDate(trip.fechaSalida);
}

export function isTripActiveNow(trip) {
  if (!trip?.fechaSalida || !trip?.fechaRegreso) return false;

  const today = getTodayISO();

  return isDateBetween(today, trip.fechaSalida, trip.fechaRegreso);
}

export function isTripCompletedByDate(trip) {
  if (!trip?.fechaRegreso) return false;

  return isPastDate(trip.fechaRegreso);
}

/* =========================================================
  TEXTOS HUMANOS
========================================================= */

export function getTripDateSummary(trip) {
  if (!trip) return "Sin fechas";

  const { fechaSalida, fechaRegreso } = trip;

  if (!fechaSalida && !fechaRegreso) {
    return "Fechas sin definir";
  }

  const nights = nightsCount(fechaSalida, fechaRegreso);

  if (nights !== null) {
    return `${formatDateRange(fechaSalida, fechaRegreso)} · ${nights} noche${nights === 1 ? "" : "s"}`;
  }

  return formatDateRange(fechaSalida, fechaRegreso);
}

export function getRelativeDateLabel(value) {
  const diff = daysUntil(value);

  if (diff === null) return "Sin fecha";

  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";

  if (diff > 1) {
    return `En ${diff} días`;
  }

  return `Hace ${Math.abs(diff)} días`;
}

export function getTripCountdownLabel(trip) {
  if (!trip?.fechaSalida) return "Sin fecha de salida";

  if (isTripActiveNow(trip)) {
    return "Viajando ahora";
  }

  const diff = daysUntil(trip.fechaSalida);

  if (diff === null) return "Sin fecha de salida";
  if (diff === 0) return "Sale hoy";
  if (diff === 1) return "Sale mañana";

  if (diff > 1) {
    return `Sale en ${diff} días`;
  }

  if (trip.fechaRegreso && isPastDate(trip.fechaRegreso)) {
    return "Viaje finalizado";
  }

  return "Viaje iniciado";
}

/* =========================================================
  ORDENAMIENTO
========================================================= */

export function sortDateValues(a, b, { emptyLast = true } = {}) {
  const dateA = parseLocalDate(a);
  const dateB = parseLocalDate(b);

  if (!dateA && !dateB) return 0;

  if (!dateA) return emptyLast ? 1 : -1;
  if (!dateB) return emptyLast ? -1 : 1;

  return dateA - dateB;
}

export function sortTripsByStartDate(a, b) {
  return sortDateValues(a?.fechaSalida, b?.fechaSalida);
}

export function sortDateKeys(a, b, { noDateKey = "__no_date" } = {}) {
  if (a === noDateKey && b === noDateKey) return 0;
  if (a === noDateKey) return 1;
  if (b === noDateKey) return -1;

  return sortDateValues(a, b);
}

/* =========================================================
  AGRUPACIÓN
========================================================= */

export function groupItemsByDate(items = [], field = "date", noDateKey = "__no_date") {
  return items.reduce((groups, item) => {
    const key = item?.[field] || noDateKey;

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(item);

    return groups;
  }, {});
}

export function getSortedDateGroupKeys(groups = {}, options = {}) {
  return Object.keys(groups).sort((a, b) => sortDateKeys(a, b, options));
}

/* =========================================================
  VALIDACIÓN DE RANGOS
========================================================= */

export function validateDateRange(start, end) {
  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);

  if (!start && !end) {
    return {
      ok: true,
      message: "Sin fechas definidas.",
    };
  }

  if (start && !startDate) {
    return {
      ok: false,
      message: "La fecha de salida no es válida.",
    };
  }

  if (end && !endDate) {
    return {
      ok: false,
      message: "La fecha de regreso no es válida.",
    };
  }

  if (startDate && endDate && endDate < startDate) {
    return {
      ok: false,
      message: "La fecha de regreso no puede ser anterior a la salida.",
    };
  }

  return {
    ok: true,
    message: "Rango de fechas válido.",
  };
}