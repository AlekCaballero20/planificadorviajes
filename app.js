/* =========================================================
  Brújula - app.js
  Orquestador principal: estado liviano + servicios + UI
========================================================= */

import { enableFirestorePersistence } from "./firebase/firebase.config.js";

import {
  listenToAuthChanges,
  signInWithGoogle,
  logOut,
  normalizeEmail,
} from "./firebase/auth.service.js";

import {
  subscribeToAccessibleTrips,
  createTrip as createTripDoc,
  updateTrip,
  deleteTrip,
  duplicateTrip as duplicateTripDoc,
  createBudgetCategory,
  createActivity,
  createPackItem,
  canEditTrip,
  canShareTrip,
  canDeleteTrip,
  getTripRole,
} from "./firebase/trips.service.js";

import {
  shareTripWithEmail,
  updateSharedUserRole,
  removeSharedEmail,
  getSharedPeople,
} from "./firebase/sharing.service.js";

import { renderHome, initHomeUI } from "./ui/home.ui.js";

import {
  initTripUI,
  renderTrip,
  showTripTab,
  TRIP_TABS,
} from "./ui/trip.ui.js";

import {
  initBudgetUI,
  renderBudget,
  isBudgetFieldEditing,
} from "./ui/budget.ui.js";

import {
  initActivitiesUI,
  renderActivities,
  collectActivityForm,
  clearActivityForm,
} from "./ui/activities.ui.js";

import {
  initPackingUI,
  renderPacking,
  collectPackingForm,
  clearPackingForm,
  createDefaultPackItems,
  mergePackItemsWithoutDuplicates,
} from "./ui/packing.ui.js";

import {
  initModalsUI,
  showErrorToast,
  showSuccessToast,
  showWarningToast,
  setButtonLoading,
  openDeleteTripModal,
  closeDeleteTripModal,
  openCategoryModal,
  closeCategoryModal,
  collectCategoryModalData,
  clearCategoryModal,
} from "./ui/modals.ui.js";

import {
  DOM_IDS,
  HOME_FILTERS,
  SYNC_STATUS,
} from "./utils/constants.js";

import {
  formatErrorMessage,
  isValidEmail,
  toNumber,
} from "./utils/formatters.js";

/* =========================================================
  CONFIG LOCAL
========================================================= */

const SAVE_DEBOUNCE_MS = 450;
const PENDING_OPEN_TIMEOUT_MS = 9000;

const LOCAL_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
]);

const NUMERIC_BUDGET_FIELDS = new Set([
  "budget",
  "spent",
  "amount",
  "value",
  "cost",
]);

const PREVENT_NATIVE_SUBMIT_ACTIONS = new Set([
  "add-activity",
  "add-pack-item",
  "add-default-pack",
]);

/* =========================================================
  ESTADO GLOBAL LIVIANO
========================================================= */

const state = {
  initialized: false,
  isSigningIn: false,
  isCreatingTrip: false,

  user: null,
  trips: [],
  currentTripId: null,

  filter: HOME_FILTERS.all,
  search: "",

  unsubscribeAuth: null,
  unsubscribeTrips: null,

  pendingDeleteTripId: null,

  /*
    Guardados pendientes por viaje.
    pendingPatches: cambios esperando enviarse.
    inFlightPatches: cambios enviados, pero todavía no confirmados por snapshot.
    Sí, toca separar esto porque si no la UI hace magia barata.
  */
  saveTimers: new Map(),
  pendingPatches: new Map(),
  inFlightPatches: new Map(),

  pendingOpenTripId: null,
  pendingOpenTimer: null,
};

/* =========================================================
  BOOT
========================================================= */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp, { once: true });
} else {
  initApp();
}

async function initApp() {
  if (state.initialized) return;

  state.initialized = true;

  showScreen("loading");
  bindShellEvents();
  initUI();
  registerServiceWorker();

  try {
    await enableFirestorePersistence();
  } catch (error) {
    console.warn("[Brújula] No se pudo activar persistencia local:", error);
  }

  state.unsubscribeAuth = listenToAuthChanges({
    onLogin: ({ user }) => handleSession(user),
    onLogout: clearSession,
    onError: (error) => {
      setSyncStatus(SYNC_STATUS.error, "Error de sesión");
      showErrorToast(
        formatErrorMessage(error, "No se pudo validar la sesión.")
      );
      showScreen("auth");
    },
  });
}

/* =========================================================
  INIT UI
========================================================= */

