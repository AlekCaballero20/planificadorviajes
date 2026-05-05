/* =========================================================
  activities.ui.js
  UI de Actividades para Brújula
  Renderiza itinerario, formulario, agrupación por fechas
  y acciones de completar/eliminar actividades.
========================================================= */

/* =========================================================
  CONSTANTES VISUALES
========================================================= */

export const ACTIVITY_COLORS = Object.freeze({
  "🍽️ Comida": "#ff7a59",
  "🏛️ Cultural": "#9b72cf",
  "🏖️ Playa": "#10a99a",
  "🧗 Aventura": "#f5a524",
  "🛍️ Compras": "#ec4899",
  "🚌 Transporte": "#3b82f6",
  "🏨 Alojamiento": "#16a34a",
  "📸 Fotos y paseos": "#f59e0b",
  "🎉 Entretenimiento": "#f97316",
  "🧘 Descanso": "#8b5cf6",
  "⚙️ Otro": "#8b8199",
});

export const DEFAULT_ACTIVITY_CATEGORY = "⚙️ Otro";

const NO_DATE_KEY = "__no_date";
const DEFAULT_CURRENCY = "COP $";

const ACTIVITY_FORM_IDS = Object.freeze({
  form: "activityForm",
  name: "actName",
  date: "actDate",
  time: "actTime",
  cat: "actCat",
  cost: "actCost",
  badge: "actBadge",
  container: "activitiesContainer",
});

/* =========================================================
  ESTADO INTERNO
========================================================= */

const activitiesUIState = {
  readonly: true,
  tripId: null,
  currency: DEFAULT_CURRENCY,
  callbacks: {
    onAddActivity: null,
    onToggleActivity: null,
    onDeleteActivity: null,
  },
};

/* =========================================================
  INIT
========================================================= */

export function initActivitiesUI(options = {}) {
  activitiesUIState.callbacks = {
    ...activitiesUIState.callbacks,
    ...options,
  };

  bindActivitiesEvents();

  return {
    render: renderActivities,
    clear: clearActivitiesUI,
    setReadonly: setActivitiesReadonlyMode,
    clearForm: clearActivityForm,
    collectForm: collectActivityForm,
  };
}

function bindActivitiesEvents() {
  if (document.body.dataset.activitiesUiBound === "true") return;

  document.body.dataset.activitiesUiBound = "true";

  document.addEventListener("click", handleActivitiesClick);
  document.addEventListener("keydown", handleActivitiesKeydown);

  /*
    Captura el submit antes de otros listeners globales.
    Así evitamos duplicados o recargas fantasma, esa tradición absurda
    de los formularios que creen que todo debe enviarse a una URL.
  */
  document.addEventListener("submit", handleActivitiesSubmit, true);
}

/* =========================================================
  EVENTOS
========================================================= */

function handleActivitiesSubmit(event) {
  const form = event.target?.closest?.(`#${ACTIVITY_FORM_IDS.form}`);

  if (!form) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  confirmAddActivity();
}

function handleActivitiesClick(event) {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;

  const action = actionTarget.dataset.action;

  if (action === "add-activity") {
    event.preventDefault();
    confirmAddActivity();
    return;
  }

  if (action === "toggle-activity") {
    event.preventDefault();

    const activityId = actionTarget.dataset.activityId;

    if (!activityId || activitiesUIState.readonly) return;

    activitiesUIState.callbacks.onToggleActivity?.({
      tripId: activitiesUIState.tripId,
      activityId,
    });

    return;
  }

  if (action === "delete-activity") {
    event.preventDefault();

    const activityId = actionTarget.dataset.activityId;

    if (!activityId || activitiesUIState.readonly) return;

    activitiesUIState.callbacks.onDeleteActivity?.({
      tripId: activitiesUIState.tripId,
      activityId,
    });
  }
}

function handleActivitiesKeydown(event) {
  if (event.key !== "Enter") return;

  if (event.target?.id === ACTIVITY_FORM_IDS.name) {
    event.preventDefault();
    confirmAddActivity();
  }
}

/* =========================================================
  RENDER PRINCIPAL
========================================================= */

