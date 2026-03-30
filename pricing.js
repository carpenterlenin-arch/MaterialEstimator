// Variable global para almacenar los precios
let globalPrices = {};

// 1. Cargar el JSON al iniciar la página
async function initPricing() {
  try {
    const response = await fetch('prices.json');
    globalPrices = await response.json();
    buildPricingUI();
  } catch (error) {
    console.error("Error cargando prices.json. Verifica que estás en un servidor local.", error);
  }
}

// 2. Construir dinámicamente los inputs en el HTML
function buildPricingUI() {
  const container = document.getElementById('dynamicPricingContainer');
  if (!container) return; // Si no existe el contenedor en el HTML, no hace nada

  let html = '<div class="form-grid-3">';

  // Maderas (Lumber)
  for (const size in globalPrices.lumber) {
    for (const length in globalPrices.lumber[size]) {
      const val = globalPrices.lumber[size][length];
      const id = `price_${size}_${length}`;
      html += `
        <div class="input-group">
          <label for="${id}">${size}x${length} Price</label>
          <input type="number" id="${id}" value="${val}" step="0.01" min="0" 
                 onchange="updatePrice('lumber', '${size}', '${length}', this.value)" />
        </div>
      `;
    }
  }

  // Paneles (Plywood / Drywall)
  for (const panel in globalPrices.panels) {
    const val = globalPrices.panels[panel];
    // Capitalizar la primera letra para el label
    const labelName = panel.charAt(0).toUpperCase() + panel.slice(1); 
    const id = `price_${panel}`;
    html += `
      <div class="input-group">
        <label for="${id}">4x8 ${labelName} Price</label>
        <input type="number" id="${id}" value="${val}" step="0.01" min="0" 
               onchange="updatePrice('panels', '${panel}', null, this.value)" />
      </div>
    `;
  }

  // Impuestos (Tax)
  html += `
    <div class="input-group">
      <label for="price_tax">Tax Rate %</label>
      <input type="number" id="price_tax" value="${globalPrices.settings.taxRate}" step="0.01" min="0" 
             onchange="updatePrice('settings', 'taxRate', null, this.value)" />
    </div>
  `;

  html += '</div>';
  container.innerHTML = html;
}

// 3. Actualizar la variable global si el usuario cambia el precio a mano en la página
function updatePrice(category, key1, key2, value) {
  const num = parseFloat(value) || 0;
  if (category === 'lumber') {
    globalPrices.lumber[key1][key2] = num;
  } else if (category === 'panels') {
    globalPrices.panels[key1] = num;
  } else if (category === 'settings') {
    globalPrices.settings[key1] = num;
  }
}

// 4. Funciones que tu calculador (wall.js, roof.js) llamará para obtener el precio
function getLumberPrice(size, length) {
  if (!globalPrices.lumber) return 0;
  return globalPrices.lumber[size]?.[length] || 0;
}

function getSheetPrice(type) {
  if (!globalPrices.panels) return 0;
  return globalPrices.panels[type] || 0;
}

function getTaxRate() {
  if (!globalPrices.settings) return 0;
  return globalPrices.settings.taxRate || 0;
}

// Iniciar el proceso cuando cargue la página
document.addEventListener("DOMContentLoaded", initPricing);