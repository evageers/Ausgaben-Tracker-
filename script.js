
const KEY = "ausgabenTrackerV2";

let state = load();
let view = "all"; // all | income | expense

const $ = (id) => document.getElementById(id);

function load() {
try {
const d = JSON.parse(localStorage.getItem(KEY));
if (d && Array.isArray(d.items)) return d;
} catch (e) {}
return { start: 0, items: [] };
}

function save() {
localStorage.setItem(KEY, JSON.stringify(state));
}

function eur(n) {
return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function parseAmount(text) {
let t = String(text).trim().replace(/\s/g, "").replace("€", "");
if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
const n = parseFloat(t);
return isNaN(n) ? NaN : n;
}

function todayISO() {
const d = new Date();
const m = String(d.getMonth() + 1).padStart(2, "0");
const day = String(d.getDate()).padStart(2, "0");
return `${d.getFullYear()}-${m}-${day}`;
}

function formatDate(iso) {
const [y, m, d] = iso.split("-");
return `${d}.${m}.${y}`;
}

function sum(items, type) {
return items.filter((i) => i.type === type).reduce((s, i) => s + i.amount, 0);
}

function sorted() {
return [...state.items].sort((a, b) =>
a.date === b.date ? b.id - a.id : b.date.localeCompare(a.date)
);
}

/* ---------- Anzeige ---------- */

function renderTotals() {
const inc = sum(state.items, "income");
const exp = sum(state.items, "expense");
$("total-income").textContent = eur(inc);
$("total-expense").textContent = eur(exp);
$("balance").textContent = eur(state.start + inc - exp);
}

function renderMonth() {
const month = $("month-picker").value;
const items = state.items.filter((i) => i.date.startsWith(month));
const inc = sum(items, "income");
const exp = sum(items, "expense");
const saldo = inc - exp;
$("month-income").textContent = "+ " + eur(inc);
$("month-expense").textContent = "− " + eur(exp);
const s = $("month-saldo");
s.textContent = (saldo > 0 ? "+ " : saldo < 0 ? "− " : "") + eur(Math.abs(saldo));
s.className = saldo > 0 ? "green" : saldo < 0 ? "red" : "";
}

function renderList() {
const list = $("list");
list.innerHTML = "";
const items = sorted().filter((i) => view === "all" || i.type === view);

$("count").textContent = items.length ? `(${items.length})` : "";
$("list-empty").classList.toggle("hidden", items.length > 0);

items.forEach((i) => {
const li = document.createElement("li");
li.className = i.type;

const info = document.createElement("div");
info.className = "info";
const name = document.createElement("span");
name.className = "name";
name.textContent = i.desc;
const date = document.createElement("span");
date.className = "date";
date.textContent = formatDate(i.date);
info.append(name, date);

const side = document.createElement("div");
side.className = "right-side";
const amt = document.createElement("span");
amt.textContent = (i.type === "income" ? "+ " : "− ") + eur(i.amount);
const del = document.createElement("button");
del.className = "del";
del.textContent = "✕";
del.title = "Löschen";
del.addEventListener("click", () => removeItem(i.id));
side.append(amt, del);

li.append(info, side);
list.appendChild(li);
});
}

/* ---------- Diagramm (ohne externe Bibliothek) ---------- */

const GREEN = "#4a7c1f";
const RED = "#d94b3d";

function niceMax(v) {
if (v <= 0) return 100;
const p = Math.pow(10, Math.floor(Math.log10(v)));
const n = v / p;
const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
return step * p;
}

function drawSmooth(ctx, pts) {
ctx.beginPath();
ctx.moveTo(pts[0].x, pts[0].y);
for (let i = 0; i < pts.length - 1; i++) {
const p0 = pts[i - 1] || pts[i];
const p1 = pts[i];
const p2 = pts[i + 1];
const p3 = pts[i + 2] || p2;
const c1x = p1.x + (p2.x - p0.x) / 6;
const c1y = p1.y + (p2.y - p0.y) / 6;
const c2x = p2.x - (p3.x - p1.x) / 6;
const c2y = p2.y - (p3.y - p1.y) / 6;
const low = Math.max(p1.y, p2.y);
const high = Math.min(p1.y, p2.y);
ctx.bezierCurveTo(
c1x, Math.min(Math.max(c1y, high), low),
c2x, Math.min(Math.max(c2y, high), low),
p2.x, p2.y
);
}
ctx.stroke();
}

function renderChart() {
const items = state.items.filter((i) => view === "all" || i.type === view);
const dates = [...new Set(items.map((i) => i.date))].sort();

$("chart-empty").classList.toggle("hidden", dates.length > 0);
const canvas = $("chart");
canvas.classList.toggle("hidden", dates.length === 0);
if (dates.length === 0) return;

const series = [];
if (view !== "expense") {
series.push({
label: "Einnahmen",
color: GREEN,
data: dates.map((d) => sum(items.filter((i) => i.date === d), "income")),
});
}
if (view !== "income") {
series.push({
label: "Ausgaben",
color: RED,
data: dates.map((d) => sum(items.filter((i) => i.date === d), "expense")),
});
}

const dpr = window.devicePixelRatio || 1;
const w = canvas.clientWidth;
const h = canvas.clientHeight;
canvas.width = w * dpr;
canvas.height = h * dpr;
const ctx = canvas.getContext("2d");
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
ctx.clearRect(0, 0, w, h);
ctx.font = "11px Nunito, Segoe UI, Arial, sans-serif";

const maxVal = niceMax(Math.max(...series.flatMap((s) => s.data)));
const left = 52, right = 34, top = 34, bottom = 28;
const pw = w - left - right;
const ph = h - top - bottom;

// Legende
let lx = w / 2 - 70;
ctx.textBaseline = "middle";
series.forEach((s) => {
ctx.fillStyle = s.color;
ctx.fillRect(lx, 10, 28, 11);
ctx.fillStyle = "#555";
ctx.textAlign = "left";
ctx.fillText(s.label, lx + 34, 16);
lx += 100;
});

// Gitter + y-Achse
const steps = 4;
ctx.textAlign = "right";
ctx.strokeStyle = "#e4e0ea";
ctx.lineWidth = 1;
for (let i = 0; i <= steps; i++) {
const y = top + ph - (ph * i) / steps;
ctx.beginPath();
ctx.moveTo(left, y);
ctx.lineTo(left + pw, y);
ctx.stroke();
ctx.fillStyle = "#666";
ctx.fillText(Math.round((maxVal * i) / steps).toLocaleString("de-DE"), left - 8, y);
}

const xAt = (i) => (dates.length === 1 ? left + pw / 2 : left + (pw * i) / (dates.length - 1));
const yAt = (v) => top + ph - (ph * v) / maxVal;

// x-Achse (Daten)
ctx.textAlign = "center";
ctx.textBaseline = "top";
const maxLabels = Math.max(2, Math.floor(pw / 85));
const every = Math.ceil(dates.length / maxLabels);
dates.forEach((d, i) => {
if (i % every !== 0 && i !== dates.length - 1) return;
const x = xAt(i);
ctx.strokeStyle = "#e4e0ea";
ctx.beginPath();
ctx.moveTo(x, top);
ctx.lineTo(x, top + ph);
ctx.stroke();
ctx.fillStyle = "#666";
ctx.fillText(formatDate(d), x, top + ph + 8);
});

// Linien + Punkte
series.forEach((s) => {
const pts = s.data.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
if (pts.length > 1) {
ctx.strokeStyle = s.color;
ctx.globalAlpha = 0.35;
ctx.lineWidth = 3;
ctx.lineJoin = "round";
drawSmooth(ctx, pts);
ctx.globalAlpha = 1;
}
ctx.fillStyle = s.color;
pts.forEach((p) => {
ctx.beginPath();
ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
ctx.fill();
});
});
}

window.addEventListener("resize", renderChart);

function renderAll() {
renderTotals();
renderMonth();
renderList();
renderChart();
}

/* ---------- Aktionen ---------- */

function removeItem(id) {
state.items = state.items.filter((i) => i.id !== id);
save();
renderAll();
}

$("form").addEventListener("submit", (e) => {
e.preventDefault();
const desc = $("desc").value.trim();
const amount = parseAmount($("amount").value);
const type = $("type").value;
const date = $("date").value || todayISO();

if (!desc || isNaN(amount) || amount <= 0) {
alert("Bitte Beschreibung und einen gültigen Betrag eingeben.");
return;
}

state.items.push({ id: Date.now(), desc, amount, type, date });
save();
$("desc").value = "";
$("amount").value = "";
$("desc").focus();
renderAll();
});

$("start-balance").addEventListener("input", () => {
const n = parseAmount($("start-balance").value);
state.start = isNaN(n) ? 0 : n;
save();
renderTotals();
});

$("month-picker").addEventListener("change", renderMonth);

document.querySelectorAll(".nav-btn").forEach((btn) => {
btn.addEventListener("click", () => {
document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
btn.classList.add("active");
view = btn.dataset.view;
$("title").textContent =
view === "income" ? "Einnahmen" : view === "expense" ? "Ausgaben" : "Alle Buchungen";
renderList();
renderChart();
});
});

/* ---------- Start ---------- */

$("date").value = todayISO();
$("month-picker").value = todayISO().slice(0, 7);
$("start-balance").value = state.start ? String(state.start).replace(".", ",") : "";
renderAll();