function initUI() {
  initModalsUI({
    onConfirmDeleteTrip: confirmDeleteTrip,
  });

  initHomeUI({
    onCreateTrip: createTrip,
    onOpenTrip: openTrip,
    onDuplicateTrip: duplicateTrip,
    onDeleteTrip: requestDeleteTrip,

    onFilterChange: (filter) => {
      state.filter = filter;
      renderHomeScreen();
    },

    onSearchChange: (search) => {
      state.search = search;
      renderHomeScreen();
    },
  });

  initTripUI({
    onGoHome: goHome,

    onOpenShare: () => {
      showTripTab(TRIP_TABS.sharing);
    },

    onRequestDelete: requestDeleteTrip,

    onUpdateTripField: ({ tripId, field, value, immediate }) => {
      updateTripPatch(
        tripId,
        { [field]: value },
        { debounce: !immediate }
      );
    },

    onTabChange: () => {},
  });

  initBudgetUI({
    onCurrencyChange: ({ tripId, currency }) => {
      updateTripPatch(tripId, { currency }, { debounce: false });
    },

    onUpdateCategoryField: ({ tripId, index, field, value, immediate }) => {
      updateBudgetCategory(
        tripId,
        index,
        field,
        value,
        {
          debounce: !immediate,
          rerender: Boolean(immediate),
        }
      );
    },

    onAddCategory: addBudgetCategory,

    onDeleteCategory: ({ tripId, index }) => {
      deleteBudgetCategory(tripId, index);
    },
  });

  initActivitiesUI({
    onAddActivity: addActivity,

    onToggleActivity: ({ tripId, activityId }) => {
      toggleActivity(tripId, activityId);
    },

    onDeleteActivity: ({ tripId, activityId }) => {
      deleteActivity(tripId, activityId);
    },
  });

  initPackingUI({
    onAddPackItem: addPackItem,

    onAddDefaultPackItems: addDefaultPack,

    onTogglePackItem: ({ tripId, packId }) => {
      togglePackItem(tripId, packId);
    },

    onDeletePackItem: ({ tripId, packId }) => {
      deletePackItem(tripId, packId);
    },
  });
}

/* =========================================================
  EVENTOS GLOBALES
========================================================= */

function bindShellEvents() {
  document.addEventListener("click", handleShellClick);
  document.addEventListener("change", handleShellChange);
  document.addEventListener("keydown", handleShellKeydown);
  document.addEventListener("submit", handleShellSubmit);

  window.addEventListener("beforeunload", () => {
    flushAllPendingSaves();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushAllPendingSaves();
    }
  });
}

function handleShellClick(event) {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;

  const action = actionTarget.dataset.action;

  /*
    Algunos botones están dentro de formularios.
    Si no frenamos el submit nativo, el navegador intenta hacer su
    pequeño ritual de recarga. La humanidad llegó a la luna, pero HTML
    sigue queriendo mandar formularios a ninguna parte.
  */
  if (PREVENT_NATIVE_SUBMIT_ACTIONS.has(action)) {
    event.preventDefault();
  }

  if (action === "sign-in-google") {
    event.preventDefault();
    handleGoogleLogin();
    return;
  }

  if (action === "sign-out") {
    event.preventDefault();
    handleLogout();
    return;
  }

  if (action === "share-trip") {
    event.preventDefault();
    shareCurrentTrip();
    return;
  }

  if (action === "remove-shared-email") {
    event.preventDefault();
    removeSharedAccess(actionTarget.dataset.email);
  }
}

function handleShellChange(event) {
  const roleSelect = event.target.closest("[data-share-role-email]");
  if (!roleSelect) return;

  updateSharedRole(
    roleSelect.dataset.shareRoleEmail,
    roleSelect.value
  );
}

function handleShellKeydown(event) {
  if (event.key !== "Enter") return;

  if (event.target?.id === "shareEmail") {
    event.preventDefault();
    shareCurrentTrip();
  }
}

function handleShellSubmit(event) {
  const activityForm = event.target.closest("#activityForm");
  if (activityForm) {
    event.preventDefault();
    addActivity();
    return;
  }

  const shareForm = event.target.closest("#shareForm");
  if (shareForm) {
    event.preventDefault();
    shareCurrentTrip();
  }
}

/* =========================================================
  AUTH
========================================================= */

async function handleGoogleLogin() {
  if (state.isSigningIn) return;

  state.isSigningIn = true;

  const button = document.getElementById(DOM_IDS.googleLoginBtn);

  try {
    setButtonLoading(button, true, "Entrando...");
    setSyncStatus(SYNC_STATUS.loading, "Entrando...");

    const result = await signInWithGoogle();

    if (!result.ok) {
      setSyncStatus(SYNC_STATUS.error, "Error de ingreso");
      showErrorToast(
        formatErrorMessage(
          result.error,
          "No se pudo iniciar sesión con Google."
        )
      );
    }
  } finally {
    setButtonLoading(button, false, "Entrar con Google");
    state.isSigningIn = false;
  }
}

async function handleLogout() {
  await flushAllPendingSaves();

  const result = await logOut();

  if (!result.ok) {
    showErrorToast(
      formatErrorMessage(result.error, "No se pudo cerrar sesión.")
    );
    return;
  }

  showSuccessToast("Sesión cerrada.");
}

function handleSession(user) {
  state.user = normalizeSessionUser(user);

  hydrateUserUI(state.user);
  showScreen("home");
  renderHomeScreen();
  subscribeTrips();
}

