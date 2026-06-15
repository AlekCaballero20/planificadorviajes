/* =========================================================
  budget.ui.js
  UI de Presupuesto para Brújula
  Renderiza categorías, totales, progreso y modal
========================================================= */

/* =========================================================
  CONSTANTES
========================================================= */

const DEFAULT_CURRENCY = "COP $";
const DEFAULT_CATEGORY_ICON = "📦";
const DEFAULT_CATEGORY_NAME = "Categoría";

const BUDGET_DOM_IDS = Object.freeze({
  budgetCats: "budgetCats",
  totalAmt: "totalAmt",
  totalSub: "totalSub",
  currency: "tripCurrency",

  categoryModal: "categoryModal",
  newCatIcon: "newCatIcon",
  newCatName: "newCatName",
  newCatBudget: "newCatBudget",
});

const BUDGET_ACTIONS = Object.freeze({
  openCategoryModal: "open-category-modal",
  confirmAddCategory: "confirm-add-category",
  deleteBudgetCat: "delete-budget-cat",
});

const EDITABLE_BUDGET_FIELDS = new Set([
  "spent",
  "budget",
]);

/* =========================================================
  ESTADO INTERNO
========================================================= */

const budgetUIState = {
  readonly: true,
  tripId: null,
  currency: DEFAULT_CURRENCY,
  callbacks: {
    onUpdateCategoryField: null,
    onAddCategory: null,
    onDeleteCategory: null,
    onCurrencyChange: null,
  },
};

/* =========================================================
  INIT
========================================================= */

export function initBudgetUI(options = {}) {
  budgetUIState.callbacks = {
    ...budgetUIState.callbacks,
    ...options,
  };

  bindBudgetEvents();

  return {
    render: renderBudget,
    setReadonly: setBudgetReadonlyMode,
    openCategoryModal,
    closeCategoryModal,
    clearCategoryModal,
    collectCategoryModalData,
  };
}

function bindBudgetEvents() {
  if (document.body.dataset.budgetUiBound === "true") return;

  document.body.dataset.budgetUiBound = "true";

  document.addEventListener("click", handleBudgetClick);
  document.addEventListener("input", handleBudgetInput);
  document.addEventListener("change", handleBudgetChange);
  document.addEventListener("keydown", handleBudgetKeydown);
}

/* =========================================================
  EVENTOS
========================================================= */

function handleBudgetClick(event) {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;

  const action = actionTarget.dataset.action;

  if (action === BUDGET_ACTIONS.openCategoryModal) {
    event.preventDefault();
    openCategoryModal();
    return;
  }

  if (action === BUDGET_ACTIONS.confirmAddCategory) {
    event.preventDefault();
    confirmAddCategory();
    return;
  }

  if (action === BUDGET_ACTIONS.deleteBudgetCat) {
    event.preventDefault();

    if (budgetUIState.readonly) return;

    const index = Number(actionTarget.dataset.budgetIndex);

    if (!Number.isInteger(index) || index < 0) return;

    if (!budgetUIState.tripId) {
      budgetUIState.callbacks.onDeleteCategory?.({
        tripId: null,
        index,
        error: "missing-trip",
      });
      return;
    }

    const categoryLabel = getCategoryLabelFromDeleteButton(actionTarget);

    if (!confirmDeleteBudgetCategory(categoryLabel)) {
      return;
    }

    budgetUIState.callbacks.onDeleteCategory?.({
      tripId: budgetUIState.tripId,
      index,
    });
  }
}

function handleBudgetInput(event) {
  const budgetInput = event.target.closest("[data-budget-index][data-budget-field]");
  if (!budgetInput) return;

  if (budgetUIState.readonly) {
    budgetInput.blur();
    return;
  }

  const index = Number(budgetInput.dataset.budgetIndex);
  const field = budgetInput.dataset.budgetField;

  if (!isValidBudgetEdit(index, field)) return;

  budgetUIState.callbacks.onUpdateCategoryField?.({
    tripId: budgetUIState.tripId,
    index,
    field,
    value: normalizeBudgetNumber(budgetInput.value),
    immediate: false,
  });
}

