/* =========================================================
  packing.ui.js
  UI de Empaque / Checklist de viaje para Brújula
  Renderiza la lista en dos fases (ida y regreso), progreso,
  categorías, filtros, resumen, lista base, acciones masivas,
  export/import y acciones de marcar/eliminar artículos.
========================================================= */

/* =========================================================
  CONSTANTES
========================================================= */

export const DEFAULT_PACK_CATEGORY = "📦 Otros";

export const PACK_CATEGORY_ORDER = Object.freeze([
  "📄 Documentos",
  "👕 Ropa",
  "🪥 Higiene",
  "💊 Medicamentos",
  "📱 Electrónicos",
  "🎒 Accesorios",
  "🍫 Snacks",
  DEFAULT_PACK_CATEGORY,
]);

export const DEFAULT_PACK_ITEMS = Object.freeze({
  "📄 Documentos": [
    "Cédula / pasaporte",
    "Tiquetes o reservas",
    "Seguro de viaje",
    "Tarjetas y efectivo",
  ],
  "👕 Ropa": [
    "Camisas / blusas",
    "Pantalones / shorts",
    "Ropa interior",
    "Pijama",
    "Ropa de baño",
    "Tenis o sandalias",
  ],
  "🪥 Higiene": [
    "Cepillo y crema dental",
    "Shampoo",
    "Desodorante",
    "Protector solar",
    "Repelente",
  ],
  "💊 Medicamentos": [
    "Medicamentos personales",
    "Analgésicos",
    "Antidiarreico",
    "Curitas",
  ],
  "📱 Electrónicos": [
    "Cargador del celular",
    "Power bank",
    "Audífonos",
    "Adaptador de corriente",
  ],
  "🎒 Accesorios": [
    "Lentes de sol",
    "Gorra / sombrero",
    "Mochila pequeña",
    "Candado de maleta",
  ],
  "🍫 Snacks": [
    "Botella de agua",
    "Snacks ligeros",
    "Chicles / mentas",
  ],
});

const PACK_DOM_IDS = Object.freeze({
  form: "packingForm",
  item: "packItem",
  category: "packCat",
  container: "packContainer",
  bar: "packBar",
  label: "packLbl",
  badge: "packBadge",

  search: "packSearch",
  status: "packStatus",
  catFilter: "packCatFilter",

  statTotal: "packStatTotal",
  statPacked: "packStatPacked",
  statReturned: "packStatReturned",
  statMissing: "packStatMissing",

  importFile: "packImportFile",
});

/* Fases del checklist: lo que se empaca al salir y lo que vuelve a casa. */
export const PACK_PHASES = Object.freeze({
  packed: "packed",
  returned: "returned",
});

const PHASE_COPY = Object.freeze({
  packed: {
    progressLabel: "Empaque",
    progressAria: "Progreso de empaque",
    checkOn: "Marcar como pendiente de empacar",
    checkOff: "Marcar como empacado",
    doneBadge: "✅ Empacado",
    pendingBadge: "⬜ Pendiente",
    emptyTitle: "Lista vacía.",
    emptyText: "Agrega artículos o usa la lista base para no empacar como personaje secundario.",
  },
  returned: {
    progressLabel: "Regreso",
    progressAria: "Progreso de regreso",
    checkOn: "Marcar como no devuelto",
    checkOff: "Marcar como devuelto a casa",
    doneBadge: "✅ De vuelta",
    pendingBadge: "⬜ Pendiente",
    missingBadge: "⚠️ Falta",
    emptyTitle: "Nada que revisar todavía.",
    emptyText: "Agrega artículos en la fase de ida y aquí confirmas que todo volvió contigo.",
  },
});

const PACK_ACTIONS = Object.freeze({
  addItem: "add-pack-item",
  addDefault: "add-default-pack",
  toggleItem: "toggle-pack-item",
  deleteItem: "delete-pack-item",
  setPhase: "set-pack-phase",
  bulk: "bulk-pack",
  exportItems: "export-pack",
  importItems: "import-pack",
});

/* =========================================================
  ESTADO INTERNO
========================================================= */