function normalizeSessionUser(user) {
  if (!user) return null;

  const emailLower = normalizeEmail(user.emailLower || user.email);

  return {
    ...user,
    email: user.email || emailLower,
    emailLower,
  };
}

function clearSession() {
  state.user = null;
  state.trips = [];
  state.currentTripId = null;
  state.pendingDeleteTripId = null;
  state.isCreatingTrip = false;

  clearPendingOpenTrip();
  clearSaveTimers();

  state.pendingPatches.clear();
  state.inFlightPatches.clear();

  if (state.unsubscribeTrips) {
    state.unsubscribeTrips();
    state.unsubscribeTrips = null;
  }

  document.body.classList.remove("is-readonly");

  renderHomeScreen();
  showScreen("auth");
  setSyncStatus("", "");
}

/* =========================================================
  FIRESTORE SUBSCRIPTION
========================================================= */

function subscribeTrips() {
  const email = normalizeEmail(state.user?.emailLower || state.user?.email);

  if (!email) {
    showErrorToast("No se pudo leer el correo del usuario.");
    showScreen("auth");
    return;
  }

  if (state.unsubscribeTrips) {
    state.unsubscribeTrips();
    state.unsubscribeTrips = null;
  }

  setSyncStatus(SYNC_STATUS.loading, "Sincronizando...");

  state.unsubscribeTrips = subscribeToAccessibleTrips({
    email,

    onChange: (trips) => {
      state.trips = mergeIncomingTripsWithLocalChanges(trips);

      setSyncStatus(SYNC_STATUS.online, "Sincronizado");

      renderHomeScreen();
      resolvePendingTripOpen();

      if (state.currentTripId) {
        const trip = currentTrip();

        if (!trip) {
          showWarningToast("Ya no tienes acceso a ese viaje.");
          goHome();
          return;
        }

        if (!isBudgetFieldEditing()) {
          renderCurrentTrip();
        }
      }
    },

    onError: (error) => {
      clearPendingOpenTrip();

      setSyncStatus(SYNC_STATUS.error, "Error de permisos");

      state.trips = [];
      renderHomeScreen();

      showErrorToast(
        formatErrorMessage(
          error,
          "No se pudieron cargar los viajes. Revisa que las reglas de Firestore estén publicadas."
        )
      );

      console.error("[Brújula] Error de suscripción a viajes:", error);
    },
  });
}

function mergeIncomingTripsWithLocalChanges(trips = []) {
  const safeTrips = Array.isArray(trips) ? trips : [];

  return safeTrips.map((trip) => {
    const inFlightPatch = state.inFlightPatches.get(trip.id) || {};
    const pendingPatch = state.pendingPatches.get(trip.id) || {};

    return {
      ...trip,
      ...inFlightPatch,
      ...pendingPatch,
    };
  });
}

/* =========================================================
  CREAR / DUPLICAR / ELIMINAR VIAJES
========================================================= */

async function createTrip() {
  if (!requireUser()) return;

  if (state.isCreatingTrip) {
    showWarningToast("Ya se está creando un viaje.");
    return;
  }

  state.isCreatingTrip = true;
  setSyncStatus(SYNC_STATUS.loading, "Creando viaje...");

  try {
    const result = await createTripDoc(state.user);

    if (!result.ok) {
      setSyncStatus(SYNC_STATUS.error, "Error creando");
      showErrorToast(
        formatErrorMessage(result.error, "No se pudo crear el viaje.")
      );
      return;
    }

    const optimisticTrip = normalizeReturnedTrip(result);

    if (optimisticTrip) {
      upsertLocalTrip(optimisticTrip);
      renderHomeScreen();

      setSyncStatus(SYNC_STATUS.online, "Viaje creado");
      showSuccessToast("Viaje creado.");
      openTrip(optimisticTrip.id, { silent: true });
      return;
    }

    queueOpenTripAfterSnapshot(result.tripId, {
      successMessage: "Viaje creado.",
      waitMessage: "Abriendo viaje...",
      timeoutMessage:
        "El viaje se creó, pero todavía no aparece en la lista. Recarga si Firestore se quedó pensando demasiado.",
    });
  } finally {
    state.isCreatingTrip = false;
  }
}

async function duplicateTrip(tripId) {
  const trip = getTrip(tripId);

  if (!trip || !canEditTrip(trip, state.user)) {
    showReadonlyToast();
    return;
  }

  setSyncStatus(SYNC_STATUS.loading, "Duplicando viaje...");

  const result = await duplicateTripDoc({
    trip,
    user: state.user,
  });

  if (!result.ok) {
    setSyncStatus(SYNC_STATUS.error, "Error duplicando");
    showErrorToast(
      formatErrorMessage(result.error, "No se pudo duplicar el viaje.")
    );
    return;
  }

  const optimisticTrip = normalizeReturnedTrip(result);

  if (optimisticTrip) {
    upsertLocalTrip(optimisticTrip);
    renderHomeScreen();

    setSyncStatus(SYNC_STATUS.online, "Viaje duplicado");
    showSuccessToast("Viaje duplicado.");
    openTrip(optimisticTrip.id, { silent: true });
    return;
  }

  queueOpenTripAfterSnapshot(result.tripId, {
    successMessage: "Viaje duplicado.",
    waitMessage: "Abriendo copia...",
    timeoutMessage:
      "La copia se creó, pero aún no aparece en la lista. Firestore está haciendo su pausa dramática.",
  });
}

