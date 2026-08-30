/* =========================================================
  trips.service.js
  Servicio de viajes para Brújula
  Firestore + viajes privados/compartidos por correo
========================================================= */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  db,
  FIREBASE_COLLECTIONS,
} from "./firebase.config.js";

import {
  normalizeEmail,
} from "./auth.service.js";

/* =========================================================
  CONSTANTES
========================================================= */

export const TRIP_ROLES = Object.freeze({
  owner: "owner",
  editor: "editor",
  viewer: "viewer",
});

export const TRIP_STATUS = Object.freeze({
  dreaming: "sonando",
  planning: "planificando",
  booked: "reservado",
  onTheWay: "en-camino",
  living: "viviendo",
  completed: "completado",
});

export const DEFAULT_CURRENCY = "COP $";

export const TRIP_ALLOWED_FIELDS = Object.freeze([
  "title",
  "destino",
  "fechaSalida",
  "fechaRegreso",
  "viajeros",
  "tipo",
  "estado",
  "notas",
  "currency",
  "ownerUid",
  "ownerEmail",
  "accessEmails",
  "rolesByEmail",
  "budgetCats",
  "activities",
  "packItems",
  "createdAt",
  "updatedAt",
]);

export const TRIP_MUTABLE_FIELDS = Object.freeze([
  "title",
  "destino",
  "fechaSalida",
  "fechaRegreso",
  "viajeros",
  "tipo",
  "estado",
  "notas",
  "currency",
  "accessEmails",
  "rolesByEmail",
  "budgetCats",
  "activities",
  "packItems",
]);

const DEFAULT_TRIP_TITLE = "Nuevo viaje";
const DEFAULT_UNKNOWN_TITLE = "Sin título";

const MAX_ACCESS_EMAILS = 50;
const MAX_BUDGET_CATS = 100;
const MAX_ACTIVITIES = 300;
const MAX_PACK_ITEMS = 300;

/* =========================================================
  REFERENCIAS FIRESTORE
========================================================= */

function tripsCollectionRef() {
  return collection(db, FIREBASE_COLLECTIONS.trips);
}

function tripDocRef(tripId) {
  assertTripId(tripId);

  return doc(db, FIREBASE_COLLECTIONS.trips, tripId);
}

/* =========================================================
  MODELO BASE
========================================================= */