const packingUIState = {
  readonly: true,
  tripId: null,
  phase: PACK_PHASES.packed,
  items: [],
  filters: {
    search: "",
    status: "all",
    cat: "all",
  },
  callbacks: {
    onAddPackItem: null,
    onAddDefaultPackItems: null,
    onTogglePackItem: null,
    onDeletePackItem: null,
    onBulkPackItems: null,
    onExportPackItems: null,
    onImportPackItems: null,
  },
};

/* =========================================================
  INIT
========================================================= */

export function initPackingUI(options = {}) {
  packingUIState.callbacks = {
    ...packingUIState.callbacks,
    ...options,
  };

  bindPackingEvents();
  hydratePackingCategoryField();

  setPackingPhase(packingUIState.phase, { silent: true });

  return {
    render: renderPacking,
    clear: clearPackingUI,
    setReadonly: setPackingReadonlyMode,
    clearForm: clearPackingForm,
    collectForm: collectPackingForm,
    setPhase: setPackingPhase,
  };
}

function bindPackingEvents() {
  if (document.body.dataset.packingUiBound === "true") return;

  document.body.dataset.packingUiBound = "true";

  document.addEventListener("click", handlePackingClick);

  /*
    Captura el submit antes de que el navegador haga su show de “voy a recargar
    porque nací en otra época”. Qué belleza el progreso humano.
  */
  document.addEventListener("submit", handlePackingSubmit, true);
  document.addEventListener("keydown", handlePackingKeydown);
  document.addEventListener("input", handlePackingFilterChange);
  document.addEventListener("change", handlePackingFilterChange);
  document.addEventListener("change", handlePackingImportFile);
}

/* =========================================================
  EVENTOS
========================================================= */

function handlePackingClick(event) {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;

  const action = actionTarget.dataset.action;

  if (action === PACK_ACTIONS.addItem) {
    event.preventDefault();
    confirmAddPackItem();
    return;
  }

  if (action === PACK_ACTIONS.addDefault) {
    event.preventDefault();
    confirmAddDefaultPackItems();
    return;
  }

  if (action === PACK_ACTIONS.setPhase) {
    event.preventDefault();
    setPackingPhase(actionTarget.dataset.phase);
    return;
  }

  if (action === PACK_ACTIONS.bulk) {
    event.preventDefault();

    if (packingUIState.readonly) return;

    packingUIState.callbacks.onBulkPackItems?.({
      tripId: packingUIState.tripId,
      field: packingUIState.phase,
      value: actionTarget.dataset.value === "true",
    });

    return;
  }

  if (action === PACK_ACTIONS.exportItems) {
    event.preventDefault();

    packingUIState.callbacks.onExportPackItems?.({
      tripId: packingUIState.tripId,
      packItems: packingUIState.items.slice(),
    });

    return;
  }

  if (action === PACK_ACTIONS.importItems) {
    event.preventDefault();

    if (packingUIState.readonly) return;

    document.getElementById(PACK_DOM_IDS.importFile)?.click();
    return;
  }

  if (action === PACK_ACTIONS.toggleItem) {
    event.preventDefault();

    const packId = actionTarget.dataset.packId;

    if (!packId || packingUIState.readonly) return;

    packingUIState.callbacks.onTogglePackItem?.({
      tripId: packingUIState.tripId,
      packId,
      field: actionTarget.dataset.phase || packingUIState.phase,
    });

    return;
  }

  if (action === PACK_ACTIONS.deleteItem) {
    event.preventDefault();

    const packId = actionTarget.dataset.packId;

    if (!packId || packingUIState.readonly) return;

    packingUIState.callbacks.onDeletePackItem?.({
      tripId: packingUIState.tripId,
      packId,
    });
  }
}

function handlePackingSubmit(event) {
  const form = event.target?.closest?.(`#${PACK_DOM_IDS.form}`);
  if (!form) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  confirmAddPackItem();
}

function handlePackingKeydown(event) {
  if (event.key !== "Enter") return;

  const targetId = event.target?.id;

  if (targetId !== PACK_DOM_IDS.item && targetId !== PACK_DOM_IDS.category) {
    return;
  }

  /*
    En el select de categoría no agregamos con Enter, porque a veces Enter
    solo quiere abrir/cerrar opciones. No todo Enter necesita una misión.
  */
  if (targetId === PACK_DOM_IDS.category) {
    return;
  }

  event.preventDefault();
  confirmAddPackItem();
}

