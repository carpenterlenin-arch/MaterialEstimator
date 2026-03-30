const $ = (id) => document.getElementById(id);

// --- UTILIDADES ---
function round2(num) {
  return Math.round(num * 100) / 100;
}

/**
 * Convierte pulgadas decimales al formato: 97 3/4" (8' - 1 3/4")
 */
function formatToFraction(totalInches) {
  if (!totalInches || totalInches <= 0) return '0"';

  const getFraction = (decimal) => {
    const sixteenths = Math.round(decimal * 16);
    if (sixteenths === 0) return "";
    if (sixteenths === 16) return " 1";
    let num = sixteenths;
    let den = 16;
    while (num % 2 === 0 && den % 2 === 0) {
      num /= 2;
      den /= 2;
    }
    return ` ${num}/${den}`;
  };

  let wholeInches = Math.floor(totalInches);
  let fractionInches = getFraction(totalInches - wholeInches);
  
  // Ajuste si la fraccion redondea a 1 pulgada entera
  if (fractionInches === " 1") {
    wholeInches += 1;
    fractionInches = "";
  }
  
  const totalStr = `${wholeInches}${fractionInches}"`;

  const feet = Math.floor(totalInches / 12);
  const remainingInches = totalInches % 12;
  let wholeRemInches = Math.floor(remainingInches);
  let fractionRemInches = getFraction(remainingInches - wholeRemInches);
  
  if (fractionRemInches === " 1") {
    wholeRemInches += 1;
    fractionRemInches = "";
  }

  const feetStr = `${feet}' - ${wholeRemInches}${fractionRemInches}"`;

  return `${totalStr} (${feetStr})`;
}

/**
 * Formatea SOLO en pulgadas (ej. 10 3/4") para medidas pequeñas como huellas y contrahuellas.
 */
function formatInchesOnly(totalInches) {
  if (!totalInches || totalInches <= 0) return '0"';

  const getFraction = (decimal) => {
    const sixteenths = Math.round(decimal * 16);
    if (sixteenths === 0) return "";
    if (sixteenths === 16) return " 1";
    let num = sixteenths;
    let den = 16;
    while (num % 2 === 0 && den % 2 === 0) {
      num /= 2;
      den /= 2;
    }
    return ` ${num}/${den}`;
  };

  let wholeInches = Math.floor(totalInches);
  let fractionInches = getFraction(totalInches - wholeInches);
  
  if (fractionInches === " 1") {
    wholeInches += 1;
    fractionInches = "";
  }
  
  return `${wholeInches}${fractionInches}"`;
}

// Wrapper para compatibilidad unificada
function inchesToFeetInches(inches) {
  return formatToFraction(inches);
}

function formatMoney(num) {
  return `$${(num || 0).toFixed(2)}`;
}

function getStringerCount(widthInches) {
  if (widthInches <= 36) return 3;
  if (widthInches <= 48) return 4;
  if (widthInches <= 60) return 5;
  if (widthInches <= 72) return 6;
  return Math.ceil(widthInches / 12);
}

function chooseBoardLength(lengthFeet) {
  if (lengthFeet <= 8) return 8;
  if (lengthFeet <= 12) return 12;
  if (lengthFeet <= 16) return 16;
  return Math.ceil(lengthFeet);
}

