// ───────────────────────────────────────────────────────
// ChatGPT Exporter — popup controller
// Wired for the v2 UI: status dot states, animated counter,
// keyboard shortcuts (1/2/3), panel transitions.
// ───────────────────────────────────────────────────────

let busy = false;
let pollHandle = null;

const $ = id => document.getElementById(id);

// ─── Status helpers ────────────────────────────────────
function setStatus(text, state = "ready") {
  const s = $("status");
  const d = $("dot");
  s.textContent = text;
  d.className = "dot " + state;
}

function setCount(n) {
  const el = $("count");
  if (!el) return;
  if (el.textContent !== String(n)) {
    el.textContent = String(n);
    el.classList.remove("bump");
    // restart animation
    // eslint-disable-next-line no-unused-expressions
    el.offsetWidth;
    el.classList.add("bump");
    setTimeout(() => el.classList.remove("bump"), 220);
  }
}

function showMain() {
  $("mainPanel").classList.add("on");
  $("scrollPanel").classList.remove("on");
}
function showScroll() {
  $("mainPanel").classList.remove("on");
  $("scrollPanel").classList.add("on");
}

function setBusy(b) {
  busy = b;
  for (const id of ["api", "visible", "scroll", "stopscroll", "cancelscroll"]) {
    const el = $(id);
    if (el) el.disabled = b;
  }
}

// ─── Messaging ─────────────────────────────────────────
async function send(type, data = {}) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return { ok: false, error: "no active tab" };
    if (!/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(tab.url || "")) {
      return { ok: false, error: "open chatgpt.com first" };
    }
    return await chrome.tabs.sendMessage(tab.id, { type, ...data });
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function stopPolling() {
  if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
}

// ─── Actions ───────────────────────────────────────────
async function doExportApi() {
  if (busy) return;
  setBusy(true);
  setStatus("FETCHING…", "busy");
  const r = await send("EXPORT_API");
  if (r.ok) setStatus(`EXPORTED ${r.count} MSGS`, "ready");
  else      setStatus("ERROR — " + (r.error || "failed").toUpperCase(), "error");
  setBusy(false);
}

async function doExportVisible() {
  if (busy) return;
  setBusy(true);
  setStatus("CAPTURING…", "busy");
  const r = await send("EXPORT_VISIBLE");
  if (r.ok) setStatus(`EXPORTED ${r.count} VISIBLE`, "ready");
  else      setStatus("ERROR — " + (r.error || "failed").toUpperCase(), "error");
  setBusy(false);
}

async function doStartScroll() {
  if (busy) return;
  setBusy(true);
  const r = await send("OBSERVER_START");
  if (!r.ok) {
    setStatus("ERROR — " + (r.error || "failed").toUpperCase(), "error");
    setBusy(false);
    return;
  }
  showScroll();
  setCount(r.total || 0);
  setStatus("LIVE — CAPTURING", "live");
  pollHandle = setInterval(async () => {
    const s = await send("OBSERVER_STATUS");
    if (s.ok) setCount(s.total);
  }, 1200);
  setBusy(false);
}

async function doStopScroll() {
  if (busy) return;
  setBusy(true);
  stopPolling();
  setStatus("SAVING…", "busy");
  const r = await send("OBSERVER_DOWNLOAD");
  if (r.ok) setStatus(`SAVED ${r.count} MSGS`, "ready");
  else      setStatus("ERROR — " + (r.error || "failed").toUpperCase(), "error");
  showMain();
  setBusy(false);
}

async function doCancelScroll() {
  if (busy) return;
  setBusy(true);
  stopPolling();
  await send("OBSERVER_CANCEL");
  setStatus("CANCELLED", "warn");
  showMain();
  setBusy(false);
}

// ─── Bindings ──────────────────────────────────────────
$("api").addEventListener("click", doExportApi);
$("visible").addEventListener("click", doExportVisible);
$("scroll").addEventListener("click", doStartScroll);
$("stopscroll").addEventListener("click", doStopScroll);
$("cancelscroll").addEventListener("click", doCancelScroll);

// Keyboard shortcuts (when popup is focused)
document.addEventListener("keydown", (e) => {
  // Ignore if typing in an input (none here, but defensive)
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  const mainVisible = $("mainPanel").classList.contains("on");
  if (mainVisible) {
    if (e.key === "1") { e.preventDefault(); doExportApi(); }
    if (e.key === "2") { e.preventDefault(); doExportVisible(); }
    if (e.key === "3") { e.preventDefault(); doStartScroll(); }
  } else {
    if (e.key === "Enter")  { e.preventDefault(); doStopScroll(); }
    if (e.key === "Escape") { e.preventDefault(); doCancelScroll(); }
  }
});

showMain();
setStatus("READY", "ready");
