/* =========================================================
  trip.ui.js
  UI general del viaje para Brújula
  Maneja planner, resumen, tabs, rol, lectura y campos base
========================================================= */

/* =========================================================
  CONSTANTES VISUALES
========================================================= */

export const TRIP_TABS = {
  summary: "resumen",
  budget: "presupuesto",
  activities: "actividades",
  packing: "empaque",
  sharing: "compartir",
};

export const TRIP_STATUS_LABELS = {
  sonando: "Soñándolo",
  planificando: "Planeándolo",
  reservado: "Reservado",
  "en-camino": "En camino",
  viviendo: "Viviéndolo",
  completado: "Ya fue, pero quedó en el alma",
};

export const TRIP_STATUS_ICONS = {
  sonando: "💭",
  planificando: "🗓️",
  reservado: "✅",
  "en-camino": "🚀",
  viviendo: "🌟",
  completado: "📸",
};

export const TRIP_ROLE_LABELS = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

export const TRIP_ROLE_COPY = {
  owner: "Puedes editar, compartir y eliminar este viaje.",
  editor: "Puedes editar este viaje, pero no compartirlo ni eliminarlo.",
  viewer: "Puedes ver este viaje, pero no editarlo.",
};

export const DEFAULT_TRIP_STATUS = "planificando";

/* =========================================================
  ESTADO INTERNO DE UI
========================================================= */

const tripUIState = {
  activeTab: TRIP_TABS.summary,
  readonly: true,
  currentTripId: null,
  callbacks: {
    onGoHome: null,
    onOpenShare: null,
    onRequestDelete: null,
    onUpdateTripField: null,
    onTabChange: null,
  },
};

/* =========================================================
  INIT
========================================================= */

export function initTripUI(options = {}) {
  tripUIState.callbacks = {
    ...tripUIState.callbacks,
    ...options,
  };

  bindTripUIEvents();

  return {
    showTab: showTripTab,
    setReadonly: setTripReadonlyMode,
    getActiveTab: () => tripUIState.activeTab,
    clear: clearTripUI,
  };
}

function bindTripUIEvents() {
  if (document.body.dataset.tripUiBound === "true") return;

  document.body.dataset.tripUiBound = "true";

  document.addEventListener("click", handleTripClick);
  document.addEventListener("input", handleTripInput);
  document.addEventListener("change", handleTripChange);
  document.addEventListener("keydown", handleTripKeydown);
}

/* =========================================================
  EVENTOS
========================================================= */

function handleTripClick(event) {
  const tabButton = event.target.closest(".tab-button");

  if (tabButton?.dataset.tab) {
    event.preventDefault();
    showTripTab(tabButton.dataset.tab);
    tripUIState.callbacks.onTabChange?.(tabButton.dataset.tab);
    return;
  }

  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;

  const action = actionTarget.dataset.action;

  if (action === "go-home") {
    event.preventDefault();
    tripUIState.callbacks.onGoHome?.();
    return;
  }

  if (action === "open-share-tab") {
    event.preventDefault();
    showTripTab(TRIP_TABS.sharing);
    tripUIState.callbacks.onOpenShare?.();
    return;
  }

  if (action === "request-delete-trip") {
    event.preventDefault();
    tripUIState.callbacks.onRequestDelete?.(tripUIState.currentTripId);
    return;
  }
}

function handleTripInput(event) {
  const field = event.target.closest("[data-trip-field]");
  if (!field) return;

  if (tripUIState.readonly) {
    field.blur();
    return;
  }

  const fieldName = field.dataset.tripField;
  const value = getFieldValue(field);

  tripUIState.callbacks.onUpdateTripField?.({
    tripId: tripUIState.currentTripId,
    field: fieldName,
    value,
    event,
  });
}

function handleTripChange(event) {
  const field = event.target.closest("[data-trip-field]");
  if (!field) return;

  if (tripUIState.readonly) return;

  const fieldName = field.dataset.tripField;
  const value = getFieldValue(field);

  tripUIState.callbacks.onUpdateTripField?.({
    tripId: tripUIState.currentTripId,
    field: fieldName,
    value,
    event,
    immediate: true,
  });
}

function handleTripKeydown(event) {
  if (event.key !== "Enter") return;

  const target = event.target;

  if (target?.id === "tripTitleInput") {
    target.blur();
  }
}

/* =========================================================
  RENDER PRINCIPAL
========================================================= */

