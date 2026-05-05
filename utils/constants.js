/* =========================================================
  constants.js
  Constantes globales para Brújula
  App de viajes con Firebase + Google Login
========================================================= */

/* =========================================================
  APP
========================================================= */

export const APP_CONFIG = {
  name: "Brújula",
  subtitle: "Planificador de viajes",
  description:
    "Planificador de viajes con Firebase, login con Google, presupuestos, actividades, empaque y viajes compartidos por correo.",
  locale: "es-CO",
  defaultCurrency: "COP $",
  defaultTimezone: "America/Bogota",
};

export const APP_ROUTES = {
  auth: "auth",
  home: "home",
  planner: "planner",
};

export const SCREEN_IDS = {
  loading: "loadingScreen",
  auth: "authScreen",
  appShell: "appShell",
  home: "homeScreen",
  planner: "plannerScreen",
};

/* =========================================================
  FIREBASE
========================================================= */

export const FIREBASE_COLLECTIONS = {
  users: "users",
  trips: "trips",
};

export const FIREBASE_FIELDS = {
  accessEmails: "accessEmails",
  rolesByEmail: "rolesByEmail",
  ownerUid: "ownerUid",
  ownerEmail: "ownerEmail",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
};

/* =========================================================
  ROLES
========================================================= */

export const USER_ROLES = {
  owner: "owner",
  editor: "editor",
  viewer: "viewer",
};

export const ROLE_LABELS = {
  [USER_ROLES.owner]: "Owner",
  [USER_ROLES.editor]: "Editor",
  [USER_ROLES.viewer]: "Viewer",
};

export const ROLE_PUBLIC_LABELS = {
  [USER_ROLES.owner]: "Mío",
  [USER_ROLES.editor]: "Editor",
  [USER_ROLES.viewer]: "Compartido",
};

export const ROLE_DESCRIPTIONS = {
  [USER_ROLES.owner]: "Puede editar, compartir y eliminar el viaje.",
  [USER_ROLES.editor]: "Puede ver y editar el viaje, pero no compartirlo ni eliminarlo.",
  [USER_ROLES.viewer]: "Puede ver el viaje, pero no editarlo.",
};

export const EDITABLE_ROLES = [
  USER_ROLES.owner,
  USER_ROLES.editor,
];

export const SHAREABLE_ROLES = [
  USER_ROLES.owner,
];

export const DELETABLE_ROLES = [
  USER_ROLES.owner,
];

/* =========================================================
  ESTADOS DEL VIAJE
========================================================= */

export const TRIP_STATUS = {
  dreaming: "sonando",
  planning: "planificando",
  booked: "reservado",
  onTheWay: "en-camino",
  living: "viviendo",
  completed: "completado",
};

export const TRIP_STATUS_LABELS = {
  [TRIP_STATUS.dreaming]: "Soñándolo",
  [TRIP_STATUS.planning]: "Planeándolo",
  [TRIP_STATUS.booked]: "Reservado",
  [TRIP_STATUS.onTheWay]: "En camino",
  [TRIP_STATUS.living]: "Viviéndolo",
  [TRIP_STATUS.completed]: "Ya fue, pero quedó en el alma",
};

export const TRIP_STATUS_ICONS = {
  [TRIP_STATUS.dreaming]: "💭",
  [TRIP_STATUS.planning]: "🗓️",
  [TRIP_STATUS.booked]: "✅",
  [TRIP_STATUS.onTheWay]: "🚀",
  [TRIP_STATUS.living]: "🌟",
  [TRIP_STATUS.completed]: "📸",
};

export const TRIP_STATUS_OPTIONS = [
  {
    value: TRIP_STATUS.dreaming,
    label: `${TRIP_STATUS_ICONS[TRIP_STATUS.dreaming]} ${TRIP_STATUS_LABELS[TRIP_STATUS.dreaming]}`,
  },
  {
    value: TRIP_STATUS.planning,
    label: `${TRIP_STATUS_ICONS[TRIP_STATUS.planning]} ${TRIP_STATUS_LABELS[TRIP_STATUS.planning]}`,
  },
  {
    value: TRIP_STATUS.booked,
    label: `${TRIP_STATUS_ICONS[TRIP_STATUS.booked]} ${TRIP_STATUS_LABELS[TRIP_STATUS.booked]}`,
  },
  {
    value: TRIP_STATUS.onTheWay,
    label: `${TRIP_STATUS_ICONS[TRIP_STATUS.onTheWay]} ${TRIP_STATUS_LABELS[TRIP_STATUS.onTheWay]}`,
  },
  {
    value: TRIP_STATUS.living,
    label: `${TRIP_STATUS_ICONS[TRIP_STATUS.living]} ${TRIP_STATUS_LABELS[TRIP_STATUS.living]}`,
  },
  {
    value: TRIP_STATUS.completed,
    label: `${TRIP_STATUS_ICONS[TRIP_STATUS.completed]} ${TRIP_STATUS_LABELS[TRIP_STATUS.completed]}`,
  },
];

