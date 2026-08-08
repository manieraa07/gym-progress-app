// firebase.js — jedno miejsce z konfiguracją i dostępem do Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, getDoc, getDocs, deleteDoc,
  query, orderBy, limit, onSnapshot, serverTimestamp,
  enableIndexedDbPersistence
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

// offline first: telefon w piwnicy siłowni dalej zapisuje
try { enableIndexedDbPersistence(db).catch(()=>{}); } catch(e){}

export {
  collection, doc, addDoc, setDoc, getDoc, getDocs, deleteDoc,
  query, orderBy, limit, onSnapshot, serverTimestamp
};

/* ---------- warstwa danych ---------- */

const LIVE_COL = 'live';        // aktywna sesja, jeden dokument na dzień
const SES_COL  = 'sessions';    // zakończone treningi
const BODY_COL = 'body';        // masa ciała Martina
const SET_COL  = 'settings';    // ustawienia (shake, cel masy)

export const liveRef = (id) => doc(db, LIVE_COL, id);

export async function pushLive(id, data) {
  await setDoc(liveRef(id), { ...data, updatedAt: Date.now() }, { merge: false });
}
export function watchLive(id, cb) {
  return onSnapshot(liveRef(id), s => cb(s.exists() ? s.data() : null), () => {});
}
export async function readLive(id) {
  const s = await getDoc(liveRef(id));
  return s.exists() ? s.data() : null;
}
export async function dropLive(id) { try { await deleteDoc(liveRef(id)); } catch(e){} }

export async function finishSession(session) {
  await addDoc(collection(db, SES_COL), session);
}
export async function fetchSessions(n = 200) {
  const q = query(collection(db, SES_COL), orderBy('startedAt', 'desc'), limit(n));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addBody(entry) { await addDoc(collection(db, BODY_COL), entry); }
export async function fetchBody(n = 120) {
  const q = query(collection(db, BODY_COL), orderBy('ts', 'desc'), limit(n));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveSettings(obj) {
  await setDoc(doc(db, SET_COL, 'martin'), obj, { merge: true });
}
export async function loadSettings() {
  const s = await getDoc(doc(db, SET_COL, 'martin'));
  return s.exists() ? s.data() : {};
}