export function createFreshTrip(user, overrides = {}) {
  const email = normalizeEmail(user?.email || user?.emailLower);

  if (!user?.uid || !email) {
    throw new Error("No se puede crear un viaje sin usuario autenticado.");
  }

  const baseTrip = {
    title: DEFAULT_TRIP_TITLE,
    destino: "",
    fechaSalida: "",
    fechaRegreso: "",
    viajeros: 2,
    tipo: "",
    estado: TRIP_STATUS.planning,
    notas: "",
    currency: DEFAULT_CURRENCY,

    ownerUid: user.uid,
    ownerEmail: email,

    accessEmails: [email],

    rolesByEmail: {
      [email]: TRIP_ROLES.owner,
    },

    budgetCats: getDefaultBudgetCats(),
    activities: [],
    packItems: [],

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  return sanitizeTripForCreate({
    ...baseTrip,
    ...overrides,
    ownerUid: user.uid,
    ownerEmail: email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function createLocalFreshTrip(user, overrides = {}) {
  const now = new Date();
  const trip = createFreshTrip(user, overrides);

  return normalizeTrip({
    ...trip,
    id: overrides.id || makeId("local_trip"),
    createdAt: now,
    updatedAt: now,
  });
}

export function getDefaultBudgetCats() {
  return [
    {
      id: makeId("cat"),
      icon: "✈️",
      name: "Vuelos",
      budget: 0,
      spent: 0,
    },
    {
      id: makeId("cat"),
      icon: "🏨",
      name: "Alojamiento",
      budget: 0,
      spent: 0,
    },
    {
      id: makeId("cat"),
      icon: "🍽️",
      name: "Comida",
      budget: 0,
      spent: 0,
    },
    {
      id: makeId("cat"),
      icon: "🚌",
      name: "Transporte local",
      budget: 0,
      spent: 0,
    },
    {
      id: makeId("cat"),
      icon: "🎡",
      name: "Actividades",
      budget: 0,
      spent: 0,
    },
    {
      id: makeId("cat"),
      icon: "🛍️",
      name: "Compras",
      budget: 0,
      spent: 0,
    },
  ];
}

/* =========================================================
  LECTURA / SUSCRIPCIÓN
========================================================= */

export function subscribeToAccessibleTrips({
  email,
  onChange,
  onError,
} = {}) {
  const emailLower = normalizeEmail(email);

  if (!emailLower) {
    const error = normalizeTripError({
      code: "unauthenticated",
      message: "No se puede consultar viajes sin correo autenticado.",
    });

    onError?.(error);

    return () => {};
  }

  /*
    Esta consulta DEBE coincidir con las reglas:

    allow list: if userEmail() in resource.data.accessEmails;

    Por eso usamos array-contains con el correo normalizado.
    Si esto se cambia, Firestore volverá a ponerse dramático.
  */
  const tripsQuery = query(
    tripsCollectionRef(),
    where("accessEmails", "array-contains", emailLower)
  );

  return onSnapshot(
    tripsQuery,
    (snapshot) => {
      const trips = snapshot.docs
        .map((documentSnapshot) => normalizeTripDocument(documentSnapshot))
        .sort(sortTrips);

      onChange?.(trips);
    },
    (error) => {
      const normalizedError = normalizeTripError(error);

      console.error("[Brújula] Error leyendo viajes:", normalizedError);

      onError?.(normalizedError);
    }
  );
}

export async function getTripById(tripId) {
  try {
    const snapshot = await getDoc(tripDocRef(tripId));

    if (!snapshot.exists()) {
      return {
        ok: false,
        error: normalizeTripError({
          code: "not-found",
          message: "No se encontró el viaje.",
        }),
      };
    }

    return {
      ok: true,
      trip: normalizeTripDocument(snapshot),
    };
  } catch (error) {
    return {
      ok: false,
      error: normalizeTripError(error),
    };
  }
}

export function normalizeTripDocument(documentSnapshot) {
  const data = documentSnapshot.data() || {};

  return normalizeTrip({
    id: documentSnapshot.id,
    ...data,
  });
}

export function normalizeTrip(trip = {}) {
  const ownerEmail = normalizeEmail(trip.ownerEmail);
  const accessModel = normalizeAccessModel({
    ownerEmail,
    accessEmails: trip.accessEmails || [],
    rolesByEmail: trip.rolesByEmail || {},
  });

  return {
    id: String(trip.id || ""),

    title: cleanText(trip.title, DEFAULT_UNKNOWN_TITLE).slice(0, 120),
    destino: cleanText(trip.destino).slice(0, 160),
    fechaSalida: cleanDate(trip.fechaSalida),
    fechaRegreso: cleanDate(trip.fechaRegreso),
    viajeros: clampNumber(trip.viajeros, 1, 99, 2),
    tipo: cleanText(trip.tipo).slice(0, 120),
    estado: normalizeStatus(trip.estado),
    notas: cleanText(trip.notas).slice(0, 8000),
    currency: normalizeCurrency(trip.currency),

    ownerUid: cleanText(trip.ownerUid).slice(0, 128),
    ownerEmail,

    accessEmails: accessModel.accessEmails,
    rolesByEmail: accessModel.rolesByEmail,

    budgetCats: normalizeBudgetCats(trip.budgetCats),
    activities: normalizeActivities(trip.activities),
    packItems: normalizePackItems(trip.packItems),

    createdAt: trip.createdAt || null,
    updatedAt: trip.updatedAt || null,
  };
}

/* =========================================================
  CREAR / ACTUALIZAR / ELIMINAR
========================================================= */

export async function createTrip(user, overrides = {}) {
  try {
    const tripData = createFreshTrip(user, overrides);

    const docRef = await addDoc(
      tripsCollectionRef(),
      tripData
    );

    const localNow = new Date();

    return {
      ok: true,
      tripId: docRef.id,
      trip: normalizeTrip({
        ...tripData,
        id: docRef.id,
        createdAt: localNow,
        updatedAt: localNow,
      }),
    };
  } catch (error) {
    const normalizedError = normalizeTripError(error);

    console.error("[Brújula] Error creando viaje:", normalizedError);

    return {
      ok: false,
      error: normalizedError,
    };
  }
}

export async function updateTrip(tripId, patch = {}) {
  try {
    assertTripId(tripId);

    const safePatch = sanitizeTripPatch(patch);

    if (!Object.keys(safePatch).length) {
      return {
        ok: true,
        skipped: true,
      };
    }

    await updateDoc(
      tripDocRef(tripId),
      {
        ...safePatch,
        updatedAt: serverTimestamp(),
      }
    );

    return {
      ok: true,
    };
  } catch (error) {
    const normalizedError = normalizeTripError(error);

    console.error("[Brújula] Error actualizando viaje:", {
      tripId,
      patch,
      error: normalizedError,
    });

    return {
      ok: false,
      error: normalizedError,
    };
  }
}

export async function deleteTrip(tripId) {
  try {
    assertTripId(tripId);

    await deleteDoc(tripDocRef(tripId));

    return {
      ok: true,
    };
  } catch (error) {
    const normalizedError = normalizeTripError(error);

    console.error("[Brújula] Error eliminando viaje:", normalizedError);

    return {
      ok: false,
      error: normalizedError,
    };
  }
}

export async function duplicateTrip({
  trip,
  user,
  titleSuffix = "copia",
} = {}) {
  try {
    assertTrip(trip);

    const email = normalizeEmail(user?.email || user?.emailLower);

    if (!user?.uid || !email) {
      throw new Error("No se puede duplicar sin usuario autenticado.");
    }

    const copy = structuredCloneSafe(normalizeTrip(trip));

    delete copy.id;
    delete copy.createdAt;
    delete copy.updatedAt;

    copy.title = `${copy.title || "Viaje"} (${titleSuffix})`;
    copy.ownerUid = user.uid;
    copy.ownerEmail = email;
    copy.accessEmails = [email];
    copy.rolesByEmail = {
      [email]: TRIP_ROLES.owner,
    };
    copy.createdAt = serverTimestamp();
    copy.updatedAt = serverTimestamp();

    const safeCopy = sanitizeTripForCreate(copy);

    const docRef = await addDoc(
      tripsCollectionRef(),
      safeCopy
    );

    const localNow = new Date();

    return {
      ok: true,
      tripId: docRef.id,
      trip: normalizeTrip({
        ...safeCopy,
        id: docRef.id,
        createdAt: localNow,
        updatedAt: localNow,
      }),
    };
  } catch (error) {
    const normalizedError = normalizeTripError(error);

    console.error("[Brújula] Error duplicando viaje:", normalizedError);

    return {
      ok: false,
      error: normalizedError,
    };
  }
}

/* =========================================================
  ROLES / PERMISOS
========================================================= */

export function getTripRole(trip, user) {
  if (!trip || !user) return TRIP_ROLES.viewer;

  const email = normalizeEmail(user.email || user.emailLower);
  const ownerEmail = normalizeEmail(trip.ownerEmail);

  if (trip.ownerUid && user.uid && trip.ownerUid === user.uid) {
    return TRIP_ROLES.owner;
  }

  if (email && ownerEmail && ownerEmail === email) {
    return TRIP_ROLES.owner;
  }

  const rolesByEmail = isPlainObject(trip.rolesByEmail)
    ? trip.rolesByEmail
    : {};

  return normalizeRole(rolesByEmail[email]);
}

export function isTripOwner(trip, user) {
  return getTripRole(trip, user) === TRIP_ROLES.owner;
}

export function canEditTrip(trip, user) {
  const role = getTripRole(trip, user);

  return role === TRIP_ROLES.owner || role === TRIP_ROLES.editor;
}

export function canShareTrip(trip, user) {
  return isTripOwner(trip, user);
}

export function canDeleteTrip(trip, user) {
  return isTripOwner(trip, user);
}

export function hasTripAccess(trip, user) {
  const email = normalizeEmail(user?.email || user?.emailLower);

  if (!email || !trip) return false;

  if (getTripRole(trip, user) === TRIP_ROLES.owner) {
    return true;
  }

  return uniqueEmails(trip.accessEmails || []).includes(email);
}

/* =========================================================
  HELPERS PARA COMPARTIR
========================================================= */

export function buildSharePatch(trip, email, role = TRIP_ROLES.viewer) {
  const normalizedTrip = normalizeTrip(trip);
  const emailLower = normalizeEmail(email);

  if (!emailLower || !isValidEmail(emailLower)) {
    throw new Error("Correo inválido para compartir.");
  }

  const accessEmails = uniqueEmails([
    ...normalizedTrip.accessEmails,
    emailLower,
  ]);

  const rolesByEmail = {
    ...normalizedTrip.rolesByEmail,
    [emailLower]: normalizeShareRole(role),
  };

  rolesByEmail[normalizedTrip.ownerEmail] = TRIP_ROLES.owner;

  const accessModel = normalizeAccessModel({
    ownerEmail: normalizedTrip.ownerEmail,
    accessEmails,
    rolesByEmail,
  });

  return {
    accessEmails: accessModel.accessEmails,
    rolesByEmail: accessModel.rolesByEmail,
  };
}

export function buildRemoveAccessPatch(trip, email) {
  const normalizedTrip = normalizeTrip(trip);
  const emailLower = normalizeEmail(email);

  if (!emailLower || !isValidEmail(emailLower)) {
    throw new Error("Correo inválido para quitar acceso.");
  }

  if (emailLower === normalizedTrip.ownerEmail) {
    throw new Error("No puedes quitar al dueño del viaje.");
  }

  const accessEmails = normalizedTrip.accessEmails.filter(
    (item) => item !== emailLower
  );

  const rolesByEmail = {
    ...normalizedTrip.rolesByEmail,
  };

  delete rolesByEmail[emailLower];

  const accessModel = normalizeAccessModel({
    ownerEmail: normalizedTrip.ownerEmail,
    accessEmails,
    rolesByEmail,
  });

  return {
    accessEmails: accessModel.accessEmails,
    rolesByEmail: accessModel.rolesByEmail,
  };
}

export async function shareTripWithEmail({
  tripId,
  trip,
  email,
  role = TRIP_ROLES.viewer,
} = {}) {
  try {
    assertTripId(tripId);
    assertTrip(trip);

    const patch = buildSharePatch(trip, email, role);

    return await updateTrip(tripId, patch);
  } catch (error) {
    return {
      ok: false,
      error: normalizeTripError(error),
    };
  }
}

export async function removeTripAccess({
  tripId,
  trip,
  email,
} = {}) {
  try {
    assertTripId(tripId);
    assertTrip(trip);

    const patch = buildRemoveAccessPatch(trip, email);

    return await updateTrip(tripId, patch);
  } catch (error) {
    return {
      ok: false,
      error: normalizeTripError(error),
    };
  }
}

/* =========================================================
  HELPERS DE DATOS
========================================================= */

export function createBudgetCategory({
  icon = "📦",
  name,
  budget = 0,
  spent = 0,
} = {}) {
  if (!name?.trim()) {
    throw new Error("La categoría necesita nombre.");
  }

  return {
    id: makeId("cat"),
    icon: cleanText(icon, "📦").slice(0, 8),
    name: name.trim().slice(0, 80),
    budget: Math.max(0, toNumber(budget)),
    spent: Math.max(0, toNumber(spent)),
  };
}

export function createActivity({
  name,
  date = "",
  time = "",
  cat = "⚙️ Otro",
  cost = 0,
} = {}) {
  if (!name?.trim()) {
    throw new Error("La actividad necesita nombre.");
  }

  return {
    id: makeId("act"),
    name: name.trim().slice(0, 120),
    date: cleanDate(date),
    time: cleanText(time).slice(0, 8),
    cat: cleanText(cat, "⚙️ Otro").slice(0, 80),
    cost: Math.max(0, toNumber(cost)),
    done: false,
  };
}

export function createPackItem({
  name,
  cat = "📦 Otros",
  packed = false,
  returned = false,
} = {}) {
  if (!name?.trim()) {
    throw new Error("El artículo necesita nombre.");
  }

  return {
    id: makeId("pack"),
    name: name.trim().slice(0, 120),
    cat: cleanText(cat, "📦 Otros").slice(0, 80),
    packed: Boolean(packed),
    returned: Boolean(returned),
  };
}

export function getBudgetTotals(trip) {
  const budgetCats = Array.isArray(trip?.budgetCats)
    ? trip.budgetCats
    : [];

  return budgetCats.reduce(
    (acc, cat) => {
      acc.budget += Math.max(0, toNumber(cat.budget));
      acc.spent += Math.max(0, toNumber(cat.spent));
      return acc;
    },
    {
      budget: 0,
      spent: 0,
    }
  );
}

export function getActivityTotals(trip) {
  const activities = Array.isArray(trip?.activities)
    ? trip.activities
    : [];

  return activities.reduce(
    (acc, activity) => {
      acc.total += 1;
      acc.done += activity.done ? 1 : 0;
      acc.cost += Math.max(0, toNumber(activity.cost));
      return acc;
    },
    {
      total: 0,
      done: 0,
      cost: 0,
    }
  );
}

export function getPackingTotals(trip) {
  const packItems = Array.isArray(trip?.packItems)
    ? trip.packItems
    : [];

  return packItems.reduce(
    (acc, item) => {
      acc.total += 1;
      acc.packed += item.packed ? 1 : 0;
      acc.returned += item.returned ? 1 : 0;
      acc.missing += item.packed && !item.returned ? 1 : 0;
      return acc;
    },
    {
      total: 0,
      packed: 0,
      returned: 0,
      missing: 0,
    }
  );
}

/* =========================================================
  SANITIZACIÓN
========================================================= */

function sanitizeTripPatch(patch = {}) {
  const rawPatch = filterAllowedTripFields(patch);
  const safe = { ...rawPatch };

  delete safe.id;
  delete safe.createdAt;
  delete safe.updatedAt;

  /*
    Estos campos no se editan con updates normales.
    Firestore Rules también los bloquea.
  */
  delete safe.ownerUid;
  delete safe.ownerEmail;

  if ("title" in safe) {
    safe.title = cleanText(safe.title, DEFAULT_TRIP_TITLE).slice(0, 120);
  }

  if ("destino" in safe) {
    safe.destino = cleanText(safe.destino).slice(0, 160);
  }

  if ("fechaSalida" in safe) {
    safe.fechaSalida = cleanDate(safe.fechaSalida);
  }

  if ("fechaRegreso" in safe) {
    safe.fechaRegreso = cleanDate(safe.fechaRegreso);
  }

  if ("viajeros" in safe) {
    safe.viajeros = clampNumber(safe.viajeros, 1, 99, 1);
  }

  if ("tipo" in safe) {
    safe.tipo = cleanText(safe.tipo).slice(0, 120);
  }

  if ("estado" in safe) {
    safe.estado = normalizeStatus(safe.estado);
  }

  if ("notas" in safe) {
    safe.notas = cleanText(safe.notas).slice(0, 8000);
  }

  if ("currency" in safe) {
    safe.currency = normalizeCurrency(safe.currency);
  }

  if ("accessEmails" in safe) {
    safe.accessEmails = uniqueEmails(safe.accessEmails).slice(0, MAX_ACCESS_EMAILS);
  }

  if ("rolesByEmail" in safe) {
    safe.rolesByEmail = normalizeRolesByEmail(safe.rolesByEmail);
  }

  /*
    Si el patch trae accessEmails y rolesByEmail juntos,
    dejamos ambos perfectamente sincronizados para que las rules
    no bloqueen por diferencia de llaves.
  */
  if ("accessEmails" in safe && "rolesByEmail" in safe) {
    const ownerEmail = findOwnerEmailFromRoles(safe.rolesByEmail)
      || safe.accessEmails[0]
      || "";

    const accessModel = normalizeAccessModel({
      ownerEmail,
      accessEmails: safe.accessEmails,
      rolesByEmail: safe.rolesByEmail,
    });

    safe.accessEmails = accessModel.accessEmails;
    safe.rolesByEmail = accessModel.rolesByEmail;
  }

  if ("budgetCats" in safe) {
    safe.budgetCats = normalizeBudgetCats(safe.budgetCats);
  }

  if ("activities" in safe) {
    safe.activities = normalizeActivities(safe.activities);
  }

  if ("packItems" in safe) {
    safe.packItems = normalizePackItems(safe.packItems);
  }

  return safe;
}

function sanitizeTripForCreate(trip = {}) {
  const safe = filterAllowedTripFields(trip);

  safe.title = cleanText(safe.title, DEFAULT_TRIP_TITLE).slice(0, 120);
  safe.destino = cleanText(safe.destino).slice(0, 160);
  safe.fechaSalida = cleanDate(safe.fechaSalida);
  safe.fechaRegreso = cleanDate(safe.fechaRegreso);
  safe.viajeros = clampNumber(safe.viajeros, 1, 99, 2);
  safe.tipo = cleanText(safe.tipo).slice(0, 120);
  safe.estado = normalizeStatus(safe.estado);
  safe.notas = cleanText(safe.notas).slice(0, 8000);
  safe.currency = normalizeCurrency(safe.currency);

  safe.ownerUid = cleanText(safe.ownerUid).slice(0, 128);
  safe.ownerEmail = normalizeEmail(safe.ownerEmail);

  if (!safe.ownerUid || !safe.ownerEmail) {
    throw new Error("El viaje necesita ownerUid y ownerEmail.");
  }

  const accessModel = normalizeAccessModel({
    ownerEmail: safe.ownerEmail,
    accessEmails: safe.accessEmails || [],
    rolesByEmail: safe.rolesByEmail || {},
  });

  safe.accessEmails = accessModel.accessEmails;
  safe.rolesByEmail = accessModel.rolesByEmail;

  safe.budgetCats = normalizeBudgetCats(safe.budgetCats || []);
  safe.activities = normalizeActivities(safe.activities || []);
  safe.packItems = normalizePackItems(safe.packItems || []);

  safe.createdAt = safe.createdAt || serverTimestamp();
  safe.updatedAt = safe.updatedAt || serverTimestamp();

  return safe;
}

function filterAllowedTripFields(source = {}) {
  const safe = {};

  TRIP_ALLOWED_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      safe[field] = source[field];
    }
  });

  return safe;
}

/* =========================================================
  NORMALIZACIÓN DE SUBCOLECCIONES EMBEBIDAS
========================================================= */

function normalizeBudgetCats(items = []) {
  if (!Array.isArray(items)) return [];

  return items
    .slice(0, MAX_BUDGET_CATS)
    .map((item) => ({
      id: cleanText(item?.id, makeId("cat")).slice(0, 80),
      icon: cleanText(item?.icon, "📦").slice(0, 8),
      name: cleanText(item?.name, "Categoría").slice(0, 80),
      budget: Math.max(0, toNumber(item?.budget)),
      spent: Math.max(0, toNumber(item?.spent)),
    }))
    .filter((item) => item.name);
}

function normalizeActivities(items = []) {
  if (!Array.isArray(items)) return [];

  return items
    .slice(0, MAX_ACTIVITIES)
    .map((item) => ({
      id: cleanText(item?.id, makeId("act")).slice(0, 80),
      name: cleanText(item?.name, "Actividad").slice(0, 120),
      date: cleanDate(item?.date),
      time: cleanText(item?.time).slice(0, 8),
      cat: cleanText(item?.cat, "⚙️ Otro").slice(0, 80),
      cost: Math.max(0, toNumber(item?.cost)),
      done: Boolean(item?.done),
    }))
    .filter((item) => item.name);
}

function normalizePackItems(items = []) {
  if (!Array.isArray(items)) return [];

  return items
    .slice(0, MAX_PACK_ITEMS)
    .map((item) => ({
      id: cleanText(item?.id, makeId("pack")).slice(0, 80),
      name: cleanText(item?.name, "Artículo").slice(0, 120),
      cat: cleanText(item?.cat, "📦 Otros").slice(0, 80),
      packed: Boolean(item?.packed),
      returned: Boolean(item?.returned),
    }))
    .filter((item) => item.name);
}

/* =========================================================
  NORMALIZACIÓN DE ACCESOS
========================================================= */

function normalizeAccessModel({
  ownerEmail = "",
  accessEmails = [],
  rolesByEmail = {},
} = {}) {
  const ownerEmailLower = normalizeEmail(ownerEmail);
  const roleEntries = isPlainObject(rolesByEmail)
    ? Object.entries(rolesByEmail)
    : [];

  const emailsFromRoles = roleEntries.map(([email]) => email);

  let emails = uniqueEmails([
    ownerEmailLower,
    ...accessEmails,
    ...emailsFromRoles,
  ]);

  if (ownerEmailLower) {
    emails = [
      ownerEmailLower,
      ...emails.filter((email) => email !== ownerEmailLower),
    ];
  }

  emails = emails
    .filter(isValidEmail)
    .slice(0, MAX_ACCESS_EMAILS);

  const normalizedRoles = normalizeRolesByEmail(rolesByEmail);
  const finalRoles = {};

  emails.forEach((email) => {
    finalRoles[email] = normalizeRole(normalizedRoles[email]);
  });

  if (ownerEmailLower && emails.includes(ownerEmailLower)) {
    finalRoles[ownerEmailLower] = TRIP_ROLES.owner;
  }

  return {
    accessEmails: emails,
    rolesByEmail: finalRoles,
  };
}

function normalizeRolesByEmail(rolesByEmail = {}, ownerEmail = "") {
  const normalized = {};

  if (!isPlainObject(rolesByEmail)) {
    return normalized;
  }

  Object.entries(rolesByEmail).forEach(([email, role]) => {
    const emailLower = normalizeEmail(email);

    if (!emailLower || !isValidEmail(emailLower)) return;

    normalized[emailLower] = normalizeRole(role);
  });

  const ownerEmailLower = normalizeEmail(ownerEmail);

  if (ownerEmailLower && isValidEmail(ownerEmailLower)) {
    normalized[ownerEmailLower] = TRIP_ROLES.owner;
  }

  return normalized;
}

function normalizeRole(role) {
  if (role === TRIP_ROLES.owner) return TRIP_ROLES.owner;
  if (role === TRIP_ROLES.editor) return TRIP_ROLES.editor;
  return TRIP_ROLES.viewer;
}

function normalizeShareRole(role) {
  if (role === TRIP_ROLES.editor) return TRIP_ROLES.editor;
  if (role === TRIP_ROLES.owner) return TRIP_ROLES.editor;

  return TRIP_ROLES.viewer;
}

function findOwnerEmailFromRoles(rolesByEmail = {}) {
  if (!isPlainObject(rolesByEmail)) return "";

  const entry = Object.entries(rolesByEmail).find(
    ([email, role]) => isValidEmail(email) && role === TRIP_ROLES.owner
  );

  return entry ? normalizeEmail(entry[0]) : "";
}

/* =========================================================
  NORMALIZACIÓN GENERAL
========================================================= */

function normalizeStatus(status) {
  const allowedStatuses = new Set(Object.values(TRIP_STATUS));

  return allowedStatuses.has(status)
    ? status
    : TRIP_STATUS.planning;
}

function normalizeCurrency(currency) {
  const value = cleanText(currency, DEFAULT_CURRENCY).slice(0, 16);

  const allowedCurrencies = new Set([
    "COP $",
    "USD $",
    "EUR €",
    "MXN $",
    "ARS $",
    "BRL R$",
  ]);

  if (allowedCurrencies.has(value)) {
    return value;
  }

  if (/^EUR .{1,3}$/.test(value)) {
    return value;
  }

  return DEFAULT_CURRENCY;
}

/* =========================================================
  VALIDACIONES
========================================================= */

function assertTripId(tripId) {
  if (!tripId || typeof tripId !== "string") {
    throw new Error("ID de viaje inválido.");
  }
}

function assertTrip(trip) {
  if (!trip?.id) {
    throw new Error("Viaje inválido.");
  }
}

function isValidEmail(email) {
  const value = normalizeEmail(email);

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/* =========================================================
  ORDENAMIENTO
========================================================= */

export function sortTrips(a, b) {
  if (a.estado === TRIP_STATUS.living && b.estado !== TRIP_STATUS.living) {
    return -1;
  }

  if (b.estado === TRIP_STATUS.living && a.estado !== TRIP_STATUS.living) {
    return 1;
  }

  if (a.estado === TRIP_STATUS.completed && b.estado !== TRIP_STATUS.completed) {
    return 1;
  }

  if (b.estado === TRIP_STATUS.completed && a.estado !== TRIP_STATUS.completed) {
    return -1;
  }

  const aDate = a.fechaSalida || "9999-12-31";
  const bDate = b.fechaSalida || "9999-12-31";

  const dateCompare = aDate.localeCompare(bDate);

  if (dateCompare !== 0) return dateCompare;

  return timestampToMillis(b.updatedAt) - timestampToMillis(a.updatedAt);
}

/* =========================================================
  UTILIDADES GENERALES
========================================================= */

function uniqueEmails(emails = []) {
  if (!Array.isArray(emails)) return [];

  return Array.from(
    new Set(
      emails
        .map(normalizeEmail)
        .filter(Boolean)
        .filter(isValidEmail)
    )
  );
}

function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function clampNumber(value, min, max, fallback = min) {
  const number = toNumber(value);

  if (!Number.isFinite(number)) return fallback;

  return Math.min(max, Math.max(min, number));
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

function makeId(prefix = "id") {
  const randomPart = Math.random().toString(36).slice(2, 9);

  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID().slice(0, 8)}`;
  }

  return `${prefix}_${Date.now()}_${randomPart}`;
}

function structuredCloneSafe(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function timestampToMillis(value) {
  if (!value) return 0;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function isPlainObject(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value);
}

/* =========================================================
  ERRORES
========================================================= */

export function normalizeTripError(error) {
  const code = error?.code || "trips/unknown";
  const message = error?.message || "Error desconocido en viajes.";

  const friendlyMessages = {
    "permission-denied":
      "No tienes permisos para hacer eso. Revisa que las reglas de Firestore estén publicadas y que el viaje tenga tu correo en accessEmails.",
    "unavailable":
      "Firestore no está disponible en este momento. Internet decidió hacer teatro.",
    "not-found":
      "No se encontró el viaje.",
    "invalid-argument":
      "Hay un dato inválido en la operación.",
    "failed-precondition":
      "Firestore necesita una condición previa o un índice para completar esta operación.",
    "resource-exhausted":
      "Se superó algún límite de Firestore.",
    "cancelled":
      "La operación fue cancelada antes de terminar.",
    "unauthenticated":
      "Debes iniciar sesión para hacer esta operación.",
    "already-exists":
      "Ese recurso ya existe.",
    "deadline-exceeded":
      "La operación tardó demasiado.",
    "trips/unknown":
      message,
  };

  return {
    code,
    message,
    friendlyMessage: friendlyMessages[code] || message,
    raw: error,
  };
}