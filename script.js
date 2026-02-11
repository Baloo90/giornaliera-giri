// script.js (sostituisci tutto con questo)
(() => {
  "use strict";

  const APP_KEY = "giornaliera_giri_v7_pdf_nosave";

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

  const btnBackup = document.getElementById("btnBackup");
  const btnImport = document.getElementById("btnImport");
  const fileImport = document.getElementById("fileImport");

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
  let lastPdfUrl = null;

  init();

  function init() {
    footerInfo.textContent =
      "PDF: per evitare il Save as imposto dalla WebView, ora il PDF si apre direttamente (poi lo salvi/condividi dal viewer).";

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
    btnPdf.addEventListener("click", onExportPdfOpen);

    btnBackup.addEventListener("click", onBackup);
    btnImport.addEventListener("click", () => fileImport.click());
    fileImport.addEventListener("change", onImportFile);

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

  // ===== BACKUP / IMPORT =====
  function onBackup() {
    const stamp = toISODate(new Date());
    const fileName = `Backup_GiornalieraGiri_${stamp}.json`;

    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1500);
    setGiorStatus("Backup creato (JSON).");
  }

  async function onImportFile() {
    const file = fileImport.files?.[0];
    fileImport.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed || typeof parsed !== "object") throw new Error("File non valido");
      if (!parsed.dates || typeof parsed.dates !== "object") throw new Error("Manca 'dates'");

      db = parsed;
      ensureDefaults();
      saveDB();

      refreshDatalists();
      refreshMaterialDatalist();
      rebuildGiroSelectForInsert();
      refreshInsertMaterialOptions();
      loadGiornata();

      setGiorStatus("Import completato.");
    } catch {
      setGiorStatus("Import fallito: JSON non valido o struttura sbagliata.");
    }
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
    opts.push({ v: "", t: "- (non specificato) -" });

    rebuildSelect(insMatOp1, opts);
    rebuildSelect(insMatOp2, opts);

    if (!editContext) {
      insMatOp1.value = m1 ? "M1" : "";
      insMatOp2.value = "";
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
      tdOps.textContent = entry ? [entry.op1, entry.op2].filter(Boolean).join(" • ") : "-";
      row.appendChild(tdOps);

      const tdT = document.createElement("td");
      tdT.textContent = entry ? [entry.t1, entry.t2].filter(Boolean).join(" • ") : "-";
      row.appendChild(tdT);

      const tdM = document.createElement("td");
      if (entry && (entry.matRefOp1 || entry.matRefOp2)) {
        const parts = [];
        if (entry.matRefOp1) parts.push(`${entry.op1 || "Op1"} -> ${materialLabelForRef(dateISO, entry.matRefOp1) || ""}`);
        if (entry.op2 && entry.matRefOp2) parts.push(`${entry.op2 || "Op2"} -> ${materialLabelForRef(dateISO, entry.matRefOp2) || ""}`);
        tdM.textContent = parts.join(" • ") || "-";
      } else tdM.textContent = "-";
      row.appendChild(tdM);

      const tdN = document.createElement("td");
      tdN.textContent = entry?.note || "-";
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
    const parts = [g.label];
    if (entry) parts.push(entry.op1 || "", entry.op2 || "", entry.t1 || "", entry.t2 || "", entry.note || "");
    return parts.join(" ").toLowerCase();
  }

  function applySearchFilter() {
    const q = (giorCerca.value || "").trim().toLowerCase();
    if (!q) return lastRenderedRows.forEach(r => r.style.display = "");
    lastRenderedRows.forEach(r => r.style.display = (r.dataset.search || "").includes(q) ? "" : "none");
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
    const s = (day.specialGiri || []).find(x => x.id === giroId);
    return s ? `Speciale: ${s.label}` : giroId;
  }

  function deleteEntry(dateISO, giroId) {
    if (!confirm(`Eliminare i dati per ${formatDateIT(dateISO)} • ${giroId}?`)) return;
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
    if (!confirm("Rimuovere questo giro speciale dalla giornata? (Eliminerà anche i dati compilati per quel giro.)")) return;
    const day = getOrCreateDay(dateISO);
    day.specialGiri = (day.specialGiri || []).filter(x => x.id !== giroId);
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
    const day = getOrCreateDay(dateISO);
    day.noteGiornata = (giorNote.value || "").trim();
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

  // ===== EXPORT PDF (NO SAVE AS) =====
  function onExportPdfOpen() {
    const jsPDF = window.jspdf?.jsPDF;
    if (!jsPDF || typeof jsPDF !== "function") {
      setGiorStatus("PDF: libreria non caricata. Serve internet.");
      return;
    }
    if (typeof jsPDF.API?.autoTable !== "function") {
      setGiorStatus("PDF: autoTable non disponibile.");
      return;
    }

    // libera eventuale URL precedente
    if (lastPdfUrl) {
      try { URL.revokeObjectURL(lastPdfUrl); } catch {}
      lastPdfUrl = null;
    }

    const dateISO = giorData.value || toISODate(new Date());
    const day = getOrCreateDay(dateISO);

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(pdfSafe("Giornaliera Giri"), 40, 40);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(pdfSafe(formatWeekdayItalian(dateISO)), 40, 62);

    const capo = (day.caposquadra || "").trim() || "-";
    const m1 = (day.material1 || "").trim() || "-";
    const m2 = (day.material2 || "").trim() || "-";
    const noteG = (day.noteGiornata || "").trim() || "-";

    doc.setFontSize(10);
    doc.text(pdfSafe(`Caposquadra: ${capo}   Materiale 1: ${m1}   Materiale 2: ${m2}`), 40, 84);
    doc.text(pdfSafe(`Note giornata: ${noteG}`), 40, 104);

    const giriData = day.giri || {};
    const allGiri = getAllGiriForDay(day);

    const head = [[ "Giro", "Operatori", "Furgoni", "Ripartizione materiali", "Note giro" ]];
    const body = allGiri.map(g => {
      const e = giriData[g.id] || {};
      const ops = [e.op1, e.op2].filter(Boolean).join(" • ") || "-";
      const t = [e.t1, e.t2].filter(Boolean).join(" • ") || "-";

      const rip = [];
      if (e.matRefOp1) rip.push(`${e.op1 || "Op1"} -> ${materialLabelForRef(dateISO, e.matRefOp1) || ""}`);
      if (e.op2 && e.matRefOp2) rip.push(`${e.op2 || "Op2"} -> ${materialLabelForRef(dateISO, e.matRefOp2) || ""}`);

      return [
        pdfSafe(g.label),
        pdfSafe(ops),
        pdfSafe(t),
        pdfSafe(rip.join(" • ") || "-"),
        pdfSafe((e.note || "").trim() || "-")
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

    // crea blob e apri
    try {
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      lastPdfUrl = url;

      // Tentativo: apri viewer
      const w = window.open(url, "_blank");
      if (w) {
        setGiorStatus("PDF aperto: salva/condividi dal viewer (così niente Save as).");
        return;
      }

      // Se window.open è bloccato: crea un link "Apri PDF"
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.textContent = "Apri PDF";
      a.style.display = "inline-block";
      a.style.marginTop = "8px";
      a.style.fontWeight = "900";
      a.style.color = "#e7eefc";
      giorStatus.innerHTML = "";
      giorStatus.appendChild(document.createTextNode("Popup bloccato. Tocca: "));
      giorStatus.appendChild(a);
    } catch {
      setGiorStatus("Impossibile aprire il PDF su questa WebView.");
    }
  }

  // ===== TEXT SAFE FOR PDF =====
  function pdfSafe(s) {
    const str = String(s ?? "");
    const map = {
      "à":"a","á":"a","â":"a","ä":"a","ã":"a","å":"a",
      "è":"e","é":"e","ê":"e","ë":"e",
      "ì":"i","í":"i","î":"i","ï":"i",
      "ò":"o","ó":"o","ô":"o","ö":"o","õ":"o",
      "ù":"u","ú":"u","û":"u","ü":"u",
      "À":"A","È":"E","Ì":"I","Ò":"O","Ù":"U",
      "—":"-","–":"-","→":"->","€":"EUR"
    };
    return str
      .split("")
      .map(ch => map[ch] ?? ch)
      .join("")
      .replace(/[^\x20-\x7E]/g, "");
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

  function normalizeText(s) { return (s || "").trim().replace(/\s+/g, " "); }
  function normalizeTarga(s) { return (s || "").trim().toUpperCase().replace(/\s+/g, ""); }

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

  function saveDB() { try { localStorage.setItem(APP_KEY, JSON.stringify(db)); } catch {} }

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
    return { caposquadra:"", noteGiornata:"", material1:"", material2:"", specialGiri:[], giri:{} };
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

  function setInsStatus(msg) { insStatus.textContent = msg || ""; }
  function setGiorStatus(msg) { giorStatus.textContent = msg || ""; }
})();
