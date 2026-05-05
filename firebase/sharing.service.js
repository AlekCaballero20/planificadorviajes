/* =========================================================
  sharing.service.js
  Servicio de acceso compartido para Brújula
  Maneja correos, roles y permisos por viaje
========================================================= */

import {
  updateTrip,
  getTripRole,
  canShareTrip,
  TRIP_ROLES,
} from "./trips.service.js";

import {
  normalizeEmail,
} from "./auth.service.js";

/* =========================================================
  CONSTANTES
========================================================= */

export const SHARE_ROLES = {
  owner: TRIP_ROLES.owner,
  editor: TRIP_ROLES.editor,
  viewer: TRIP_ROLES.viewer,
};

export const SHARE_ROLE_LABELS = {
  [SHARE_ROLES.owner]: "Owner",
  [SHARE_ROLES.editor]: "Editor",
  [SHARE_ROLES.viewer]: "Viewer",
};

export const SHARE_ROLE_DESCRIPTIONS = {
  [SHARE_ROLES.owner]: "Puede editar, compartir y eliminar el viaje.",
  [SHARE_ROLES.editor]: "Puede ver y editar el viaje, pero no compartirlo ni eliminarlo.",
  [SHARE_ROLES.viewer]: "Puede ver el viaje, pero no editarlo.",
};

/* =========================================================
  API PRINCIPAL
========================================================= */

export async function shareTripWithEmail({
  trip,
  currentUser,
  email,
  role = SHARE_ROLES.viewer,
} = {}) {
  try {
    assertTrip(trip);
    assertUser(currentUser);
    assertCanShare(trip, currentUser);

    const targetEmail = normalizeEmail(email);
    const safeRole = normalizeShareRole(role);

    if (!isValidEmail(targetEmail)) {
      throw new Error("Correo inválido.");
    }

    if (targetEmail === normalizeEmail(currentUser.email || currentUser.emailLower)) {
      throw new Error("No necesitas compartirte el viaje a ti mismo. Qué detalle tan innecesario.");
    }

    if (targetEmail === normalizeEmail(trip.ownerEmail)) {
      throw new Error("Ese correo ya es owner del viaje.");
    }

    const nextAccessState = addOrUpdateSharedUser({
      trip,
      email: targetEmail,
      role: safeRole,
    });

    const result = await updateTrip(trip.id, nextAccessState);

    if (!result.ok) {
      throw result.error?.raw || new Error(result.error?.friendlyMessage || "No se pudo compartir el viaje.");
    }

    return {
      ok: true,
      email: targetEmail,
      role: safeRole,
      accessEmails: nextAccessState.accessEmails,
      rolesByEmail: nextAccessState.rolesByEmail,
    };
  } catch (error) {
    return {
      ok: false,
      error: normalizeSharingError(error),
    };
  }
}

export async function updateSharedUserRole({
  trip,
  currentUser,
  email,
  role,
} = {}) {
  try {
    assertTrip(trip);
    assertUser(currentUser);
    assertCanShare(trip, currentUser);

    const targetEmail = normalizeEmail(email);
    const safeRole = normalizeShareRole(role);

    if (!isValidEmail(targetEmail)) {
      throw new Error("Correo inválido.");
    }

    assertNotOwnerEmail(trip, targetEmail);

    if (!hasSharedAccess(trip, targetEmail)) {
      throw new Error("Ese correo no tiene acceso a este viaje.");
    }

    const accessState = buildNormalizedAccessState(trip);

    accessState.rolesByEmail[targetEmail] = safeRole;

    const result = await updateTrip(trip.id, {
      accessEmails: accessState.accessEmails,
      rolesByEmail: accessState.rolesByEmail,
    });

    if (!result.ok) {
      throw result.error?.raw || new Error(result.error?.friendlyMessage || "No se pudo actualizar el rol.");
    }

    return {
      ok: true,
      email: targetEmail,
      role: safeRole,
      accessEmails: accessState.accessEmails,
      rolesByEmail: accessState.rolesByEmail,
    };
  } catch (error) {
    return {
      ok: false,
      error: normalizeSharingError(error),
    };
  }
}

export async function removeSharedEmail({
  trip,
  currentUser,
  email,
} = {}) {
  try {
    assertTrip(trip);
    assertUser(currentUser);
    assertCanShare(trip, currentUser);

    const targetEmail = normalizeEmail(email);

    if (!isValidEmail(targetEmail)) {
      throw new Error("Correo inválido.");
    }

    assertNotOwnerEmail(trip, targetEmail);

    if (!hasSharedAccess(trip, targetEmail)) {
      throw new Error("Ese correo no tiene acceso a este viaje.");
    }

    const accessState = buildNormalizedAccessState(trip);

    const accessEmails = accessState.accessEmails.filter(
      (item) => item !== targetEmail
    );

    const rolesByEmail = {
      ...accessState.rolesByEmail,
    };

    delete rolesByEmail[targetEmail];

    const result = await updateTrip(trip.id, {
      accessEmails,
      rolesByEmail,
    });

    if (!result.ok) {
      throw result.error?.raw || new Error(result.error?.friendlyMessage || "No se pudo quitar el acceso.");
    }

    return {
      ok: true,
      email: targetEmail,
      accessEmails,
      rolesByEmail,
    };
  } catch (error) {
    return {
      ok: false,
      error: normalizeSharingError(error),
    };
  }
}

