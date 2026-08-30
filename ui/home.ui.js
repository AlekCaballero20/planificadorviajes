/* =========================================================
  home.ui.js
  UI del Home para Brújula
  Renderiza listado de viajes, filtros, búsqueda y tarjetas
========================================================= */

/* =========================================================
  CONSTANTES VISUALES
========================================================= */

export const HOME_FILTERS = {
  all: "all",
  owned: "owned",
  shared: "shared",
  upcoming: "upcoming",
  completed: "completed",
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
  owner: "Mío",
  editor: "Editor",
  viewer: "Viewer",
};

export const TRIP_BANNERS = {
  "🏖️ Playa y descanso": {
    bg: "linear-gradient(135deg, #38bdf8, #10a99a)",
    icon: "🏖️",
  },
  "🏔️ Aventura y naturaleza": {
    bg: "linear-gradient(135deg, #15803d, #84cc16)",
    icon: "🏔️",
  },
  "🏛️ Cultural e histórico": {
    bg: "linear-gradient(135deg, #7c3aed, #c084fc)",
    icon: "🏛️",
  },
  "🍽️ Gastronómico": {
    bg: "linear-gradient(135deg, #ff7a59, #f5a524)",
    icon: "🍽️",
  },
  "💼 Negocios": {
    bg: "linear-gradient(135deg, #1d4ed8, #60a5fa)",
    icon: "💼",
  },
  "👨‍👩‍👧 Familiar": {
    bg: "linear-gradient(135deg, #ec4899, #fbbf24)",
    icon: "👨‍👩‍👧",
  },
  "💑 Romántico": {
    bg: "linear-gradient(135deg, #db2777, #fb7185)",
    icon: "💑",
  },
  "🎉 Grupos y amigos": {
    bg: "linear-gradient(135deg, #f97316, #a855f7)",
    icon: "🎉",
  },
  "🎭 Arte y cultura": {
    bg: "linear-gradient(135deg, #9333ea, #14b8a6)",
    icon: "🎭",
  },
  "🧘 Descanso espiritual": {
    bg: "linear-gradient(135deg, #8b5cf6, #2dd4bf)",
    icon: "🧘",
  },
};

const DEFAULT_BANNER = {
  bg: "linear-gradient(135deg, #7c3aed, #10a99a)",
  icon: "🌎",
};

/* =========================================================
  ESTADO INTERNO DE UI
========================================================= */

const homeState = {
  filter: HOME_FILTERS.all,
  search: "",
  callbacks: {
    onCreateTrip: null,
    onOpenTrip: null,
    onDuplicateTrip: null,
    onDeleteTrip: null,
    onFilterChange: null,
    onSearchChange: null,
  },
};

/* =========================================================
  INIT
========================================================= */

export function initHomeUI(options = {}) {
  homeState.callbacks = {
    ...homeState.callbacks,
    ...options,
  };

  bindHomeEvents();

  return {
    setFilter: setHomeFilter,
    setSearch: setHomeSearch,
    getFilter: () => homeState.filter,
    getSearch: () => homeState.search,
  };
}

function bindHomeEvents() {
  const searchInput = document.getElementById("tripSearchInput");

  if (searchInput && !searchInput.dataset.homeBound) {
    searchInput.dataset.homeBound = "true";

    searchInput.addEventListener("input", (event) => {
      const value = event.target.value || "";
      setHomeSearch(value);
      homeState.callbacks.onSearchChange?.(value);
    });
  }

  document.addEventListener("click", handleHomeClick);
}

function handleHomeClick(event) {
  const filterTarget = event.target.closest(".filter-chip");

  if (filterTarget?.dataset.filter) {
    setHomeFilter(filterTarget.dataset.filter);
    homeState.callbacks.onFilterChange?.(homeState.filter);
    return;
  }

  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;

  const action = actionTarget.dataset.action;

  if (action === "create-trip") {
    homeState.callbacks.onCreateTrip?.();
    return;
  }

  if (action === "open-trip") {
    const tripId = actionTarget.dataset.tripId;
    if (tripId) homeState.callbacks.onOpenTrip?.(tripId);
    return;
  }

  if (action === "duplicate-trip") {
    const tripId = actionTarget.dataset.tripId;
    if (tripId) homeState.callbacks.onDuplicateTrip?.(tripId);
    return;
  }

  if (action === "request-delete-trip") {
    const tripId = actionTarget.dataset.tripId;
    if (tripId) homeState.callbacks.onDeleteTrip?.(tripId);
    return;
  }
}

