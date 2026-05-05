/* =========================================================
  firebase.config.js
  Configuración central de Firebase
  Proyecto: Brújula — Planificador de viajes
========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================================================
  FIREBASE CONFIG
========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyCChwa6Al0AXIobpVHrfOH8DBlH9-mI_2o",
  authDomain: "planificador-de-viajes-fdbfe.firebaseapp.com",
  projectId: "planificador-de-viajes-fdbfe",
  storageBucket: "planificador-de-viajes-fdbfe.firebasestorage.app",
  messagingSenderId: "2785286182",
  appId: "1:2785286182:web:ee35c3d7e580ec627aaee7",
};

/* =========================================================
  FIREBASE INIT
========================================================= */

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account",
});

/* =========================================================
  FIRESTORE OFFLINE CACHE
  Esto ayuda a que la app no se sienta tan inútil si internet
  hace su clásico acto de desaparecer.
========================================================= */

export async function enableFirestorePersistence() {
  return true;
}

/* =========================================================
  COLLECTION NAMES
========================================================= */

export const FIREBASE_COLLECTIONS = {
  users: "users",
  trips: "trips",
};
