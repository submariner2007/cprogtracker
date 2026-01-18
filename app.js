import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, GithubAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";


// firebase web config (project settings > your app > web app)
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
let heatmapProg = {};  // dateStr -> hours
let heatmapInterview = {}; // dateStr -> hours


function pad2(n){ return String(n).padStart(2, "0"); }
function isoDate(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }

function colorForProg(hours){
  if (hours <= 0) return "#ebedf0";
  if (hours < 1) return "#c6e48b";
  if (hours < 3) return "#7bc96f";
  if (hours < 6) return "#239a3b";
  return "#196127";
}

function colorForInterview(hours){
  if (hours <= 0) return "#ebedf0";
  if (hours < 1) return "#d8b4fe";
  if (hours < 3) return "#a78bfa";
  if (hours < 6) return "#7c3aed";
  return "#5b21b6";
}


async function loadFromCloud() {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data() || {};
    heatmapProg = data.heatmapProg || {};
    heatmapInterview = data.heatmapInterview || {};
  } else {
    heatmapProg = {};
    heatmapOther = {};
    await setDoc(ref, { heatmapProg, heatmapInterview }, { merge: true });
  }
}

async function saveToCloud() {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { heatmapProg, heatmapInterview }, { merge: true });
}


function showTooltip(x, y, text){
  tooltipEl.textContent = text;
  tooltipEl.style.left = (x + 10) + "px";
  tooltipEl.style.top = (y + 10) + "px";
  tooltipEl.style.display = "block";
}
function hideTooltip(){ tooltipEl.style.display = "none"; }

function renderMonths(y, monthsElId) {
  const monthsEl = document.getElementById(monthsElId);
  if (!monthsEl) return;

  monthsEl.innerHTML = "";

  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const startUTC = Date.UTC(y, 0, 1);
  const startDow = new Date(startUTC).getUTCDay();

  const weekIndexUTC = (yy, mm, dd) => {
    const t = Date.UTC(yy, mm, dd);
    const diffDays = Math.floor((t - startUTC) / 86400000);
    return Math.floor((startDow + diffDays) / 7);
  };

  let lastCol = -1;
  for (let m = 0; m < 12; m++) {
    const col = weekIndexUTC(y, m, 1);
    if (col === lastCol) continue;
    lastCol = col;

    const label = document.createElement("div");
    label.textContent = names[m];
    label.style.gridColumnStart = String(col + 1);
    monthsEl.appendChild(label);
  }
}







function renderGrid({ year, gridElId, monthsElId, dataMap, colorFn, label }) {
  renderMonths(year, monthsElId);

  const grid = document.getElementById(gridElId);
  grid.innerHTML = "";

  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const todayStr = isoDate(new Date());

  const leading = start.getDay();
  for (let i = 0; i < leading; i++) {
    const blank = document.createElement("div");
    blank.className = "cell";
    blank.style.visibility = "hidden";
    grid.appendChild(blank);
  }

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = isoDate(d);
    const hours = Number(dataMap[dateStr] ?? 0);

    const cell = document.createElement("div");
    cell.className = "cell";
    cell.style.background = colorFn(hours);
    if (dateStr === todayStr) cell.classList.add("today");

    cell.addEventListener("mouseenter", (ev) => {
      showTooltip(ev.clientX, ev.clientY, `${label} — ${dateStr}: ${hours} hour${hours === 1 ? "" : "s"}`);
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
      const raw = prompt(`${label} hours for ${dateStr}:`, String(hours));
      if (raw === null) return;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) { alert("value must be >= 0"); return; }

      if (n === 0) delete dataMap[dateStr];
      else dataMap[dateStr] = n;

      await saveToCloud();
      render(); // rerender both
    });

    grid.appendChild(cell);
  }
}

function render() {
  const year = Number(yearEl.value);

  renderGrid({
    year,
    gridElId: "grid-prog",
    monthsElId: "months-prog",
    dataMap: heatmapProg,
    colorFn: colorForProg,
    label: "Programming"
  });

  renderGrid({
    year,
    gridElId: "grid-interview",
    monthsElId: "months-interview",
    dataMap: heatmapInterview,
    colorFn: colorForInterview,
    label: "Interview"
  });
}


// Auth buttons
loginBtn.onclick = async () => {
  loginBtn.onclick = async () => {
  await signInWithPopup(auth, provider);
};

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