function handleBudgetChange(event) {
  const currencySelect = event.target.closest(`#${BUDGET_DOM_IDS.currency}`);

  if (currencySelect) {
    if (budgetUIState.readonly) return;

    const currency = normalizeCurrency(currencySelect.value);

    budgetUIState.currency = currency;
    currencySelect.value = currency;

    budgetUIState.callbacks.onCurrencyChange?.({
      tripId: budgetUIState.tripId,
      currency,
      immediate: true,
    });

    return;
  }

  const budgetInput = event.target.closest("[data-budget-index][data-budget-field]");
  if (!budgetInput) return;

  if (budgetUIState.readonly) return;

  const index = Number(budgetInput.dataset.budgetIndex);
  const field = budgetInput.dataset.budgetField;

  if (!isValidBudgetEdit(index, field)) return;

  const value = normalizeBudgetNumber(budgetInput.value);

  budgetInput.value = value ? formatThousands(value) : "";

  budgetUIState.callbacks.onUpdateCategoryField?.({
    tripId: budgetUIState.tripId,
    index,
    field,
    value,
    immediate: true,
  });
}

function handleBudgetKeydown(event) {
  if (event.key !== "Enter") return;

  const targetId = event.target?.id;

  if (
    targetId === BUDGET_DOM_IDS.newCatName ||
    targetId === BUDGET_DOM_IDS.newCatBudget ||
    targetId === BUDGET_DOM_IDS.newCatIcon
  ) {
    event.preventDefault();
    confirmAddCategory();
  }
}

function isValidBudgetEdit(index, field) {
  return Boolean(
    budgetUIState.tripId &&
    Number.isInteger(index) &&
    index >= 0 &&
    EDITABLE_BUDGET_FIELDS.has(field)
  );
}

function getCategoryLabelFromDeleteButton(button) {
  const item = button?.closest?.(".budget-cat");
  const label = item?.querySelector?.(".cat-name span:last-child")?.textContent;

  return cleanText(label, DEFAULT_CATEGORY_NAME).slice(0, 80);
}

function confirmDeleteBudgetCategory(categoryLabel = DEFAULT_CATEGORY_NAME) {
  const label = cleanText(categoryLabel, DEFAULT_CATEGORY_NAME).slice(0, 80);

  return window.confirm(
    `¿Seguro que quieres borrar la categoría “${label}”?

Esto quitará su presupuesto y lo gastado registrado. Esta acción no se puede deshacer.`
  );
}

export function isBudgetFieldEditing() {
  return Boolean(
    document.activeElement?.matches?.("[data-budget-index][data-budget-field]")
  );
}

/* =========================================================
  RENDER PRINCIPAL
========================================================= */

export function renderBudget({
  trip,
  budgetCats = null,
  currency = null,
  readonly = true,
} = {}) {
  if (!trip && !Array.isArray(budgetCats)) {
    clearBudgetUI();
    return;
  }

  const cats = Array.isArray(budgetCats)
    ? normalizeBudgetCategories(budgetCats)
    : normalizeBudgetCategories(trip?.budgetCats);

  budgetUIState.tripId = trip?.id || budgetUIState.tripId || null;
  budgetUIState.currency = normalizeCurrency(currency || trip?.currency || DEFAULT_CURRENCY);
  budgetUIState.readonly = Boolean(readonly);

  syncCurrencySelect(budgetUIState.currency);
  renderBudgetTotals(cats, budgetUIState.currency);
  renderBudgetCategories(cats, budgetUIState.currency);
  setBudgetReadonlyMode(budgetUIState.readonly);
}

/* =========================================================
  TOTALES
========================================================= */

export function renderBudgetTotals(budgetCats = [], currency = DEFAULT_CURRENCY) {
  const totalAmt = document.getElementById(BUDGET_DOM_IDS.totalAmt);
  const totalSub = document.getElementById(BUDGET_DOM_IDS.totalSub);

  const totals = getBudgetTotals(budgetCats);

  if (totalAmt) {
    totalAmt.textContent = formatMoney(totals.spent, currency);
  }

  if (totalSub) {
    totalSub.textContent = `de ${formatMoney(totals.budget, currency)} planificados`;
  }
}

