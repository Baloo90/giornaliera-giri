// script.js
(() => {
  "use strict";

  const APP_KEY = "giornaliera_giri_v3";

  const DEFAULT_GIRI = Array.from({ length: 19 }, (_, i) => (i + 1).toString());

  const PRESET_MATERIALI = ["Plastica", "Vetro", "Carta", "Organico", "Secco"];

  const DEFAULT_CAPOSQUADRA = [
    "Rodolfo Sellati",
    "Andrea Lo Biundo",
    "Mauro Petti",
    "Mario Balletta",
    "Rita Mancini",
    "Sabrina Orsini",
    "Cristina Saccu",
  ];

  // ===== DOM =====
  const tabBtns = [...document.querySelectorAll(".tabBtn")];
  const panels = [...document.querySelectorAll(".tabPanel")];

  // Inserisci
  const insData = document.getElementById("insData");
  const insWeekdayHint = document.getElementById("insWeekdayHint");
  const insGiro = document.getElementById("insGiro");
  const insOp1 = document.getElementById("insOp1");
  const insOp2 = document.getElementById("insOp2");
  const insT1 = document.getElementById("insT1");
  const insT2 = document.getElementById("insT2");
  const insMatOp1 = document.getElementById("insMatOp1");
  const insMatOp2 = document.getElementById("insMatOp2");
  const insNoteGiro = document.getElementById("insNoteGiro");
  const btnSalva = document.getElementById("btnSalva");
  const btnPulisci = document.getElementById("btnPulisci");
  const btnAnnullaModifica = document.getElementById("btnAnnullaModifica");
  const insStatus = document.getElementById("insStatus");
  const dlOperatori = document.getElementById("dlOperatori");

  // Giornata
  const giorData = document.getElementById("giorData");
  const giorWeekday = document.getElementById("giorWeekday");
  const btnCarica = document.getElementById("btnCarica");
  const tblBody = document.getElementById("tblBody");

  const giorCapo = document.getElementById("giorCapo");
  const btnSalvaCapo = document.getElementById("btnSalvaCapo");

  const giorMat1 = document.getElementById("giorMat1");
  const giorMat2 = document.getElementById("giorMat2");
  const btnSalvaMateriali = document.getElementById("btnSalvaMateriali");
  const giorMatHint = document.getElementById("giorMatHint");

  const giorNote = document.getElementById("giorNote");
  const btnSalvaNoteGiornata = document.getElementById("btnSalvaNoteGiornata");
  const dlCaposquadra = document.getElementById("dlCaposquadra");
  const dlMateriali = document.getElementById("dlMateriali");
  const giorStatus = document.getElementById("giorStatus");

  const footerInfo = document.getElementById("footerInfo");

  // ===== STATE =====
  let db = loadDB();
  let editContext = null; // { dateISO, giro }

  init();

  function init() {
    footerInfo.textContent =
      "Imposta Materiale 1/2 in Giornata, poi per ogni giro scegli Op1→Materiale 1/2 e Op2→Materiale 1/2.";

    fillGiroSelect();
    ensureDefaults();
    refreshDatalists();
    refreshMaterialDatalist();

    const todayISO = toISODate(new Date());
    insData.value = todayISO;
    giorData.value = todayISO;

    updateWeekdayHints();

    tabBtns.forEach(btn => btn.addEventListener("click", () => openTab(btn.dataset.tab)));

    insData.addEventListener("change", () => {
      updateWeekdayHints();
      cancelEdit("Hai cambiato data: modifica annullata.");
      refreshInsertMaterialOptions();
    });

    giorData.addEventListener("change", () => {
      updateWeekdayHints();
      loadGiornata();
    });

    btnCarica.addEventListener("click", loadGiornata);

    btnSalva.addEventListener("click", onSaveGiro);
    btnPulisci.addEventListener("click", () => {
      clearInsertForm(false);
      setInsStatus("Campi puliti.");
    });

    btnAnnullaModifica.addEventListener("click", () => cancelEdit("Modifica annullata."));

    btnSalvaCapo.addEventListener("click", onSaveCaposquadra);
    btnSalvaMateriali.addEventListener("click", onSaveMaterialiGiornata);
    btnSalvaNoteGiornata.addEventListener("click", onSaveNoteGiornata);

    [giorMat1, giorMat2].forEach(el => {
      el.addEventListener("input", updateMaterialHint);
      el.addEventListener("change", updateMaterialHint);
    });

    loadGiornata();
    refreshInsertMaterialOptions();
  }

  function openTab(tabId) {
    tabBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
    panels.forEach(p => p.classList.toggle("active", p.id === tabId));
    if (tabId === "tab-giornata") loadGiornata();
  }

  function fillGiroSelect() {
    insGiro.innerHTML = "";
    DEFAULT_GIRI.forEach(g => {
      const opt = document.createElement("option");
      opt.value = g;
      opt.textContent = `Giro ${g}`;
      insGiro.appendChild(opt);
    });
  }

  function ensureDefaults() {
    db.operatori = Array.isArray(db.operatori) ? db.operatori : [];
    db.materiali = Array.isArray(db.materiali) ? db.materiali : [];
    db.caposquadraList = Array.isArray(db.caposquadraList) ? db.caposquadraList : [];
    db.dates = db.dates && typeof db.dates === "object" ? db.dates : {};

    if (db.caposquadraList.length === 0) db.caposquadraList = [...DEFAULT_CAPOSQUADRA];

    // seed materiali con preset
    PRESET_MATERIALI.forEach(m => pushMaterialIfNeeded(m));

    saveDB();
  }

  function refreshDatalists() {
    dlOperatori.innerHTML = "";
    uniqueSorted(db.operatori).forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      dlOperatori.appendChild(opt);
    });

    dlCaposquadra.innerHTML = "";
    uniqueSorted(db.caposquadraList).forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      dlCaposquadra.appendChild(opt);
    });
  }

  function refreshMaterialDatalist() {
    dlMateriali.innerHTML = "";
    uniqueSorted(db.materiali).forEach(m => {
      const opt = document.createElement("option");
      opt.value = m;
      dlMateriali.appendChild(opt);
    });
  }

  // ===== MATERIALI GIORNATA =====
  function onSaveMaterialiGiornata() {
    const dateISO = giorData.value || toISODate(new Date());
    const day = getOrCreateDay(dateISO);

    const m1 = normalizeMaterial(giorMat1.value);
    const m2 = normalizeMaterial(giorMat2.value);

    if (!m1) return setGiorStatus("Materiale 1 è obbligatorio (puoi anche scriverlo a mano).");

    day.material1 = m1;
    day.material2 = m2; // può essere vuoto

    pushMaterialIfNeeded(m1);
    if (m2) pushMaterialIfNeeded(m2);

    db.dates[dateISO] = day;
    saveDB();

    refreshMaterialDatalist();
    refreshInsertMaterialOptions();
    updateMaterialHint();

    setGiorStatus("Materiali salvati.");
    loadGiornata();
  }

  function updateMaterialHint() {
    const m1 = normalizeMaterial(giorMat1.value);
    const m2 = normalizeMaterial(giorMat2.value);
    giorMatHint.textContent = `Materiale 1: ${m1 || "(vuoto)"} • Materiale 2: ${m2 || "(nessuno)"}`;
  }

  function normalizeMaterial(s) {
    return (s || "").trim().replace(/\s+/g, " ");
  }

  // ===== MATERIALI IN INSERISCI (Op1/Op2 scelgono tra Materiale1/2 della data) =====
  function refreshInsertMaterialOptions() {
    const dateISO = insData.value || toISODate(new Date());
    const day = getOrCreateDay(dateISO);

    const m1 = (day.material1 || "").trim();
    const m2 = (day.material2 || "").trim();

    const opts = [];
    if (m1) opts.push({ v: "M1", t: `Materiale 1: ${m1}` });
    if (m2) opts.push({ v: "M2", t: `Materiale 2: ${m2}` });
    opts.push({ v: "", t: "— (non specificato) —" });

    rebuildSelect(insMatOp1, opts);
    rebuildSelect(insMatOp2, opts);

    if (!editContext) {
      insMatOp1.value = m1 ? "M1" : "";
      insMatOp2.value = m2 ? "M2" : (m1 ? "M1" : "");
    }
  }

  function rebuildSelect(sel, opts) {
    const current = sel.value;
    sel.innerHTML = "";
    opts.forEach(o => {
      const opt = document.createElement("option");
      opt.value = o.v;
      opt.textContent = o.t;
      sel.appendChild(opt);
    });
    sel.value = opts.some(o => o.v === current) ? current : opts[0].v;
  }

  function materialLabelForRef(dateISO, ref) {
    const day = getOrCreateDay(dateISO);
    if (ref === "M1") return (day.material1 || "").trim();
    if (ref === "M2") return (day.material2 || "").trim();
    return "";
  }

  // ===== SAVE GIRO =====
  function onSaveGiro() {
    const dateISO = insData.value || toISODate(new Date());
    const giro = insGiro.value;

    const op1 = normalizeName(insOp1.value);
    const op2 = normalizeName(insOp2.value);
    const t1 = normalizeTarga(insT1.value);
    const t2 = normalizeTarga(insT2.value);
    const note = (insNoteGiro.value || "").trim();

    const matRefOp1 = insMatOp1.value || "";
    const matRefOp2 = insMatOp2.value || "";

    if (!dateISO) return setInsStatus("Errore: data non valida.");
    if (!giro) return setInsStatus("Errore: seleziona un giro.");

    const hasSomething = !!op1 || !!op2 || !!t1 || !!t2 || !!note || !!matRefOp1 || !!matRefOp2;
    if (!hasSomething) return setInsStatus("Niente da salvare: inserisci almeno un dato.");

    const day = getOrCreateDay(dateISO);
    day.giri = day.giri || {};
    day.giri[giro] = {
      op1, op2, t1, t2, note,
      matRefOp1, matRefOp2,
      updatedAt: Date.now()
    };

    pushOperatoreIfNeeded(op1);
    pushOperatoreIfNeeded(op2);

    db.dates[dateISO] = day;
    saveDB();
    refreshDatalists();

    setInsStatus(editContext ? "Giro aggiornato." : "Giro salvato.");
    clearInsertForm(true);

    if (giorData.value === dateISO) loadGiornata();
    endEditMode();
  }

  function pushOperatoreIfNeeded(name) {
    const n = (name || "").trim();
    if (!n) return;
    const exists = db.operatori.some(x => x.toLowerCase() === n.toLowerCase());
    if (!exists) db.operatori.push(n);
  }

  function pushMaterialIfNeeded(mat) {
    const m = (mat || "").trim();
    if (!m) return;
    const exists = db.materiali.some(x => x.toLowerCase() === m.toLowerCase());
    if (!exists) db.materiali.push(m);
  }

  // ===== GIORNATA LOAD + TABLE =====
  function loadGiornata() {
    const dateISO = giorData.value || toISODate(new Date());
    if (!dateISO) return setGiorStatus("Errore: data non valida.");

    const day = getOrCreateDay(dateISO);

    giorCapo.value = day.caposquadra || "";
    giorNote.value = day.noteGiornata || "";

    // materiali
    giorMat1.value = day.material1 || "";
    giorMat2.value = day.material2 || "";
    updateMaterialHint();

    giorWeekday.textContent = formatWeekdayItalian(dateISO);
    renderTable(dateISO, day);

    setGiorStatus("Caricato.");
  }

  function renderTable(dateISO, day) {
    const giriData = (day && day.giri) ? day.giri : {};
    tblBody.innerHTML = "";

    DEFAULT_GIRI.forEach(giro => {
      const entry = giriData[giro];
      const row = document.createElement("tr");

      const tdGiro = document.createElement("td");
      tdGiro.textContent = giro;
      row.appendChild(tdGiro);

      const tdOps = document.createElement("td");
      tdOps.innerHTML = (entry && (entry.op1 || entry.op2))
        ? escapeHtml([entry.op1, entry.op2].filter(Boolean).join(" • "))
        : `<span class="badgeEmpty">—</span>`;
      row.appendChild(tdOps);

      const tdT = document.createElement("td");
      tdT.innerHTML = (entry && (entry.t1 || entry.t2))
        ? escapeHtml([entry.t1, entry.t2].filter(Boolean).join(" • "))
        : `<span class="badgeEmpty">—</span>`;
      row.appendChild(tdT);

      const tdM = document.createElement("td");
      if (entry && (entry.matRefOp1 || entry.matRefOp2)) {
        const op1Name = entry.op1 || "Op1";
        const op2Name = entry.op2 || "Op2";
        const mOp1 = materialLabelForRef(dateISO, entry.matRefOp1) || "(?)";
        const mOp2 = materialLabelForRef(dateISO, entry.matRefOp2) || "(?)";

        const parts = [];
        if (entry.matRefOp1) parts.push(`${op1Name} → ${mOp1}`);
        if (entry.op2 && entry.matRefOp2) parts.push(`${op2Name} → ${mOp2}`);

        tdM.textContent = parts.length ? parts.join(" • ") : "—";
      } else {
        tdM.innerHTML = `<span class="badgeEmpty">—</span>`;
      }
      row.appendChild(tdM);

      const tdN = document.createElement("td");
      tdN.innerHTML = (entry && entry.note)
        ? escapeHtml(entry.note)
        : `<span class="badgeEmpty">—</span>`;
      row.appendChild(tdN);

      const tdA = document.createElement("td");
      tdA.className = "actionsCell";

      const btnMod = document.createElement("button");
      btnMod.className = "smallBtn primary";
      btnMod.textContent = "Modifica";
      btnMod.addEventListener("click", () => startEditFromGiornata(dateISO, giro));
      tdA.appendChild(btnMod);

      const btnDel = document.createElement("button");
      btnDel.className = "smallBtn danger";
      btnDel.textContent = "Elimina";
      if (!entry) btnDel.classList.add("disabled");
      else btnDel.addEventListener("click", () => deleteEntry(dateISO, giro));
      tdA.appendChild(btnDel);

      row.appendChild(tdA);
      tblBody.appendChild(row);
    });
  }

  function startEditFromGiornata(dateISO, giro) {
    const day = getOrCreateDay(dateISO);
    const entry = (day.giri && day.giri[giro]) ? day.giri[giro] : null;

    insData.value = dateISO;
    insGiro.value = giro;

    refreshInsertMaterialOptions();

    insOp1.value = entry?.op1 || "";
    insOp2.value = entry?.op2 || "";
    insT1.value = entry?.t1 || "";
    insT2.value = entry?.t2 || "";
    insNoteGiro.value = entry?.note || "";

    insMatOp1.value = entry?.matRefOp1 || (day.material1 ? "M1" : "");
    insMatOp2.value = entry?.matRefOp2 || (day.material2 ? "M2" : (day.material1 ? "M1" : ""));

    editContext = { dateISO, giro };
    btnAnnullaModifica.classList.remove("hidden");
    setInsStatus(`Modifica: ${formatDateIT(dateISO)} • Giro ${giro}`);

    updateWeekdayHints();
    openTab("tab-inserisci");
  }

  function deleteEntry(dateISO, giro) {
    const ok = confirm(`Eliminare i dati di Giro ${giro} per ${formatDateIT(dateISO)}?`);
    if (!ok) return;

    const day = getOrCreateDay(dateISO);
    if (day.giri && day.giri[giro]) {
      delete day.giri[giro];
      db.dates[dateISO] = day;
      saveDB();
      loadGiornata();
      setGiorStatus(`Eliminato Giro ${giro}.`);
    }
  }

  // ===== CAPOSQUADRA / NOTE =====
  function onSaveCaposquadra() {
    const dateISO = giorData.value || toISODate(new Date());
    const capo = normalizeName(giorCapo.value);

    const day = getOrCreateDay(dateISO);
    day.caposquadra = capo;

    if (capo) pushCapoIfNeeded(capo);

    db.dates[dateISO] = day;
    saveDB();
    refreshDatalists();
    setGiorStatus("Caposquadra salvato.");
  }

  function onSaveNoteGiornata() {
    const dateISO = giorData.value || toISODate(new Date());
    const note = (giorNote.value || "").trim();

    const day = getOrCreateDay(dateISO);
    day.noteGiornata = note;

    db.dates[dateISO] = day;
    saveDB();
    setGiorStatus("Note giornata salvate.");
  }

  function pushCapoIfNeeded(name) {
    const n = (name || "").trim();
    if (!n) return;
    const exists = db.caposquadraList.some(x => x.toLowerCase() === n.toLowerCase());
    if (!exists) db.caposquadraList.push(n);
  }

  // ===== EDIT HELPERS =====
  function endEditMode() {
    editContext = null;
    btnAnnullaModifica.classList.add("hidden");
  }

  function cancelEdit(msg) {
    if (!editContext) return;
    endEditMode();
    clearInsertForm(false);
    setInsStatus(msg);
  }

  function clearInsertForm(keepDateGiro) {
    if (!keepDateGiro) {
      insData.value = toISODate(new Date());
      insGiro.value = DEFAULT_GIRI[0];
    }
    insOp1.value = "";
    insOp2.value = "";
    insT1.value = "";
    insT2.value = "";
    insNoteGiro.value = "";
    refreshInsertMaterialOptions();
    updateWeekdayHints();
  }

  // ===== DATE / FORMAT =====
  function updateWeekdayHints() {
    const d1 = insData.value;
    insWeekdayHint.textContent = d1 ? formatWeekdayItalian(d1) : "";

    const d2 = giorData.value;
    giorWeekday.textContent = d2 ? formatWeekdayItalian(d2) : "";
  }

  function formatWeekdayItalian(dateISO) {
    const d = parseISODate(dateISO);
    if (!d) return "";
    const weekday = new Intl.DateTimeFormat("it-IT", { weekday: "long" }).format(d);
    const prettyDate = formatDateIT(dateISO);
    return `${weekday} • ${prettyDate}`;
  }

  function formatDateIT(dateISO) {
    const d = parseISODate(dateISO);
    if (!d) return dateISO;
    return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  }

  function parseISODate(iso) {
    if (!iso || typeof iso !== "string") return null;
    const [y, m, d] = iso.split("-").map(n => parseInt(n, 10));
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  }

  function toISODate(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function normalizeName(s) {
    return (s || "").trim().replace(/\s+/g, " ");
  }

  function normalizeTarga(s) {
    return (s || "").trim().toUpperCase().replace(/\s+/g, "");
  }

  // ===== DB =====
  function loadDB() {
    try {
      const raw = localStorage.getItem(APP_KEY);
      if (!raw) return { dates: {}, operatori: [], materiali: [], caposquadraList: [] };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") throw new Error("DB invalid");
      return parsed;
    } catch {
      return { dates: {}, operatori: [], materiali: [], caposquadraList: [] };
    }
  }

  function saveDB() {
    try { localStorage.setItem(APP_KEY, JSON.stringify(db)); } catch {}
  }

  function getOrCreateDay(dateISO) {
    const existing = db.dates[dateISO];
    if (existing && typeof existing === "object") {
      existing.giri = existing.giri && typeof existing.giri === "object" ? existing.giri : {};
      existing.caposquadra = existing.caposquadra || "";
      existing.noteGiornata = existing.noteGiornata || "";
      existing.material1 = existing.material1 || "";
      existing.material2 = existing.material2 || "";
      return existing;
    }
    return {
      caposquadra: "",
      noteGiornata: "",
      material1: "",
      material2: "",
      giri: {}
    };
  }

  function uniqueSorted(arr) {
    const seen = new Set();
    const out = [];
    (arr || []).forEach(x => {
      const v = (x || "").trim();
      if (!v) return;
      const key = v.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(v);
    });
    out.sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }));
    return out;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, ch => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#39;"
    }[ch]));
  }

  // ===== STATUS =====
  function setInsStatus(msg) { insStatus.textContent = msg || ""; }
  function setGiorStatus(msg) { giorStatus.textContent = msg || ""; }
})();
