/* firebase.js — Firestore + warstwa danych.
   Kluczowa zasada: JEDEN dokument treningu na dzień, oba telefony piszą do niego. */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, orderBy, limit, onSnapshot, enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBzfXR1rM31pBiy_2fE9fAO0FOa5Sn-fgk",
  authDomain: "gym-progress-app-88615.firebaseapp.com",
  projectId: "gym-progress-app-88615",
  storageBucket: "gym-progress-app-88615.firebasestorage.app",
  messagingSenderId: "249747423041",
  appId: "1:249747423041:web:e133c3871472a77b226bc0",
  measurementId: "G-WP87XMX9CT"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
try { enableIndexedDbPersistence(db).catch(() => {}); } catch (e) {}

const DAYS = 'days';      // trening dnia, id = 2026-08-08
const BODY = 'body';      // masa ciała
const CFG  = 'config';    // ustawienia shake'a

const dayRef = id => doc(db, DAYS, id);

/* trening dnia — merge, żeby dwa telefony się nie nadpisywały */
export async function saveDay(id, patch) {
  await setDoc(dayRef(id), { ...patch, id, updatedAt: Date.now() }, { merge: true });
}
export async function readDay(id) {
  const s = await getDoc(dayRef(id));
  return s.exists() ? s.data() : null;
}
export function watchDay(id, cb) {
  return onSnapshot(dayRef(id), s => { if (s.exists()) cb(s.data()); }, () => {});
}
export async function listDays(n = 200) {
  const q = query(collection(db, DAYS), orderBy('id', 'desc'), limit(n));
  const s = await getDocs(q);
  return s.docs.map(d => d.data());
}

/* masa ciała — id = data, więc jeden wpis na dzień i edycja nadpisuje */
export async function saveWeight(dateId, data) {
  await setDoc(doc(db, BODY, dateId), { ...data, id: dateId }, { merge: true });
}
export async function removeWeight(dateId) { await deleteDoc(doc(db, BODY, dateId)); }
export async function listWeights(n = 400) {
  const q = query(collection(db, BODY), orderBy('id', 'desc'), limit(n));
  const s = await getDocs(q);
  return s.docs.map(d => d.data());
}

export async function saveConfig(obj) { await setDoc(doc(db, CFG, 'martin'), obj, { merge: true }); }
export async function loadConfig() {
  const s = await getDoc(doc(db, CFG, 'martin'));
  return s.exists() ? s.data() : {};
}