export function getBudgetTotals(budgetCats = []) {
  return normalizeBudgetCategories(budgetCats).reduce(
    (acc, cat) => {
      acc.budget += normalizeBudgetNumber(cat.budget);
      acc.spent += normalizeBudgetNumber(cat.spent);
      return acc;
    },
    {
      budget: 0,
      spent: 0,
    }
  );
}

/* =========================================================
  CATEGORÍAS
========================================================= */

export function renderBudgetCategories(budgetCats = [], currency = DEFAULT_CURRENCY) {
  const container = document.getElementById(BUDGET_DOM_IDS.budgetCats);
  if (!container) return;

  container.innerHTML = "";

  const cats = normalizeBudgetCategories(budgetCats);

  if (!cats.length) {
    container.innerHTML = renderEmptyBudget();
    return;
  }

  const fragment = document.createDocumentFragment();

  cats.forEach((category, index) => {
    fragment.appendChild(
      createBudgetCategoryElement({
        category,
        index,
        currency,
        readonly: budgetUIState.readonly,
      })
    );
  });

  container.appendChild(fragment);
}

export function createBudgetCategoryElement({
  category,
  index,
  currency = DEFAULT_CURRENCY,
  readonly = true,
} = {}) {
  const safeCategory = normalizeBudgetCategory(category);

  const item = document.createElement("article");
  item.className = "budget-cat";
  item.dataset.budgetIndex = String(index);

  const budget = normalizeBudgetNumber(safeCategory.budget);
  const spent = normalizeBudgetNumber(safeCategory.spent);

  const percent = budget > 0
    ? Math.min((spent / budget) * 100, 100)
    : spent > 0
      ? 100
      : 0;

  const roundedPercent = Math.round(percent);
  const barClass = getBudgetBarClass(percent, spent, budget);
  const label = safeCategory.name || DEFAULT_CATEGORY_NAME;

  item.innerHTML = `
    <div class="budget-cat-row">
      <div class="cat-name">
        <span aria-hidden="true">${escapeHTML(safeCategory.icon || DEFAULT_CATEGORY_ICON)}</span>
        <span>${escapeHTML(label)}</span>
      </div>

      <div class="budget-inputs">
        <input
          type="text"
          inputmode="numeric"
          placeholder="Gastado"
          value="${spent ? formatThousands(spent) : ""}"
          title="Monto gastado"
          aria-label="Monto gastado en ${escapeAttr(label)}"
          data-budget-index="${index}"
          data-budget-field="spent"
          ${readonly ? "disabled" : ""}
        />

        <span class="budget-separator">de</span>

        <input
          type="text"
          inputmode="numeric"
          placeholder="Presupuesto"
          value="${budget ? formatThousands(budget) : ""}"
          title="Presupuesto planificado"
          aria-label="Presupuesto planificado para ${escapeAttr(label)}"
          data-budget-index="${index}"
          data-budget-field="budget"
          ${readonly ? "disabled" : ""}
        />

        <button
          class="delete-line-button"
          type="button"
          title="Eliminar categoría"
          aria-label="Eliminar categoría ${escapeAttr(label)}"
          data-action="delete-budget-cat"
          data-budget-index="${index}"
          ${readonly ? "disabled" : ""}
        >
          ×
        </button>
      </div>
    </div>

    <div class="budget-meta">
      <span>${formatMoney(spent, currency)} gastados</span>
      <span>${getBudgetUsageLabel({ budget, spent, percent: roundedPercent })}</span>
    </div>

    <div
      class="bar-wrap"
      role="progressbar"
      aria-label="Uso del presupuesto de ${escapeAttr(label)}"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow="${roundedPercent}"
    >
      <div class="bar ${barClass}" style="width:${clamp(percent, 0, 100)}%"></div>
    </div>
  `;

  return item;
}

function getBudgetUsageLabel({ budget, spent, percent }) {
  if (budget <= 0 && spent > 0) {
    return "Sin presupuesto definido";
  }

  if (budget <= 0) {
    return "Sin presupuesto definido";
  }

  if (spent > budget) {
    return `${percent}% usado · te pasaste`;
  }

  return `${percent}% usado`;
}

