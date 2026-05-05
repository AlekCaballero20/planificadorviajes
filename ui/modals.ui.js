/* =========================================================
  modals.ui.js
  UI de Modales y Toast para Brújula
  Maneja apertura/cierre de modales, confirmaciones,
  mensajes flotantes y estados visuales de botones.
========================================================= */

/* =========================================================
  ESTADO INTERNO
========================================================= */

const modalsUIState = {
  activeModalId: null,
  toastTimer: null,
  callbacks: {
    onCloseModal: null,
    onOpenModal: null,
    onConfirmDeleteTrip: null,
    onCancelDeleteTrip: null,
  },
};

/* =========================================================
  INIT
========================================================= */

export function initModalsUI(options = {}) {
  modalsUIState.callbacks = {
    ...modalsUIState.callbacks,
    ...options,
  };

  bindModalEvents();

  return {
    openModal,
    closeModal,
    closeAllModals,
    showToast,
    hideToast,
    openDeleteTripModal,
    closeDeleteTripModal,
    openCategoryModal,
    closeCategoryModal,
    setButtonLoading,
  };
}

function bindModalEvents() {
  if (document.body.dataset.modalsUiBound === "true") return;

  document.body.dataset.modalsUiBound = "true";

  document.addEventListener("click", handleModalClick);
  document.addEventListener("keydown", handleModalKeydown);
}

/* =========================================================
  EVENTOS
========================================================= */

function handleModalClick(event) {
  const actionTarget = event.target.closest("[data-action]");

  if (actionTarget) {
    const action = actionTarget.dataset.action;

    if (action === "close-modal") {
      const modalId = actionTarget.dataset.modal || modalsUIState.activeModalId;
      closeModal(modalId);
      return;
    }

    if (action === "confirm-delete-trip") {
      modalsUIState.callbacks.onConfirmDeleteTrip?.();
      return;
    }

    if (action === "cancel-delete-trip") {
      modalsUIState.callbacks.onCancelDeleteTrip?.();
      closeDeleteTripModal();
      return;
    }
  }

  const overlay = event.target.closest(".modal-overlay");

  if (overlay && event.target === overlay) {
    closeModal(overlay.id);
  }
}

function handleModalKeydown(event) {
  if (event.key === "Escape") {
    closeAllModals();
  }
}

/* =========================================================
  MODALES GENERALES
========================================================= */

export function openModal(modalId, options = {}) {
  const modal = getModal(modalId);
  if (!modal) return false;

  closeAllModals({
    silent: true,
  });

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");

  modalsUIState.activeModalId = modalId;

  if (options.focusSelector) {
    window.setTimeout(() => {
      modal.querySelector(options.focusSelector)?.focus();
    }, 70);
  } else {
    focusFirstModalField(modal);
  }

  modalsUIState.callbacks.onOpenModal?.({
    modalId,
    modal,
  });

  return true;
}

export function closeModal(modalId, options = {}) {
  if (!modalId) return false;

  const modal = getModal(modalId);
  if (!modal) return false;

  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");

  if (modalsUIState.activeModalId === modalId) {
    modalsUIState.activeModalId = null;
  }

  if (!options.silent) {
    modalsUIState.callbacks.onCloseModal?.({
      modalId,
      modal,
    });
  }

  return true;
}

export function closeAllModals(options = {}) {
  const openModals = document.querySelectorAll(".modal-overlay.open");

  openModals.forEach((modal) => {
    closeModal(modal.id, options);
  });

  modalsUIState.activeModalId = null;
}

export function isModalOpen(modalId) {
  const modal = getModal(modalId);
  return Boolean(modal?.classList.contains("open"));
}

export function getActiveModalId() {
  return modalsUIState.activeModalId;
}

function getModal(modalId) {
  if (!modalId) return null;
  return document.getElementById(modalId);
}