// --- CÁLCULO PRINCIPAL ---
function calculateStairs() {
  // TRANSLATIONS SETUP
  const lang = localStorage.getItem('prefLang') || 'es';
  const t = (typeof translations !== 'undefined' && translations[lang]) ? translations[lang] : translations['en'];

  // --- 1) DIAGNÓSTICO DE IDs ---
  const requiredIds = ["totalHeight", "stairWidth", "targetRise", "treadDepth", "nosing"];
  let missing = [];
  requiredIds.forEach(id => {
    if (!$(id)) missing.push(`id='${id}'`);
  });
  if (missing.length > 0) {
    alert("Error de estructura en el HTML: No se encontraron los siguientes IDs críticos: " + missing.join(", "));
    return;
  }

  // --- 2) GET INPUTS ---
  const totalHeight = parseFloat($("totalHeight").value);
  const stairWidth = parseFloat($("stairWidth").value);
  const targetRise = parseFloat($("targetRise").value);
  const treadDepth = parseFloat($("treadDepth").value);
  const nosing = parseFloat($("nosing").value) || 0;
  
  const cfg = {
    stringerLumber: $("stringerLumber")?.value || "2x12",
    includeTreads: $("includeTreads")?.value || "yes",
    treadBoardType: $("treadBoardType")?.value || "2x10",
    treadThickness: parseFloat($("treadThickness")?.value) || 1.5,
    closedRisers: $("closedRisers")?.value || "no",
    riserMaterial: $("riserMaterial")?.value || "1x8",
  };

  const waste = parseFloat($("wastePercent")?.value) || 10;

  if (totalHeight <= 0 || stairWidth <= 0 || targetRise <= 0 || treadDepth <= 0) {
    $("resultsContent").innerHTML = `<p class="section-sub" style="color:red">${t.errStairDims || "Please enter valid positive numbers for Total Height, Width, Target Rise, and Tread Depth."}</p>`;
    return;
  }

  // --- 3) GEOMETRÍA BÁSICA DE LA ESCALERA ---
  // Rise calculation
  const roughRises = totalHeight / targetRise;
  const candidateA = Math.max(1, Math.floor(roughRises));
  const candidateB = Math.max(1, Math.ceil(roughRises));

  const riseA = totalHeight / candidateA;
  const riseB = totalHeight / candidateB;

  // Elegir la cantidad de rises que esté más cerca del target
  const risers = Math.abs(riseA - targetRise) <= Math.abs(riseB - targetRise) ? candidateA : candidateB;
  const actualRiserHeight = totalHeight / risers;

  // Tread calculation
  const treads = risers - 1;
  const totalRun = treads * treadDepth;

  // Geometría detallada
  const walkSurfaceDepth = treadDepth + nosing;
  const walkLength = treads * walkSurfaceDepth;
  const stringerLengthInches = Math.sqrt(Math.pow(totalHeight, 2) + Math.pow(totalRun, 2));
  const stairAngleRad = Math.atan(totalHeight / totalRun);
  const stairAngle = stairAngleRad * (180 / Math.PI);

  // --- 4) CANTIDADES DE MATERIALES (Lógica de framing) ---
  // Stringers
  const recommendedBoardLength = chooseBoardLength(stringerLengthInches / 12 + 1); // Añadir 1 pie de seguridad
  const stringerCount = getStringerCount(stairWidth);
  const stringersWithWaste = stringerCount; 

  // Treads (Huellas)
  let treadBoardCount = 0;
  let treadBoardLength = 0;
  if (cfg.includeTreads === "yes") {
    treadBoardLength = chooseBoardLength(stairWidth / 12 + 0.5); // Pieza de seguridad de 6"
    treadBoardCount = treads; 
  }

  // Risers (Contrahuellas)
  let riserBoardCount = 0;
  let riserBoardLength = 0;
  if (cfg.closedRisers === "yes") {
    riserBoardLength = chooseBoardLength(stairWidth / 12 + 0.5); 
    riserBoardCount = risers;
  }

  // --- 5) CONSOLIDAR MATERIALES PARA EL JSON ---
  const groupedMaterials = {};
  function addMat(label, qty) {
    if (!qty || qty <= 0) return;
    groupedMaterials[label] = (groupedMaterials[label] || 0) + qty;
  }
  
  // Nombres ajustados con terminología de PR
  addMat(`${cfg.stringerLumber}x${recommendedBoardLength} (${t.matStringers || "Stringers (Zancas)"})`, stringersWithWaste);
  if (cfg.includeTreads === "yes") {
    addMat(`${cfg.treadBoardType}x${treadBoardLength} (${t.matTreads || "Treads (Huellas)"})`, treadBoardCount);
  }
  if (cfg.closedRisers === "yes") {
    addMat(`${cfg.riserMaterial}x${riserBoardLength} (${t.matRisers || "Risers (Contrahuellas)"})`, riserBoardCount);
  }

  // --- 6) COSTOS DETALLADOS ---
  const stringerPriceEach = typeof getLumberPrice === "function" ? getLumberPrice(cfg.stringerLumber, recommendedBoardLength) : 0;
  const stringerCost = stringerCount * stringerPriceEach;

  let treadBoardCost = 0;
  if (cfg.includeTreads === "yes") {
    const treadPrice = typeof getLumberPrice === "function" ? getLumberPrice(cfg.treadBoardType, treadBoardLength) : 0;
    treadBoardCost = treadBoardCount * treadPrice;
  }

  let riserBoardCost = 0;
  if (cfg.closedRisers === "yes") {
    const riserPrice = typeof getLumberPrice === "function" ? getLumberPrice(cfg.riserMaterial, riserBoardLength) : 0;
    riserBoardCost = riserBoardCount * riserPrice;
  }

  // const localTaxRate = parseFloat($("taxRate").value) || 0;
  // const taxRate = typeof getTaxRate === "function" && typeof globalPrices !== 'undefined' ? getTaxRate() : localTaxRate;
  const taxRate = typeof getTaxRate === "function" ? getTaxRate() : 0;
  
  const subtotal = stringerCost + treadBoardCost + riserBoardCost;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  // --- 7) DOM OUTPUT: RESULTADOS DETALLADOS EN PANTALLA ---
  const res = $("resultsContent");
  if (res) {
    res.innerHTML = `
      <div class="results-grid">
        <div class="result-box">
          <h3>${t.summary || "Summary"}</h3>
          <ul>
            <li><strong>${t.lblTotalHeight || "Total Height (Rise):"}</strong> ${formatInchesOnly(totalHeight)}</li>
            <li><strong>${t.resStairWidth || "Stair Width:"}</strong> ${formatInchesOnly(stairWidth)}</li>
            <li><strong>${t.resNumRisers || "Number of Steps (Risers):"}</strong> ${risers}</li>
            <li><strong>${t.resNumTreads || "Number of Treads:"}</strong> ${treads}</li>
          </ul>
        </div>

        <div class="result-box">
          <h3>${t.materials || "Estimated Materials"}</h3>
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
          <h3>${t.cost || "Estimated Cost"}</h3>
          <ul>
            <li><strong>${t.resCostStringers || "Stringers:"}</strong> ${formatMoney(stringerCost)}</li>
            <li><strong>${t.resCostTreadBoards || "Tread Boards:"}</strong> ${formatMoney(treadBoardCost)}</li>
            <li><strong>${t.resCostRiserMat || "Riser Material:"}</strong> ${formatMoney(riserBoardCost)}</li>
            <hr />
            <li><strong>${t.resSubtotal || "Subtotal:"}</strong> ${formatMoney(subtotal)}</li>
            <li><strong>${t.resTax || "Tax"} (${round2(taxRate)}%):</strong> ${formatMoney(taxAmount)}</li>
            <li><strong>${t.resTotal || "Total:"}</strong> ${formatMoney(total)}</li>
          </ul>
        </div>

        <div class="result-box">
          <h3>${t.resCutGuide || "Cut Guides"}</h3>
          <ul>
            <li><strong>${t.resActualRiser || "Actual Riser Height:"}</strong> ${formatInchesOnly(actualRiserHeight)}</li>
            <li><strong>${t.lblTreadDepth || "Tread Depth / Run:"}</strong> ${formatInchesOnly(treadDepth)}</li>
            <li><strong>${t.resWalkSurface || "Walk Surface Depth:"}</strong> ${formatInchesOnly(walkSurfaceDepth)}</li>
            <li><strong>${t.resStringerBuy || "Stringer Board to Buy:"}</strong> ${recommendedBoardLength}'</li>
            <li><strong>${t.resThroatCheck || "Stringer Minimum (Throat):"}</strong> ${t.resThroatNote || "Check local code for remaining throat depth after cut."}</li>
          </ul>
        </div>

        <div class="result-box">
          <h3>${t.printGeomSum || "Geometry Summary"}</h3>
          <ul>
            <li><strong>${t.resTotalRun || "Total Run (Footprint):"}</strong> ${inchesToFeetInches(totalRun)}</li>
            <li><strong>${t.resStringerLenMin || "Stringer Length (Slope):"}</strong> ${inchesToFeetInches(stringerLengthInches)}</li>
            <li><strong>${t.resStairAngle || "Stair Angle:"}</strong> ${round2(stairAngle)}°</li>
          </ul>
        </div>
      </div>
    `;
  }

  // --- 8) DOM OUTPUT: PRINT SHEET ---
  const d = new Date();
  const printDate = $("printDate");
  if (printDate) printDate.textContent = `${t.printGenerated || "Generated:"} ${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;

  const printStairInfo = $("printStairInfo");
  if (printStairInfo) {
    printStairInfo.innerHTML = `
      <p><strong>${t.lblTotalHeight || "Total Height:"}</strong> ${formatInchesOnly(totalHeight)}</p>
      <p><strong>${t.resStairWidth || "Width:"}</strong> ${formatInchesOnly(stairWidth)}</p>
      <p><strong>${t.resNumRisers || "Number of Steps (Risers):"}</strong> ${risers}</p>
      <p><strong>${t.resNumTreads || "Number of Treads:"}</strong> ${treads}</p>
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

  const printStairCosts = $("printCosts"); 
  if (printStairCosts) {
    printStairCosts.innerHTML = `
      <p><strong>${t.resCostStringers || "Stringers:"}</strong> ${formatMoney(stringerCost)}</p>
      <p><strong>${t.resCostTreadBoards || "Treads:"}</strong> ${formatMoney(treadBoardCost)}</p>
      <p><strong>${t.resCostRiserMat || "Risers:"}</strong> ${formatMoney(riserBoardCost)}</p>
      <hr />
      <p><strong>${t.resSubtotal || "Subtotal:"}</strong> ${formatMoney(subtotal)}</p>
      <p><strong>${t.resTax || "Tax"}:</strong> ${formatMoney(taxAmount)}</p>
      <p><strong>${t.resTotal || "Total:"}</strong> ${formatMoney(total)}</p>
    `;
  }
  
  const printCutGuides = $("printCutGuides");
  if (printCutGuides) {
    printCutGuides.innerHTML = `
      <p><strong>${t.resActualRiser || "Actual Riser Height:"}</strong> ${formatInchesOnly(actualRiserHeight)}</p>
      <p><strong>${t.lblTreadDepth || "Tread Depth / Run:"}</strong> ${formatInchesOnly(treadDepth)}</p>
      <p><strong>${t.resStringerBuy || "Stringer Board to Buy:"}</strong> ${recommendedBoardLength}'</p>
    `;
  }

  const printGeometry = $("printGeometry");
  if (printGeometry) {
    printGeometry.innerHTML = `
      <p><strong>${t.resTotalRun || "Total Run (Footprint):"}</strong> ${inchesToFeetInches(totalRun)}</p>
      <p><strong>${t.resStringerLenMin || "Stringer Length (Slope):"}</strong> ${inchesToFeetInches(stringerLengthInches)}</p>
      <p><strong>${t.resStairAngle || "Stair Angle:"}</strong> ${round2(stairAngle)}°</p>
    `;
  }
}

// --- INICIALIZACIÓN ---
document.addEventListener("DOMContentLoaded", () => {
  const calcBtn = $("calculateBtn");
  if (calcBtn) calcBtn.addEventListener("click", calculateStairs);

  const printBtn = $("printBtn");
  if (printBtn) {
    printBtn.addEventListener("click", () => window.print());
  }
});