export function renderTrip({
  trip,
  currentUser = null,
  role = "viewer",
  canEdit = false,
  canDelete = false,
  canShare = false,
} = {}) {
  if (!trip) {
    clearTripUI();
    return;
  }

  tripUIState.currentTripId = trip.id;
  tripUIState.readonly = !canEdit;

  renderTripFields(trip);
  renderTripRole({
    role,
    canEdit,
    canDelete,
    canShare,
  });
  renderTripStats(trip);
  renderTripHeaderActions({
    canDelete,
    canShare,
  });
  setTripReadonlyMode(!canEdit);
  ensureValidActiveTab();

  return {
    tripId: trip.id,
    role,
    readonly: !canEdit,
    currentUser,
  };
}

/* =========================================================
  CAMPOS DEL RESUMEN
========================================================= */

export function renderTripFields(trip) {
  setFieldValue("tripTitleInput", trip.title || "");
  setFieldValue("tripDestino", trip.destino || "");
  setFieldValue("tripFechaSalida", trip.fechaSalida || "");
  setFieldValue("tripFechaRegreso", trip.fechaRegreso || "");
  setFieldValue("tripViajeros", trip.viajeros || "");
  setFieldValue("tripTipo", trip.tipo || "");
  setFieldValue("tripEstado", trip.estado || DEFAULT_TRIP_STATUS);
  setFieldValue("tripNotas", trip.notas || "");
  setFieldValue("tripCurrency", trip.currency || "COP $");
}

export function collectTripSummaryFields() {
  return {
    title: getValue("tripTitleInput").trim(),
    destino: getValue("tripDestino").trim(),
    fechaSalida: getValue("tripFechaSalida"),
    fechaRegreso: getValue("tripFechaRegreso"),
    viajeros: toNumber(getValue("tripViajeros")),
    tipo: getValue("tripTipo"),
    estado: getValue("tripEstado") || DEFAULT_TRIP_STATUS,
    notas: getValue("tripNotas").trim(),
    currency: getValue("tripCurrency") || "COP $",
  };
}

function getFieldValue(field) {
  if (!field) return "";

  if (field.type === "number") {
    return toNumber(field.value);
  }

  return field.value;
}

/* =========================================================
  ROL / PERMISOS
========================================================= */

export function renderTripRole({
  role = "viewer",
  canEdit = false,
  canDelete = false,
  canShare = false,
} = {}) {
  const roleBadge = document.getElementById("roleBadge");

  if (!roleBadge) return;

  roleBadge.className = `role-badge role-${escapeAttr(role)}`;
  roleBadge.textContent = TRIP_ROLE_LABELS[role] || TRIP_ROLE_LABELS.viewer;
  roleBadge.title = TRIP_ROLE_COPY[role] || TRIP_ROLE_COPY.viewer;

  roleBadge.dataset.canEdit = String(Boolean(canEdit));
  roleBadge.dataset.canDelete = String(Boolean(canDelete));
  roleBadge.dataset.canShare = String(Boolean(canShare));
}

export function setTripReadonlyMode(readonly = true) {
  tripUIState.readonly = Boolean(readonly);

  document.body.classList.toggle("is-readonly", tripUIState.readonly);

  const readonlyNotice = document.getElementById("readonlyNotice");

  if (readonlyNotice) {
    readonlyNotice.classList.toggle("hidden", !tripUIState.readonly);
  }

  document.querySelectorAll("[data-trip-field]").forEach((field) => {
    field.disabled = tripUIState.readonly;
  });

  document.querySelectorAll("[data-readonly-disabled]").forEach((el) => {
    el.disabled = tripUIState.readonly;
  });
}

export function renderTripHeaderActions({
  canDelete = false,
  canShare = false,
} = {}) {
  const deleteButton = document.querySelector('[data-action="request-delete-trip"]');
  const shareButton = document.querySelector('[data-action="open-share-tab"]');

  if (deleteButton) {
    deleteButton.disabled = !canDelete;
    deleteButton.classList.toggle("hidden", !canDelete);
  }

  if (shareButton) {
    shareButton.disabled = !canShare;
    shareButton.classList.toggle("hidden", !canShare);
  }
}

/* =========================================================
  ESTADÍSTICAS
========================================================= */

export function renderTripStats(trip) {
  const statRow = document.getElementById("statRow");
  if (!statRow) return;

  const stats = buildTripStats(trip);

  statRow.innerHTML = stats.length
    ? stats.map(renderStatPill).join("")
    : renderStatPill({
        icon: "🧭",
        label: "Completa los datos básicos del viaje.",
      });
}

