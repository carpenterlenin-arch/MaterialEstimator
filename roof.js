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

// --- CARPENTER FRACTIONAL FORMAT HELPERS ---
// Convert a decimal number of inches into a fraction string like "13 3/4"
function decimalToFraction(decimalInches) {
  // Round to nearest 1/16
  const sixteenths = Math.round(decimalInches * 16);
  const whole = Math.floor(sixteenths / 16);
  const remainder = sixteenths % 16;

  const fracMap = {
    1: "1/16", 2: "1/8",  3: "3/16", 4: "1/4",
    5: "5/16", 6: "3/8",  7: "7/16", 8: "1/2",
    9: "9/16", 10: "5/8", 11: "11/16", 12: "3/4",
    13: "13/16", 14: "7/8", 15: "15/16"
  };

  if (remainder === 0) return whole > 0 ? `${whole}` : `0`;
  const frac = fracMap[remainder] || "";
  return whole > 0 ? `${whole} ${frac}` : frac;
}

// Convert decimal feet to carpenter format: 88 1/2" (7' - 4 1/2")
function toCarpenterFormat(totalFeet) {
  const totalInches = totalFeet * 12;
  // Round to nearest 1/16 for the feet/inches split
  const sixteenthsTotal = Math.round(totalInches * 16);
  const feet = Math.floor(sixteenthsTotal / (16 * 12));
  const remainSixteenths = sixteenthsTotal - feet * 16 * 12;
  const remainInches = remainSixteenths / 16;

  const totalStr = decimalToFraction(totalInches) + '"';
  const feetStr = `${feet}' - ${decimalToFraction(remainInches)}"`;
  return `${totalStr} (${feetStr})`;
}