function handlePackingFilterChange(event) {
  const targetId = event.target?.id;

  if (
    targetId !== PACK_DOM_IDS.search &&
    targetId !== PACK_DOM_IDS.status &&
    targetId !== PACK_DOM_IDS.catFilter
  ) {
    return;
  }

  packingUIState.filters = {
    search: getValue(PACK_DOM_IDS.search),
    status: getValue(PACK_DOM_IDS.status) || "all",
    cat: getValue(PACK_DOM_IDS.catFilter) || "all",
  };

  renderPackingList(packingUIState.items);
}

function handlePackingImportFile(event) {
  if (event.target?.id !== PACK_DOM_IDS.importFile) return;

  const file = event.target.files?.[0];

  event.target.value = "";

  if (!file || packingUIState.readonly) return;

  const reader = new FileReader();

  reader.onload = () => {
    packingUIState.callbacks.onImportPackItems?.({
      tripId: packingUIState.tripId,
      raw: String(reader.result || ""),
    });
  };

  reader.onerror = () => {
    packingUIState.callbacks.onImportPackItems?.({
      tripId: packingUIState.tripId,
      raw: "",
      error: "read-error",
    });
  };

  reader.readAsText(file);
}

/* =========================================================
  FASE (IDA / REGRESO)
========================================================= */

export function setPackingPhase(phase, { silent = false } = {}) {
  const safePhase = phase === PACK_PHASES.returned
    ? PACK_PHASES.returned
    : PACK_PHASES.packed;

  packingUIState.phase = safePhase;

  document
    .querySelectorAll(`[data-action="${PACK_ACTIONS.setPhase}"]`)
    .forEach((button) => {
      const isActive = button.dataset.phase === safePhase;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });

  const track = document
    .getElementById(PACK_DOM_IDS.bar)
    ?.closest?.(".progress-track");

  if (track) {
    track.setAttribute("aria-label", PHASE_COPY[safePhase].progressAria);
  }

  if (silent) return;

  renderPackingProgress(packingUIState.items);
  renderPackingList(packingUIState.items);
}

/* =========================================================
  RENDER PRINCIPAL
========================================================= */

export function renderPacking({
  trip,
  packItems = null,
  readonly = true,
} = {}) {
  if (!trip && !Array.isArray(packItems)) {
    clearPackingUI();
    return;
  }

  const safeItems = normalizePackItems(
    Array.isArray(packItems)
      ? packItems
      : Array.isArray(trip?.packItems)
        ? trip.packItems
        : []
  );

  packingUIState.tripId = trip?.id || packingUIState.tripId || null;
  packingUIState.readonly = Boolean(readonly);
  packingUIState.items = safeItems;

  hydratePackingCategoryField(safeItems);
  hydratePackingCategoryFilter(safeItems);
  renderPackingProgress(safeItems);
  renderPackingStats(safeItems);
  renderPackingList(safeItems);
  setPackingReadonlyMode(packingUIState.readonly);
}

export function renderPackingList(packItems = []) {
  const container = document.getElementById(PACK_DOM_IDS.container);
  if (!container) return;

  const safeItems = normalizePackItems(packItems);
  const visibleItems = filterPackItems(safeItems);

  container.innerHTML = "";

  if (!safeItems.length) {
    container.innerHTML = renderEmptyPacking();
    return;
  }

  if (!visibleItems.length) {
    container.innerHTML = renderNoMatchesPacking();
    return;
  }

  const groups = groupPackItemsByCategory(visibleItems);
  const sortedCategories = sortPackCategories(Object.keys(groups));

  const fragment = document.createDocumentFragment();

  sortedCategories.forEach((category) => {
    fragment.appendChild(
      createPackCategoryElement({
        category,
        items: groups[category],
        readonly: packingUIState.readonly,
      })
    );
  });

  container.appendChild(fragment);
}

/* =========================================================
  PROGRESO
========================================================= */