/* =========================================================
  RENDER PRINCIPAL
========================================================= */

export function renderHome({
  trips = [],
  currentUser = null,
  filter = homeState.filter,
  search = homeState.search,
  getRole,
  canDeleteTrip,
} = {}) {
  const tripGrid = document.getElementById("tripGrid");
  const emptyHomeState = document.getElementById("emptyHomeState");
  const homeSub = document.getElementById("homeSub");

  if (!tripGrid) return;

  homeState.filter = filter || HOME_FILTERS.all;
  homeState.search = search || "";

  syncSearchInput(homeState.search);
  syncFilterChips(homeState.filter);

  const normalizedTrips = Array.isArray(trips) ? trips : [];

  const filteredTrips = filterTrips({
    trips: normalizedTrips,
    currentUser,
    filter: homeState.filter,
    search: homeState.search,
  });

  renderHomeSubtitle({
    el: homeSub,
    trips: normalizedTrips,
    filteredTrips,
    currentUser,
  });

  tripGrid.innerHTML = "";

  if (!normalizedTrips.length) {
    emptyHomeState?.classList.remove("hidden");
  } else {
    emptyHomeState?.classList.add("hidden");
  }

  filteredTrips.forEach((trip) => {
    const role = typeof getRole === "function"
      ? getRole(trip, currentUser)
      : getFallbackRole(trip, currentUser);

    const canDelete = typeof canDeleteTrip === "function"
      ? canDeleteTrip(trip, currentUser)
      : role === "owner";

    tripGrid.appendChild(
      createTripCard({
        trip,
        role,
        canDelete,
      })
    );
  });

  if (currentUser) {
    tripGrid.appendChild(createNewTripCard());
  }

  if (normalizedTrips.length && !filteredTrips.length) {
    tripGrid.appendChild(createNoResultsCard());
  }
}

/* =========================================================
  FILTROS
========================================================= */

export function filterTrips({
  trips = [],
  currentUser = null,
  filter = HOME_FILTERS.all,
  search = "",
} = {}) {
  const safeSearch = normalizeSearch(search);

  return trips.filter((trip) => {
    const matchesSearch = !safeSearch || normalizeSearch(
      [
        trip.title,
        trip.destino,
        trip.estado,
        trip.tipo,
        trip.ownerEmail,
        ...(trip.accessEmails || []),
      ].join(" ")
    ).includes(safeSearch);

    if (!matchesSearch) return false;

    if (filter === HOME_FILTERS.owned) {
      return isOwnedByCurrentUser(trip, currentUser);
    }

    if (filter === HOME_FILTERS.shared) {
      return !isOwnedByCurrentUser(trip, currentUser);
    }

    if (filter === HOME_FILTERS.upcoming) {
      return isUpcomingTrip(trip);
    }

    if (filter === HOME_FILTERS.completed) {
      return trip.estado === "completado";
    }

    return true;
  });
}

export function setHomeFilter(filter = HOME_FILTERS.all) {
  homeState.filter = Object.values(HOME_FILTERS).includes(filter)
    ? filter
    : HOME_FILTERS.all;

  syncFilterChips(homeState.filter);
}

export function setHomeSearch(value = "") {
  homeState.search = value;
  syncSearchInput(homeState.search);
}

function syncFilterChips(filter) {
  document.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.filter === filter);
  });
}

function syncSearchInput(search) {
  const searchInput = document.getElementById("tripSearchInput");

  if (searchInput && searchInput.value !== search) {
    searchInput.value = search || "";
  }
}

/* =========================================================
  TARJETAS
========================================================= */