/* =========================================================
  TIPOS DE VIAJE
========================================================= */

export const TRIP_TYPES = {
  beach: "🏖️ Playa y descanso",
  nature: "🏔️ Aventura y naturaleza",
  culture: "🏛️ Cultural e histórico",
  food: "🍽️ Gastronómico",
  business: "💼 Negocios",
  family: "👨‍👩‍👧 Familiar",
  romantic: "💑 Romántico",
  friends: "🎉 Grupos y amigos",
  arts: "🎭 Arte y cultura",
  spiritual: "🧘 Descanso espiritual",
};

export const TRIP_TYPE_OPTIONS = [
  {
    value: "",
    label: "Seleccionar...",
  },
  {
    value: TRIP_TYPES.beach,
    label: TRIP_TYPES.beach,
  },
  {
    value: TRIP_TYPES.nature,
    label: TRIP_TYPES.nature,
  },
  {
    value: TRIP_TYPES.culture,
    label: TRIP_TYPES.culture,
  },
  {
    value: TRIP_TYPES.food,
    label: TRIP_TYPES.food,
  },
  {
    value: TRIP_TYPES.business,
    label: TRIP_TYPES.business,
  },
  {
    value: TRIP_TYPES.family,
    label: TRIP_TYPES.family,
  },
  {
    value: TRIP_TYPES.romantic,
    label: TRIP_TYPES.romantic,
  },
  {
    value: TRIP_TYPES.friends,
    label: TRIP_TYPES.friends,
  },
  {
    value: TRIP_TYPES.arts,
    label: TRIP_TYPES.arts,
  },
  {
    value: TRIP_TYPES.spiritual,
    label: TRIP_TYPES.spiritual,
  },
];

/* =========================================================
  BANNERS DE VIAJE
========================================================= */

export const TRIP_BANNERS = {
  [TRIP_TYPES.beach]: {
    bg: "linear-gradient(135deg, #38bdf8, #10a99a)",
    icon: "🏖️",
  },
  [TRIP_TYPES.nature]: {
    bg: "linear-gradient(135deg, #15803d, #84cc16)",
    icon: "🏔️",
  },
  [TRIP_TYPES.culture]: {
    bg: "linear-gradient(135deg, #7c3aed, #c084fc)",
    icon: "🏛️",
  },
  [TRIP_TYPES.food]: {
    bg: "linear-gradient(135deg, #ff7a59, #f5a524)",
    icon: "🍽️",
  },
  [TRIP_TYPES.business]: {
    bg: "linear-gradient(135deg, #1d4ed8, #60a5fa)",
    icon: "💼",
  },
  [TRIP_TYPES.family]: {
    bg: "linear-gradient(135deg, #ec4899, #fbbf24)",
    icon: "👨‍👩‍👧",
  },
  [TRIP_TYPES.romantic]: {
    bg: "linear-gradient(135deg, #db2777, #fb7185)",
    icon: "💑",
  },
  [TRIP_TYPES.friends]: {
    bg: "linear-gradient(135deg, #f97316, #a855f7)",
    icon: "🎉",
  },
  [TRIP_TYPES.arts]: {
    bg: "linear-gradient(135deg, #9333ea, #14b8a6)",
    icon: "🎭",
  },
  [TRIP_TYPES.spiritual]: {
    bg: "linear-gradient(135deg, #8b5cf6, #2dd4bf)",
    icon: "🧘",
  },
};

export const DEFAULT_TRIP_BANNER = {
  bg: "linear-gradient(135deg, #7c3aed, #10a99a)",
  icon: "🌎",
};

/* =========================================================
  FILTROS HOME
========================================================= */

export const HOME_FILTERS = {
  all: "all",
  owned: "owned",
  shared: "shared",
  upcoming: "upcoming",
  completed: "completed",
};

export const HOME_FILTER_LABELS = {
  [HOME_FILTERS.all]: "Todos",
  [HOME_FILTERS.owned]: "Creados por mí",
  [HOME_FILTERS.shared]: "Compartidos",
  [HOME_FILTERS.upcoming]: "Próximos",
  [HOME_FILTERS.completed]: "Completados",
};