export function renderPackingProgress(packItems = []) {
  const safeItems = normalizePackItems(packItems);

  const packBar = document.getElementById(PACK_DOM_IDS.bar);
  const packLbl = document.getElementById(PACK_DOM_IDS.label);
  const packBadge = document.getElementById(PACK_DOM_IDS.badge);
  const progressTrack = packBar?.closest?.(".progress-track");

  const progress = getPackingProgress(safeItems);

  if (packBar) {
    packBar.style.width = `${progress.percent}%`;
  }

  if (progressTrack) {
    progressTrack.setAttribute("aria-valuenow", String(progress.percent));
  }

  if (packLbl) {
    packLbl.innerHTML = `${PHASE_COPY[packingUIState.phase].progressLabel}: <strong>${progress.percent}%</strong> (${progress.done}/${progress.total})`;
  }

  if (packBadge) {
    packBadge.textContent = progress.total
      ? `${progress.packed}/${progress.total}`
      : "0";
  }
}

/* =========================================================
  RESUMEN (TOTAL / EMPACADOS / DEVUELTOS / FALTANTES)
========================================================= */

export function renderPackingStats(packItems = []) {
  const totals = getPackingStats(packItems);

  setText(PACK_DOM_IDS.statTotal, totals.total);
  setText(PACK_DOM_IDS.statPacked, totals.packed);
  setText(PACK_DOM_IDS.statReturned, totals.returned);
  setText(PACK_DOM_IDS.statMissing, totals.missing);
}

export function getPackingStats(packItems = []) {
  const safeItems = normalizePackItems(packItems);

  return {
    total: safeItems.length,
    packed: safeItems.filter((item) => item.packed).length,
    returned: safeItems.filter((item) => item.returned).length,
    /* Se llevó pero todavía no confirma que volvió: candidato a perderse. */
    missing: safeItems.filter((item) => item.packed && !item.returned).length,
  };
}

export function getPackingProgress(packItems = []) {
  const safeItems = normalizePackItems(packItems);

  const total = safeItems.length;
  const packed = safeItems.filter((item) => item.packed).length;
  const returned = safeItems.filter((item) => item.returned).length;
  const done = packingUIState.phase === PACK_PHASES.returned ? returned : packed;
  const percent = total ? Math.round((done / total) * 100) : 0;

  return {
    total,
    packed,
    returned,
    done,
    pending: Math.max(total - done, 0),
    percent,
  };
}

/* =========================================================
  FILTROS
========================================================= */

export function filterPackItems(packItems = []) {
  const { search, status, cat } = packingUIState.filters;
  const query = normalizeSearch(search);
  const phase = packingUIState.phase;

  return normalizePackItems(packItems).filter((item) => {
    if (cat !== "all" && item.cat !== cat) return false;

    const checked = Boolean(item[phase]);

    if (status === "checked" && !checked) return false;
    if (status === "unchecked" && checked) return false;
    if (status === "missing" && !(item.packed && !item.returned)) return false;

    if (!query) return true;

    return (
      normalizeSearch(item.name).includes(query) ||
      normalizeSearch(item.cat).includes(query)
    );
  });
}

/* =========================================================
  CATEGORÍAS
========================================================= */

export function createPackCategoryElement({
  category,
  items = [],
  readonly = true,
} = {}) {
  const safeCategory = normalizePackCategory(category);
  const safeItems = normalizePackItems(items);

  const section = document.createElement("section");
  section.className = "pack-cat-card";
  section.dataset.packCategory = safeCategory;

  const phase = packingUIState.phase;
  const packedCount = safeItems.filter((item) => item[phase]).length;

  section.innerHTML = `
    <div class="pack-cat-title">
      <span>${escapeHTML(safeCategory)}</span>
      <small aria-hidden="true">${packedCount}/${safeItems.length}</small>
      <span class="sr-only">, ${packedCount} de ${safeItems.length} artículos empacados</span>
    </div>
  `;

  safeItems
    .slice()
    .sort(sortPackItems)
    .forEach((item) => {
      section.appendChild(
        createPackItemElement({
          item,
          readonly,
        })
      );
    });

  return section;
}

/* =========================================================
  ITEM
========================================================= */

