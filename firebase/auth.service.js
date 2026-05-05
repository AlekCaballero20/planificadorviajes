/* =========================================================
  auth.service.js
  Servicio de autenticación para Brújula
  Firebase Auth + Google Login + perfil de usuario
========================================================= */

import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  auth,
  db,
  googleProvider,
  FIREBASE_COLLECTIONS,
} from "./firebase.config.js";

/* =========================================================
  CONFIG LOCAL
========================================================= */

const GOOGLE_PROVIDER_ID = "google.com";
const PROFILE_WRITE_COOLDOWN_MS = 1200;

let lastProfileWrite = {
  uid: null,
  at: 0,
};

/* =========================================================
  NORMALIZADORES
========================================================= */

export function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

export function normalizeText(value, fallback = "") {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  return text || fallback;
}

export function normalizePhotoURL(value) {
  const url = String(value || "").trim();

  if (!url) return "";

  return url.slice(0, 1000);
}

export function normalizeProviderId(firebaseUser) {
  if (!firebaseUser) return "";

  const googleProvider = firebaseUser.providerData?.find(
    (provider) => provider?.providerId === GOOGLE_PROVIDER_ID
  );

  if (googleProvider?.providerId) {
    return googleProvider.providerId;
  }

  return firebaseUser.providerData?.[0]?.providerId || "";
}

export function normalizeUser(firebaseUser) {
  if (!firebaseUser) return null;

  const emailLower = normalizeEmail(firebaseUser.email);
  const providerId = normalizeProviderId(firebaseUser);

  return {
    uid: String(firebaseUser.uid || ""),
    email: String(firebaseUser.email || ""),
    emailLower,
    displayName: normalizeText(firebaseUser.displayName, "Usuario"),
    photoURL: normalizePhotoURL(firebaseUser.photoURL),
    providerId,
    emailVerified: Boolean(firebaseUser.emailVerified),
    isAnonymous: Boolean(firebaseUser.isAnonymous),
  };
}

export function isValidEmail(email) {
  const value = normalizeEmail(email);

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/* =========================================================
  LOGIN GOOGLE
========================================================= */

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const firebaseUser = result.user;

    if (!isGoogleUser(firebaseUser)) {
      await signOut(auth);

      throw {
        code: "auth/not-google-user",
        message: "Solo se permite iniciar sesión con Google.",
      };
    }

    const user = await upsertUserProfileSafe(firebaseUser);

    return {
      ok: true,
      user,
      rawUser: firebaseUser,
    };
  } catch (error) {
    return {
      ok: false,
      error: normalizeAuthError(error),
    };
  }
}

/* =========================================================
  LOGOUT
========================================================= */

export async function logOut() {
  try {
    await signOut(auth);

    clearProfileWriteMemory();

    return {
      ok: true,
    };
  } catch (error) {
    return {
      ok: false,
      error: normalizeAuthError(error),
    };
  }
}

/* =========================================================
  AUTH LISTENER
========================================================= */

export function listenToAuthChanges({
  onLogin,
  onLogout,
  onError,
} = {}) {
  return onAuthStateChanged(
    auth,
    async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          clearProfileWriteMemory();
          onLogout?.();
          return;
        }

        if (!isGoogleUser(firebaseUser)) {
          await signOut(auth);

          onError?.(
            normalizeAuthError({
              code: "auth/not-google-user",
              message: "Solo se permite iniciar sesión con Google.",
            })
          );

          return;
        }

        const user = await upsertUserProfileSafe(firebaseUser);

        onLogin?.({
          user,
          rawUser: firebaseUser,
        });
      } catch (error) {
        onError?.(normalizeAuthError(error));
      }
    },
    (error) => {
      onError?.(normalizeAuthError(error));
    }
  );
}

/* =========================================================
  USER PROFILE
========================================================= */