function requestDeleteTrip(tripId = state.currentTripId) {
  const trip = getTrip(tripId);

  if (!trip) return;

  if (!canDeleteTrip(trip, state.user)) {
    showWarningToast("Solo el owner puede eliminar este viaje.");
    return;
  }

  state.pendingDeleteTripId = trip.id;

  openDeleteTripModal({
    tripId: trip.id,
    tripName: trip.title || "este viaje",
  });
}

async function confirmDeleteTrip() {
  const tripId = state.pendingDeleteTripId;
  const trip = getTrip(tripId);

  if (!trip || !canDeleteTrip(trip, state.user)) {
    closeDeleteTripModal();
    showWarningToast("No tienes permiso para eliminar este viaje.");
    return;
  }

  await flushPendingSave(tripId);

  const result = await deleteTrip(tripId);

  if (!result.ok) {
    showErrorToast(
      formatErrorMessage(result.error, "No se pudo eliminar el viaje.")
    );
    return;
  }

  closeDeleteTripModal();

  state.pendingDeleteTripId = null;
  state.pendingPatches.delete(tripId);
  state.inFlightPatches.delete(tripId);

  state.trips = state.trips.filter((item) => item.id !== tripId);

  if (state.currentTripId === tripId) {
    goHome();
  } else {
    renderHomeScreen();
  }

  setSyncStatus(SYNC_STATUS.online, "Eliminado");
  showSuccessToast("Viaje eliminado.");
}

/* =========================================================
  APERTURA SEGURA DESPUÉS DE SNAPSHOT
========================================================= */

function queueOpenTripAfterSnapshot(
  tripId,
  {
    successMessage = "",
    waitMessage = "Abriendo viaje...",
    timeoutMessage = "El viaje existe, pero todavía no llegó desde Firestore.",
  } = {}
) {
  if (!tripId) return;

  const existingTrip = getTrip(tripId);

  if (existingTrip) {
    if (successMessage) showSuccessToast(successMessage);
    openTrip(tripId, { silent: true });
    return;
  }

  clearPendingOpenTrip();

  state.pendingOpenTripId = tripId;

  setSyncStatus(SYNC_STATUS.loading, waitMessage);

  if (successMessage) {
    showSuccessToast(successMessage);
  }

  state.pendingOpenTimer = window.setTimeout(() => {
    if (!state.pendingOpenTripId) return;

    const trip = getTrip(state.pendingOpenTripId);

    if (trip) {
      resolvePendingTripOpen();
      return;
    }

    clearPendingOpenTrip();
    setSyncStatus(SYNC_STATUS.error, "Esperando datos");
    showWarningToast(timeoutMessage);
  }, PENDING_OPEN_TIMEOUT_MS);
}

function resolvePendingTripOpen() {
  const tripId = state.pendingOpenTripId;

  if (!tripId) return false;

  const trip = getTrip(tripId);

  if (!trip) return false;

  clearPendingOpenTrip();
  openTrip(tripId, { silent: true });

  return true;
}

function clearPendingOpenTrip() {
  if (state.pendingOpenTimer) {
    clearTimeout(state.pendingOpenTimer);
  }

  state.pendingOpenTripId = null;
  state.pendingOpenTimer = null;
}

/* =========================================================
  GUARDADO DE VIAJE
========================================================= */

async function updateTripPatch(
  tripId,
  patch,
  { debounce = true, rerender = true } = {}
) {
  const trip = getTrip(tripId);

  if (!trip || !canEditTrip(trip, state.user)) {
    showReadonlyToast();
    return;
  }

  if (!isValidPatch(patch)) return;

  mergePendingPatch(tripId, patch);
  applyLocalPatch(tripId, patch);

  if (rerender) {
    if (state.currentTripId === tripId) {
      renderCurrentTrip();
    } else {
      renderHomeScreen();
    }
  }

  setSyncStatus(SYNC_STATUS.loading, "Guardando...");

  if (!debounce) {
    await flushPendingSave(tripId);
    return;
  }

  clearTimeout(state.saveTimers.get(tripId));

  const timer = window.setTimeout(() => {
    flushPendingSave(tripId);
  }, SAVE_DEBOUNCE_MS);

  state.saveTimers.set(tripId, timer);
}

function mergePendingPatch(tripId, patch) {
  const currentPatch = state.pendingPatches.get(tripId) || {};

  state.pendingPatches.set(tripId, {
    ...currentPatch,
    ...patch,
  });
}