export function createPackItemElement({
  item,
  readonly = true,
} = {}) {
  const safeItem = normalizePackItem(item);

  const phase = packingUIState.phase;
  const checked = Boolean(safeItem[phase]);
  const copy = PHASE_COPY[phase];
  const isMissing = safeItem.packed && !safeItem.returned;

  const badge = checked
    ? copy.doneBadge
    : phase === PACK_PHASES.returned && isMissing
      ? copy.missingBadge
      : copy.pendingBadge;

  const row = document.createElement("div");
  row.className = [
    "pack-item",
    checked ? "packed" : "",
    !checked && phase === PACK_PHASES.returned && isMissing ? "missing" : "",
  ].filter(Boolean).join(" ");
  row.dataset.packId = safeItem.id;
  row.dataset.packPhase = phase;

  row.innerHTML = `
    <button
      class="pack-chk ${checked ? "checked" : ""}"
      type="button"
      aria-pressed="${checked ? "true" : "false"}"
      aria-label="${checked ? copy.checkOn : copy.checkOff}"
      data-action="toggle-pack-item"
      data-pack-id="${escapeAttr(safeItem.id)}"
      data-phase="${phase}"
      ${readonly ? "disabled" : ""}
    >
      ${checked ? "✓" : ""}
    </button>

    <span class="pack-body">
      <span class="pack-txt" title="${escapeAttr(safeItem.name)}">
        ${escapeHTML(safeItem.name || "Artículo")}
      </span>
      <span class="pack-state">${badge}</span>
    </span>

    <button
      class="pack-del"
      type="button"
      title="Eliminar artículo"
      aria-label="Eliminar artículo ${escapeAttr(safeItem.name || "artículo")}"
      data-action="delete-pack-item"
      data-pack-id="${escapeAttr(safeItem.id)}"
      ${readonly ? "disabled" : ""}
    >
      ×
    </button>
  `;

  return row;
}

/* =========================================================
  FORMULARIO
========================================================= */

export function collectPackingForm() {
  return {
    name: normalizePackName(getValue(PACK_DOM_IDS.item)),
    cat: normalizePackCategory(getValue(PACK_DOM_IDS.category)),
  };
}

function confirmAddPackItem() {
  if (packingUIState.readonly) return;

  if (!packingUIState.tripId) {
    focusField(PACK_DOM_IDS.item);

    packingUIState.callbacks.onAddPackItem?.({
      tripId: null,
      error: "missing-trip",
    });

    return;
  }

  const itemData = collectPackingForm();

  if (!itemData.name) {
    focusField(PACK_DOM_IDS.item);

    packingUIState.callbacks.onAddPackItem?.({
      tripId: packingUIState.tripId,
      error: "missing-name",
    });

    return;
  }

  const packItem = createPackItem(itemData);

  packingUIState.callbacks.onAddPackItem?.({
    tripId: packingUIState.tripId,
    packItem,
  });

  clearPackingForm({
    keepCategory: true,
  });
}

function confirmAddDefaultPackItems() {
  if (packingUIState.readonly) return;

  if (!packingUIState.tripId) {
    packingUIState.callbacks.onAddDefaultPackItems?.({
      tripId: null,
      packItems: [],
      error: "missing-trip",
    });

    return;
  }

  const defaultItems = createDefaultPackItems();

  packingUIState.callbacks.onAddDefaultPackItems?.({
    tripId: packingUIState.tripId,
    packItems: defaultItems,
  });
}

export function clearPackingForm({
  keepCategory = true,
} = {}) {
  setFieldValue(PACK_DOM_IDS.item, "");

  if (!keepCategory) {
    setFieldValue(PACK_DOM_IDS.category, DEFAULT_PACK_CATEGORY);
  }
}

export function createPackItem({
  id = "",
  name,
  text = "",
  title = "",
  label = "",
  cat = DEFAULT_PACK_CATEGORY,
  category = "",
  group = "",
  packed = false,
  done = false,
  checked = false,
  returned = false,
} = {}) {
  const finalName = normalizePackName(name || text || title || label);

  if (!finalName) {
    throw new Error("El artículo necesita nombre.");
  }

  return {
    id: cleanPackId(id) || makeId("pack"),
    name: finalName.slice(0, 120),
    cat: normalizePackCategory(cat || category || group),
    packed: Boolean(packed || done || checked),
    returned: Boolean(returned),
  };
}

export function createDefaultPackItems() {
  const items = [];

  Object.entries(DEFAULT_PACK_ITEMS).forEach(([cat, names]) => {
    names.forEach((name) => {
      items.push(
        createPackItem({
          name,
          cat,
          packed: false,
        })
      );
    });
  });

  return items;
}

/* =========================================================
  READONLY
========================================================= */