export async function upsertUserProfile(firebaseUser) {
  if (!firebaseUser?.uid) {
    throw new Error("No hay usuario válido para guardar perfil.");
  }

  if (!isGoogleUser(firebaseUser)) {
    throw {
      code: "auth/not-google-user",
      message: "Solo se permite guardar perfil de usuarios Google.",
    };
  }

  const user = normalizeUser(firebaseUser);

  if (!user?.uid) {
    throw new Error("No se pudo normalizar el usuario.");
  }

  if (!isValidEmail(user.emailLower)) {
    throw new Error("El usuario no tiene un correo válido disponible.");
  }

  if (shouldSkipRepeatedProfileWrite(user.uid)) {
    return user;
  }

  const userRef = doc(db, FIREBASE_COLLECTIONS.users, user.uid);
  const userSnapshot = await getDoc(userRef);

  const basePayload = {
    uid: user.uid,
    email: user.email,
    emailLower: user.emailLower,
    displayName: user.displayName,
    photoURL: user.photoURL,
    providerId: user.providerId || GOOGLE_PROVIDER_ID,
    emailVerified: user.emailVerified,
    isAnonymous: user.isAnonymous,
    lastLoginAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const payload = userSnapshot.exists()
    ? basePayload
    : {
        ...basePayload,
        createdAt: serverTimestamp(),
      };

  await setDoc(userRef, payload, { merge: true });

  rememberProfileWrite(user.uid);

  return user;
}

export async function upsertUserProfileSafe(firebaseUser) {
  try {
    return await upsertUserProfile(firebaseUser);
  } catch (error) {
    const normalizedError = normalizeAuthError(error);

    console.warn(
      "[Brújula] No se pudo guardar el perfil, pero la sesión continuará:",
      normalizedError
    );

    return normalizeUser(firebaseUser);
  }
}

function shouldSkipRepeatedProfileWrite(uid) {
  const now = Date.now();

  return Boolean(
    uid &&
    lastProfileWrite.uid === uid &&
    now - lastProfileWrite.at < PROFILE_WRITE_COOLDOWN_MS
  );
}

function rememberProfileWrite(uid) {
  lastProfileWrite = {
    uid,
    at: Date.now(),
  };
}

function clearProfileWriteMemory() {
  lastProfileWrite = {
    uid: null,
    at: 0,
  };
}

/* =========================================================
  CURRENT USER
========================================================= */

export function getCurrentFirebaseUser() {
  return auth.currentUser;
}

export function getCurrentUser() {
  return normalizeUser(auth.currentUser);
}

export function getCurrentUserEmail() {
  return normalizeEmail(auth.currentUser?.email);
}

export function getCurrentUserId() {
  return auth.currentUser?.uid || "";
}

export function isAuthenticated() {
  return Boolean(auth.currentUser);
}

export function isGoogleUser(firebaseUser = auth.currentUser) {
  if (!firebaseUser) return false;

  return firebaseUser.providerData?.some(
    (provider) => provider?.providerId === GOOGLE_PROVIDER_ID
  );
}

/* =========================================================
  HELPERS DE SESIÓN
========================================================= */

export function getAuthDebugInfo() {
  const firebaseUser = auth.currentUser;
  const user = normalizeUser(firebaseUser);

  return {
    isAuthenticated: Boolean(firebaseUser),
    isGoogleUser: isGoogleUser(firebaseUser),
    uid: user?.uid || "",
    email: user?.email || "",
    emailLower: user?.emailLower || "",
    providerId: user?.providerId || "",
    emailVerified: Boolean(user?.emailVerified),
  };
}

/* =========================================================
  ERROR HANDLING
========================================================= */

export function normalizeAuthError(error) {
  const code = error?.code || "auth/unknown";
  const message = error?.message || "Error desconocido de autenticación.";

  const friendlyMessages = {
    "auth/popup-closed-by-user":
      "Cerraste la ventana de Google antes de iniciar sesión.",
    "auth/cancelled-popup-request":
      "Ya había otra ventana de login abierta.",
    "auth/popup-blocked":
      "El navegador bloqueó la ventana de Google. Revisa los permisos del popup.",
    "auth/unauthorized-domain":
      "Este dominio no está autorizado en Firebase Authentication.",
    "auth/network-request-failed":
      "Falló la conexión. Internet decidió tener personalidad propia.",
    "auth/account-exists-with-different-credential":
      "Ese correo ya existe con otro método de inicio de sesión.",
    "auth/user-disabled":
      "Esta cuenta fue deshabilitada.",
    "auth/operation-not-allowed":
      "El proveedor Google no está habilitado en Firebase Authentication.",
    "auth/invalid-credential":
      "La credencial de inicio de sesión no es válida.",
    "auth/credential-already-in-use":
      "Esta credencial ya está vinculada a otra cuenta.",
    "auth/not-google-user":
      "Solo se permite iniciar sesión con una cuenta de Google.",
    "permission-denied":
      "Firebase no permitió guardar o leer el perfil del usuario. Revisa las reglas de Firestore.",
    "firestore/permission-denied":
      "Firebase no permitió guardar o leer el perfil del usuario. Revisa las reglas de Firestore.",
    "unavailable":
      "Firebase no está disponible en este momento.",
    "failed-precondition":
      "Firebase necesita una condición previa para completar esta operación.",
  };

  return {
    code,
    message,
    friendlyMessage: friendlyMessages[code] || message,
    raw: error,
  };
}