// script.js
(() => {
  "use strict";

  const APP_KEY = "giornaliera_giri_v5_pdf";

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

  const giorCerca = document.getElementById("giorCerca");
  const btnCopiaIeri = document.getElementById("btnCopiaIeri");
  const btnPdf = document.getElementById("btnPdf");

  const giorCapo = document.getElementById("giorCapo");
  const btnSalvaCapo = document.getElementById("btnSalvaCapo");

  const giorMat1 = document.getElementById("giorMat1");
  const giorMat2 = document.getElementById("giorMat2");
  const btnSalvaMateriali = document.getElementById("btnSalvaMateriali");
  const giorMatHint = document.getElementById("giorMatHint");

  const giorNote = document.getElementById("giorNote");
  const btnSalvaNoteGiornata = document.getElementById("btnSalvaNoteGiornata");

  const giorGiroSpeciale = document.getElementById("giorGiroSpeciale");
  const btnAggiungiGiroSpeciale = document.getElementById("btnAggiungiGiroSpeciale");

  const dlCaposquadra = document.getElementById("dlCaposquadra");
  const dlMateriali = document.getElementById("dlMateriali");
  const giorStatus = document.getElementById("giorStatus");

  const footerInfo = document.getElementById("footerInfo");

  // ===== STATE =====
  let db = loadDB();
  let editContext = null; // { dateISO, giroId }
  let lastRenderedRows = [];

  init();

  function init() {
    footerInfo.textContent =
      "PDF: ora viene generato un file vero (jsPDF). Se WebIntoApp blocca il download, il PDF si apre e lo salvi/condividi da lì.";

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
      rebuildGiroSelectForInsert();
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

    btnCopiaIeri.addEventListener("click", onCopiaDaIeri);
    btnPdf.addEventListener("click", onExportPdf);

    btnAggiungiGiroSpeciale.addEventListener("click", onAggiungiGiroSpeciale);

    [giorMat1, giorMat2].forEach(el => {
      el.addEventListener("input", updateMaterialHint);
      el.addEventListener("change", updateMaterialHint);
    });

    giorCerca.addEventListener("input", applySearchFilter);

    loadGiornata();
    rebuildGiroSelectForInsert();
    refreshInsertMaterialOptions();
  }

  function openTab(tabId) {
    tabBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
    panels.forEach(p => p.classList.toggle("active", p.id === tabId));
    if (tabId === "tab-giornata") loadGiornata();
  }

  // ===== DEFAULTS / DATALISTS =====
  function ensureDefaults() {
    db.operatori = Array.isArray(db.operatori) ? db.operatori : [];
    db.materiali = Array.isArray(db.materiali) ? db.materiali : [];
    db.caposquadraList = Array.isArray(db.caposquadraList) ? db.caposquadraList : [];
    db.dates = db.dates && typeof db.dates === "object" ? db.dates : {};

    if (db.caposquadraList.length === 0) db.caposquadraList = [...DEFAULT_CAPOSQUADRA];
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

  // ===== GIRI LIST =====
  function rebuildGiroSelectForInsert() {
    const dateISO = insData.value || toISODate(new Date());
    const day = getOrCreateDay(dateISO);

    insGiro.innerHTML = "";
    DEFAULT_GIRI.forEach(g => {
      const opt = document.createElement("option");
      opt.value = g;
      opt.textContent = `Giro ${g}`;
      insGiro.appendChild(opt);
    });

    const specials = Array.isArray(day.specialGiri) ? day.specialGiri : [];
    specials.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `Speciale: ${s.label}`;
      insGiro.appendChild(opt);
    });
  }

  function getAllGiriForDay(day) {
    const list = [];
    DEFAULT_GIRI.forEach(g => list.push({ id: g, label: `Giro ${g}`, isSpecial: false }));
    const specials = Array.isArray(day.specialGiri) ? day.specialGiri : [];
    specials.forEach(s => list.push({ id: s.id, label: s.label, isSpecial: true }));
    return list;
  }

  // ===== MATERIALI GIORNATA =====
  function onSaveMaterialiGiornata() {
    const dateISO = giorData.value || toISODate(new Date());
    const day = getOrCreateDay(dateISO);

    const m1 = normalizeText(giorMat1.value);
    const m2 = normalizeText(giorMat2.value);

    if (!m1) return setGiorStatus("Materiale 1 è obbligatorio.");

    day.material1 = m1;
    day.material2 = m2;

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
    const m1 = normalizeText(giorMat1.value);
    const m2 = normalizeText(giorMat2.value);
    giorMatHint.textContent = `Materiale 1: ${m1 || "(vuoto)"} • Materiale 2: ${m2 || "(nessuno)"}`;
  }

  // ===== MATERIALI IN INSERISCI =====
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
      insMatOp2.value = ""; // NON automatico
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
    const giroId = insGiro.value;

    const op1 = normalizeText(insOp1.value);
    const op2 = normalizeText(insOp2.value);
    const t1 = normalizeTarga(insT1.value);
    const t2 = normalizeTarga(insT2.value);
    const note = (insNoteGiro.value || "").trim();

    const matRefOp1 = insMatOp1.value || "";
    const matRefOp2 = insMatOp2.value || "";

    if (!dateISO) return setInsStatus("Errore: data non valida.");
    if (!giroId) return setInsStatus("Errore: seleziona un giro.");

    const hasSomething = !!op1 || !!op2 || !!t1 || !!t2 || !!note || !!matRefOp1 || !!matRefOp2;
    if (!hasSomething) return setInsStatus("Niente da salvare: inserisci almeno un dato.");

    const day = getOrCreateDay(dateISO);
    day.giri = day.giri || {};
    day.giri[giroId] = { op1, op2, t1, t2, note, matRefOp1, matRefOp2, updatedAt: Date.now() };

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

  // ===== GIORNATA LOAD + TABLE =====
  function loadGiornata() {
    const dateISO = giorData.value || toISODate(new Date());
    if (!dateISO) return setGiorStatus("Errore: data non valida.");

    const day = getOrCreateDay(dateISO);

    giorCapo.value = day.caposquadra || "";
    giorNote.value = day.noteGiornata || "";
    giorMat1.value = day.material1 || "";
    giorMat2.value = day.material2 || "";
    updateMaterialHint();

    giorWeekday.textContent = formatWeekdayItalian(dateISO);
    renderTable(dateISO, day);

    if ((insData.value || "") === dateISO) rebuildGiroSelectForInsert();
    applySearchFilter();

    setGiorStatus("Caricato.");
  }

  function renderTable(dateISO, day) {
    const giriData = (day && day.giri) ? day.giri : {};
    const allGiri = getAllGiriForDay(day);

    tblBody.innerHTML = "";
    lastRenderedRows = [];

    allGiri.forEach(g => {
      const entry = giriData[g.id];

      const row = document.createElement("tr");
      row.dataset.search = buildRowSearchBlob(g, entry);

      const tdGiro = document.createElement("td");
      tdGiro.textContent = g.label;
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
      btnMod.addEventListener("click", () => startEditFromGiornata(dateISO, g.id));
      tdA.appendChild(btnMod);

      const btnDel = document.createElement("button");
      btnDel.className = "smallBtn danger";
      btnDel.textContent = "Elimina";
      if (!entry) btnDel.classList.add("disabled");
      else btnDel.addEventListener("click", () => deleteEntry(dateISO, g.id));
      tdA.appendChild(btnDel);

      if (g.isSpecial) {
        const btnRm = document.createElement("button");
        btnRm.className = "smallBtn danger";
        btnRm.textContent = "Rimuovi giro";
        btnRm.addEventListener("click", () => removeSpecialGiro(dateISO, g.id));
        tdA.appendChild(btnRm);
      }

      row.appendChild(tdA);
      tblBody.appendChild(row);
      lastRenderedRows.push(row);
    });
  }

  function buildRowSearchBlob(g, entry) {
    const parts = [];
    parts.push(g.label);
    if (entry) {
      parts.push(entry.op1 || "");
      parts.push(entry.op2 || "");
      parts.push(entry.t1 || "");
      parts.push(entry.t2 || "");
      parts.push(entry.note || "");
    }
    return parts.join(" ").toLowerCase();
  }

  function applySearchFilter() {
    const q = (giorCerca.value || "").trim().toLowerCase();
    if (!lastRenderedRows.length) return;

    if (!q) {
      lastRenderedRows.forEach(r => r.style.display = "");
      return;
    }

    lastRenderedRows.forEach(r => {
      const blob = r.dataset.search || "";
      r.style.display = blob.includes(q) ? "" : "none";
    });
  }

  function startEditFromGiornata(dateISO, giroId) {
    const day = getOrCreateDay(dateISO);
    const entry = (day.giri && day.giri[giroId]) ? day.giri[giroId] : null;

    insData.value = dateISO;
    rebuildGiroSelectForInsert();
    insGiro.value = giroId;

    refreshInsertMaterialOptions();

    insOp1.value = entry?.op1 || "";
    insOp2.value = entry?.op2 || "";
    insT1.value = entry?.t1 || "";
    insT2.value = entry?.t2 || "";
    insNoteGiro.value = entry?.note || "";

    insMatOp1.value = entry?.matRefOp1 || ((day.material1 || "").trim() ? "M1" : "");
    insMatOp2.value = entry?.matRefOp2 || "";

    editContext = { dateISO, giroId };
    btnAnnullaModifica.classList.remove("hidden");
    setInsStatus(`Modifica: ${formatDateIT(dateISO)} • ${labelForGiro(day, giroId)}`);

    updateWeekdayHints();
    openTab("tab-inserisci");
  }

  function labelForGiro(day, giroId) {
    if (DEFAULT_GIRI.includes(giroId)) return `Giro ${giroId}`;
    const specials = Array.isArray(day.specialGiri) ? day.specialGiri : [];
    const s = specials.find(x => x.id === giroId);
    return s ? `Speciale: ${s.label}` : giroId;
  }

  function deleteEntry(dateISO, giroId) {
    const ok = confirm(`Eliminare i dati per ${formatDateIT(dateISO)} • ${giroId}?`);
    if (!ok) return;

    const day = getOrCreateDay(dateISO);
    if (day.giri && day.giri[giroId]) {
      delete day.giri[giroId];
      db.dates[dateISO] = day;
      saveDB();
      loadGiornata();
      setGiorStatus("Eliminato.");
    }
  }

  // ===== GIRI SPECIALI =====
  function onAggiungiGiroSpeciale() {
    const dateISO = giorData.value || toISODate(new Date());
    const label = normalizeText(giorGiroSpeciale.value);
    if (!label) return setGiorStatus("Scrivi un nome per il giro speciale.");

    const day = getOrCreateDay(dateISO);
    day.specialGiri = Array.isArray(day.specialGiri) ? day.specialGiri : [];

    const exists = day.specialGiri.some(x => (x.label || "").toLowerCase() === label.toLowerCase());
    if (exists) return setGiorStatus("Esiste già un giro speciale con lo stesso nome.");

    const id = `S_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    day.specialGiri.push({ id, label });

    db.dates[dateISO] = day;
    saveDB();

    giorGiroSpeciale.value = "";
    setGiorStatus("Giro speciale aggiunto.");

    loadGiornata();
    if ((insData.value || "") === dateISO) rebuildGiroSelectForInsert();
  }

  function removeSpecialGiro(dateISO, giroId) {
    const ok = confirm("Rimuovere questo giro speciale dalla giornata? (Eliminerà anche i dati compilati per quel giro.)");
    if (!ok) return;

    const day = getOrCreateDay(dateISO);
    day.specialGiri = Array.isArray(day.specialGiri) ? day.specialGiri : [];
    day.specialGiri = day.specialGiri.filter(x => x.id !== giroId);
    if (day.giri && day.giri[giroId]) delete day.giri[giroId];

    db.dates[dateISO] = day;
    saveDB();

    setGiorStatus("Giro speciale rimosso.");
    loadGiornata();
    if ((insData.value || "") === dateISO) rebuildGiroSelectForInsert();
  }

  // ===== CAPOSQUADRA / NOTE =====
  function onSaveCaposquadra() {
    const dateISO = giorData.value || toISODate(new Date());
    const capo = normalizeText(giorCapo.value);

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

  // ===== COPIA DA IERI =====
  function onCopiaDaIeri() {
    const dateISO = giorData.value || toISODate(new Date());
    const yISO = addDaysISO(dateISO, -1);

    const yDay = db.dates?.[yISO];
    if (!yDay) return setGiorStatus(`Nessuna giornata trovata per ieri (${formatDateIT(yISO)}).`);

    const day = getOrCreateDay(dateISO);

    day.caposquadra = (yDay.caposquadra || "").trim();
    day.material1 = (yDay.material1 || "").trim();
    day.material2 = (yDay.material2 || "").trim();
    day.noteGiornata = (yDay.noteGiornata || "").trim();

    db.dates[dateISO] = day;
    saveDB();

    setGiorStatus(`Copiato da ieri (${formatDateIT(yISO)}).`);
    loadGiornata();
  }

  // ===== EXPORT PDF (vero) =====
  function onExportPdf() {
    // Verifica librerie
    const jsPDF = window.jspdf?.jsPDF;
    if (!jsPDF || typeof jsPDF !== "function") {
      setGiorStatus("PDF: libreria non caricata. Controlla la connessione (serve internet per jsPDF).");
      return;
    }
    if (typeof jsPDF.API?.autoTable !== "function") {
      setGiorStatus("PDF: autoTable non disponibile (script non caricato).");
      return;
    }

    const dateISO = giorData.value || toISODate(new Date());
    const day = getOrCreateDay(dateISO);

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

    const titolo = "Giornaliera Giri";
    const sottotitolo = formatWeekdayItalian(dateISO);

    const capo = (day.caposquadra || "").trim() || "—";
    const m1 = (day.material1 || "").trim() || "—";
    const m2 = (day.material2 || "").trim() || "—";
    const noteG = (day.noteGiornata || "").trim() || "—";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(titolo, 40, 40);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(sottotitolo, 40, 62);

    doc.setFontSize(10);
    doc.text(`Caposquadra: ${capo}     Materiale 1: ${m1}     Materiale 2: ${m2}`, 40, 84);
    doc.text(`Note giornata: ${noteG}`, 40, 104);

    const giriData = day.giri || {};
    const allGiri = getAllGiriForDay(day);

    const head = [[ "Giro", "Operatori", "Furgoni", "Ripartizione materiali", "Note giro" ]];
    const body = allGiri.map(g => {
      const e = giriData[g.id] || {};
      const ops = [e.op1, e.op2].filter(Boolean).join(" • ") || "—";
      const t = [e.t1, e.t2].filter(Boolean).join(" • ") || "—";

      const rip = [];
      if (e.matRefOp1) rip.push(`${e.op1 || "Op1"} → ${materialLabelForRef(dateISO, e.matRefOp1) || ""}`);
      if (e.op2 && e.matRefOp2) rip.push(`${e.op2 || "Op2"} → ${materialLabelForRef(dateISO, e.matRefOp2) || ""}`);

      return [
        g.label,
        ops,
        t,
        rip.join(" • ") || "—",
        (e.note || "").trim() || "—"
      ];
    });

    doc.autoTable({
      head,
      body,
      startY: 130,
      styles: { font: "helvetica", fontSize: 9, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [240,240,240], textColor: [0,0,0] },
      margin: { left: 40, right: 40 }
    });

    const fileName = `GiornalieraGiri_${dateISO}.pdf`;

    // Tentativo 1: download diretto
    try {
      doc.save(fileName);
      setGiorStatus("PDF generato.");
      return;
    } catch {
      // continua
    }

    // Tentativo 2: apri in nuova scheda come Blob (così lo salvi/condividi)
    try {
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setGiorStatus("PDF aperto. Se non parte il download, salvalo/condividilo dalla schermata PDF.");
      return;
    } catch {
      setGiorStatus("Impossibile generare il PDF su questa WebView.");
    }
  }

  // ===== HELPERS =====
  function clearInsertForm(keepDateGiro) {
    if (!keepDateGiro) {
      insData.value = toISODate(new Date());
      rebuildGiroSelectForInsert();
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

  function addDaysISO(dateISO, deltaDays) {
    const d = parseISODate(dateISO);
    if (!d) return dateISO;
    d.setDate(d.getDate() + deltaDays);
    return toISODate(d);
  }

  function normalizeText(s) {
    return (s || "").trim().replace(/\s+/g, " ");
  }

  function normalizeTarga(s) {
    return (s || "").trim().toUpperCase().replace(/\s+/g, "");
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

  function pushCapoIfNeeded(name) {
    const n = (name || "").trim();
    if (!n) return;
    const exists = db.caposquadraList.some(x => x.toLowerCase() === n.toLowerCase());
    if (!exists) db.caposquadraList.push(n);
  }

  function applySearchFilter() {
    const q = (giorCerca.value || "").trim().toLowerCase();
    if (!lastRenderedRows.length) return;

    if (!q) {
      lastRenderedRows.forEach(r => r.style.display = "");
      return;
    }

    lastRenderedRows.forEach(r => {
      const blob = r.dataset.search || "";
      r.style.display = blob.includes(q) ? "" : "none";
    });
  }

  function buildRowSearchBlob(g, entry) {
    const parts = [];
    parts.push(g.label);
    if (entry) {
      parts.push(entry.op1 || "");
      parts.push(entry.op2 || "");
      parts.push(entry.t1 || "");
      parts.push(entry.t2 || "");
      parts.push(entry.note || "");
    }
    return parts.join(" ").toLowerCase();
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
      existing.specialGiri = Array.isArray(existing.specialGiri) ? existing.specialGiri : [];
      return existing;
    }
    return {
      caposquadra: "",
      noteGiornata: "",
      material1: "",
      material2: "",
      specialGiri: [],
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