export async function leaveSharedTrip({
  trip,
  currentUser,
} = {}) {
  try {
    assertTrip(trip);
    assertUser(currentUser);

    const currentEmail = normalizeEmail(currentUser.email || currentUser.emailLower);

    if (!isValidEmail(currentEmail)) {
      throw new Error("El usuario actual no tiene un correo válido.");
    }

    assertNotOwnerEmail(trip, currentEmail);

    if (!hasSharedAccess(trip, currentEmail)) {
      throw new Error("No tienes acceso compartido a este viaje.");
    }

    const accessState = buildNormalizedAccessState(trip);

    const accessEmails = accessState.accessEmails.filter(
      (item) => item !== currentEmail
    );

    const rolesByEmail = {
      ...accessState.rolesByEmail,
    };

    delete rolesByEmail[currentEmail];

    const result = await updateTrip(trip.id, {
      accessEmails,
      rolesByEmail,
    });

    if (!result.ok) {
      throw result.error?.raw || new Error(result.error?.friendlyMessage || "No pudiste salir del viaje.");
    }

    return {
      ok: true,
      email: currentEmail,
      accessEmails,
      rolesByEmail,
    };
  } catch (error) {
    return {
      ok: false,
      error: normalizeSharingError(error),
    };
  }
}

/* =========================================================
  HELPERS PARA UI
========================================================= */

export function getSharedPeople(trip, currentUser = null) {
  if (!trip) return [];

  const accessState = buildNormalizedAccessState(trip);
  const currentEmail = normalizeEmail(currentUser?.email || currentUser?.emailLower);
  const ownerEmail = normalizeEmail(trip.ownerEmail);

  return accessState.accessEmails.map((email) => {
    const role = accessState.rolesByEmail[email] || SHARE_ROLES.viewer;

    return {
      email,
      role,
      roleLabel: SHARE_ROLE_LABELS[role] || SHARE_ROLE_LABELS.viewer,
      description: SHARE_ROLE_DESCRIPTIONS[role] || SHARE_ROLE_DESCRIPTIONS.viewer,
      isOwner: email === ownerEmail || role === SHARE_ROLES.owner,
      isCurrentUser: Boolean(currentEmail && email === currentEmail),
      canChangeRole: Boolean(
        currentUser &&
        canShareTrip(trip, currentUser) &&
        email !== ownerEmail &&
        role !== SHARE_ROLES.owner
      ),
      canRemove: Boolean(
        currentUser &&
        canShareTrip(trip, currentUser) &&
        email !== ownerEmail
      ),
    };
  });
}

export function getCurrentUserSharingSummary(trip, currentUser) {
  const role = getTripRole(trip, currentUser);
  const roleLabel = SHARE_ROLE_LABELS[role] || SHARE_ROLE_LABELS.viewer;

  return {
    role,
    roleLabel,
    canView: hasUserAccess(trip, currentUser),
    canEdit: role === SHARE_ROLES.owner || role === SHARE_ROLES.editor,
    canShare: canShareTrip(trip, currentUser),
    canDelete: role === SHARE_ROLES.owner,
    isOwner: role === SHARE_ROLES.owner,
    isEditor: role === SHARE_ROLES.editor,
    isViewer: role === SHARE_ROLES.viewer,
  };
}

export function hasUserAccess(trip, user) {
  if (!trip || !user) return false;

  const email = normalizeEmail(user.email || user.emailLower);
  const accessEmails = getAccessEmails(trip);

  return Boolean(email && accessEmails.includes(email));
}

export function hasSharedAccess(trip, email) {
  const targetEmail = normalizeEmail(email);
  const accessEmails = getAccessEmails(trip);

  return Boolean(targetEmail && accessEmails.includes(targetEmail));
}

export function getAccessEmails(trip) {
  return buildNormalizedAccessState(trip).accessEmails;
}

export function getRolesByEmail(trip) {
  return buildNormalizedAccessState(trip).rolesByEmail;
}

export function getRoleForEmail(trip, email) {
  const targetEmail = normalizeEmail(email);
  const rolesByEmail = getRolesByEmail(trip);

  return rolesByEmail[targetEmail] || SHARE_ROLES.viewer;
}

export function canCurrentUserManageSharing(trip, currentUser) {
  return canShareTrip(trip, currentUser);
}