async function flushPendingSave(tripId) {
  if (!tripId) return;

  clearTimeout(state.saveTimers.get(tripId));
  state.saveTimers.delete(tripId);

  if (state.inFlightPatches.has(tripId)) {
    return;
  }

  const patch = state.pendingPatches.get(tripId);

  if (!isValidPatch(patch)) return;

  state.pendingPatches.delete(tripId);
  state.inFlightPatches.set(tripId, patch);

  const result = await updateTrip(tripId, patch);

  state.inFlightPatches.delete(tripId);

  if (!result.ok) {
    const newerPatch = state.pendingPatches.get(tripId) || {};

    state.pendingPatches.set(tripId, {
      ...patch,
      ...newerPatch,
    });

    setSyncStatus(SYNC_STATUS.error, "Error guardando");

    showErrorToast(
      formatErrorMessage(
        result.error,
        "No se pudieron guardar los cambios."
      )
    );

    if (state.currentTripId === tripId) {
      renderCurrentTrip();
    }

    return;
  }

  if (state.pendingPatches.has(tripId)) {
    setSyncStatus(SYNC_STATUS.loading, "Guardando...");
    await flushPendingSave(tripId);
    return;
  }

  setSyncStatus(SYNC_STATUS.online, "Guardado");
}

async function flushAllPendingSaves() {
  const tripIds = Array.from(state.pendingPatches.keys());

  await Promise.all(
    tripIds.map((tripId) => flushPendingSave(tripId))
  );
}

function clearSaveTimers() {
  state.saveTimers.forEach((timer) => clearTimeout(timer));
  state.saveTimers.clear();
}

function isValidPatch(patch) {
  return Boolean(
    patch &&
    typeof patch === "object" &&
    !Array.isArray(patch) &&
    Object.keys(patch).length > 0
  );
}

/* =========================================================
  PRESUPUESTO
========================================================= */

function updateBudgetCategory(
  tripId,
  index,
  field,
  value,
  options = {}
) {
  const trip = getTrip(tripId);

  if (!trip || !canEditTrip(trip, state.user)) {
    showReadonlyToast();
    return;
  }

  const budgetCats = Array.isArray(trip.budgetCats)
    ? trip.budgetCats.map((cat, catIndex) => {
        if (catIndex !== index) return cat;

        return {
          ...cat,
          [field]: normalizeBudgetFieldValue(field, value),
        };
      })
    : [];

  return updateTripPatch(tripId, { budgetCats }, options);
}

function normalizeBudgetFieldValue(field, value) {
  if (NUMERIC_BUDGET_FIELDS.has(field)) {
    return toNumber(value);
  }

  return value;
}

function addBudgetCategory({ tripId, category, error } = {}) {
  if (error === "missing-name") {
    showWarningToast("Ponle nombre a la categoría.");
    return;
  }

  const trip = getTrip(tripId) || currentTrip();

  if (!trip || !canEditTrip(trip, state.user)) {
    showReadonlyToast();
    return;
  }

  try {
    const nextCategory =
      category || createBudgetCategory(collectCategoryModalData());

    const budgetCats = [
      ...(Array.isArray(trip.budgetCats) ? trip.budgetCats : []),
      nextCategory,
    ];

    updateTripPatch(
      trip.id,
      { budgetCats },
      { debounce: false }
    );

    clearCategoryModal();
    closeCategoryModal();
  } catch (error) {
    showWarningToast(error.message || "Revisa la categoría.");
  }
}

function deleteBudgetCategory(tripId, index) {
  const trip = getTrip(tripId);

  if (!trip || !canEditTrip(trip, state.user)) {
    showReadonlyToast();
    return;
  }

  const budgetCats = (Array.isArray(trip.budgetCats) ? trip.budgetCats : [])
    .filter((_, catIndex) => catIndex !== index);

  updateTripPatch(
    tripId,
    { budgetCats },
    { debounce: false }
  );
}

/* =========================================================
  ACTIVIDADES
========================================================= */

function addActivity({ tripId, activity, error } = {}) {
  if (error === "missing-name") {
    showWarningToast("Escribe el nombre de la actividad.");
    return;
  }

  const trip = getTrip(tripId) || currentTrip();

  if (!trip || !canEditTrip(trip, state.user)) {
    showReadonlyToast();
    return;
  }

  try {
    const nextActivity =
      activity || createActivity(collectActivityForm());

    updateTripPatch(
      trip.id,
      {
        activities: [
          ...(Array.isArray(trip.activities) ? trip.activities : []),
          nextActivity,
        ],
      },
      { debounce: false }
    );

    clearActivityForm();
  } catch (error) {
    showWarningToast(
      error.message || "Escribe el nombre de la actividad."
    );
  }
}

function toggleActivity(tripId, activityId) {
  const trip = getTrip(tripId);

  if (!trip || !canEditTrip(trip, state.user)) {
    showReadonlyToast();
    return;
  }

  const activities = (Array.isArray(trip.activities) ? trip.activities : [])
    .map((activity) => {
      if (activity.id !== activityId) return activity;

      return {
        ...activity,
        done: !activity.done,
      };
    });

  updateTripPatch(
    tripId,
    { activities },
    { debounce: false }
  );
}

