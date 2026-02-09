// script.js
(() => {
  "use strict";

  // ====== CONFIG ======
  const APP_KEY = "giornale_giri_v2";

  // Giri 1..19
  const DEFAULT_GIRI = Array.from({ length: 19 }, (_, i) => (i + 1).toString());

  // Materiali base
  const PRESET_MATERIALI = ["Plastica", "Vetro", "Carta", "Organico", "Secco"];

  // Caposquadra (seed iniziale, modificabile e ampliabile)
  const DEFAULT_CAPOSQUADRA = [
    "Rodolfo Sellati",
    "Andrea Lo Biundo",
    "Mauro Petti",
    "Mario Balletta",
    "Rita Mancini",
    "Sabrina Orsini",
    "Cristina Saccu",
  ];

  // ====== DOM ======
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

  const giorMat1Sel = document.getElementById("giorMat1Sel");
  const giorMat1Custom = document.getElementById("giorMat1Custom");
  const giorMat2Sel = document.getElementById("giorMat2Sel");
  const giorMat2Custom = document.getElementById("giorMat2Custom");
  const btnSalvaMateriali = document.getElementById("btnSalvaMateriali");
  const giorMatHint = document.getElementById("giorMatHint");

  const giorNote = document.getElementById("giorNote");
  const btnSalvaNoteGiornata = document.getElementById("btnSalvaNoteGiornata");
  const dlCaposquadra = document.getElementById("dlCaposquadra");
  const giorStatus = document.getElementById("giorStatus");

  const footerInfo = document.getElementById("footerInfo");

  // ====== STATE ======
  let db = loadDB();
  let editContext = null; // { dateISO, giro }

  // ====== INIT ======
  init();

  function init() {
    footerInfo.textContent =
      "Tip: Imposta Materiale 1/2 nella Giornata, poi in ogni giro scegli chi fa cosa (Op1→Mat1/Mat2).";

    fillGiroSelect();
    ensureDefaults();
    refreshDatalists();
    initMaterialSelectors();

    const todayISO = toISODate(new Date());
    insData.value = todayISO;
    giorData.value = todayISO;

    updateWeekdayHints();

    tabBtns.forEach(btn => btn.addEventListener("click", () => openTab(btn.dataset.tab)));

    insData.addEventListener("change", () => {
      updateWeekdayHints();
      cancelEdit("Hai cambiato data: modifica annullata.");
      refreshInsertMaterialOptions(); // aggiorna dropdown materiali op1/op2
    });

    giorData.addEventListener("change", () => {
      updateWeekdayHints();
      loadGiornata(); // ricarica e aggiorna anche i materiali
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

    // Se l’utente seleziona “Altro…” abilitiamo di fatto il custom (semplice: lo lasciamo sempre scrivibile)
    // Ma aggiorniamo hint riassuntivo
    [giorMat1Sel, giorMat1Custom, giorMat2Sel, giorMat2Custom].forEach(el => {
      el.addEventListener("input", updateMaterialHint);
      el.addEventListener("change", updateMaterialHint);
    });

    // First load
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
    db.caposquadraList = Array.isArray(db.caposquadraList) ? db.caposquadraList : [];
    db.dates = db.dates && typeof db.dates === "object" ? db.dates : {};

    if (db.caposquadraList.length === 0) db.caposquadraList = [...DEFAULT_CAPOSQUADRA];

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

  // ====== MATERIAL SELECTORS (GIORNATA) ======
  function initMaterialSelectors() {
    // Materiale 1
    giorMat1Sel.innerHTML = "";
    PRESET_MATERIALI.forEach(m => addOption(giorMat1Sel, m, m));
    addOption(giorMat1Sel, "__ALTRO__", "Altro...");
    // Materiale 2
    giorMat2Sel.innerHTML = "";
    addOption(giorMat2Sel, "__NONE__", "— Nessuno —");
    PRESET_MATERIALI.forEach(m => addOption(giorMat2Sel, m, m));
    addOption(giorMat2Sel, "__ALTRO__", "Altro...");

    // default
    giorMat1Sel.value = PRESET_MATERIALI[0];
    giorMat2Sel.value = "__NONE__";
    updateMaterialHint();
  }

  function addOption(sel, val, text) {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = text;
    sel.appendChild(opt);
  }

  function resolveMaterial(selVal, customVal) {
    if (!selVal) return "";
    if (selVal === "__NONE__") return "";
    if (selVal === "__ALTRO__") return (customVal || "").trim();
    return selVal; // preset
  }

  function updateMaterialHint() {
    const m1 = resolveMaterial(giorMat1Sel.value, giorMat1Custom.value);
    const m2 = resolveMaterial(giorMat2Sel.value, giorMat2Custom.value);

    const parts = [];
    parts.push(m1 ? `Materiale 1: ${m1}` : "Materiale 1: (vuoto)");
    parts.push(m2 ? `Materiale 2: ${m2}` : "Materiale 2: (nessuno)");
    giorMatHint.textContent = parts.join(" • ");
  }

  function onSaveMaterialiGiornata() {
    const dateISO = giorData.value || toISODate(new Date());
    const day = getOrCreateDay(dateISO);

    const m1 = resolveMaterial(giorMat1Sel.value, giorMat1Custom.value);
    const m2 = resolveMaterial(giorMat2Sel.value, giorMat2Custom.value);

    if (!m1) {
      return setGiorStatus("Materiale 1 non può essere vuoto. Scegli dalla lista o usa 'Altro...'.");
    }

    day.material1 = m1;
    day.material2 = m2; // può essere ""
    day.material1_meta = { sel: giorMat1Sel.value, custom: (giorMat1Custom.value || "").trim() };
    day.material2_meta = { sel: giorMat2Sel.value, custom: (giorMat2Custom.value || "").trim() };

    db.dates[dateISO] = day;
    saveDB();

    // aggiorna dropdown in inserimento (per ripartizione op1/op2)
    refreshInsertMaterialOptions();

    // opzionale: se c'è già roba salvata nei giri con matRef non più valida, la lasciamo com’è (non distruggiamo dati)
    setGiorStatus("Materiali salvati.");
    updateMaterialHint();
    loadGiornata();
  }

  // ====== MATERIAL OPTIONS (INSERISCI) ======
  function refreshInsertMaterialOptions() {
    const dateISO = insData.value || toISODate(new Date());
    const day = getOrCreateDay(dateISO);

    const m1 = (day.material1 || "").trim();
    const m2 = (day.material2 || "").trim();

    // Opzioni: Mat1, Mat2 se presente, e "—"
    const opts = [];
    if (m1) opts.push({ v: "M1", t: `Materiale 1: ${m1}` });
    if (m2) opts.push({ v: "M2", t: `Materiale 2: ${m2}` });
    opts.push({ v: "", t: "— (non specificato) —" });

    // rebuild selects
    rebuildSelect(insMatOp1, opts);
    rebuildSelect(insMatOp2, opts);

    // default: op1 → M1, op2 → M2 se esiste altrimenti M1
    if (!editContext) {
      insMatOp1.value = m1 ? "M1" : "";
      if (m2) insMatOp2.value = "M2";
      else insMatOp2.value = m1 ? "M1" : "";
    }
  }

  function rebuildSelect(sel, opts) {
    const current = sel.value;
    sel.innerHTML = "";
    opts.forEach(o => addOption(sel, o.v, o.t));
    // prova a ripristinare se esiste
    sel.value = opts.some(o => o.v === current) ? current : opts[0].v;
  }

  function materialLabelForRef(dateISO, ref) {
    const day = getOrCreateDay(dateISO);
    const m1 = (day.material1 || "").trim();
    const m2 = (day.material2 || "").trim();
    if (ref === "M1") return m1 || "";
    if (ref === "M2") return m2 || "";
    return "";
  }

  // ====== SAVE GIRO ======
  function onSaveGiro() {
    const dateISO = insData.value || toISODate(new Date());
    const giro = insGiro.value;

    const op1 = normalizeName(insOp1.value);
    const op2 = normalizeName(insOp2.value);
    const t1 = normalizeTarga(insT1.value);
    const t2 = normalizeTarga(insT2.value);
    const note = (insNoteGiro.value || "").trim();

    // Ripartizione materiali
    const matRefOp1 = insMatOp1.value || "";
    const matRefOp2 = insMatOp2.value || "";

    if (!dateISO) return setInsStatus("Errore: data non valida.");
    if (!giro) return setInsStatus("Errore: seleziona un giro.");

    // Consenti salvataggio anche solo per ripartizione? Sì, ma almeno qualcosa deve esserci
    const hasSomething =
      !!op1 || !!op2 || !!t1 || !!t2 || !!note || !!matRefOp1 || !!matRefOp2;

    if (!hasSomething) {
      return setInsStatus("Niente da salvare: inserisci almeno un dato (operatore, targa, note o materiale).");
    }

    const day = getOrCreateDay(dateISO);
    day.giri = day.giri || {};
    day.giri[giro] = {
      op1,
      op2,
      t1,
      t2,
      note,
      matRefOp1,
      matRefOp2,
      updatedAt: Date.now()
    };

    pushOperatorIfNeeded(op1);
    pushOperatorIfNeeded(op2);

    db.dates[dateISO] = day;
    saveDB();
    refreshDatalists();

    setInsStatus(editContext ? "Giro aggiornato." : "Giro salvato.");
    clearInsertForm(true);

    if (giorData.value === dateISO) loadGiornata();

    endEditMode();
  }

  function pushOperatorIfNeeded(name) {
    const n = (name || "").trim();
    if (!n) return;
    const exists = db.operatori.some(x => x.toLowerCase() === n.toLowerCase());
    if (!exists) db.operatori.push(n);
  }

  // ====== GIORNATA: LOAD + TABLE ======
  function loadGiornata() {
    const dateISO = giorData.value || toISODate(new Date());
    if (!dateISO) return setGiorStatus("Errore: data non valida.");

    const day = getOrCreateDay(dateISO);

    // caposquadra + note
    giorCapo.value = day.caposquadra || "";
    giorNote.value = day.noteGiornata || "";

    // materiali: se meta esiste ripristiniamo selezioni UI, altrimenti inferiamo
    restoreMaterialUIFromDay(day);

    // weekday
    giorWeekday.textContent = formatWeekdayItalian(dateISO);

    // table
    renderTable(dateISO, day);

    setGiorStatus("Caricato.");
  }

  function restoreMaterialUIFromDay(day) {
    // Material 1
    if (day.material1_meta && typeof day.material1_meta === "object") {
      giorMat1Sel.value = day.material1_meta.sel || PRESET_MATERIALI[0];
      giorMat1Custom.value = day.material1_meta.custom || "";
    } else {
      // fallback: se materiale1 combacia con preset
      if (PRESET_MATERIALI.includes(day.material1)) {
        giorMat1Sel.value = day.material1;
        giorMat1Custom.value = "";
      } else if (day.material1) {
        giorMat1Sel.value = "__ALTRO__";
        giorMat1Custom.value = day.material1;
      }
    }

    // Material 2
    if (day.material2_meta && typeof day.material2_meta === "object") {
      giorMat2Sel.value = day.material2_meta.sel || "__NONE__";
      giorMat2Custom.value = day.material2_meta.custom || "";
    } else {
      if (!day.material2) {
        giorMat2Sel.value = "__NONE__";
        giorMat2Custom.value = "";
      } else if (PRESET_MATERIALI.includes(day.material2)) {
        giorMat2Sel.value = day.material2;
        giorMat2Custom.value = "";
      } else {
        giorMat2Sel.value = "__ALTRO__";
        giorMat2Custom.value = day.material2;
      }
    }

    updateMaterialHint();
  }

  function renderTable(dateISO, day) {
    const giriData = (day && day.giri) ? day.giri : {};
    tblBody.innerHTML = "";

    DEFAULT_GIRI.forEach(giro => {
      const row = document.createElement("tr");
      const entry = giriData[giro];

      // Giro
      const tdGiro = document.createElement("td");
      tdGiro.textContent = giro;
      row.appendChild(tdGiro);

      // Operatori
      const tdOps = document.createElement("td");
      if (entry && (entry.op1 || entry.op2)) {
        tdOps.textContent = [entry.op1, entry.op2].filter(Boolean).join(" • ");
      } else {
        tdOps.innerHTML = `<span class="badgeEmpty">—</span>`;
      }
      row.appendChild(tdOps);

      // Targhe
      const tdT = document.createElement("td");
      if (entry && (entry.t1 || entry.t2)) {
        tdT.textContent = [entry.t1, entry.t2].filter(Boolean).join(" • ");
      } else {
        tdT.innerHTML = `<span class="badgeEmpty">—</span>`;
      }
      row.appendChild(tdT);

      // Ripartizione materiali
      const tdM = document.createElement("td");
      if (entry && (entry.matRefOp1 || entry.matRefOp2)) {
        const op1Name = entry.op1 || "Op1";
        const op2Name = entry.op2 || "Op2";

        const m1 = materialLabelForRef(dateISO, entry.matRefOp1) || "";
        const m2 = materialLabelForRef(dateISO, entry.matRefOp2) || "";

        const parts = [];
        if (entry.matRefOp1) parts.push(`${op1Name} → ${m1 || "(?)"}`);
        if (entry.op2 && entry.matRefOp2) parts.push(`${op2Name} → ${m2 || "(?)"}`);

        tdM.textContent = parts.length ? parts.join(" • ") : "";
        if (!parts.length) tdM.innerHTML = `<span class="badgeEmpty">—</span>`;
      } else {
        tdM.innerHTML = `<span class="badgeEmpty">—</span>`;
      }
      row.appendChild(tdM);

      // Note giro
      const tdN = document.createElement("td");
      if (entry && entry.note) tdN.textContent = entry.note;
      else tdN.innerHTML = `<span class="badgeEmpty">—</span>`;
      row.appendChild(tdN);

      // Azioni
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

    // Aggiorna opzioni materiali in base alla giornata selezionata
    refreshInsertMaterialOptions();

    insOp1.value = entry?.op1 || "";
    insOp2.value = entry?.op2 || "";
    insT1.value = entry?.t1 || "";
    insT2.value = entry?.t2 || "";
    insNoteGiro.value = entry?.note || "";

    insMatOp1.value = entry?.matRefOp1 || (day.material1 ? "M1" : "");
    // se op2 esiste e materiale2 esiste, default M2, altrimenti M1
    if (entry?.matRefOp2 !== undefined) insMatOp2.value = entry.matRefOp2 || "";
    else insMatOp2.value = day.material2 ? "M2" : (day.material1 ? "M1" : "");

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

  // ====== CAPOSQUADRA / NOTE GIORNATA ======
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

  // ====== EDIT MODE HELPERS ======
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
    // materiali op1/op2 vengono riallineati
    refreshInsertMaterialOptions();
    updateWeekdayHints();
  }

  // ====== WEEKDAY + FORMATTING ======
  function updateWeekdayHints() {
    const dateISO1 = insData.value;
    insWeekdayHint.textContent = dateISO1 ? formatWeekdayItalian(dateISO1) : "";

    const dateISO2 = giorData.value;
    giorWeekday.textContent = dateISO2 ? formatWeekdayItalian(dateISO2) : "";
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

  // ====== NORMALIZATION ======
  function normalizeName(s) {
    return (s || "").trim().replace(/\s+/g, " ");
  }

  function normalizeTarga(s) {
    return (s || "").trim().toUpperCase().replace(/\s+/g, "");
  }

  // ====== DB ======
  function loadDB() {
    try {
      const raw = localStorage.getItem(APP_KEY);
      if (!raw) return { dates: {}, operatori: [], caposquadraList: [] };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") throw new Error("DB invalid");
      return parsed;
    } catch {
      return { dates: {}, operatori: [], caposquadraList: [] };
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
      existing.material1 = (existing.material1 || "").trim();
      existing.material2 = (existing.material2 || "").trim();
      return existing;
    }
    return {
      caposquadra: "",
      noteGiornata: "",
      material1: "", // obbligatorio quando lo imposti
      material2: "",
      material1_meta: null,
      material2_meta: null,
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

  // ====== UI STATUS ======
  function setInsStatus(msg) { insStatus.textContent = msg || ""; }
  function setGiorStatus(msg) { giorStatus.textContent = msg || ""; }
})();