export function getShareRoleOptions({
  includeOwner = false,
} = {}) {
  const roles = [
    {
      value: SHARE_ROLES.viewer,
      label: SHARE_ROLE_LABELS[SHARE_ROLES.viewer],
      description: SHARE_ROLE_DESCRIPTIONS[SHARE_ROLES.viewer],
    },
    {
      value: SHARE_ROLES.editor,
      label: SHARE_ROLE_LABELS[SHARE_ROLES.editor],
      description: SHARE_ROLE_DESCRIPTIONS[SHARE_ROLES.editor],
    },
  ];

  if (includeOwner) {
    roles.unshift({
      value: SHARE_ROLES.owner,
      label: SHARE_ROLE_LABELS[SHARE_ROLES.owner],
      description: SHARE_ROLE_DESCRIPTIONS[SHARE_ROLES.owner],
    });
  }

  return roles;
}

/* =========================================================
  HELPERS DE ESTADO DE ACCESO
========================================================= */

export function buildNormalizedAccessState(trip) {
  assertTrip(trip);

  const ownerEmail = normalizeEmail(trip.ownerEmail);

  const accessEmails = uniqueEmails([
    ownerEmail,
    ...(trip.accessEmails || []),
  ]);

  const rolesByEmail = normalizeRolesByEmail(
    {
      ...(trip.rolesByEmail || {}),
    },
    ownerEmail
  );

  accessEmails.forEach((email) => {
    if (!rolesByEmail[email]) {
      rolesByEmail[email] = email === ownerEmail
        ? SHARE_ROLES.owner
        : SHARE_ROLES.viewer;
    }
  });

  Object.keys(rolesByEmail).forEach((email) => {
    if (!accessEmails.includes(email)) {
      delete rolesByEmail[email];
    }
  });

  if (ownerEmail) {
    rolesByEmail[ownerEmail] = SHARE_ROLES.owner;
  }

  return {
    accessEmails,
    rolesByEmail,
  };
}

export function addOrUpdateSharedUser({
  trip,
  email,
  role = SHARE_ROLES.viewer,
} = {}) {
  assertTrip(trip);

  const targetEmail = normalizeEmail(email);
  const safeRole = normalizeShareRole(role);

  if (!isValidEmail(targetEmail)) {
    throw new Error("Correo inválido.");
  }

  assertNotOwnerEmail(trip, targetEmail);

  const accessState = buildNormalizedAccessState(trip);

  const accessEmails = uniqueEmails([
    ...accessState.accessEmails,
    targetEmail,
  ]);

  const rolesByEmail = {
    ...accessState.rolesByEmail,
    [targetEmail]: safeRole,
  };

  return {
    accessEmails,
    rolesByEmail,
  };
}

/* =========================================================
  NORMALIZACIÓN
========================================================= */

export function normalizeShareRole(role) {
  if (role === SHARE_ROLES.owner) {
    return SHARE_ROLES.owner;
  }

  if (role === SHARE_ROLES.editor) {
    return SHARE_ROLES.editor;
  }

  return SHARE_ROLES.viewer;
}

export function normalizeRolesByEmail(rolesByEmail = {}, ownerEmail = "") {
  const normalized = {};
  const ownerEmailLower = normalizeEmail(ownerEmail);

  Object.entries(rolesByEmail).forEach(([email, role]) => {
    const emailLower = normalizeEmail(email);

    if (!emailLower) return;

    normalized[emailLower] = normalizeShareRole(role);
  });

  if (ownerEmailLower) {
    normalized[ownerEmailLower] = SHARE_ROLES.owner;
  }

  return normalized;
}

export function uniqueEmails(emails = []) {
  return Array.from(
    new Set(
      emails
        .map(normalizeEmail)
        .filter(Boolean)
    )
  );
}

/* =========================================================
  VALIDACIONES
========================================================= */

function assertTrip(trip) {
  if (!trip?.id) {
    throw new Error("Viaje inválido.");
  }
}

function assertUser(user) {
  if (!user?.uid) {
    throw new Error("Usuario inválido o no autenticado.");
  }
}

function assertCanShare(trip, user) {
  if (!canShareTrip(trip, user)) {
    throw new Error("Solo el owner puede compartir este viaje.");
  }
}

function assertNotOwnerEmail(trip, email) {
  const targetEmail = normalizeEmail(email);
  const ownerEmail = normalizeEmail(trip.ownerEmail);

  if (targetEmail && ownerEmail && targetEmail === ownerEmail) {
    throw new Error("No se puede modificar el acceso del owner.");
  }
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

/* =========================================================
  ERRORES
========================================================= */

export function normalizeSharingError(error) {
  const code = error?.code || "sharing/unknown";
  const message = error?.message || "Error desconocido al compartir.";

  const friendlyMessages = {
    "permission-denied":
      "No tienes permiso para compartir este viaje. Firestore está haciendo su trabajo, qué sorpresa.",
    "unavailable":
      "Firestore no está disponible. Internet decidió irse de paseo sin avisar.",
    "invalid-argument":
      "Hay un dato inválido en la acción de compartir.",
    "not-found":
      "No se encontró el viaje.",
  };

  return {
    code,
    message,
    friendlyMessage: friendlyMessages[code] || message,
    raw: error,
  };
}