export function createTripCard({
  trip,
  role = "viewer",
  canDelete = false,
} = {}) {
  const card = document.createElement("article");
  card.className = "trip-card";

  const banner = TRIP_BANNERS[trip?.tipo] || DEFAULT_BANNER;
  const status = trip?.estado || "planificando";
  const totals = getBudgetTotals(trip);
  const budgetPercent = totals.budget > 0
    ? Math.min(Math.round((totals.spent / totals.budget) * 100), 100)
    : 0;

  const nights = nightsCount(trip?.fechaSalida, trip?.fechaRegreso);
  const activitiesCount = Array.isArray(trip?.activities) ? trip.activities.length : 0;
  const packItems = Array.isArray(trip?.packItems) ? trip.packItems : [];
  const packTotal = packItems.length;
  const packDone = packItems.filter((item) => item.packed).length;
  /* Se llevó y todavía no confirma que volvió: lo que suele perderse. */
  const packMissing = packItems.filter(
    (item) => item.packed && !item.returned
  ).length;

  card.innerHTML = `
    <button
      class="trip-card-button"
      type="button"
      data-action="open-trip"
      data-trip-id="${escapeAttr(trip.id)}"
      aria-label="Abrir viaje ${escapeAttr(trip.title || "Sin título")}"
    >
      <div class="trip-banner" style="background: ${banner.bg}">
        <span class="trip-banner-icon" aria-hidden="true">${banner.icon}</span>
      </div>

      <div class="trip-card-body">
        <h2 class="trip-card-title">${escapeHTML(trip.title || "Sin título")}</h2>

        <div class="trip-card-dest">
          <span aria-hidden="true">📍</span>
          <span>${trip.destino ? escapeHTML(trip.destino) : "Destino sin definir"}</span>
          ${trip.fechaSalida ? `<span style="margin-left:auto">${fmtShortDate(trip.fechaSalida)}</span>` : ""}
        </div>

        <div class="trip-card-stats">
          ${nights !== null ? `<span class="trip-stat">🌙 <strong>${nights}</strong> noche${nights === 1 ? "" : "s"}</span>` : ""}
          ${activitiesCount ? `<span class="trip-stat">📍 <strong>${activitiesCount}</strong> act.</span>` : ""}
          ${packTotal ? `<span class="trip-stat">🎒 <strong>${packDone}/${packTotal}</strong></span>` : ""}
          ${packMissing ? `<span class="trip-stat trip-stat-alert">⚠️ <strong>${packMissing}</strong> por volver</span>` : ""}
          ${totals.budget ? `<span class="trip-stat">💰 <strong>${formatCompactMoney(totals.budget, trip.currency)}</strong></span>` : ""}
        </div>

        ${
          totals.budget
            ? `
              <div class="budget-mini-wrap" aria-hidden="true">
                <div class="budget-mini" style="width:${budgetPercent}%"></div>
              </div>
            `
            : ""
        }

        <div class="trip-card-footer">
          <span class="status-badge status-${escapeAttr(status)}">
            ${STATUS_ICONS[status] || "🗓️"} ${STATUS_LABELS[status] || "Planeándolo"}
          </span>

          <span class="owner-badge role-${escapeAttr(role)}">
            ${getRoleCardLabel(role)}
          </span>
        </div>
      </div>
    </button>

    <div class="trip-card-actions">
      <button
        class="trip-action-btn"
        type="button"
        title="Duplicar viaje"
        aria-label="Duplicar viaje"
        data-action="duplicate-trip"
        data-trip-id="${escapeAttr(trip.id)}"
      >
        ⧉
      </button>

      <button
        class="trip-action-btn"
        type="button"
        title="Eliminar viaje"
        aria-label="Eliminar viaje"
        data-action="request-delete-trip"
        data-trip-id="${escapeAttr(trip.id)}"
        ${canDelete ? "" : "disabled"}
      >
        🗑
      </button>
    </div>
  `;

  return card;
}

export function createNewTripCard() {
  const button = document.createElement("button");
  button.className = "new-trip-card";
  button.type = "button";
  button.dataset.action = "create-trip";

  button.innerHTML = `
    <span class="new-trip-icon" aria-hidden="true">+</span>
    <strong>Nuevo viaje</strong>
    <span>Otra aventura para organizar con una elegante falsa sensación de control.</span>
  `;

  return button;
}