export function setPackingReadonlyMode(readonly = true) {
  packingUIState.readonly = Boolean(readonly);

  const form = document.getElementById(PACK_DOM_IDS.form);

  if (form) {
    form.classList.toggle("is-disabled", packingUIState.readonly);
    form.setAttribute("aria-disabled", String(packingUIState.readonly));
  }

  [
    PACK_DOM_IDS.item,
    PACK_DOM_IDS.category,
  ].forEach((id) => {
    const field = document.getElementById(id);
    if (field) field.disabled = packingUIState.readonly;
  });

  document
    .querySelectorAll('[data-action="add-pack-item"], [data-action="add-default-pack"]')
    .forEach((button) => {
      button.disabled = packingUIState.readonly;
      button.setAttribute("aria-disabled", packingUIState.readonly ? "true" : "false");
    });

  document
    .querySelectorAll('[data-action="bulk-pack"], [data-action="import-pack"]')
    .forEach((button) => {
      button.disabled = packingUIState.readonly;
      button.setAttribute("aria-disabled", packingUIState.readonly ? "true" : "false");
    });

  document
    .querySelectorAll('[data-action="toggle-pack-item"], [data-action="delete-pack-item"]')
    .forEach((button) => {
      button.disabled = packingUIState.readonly;
      button.setAttribute("aria-disabled", packingUIState.readonly ? "true" : "false");
    });
}

/* =========================================================
  EMPTY / CLEAR
========================================================= */

function renderEmptyPacking() {
  const copy = PHASE_COPY[packingUIState.phase];

  return `
    <div class="empty" style="grid-column: 1 / -1;">
      <div class="ei" aria-hidden="true">🎒</div>
      <p>
        ${escapeHTML(copy.emptyTitle)}<br>
        ${escapeHTML(copy.emptyText)}
      </p>
    </div>
  `;
}

function renderNoMatchesPacking() {
  return `
    <div class="empty" style="grid-column: 1 / -1;">
      <div class="ei" aria-hidden="true">🔎</div>
      <p>
        Ningún artículo coincide con el filtro.<br>
        Cambia la búsqueda o el estado y vuelve a intentar.
      </p>
    </div>
  `;
}

export function clearPackingUI() {
  packingUIState.tripId = null;
  packingUIState.readonly = true;
  packingUIState.items = [];
  packingUIState.filters = {
    search: "",
    status: "all",
    cat: "all",
  };

  setFieldValue(PACK_DOM_IDS.search, "");
  setFieldValue(PACK_DOM_IDS.status, "all");
  setFieldValue(PACK_DOM_IDS.catFilter, "all");
  setPackingPhase(PACK_PHASES.packed, { silent: true });

  const container = document.getElementById(PACK_DOM_IDS.container);

  if (container) {
    container.innerHTML = renderEmptyPacking();
  }

  renderPackingProgress([]);
  renderPackingStats([]);
  hydratePackingCategoryFilter([]);

  clearPackingForm({
    keepCategory: false,
  });

  hydratePackingCategoryField();
  setPackingReadonlyMode(true);
}

/* =========================================================
  AGRUPACIÓN / ORDEN
========================================================= */

export function groupPackItemsByCategory(packItems = []) {
  return normalizePackItems(packItems).reduce((groups, item) => {
    const key = normalizePackCategory(item?.cat);

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(item);

    return groups;
  }, {});
}

function sortPackCategories(categories = []) {
  return categories.slice().sort((a, b) => {
    const ia = PACK_CATEGORY_ORDER.indexOf(a);
    const ib = PACK_CATEGORY_ORDER.indexOf(b);

    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;

    return normalizeSearch(a).localeCompare(normalizeSearch(b), "es");
  });
}

function sortPackItems(a, b) {
  const itemA = normalizePackItem(a);
  const itemB = normalizePackItem(b);

  const phase = packingUIState.phase;

  if (Boolean(itemA[phase]) !== Boolean(itemB[phase])) {
    return itemA[phase] ? 1 : -1;
  }

  return normalizeSearch(itemA.name).localeCompare(
    normalizeSearch(itemB.name),
    "es"
  );
}

/* =========================================================
  DEDUPLICACIÓN PARA LISTA BASE
========================================================= */