function deleteActivity(tripId, activityId) {
  const trip = getTrip(tripId);

  if (!trip || !canEditTrip(trip, state.user)) {
    showReadonlyToast();
    return;
  }

  const activities = (Array.isArray(trip.activities) ? trip.activities : [])
    .filter((activity) => activity.id !== activityId);

  updateTripPatch(
    tripId,
    { activities },
    { debounce: false }
  );
}

/* =========================================================
  EQUIPAJE
========================================================= */

function addPackItem({ tripId, packItem, error } = {}) {
  if (error === "missing-name") {
    showWarningToast("Escribe el artículo.");
    return;
  }

  const trip = getTrip(tripId) || currentTrip();

  if (!trip || !canEditTrip(trip, state.user)) {
    showReadonlyToast();
    return;
  }

  try {
    const nextPackItem =
      packItem || createPackItem(collectPackingForm());

    updateTripPatch(
      trip.id,
      {
        packItems: [
          ...(Array.isArray(trip.packItems) ? trip.packItems : []),
          nextPackItem,
        ],
      },
      { debounce: false }
    );

    clearPackingForm();
  } catch (error) {
    showWarningToast(
      error.message || "Escribe el artículo."
    );
  }
}

function addDefaultPack({ tripId, packItems } = {}) {
  const trip = getTrip(tripId) || currentTrip();

  if (!trip || !canEditTrip(trip, state.user)) {
    showReadonlyToast();
    return;
  }

  const currentItems = Array.isArray(trip.packItems)
    ? trip.packItems
    : [];

  const mergeResult = mergePackItemsWithoutDuplicates(
    currentItems,
    packItems || createDefaultPackItems()
  );

  const mergedItems = Array.isArray(mergeResult)
    ? mergeResult
    : Array.isArray(mergeResult?.mergedItems)
      ? mergeResult.mergedItems
      : currentItems;

  const addedItems = Array.isArray(mergeResult?.addedItems)
    ? mergeResult.addedItems
    : inferAddedItems(currentItems, mergedItems);

  if (!addedItems.length) {
    showWarningToast("La lista base ya está agregada.");
    return;
  }

  updateTripPatch(
    trip.id,
    { packItems: mergedItems },
    { debounce: false }
  );

  showSuccessToast("Lista base agregada.");
}

function inferAddedItems(currentItems, mergedItems) {
  const currentKeys = new Set(
    currentItems.map((item) => getPackItemIdentity(item))
  );

  return mergedItems.filter((item) => {
    return !currentKeys.has(getPackItemIdentity(item));
  });
}

function getPackItemIdentity(item) {
  return String(
    item?.id ||
    `${item?.category || item?.cat || ""}-${item?.name || item?.text || ""}`
  ).toLowerCase();
}

function togglePackItem(tripId, packId) {
  const trip = getTrip(tripId);

  if (!trip || !canEditTrip(trip, state.user)) {
    showReadonlyToast();
    return;
  }

  const packItems = (Array.isArray(trip.packItems) ? trip.packItems : [])
    .map((item) => {
      if (item.id !== packId) return item;

      return {
        ...item,
        packed: !item.packed,
      };
    });

  updateTripPatch(
    tripId,
    { packItems },
    { debounce: false }
  );
}

function deletePackItem(tripId, packId) {
  const trip = getTrip(tripId);

  if (!trip || !canEditTrip(trip, state.user)) {
    showReadonlyToast();
    return;
  }

  const packItems = (Array.isArray(trip.packItems) ? trip.packItems : [])
    .filter((item) => item.id !== packId);

  updateTripPatch(
    tripId,
    { packItems },
    { debounce: false }
  );
}

/* =========================================================
  COMPARTIR
========================================================= */

async function shareCurrentTrip() {
  const trip = currentTrip();

  if (!trip || !canShareTrip(trip, state.user)) {
    showWarningToast("Solo el owner puede compartir este viaje.");
    return;
  }

  const emailInput = document.getElementById("shareEmail");
  const roleSelect = document.getElementById("shareRole");

  const email = normalizeEmail(emailInput?.value);
  const role = roleSelect?.value || "viewer";

  if (!isValidEmail(email)) {
    showWarningToast("Escribe un correo válido.");
    return;
  }

  const result = await shareTripWithEmail({
    trip,
    currentUser: state.user,
    email,
    role,
  });

  if (!result.ok) {
    showErrorToast(
      formatErrorMessage(result.error, "No se pudo compartir el viaje.")
    );
    return;
  }

  if (emailInput) emailInput.value = "";
  if (roleSelect) roleSelect.value = "viewer";

  applyLocalPatch(trip.id, {
    accessEmails: result.accessEmails,
    rolesByEmail: result.rolesByEmail,
  });

  renderCurrentTrip();

  showSuccessToast(`Viaje compartido con ${email}.`);
}