export function buildTripStats(trip) {
  if (!trip) return [];

  const stats = [];

  const nights = nightsCount(trip.fechaSalida, trip.fechaRegreso);

  if (nights !== null) {
    stats.push({
      icon: "🗓️",
      label: `<strong>${nights}</strong> noche${nights === 1 ? "" : "s"}`,
    });
  }

  if (trip.destino) {
    stats.push({
      icon: "📍",
      label: `<strong>${escapeHTML(trip.destino)}</strong>`,
    });
  }

  if (trip.viajeros) {
    const travelers = Number(trip.viajeros);

    stats.push({
      icon: "👥",
      label: `<strong>${travelers}</strong> viajero${travelers === 1 ? "" : "s"}`,
    });
  }

  if (trip.estado) {
    const status = trip.estado;

    stats.push({
      icon: TRIP_STATUS_ICONS[status] || "🗓️",
      label: `<strong>${TRIP_STATUS_LABELS[status] || escapeHTML(status)}</strong>`,
    });
  }

  if (trip.fechaSalida) {
    stats.push({
      icon: "🚀",
      label: `Salida: <strong>${fmtShortDate(trip.fechaSalida)}</strong>`,
    });
  }

  return stats;
}

function renderStatPill(stat) {
  if (typeof stat === "string") {
    return `<span class="stat-pill">${stat}</span>`;
  }

  return `
    <span class="stat-pill">
      <span aria-hidden="true">${stat.icon || "✨"}</span>
      <span>${stat.label || ""}</span>
    </span>
  `;
}

/* =========================================================
  TABS
========================================================= */

export function showTripTab(tabName = TRIP_TABS.summary) {
  const safeTab = Object.values(TRIP_TABS).includes(tabName)
    ? tabName
    : TRIP_TABS.summary;

  tripUIState.activeTab = safeTab;

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === safeTab);
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${safeTab}`);
  });

  return safeTab;
}

export function getActiveTripTab() {
  return tripUIState.activeTab;
}

function ensureValidActiveTab() {
  const activePanel = document.getElementById(`tab-${tripUIState.activeTab}`);

  if (!activePanel) {
    showTripTab(TRIP_TABS.summary);
    return;
  }

  showTripTab(tripUIState.activeTab);
}

/* =========================================================
  BADGES DE CONTADORES
========================================================= */

export function updateTripBadges({
  activitiesCount = 0,
  packedCount = 0,
  packTotal = 0,
} = {}) {
  const actBadge = document.getElementById("actBadge");
  const packBadge = document.getElementById("packBadge");

  if (actBadge) {
    actBadge.textContent = String(activitiesCount || 0);
  }

  if (packBadge) {
    packBadge.textContent = packTotal
      ? `${packedCount}/${packTotal}`
      : "0";
  }
}

/* =========================================================
  LIMPIEZA
========================================================= */

export function clearTripUI() {
  tripUIState.currentTripId = null;
  tripUIState.readonly = true;

  renderTripFields({
    title: "",
    destino: "",
    fechaSalida: "",
    fechaRegreso: "",
    viajeros: "",
    tipo: "",
    estado: DEFAULT_TRIP_STATUS,
    notas: "",
    currency: "COP $",
  });

  renderTripRole({
    role: "viewer",
    canEdit: false,
    canDelete: false,
    canShare: false,
  });

  renderTripStats(null);
  updateTripBadges();

  setTripReadonlyMode(true);
  showTripTab(TRIP_TABS.summary);
}

/* =========================================================
  HELPERS DOM
========================================================= */

function setFieldValue(id, value) {
  const field = document.getElementById(id);
  if (!field) return;

  const nextValue = value ?? "";

  if (field.value !== String(nextValue)) {
    field.value = nextValue;
  }
}

function getValue(id) {
  return document.getElementById(id)?.value ?? "";
}

/* =========================================================
  FECHAS Y FORMATO
========================================================= */

export function nightsCount(start, end) {
  if (!start || !end) return null;

  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }

  const diff = Math.round((endDate - startDate) / 86_400_000);

  return diff >= 0 ? diff : null;
}

export function fmtShortDate(value) {
  if (!value) return "";

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
  });
}

export function fmtFullDate(value) {
  if (!value) return "";

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* =========================================================
  UTILIDADES
========================================================= */

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
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