function focusFirstModalField(modal) {
  if (!modal) return;

  window.setTimeout(() => {
    const focusable = modal.querySelector(
      [
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "button:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ].join(", ")
    );

    focusable?.focus();
  }, 70);
}

/* =========================================================
  MODAL: CATEGORÍA
========================================================= */

export function openCategoryModal() {
  clearCategoryModal();

  return openModal("categoryModal", {
    focusSelector: "#newCatName",
  });
}

export function closeCategoryModal() {
  return closeModal("categoryModal");
}

export function clearCategoryModal() {
  setFieldValue("newCatIcon", "");
  setFieldValue("newCatName", "");
  setFieldValue("newCatBudget", "");
}

export function collectCategoryModalData() {
  return {
    icon: getValue("newCatIcon").trim() || "📦",
    name: getValue("newCatName").trim(),
    budget: toNumber(getValue("newCatBudget")),
  };
}

/* =========================================================
  MODAL: ELIMINAR VIAJE
========================================================= */

export function openDeleteTripModal({
  tripName = "este viaje",
  tripId = "",
} = {}) {
  const nameEl = document.getElementById("deleteTripName");

  if (nameEl) {
    nameEl.textContent = tripName || "este viaje";
  }

  const modal = document.getElementById("deleteTripModal");

  if (modal) {
    modal.dataset.tripId = tripId || "";
  }

  return openModal("deleteTripModal", {
    focusSelector: '[data-action="confirm-delete-trip"]',
  });
}

export function closeDeleteTripModal() {
  const modal = document.getElementById("deleteTripModal");

  if (modal) {
    delete modal.dataset.tripId;
  }

  return closeModal("deleteTripModal");
}

export function getDeleteTripModalTripId() {
  return document.getElementById("deleteTripModal")?.dataset.tripId || "";
}

/* =========================================================
  TOAST
========================================================= */

export function showToast(message, type = "success", icon = "✨", options = {}) {
  const toast = document.getElementById("toast");
  const toastIcon = document.getElementById("toastIcon");
  const toastText = document.getElementById("toastText");

  if (!toast || !toastText) return;

  const duration = Number.isFinite(options.duration)
    ? options.duration
    : 3400;

  window.clearTimeout(modalsUIState.toastTimer);

  toast.className = `toast show ${type}`;

  if (toastIcon) {
    toastIcon.textContent = icon || getToastIcon(type);
  }

  toastText.textContent = message || "Listo";

  if (duration > 0) {
    modalsUIState.toastTimer = window.setTimeout(() => {
      hideToast();
    }, duration);
  }
}

export function hideToast() {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.classList.remove("show");
}

export function showSuccessToast(message, icon = "✅") {
  showToast(message, "success", icon);
}

export function showErrorToast(message, icon = "⚠️") {
  showToast(message, "error", icon);
}

export function showWarningToast(message, icon = "👀") {
  showToast(message, "warning", icon);
}

function getToastIcon(type) {
  const icons = {
    success: "✅",
    error: "⚠️",
    warning: "👀",
    info: "✨",
  };

  return icons[type] || icons.info;
}

/* =========================================================
  BOTONES / LOADING
========================================================= */

export function setButtonLoading(buttonOrSelector, loading = true, text = "") {
  const button = typeof buttonOrSelector === "string"
    ? document.querySelector(buttonOrSelector)
    : buttonOrSelector;

  if (!button) return;

  if (!button.dataset.originalText) {
    button.dataset.originalText = button.textContent.trim();
  }

  button.disabled = Boolean(loading);
  button.classList.toggle("is-loading", Boolean(loading));

  if (loading) {
    button.textContent = text || "Cargando...";
  } else {
    button.textContent = text || button.dataset.originalText || "Listo";
  }
}

export function disableModalActions(modalId, disabled = true) {
  const modal = getModal(modalId);
  if (!modal) return;

  modal
    .querySelectorAll("button, input, select, textarea")
    .forEach((element) => {
      element.disabled = Boolean(disabled);
    });
}

/* =========================================================
  CONFIRMACIONES GENÉRICAS
========================================================= */

export function setDeleteTripModalContent({
  tripName = "este viaje",
  title = "Eliminar viaje",
  description = "",
  dangerText = "",
} = {}) {
  const titleEl = document.getElementById("deleteTripModalTitle");
  const nameEl = document.getElementById("deleteTripName");
  const modal = document.getElementById("deleteTripModal");

  if (titleEl) {
    titleEl.textContent = title;
  }

  if (nameEl) {
    nameEl.textContent = tripName;
  }

  if (!modal) return;

  const descriptionEl = modal.querySelector("[data-delete-description]");
  const dangerEl = modal.querySelector("[data-delete-danger]");

  if (descriptionEl && description) {
    descriptionEl.textContent = description;
  }

  if (dangerEl && dangerText) {
    dangerEl.textContent = dangerText;
  }
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

/* =========================================================
  HELPERS GENERALES
========================================================= */

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}