/* =========================================================
  TABS DEL PLANNER
========================================================= */

export const TRIP_TABS = {
  summary: "resumen",
  budget: "presupuesto",
  activities: "actividades",
  packing: "empaque",
  sharing: "compartir",
};

export const TRIP_TAB_LABELS = {
  [TRIP_TABS.summary]: "Resumen",
  [TRIP_TABS.budget]: "Presupuesto",
  [TRIP_TABS.activities]: "Actividades",
  [TRIP_TABS.packing]: "Empaque",
  [TRIP_TABS.sharing]: "Compartir",
};

export const TRIP_TAB_ICONS = {
  [TRIP_TABS.summary]: "🗺️",
  [TRIP_TABS.budget]: "💰",
  [TRIP_TABS.activities]: "📍",
  [TRIP_TABS.packing]: "🎒",
  [TRIP_TABS.sharing]: "👥",
};

/* =========================================================
  MONEDAS
========================================================= */

export const CURRENCIES = {
  cop: "COP $",
  usd: "USD $",
  eur: "EUR €",
  mxn: "MXN $",
  ars: "ARS $",
  brl: "BRL R$",
};

export const CURRENCY_SYMBOLS = {
  [CURRENCIES.cop]: "$",
  [CURRENCIES.usd]: "$",
  [CURRENCIES.eur]: "€",
  [CURRENCIES.mxn]: "$",
  [CURRENCIES.ars]: "$",
  [CURRENCIES.brl]: "R$",
};

export const CURRENCY_OPTIONS = [
  {
    value: CURRENCIES.cop,
    label: CURRENCIES.cop,
  },
  {
    value: CURRENCIES.usd,
    label: CURRENCIES.usd,
  },
  {
    value: CURRENCIES.eur,
    label: CURRENCIES.eur,
  },
  {
    value: CURRENCIES.mxn,
    label: CURRENCIES.mxn,
  },
  {
    value: CURRENCIES.ars,
    label: CURRENCIES.ars,
  },
  {
    value: CURRENCIES.brl,
    label: CURRENCIES.brl,
  },
];

/* =========================================================
  PRESUPUESTO
========================================================= */

export const BUDGET_STATUS = {
  empty: "empty",
  ok: "ok",
  warning: "warn",
  over: "over",
};

export const BUDGET_STATUS_LABELS = {
  [BUDGET_STATUS.empty]: "Sin presupuesto",
  [BUDGET_STATUS.ok]: "Controlado",
  [BUDGET_STATUS.warning]: "Cerca del límite",
  [BUDGET_STATUS.over]: "Pasado del presupuesto",
};

export const DEFAULT_BUDGET_CATEGORIES = [
  {
    key: "flights",
    icon: "✈️",
    name: "Vuelos",
    budget: 0,
    spent: 0,
  },
  {
    key: "lodging",
    icon: "🏨",
    name: "Alojamiento",
    budget: 0,
    spent: 0,
  },
  {
    key: "food",
    icon: "🍽️",
    name: "Comida",
    budget: 0,
    spent: 0,
  },
  {
    key: "transport",
    icon: "🚌",
    name: "Transporte local",
    budget: 0,
    spent: 0,
  },
  {
    key: "activities",
    icon: "🎡",
    name: "Actividades",
    budget: 0,
    spent: 0,
  },
  {
    key: "shopping",
    icon: "🛍️",
    name: "Compras",
    budget: 0,
    spent: 0,
  },
];

/* =========================================================
  ACTIVIDADES
========================================================= */

export const ACTIVITY_CATEGORIES = {
  food: "🍽️ Comida",
  culture: "🏛️ Cultural",
  beach: "🏖️ Playa",
  adventure: "🧗 Aventura",
  shopping: "🛍️ Compras",
  transport: "🚌 Transporte",
  lodging: "🏨 Alojamiento",
  photos: "📸 Fotos y paseos",
  entertainment: "🎉 Entretenimiento",
  rest: "🧘 Descanso",
  other: "⚙️ Otro",
};

export const ACTIVITY_CATEGORY_OPTIONS = [
  ACTIVITY_CATEGORIES.food,
  ACTIVITY_CATEGORIES.culture,
  ACTIVITY_CATEGORIES.beach,
  ACTIVITY_CATEGORIES.adventure,
  ACTIVITY_CATEGORIES.shopping,
  ACTIVITY_CATEGORIES.transport,
  ACTIVITY_CATEGORIES.lodging,
  ACTIVITY_CATEGORIES.photos,
  ACTIVITY_CATEGORIES.entertainment,
  ACTIVITY_CATEGORIES.rest,
  ACTIVITY_CATEGORIES.other,
];