export function renderActivities({
  trip,
  activities = null,
  currency = null,
  readonly = true,
} = {}) {
  if (!trip && !Array.isArray(activities)) {
    clearActivitiesUI();
    return;
  }

  const safeActivities = Array.isArray(activities)
    ? normalizeActivitiesForUI(activities)
    : normalizeActivitiesForUI(trip?.activities);

  activitiesUIState.tripId = trip?.id || activitiesUIState.tripId || null;
  activitiesUIState.currency = currency || trip?.currency || DEFAULT_CURRENCY;
  activitiesUIState.readonly = Boolean(readonly);

  renderActivitiesList(safeActivities, activitiesUIState.currency);
  updateActivitiesBadge(safeActivities.length);
  setActivitiesReadonlyMode(activitiesUIState.readonly);
}

export function renderActivitiesList(activities = [], currency = DEFAULT_CURRENCY) {
  const container = document.getElementById(ACTIVITY_FORM_IDS.container);
  if (!container) return;

  container.innerHTML = "";

  const safeActivities = normalizeActivitiesForUI(activities);

  if (!safeActivities.length) {
    container.innerHTML = renderEmptyActivities();
    return;
  }

  const groups = groupActivitiesByDate(safeActivities);
  const sortedKeys = Object.keys(groups).sort(sortDateKeys);

  const fragment = document.createDocumentFragment();

  sortedKeys.forEach((dateKey) => {
    fragment.appendChild(
      createActivityDayGroup({
        dateKey,
        activities: groups[dateKey],
        currency,
        readonly: activitiesUIState.readonly,
      })
    );
  });

  container.appendChild(fragment);
}

/* =========================================================
  GRUPOS POR DÍA
========================================================= */

export function createActivityDayGroup({
  dateKey,
  activities = [],
  currency = DEFAULT_CURRENCY,
  readonly = true,
} = {}) {
  const group = document.createElement("section");
  group.className = "day-group";
  group.dataset.dateGroup = dateKey || NO_DATE_KEY;

  const label = dateKey === NO_DATE_KEY
    ? "Sin fecha"
    : fmtFullDate(dateKey);

  group.innerHTML = `
    <div class="day-label">${escapeHTML(label)}</div>
  `;

  activities
    .slice()
    .sort(sortActivitiesInDay)
    .forEach((activity) => {
      group.appendChild(
        createActivityElement({
          activity,
          currency,
          readonly,
        })
      );
    });

  return group;
}

/* =========================================================
  ITEM DE ACTIVIDAD
========================================================= */

export function createActivityElement({
  activity,
  currency = DEFAULT_CURRENCY,
  readonly = true,
} = {}) {
  const safeActivity = normalizeActivityForUI(activity);

  const item = document.createElement("article");
  item.className = `activity-item ${safeActivity.done ? "done" : ""}`;
  item.dataset.activityId = safeActivity.id;

  const category = safeActivity.cat || DEFAULT_ACTIVITY_CATEGORY;
  const color = ACTIVITY_COLORS[category] || ACTIVITY_COLORS[DEFAULT_ACTIVITY_CATEGORY];
  const bg = `${color}22`;

  item.innerHTML = `
    <button
      class="check-button ${safeActivity.done ? "checked" : ""}"
      type="button"
      aria-label="${safeActivity.done ? "Marcar como pendiente" : "Marcar como hecha"}"
      data-action="toggle-activity"
      data-activity-id="${escapeAttr(safeActivity.id)}"
      ${readonly ? "disabled" : ""}
    >
      ${safeActivity.done ? "✓" : ""}
    </button>

    <div class="activity-main">
      <strong class="activity-title">
        ${escapeHTML(safeActivity.name || "Actividad")}
      </strong>

      <div class="activity-meta">
        ${
          safeActivity.time
            ? `<span class="activity-time">🕒 ${escapeHTML(safeActivity.time)}</span>`
            : ""
        }

        <span class="activity-tag" style="color:${color};background:${bg}">
          ${escapeHTML(category)}
        </span>

        ${
          safeActivity.cost > 0
            ? `<span class="activity-cost">${formatMoney(safeActivity.cost, currency)}</span>`
            : ""
        }
      </div>
    </div>

    <div class="activity-actions">
      <button
        class="delete-line-button"
        type="button"
        title="Eliminar actividad"
        aria-label="Eliminar actividad ${escapeAttr(safeActivity.name || "actividad")}"
        data-action="delete-activity"
        data-activity-id="${escapeAttr(safeActivity.id)}"
        ${readonly ? "disabled" : ""}
      >
        ×
      </button>
    </div>
  `;

  return item;
}