// Legacy — kept for any external callers (not used in display anymore)
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

  // Full horizontal run — used for AREA calculations (never modified)
  const run = span / 2;
  const pitchDecimal = pitch / 12;
  const rafterSlopeMultiplier = Math.sqrt(1 + pitchDecimal * pitchDecimal);

  // --- RIDGE BOARD THICKNESS DEDUCTION ---
  // Each rafter's horizontal run must be shortened by HALF the ridge board total thickness
  // so the two opposing rafters seat against the ridge board without gaps or overlap.
  //
  // Single ridge board: one 2x board  -> actual thickness 1.5"  -> deduction per rafter: 0.75"
  // Double ridge board: two 2x boards -> actual thickness 3.0"  -> deduction per rafter: 1.5"
  // No ridge board:                   -> thickness 0"           -> deduction per rafter: 0"
  //
  // Formula: adjustedRun = (span / 2) - (ridgeTotalThickness / 2)
  //
  // This deduction applies to the RAFTER CUT LENGTH only.
  // Roof AREA calculations continue to use the full unadjusted run.
  const ridgeThicknessMap = { none: 0, single: 1.5, double: 3.0 };
  const ridgeActualThicknessInches = ridgeThicknessMap[cfg.ridgeType] ?? 0;
  const ridgeHalfThicknessInches = ridgeActualThicknessInches / 2;
  const ridgeHalfThicknessFeet = ridgeHalfThicknessInches / 12;

  // Adjusted run used exclusively for rafter cut length
  const adjustedRun = run - ridgeHalfThicknessFeet;

  // --- SLOPE LENGTHS ---
  // rafterLinealFeet    → full run  → used for AREA calculations only
  // rafterCutLinealFeet → adjusted run → used for CUT LENGTH and board purchase
  const rafterLinealFeet = run * rafterSlopeMultiplier;
  const rafterCutLinealFeet = adjustedRun * rafterSlopeMultiplier;
  const overhangSlopeFeet = (overhang / 12) * rafterSlopeMultiplier;

  // Total length for AREA (full run, no ridge deduction)
  const totalRafterLength = rafterLinealFeet + overhangSlopeFeet;

  // Total CUT LENGTH — this is what you measure and cut on the physical board
  const totalRafterCutLength = rafterCutLinealFeet + overhangSlopeFeet;

  // --- AREAS (always based on full run / totalRafterLength) ---
  const roofAreaSingleSide = totalRafterLength * structureLength;
  const totalRoofArea = roofAreaSingleSide * 2;
  const areaWithWaste = totalRoofArea * (1 + waste / 100);

  // --- DERIVED DISPLAY VALUES ---
  const roofRise = run * pitchDecimal;  // peak rise in feet (horizontal run × pitch/12)
  const ridgeLength = structureLength;  // ridge board runs the full structure length

  // --- 4) CANTIDADES DE FRAMING ---
  // Rafters — board purchase uses the actual CUT LENGTH (with ridge deduction + 0.5 ft buffer)
  const rafterSpacingFeet = rafterSpacing / 12;
  const raftersPerSide = Math.ceil(structureLength / rafterSpacingFeet) + 1;
  const totalRaftersBase = raftersPerSide * 2;
  const totalRaftersWithWaste = ceilWaste(totalRaftersBase, waste);
  const recommendedRafterBoard = chooseBoardLength(totalRafterCutLength + 0.5);

  // Ridge
  let ridgeBoards = 0;
  let recommendedRidgeBoard = 12;
  if (cfg.ridgeType !== "none") {
    ridgeBoards = ceilWaste(structureLength / recommendedRidgeBoard, waste);
  }

  // Fascia
  const totalEaveLength = structureLength * 2;
  const totalGableLength = totalRafterLength * 4;
  const totalFasciaLength = totalEaveLength + totalGableLength;
  let recommendedFasciaBoard = 12;
  const fasciaBoards = ceilWaste(totalFasciaLength / recommendedFasciaBoard, waste);

  // --- 5) CANTIDADES DE CUBIERTA Y SHEATHING ---
  // Sheathing (4x8 sheets = 32 sq ft)
  let sheathingSheets = 0;
  let sheathingNoWaste = 0;
  if (cfg.sheathingType !== "none") {
    sheathingSheets = Math.ceil(areaWithWaste / 32);
    sheathingNoWaste = Math.ceil(totalRoofArea / 32);
  }

  // Roofing Panels
  let roofPanels = 0;
  let roofPanelsNoWaste = 0;
  let panelDesc = "";
  if (cfg.roofCovering === "metal") {
    roofPanels = Math.ceil(areaWithWaste / 30);
    roofPanelsNoWaste = Math.ceil(totalRoofArea / 30);
    panelDesc = t.matMetalPanel || "Metal Panels (3'x10')";
  } else if (cfg.roofCovering === "poly") {
    roofPanels = Math.ceil(areaWithWaste / 16);
    roofPanelsNoWaste = Math.ceil(totalRoofArea / 16);
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

  // Ridge deduction display — shows the actual deduction value and its reason
  const ridgeDeductionDisplay = cfg.ridgeType !== "none"
    ? `${decimalToFraction(ridgeHalfThicknessInches)}" (${t.resRidgeDeductionNote || "half of 1\u00bd\" ridge board"})`
    : `0" (${t.resRidgeDeductionNone || "no ridge board"})`;

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
            <li><strong>${t.resRoofRun || "Roof Run (full):"}</strong> ${toCarpenterFormat(run)}</li>
            <li><strong>${t.resRoofRise || "Roof Rise:"}</strong> ${toCarpenterFormat(roofRise)}</li>
            <li><strong>${t.resRidgeDeduction || "Ridge Deduction (\u00bd thickness):"}</strong> ${ridgeDeductionDisplay}</li>
            <li><strong>${t.resAdjustedRun || "Adjusted Rafter Run (after deduction):"}</strong> ${toCarpenterFormat(adjustedRun)}</li>
            <li><strong>${t.resRafterCutLineal || "Rafter Cut Length (no overhang):"}</strong> ${toCarpenterFormat(rafterCutLinealFeet)}</li>
            <li><strong>${t.resOverhangSlope || "Overhang Length (slope):"}</strong> ${toCarpenterFormat(overhangSlopeFeet)}</li>
            <li><strong>${t.resTotalRafterCutLen || "Total Rafter Cut Length (w/ overhang):"}</strong> ${toCarpenterFormat(totalRafterCutLength)}</li>
            <li><strong>${t.resBirdsmouth || "Birdsmouth Location (from ridge end, along slope):"}</strong> ${toCarpenterFormat(rafterCutLinealFeet)}</li>
            <li><strong>${t.resRidgeLength || "Ridge Length:"}</strong> ${toCarpenterFormat(ridgeLength)}</li>
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
            ${cfg.sheathingType !== "none" ? `<li><strong>${t.resSheathingNoWaste || "Sheathing Panels (no waste):"}</strong> ${sheathingNoWaste} sheets (4\u00d78)</li>` : ""}
            ${cfg.roofCovering !== "none" ? `<li><strong>${t.resRoofPanelsNoWaste || "Roofing Sheets (no waste):"}</strong> ${roofPanelsNoWaste} \u2014 ${panelDesc}</li>` : ""}
          </ul>
        </div>

        <div class="result-box">
          <h3>${t.resEstMaterials || "Estimated Materials"}</h3>
          <p style="font-size: 0.9em; color: var(--muted); margin-top: -10px; margin-bottom: 15px;">
            ${t.resQtyWaste || "Quantity + % Waste"}
          </p>
          <ul>
            ${Object.entries(groupedMaterials)
              .map(([label, qty]) => `<li><strong>${qty}</strong> \u00d7 ${label}</li>`)
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
            <li><strong>${t.resRafterCutLen || "Rafter Cut Length:"}</strong> ${toCarpenterFormat(totalRafterCutLength)}</li>
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
      <p><strong>${t.resRidgeDeduction || "Ridge Deduction:"}</strong> ${ridgeDeductionDisplay}</p>
      <p><strong>${t.resRafterCutLen || "Rafter Cut Length:"}</strong> ${toCarpenterFormat(totalRafterCutLength)}</p>
      <p><strong>${t.resRafterBuyLen || "Rafter Board Length:"}</strong> ${recommendedRafterBoard}'</p>
      ${cfg.sheathingType !== "none" ? `<p><strong>${t.resSheathingNoWaste || "Sheathing (no waste):"}</strong> ${sheathingNoWaste} sheets</p>` : ""}
      ${cfg.roofCovering !== "none" ? `<p><strong>${t.resRoofPanelsNoWaste || "Roofing (no waste):"}</strong> ${roofPanelsNoWaste} panels</p>` : ""}
    `;
  }

  const printMaterials = $("printMaterials");
  if (printMaterials) {
    printMaterials.innerHTML = `
      ${Object.entries(groupedMaterials)
        .map(([label, qty]) => `<p><strong>${qty}</strong> \u00d7 ${label}</p>`)
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