async function updateSharedRole(email, role) {
  const trip = currentTrip();

  if (!trip || !canShareTrip(trip, state.user)) return;

  const result = await updateSharedUserRole({
    trip,
    currentUser: state.user,
    email,
    role,
  });

  if (!result.ok) {
    showErrorToast(
      formatErrorMessage(result.error, "No se pudo actualizar el rol.")
    );
    renderCurrentTrip();
    return;
  }

  applyLocalPatch(trip.id, {
    accessEmails: result.accessEmails,
    rolesByEmail: result.rolesByEmail,
  });

  renderCurrentTrip();
}

async function removeSharedAccess(email) {
  const trip = currentTrip();

  if (!trip || !canShareTrip(trip, state.user)) return;

  const result = await removeSharedEmail({
    trip,
    currentUser: state.user,
    email,
  });

  if (!result.ok) {
    showErrorToast(
      formatErrorMessage(result.error, "No se pudo quitar el acceso.")
    );
    return;
  }

  applyLocalPatch(trip.id, {
    accessEmails: result.accessEmails,
    rolesByEmail: result.rolesByEmail,
  });

  renderCurrentTrip();

  showSuccessToast(`Acceso quitado: ${email}.`);
}

/* =========================================================
  NAVEGACIÓN
========================================================= */

function openTrip(tripId, { silent = false } = {}) {
  const trip = getTrip(tripId);

  if (!trip) {
    queueOpenTripAfterSnapshot(tripId, {
      waitMessage: "Buscando viaje...",
      timeoutMessage:
        "No encontré ese viaje. Puede que no tengas acceso o que Firestore aún no lo haya devuelto.",
    });

    if (!silent) {
      showWarningToast("Buscando ese viaje...");
    }

    return;
  }

  clearPendingOpenTrip();

  state.currentTripId = tripId;

  showScreen("planner");
  showTripTab(TRIP_TABS.summary);
  renderCurrentTrip();
}

function goHome() {
  state.currentTripId = null;

  document.body.classList.remove("is-readonly");

  showScreen("home");
  renderHomeScreen();
}

/* =========================================================
  RENDER
========================================================= */

function renderHomeScreen() {
  renderHome({
    trips: state.trips,
    currentUser: state.user,
    filter: state.filter,
    search: state.search,

    getRole: (trip) => getTripRole(trip, state.user),

    canDeleteTrip: (trip) => canDeleteTrip(trip, state.user),
  });
}

function renderCurrentTrip() {
  const trip = currentTrip();

  if (!trip) {
    goHome();
    return;
  }

  const role = getTripRole(trip, state.user);
  const editable = canEditTrip(trip, state.user);
  const shareable = canShareTrip(trip, state.user);
  const deletable = canDeleteTrip(trip, state.user);

  document.body.classList.toggle("is-readonly", !editable);

  renderTrip({
    trip,
    currentUser: state.user,
    role,
    canEdit: editable,
    canShare: shareable,
    canDelete: deletable,
  });

  renderBudget({
    trip,
    readonly: !editable,
  });

  renderActivities({
    trip,
    readonly: !editable,
    currency: trip.currency,
  });

  renderPacking({
    trip,
    readonly: !editable,
  });

  renderSharedPeople(trip, shareable);
}