/* =========================================================
  FORMULARIO
========================================================= */

export function collectActivityForm() {
  return {
    name: getValue(ACTIVITY_FORM_IDS.name).trim(),
    date: cleanDate(getValue(ACTIVITY_FORM_IDS.date)),
    time: cleanTime(getValue(ACTIVITY_FORM_IDS.time)),
    cat: cleanCategory(getValue(ACTIVITY_FORM_IDS.cat)),
    cost: Math.max(0, toNumber(getValue(ACTIVITY_FORM_IDS.cost))),
  };
}

function confirmAddActivity() {
  if (activitiesUIState.readonly) return;

  if (!activitiesUIState.tripId) {
    focusField(ACTIVITY_FORM_IDS.name);

    activitiesUIState.callbacks.onAddActivity?.({
      tripId: null,
      error: "missing-trip",
    });

    return;
  }

  const activityData = collectActivityForm();

  if (!activityData.name) {
    focusField(ACTIVITY_FORM_IDS.name);

    activitiesUIState.callbacks.onAddActivity?.({
      tripId: activitiesUIState.tripId,
      error: "missing-name",
    });

    return;
  }

  const activity = createActivity(activityData);

  activitiesUIState.callbacks.onAddActivity?.({
    tripId: activitiesUIState.tripId,
    activity,
  });

  clearActivityForm({
    keepDate: true,
    keepCategory: true,
  });
}

export function clearActivityForm({
  keepDate = false,
  keepTime = false,
  keepCategory = true,
} = {}) {
  setFieldValue(ACTIVITY_FORM_IDS.name, "");
  setFieldValue(ACTIVITY_FORM_IDS.cost, "");

  if (!keepDate) {
    setFieldValue(ACTIVITY_FORM_IDS.date, "");
  }

  if (!keepTime) {
    setFieldValue(ACTIVITY_FORM_IDS.time, "");
  }

  if (!keepCategory) {
    setFieldValue(ACTIVITY_FORM_IDS.cat, DEFAULT_ACTIVITY_CATEGORY);
  }
}

export function createActivity({
  name,
  date = "",
  time = "",
  cat = DEFAULT_ACTIVITY_CATEGORY,
  cost = 0,
  done = false,
} = {}) {
  const cleanName = String(name || "").trim();

  if (!cleanName) {
    throw new Error("La actividad necesita nombre.");
  }

  return {
    id: makeId("act"),
    name: cleanName.slice(0, 120),
    date: cleanDate(date),
    time: cleanTime(time),
    cat: cleanCategory(cat),
    cost: Math.max(0, toNumber(cost)),
    done: Boolean(done),
  };
}

/* =========================================================
  BADGE / READONLY
========================================================= */

export function updateActivitiesBadge(count = 0) {
  const badge = document.getElementById(ACTIVITY_FORM_IDS.badge);

  if (badge) {
    badge.textContent = String(Math.max(0, toNumber(count)));
  }
}

export function setActivitiesReadonlyMode(readonly = true) {
  activitiesUIState.readonly = Boolean(readonly);

  const form = document.getElementById(ACTIVITY_FORM_IDS.form);

  if (form) {
    form.classList.toggle("is-disabled", activitiesUIState.readonly);
    form.setAttribute("aria-disabled", activitiesUIState.readonly ? "true" : "false");
  }

  [
    ACTIVITY_FORM_IDS.name,
    ACTIVITY_FORM_IDS.date,
    ACTIVITY_FORM_IDS.time,
    ACTIVITY_FORM_IDS.cat,
    ACTIVITY_FORM_IDS.cost,
  ].forEach((id) => {
    const field = document.getElementById(id);
    if (!field) return;

    field.disabled = activitiesUIState.readonly;
  });

  document
    .querySelectorAll('[data-action="add-activity"]')
    .forEach((button) => {
      button.disabled = activitiesUIState.readonly;
    });

  document
    .querySelectorAll('[data-action="toggle-activity"], [data-action="delete-activity"]')
    .forEach((button) => {
      button.disabled = activitiesUIState.readonly;
    });
}

/* =========================================================
  EMPTY / CLEAR
========================================================= */

