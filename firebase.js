import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
export { collection, addDoc, query, orderBy, limit, getDocs };