export const ACTIVITY_COLORS = {
  [ACTIVITY_CATEGORIES.food]: "#ff7a59",
  [ACTIVITY_CATEGORIES.culture]: "#9b72cf",
  [ACTIVITY_CATEGORIES.beach]: "#10a99a",
  [ACTIVITY_CATEGORIES.adventure]: "#f5a524",
  [ACTIVITY_CATEGORIES.shopping]: "#ec4899",
  [ACTIVITY_CATEGORIES.transport]: "#3b82f6",
  [ACTIVITY_CATEGORIES.lodging]: "#16a34a",
  [ACTIVITY_CATEGORIES.photos]: "#f59e0b",
  [ACTIVITY_CATEGORIES.entertainment]: "#f97316",
  [ACTIVITY_CATEGORIES.rest]: "#8b5cf6",
  [ACTIVITY_CATEGORIES.other]: "#8b8199",
};

export const DEFAULT_ACTIVITY_CATEGORY = ACTIVITY_CATEGORIES.other;

/* =========================================================
  EMPAQUE
========================================================= */

export const PACK_CATEGORIES = {
  clothes: "👕 Ropa",
  hygiene: "🪥 Higiene",
  meds: "💊 Medicamentos",
  electronics: "📱 Electrónicos",
  documents: "📄 Documentos",
  accessories: "🎒 Accesorios",
  snacks: "🍫 Snacks",
  other: "📦 Otros",
};

export const PACK_CATEGORY_OPTIONS = [
  PACK_CATEGORIES.clothes,
  PACK_CATEGORIES.hygiene,
  PACK_CATEGORIES.meds,
  PACK_CATEGORIES.electronics,
  PACK_CATEGORIES.documents,
  PACK_CATEGORIES.accessories,
  PACK_CATEGORIES.snacks,
  PACK_CATEGORIES.other,
];

export const PACK_CATEGORY_ORDER = [
  PACK_CATEGORIES.documents,
  PACK_CATEGORIES.clothes,
  PACK_CATEGORIES.hygiene,
  PACK_CATEGORIES.meds,
  PACK_CATEGORIES.electronics,
  PACK_CATEGORIES.accessories,
  PACK_CATEGORIES.snacks,
  PACK_CATEGORIES.other,
];

export const DEFAULT_PACK_CATEGORY = PACK_CATEGORIES.other;

export const DEFAULT_PACK_ITEMS = {
  [PACK_CATEGORIES.documents]: [
    "Cédula / pasaporte",
    "Tiquetes o reservas",
    "Seguro de viaje",
    "Tarjetas y efectivo",
  ],
  [PACK_CATEGORIES.clothes]: [
    "Camisas / blusas",
    "Pantalones / shorts",
    "Ropa interior",
    "Pijama",
    "Ropa de baño",
    "Tenis o sandalias",
  ],
  [PACK_CATEGORIES.hygiene]: [
    "Cepillo y crema dental",
    "Shampoo",
    "Desodorante",
    "Protector solar",
    "Repelente",
  ],
  [PACK_CATEGORIES.meds]: [
    "Medicamentos personales",
    "Analgésicos",
    "Antidiarreico",
    "Curitas",
  ],
  [PACK_CATEGORIES.electronics]: [
    "Cargador del celular",
    "Power bank",
    "Audífonos",
    "Adaptador de corriente",
  ],
  [PACK_CATEGORIES.accessories]: [
    "Lentes de sol",
    "Gorra / sombrero",
    "Mochila pequeña",
    "Candado de maleta",
  ],
  [PACK_CATEGORIES.snacks]: [
    "Botella de agua",
    "Snacks ligeros",
    "Chicles / mentas",
  ],
};

/* =========================================================
  TOASTS / UI FEEDBACK
========================================================= */

export const TOAST_TYPES = {
  success: "success",
  error: "error",
  warning: "warning",
  info: "info",
};

export const TOAST_ICONS = {
  [TOAST_TYPES.success]: "✅",
  [TOAST_TYPES.error]: "⚠️",
  [TOAST_TYPES.warning]: "👀",
  [TOAST_TYPES.info]: "✨",
};

export const SYNC_STATUS = {
  idle: "idle",
  loading: "loading",
  online: "online",
  error: "error",
};