function getBudgetBarClass(percent, spent, budget) {
  if (!budget && spent > 0) return "bar-over";
  if (spent > budget && budget > 0) return "bar-over";
  if (percent < 75) return "bar-ok";
  if (percent < 100) return "bar-warn";
  return "bar-over";
}

function renderEmptyBudget() {
  return `
    <div class="empty">
      <div class="ei" aria-hidden="true">💰</div>
      <p>
        Sin categorías todavía.<br>
        Agrega vuelos, alojamiento, comida o cualquier otra forma sofisticada de gastar plata.
      </p>
    </div>
  `;
}

/* =========================================================
  MODAL NUEVA CATEGORÍA
========================================================= */

export function openCategoryModal() {
  if (budgetUIState.readonly) return;

  if (!budgetUIState.tripId) {
    budgetUIState.callbacks.onAddCategory?.({
      tripId: null,
      error: "missing-trip",
    });
    return;
  }

  clearCategoryModal();

  const modal = document.getElementById(BUDGET_DOM_IDS.categoryModal);
  if (!modal) return;

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");

  window.setTimeout(() => {
    document.getElementById(BUDGET_DOM_IDS.newCatName)?.focus();
  }, 70);
}

export function closeCategoryModal() {
  const modal = document.getElementById(BUDGET_DOM_IDS.categoryModal);
  if (!modal) return;

  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

export function clearCategoryModal() {
  setFieldValue(BUDGET_DOM_IDS.newCatIcon, "");
  setFieldValue(BUDGET_DOM_IDS.newCatName, "");
  setFieldValue(BUDGET_DOM_IDS.newCatBudget, "");
}

export function collectCategoryModalData() {
  return {
    icon: cleanIcon(getValue(BUDGET_DOM_IDS.newCatIcon)),
    name: cleanText(getValue(BUDGET_DOM_IDS.newCatName)).slice(0, 80),
    budget: normalizeBudgetNumber(getValue(BUDGET_DOM_IDS.newCatBudget)),
    spent: 0,
  };
}

function confirmAddCategory() {
  if (budgetUIState.readonly) return;

  if (!budgetUIState.tripId) {
    budgetUIState.callbacks.onAddCategory?.({
      tripId: null,
      error: "missing-trip",
    });
    return;
  }

  const categoryData = collectCategoryModalData();

  if (!categoryData.name) {
    document.getElementById(BUDGET_DOM_IDS.newCatName)?.focus();

    budgetUIState.callbacks.onAddCategory?.({
      tripId: budgetUIState.tripId,
      error: "missing-name",
    });

    return;
  }

  budgetUIState.callbacks.onAddCategory?.({
    tripId: budgetUIState.tripId,
    category: {
      id: makeId("cat"),
      icon: categoryData.icon,
      name: categoryData.name,
      budget: categoryData.budget,
      spent: 0,
    },
  });

  closeCategoryModal();
  clearCategoryModal();
}

/* =========================================================
  MONEDA
========================================================= */

export function syncCurrencySelect(currency = DEFAULT_CURRENCY) {
  const select = document.getElementById(BUDGET_DOM_IDS.currency);
  if (!select) return;

  const safeCurrency = normalizeCurrency(currency);

  if (select.value !== safeCurrency) {
    select.value = safeCurrency;
  }

  budgetUIState.currency = safeCurrency;
}

function normalizeCurrency(currency = DEFAULT_CURRENCY) {
  const value = String(currency || DEFAULT_CURRENCY).trim();

  const allowedCurrencies = new Set([
    "COP $",
    "USD $",
    "EUR €",
    "MXN $",
    "ARS $",
    "BRL R$",
  ]);

  return allowedCurrencies.has(value)
    ? value
    : DEFAULT_CURRENCY;
}

/* =========================================================
  READONLY
========================================================= */

export function setBudgetReadonlyMode(readonly = true) {
  budgetUIState.readonly = Boolean(readonly);

  const addButton = document.querySelector('[data-action="open-category-modal"]');

  if (addButton) {
    addButton.disabled = budgetUIState.readonly;
    addButton.setAttribute("aria-disabled", budgetUIState.readonly ? "true" : "false");
  }

  document
    .querySelectorAll("[data-budget-index][data-budget-field]")
    .forEach((input) => {
      input.disabled = budgetUIState.readonly;
    });

  document
    .querySelectorAll('[data-action="delete-budget-cat"]')
    .forEach((button) => {
      button.disabled = budgetUIState.readonly;
      button.setAttribute("aria-disabled", budgetUIState.readonly ? "true" : "false");
    });

  const currencySelect = document.getElementById(BUDGET_DOM_IDS.currency);

  if (currencySelect) {
    currencySelect.disabled = budgetUIState.readonly;
  }
}

/* =========================================================
  LIMPIEZA
========================================================= */

export function clearBudgetUI() {
  budgetUIState.tripId = null;
  budgetUIState.currency = DEFAULT_CURRENCY;
  budgetUIState.readonly = true;

  const container = document.getElementById(BUDGET_DOM_IDS.budgetCats);

  if (container) {
    container.innerHTML = renderEmptyBudget();
  }

  renderBudgetTotals([], DEFAULT_CURRENCY);
  syncCurrencySelect(DEFAULT_CURRENCY);
  closeCategoryModal();
  clearCategoryModal();
  setBudgetReadonlyMode(true);
}

/* =========================================================
  NORMALIZACIÓN DE CATEGORÍAS
========================================================= */

function normalizeBudgetCategories(categories = []) {
  if (!Array.isArray(categories)) return [];

  return categories
    .map(normalizeBudgetCategory)
    .filter((category) => category.name);
}

function normalizeBudgetCategory(category = {}) {
  return {
    id: cleanText(category?.id, makeId("cat")).slice(0, 80),
    icon: cleanIcon(category?.icon),
    name: cleanText(category?.name, DEFAULT_CATEGORY_NAME).slice(0, 80),
    budget: normalizeBudgetNumber(category?.budget),
    spent: normalizeBudgetNumber(category?.spent),
  };
}

function normalizeBudgetNumber(value) {
  return Math.max(0, toNumber(value));
}

/* =========================================================
  HELPERS DE FORMATO
========================================================= */

export function formatMoney(value, currency = DEFAULT_CURRENCY) {
  const symbol = getCurrencySymbol(currency);
  const number = normalizeBudgetNumber(value);

  return `${symbol}${number.toLocaleString("es-CO")}`;
}

export function formatThousands(value) {
  return normalizeBudgetNumber(value).toLocaleString("es-CO");
}

export function formatCompactMoney(value, currency = DEFAULT_CURRENCY) {
  const symbol = getCurrencySymbol(currency);
  const number = normalizeBudgetNumber(value);

  if (number >= 1_000_000) {
    return `${symbol}${(number / 1_000_000).toFixed(1)}M`;
  }

  if (number >= 1_000) {
    return `${symbol}${Math.round(number / 1_000)}K`;
  }

  return `${symbol}${number.toLocaleString("es-CO")}`;
}

export function getCurrencySymbol(currency = DEFAULT_CURRENCY) {
  const value = String(currency || DEFAULT_CURRENCY).trim();

  if (value.includes("R$")) return "R$";
  if (value.includes("€")) return "€";
  if (value.includes("$")) return "$";

  return "$";
}

export function toNumber(value) {
  if (typeof value === "string") {
    const normalized = value
      .replaceAll(".", "")
      .replace(",", ".")
      .trim();

    const number = Number(normalized);

    return Number.isFinite(number) ? number : 0;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
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

function makeId(prefix = "id") {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID().slice(0, 8)}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();

  return text || fallback;
}

function cleanIcon(value) {
  const icon = cleanText(value, DEFAULT_CATEGORY_ICON).slice(0, 8);

  return icon || DEFAULT_CATEGORY_ICON;
}

function clamp(value, min, max) {
  const number = toNumber(value);

  return Math.min(max, Math.max(min, number));
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