function renderEmptyActivities() {
  return `
    <div class="empty">
      <div class="ei" aria-hidden="true">🗺️</div>
      <p>
        Sin actividades todavía.<br>
        Agrega un plan bonito, útil o descaradamente optimista.
      </p>
    </div>
  `;
}

export function clearActivitiesUI() {
  activitiesUIState.tripId = null;
  activitiesUIState.currency = DEFAULT_CURRENCY;
  activitiesUIState.readonly = true;

  const container = document.getElementById(ACTIVITY_FORM_IDS.container);

  if (container) {
    container.innerHTML = renderEmptyActivities();
  }

  updateActivitiesBadge(0);

  clearActivityForm({
    keepDate: false,
    keepTime: false,
    keepCategory: false,
  });

  setActivitiesReadonlyMode(true);
}

/* =========================================================
  AGRUPACIÓN / ORDEN
========================================================= */

export function groupActivitiesByDate(activities = []) {
  return normalizeActivitiesForUI(activities).reduce((groups, activity) => {
    const key = activity?.date || NO_DATE_KEY;

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(activity);

    return groups;
  }, {});
}

function sortDateKeys(a, b) {
  if (a === NO_DATE_KEY) return 1;
  if (b === NO_DATE_KEY) return -1;

  return a.localeCompare(b);
}

function sortActivitiesInDay(a, b) {
  const timeA = a?.time || "99:99";
  const timeB = b?.time || "99:99";

  if (timeA !== timeB) {
    return timeA.localeCompare(timeB);
  }

  const nameA = normalizeSearch(a?.name);
  const nameB = normalizeSearch(b?.name);

  return nameA.localeCompare(nameB);
}

/* =========================================================
  NORMALIZACIÓN UI
========================================================= */

function normalizeActivitiesForUI(activities = []) {
  if (!Array.isArray(activities)) return [];

  return activities
    .map(normalizeActivityForUI)
    .filter((activity) => activity.name);
}

function normalizeActivityForUI(activity = {}) {
  return {
    id: cleanText(activity?.id, makeId("act")).slice(0, 80),
    name: cleanText(activity?.name, "Actividad").slice(0, 120),
    date: cleanDate(activity?.date),
    time: cleanTime(activity?.time),
    cat: cleanCategory(activity?.cat),
    cost: Math.max(0, toNumber(activity?.cost)),
    done: Boolean(activity?.done),
  };
}

/* =========================================================
  FECHAS / FORMATO
========================================================= */

export function fmtFullDate(value) {
  if (!value) return "Sin fecha";

  const cleanValue = cleanDate(value);

  if (!cleanValue) return "Fecha inválida";

  const date = new Date(`${cleanValue}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Fecha inválida";
  }

  return date.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatMoney(value, currency = DEFAULT_CURRENCY) {
  const symbol = getCurrencySymbol(currency);
  const number = Math.max(0, toNumber(value));

  return `${symbol}${number.toLocaleString("es-CO")}`;
}

export function getCurrencySymbol(currency = DEFAULT_CURRENCY) {
  const value = String(currency || DEFAULT_CURRENCY).trim();

  if (value.includes("R$")) return "R$";
  if (value.includes("€")) return "€";
  if (value.includes("$")) return "$";

  return "$";
}

/* =========================================================
  HELPERS DOM
========================================================= */

function getValue(id) {
  return document.getElementById(id)?.value ?? "";
}

function setFieldValue(id, value) {
  const field = document.getElementById(id);
  if (!field) return;

  field.value = value ?? "";
}

function focusField(id) {
  document.getElementById(id)?.focus();
}

/* =========================================================
  HELPERS GENERALES
========================================================= */

function makeId(prefix = "id") {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID().slice(0, 8)}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();

  return text || fallback;
}

function cleanDate(value) {
  const text = cleanText(value);

  if (!text) return "";

  return /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? text
    : "";
}

function cleanTime(value) {
  const text = cleanText(value);

  if (!text) return "";

  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text)
    ? text
    : "";
}

function cleanCategory(value) {
  const category = cleanText(value, DEFAULT_ACTIVITY_CATEGORY).slice(0, 80);

  return category || DEFAULT_ACTIVITY_CATEGORY;
}

function normalizeSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHTML(value);
}