export const SYNC_STATUS_LABELS = {
  [SYNC_STATUS.idle]: "Listo",
  [SYNC_STATUS.loading]: "Sincronizando...",
  [SYNC_STATUS.online]: "Sincronizado",
  [SYNC_STATUS.error]: "Error de conexión",
};

/* =========================================================
  FORM / VALIDACIÓN
========================================================= */

export const VALIDATION = {
  maxTripTitleLength: 80,
  maxTripDestinationLength: 120,
  maxNotesLength: 4000,
  maxTravelers: 99,
  minTravelers: 1,
};

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* =========================================================
  TIME / DEBOUNCE
========================================================= */

export const TIME = {
  saveDebounceMs: 450,
  toastDurationMs: 3400,
  modalFocusDelayMs: 70,
  oneDayMs: 86_400_000,
};

/* =========================================================
  SELECTORES DOM
========================================================= */

export const DOM_IDS = {
  loadingScreen: "loadingScreen",
  authScreen: "authScreen",
  appShell: "appShell",
  homeScreen: "homeScreen",
  plannerScreen: "plannerScreen",

  googleLoginBtn: "googleLoginBtn",

  userName: "userName",
  userEmail: "userEmail",
  userPhoto: "userPhoto",

  syncStatus: "syncStatus",
  syncStatusText: "syncStatusText",

  tripGrid: "tripGrid",
  emptyHomeState: "emptyHomeState",
  homeSub: "homeSub",
  tripSearchInput: "tripSearchInput",

  tripTitleInput: "tripTitleInput",
  roleBadge: "roleBadge",
  readonlyNotice: "readonlyNotice",

  statRow: "statRow",
  actBadge: "actBadge",
  packBadge: "packBadge",

  totalAmt: "totalAmt",
  totalSub: "totalSub",
  budgetCats: "budgetCats",

  activitiesContainer: "activitiesContainer",
  packContainer: "packContainer",
  packBar: "packBar",
  packLbl: "packLbl",

  sharedPeopleList: "sharedPeopleList",

  categoryModal: "categoryModal",
  deleteTripModal: "deleteTripModal",
  deleteTripName: "deleteTripName",

  toast: "toast",
  toastIcon: "toastIcon",
  toastText: "toastText",
};

export const DATA_ACTIONS = {
  signInGoogle: "sign-in-google",
  signOut: "sign-out",
  goHome: "go-home",

  createTrip: "create-trip",
  openTrip: "open-trip",
  duplicateTrip: "duplicate-trip",
  requestDeleteTrip: "request-delete-trip",
  confirmDeleteTrip: "confirm-delete-trip",

  openShareTab: "open-share-tab",
  shareTrip: "share-trip",
  removeSharedEmail: "remove-shared-email",

  openCategoryModal: "open-category-modal",
  confirmAddCategory: "confirm-add-category",
  deleteBudgetCat: "delete-budget-cat",

  addActivity: "add-activity",
  toggleActivity: "toggle-activity",
  deleteActivity: "delete-activity",

  addPackItem: "add-pack-item",
  addDefaultPack: "add-default-pack",
  togglePackItem: "toggle-pack-item",
  deletePackItem: "delete-pack-item",

  closeModal: "close-modal",
};

/* =========================================================
  MENSAJES DE UI
========================================================= */

export const UI_MESSAGES = {
  loading: "Cargando tus viajes, tus planes y la fantasía colectiva de no olvidar nada...",
  noTrips:
    "Crea tu primer viaje y compártelo solo con quienes van en ese plan.",
  noTripsLong:
    "Crea el primero y deja de planear en chats perdidos, notas sueltas y papelitos que terminan enfrentando su destino natural: desaparecer.",
  noActivities:
    "Sin actividades todavía. Agrega un plan bonito, útil o descaradamente optimista.",
  noPacking:
    "Lista vacía. Agrega artículos o usa la lista base para no empacar como personaje secundario.",
  noBudget:
    "Sin categorías todavía. Agrega vuelos, alojamiento, comida o cualquier otra forma sofisticada de gastar plata.",
  readonly:
    "Estás viendo este viaje en modo solo lectura. Puedes consultarlo, pero no editarlo.",
};

/* =========================================================
  CLASES CSS
========================================================= */

export const CSS_CLASSES = {
  active: "active",
  hidden: "hidden",
  open: "open",
  readonly: "is-readonly",
  loading: "is-loading",
  disabled: "is-disabled",

  roleOwner: "role-owner",
  roleEditor: "role-editor",
  roleViewer: "role-viewer",

  barOk: "bar-ok",
  barWarn: "bar-warn",
  barOver: "bar-over",
};