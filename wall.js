const $ = (id) => document.getElementById(id);

/**
 * Convierte pulgadas decimales al formato: 97 3/4" (8' - 1 3/4")
 */
function formatToFraction(totalInches) {
  if (!totalInches || totalInches <= 0) return '0"';

  // Función interna para obtener la fracción
  const getFraction = (decimal) => {
    const sixteenths = Math.round(decimal * 16);
    if (sixteenths === 0) return "";
    if (sixteenths === 16) return " 1";
    
    // Simplificar fracción
    let num = sixteenths;
    let den = 16;
    while (num % 2 === 0 && den % 2 === 0) {
      num /= 2;
      den /= 2;
    }
    return ` ${num}/${den}`;
  };

  // 1. Calcular total en pulgadas con fracción
  const wholeInches = Math.floor(totalInches);
  const fractionInches = getFraction(totalInches - wholeInches);
  const totalStr = `${wholeInches}${fractionInches}"`;

  // 2. Calcular desglose en Pies y Pulgadas
  const feet = Math.floor(totalInches / 12);
  const remainingInches = totalInches % 12;
  const wholeRemInches = Math.floor(remainingInches);
  const fractionRemInches = getFraction(remainingInches - wholeRemInches);
  
  const feetStr = `${feet}' - ${wholeRemInches}${fractionRemInches}"`;

  return `${totalStr} (${feetStr})`;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function ceilWaste(qty, wastePercent) {
  return Math.ceil(qty * (1 + wastePercent / 100));
}

function formatMoney(n) {
  return `$${(n || 0).toFixed(2)}`;
}

// function inchesToFeetInches(inches) {
//   const total = round2(inches);
//   const feet = Math.floor(total / 12);
//   const rem = round2(total - feet * 12);
//   return `${feet}' - ${rem}"`;
// }

// Reemplaza tu función actual por esta:
function inchesToFeetInches(inches) {
  return formatToFraction(inches);
}

function getWallConfig() {
  const wallType = $("wallType")?.value || "load";
  const studSize = $("studSize")?.value || "2x4";
  const wallLengthFt = parseFloat($("wallLength")?.value) || 0;
  const wallLengthIn = wallLengthFt * 12;
  const studSpacing = parseFloat($("studSpacing")?.value) || 16;

  const heightMode = $("heightMode")?.value || "standard8";
  const customRoughHeight = parseFloat($("wallHeight")?.value) || 97.125;

  const topPlates = parseInt($("topPlates")?.value) || 2;
  const bottomPlates = parseInt($("bottomPlates")?.value) || 1;
  const ptBottomPlate = $("ptBottomPlate")?.value || "no";
  const californiaCorners = parseInt($("californiaCorners")?.value) || 0;
  const wastePercent = parseFloat($("wastePercent")?.value) || 0;

  const doorCount = parseInt($("doorCount")?.value) || 0;
  const doorWidth = parseFloat($("doorWidth")?.value) || 0;
  const doorHeight = parseFloat($("doorHeight")?.value) || 0;

  const windowCount = parseInt($("windowCount")?.value) || 0;
  const windowWidth = parseFloat($("windowWidth")?.value) || 0;
  const windowHeight = parseFloat($("windowHeight")?.value) || 0;

  const side1Cover = $("side1Cover")?.value || "none";
  const side2Cover = $("side2Cover")?.value || "none";

  let roughWallHeight;
  if (heightMode === "standard8") {
    roughWallHeight = 97.125;
  } else if (heightMode === "standard9") {
    roughWallHeight = 109.125;
  } else {
    roughWallHeight = customRoughHeight;
  }

  const studLength = roughWallHeight - ((topPlates + bottomPlates) * 1.5);

  return {
    wallType,
    studSize,
    wallLengthFt,
    wallLengthIn,
    studSpacing,
    roughWallHeight,
    studLength,
    topPlates,
    bottomPlates,
    ptBottomPlate,
    californiaCorners,
    wastePercent,
    doorCount,
    doorWidth,
    doorHeight,
    windowCount,
    windowWidth,
    windowHeight,
    side1Cover,
    side2Cover
  };
}

function chooseStockLength(requiredInches) {
  const ft = requiredInches / 12;
  if (ft <= 8) return 8;
  if (ft <= 10) return 10;
  if (ft <= 12) return 12;
  return Math.ceil(ft);
}

function addMaterial(grouped, label, qty) {
  if (!qty || qty <= 0) return;
  grouped[label] = (grouped[label] || 0) + qty;
}

function calculateWall() {
  const cfg = getWallConfig();
  
  // OBTENER LENGUAJE ACTIVO PARA RESULTADOS
  const lang = localStorage.getItem('prefLang') || 'es';
  const t = (typeof translations !== 'undefined' && translations[lang]) ? translations[lang] : translations['en'];

  if (cfg.wallLengthFt <= 0 || cfg.roughWallHeight <= 0 || cfg.studLength <= 0) {
    $("resultsContent").innerHTML = `<p>${t.errDimensions || "Please enter valid wall dimensions."}</p>`;
    return;
  }

  // =========================
  // BASIC STUD COUNT
  // =========================
  const studSpaces = Math.ceil(cfg.wallLengthIn / cfg.studSpacing);
  const regularStudsBase = studSpaces + 1;

  const cornerStuds = cfg.californiaCorners;

  // =========================
  // OPENINGS
  // =========================
  const doorROWidth = cfg.doorWidth > 0 ? cfg.doorWidth + 2 : 0;
  const windowROWidth = cfg.windowWidth > 0 ? cfg.windowWidth + 2 : 0;

  const kingStuds = (cfg.doorCount * 2) + (cfg.windowCount * 2);
  const jackStuds = (cfg.doorCount * 2) + (cfg.windowCount * 2);

  const headerCount = cfg.doorCount + cfg.windowCount;

  const cripplePerDoor = cfg.doorWidth > 0 ? Math.max(0, Math.floor(doorROWidth / cfg.studSpacing) - 1) : 0;
  const cripplePerWindowTop = cfg.windowWidth > 0 ? Math.max(0, Math.floor(windowROWidth / cfg.studSpacing) - 1) : 0;
  const cripplePerWindowBottom = cfg.windowWidth > 0 ? Math.max(0, Math.floor(windowROWidth / cfg.studSpacing) - 1) : 0;

  const crippleStuds =
    (cfg.doorCount * cripplePerDoor) +
    (cfg.windowCount * cripplePerWindowTop) +
    (cfg.windowCount * cripplePerWindowBottom);

  const studsRemovedForDoors = cfg.doorCount * Math.max(0, Math.floor(doorROWidth / cfg.studSpacing));
  const studsRemovedForWindows = cfg.windowCount * Math.max(0, Math.floor(windowROWidth / cfg.studSpacing));

  let regularStudsNet = regularStudsBase - studsRemovedForDoors - studsRemovedForWindows;
  if (regularStudsNet < 2) regularStudsNet = 2;

  const totalFullStuds = regularStudsNet + cornerStuds + kingStuds;

  // =========================
  // CUT LENGTHS
  // =========================
  const fullStudLength = cfg.studLength;
  const jackStudLength = cfg.doorHeight > 0 ? Math.max(0, cfg.doorHeight + 1.5) : 0;

  const assumedWindowSillHeight = 36;
  const sillLength = cfg.windowWidth > 0 ? cfg.windowWidth + 2 : 0;
  const sillCount = cfg.windowCount;

  const windowBottomCrippleLength = cfg.windowCount > 0 ? Math.max(0, assumedWindowSillHeight - 1.5) : 0;
  const windowTopCrippleLength = cfg.windowCount > 0
    ? Math.max(0, cfg.roughWallHeight - (cfg.windowHeight + assumedWindowSillHeight + 4.5))
    : 0;
  const doorCrippleLength = cfg.doorCount > 0
    ? Math.max(0, cfg.roughWallHeight - (cfg.doorHeight + 4.5))
    : 0;

  // =========================
  // PLATES
  // =========================
  const totalPlateRuns = cfg.topPlates + cfg.bottomPlates;
  const totalPlateLF = cfg.wallLengthFt * totalPlateRuns;

  const plateStockLength = cfg.wallLengthFt <= 8 ? 8 : (cfg.wallLengthFt <= 10 ? 10 : 12);
  const totalPlateBoards = Math.ceil(totalPlateLF / plateStockLength);

  const ptBottomPlateBoards =
    cfg.ptBottomPlate === "yes"
      ? Math.ceil((cfg.wallLengthFt * cfg.bottomPlates) / plateStockLength)
      : 0;

  const standardPlateBoards = Math.max(0, totalPlateBoards - ptBottomPlateBoards);

  // =========================
  // HEADERS
  // =========================
  const headerLengths = [];

  for (let i = 0; i < cfg.doorCount; i++) {
    headerLengths.push(cfg.doorWidth + 3);
  }

  for (let i = 0; i < cfg.windowCount; i++) {
    headerLengths.push(cfg.windowWidth + 3);
  }

  const totalHeaderInches = headerLengths.reduce((a, b) => a + b, 0) * 2;
  const headerBoards = totalHeaderInches > 0 ? Math.ceil(totalHeaderInches / (plateStockLength * 12)) : 0;

  // Header size guide (rough)
  let headerSize = "2x6";
  if (cfg.studSize === "2x4") headerSize = "2x6";
  if (cfg.studSize === "2x6") headerSize = "2x8";

  // =========================
  // SHEATHING / DRYWALL
  // =========================
  const wallArea = cfg.wallLengthFt * (cfg.roughWallHeight / 12);
  const doorArea = cfg.doorCount * ((cfg.doorWidth / 12) * (cfg.doorHeight / 12));
  const windowArea = cfg.windowCount * ((cfg.windowWidth / 12) * (cfg.windowHeight / 12));
  const netArea = Math.max(0, wallArea - doorArea - windowArea);

  let plywoodSheets = 0;
  let drywallSheets = 0;

  [cfg.side1Cover, cfg.side2Cover].forEach(side => {
    if (side === "plywood") plywoodSheets += Math.ceil(netArea / 32);
    if (side === "drywall") drywallSheets += Math.ceil(netArea / 32);
  });

  plywoodSheets = ceilWaste(plywoodSheets, cfg.wastePercent);
  drywallSheets = ceilWaste(drywallSheets, cfg.wastePercent);

  // =========================
  // APPLY WASTE
  // =========================
  const totalFullStudsWithWaste = ceilWaste(totalFullStuds, cfg.wastePercent);
  const jackStudsWithWaste = ceilWaste(jackStuds, cfg.wastePercent);
  const crippleStudsWithWaste = ceilWaste(crippleStuds, cfg.wastePercent);
  const sillCountWithWaste = ceilWaste(sillCount, cfg.wastePercent);
  const standardPlateBoardsWithWaste = ceilWaste(standardPlateBoards, cfg.wastePercent);
  const ptBottomPlateBoardsWithWaste = ceilWaste(ptBottomPlateBoards, cfg.wastePercent);
  const headerBoardsWithWaste = ceilWaste(headerBoards, cfg.wastePercent);

  // =========================
  // STOCK LENGTHS
  // =========================
  const fullStudStock = chooseStockLength(fullStudLength);
  const jackStudStock = jackStudLength > 0 ? chooseStockLength(jackStudLength) : 8;
  const crippleStock = chooseStockLength(
    Math.max(windowBottomCrippleLength, windowTopCrippleLength, doorCrippleLength, 12)
  );
  const sillStock = sillLength > 0 ? chooseStockLength(Math.max(sillLength, 12)) : 8;

  // =========================
  // PRICES
  // =========================
  const fullStudPrice = getLumberPrice(cfg.studSize, fullStudStock);
  const jackStudPrice = getLumberPrice(cfg.studSize, jackStudStock);
  const cripplePrice = getLumberPrice(cfg.studSize, crippleStock);
  const sillPrice = getLumberPrice(cfg.studSize, sillStock);
  const platePrice = getLumberPrice(cfg.studSize, plateStockLength);
  const headerPrice = getLumberPrice(headerSize, plateStockLength);

  const fullStudCost = totalFullStudsWithWaste * fullStudPrice;
  const jackStudCost = jackStudsWithWaste * jackStudPrice;
  const crippleCost = crippleStudsWithWaste * cripplePrice;
  const sillCost = sillCountWithWaste * sillPrice;
  const standardPlateCost = standardPlateBoardsWithWaste * platePrice;
  const ptBottomPlateCost = ptBottomPlateBoardsWithWaste * platePrice;
  const headerCost = headerBoardsWithWaste * headerPrice;

  const plywoodCost = plywoodSheets * getSheetPrice("plywood");
  const drywallCost = drywallSheets * getSheetPrice("drywall");

  const subtotal =
    fullStudCost +
    jackStudCost +
    crippleCost +
    sillCost +
    standardPlateCost +
    ptBottomPlateCost +
    headerCost +
    plywoodCost +
    drywallCost;

  const taxRate = getTaxRate();
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  // =========================
  // GROUPED MATERIALS
  // =========================
  const groupedMaterials = {};

  addMaterial(groupedMaterials, `${cfg.studSize}x${fullStudStock} (${t.matFull || "Full Studs + King Studs"})`, totalFullStudsWithWaste);
  addMaterial(groupedMaterials, `${cfg.studSize}x${jackStudStock} (${t.matJack || "Jack Studs"})`, jackStudsWithWaste);
  addMaterial(groupedMaterials, `${cfg.studSize}x${crippleStock} (${t.matCrip || "Cripple Studs"})`, crippleStudsWithWaste);
  addMaterial(groupedMaterials, `${cfg.studSize}x${sillStock} (${t.matSill || "Window Sills"})`, sillCountWithWaste);
  addMaterial(groupedMaterials, `${cfg.studSize}x${plateStockLength} (${t.matPlate || "Standard Plates"})`, standardPlateBoardsWithWaste);
  addMaterial(groupedMaterials, `${cfg.studSize}x${plateStockLength} (${t.matPtPlate || "PT Bottom Plate"})`, ptBottomPlateBoardsWithWaste);
  addMaterial(groupedMaterials, `${headerSize}x${plateStockLength} (${t.matHeader || "Header Stock"})`, headerBoardsWithWaste);
  addMaterial(groupedMaterials, `4x8 Plywood / OSB`, plywoodSheets);
  addMaterial(groupedMaterials, `4x8 Drywall`, drywallSheets);

  const materialsHtml = Object.entries(groupedMaterials)
    .map(([label, qty]) => `<li><strong>${qty}</strong> × ${label}</li>`)
    .join("");

  // =========================
  // RESULTS HTML
  // =========================
  $("resultsContent").innerHTML = `
    <div class="results-grid">
      <div class="result-box">
        <h3>${t.resWallSummary || "Wall Summary"}</h3>
        <ul>
          <li><strong>${t.resWallType || "Wall Type:"}</strong> ${cfg.wallType === "load" ? (t.optLoad || "Load Bearing") : (t.optNonLoad || "Non-Load Bearing")}</li>
          <li><strong>${t.resStudSize || "Stud Size:"}</strong> ${cfg.studSize}</li>
          <li><strong>${t.resWallLength || "Wall Length:"}</strong> ${cfg.wallLengthFt}'</li>
          <li><strong>${t.resRoughHeight || "Rough Wall Height:"}</strong> ${inchesToFeetInches(cfg.roughWallHeight)}</li>
          <li><strong>${t.resCutLength || "Cut Stud Length:"}</strong> ${inchesToFeetInches(fullStudLength)}</li>
          <li><strong>${t.resStudSpacing || "Stud Spacing:"}</strong> ${cfg.studSpacing}" O.C.</li>
        </ul>
      </div>

      <div class="result-box">
        <h3>${t.resFramingCount || "Framing Count"}</h3>
        <ul>
          <li><strong>${t.resRegStuds || "Regular Studs:"}</strong> ${regularStudsNet}</li>
          <li><strong>${t.resKingStuds || "King Studs:"}</strong> ${kingStuds}</li>
          <li><strong>${t.resJackStuds || "Jack Studs:"}</strong> ${jackStuds}</li>
          <li><strong>${t.resCripStuds || "Cripple Studs:"}</strong> ${crippleStuds}</li>
          <li><strong>${t.resCornerStuds || "Corner Studs:"}</strong> ${cornerStuds}</li>
          <li><strong>${t.resTotalFull || "Total Full Studs:"}</strong> ${totalFullStuds}</li>
          <li><strong>${t.resTotalFullWaste || "Total Full Studs w/ Waste:"}</strong> ${totalFullStudsWithWaste}</li>
          <li><strong>${t.resHeadersPcs || "Header Pieces:"}</strong> ${headerCount}</li>
        </ul>
      </div>

      <div class="result-box">
        <h3>${t.resEstMaterials || "Estimated Materials"}</h3>
        <p style="font-size: 0.9em; color: var(--muted); margin-top: -10px; margin-bottom: 15px;">
          ${t.resQtyWaste || "Quantity + % Waste"}
        </p>
        <ul>
          ${materialsHtml || `<li>${t.resNoMaterials || "No materials calculated."}</li>`}
        </ul>
      </div>

      <div class="result-box">
        <h3>${t.resEstCost || "Estimated Cost"}</h3>
        <ul>
          <li><strong>${t.resCostFull || "Full Studs + Kings:"}</strong> ${formatMoney(fullStudCost)}</li>
          <li><strong>${t.resCostJack || "Jack Studs:"}</strong> ${formatMoney(jackStudCost)}</li>
          <li><strong>${t.resCostCrip || "Cripple Studs:"}</strong> ${formatMoney(crippleCost)}</li>
          <li><strong>${t.resCostSills || "Window Sills:"}</strong> ${formatMoney(sillCost)}</li>
          <li><strong>${t.resCostPlates || "Plates:"}</strong> ${formatMoney(standardPlateCost + ptBottomPlateCost)}</li>
          <li><strong>${t.resCostHeaders || "Headers:"}</strong> ${formatMoney(headerCost)}</li>
          <li><strong>${t.resCostPly || "Plywood / OSB:"}</strong> ${formatMoney(plywoodCost)}</li>
          <li><strong>${t.resCostDry || "Drywall:"}</strong> ${formatMoney(drywallCost)}</li>
          <hr style="border: none; border-top: 1px solid #ccc; margin: 10px 0;" />
          <li><strong>${t.resSubtotal || "Subtotal:"}</strong> ${formatMoney(subtotal)}</li>
          <li><strong>${t.resTax || "Tax"} (${round2(taxRate)}%):</strong> ${formatMoney(taxAmount)}</li>
          <li><strong>${t.resTotal || "Total:"}</strong> ${formatMoney(total)}</li>
        </ul>
      </div>

      <div class="result-box">
        <h3>${t.resCutGuide || "Estimated Cut Guide"}</h3>
        <ul>
          <li><strong>${t.resCutFull || "Full Studs / King Studs:"}</strong> ${inchesToFeetInches(fullStudLength)}</li>
          <li><strong>${t.resCutJack || "Jack Studs:"}</strong> ${inchesToFeetInches(jackStudLength)}</li>
          <li><strong>${t.resCutDoorCrip || "Door Cripples:"}</strong> ${inchesToFeetInches(doorCrippleLength)}</li>
          <li><strong>${t.resCutWinTopCrip || "Window Top Cripples:"}</strong> ${inchesToFeetInches(windowTopCrippleLength)}</li>
          <li><strong>${t.resCutWinBotCrip || "Window Bottom Cripples:"}</strong> ${inchesToFeetInches(windowBottomCrippleLength)}</li>
          <li><strong>${t.resCutWinSill || "Window Sill Length:"}</strong> ${inchesToFeetInches(sillLength)}</li>
          <li><strong>${t.resCutHeadSize || "Header Stock Size:"}</strong> ${headerSize}</li>
        </ul>
      </div>
    </div>
  `;

  // =========================
  // PRINT OUTPUT
  // =========================
  const printDate = $("printDate");
  if (printDate) {
    printDate.textContent = `${t.printEstimateDate || "Estimate Date:"} ${new Date().toLocaleString()}`;
  }

  const printWallInfo = $("printWallInfo");
  if (printWallInfo) {
    printWallInfo.innerHTML = `
      <p><strong>${t.resWallType || "Wall Type:"}</strong> ${cfg.wallType === "load" ? (t.optLoad || "Load Bearing") : (t.optNonLoad || "Non-Load Bearing")}</p>
      <p><strong>${t.resStudSize || "Stud Size:"}</strong> ${cfg.studSize}</p>
      <p><strong>${t.resWallLength || "Wall Length:"}</strong> ${cfg.wallLengthFt}'</p>
      <p><strong>${t.resRoughHeight || "Rough Wall Height:"}</strong> ${inchesToFeetInches(cfg.roughWallHeight)}</p>
      <p><strong>${t.resCutLength || "Cut Stud Length:"}</strong> ${inchesToFeetInches(fullStudLength)}</p>
      <p><strong>${t.resStudSpacing || "Stud Spacing:"}</strong> ${cfg.studSpacing}" O.C.</p>
      <p><strong>${t.printTopPlates || "Top Plates:"}</strong> ${cfg.topPlates}</p>
      <p><strong>${t.printBotPlates || "Bottom Plates:"}</strong> ${cfg.bottomPlates}</p>
    `;
  }

  const printOpenings = $("printOpenings");
  if (printOpenings) {
    printOpenings.innerHTML = `
      <p><strong>${t.printDoors || "Doors:"}</strong> ${cfg.doorCount}</p>
      <p><strong>${t.printDoorSize || "Door Size:"}</strong> ${cfg.doorWidth}" × ${cfg.doorHeight}"</p>
      <p><strong>${t.printWindows || "Windows:"}</strong> ${cfg.windowCount}</p>
      <p><strong>${t.printWindowSize || "Window Size:"}</strong> ${cfg.windowWidth}" × ${cfg.windowHeight}"</p>
    `;
  }

  const printMaterials = $("printMaterials");
  if (printMaterials) {
    printMaterials.innerHTML = `
      <p><strong>${t.resRegStuds || "Regular Studs:"}</strong> ${regularStudsNet}</p>
      <p><strong>${t.resKingStuds || "King Studs:"}</strong> ${kingStuds}</p>
      <p><strong>${t.resJackStuds || "Jack Studs:"}</strong> ${jackStuds}</p>
      <p><strong>${t.resCripStuds || "Cripple Studs:"}</strong> ${crippleStuds}</p>
      <p><strong>${t.resCornerStuds || "Corner Studs:"}</strong> ${cornerStuds}</p>
      <p><strong>${t.printPlySheets || "Plywood / OSB Sheets:"}</strong> ${plywoodSheets}</p>
      <p><strong>${t.printDrySheets || "Drywall Sheets:"}</strong> ${drywallSheets}</p>
      <hr />
      ${Object.entries(groupedMaterials)
        .map(([label, qty]) => `<p><strong>${qty}</strong> × ${label}</p>`)
        .join("")}
    `;
  }

  const printCosts = $("printCosts");
  if (printCosts) {
    printCosts.innerHTML = `
      <p><strong>${t.resCostFull || "Full Studs + Kings:"}</strong> ${formatMoney(fullStudCost)}</p>
      <p><strong>${t.resCostJack || "Jack Studs:"}</strong> ${formatMoney(jackStudCost)}</p>
      <p><strong>${t.resCostCrip || "Cripple Studs:"}</strong> ${formatMoney(crippleCost)}</p>
      <p><strong>${t.resCostSills || "Window Sills:"}</strong> ${formatMoney(sillCost)}</p>
      <p><strong>${t.resCostPlates || "Plates:"}</strong> ${formatMoney(standardPlateCost + ptBottomPlateCost)}</p>
      <p><strong>${t.resCostHeaders || "Headers:"}</strong> ${formatMoney(headerCost)}</p>
      <p><strong>${t.resCostPly || "Plywood / OSB:"}</strong> ${formatMoney(plywoodCost)}</p>
      <p><strong>${t.resCostDry || "Drywall:"}</strong> ${formatMoney(drywallCost)}</p>
      <hr style="border: none; border-top: 1px solid #ccc; margin: 10px 0;" />
      <p><strong>${t.resSubtotal || "Subtotal:"}</strong> ${formatMoney(subtotal)}</p>
      <p><strong>${t.resTax || "Tax"}:</strong> ${formatMoney(taxAmount)}</p>
      <p><strong>${t.resTotal || "Total:"}</strong> ${formatMoney(total)}</p>
    `;
  }
}

function toggleCustomHeight() {
  const mode = $("heightMode")?.value || "standard8";
  const wallHeightInput = $("wallHeight");
  if (wallHeightInput) {
    wallHeightInput.disabled = mode !== "custom";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  toggleCustomHeight();

  $("heightMode")?.addEventListener("change", toggleCustomHeight);
  $("calculateBtn")?.addEventListener("click", calculateWall);
  $("printBtn")?.addEventListener("click", () => window.print());
});