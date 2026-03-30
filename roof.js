const $ = (id) => document.getElementById(id);

// --- UTILIDADES ---
function round2(num) {
  return Math.round(num * 100) / 100;
}

function ceilWaste(qty, wastePercent) {
  return Math.ceil(qty * (1 + wastePercent / 100));
}

function formatMoney(num) {
  return `$${(num || 0).toFixed(2)}`;
}

function inchesToFeetInches(inches) {
  const totalInches = Math.round(inches * 100) / 100;
  const feet = Math.floor(totalInches / 12);
  const remainder = totalInches - feet * 12;
  return `${feet}' - ${round2(remainder)}"`;
}

function chooseBoardLength(lengthFeet) {
  if (lengthFeet <= 8) return 8;
  if (lengthFeet <= 12) return 12;
  if (lengthFeet <= 16) return 16;
  return Math.ceil(lengthFeet);
}

// --- CÁLCULO PRINCIPAL ---
function calculateRoof() {
  // OBTENER LENGUAJE ACTIVO PARA RESULTADOS
  const lang = localStorage.getItem('prefLang') || 'es';
  const t = (typeof translations !== 'undefined' && translations[lang]) ? translations[lang] : translations['en'];

  // --- 1) DIAGNÓSTICO DE IDs ---
  const requiredIds = ["span", "structureLength", "overhang", "pitch", "rafterSpacing"];
  let missing = [];
  requiredIds.forEach(id => {
    if (!$(id)) missing.push(`id='${id}'`);
  });
  if (missing.length > 0) {
    alert("Error de estructura en el HTML: No se encontraron los siguientes IDs críticos: " + missing.join(", "));
    return;
  }

  // --- 2) GET INPUTS ---
  const span = parseFloat($("span").value);
  const structureLength = parseFloat($("structureLength").value);
  const overhang = parseFloat($("overhang").value) || 0;
  const pitch = parseFloat($("pitch").value);
  const rafterSpacing = parseFloat($("rafterSpacing").value) || 24;

  const cfg = {
    ridgeType: $("ridgeType")?.value || "single",
    rafterLumber: $("rafterLumber")?.value || "2x6",
    ridgeLumber: $("ridgeLumber")?.value || "2x8",
    fasciaLumber: $("fasciaLumber")?.value || "1x6",
    sheathingType: $("sheathingType")?.value || "osb",
    roofCovering: $("roofCovering")?.value || "metal",
  };

  const waste = parseFloat($("wastePercent")?.value) || 10;

  if (span <= 0 || structureLength <= 0 || pitch <= 0) {
    $("resultsContent").innerHTML = `<p class="section-sub" style="color:red">${t.errRoofDims || "Please enter valid positive numbers for Span, Length, and Pitch."}</p>`;
    return;
  }

  // --- 3) GEOMETRÍA DETALLADA ---
  const run = span / 2;
  const pitchDecimal = pitch / 12;
  const rafterSlopeMultiplier = Math.sqrt(1 + pitchDecimal * pitchDecimal);
  
  const rafterLinealFeet = run * rafterSlopeMultiplier;
  const overhangSlopeFeet = (overhang / 12) * rafterSlopeMultiplier;
  const totalRafterLength = rafterLinealFeet + overhangSlopeFeet;

  const roofAreaSingleSide = totalRafterLength * structureLength;
  const totalRoofArea = roofAreaSingleSide * 2;
  const areaWithWaste = totalRoofArea * (1 + waste / 100);

  // --- 4) CANTIDADES DE FRAMING ---
  // Rafters
  const rafterSpacingFeet = rafterSpacing / 12;
  const raftersPerSide = Math.ceil(structureLength / rafterSpacingFeet) + 1;
  const totalRaftersBase = raftersPerSide * 2;
  const totalRaftersWithWaste = ceilWaste(totalRaftersBase, waste);
  const recommendedRafterBoard = chooseBoardLength(totalRafterLength + 1);

  // Ridge
  let ridgeBoards = 0;
  let recommendedRidgeBoard = 12; // Largo de stock por defecto
  if (cfg.ridgeType !== "none") {
    ridgeBoards = ceilWaste(structureLength / recommendedRidgeBoard, waste);
  }

  // Fascia
  const totalEaveLength = structureLength * 2;
  const totalGableLength = totalRafterLength * 4;
  const totalFasciaLength = totalEaveLength + totalGableLength;
  let recommendedFasciaBoard = 12; // Largo de stock por defecto
  const fasciaBoards = ceilWaste(totalFasciaLength / recommendedFasciaBoard, waste);

  // --- 5) CANTIDADES DE CUBIERTA Y SHEATHING ---
  // Sheathing (4x8 sheets = 32 sq ft)
  let sheathingSheets = 0;
  if (cfg.sheathingType !== "none") {
    sheathingSheets = Math.ceil(areaWithWaste / 32);
  }

  // Roofing Panels
  let roofPanels = 0;
  let panelDesc = "";
  if (cfg.roofCovering === "metal") {
    roofPanels = Math.ceil(areaWithWaste / 30);
    panelDesc = t.matMetalPanel || "Metal Panels (3'x10')";
  } else if (cfg.roofCovering === "poly") {
    roofPanels = Math.ceil(areaWithWaste / 16);
    panelDesc = t.matPolyPanel || "Polycarbonate Panels (2'x8')";
  }

  // --- 6) CONSOLIDAR MATERIALES PARA EL JSON ---
  const groupedMaterials = {};
  function addMat(label, qty) {
    if (!groupedMaterials[label]) groupedMaterials[label] = 0;
    groupedMaterials[label] += qty;
  }
  
  addMat(`${cfg.rafterLumber}x${recommendedRafterBoard} (${t.matRafters || "Rafters"})`, totalRaftersWithWaste);
  if (cfg.ridgeType !== "none") addMat(`${cfg.ridgeLumber}x${recommendedRidgeBoard} (${t.matRidge || "Ridge"})`, ridgeBoards);
  addMat(`${cfg.fasciaLumber}x${recommendedFasciaBoard} (${t.matFascia || "Fascia"})`, fasciaBoards);
  
  if (cfg.sheathingType !== "none") {
    addMat(t.matOsb || `4x8 OSB / Plywood`, sheathingSheets);
  }
  
  if (cfg.roofCovering !== "none") {
    addMat(`${panelDesc}`, roofPanels);
  }

  // --- 7) COSTOS DETALLADOS ---
  const rafterPrice = typeof getLumberPrice === "function" ? getLumberPrice(cfg.rafterLumber, recommendedRafterBoard) : 0;
  const ridgePrice = typeof getLumberPrice === "function" ? getLumberPrice(cfg.ridgeLumber, recommendedRidgeBoard) : 0;
  const fasciaPrice = typeof getLumberPrice === "function" ? getLumberPrice(cfg.fasciaLumber, recommendedFasciaBoard) : 0;
  const plywoodPrice = typeof getSheetPrice === "function" ? getSheetPrice('plywood') : 0;
  
  const coverPrice = typeof getSheetPrice === "function" ? (cfg.roofCovering === "metal" ? getSheetPrice('metalSheet') : getSheetPrice('polySheet')) : 0;

  const raftersCost = totalRaftersWithWaste * rafterPrice;
  const ridgeCost = ridgeBoards * ridgePrice;
  const fasciaCost = fasciaBoards * fasciaPrice;
  const sheathingCost = sheathingSheets * plywoodPrice;
  const roofingPanelsCost = roofPanels * coverPrice;

  const subtotal = raftersCost + ridgeCost + fasciaCost + sheathingCost + roofingPanelsCost;
  const taxRate = typeof getTaxRate === "function" ? getTaxRate() : 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  // Texto traducido de Ridge Type para resultados
  let ridgeTypeStr = t.valRidgeNone || "None";
  if (cfg.ridgeType === "single") ridgeTypeStr = t.valRidgeSingle || "Single Board";
  if (cfg.ridgeType === "double") ridgeTypeStr = t.valRidgeDouble || "Double Board";

  // --- 8) DOM OUTPUT: RESULTADOS DETALLADOS EN PANTALLA ---
  const res = $("resultsContent");
  if (res) {
    res.innerHTML = `
      <div class="results-grid">
        <div class="result-box">
          <h3>${t.resRoofSummary || "Gable Roof Summary"}</h3>
          <ul>
            <li><strong>${t.lblSpan || "Span:"}</strong> ${span}'</li>
            <li><strong>${t.lblStructLength || "Structure Length:"}</strong> ${structureLength}'</li>
            <li><strong>${t.lblOverhang || "Overhang:"}</strong> ${overhang}"</li>
            <li><strong>${t.lblPitch || "Pitch:"}</strong> ${pitch}/12</li>
            <li><strong>${t.lblRafterSpacing || "Rafter Spacing:"}</strong> ${rafterSpacing}" O.C.</li>
          </ul>
        </div>

        <div class="result-box">
          <h3>${t.resGeom || "Geometry"}</h3>
          <ul>
            <li><strong>${t.resRafterLineal || "Rafter Lineal Feet:"}</strong> ${round2(rafterLinealFeet)}'</li>
            <li><strong>${t.resOverhangSlope || "Overhang Slope Feet:"}</strong> ${round2(overhangSlopeFeet)}'</li>
            <li><strong>${t.resTotalRafterLen || "Total Rafter Length:"}</strong> ${round2(totalRafterLength)}' (${inchesToFeetInches(totalRafterLength*12)})</li>
            <li><strong>${t.resRoofAreaSide || "Roof Area Single Side:"}</strong> ${round2(roofAreaSingleSide)} sq ft</li>
            <li><strong>${t.resTotalRoofArea || "Total Roof Area:"}</strong> ${round2(totalRoofArea)} sq ft</li>
          </ul>
        </div>

        <div class="result-box">
          <h3>${t.resFramingSum || "Framing Summary"}</h3>
          <ul>
            <li><strong>${t.resRaftersPerSide || "Rafters Per Side:"}</strong> ${raftersPerSide}</li>
            <li><strong>${t.resTotalRafters || "Total Rafters:"}</strong> ${totalRaftersBase}</li>
            <li><strong>${t.resTotalRaftersWaste || "Total Rafters w/ Waste:"}</strong> ${totalRaftersWithWaste}</li>
            <li><strong>${t.resRidgeType || "Ridge Type:"}</strong> ${ridgeTypeStr}</li>
            <li><strong>${t.resRidgeBoards || "Ridge Boards needed:"}</strong> ${ridgeBoards}</li>
            <li><strong>${t.resFasciaBoards || "Fascia Boards needed:"}</strong> ${fasciaBoards}</li>
          </ul>
        </div>

        <div class="result-box">
          <h3>${t.resEstMaterials || "Estimated Materials"}</h3>
          <p style="font-size: 0.9em; color: var(--muted); margin-top: -10px; margin-bottom: 15px;">
            ${t.resQtyWaste || "Quantity + % Waste"}
          </p>
          <ul>
            ${Object.entries(groupedMaterials)
              .map(([label, qty]) => `<li><strong>${qty}</strong> × ${label}</li>`)
              .join("") || `<li>${t.resNoMaterials || "No materials calculated."}</li>`}
          </ul>
        </div>

        <div class="result-box">
          <h3>${t.resEstCost || "Estimated Cost"}</h3>
          <ul>
            <li><strong>${t.resCostRafters || "Rafters:"}</strong> ${formatMoney(raftersCost)}</li>
            <li><strong>${t.resCostRidge || "Ridge Boards:"}</strong> ${formatMoney(ridgeCost)}</li>
            <li><strong>${t.resCostFascia || "Fascia Boards:"}</strong> ${formatMoney(fasciaCost)}</li>
            <li><strong>${t.resCostSheathing || "Sheathing Sheets:"}</strong> ${formatMoney(sheathingCost)}</li>
            <li><strong>${t.resCostPanels || "Roofing Panels:"}</strong> ${formatMoney(roofingPanelsCost)}</li>
            <hr />
            <li><strong>${t.resSubtotal || "Subtotal:"}</strong> ${formatMoney(subtotal)}</li>
            <li><strong>${t.resTax || "Tax"} (${round2(taxRate)}%):</strong> ${formatMoney(taxAmount)}</li>
            <li><strong>${t.resTotal || "Total:"}</strong> ${formatMoney(total)}</li>
          </ul>
        </div>

        <div class="result-box">
          <h3>${t.resCutNotes || "Cut Guide & Notes"}</h3>
          <ul>
            <li><strong>${t.resRafterCutLen || "Rafter Cut Length:"}</strong> ${round2(totalRafterLength*12)}"</li>
            <li><strong>${t.resRafterBuyLen || "Rafter Board Length to Buy:"}</strong> ${recommendedRafterBoard}'</li>
            <li><strong>${t.resHeaderGuide || "Header Size Guide:"}</strong> ${t.valHeaderGuide || "(Rough guide: 2x6 for 2x4 walls, 2x8 for 2x6 walls)"}</li>
            <li class="price-note">${t.noteVerify || "Verify actual dimensions, spans, structural requirements, and local code before building."}</li>
          </ul>
        </div>
      </div>
    `;
  }

  // --- 9) DOM OUTPUT: PRINT SHEET ---
  const d = new Date();
  const printDate = $("printDate");
  if (printDate) printDate.textContent = `${t.printEstimateDate || "Estimate Date:"} ${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;

  const printRoofInfo = $("printRoofInfo");
  if (printRoofInfo) {
    printRoofInfo.innerHTML = `
      <p><strong>${t.lblSpan || "Span:"}</strong> ${span}'</p>
      <p><strong>${t.lblStructLength || "Structure Length:"}</strong> ${structureLength}'</p>
      <p><strong>${t.lblPitch || "Pitch:"}</strong> ${pitch}/12</p>
      <p><strong>${t.lblOverhang || "Overhang:"}</strong> ${overhang}"</p>
      <p><strong>${t.lblRafterSpacing || "Rafter Spacing:"}</strong> ${rafterSpacing}" O.C.</p>
    `;
  }

  const printFraming = $("printFraming");
  if (printFraming) {
    printFraming.innerHTML = `
      <p><strong>${t.resTotalRoofArea || "Total Area:"}</strong> ${round2(totalRoofArea)} sq ft</p>
      <p><strong>${t.resTotalRaftersWaste || "Total Rafters:"}</strong> ${totalRaftersWithWaste}</p>
      <p><strong>${t.resRafterCutLen || "Rafter Cut Length:"}</strong> ${round2(totalRafterLength*12)}"</p>
      <p><strong>${t.resRafterBuyLen || "Rafter Board Length:"}</strong> ${recommendedRafterBoard}'</p>
    `;
  }

  const printMaterials = $("printMaterials");
  if (printMaterials) {
    printMaterials.innerHTML = `
      ${Object.entries(groupedMaterials)
        .map(([label, qty]) => `<p><strong>${qty}</strong> × ${label}</p>`)
        .join("")}
    `;
  }

  const printRoofCosts = $("printCosts"); 
  if (printRoofCosts) {
    printRoofCosts.innerHTML = `
      <p><strong>${t.resCostRafters || "Rafters:"}</strong> ${formatMoney(raftersCost)}</p>
      <p><strong>${t.resCostRidge || "Ridge Boards:"}</strong> ${formatMoney(ridgeCost)}</p>
      <p><strong>${t.resCostFascia || "Fascia Boards:"}</strong> ${formatMoney(fasciaCost)}</p>
      <p><strong>${t.resCostSheathing || "Sheathing Sheets:"}</strong> ${formatMoney(sheathingCost)}</p>
      <p><strong>${t.resCostPanels || "Roofing Panels:"}</strong> ${formatMoney(roofingPanelsCost)}</p>
      <hr />
      <p><strong>${t.resSubtotal || "Subtotal:"}</strong> ${formatMoney(subtotal)}</p>
      <p><strong>${t.resTax || "Tax"}:</strong> ${formatMoney(taxAmount)}</p>
      <p><strong>${t.resTotal || "Total:"}</strong> ${formatMoney(total)}</p>
    `;
  }
}

// --- INICIALIZACIÓN ---
document.addEventListener("DOMContentLoaded", () => {
  const calcBtn = $("calculateBtn");
  if (calcBtn) calcBtn.addEventListener("click", calculateRoof);

  const printBtn = $("printBtn");
  if (printBtn) {
    printBtn.addEventListener("click", () => window.print());
  }
});