export function createNoResultsCard() {
  const article = document.createElement("article");
  article.className = "empty-state";
  article.style.gridColumn = "1 / -1";

  article.innerHTML = `
    <div class="empty-icon" aria-hidden="true">🔎</div>
    <h2>No encontré viajes con ese filtro</h2>
    <p>
      Cambia la búsqueda o el filtro. También puedes crear otro viaje,
      porque claramente la solución humana ante todo es agregar más planes.
    </p>
  `;

  return article;
}

/* =========================================================
  SUBTÍTULO HOME
========================================================= */

function renderHomeSubtitle({
  el,
  trips = [],
  filteredTrips = [],
  currentUser = null,
} = {}) {
  if (!el) return;

  if (!currentUser) {
    el.textContent = "Inicia sesión para cargar tus viajes.";
    return;
  }

  const total = trips.length;
  const owned = trips.filter((trip) => isOwnedByCurrentUser(trip, currentUser)).length;
  const shared = Math.max(total - owned, 0);

  if (total === 0) {
    el.textContent = "Crea tu primer viaje y compártelo solo con quienes van en ese plan.";
    return;
  }

  if (filteredTrips.length !== total) {
    el.textContent = `${filteredTrips.length} de ${total} viaje${total === 1 ? "" : "s"} visible${filteredTrips.length === 1 ? "" : "s"} con este filtro.`;
    return;
  }

  el.textContent = `${total} viaje${total === 1 ? "" : "s"} guardado${total === 1 ? "" : "s"} · ${owned} propio${owned === 1 ? "" : "s"} · ${shared} compartido${shared === 1 ? "" : "s"}`;
}

/* =========================================================
  UTILIDADES DE VIAJE
========================================================= */

export function isOwnedByCurrentUser(trip, currentUser) {
  if (!trip || !currentUser) return false;

  const userEmail = normalizeEmail(currentUser.email || currentUser.emailLower);
  const ownerEmail = normalizeEmail(trip.ownerEmail);

  return Boolean(
    (trip.ownerUid && currentUser.uid && trip.ownerUid === currentUser.uid) ||
    (userEmail && ownerEmail && userEmail === ownerEmail)
  );
}

export function isUpcomingTrip(trip) {
  if (!trip?.fechaSalida) return false;
  if (trip.estado === "completado") return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(`${trip.fechaSalida}T00:00:00`);

  return start >= today;
}

export function getFallbackRole(trip, currentUser) {
  if (!trip || !currentUser) return "viewer";

  if (isOwnedByCurrentUser(trip, currentUser)) {
    return "owner";
  }

  const email = normalizeEmail(currentUser.email || currentUser.emailLower);

  return trip.rolesByEmail?.[email] || "viewer";
}

export function getRoleCardLabel(role) {
  if (role === "owner") return ROLE_LABELS.owner;
  if (role === "editor") return ROLE_LABELS.editor;
  return "Compartido";
}

export function getBudgetTotals(trip) {
  const cats = Array.isArray(trip?.budgetCats) ? trip.budgetCats : [];

  return cats.reduce(
    (acc, cat) => {
      acc.budget += toNumber(cat.budget);
      acc.spent += toNumber(cat.spent);
      return acc;
    },
    {
      budget: 0,
      spent: 0,
    }
  );
}

/* =========================================================
  FECHAS Y FORMATO
========================================================= */

export function nightsCount(start, end) {
  if (!start || !end) return null;

  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  const diff = Math.round((endDate - startDate) / 86_400_000);

  return diff >= 0 ? diff : null;
}

export function fmtShortDate(value) {
  if (!value) return "";

  return new Date(`${value}T12:00:00`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
  });
}

export function formatCompactMoney(value, currency = "COP $") {
  const symbol = String(currency || "COP $").split(" ")[1] || "$";
  const number = toNumber(value);

  if (number >= 1_000_000) {
    return `${symbol}${(number / 1_000_000).toFixed(1)}M`;
  }

  if (number >= 1_000) {
    return `${symbol}${Math.round(number / 1_000)}K`;
  }

  return `${symbol}${number.toLocaleString("es-CO")}`;
}

/* =========================================================
  HELPERS GENERALES
========================================================= */

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function normalizeSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

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