function renderSharedPeople(trip, shareable) {
  const container = document.getElementById(DOM_IDS.sharedPeopleList);
  const shareForm = document.getElementById("shareForm");

  if (!container) return;

  shareForm?.classList.toggle("hidden", !shareable);

  const people = getSharedPeople(trip, state.user);

  if (!people.length) {
    container.innerHTML = `
      <div class="empty">
        <span class="empty-icon-small">👥</span>
        <p>Aún no hay personas compartidas en este viaje.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = people
    .map((person) => {
      const email = escapeHTML(person.email);
      const description = person.isCurrentUser
        ? "Tú"
        : person.description;

      return `
        <article class="person-row">
          <div class="person-main">
            <strong>${email}</strong>
            <span>${escapeHTML(description)}</span>
          </div>

          <select
            class="person-role"
            data-share-role-email="${email}"
            ${person.canChangeRole ? "" : "disabled"}
          >
            <option value="owner" ${person.role === "owner" ? "selected" : ""}>Owner</option>
            <option value="editor" ${person.role === "editor" ? "selected" : ""}>Editor</option>
            <option value="viewer" ${person.role === "viewer" ? "selected" : ""}>Viewer</option>
          </select>

          <button
            class="person-remove"
            type="button"
            title="Quitar acceso"
            data-action="remove-shared-email"
            data-email="${email}"
            ${person.canRemove ? "" : "disabled"}
          >
            ×
          </button>
        </article>
      `;
    })
    .join("");
}

/* =========================================================
  PATCH LOCAL
========================================================= */

function applyLocalPatch(tripId, patch) {
  state.trips = state.trips.map((trip) => {
    if (trip.id !== tripId) return trip;

    return {
      ...trip,
      ...patch,
    };
  });
}

function upsertLocalTrip(trip) {
  if (!trip?.id) return;

  const existing = getTrip(trip.id);

  state.trips = [
    {
      ...(existing || {}),
      ...trip,
    },
    ...state.trips.filter((item) => item.id !== trip.id),
  ];
}

function normalizeReturnedTrip(result) {
  if (!result || typeof result !== "object") return null;

  const rawTrip =
    result.trip ||
    result.newTrip ||
    result.duplicatedTrip ||
    result.createdTrip ||
    null;

  if (!rawTrip || typeof rawTrip !== "object") return null;

  const id = rawTrip.id || result.tripId || result.id;

  if (!id) return null;

  return {
    ...rawTrip,
    id,
  };
}

/* =========================================================
  PANTALLAS
========================================================= */

function showScreen(screen) {
  const loadingScreen = document.getElementById(DOM_IDS.loadingScreen);
  const authScreen = document.getElementById(DOM_IDS.authScreen);
  const appShell = document.getElementById(DOM_IDS.appShell);
  const homeScreen = document.getElementById(DOM_IDS.homeScreen);
  const plannerScreen = document.getElementById(DOM_IDS.plannerScreen);

  const screens = {
    loading: loadingScreen,
    auth: authScreen,
    home: homeScreen,
    planner: plannerScreen,
  };

  Object.values(screens).forEach((element) => {
    if (!element) return;

    element.classList.remove("active");
    element.setAttribute("aria-hidden", "true");
  });

  const activeScreen = screens[screen];

  if (activeScreen) {
    activeScreen.classList.add("active");
    activeScreen.setAttribute("aria-hidden", "false");
  }

  const hideShell = screen === "auth" || screen === "loading";

  if (appShell) {
    appShell.classList.toggle("hidden", hideShell);
    appShell.setAttribute("aria-hidden", hideShell ? "true" : "false");
  }

  document.body.classList.toggle("is-auth", screen === "auth");
  document.body.classList.toggle("is-loading", screen === "loading");
  document.body.classList.toggle("is-home", screen === "home");
  document.body.classList.toggle("is-planner", screen === "planner");
}

function hydrateUserUI(user) {
  setText(DOM_IDS.userName, user?.displayName || "Usuario");
  setText(DOM_IDS.userEmail, user?.email || user?.emailLower || "");

  const photo = document.getElementById(DOM_IDS.userPhoto);

  if (!photo) return;

  photo.classList.toggle("hidden", !user?.photoURL);

  if (user?.photoURL) {
    photo.src = user.photoURL;
    photo.alt = user.displayName || "Foto de usuario";
  } else {
    photo.removeAttribute("src");
    photo.alt = "";
  }
}

function setSyncStatus(type, text) {
  const status = document.getElementById(DOM_IDS.syncStatus);

  status?.classList.remove("online", "error", "loading");

  if (type) {
    status?.classList.add(type);
  }

  setText(DOM_IDS.syncStatusText, text);
}

/* =========================================================
  SERVICE WORKER
========================================================= */

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  if (isLocalhost()) {
    cleanLocalServiceWorkerCache();
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch((error) => {
        console.warn("[Brújula] No se pudo registrar el service worker:", error);
      });
  });
}

function isLocalhost() {
  return LOCAL_HOSTNAMES.has(window.location.hostname);
}

async function cleanLocalServiceWorkerCache() {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();

    await Promise.all(
      registrations.map((registration) => registration.unregister())
    );

    if ("caches" in window) {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.toLowerCase().includes("brujula"))
          .map((cacheName) => caches.delete(cacheName))
      );
    }
  } catch (error) {
    console.warn(
      "[Brújula] No se pudo limpiar el service worker local:",
      error
    );
  }
}

/* =========================================================
  HELPERS
========================================================= */

function getTrip(tripId) {
  if (!tripId) return null;

  return state.trips.find((trip) => trip.id === tripId) || null;
}

function currentTrip() {
  return getTrip(state.currentTripId);
}

function requireUser() {
  if (state.user) return true;

  showWarningToast("Primero inicia sesión con Google.");
  return false;
}

function showReadonlyToast() {
  showWarningToast("Este viaje está en modo solo lectura para ti.");
}

function setText(id, text) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = text;
  }
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================================================
  DEBUG CONTROLADO
========================================================= */

window.BrujulaApp = {
  getState: () => ({
    initialized: state.initialized,
    isSigningIn: state.isSigningIn,
    isCreatingTrip: state.isCreatingTrip,
    user: state.user,
    trips: state.trips,
    currentTripId: state.currentTripId,
    filter: state.filter,
    search: state.search,
    pendingOpenTripId: state.pendingOpenTripId,
    pendingPatches: Array.from(state.pendingPatches.entries()),
    inFlightPatches: Array.from(state.inFlightPatches.entries()),
    saveTimers: Array.from(state.saveTimers.keys()),
  }),

  openTrip,
  goHome,
  openCategoryModal,

  flushAllPendingSaves,
};