import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, GithubAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";


// 1) Paste your Firebase web config here (Project settings → Your apps → Web app)
const firebaseConfig = {
  apiKey: "AIzaSyBa4_J53ZdOu2l5PXa7wcHO79Z97cPyNcA",
  authDomain: "cprog-logger.firebaseapp.com",
  projectId: "cprog-logger",
  storageBucket: "cprog-logger.firebasestorage.app",
  messagingSenderId: "372704708217",
  appId: "1:372704708217:web:379fd9376132c9f48076a8",
  measurementId: "G-69B2QVMZY9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GithubAuthProvider();

// UI
const loginBtn = document.getElementById("login");
const logoutBtn = document.getElementById("logout");
const statusEl = document.getElementById("status");
const yearEl = document.getElementById("year");
const gridEl = document.getElementById("grid");
const tooltipEl = document.getElementById("tooltip");

let uid = null;

// Data model: one doc per user:
// /users/{uid} -> { heatmap: { "2026-01-01": 2.5, ... } }
let heatmap = {}; // dateStr -> hours

function pad2(n){ return String(n).padStart(2, "0"); }
function isoDate(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }

function colorFor(hours){
  // Customize colors however you want
  if (hours <= 0) return "#ebedf0";
  if (hours < 1) return "#c6e48b";
  if (hours < 3) return "#7bc96f";
  if (hours < 6) return "#239a3b";
  return "#196127";
}

async function loadFromCloud() {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    heatmap = snap.data().heatmap || {};
  } else {
    heatmap = {};
    await setDoc(ref, { heatmap }, { merge: true });
  }
}

async function saveToCloud() {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { heatmap }, { merge: true });
}

function showTooltip(x, y, text){
  tooltipEl.textContent = text;
  tooltipEl.style.left = (x + 10) + "px";
  tooltipEl.style.top = (y + 10) + "px";
  tooltipEl.style.display = "block";
}
function hideTooltip(){ tooltipEl.style.display = "none"; }

function render() {
  const year = Number(yearEl.value);
  gridEl.innerHTML = "";

  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);

  // align like GitHub: columns are weeks, rows are day-of-week (Sun..Sat)
  const leading = start.getDay(); // 0..6
  for (let i = 0; i < leading; i++) {
    const blank = document.createElement("div");
    blank.className = "cell";
    blank.style.visibility = "hidden";
    gridEl.appendChild(blank);
  }

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = isoDate(d);
    const hours = Number(heatmap[dateStr] ?? 0);

    const cell = document.createElement("div");
    cell.className = "cell";
    cell.style.background = colorFor(hours);

    cell.addEventListener("mouseenter", (ev) => {
      showTooltip(ev.clientX, ev.clientY, `${dateStr}: ${hours} hour${hours === 1 ? "" : "s"}`);
    });
    cell.addEventListener("mousemove", (ev) => {
      if (tooltipEl.style.display === "block") {
        tooltipEl.style.left = (ev.clientX + 10) + "px";
        tooltipEl.style.top = (ev.clientY + 10) + "px";
      }
    });
    cell.addEventListener("mouseleave", hideTooltip);

    cell.addEventListener("click", async () => {
      if (!uid) { alert("Login first."); return; }
      const raw = prompt(`Hours for ${dateStr}:`, String(hours));
      if (raw === null) return;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) { alert("value must >-1"); return; }

      if (n === 0) delete heatmap[dateStr];
      else heatmap[dateStr] = n;

      await saveToCloud();
      render();
    });

    gridEl.appendChild(cell);
  }
}

// Auth buttons
loginBtn.onclick = async () => {
  await signInWithPopup(auth, provider); // GitHub login via Firebase :contentReference[oaicite:7]{index=7}
};
logoutBtn.onclick = async () => {
  await signOut(auth);
};

yearEl.addEventListener("change", render);

// When user logs in/out
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    uid = null;
    heatmap = {};
    statusEl.textContent = "not signed in";
    loginBtn.style.display = "";
    logoutBtn.style.display = "none";
    render();
    return;
  }
  uid = user.uid;
  statusEl.textContent = `Signed in${user.displayName ? " as " + user.displayName : ""}.`;
  loginBtn.style.display = "none";
  logoutBtn.style.display = "";

  await loadFromCloud();
  render();
});