export function mergePackItemsWithoutDuplicates(currentItems = [], newItems = []) {
  const safeCurrentItems = normalizePackItems(currentItems);
  const safeNewItems = normalizePackItems(newItems);

  const existing = new Set(
    safeCurrentItems.map((item) => getPackItemKey(item))
  );

  const filteredNewItems = safeNewItems.filter((item) => {
    const key = getPackItemKey(item);

    if (!key || existing.has(key)) return false;

    existing.add(key);
    return true;
  });

  const mergedItems = [
    ...safeCurrentItems,
    ...filteredNewItems,
  ];

  /*
    Compatibilidad:
    - app.js anterior esperaba un array.
    - app.js nuevo puede leer mergedItems / addedItems.
    - Las propiedades no enumerables evitan que terminen guardadas como basura.
    Sí, JavaScript necesita supervisión adulta.
  */
  Object.defineProperties(mergedItems, {
    mergedItems: {
      value: mergedItems,
      enumerable: false,
      configurable: true,
    },
    addedItems: {
      value: filteredNewItems,
      enumerable: false,
      configurable: true,
    },
  });

  return mergedItems;
}

function getPackItemKey(item) {
  const safeItem = normalizePackItem(item);

  return `${normalizeSearch(safeItem.cat)}::${normalizeSearch(safeItem.name)}`;
}

/* =========================================================
  NORMALIZADORES
========================================================= */

export function normalizePackItems(items = []) {
  if (!Array.isArray(items)) return [];

  return items
    .filter((item) => item && typeof item === "object")
    .map(normalizePackItem)
    .filter((item) => item.name);
}

export function normalizePackItem(item = {}) {
  if (!item || typeof item !== "object") {
    return {
      id: makeId("pack"),
      name: "",
      cat: DEFAULT_PACK_CATEGORY,
      packed: false,
      returned: false,
    };
  }

  const name = normalizePackName(
    item.name ||
    item.text ||
    item.title ||
    item.label ||
    ""
  );

  const cat = normalizePackCategory(
    item.cat ||
    item.category ||
    item.group ||
    DEFAULT_PACK_CATEGORY
  );

  return {
    id: cleanPackId(item.id) || makeId("pack"),
    name: name.slice(0, 120),
    cat,
    packed: Boolean(item.packed || item.done || item.checked),
    returned: Boolean(item.returned),
  };
}

function normalizePackName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePackCategory(value) {
  const category = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  return category || DEFAULT_PACK_CATEGORY;
}

function cleanPackId(value) {
  return String(value || "")
    .replace(/\s+/g, "_")
    .trim()
    .slice(0, 80);
}

/* =========================================================
  CATEGORÍAS DEL FORMULARIO
========================================================= */

function hydratePackingCategoryField(items = []) {
  const field = document.getElementById(PACK_DOM_IDS.category);
  if (!field) return;

  const categories = new Set([
    ...PACK_CATEGORY_ORDER,
    ...normalizePackItems(items).map((item) => item.cat),
  ]);

  if (field.tagName === "SELECT") {
    const currentValue = field.value || DEFAULT_PACK_CATEGORY;

    const existingOptions = new Set(
      Array.from(field.options || []).map((option) => option.value)
    );

    categories.forEach((category) => {
      if (existingOptions.has(category)) return;

      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      field.appendChild(option);
    });

    field.value = categories.has(currentValue)
      ? currentValue
      : DEFAULT_PACK_CATEGORY;

    return;
  }

  if (!field.value) {
    field.value = DEFAULT_PACK_CATEGORY;
  }
}

function hydratePackingCategoryFilter(items = []) {
  const field = document.getElementById(PACK_DOM_IDS.catFilter);
  if (!field) return;

  const current = field.value || packingUIState.filters.cat || "all";

  const categories = sortPackCategories(
    Array.from(new Set(normalizePackItems(items).map((item) => item.cat)))
  );

  field.innerHTML = [
    '<option value="all">Todas las categorías</option>',
    ...categories.map((category) => {
      const safe = escapeAttr(category);
      return `<option value="${safe}">${escapeHTML(category)}</option>`;
    }),
  ].join("");

  field.value = categories.includes(current) ? current : "all";
  packingUIState.filters.cat = field.value;
}

/* =========================================================
  HELPERS DOM
========================================================= */

function setText(id, value) {
  const node = document.getElementById(id);
  if (!node) return;

  node.textContent = String(value ?? "");
}

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

function normalizeSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}\s:/_-]/gu, "")
    .replace(/\s+/g, " ")
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