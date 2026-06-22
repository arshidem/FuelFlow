/* =============================================================
 * FUELFLOW - APPLICATION LOGIC
 * ============================================================= */

// -------------------------------------------------------------
// 1. STATE INITIALIZATION & CONFIGURATION
// -------------------------------------------------------------
let appState = {
  currentDate: new Date().toISOString().split('T')[0],
  
  // Today's working data
  nozzles: [],
  oils: [],
  expenses: [],
  activeNozzleFilter: 'all',
  flowsByNozzle: {},
  
  flows: {
    paytm: 0,
    yesterdayPaytm: 0,
    card: 0,
    creditSale: 0,
    creditRecv: 0,
    boxAmount: 0,
    carryBoxAmount: 0,
    remarks: '',
    officeCash: 0
  },
  
  denominations: {
    n500: 0,
    n200: 0,
    n100: 0,
    n50: 0,
    n20: 0,
    n10: 0,
    coins: 0
  },
  
  // Actual cash options
  cashMode: 'bundles',
  cashBundles: [],
  
  // Settings & configurations
  settings: {
    defaultNozzles: [
      { name: 'Petrol Nozzle 1', rate: 102.50 },
      { name: 'Petrol Nozzle 2', rate: 102.50 },
      { name: 'Diesel Nozzle 1', rate: 94.20 },
      { name: 'Diesel Nozzle 2', rate: 94.20 }
    ],
    defaultOils: [
      { description: 'Engine Oil 4T 1L', price: 350.00 },
      { description: 'Engine Oil 4T 900ml', price: 320.00 },
      { description: 'Gear Oil 1L', price: 280.00 },
      { description: 'Coolant 1L', price: 180.00 }
    ]
  },
  
  // Saved logs
  logs: []
};

// Load initial data from LocalStorage
function loadFromLocalStorage() {
  const savedSettings = localStorage.getItem('fuelflow_settings');
  if (savedSettings) {
    appState.settings = JSON.parse(savedSettings);
  } else {
    saveSettingsToLocalStorage();
  }
  
  const savedLogs = localStorage.getItem('fuelflow_logs');
  if (savedLogs) {
    appState.logs = JSON.parse(savedLogs);
  }
}

function saveSettingsToLocalStorage() {
  localStorage.setItem('fuelflow_settings', JSON.stringify(appState.settings));
}

function saveLogsToLocalStorage() {
  localStorage.setItem('fuelflow_logs', JSON.stringify(appState.logs));
}

// -------------------------------------------------------------
// 2. APP STARTUP & TABS NAVIGATION
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadFromLocalStorage();
  setupEventListeners();
  
  // Set default date to today
  const dateInput = document.getElementById('entry-date');
  dateInput.value = appState.currentDate;
  updateHeaderDateDisplay(appState.currentDate);
  
  // Load data for today if it exists, or initialize default template
  loadDayData(appState.currentDate);
  
  // Initialize UI components
  renderSettings();
  renderHistory();
  
  // Apply theme on load
  const isDark = localStorage.getItem('fuelflow_theme') === 'dark';
  if (isDark) {
    document.body.classList.remove('light-mode');
    document.body.classList.add('dark-mode');
    document.getElementById('theme-toggle-header').innerHTML = '<i class="fa-solid fa-sun"></i>';
  }
});

function updateHeaderDateDisplay(dateStr) {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const dateObj = new Date(dateStr);
  const formatted = dateObj.toLocaleDateString('en-US', options);
  document.getElementById('header-date').innerText = formatted;
  document.getElementById('print-date-val').innerText = dateObj.toLocaleDateString('en-IN');
}

function setupEventListeners() {
  // Navigation tabs switching
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabName = btn.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
  
  // Theme toggle
  document.getElementById('theme-toggle-header').addEventListener('click', toggleTheme);
  
  // Date selection changed
  document.getElementById('entry-date').addEventListener('change', (e) => {
    const newDate = e.target.value;
    if (!newDate) return;
    
    // Save current workspace state to local model, then load the other date
    saveCurrentStateToMemory();
    appState.currentDate = newDate;
    updateHeaderDateDisplay(newDate);
    loadDayData(newDate);
  });
  
  // Calculation triggers for standard flows
  const calcTriggers = document.querySelectorAll('.calc-trigger');
  calcTriggers.forEach(input => {
    input.addEventListener('input', () => {
      updateFlowsStateFromUI();
      calculateReconciliation();
    });
  });
  
  // Calculation triggers for denominations
  // Denomination inputs trigger recalculation
  const denomInputs = document.querySelectorAll('.denom-input');
  denomInputs.forEach(input => {
    input.addEventListener('input', () => {
      updateDenominationsStateFromUI();
      calculateReconciliation();
    });
  });
  
  // Cash counted tabs switching
  document.getElementById('mode-quick').addEventListener('click', () => switchCashMode('bundles'));
  document.getElementById('mode-detailed').addEventListener('click', () => switchCashMode('detailed'));
  
  // Cash bundle actions
  document.getElementById('btn-add-bundle').addEventListener('click', addNewCashBundleRow);
  document.getElementById('btn-clear-cash').addEventListener('click', clearCashCounted);
  
  // Carry Box Amount and Remarks trigger
  document.getElementById('carry-box-amount').addEventListener('input', (e) => {
    appState.flows.carryBoxAmount = parseFloat(e.target.value) || 0;
    calculateReconciliation();
  });
  document.getElementById('day-remarks').addEventListener('input', (e) => {
    appState.flows.remarks = e.target.value;
    calculateReconciliation();
  });
  
  // Top-bar Quick Save
  document.getElementById('btn-quick-save').addEventListener('click', saveTodayLog);
  
  // Card-body Actions
  document.getElementById('btn-add-nozzle').addEventListener('click', addNewNozzleRow);
  document.getElementById('btn-add-oil').addEventListener('click', addNewOilRow);
  document.getElementById('btn-add-expense').addEventListener('click', addNewExpenseRow);
  
  // Bottom action buttons
  document.getElementById('btn-save-log').addEventListener('click', saveTodayLog);
  document.getElementById('btn-print-pdf').addEventListener('click', printSummaryReport);
  document.getElementById('btn-reset-form').addEventListener('click', confirmAndResetForm);
  
  // Settings Page Actions
  document.getElementById('btn-settings-add-nozzle').addEventListener('click', addDefaultNozzleSetting);
  document.getElementById('btn-settings-add-oil').addEventListener('click', addDefaultOilSetting);
  document.getElementById('btn-settings-clear-all').addEventListener('click', clearAllApplicationData);
  
  // History Page Search
  document.getElementById('history-search').addEventListener('input', filterHistoryLogs);
  
  // Backup controls
  document.getElementById('btn-export-backup').addEventListener('click', exportBackupJSON);
  document.getElementById('btn-import-backup').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', importBackupJSON);
}

function switchTab(tabName) {
  // Update nav buttons active state
  document.querySelectorAll('.nav-btn').forEach(b => {
    if (b.getAttribute('data-tab') === tabName) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });
  
  // Update view visibility
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  
  const targetPane = document.getElementById(`tab-${tabName}`);
  if (targetPane) {
    targetPane.classList.add('active');
  }
  
  // Header title update
  const pageTitle = document.getElementById('page-title');
  if (tabName === 'new-entry') {
    pageTitle.innerText = 'Daily Collection Entry';
    document.querySelector('.top-bar-actions').style.display = 'flex';
  } else if (tabName === 'history') {
    pageTitle.innerText = 'Collection History Logs';
    document.querySelector('.top-bar-actions').style.display = 'none';
    renderHistory();
  } else if (tabName === 'settings') {
    pageTitle.innerText = 'Pump Settings';
    document.querySelector('.top-bar-actions').style.display = 'none';
    renderSettings();
  }
}

function toggleTheme() {
  const isDark = document.body.classList.contains('dark-mode');
  if (isDark) {
    document.body.classList.remove('dark-mode');
    document.body.classList.add('light-mode');
    localStorage.setItem('fuelflow_theme', 'light');
    document.getElementById('theme-toggle-header').innerHTML = '<i class="fa-solid fa-moon"></i>';
  } else {
    document.body.classList.remove('light-mode');
    document.body.classList.add('dark-mode');
    localStorage.setItem('fuelflow_theme', 'dark');
    document.getElementById('theme-toggle-header').innerHTML = '<i class="fa-solid fa-sun"></i>';
  }
}

// -------------------------------------------------------------
// 3. CORE LOGIC & DAY LOADING
// -------------------------------------------------------------

function saveCurrentStateToMemory() {
  updateFlowsStateFromUI();
  updateDenominationsStateFromUI();
  
  // Readings & Expenses are bound instantly to inputs, but let's sync arrays
  appState.flows.carryBoxAmount = parseFloat(document.getElementById('carry-box-amount').value) || 0;
  appState.flows.remarks = document.getElementById('day-remarks').value;
}

function loadDayData(dateStr) {
  // Check if there is an active temporary draft for this date
  const savedDraft = localStorage.getItem(`fuelflow_draft_${dateStr}`);
  let loadedFromDraft = false;
  
  if (savedDraft) {
    try {
      const draft = JSON.parse(savedDraft);
      appState.nozzles = draft.nozzles || [];
      appState.oils = draft.oils || [];
      appState.expenses = draft.expenses || [];
      appState.flows = draft.flows || {};
      appState.denominations = draft.denominations || {};
      appState.cashMode = draft.cashMode || 'bundles';
      appState.cashBundles = draft.cashBundles || [];
      loadedFromDraft = true;
    } catch (e) {
      console.error("Error parsing temporary draft data:", e);
    }
  }
  
  if (!loadedFromDraft) {
    // Find if there is an existing finalized log for this date
    const existingLog = appState.logs.find(log => log.date === dateStr);
    
    if (existingLog) {
      // Load existing
      appState.nozzles = JSON.parse(JSON.stringify(existingLog.nozzles));
      appState.oils = JSON.parse(JSON.stringify(existingLog.oils || []));
      appState.expenses = JSON.parse(JSON.stringify(existingLog.expenses || []));
      appState.flows = JSON.parse(JSON.stringify(existingLog.flows));
      appState.denominations = JSON.parse(JSON.stringify(existingLog.denominations || {}));
      appState.cashMode = existingLog.cashMode || 'bundles';
      appState.cashBundles = existingLog.cashBundles || [];
    } else {
      // Initialize fresh template based on settings
      initializeFreshDayTemplate();
    }
  }
  
  // Render tables
  renderNozzlesTable();
  renderOilsTable();
  renderExpensesTable();
  renderCashBundlesTable();
  
  // Update Tab Panel View classes
  syncCashModeUI();
  
  // Fill inputs
  fillFlowsInputs();
  fillDenominationsInputs();
  
  // Recalculate
  calculateReconciliation();
}

// -------------------------------------------------------------
// NOZZLE-WISE FINANCIAL TRACKING & PERSISTENCE HELPERS
// -------------------------------------------------------------
function ensureNozzleFlowsState(nozzleId) {
  if (!appState.flowsByNozzle) {
    appState.flowsByNozzle = {};
  }
  if (!appState.flowsByNozzle[nozzleId]) {
    appState.flowsByNozzle[nozzleId] = {
      flows: {
        paytm: 0,
        yesterdayPaytm: 0,
        card: 0,
        creditSale: 0,
        creditRecv: 0,
        boxAmount: 0,
        carryBoxAmount: 0,
        remarks: '',
        officeCash: 0
      },
      denominations: {
        n500: 0,
        n200: 0,
        n100: 0,
        n50: 0,
        n20: 0,
        n10: 0,
        coins: 0
      },
      cashMode: 'bundles',
      cashBundles: [
        { id: 'b_' + Date.now() + '_0', amount: 0 },
        { id: 'b_' + Date.now() + '_1', amount: 0 }
      ]
    };
  }
}

function updateActiveNozzleFilterOptions() {
  const filterSelect = document.getElementById('active-nozzle-filter');
  if (!filterSelect) return;
  
  const currentValue = filterSelect.value || 'all';
  
  filterSelect.innerHTML = `
    <option value="all">All Nozzles (Merged View)</option>
    <option value="general">General / Unassigned</option>
  `;
  
  appState.nozzles.forEach(nozzle => {
    filterSelect.innerHTML += `<option value="${nozzle.id}">${nozzle.name}</option>`;
  });
  
  // Restore value if it still exists
  if ([...filterSelect.options].some(opt => opt.value === currentValue)) {
    filterSelect.value = currentValue;
  } else {
    filterSelect.value = 'all';
    appState.activeNozzleFilter = 'all';
  }
}

function setFlowsAndCashInputsReadOnly(isReadOnly) {
  const inputs = document.querySelectorAll('.calc-trigger, .denom-input, #carry-box-amount, #day-remarks');
  inputs.forEach(input => {
    input.readOnly = isReadOnly;
    if (input.tagName === 'TEXTAREA') {
      input.readOnly = isReadOnly;
    }
  });
  // Disable add/clear buttons in cash counted section if read-only
  const btnAddBundle = document.getElementById('btn-add-bundle');
  const btnClearCash = document.getElementById('btn-clear-cash');
  if (btnAddBundle) btnAddBundle.disabled = isReadOnly;
  if (btnClearCash) btnClearCash.disabled = isReadOnly;

  // Visual feedback for read-only mode in cash counted switch tabs
  const modeQuick = document.getElementById('mode-quick');
  const modeDetailed = document.getElementById('mode-detailed');
  if (modeQuick && modeDetailed) {
    if (isReadOnly) {
      modeQuick.style.pointerEvents = 'none';
      modeDetailed.style.pointerEvents = 'none';
      modeQuick.style.opacity = '0.6';
      modeDetailed.style.opacity = '0.6';
    } else {
      modeQuick.style.pointerEvents = 'auto';
      modeDetailed.style.pointerEvents = 'auto';
      modeQuick.style.opacity = '1';
      modeDetailed.style.opacity = '1';
    }
  }
}

function mergeAllNozzlesToRoot() {
  const sumFlows = {
    paytm: 0, yesterdayPaytm: 0, card: 0, creditSale: 0, creditRecv: 0, boxAmount: 0, carryBoxAmount: 0, remarks: '', officeCash: 0
  };
  const sumDenoms = {
    n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0, coins: 0
  };
  
  let mergedBundles = [];
  let allRemarks = [];
  
  if (!appState.flowsByNozzle) appState.flowsByNozzle = {};
  
  ensureNozzleFlowsState('general');
  
  // Collect all nozzle flows, plus general
  const keys = ['general', ...appState.nozzles.map(n => n.id)];
  
  keys.forEach(key => {
    ensureNozzleFlowsState(key);
    const item = appState.flowsByNozzle[key];
    sumFlows.paytm += item.flows.paytm || 0;
    sumFlows.yesterdayPaytm += item.flows.yesterdayPaytm || 0;
    sumFlows.card += item.flows.card || 0;
    sumFlows.creditSale += item.flows.creditSale || 0;
    sumFlows.creditRecv += item.flows.creditRecv || 0;
    sumFlows.boxAmount += item.flows.boxAmount || 0;
    sumFlows.carryBoxAmount += item.flows.carryBoxAmount || 0;
    sumFlows.officeCash += item.flows.officeCash || 0;
    
    sumDenoms.n500 += item.denominations.n500 || 0;
    sumDenoms.n200 += item.denominations.n200 || 0;
    sumDenoms.n100 += item.denominations.n100 || 0;
    sumDenoms.n50 += item.denominations.n50 || 0;
    sumDenoms.n20 += item.denominations.n20 || 0;
    sumDenoms.n10 += item.denominations.n10 || 0;
    sumDenoms.coins += item.denominations.coins || 0;
    
    if (item.flows.remarks && item.flows.remarks.trim()) {
      const nozzleObj = appState.nozzles.find(n => n.id === key);
      const prefix = nozzleObj ? `${nozzleObj.name}: ` : (key === 'general' ? 'General: ' : `${key}: `);
      allRemarks.push(prefix + item.flows.remarks.trim());
    }
    
    if (item.cashBundles) {
      const nozzleObj = appState.nozzles.find(n => n.id === key);
      const label = nozzleObj ? nozzleObj.name : 'General';
      const annotated = item.cashBundles.map(b => ({
        id: b.id,
        amount: b.amount,
        annotatedLabel: label
      }));
      mergedBundles = mergedBundles.concat(annotated);
    }
  });
  
  sumFlows.remarks = allRemarks.join(' | ');
  
  appState.flows = sumFlows;
  appState.denominations = sumDenoms;
  appState.cashMode = 'bundles'; // Force bundles view in merged mode
  appState.cashBundles = mergedBundles;
}

function initializeFreshDayTemplate() {
  // Map settings to dynamic rows
  appState.nozzles = appState.settings.defaultNozzles.map((nozzle, index) => ({
    id: 'n_' + Date.now() + '_' + index,
    name: nozzle.name,
    rate: nozzle.rate,
    opening: 0,
    closing: 0,
    testing: 0,
    net: 0,
    amount: 0
  }));
  
  appState.oils = appState.settings.defaultOils.map((oil, index) => ({
    id: 'o_' + Date.now() + '_' + index,
    description: oil.description,
    price: oil.price,
    quantity: 0,
    total: 0,
    nozzleId: 'general'
  }));
  
  appState.expenses = [];
  
  // Look back at yesterday's carry-forward box cash to set as today's starting box cash!
  let startingBoxCash = 0;
  const sortedLogs = [...appState.logs].sort((a, b) => new Date(b.date) - new Date(a.date));
  const yesterdayLog = sortedLogs.find(l => l.date < appState.currentDate);
  if (yesterdayLog && yesterdayLog.flows && yesterdayLog.flows.carryBoxAmount) {
    startingBoxCash = yesterdayLog.flows.carryBoxAmount;
  }
  
  appState.activeNozzleFilter = 'all';
  appState.flowsByNozzle = {};
  
  // Initialize general and specific nozzle states
  ensureNozzleFlowsState('general');
  appState.flowsByNozzle['general'].flows.boxAmount = startingBoxCash;
  
  appState.nozzles.forEach(nozzle => {
    ensureNozzleFlowsState(nozzle.id);
  });
  
  // Build merged root values
  mergeAllNozzlesToRoot();
  
  // Update target filter dropdown UI
  updateActiveNozzleFilterOptions();
  setFlowsAndCashInputsReadOnly(true);
}

function fillFlowsInputs() {
  document.getElementById('flow-paytm').value = appState.flows.paytm || '';
  document.getElementById('flow-yesterday-paytm').value = appState.flows.yesterdayPaytm || '';
  document.getElementById('flow-card').value = appState.flows.card || '';
  document.getElementById('flow-credit-sale').value = appState.flows.creditSale || '';
  document.getElementById('flow-credit-recv').value = appState.flows.creditRecv || '';
  document.getElementById('flow-box-amount').value = appState.flows.boxAmount || '';
  document.getElementById('carry-box-amount').value = appState.flows.carryBoxAmount || '';
  document.getElementById('flow-office-cash').value = appState.flows.officeCash || '';
  document.getElementById('day-remarks').value = appState.flows.remarks || '';
}

function fillDenominationsInputs() {
  document.getElementById('denom-500').value = appState.denominations.n500 || '';
  document.getElementById('denom-200').value = appState.denominations.n200 || '';
  document.getElementById('denom-100').value = appState.denominations.n100 || '';
  document.getElementById('denom-50').value = appState.denominations.n50 || '';
  document.getElementById('denom-20').value = appState.denominations.n20 || '';
  document.getElementById('denom-10').value = appState.denominations.n10 || '';
  document.getElementById('denom-coins').value = appState.denominations.coins || '';
}

function updateFlowsStateFromUI() {
  appState.flows.paytm = parseFloat(document.getElementById('flow-paytm').value) || 0;
  appState.flows.yesterdayPaytm = parseFloat(document.getElementById('flow-yesterday-paytm').value) || 0;
  appState.flows.card = parseFloat(document.getElementById('flow-card').value) || 0;
  appState.flows.creditSale = parseFloat(document.getElementById('flow-credit-sale').value) || 0;
  appState.flows.creditRecv = parseFloat(document.getElementById('flow-credit-recv').value) || 0;
  appState.flows.boxAmount = parseFloat(document.getElementById('flow-box-amount').value) || 0;
  appState.flows.officeCash = parseFloat(document.getElementById('flow-office-cash').value) || 0;
}

function updateDenominationsStateFromUI() {
  appState.denominations.n500 = parseInt(document.getElementById('denom-500').value) || 0;
  appState.denominations.n200 = parseInt(document.getElementById('denom-200').value) || 0;
  appState.denominations.n100 = parseInt(document.getElementById('denom-100').value) || 0;
  appState.denominations.n50 = parseInt(document.getElementById('denom-50').value) || 0;
  appState.denominations.n20 = parseInt(document.getElementById('denom-20').value) || 0;
  appState.denominations.n10 = parseInt(document.getElementById('denom-10').value) || 0;
  appState.denominations.coins = parseFloat(document.getElementById('denom-coins').value) || 0;
}

// -------------------------------------------------------------
// 4. RENDERING DATA TABLES (NEW ENTRY TABS)
// -------------------------------------------------------------

function renderNozzlesTable() {
  const container = document.getElementById('nozzle-rows');
  container.innerHTML = '';
  
  appState.nozzles.forEach(nozzle => {
    const row = document.createElement('tr');
    row.className = 'responsive-row';
    row.innerHTML = `
      <td class="col-name" data-label="Nozzle / Fuel">
        <input type="text" class="form-control-inline text-bold" value="${nozzle.name}" onchange="updateNozzleField('${nozzle.id}', 'name', this.value)">
      </td>
      <td class="col-rate" data-label="Rate (₹/L)">
        <input type="number" step="0.01" class="form-control-inline" value="${nozzle.rate}" oninput="updateNozzleField('${nozzle.id}', 'rate', this.value)">
      </td>
      <td class="col-opening" data-label="Opening (L)">
        <input type="number" step="0.01" class="form-control-inline" value="${nozzle.opening || ''}" placeholder="0.00" oninput="updateNozzleField('${nozzle.id}', 'opening', this.value)">
      </td>
      <td class="col-closing" data-label="Closing (L)">
        <input type="number" step="0.01" class="form-control-inline" value="${nozzle.closing || ''}" placeholder="0.00" oninput="updateNozzleField('${nozzle.id}', 'closing', this.value)">
      </td>
      <td class="col-testing" data-label="Testing (L)">
        <input type="number" step="0.01" class="form-control-inline" value="${nozzle.testing || ''}" placeholder="0.00" oninput="updateNozzleField('${nozzle.id}', 'testing', this.value)">
      </td>
      <td class="col-net text-right text-bold" data-label="Net Qty (L)">
        <span id="net-${nozzle.id}">${nozzle.net.toFixed(2)}</span>
      </td>
      <td class="col-amount text-right text-bold text-primary" data-label="Amount (₹)">
        <span id="amount-${nozzle.id}">₹${formatCurrency(nozzle.amount)}</span>
      </td>
      <td class="col-actions text-center" data-label="Actions">
        <button class="btn-icon delete-btn" onclick="deleteNozzleRow('${nozzle.id}')" title="Delete Row">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    container.appendChild(row);
  });
}

function updateNozzleField(id, field, value) {
  const nozzle = appState.nozzles.find(n => n.id === id);
  if (!nozzle) return;
  
  if (field === 'name') {
    nozzle.name = value;
  } else {
    nozzle[field] = parseFloat(value) || 0;
  }
  
  // Recalculate Net Sold (L) & Amount
  // Quantity = (Closing - Opening) - Testing
  // But closing must be greater than opening. If not, net can be zero or show warning.
  if (nozzle.closing >= nozzle.opening) {
    nozzle.net = Math.max(0, (nozzle.closing - nozzle.opening) - nozzle.testing);
  } else {
    nozzle.net = 0; // Or keep calculations flexible if meter resets
  }
  
  nozzle.amount = nozzle.net * nozzle.rate;
  
  // Fast update in DOM directly to keep cursor focus and speed
  const netEl = document.getElementById(`net-${id}`);
  const amtEl = document.getElementById(`amount-${id}`);
  if (netEl) netEl.innerText = nozzle.net.toFixed(2);
  if (amtEl) amtEl.innerText = `₹${formatCurrency(nozzle.amount)}`;
  
  calculateReconciliation();
}

function addNewNozzleRow() {
  const id = 'n_' + Date.now();
  appState.nozzles.push({
    id: id,
    name: 'New Nozzle',
    rate: 100.00,
    opening: 0,
    closing: 0,
    testing: 0,
    net: 0,
    amount: 0
  });
  renderNozzlesTable();
  calculateReconciliation();
}

function deleteNozzleRow(id) {
  appState.nozzles = appState.nozzles.filter(n => n.id !== id);
  renderNozzlesTable();
  calculateReconciliation();
}

// LUBRICANT TABLE LOGIC
function renderOilsTable() {
  const container = document.getElementById('oil-rows');
  container.innerHTML = '';
  
  if (appState.oils.length === 0) {
    container.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No oil items added today. Click "Add Item" to add lubricant sales.</td></tr>`;
    return;
  }
  
  appState.oils.forEach(oil => {
    const row = document.createElement('tr');
    row.className = 'responsive-row';
    row.innerHTML = `
      <td class="col-desc" data-label="Description">
        <input type="text" class="form-control-inline text-bold" value="${oil.description}" placeholder="e.g. Engine Oil 4T" onchange="updateOilField('${oil.id}', 'description', this.value)">
      </td>
      <td class="col-price" data-label="Price (₹)">
        <input type="number" step="0.01" class="form-control-inline" value="${oil.price}" oninput="updateOilField('${oil.id}', 'price', this.value)">
      </td>
      <td class="col-qty" data-label="Quantity">
        <input type="number" step="1" class="form-control-inline" value="${oil.quantity || ''}" placeholder="0" oninput="updateOilField('${oil.id}', 'quantity', this.value)">
      </td>
      <td class="col-total text-right text-bold text-primary" data-label="Total Amount (₹)">
        <span id="oiltot-${oil.id}">₹${formatCurrency(oil.total)}</span>
      </td>
      <td class="col-actions text-center" data-label="Actions">
        <button class="btn-icon delete-btn" onclick="deleteOilRow('${oil.id}')" title="Delete Row">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    container.appendChild(row);
  });
}

function updateOilField(id, field, value) {
  const oil = appState.oils.find(o => o.id === id);
  if (!oil) return;
  
  if (field === 'description') {
    oil.description = value;
  } else if (field === 'price') {
    oil.price = parseFloat(value) || 0;
  } else if (field === 'quantity') {
    oil.quantity = parseInt(value) || 0;
  }
  
  oil.total = oil.price * oil.quantity;
  
  const totEl = document.getElementById(`oiltot-${id}`);
  if (totEl) totEl.innerText = `₹${formatCurrency(oil.total)}`;
  
  calculateReconciliation();
}

function addNewOilRow() {
  const id = 'o_' + Date.now();
  appState.oils.push({
    id: id,
    description: '',
    price: 0,
    quantity: 0,
    total: 0
  });
  renderOilsTable();
  calculateReconciliation();
}

function deleteOilRow(id) {
  appState.oils = appState.oils.filter(o => o.id !== id);
  renderOilsTable();
  calculateReconciliation();
}

// EXPENSES TABLE LOGIC
function renderExpensesTable() {
  const container = document.getElementById('expense-rows');
  container.innerHTML = '';
  
  if (appState.expenses.length === 0) {
    container.innerHTML = `<tr><td colspan="3" class="text-center text-muted">No expenses recorded today.</td></tr>`;
    return;
  }
  
  appState.expenses.forEach(exp => {
    const row = document.createElement('tr');
    row.className = 'responsive-row';
    row.innerHTML = `
      <td class="col-desc" data-label="Description">
        <input type="text" class="form-control-inline" value="${exp.description}" placeholder="e.g. Staff Tea / Calibration Testing" onchange="updateExpenseField('${exp.id}', 'description', this.value)">
      </td>
      <td class="col-amount" data-label="Amount (₹)">
        <input type="number" step="0.01" class="form-control-inline text-bold text-danger" value="${exp.amount || ''}" placeholder="0.00" oninput="updateExpenseField('${exp.id}', 'amount', this.value)">
      </td>
      <td class="col-actions text-center" data-label="Actions">
        <button class="btn-icon delete-btn" onclick="deleteExpenseRow('${exp.id}')" title="Delete Row">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    container.appendChild(row);
  });
}

function updateExpenseField(id, field, value) {
  const exp = appState.expenses.find(e => e.id === id);
  if (!exp) return;
  
  if (field === 'description') {
    exp.description = value;
  } else {
    exp.amount = parseFloat(value) || 0;
  }
  calculateReconciliation();
}

function addNewExpenseRow() {
  const id = 'e_' + Date.now();
  appState.expenses.push({
    id: id,
    description: '',
    amount: 0
  });
  renderExpensesTable();
  calculateReconciliation();
}

function deleteExpenseRow(id) {
  appState.expenses = appState.expenses.filter(e => e.id !== id);
  renderExpensesTable();
  calculateReconciliation();
}

// -------------------------------------------------------------
// 5. CALCULATIONS & FORMULA CALCULATORS
// -------------------------------------------------------------

function calculateReconciliation() {
  // A. Sum Fuel Sales
  const fuelSalesTotal = appState.nozzles.reduce((sum, n) => sum + n.amount, 0);
  document.getElementById('sum-fuel-sales').innerText = `₹${formatCurrency(fuelSalesTotal)}`;
  
  // B. Sum Oils & Lubricants
  const oilSalesTotal = appState.oils.reduce((sum, o) => sum + o.total, 0);
  document.getElementById('sum-oil-sales').innerText = `₹${formatCurrency(oilSalesTotal)}`;
  
  // C. Inflows Additions
  const creditRecv = appState.flows.creditRecv || 0;
  document.getElementById('sum-credit-recv').innerText = `+ ₹${formatCurrency(creditRecv)}`;
  const boxIn = appState.flows.boxAmount || 0;
  document.getElementById('sum-box-in').innerText = `+ ₹${formatCurrency(boxIn)}`;
  
  // D. Deductions
  const digitalPayments = (appState.flows.paytm || 0) + (appState.flows.card || 0);
  document.getElementById('sum-digital').innerText = `- ₹${formatCurrency(digitalPayments)}`;
  
  // Yesterday's Paytm (8 PM - 9 PM):
  // Since reading is yesterday 8 PM to today 8 PM, yesterday's Paytm payments after 8 PM
  // correspond to sales included in today's shift but received digitally, so they must be deducted.
  const yesterdayPaytm = appState.flows.yesterdayPaytm || 0;
  const sumYesterdayEl = document.getElementById('sum-yesterday-paytm');
  if (sumYesterdayEl) {
    sumYesterdayEl.innerText = yesterdayPaytm > 0 ? `- ₹${formatCurrency(yesterdayPaytm)}` : `₹0.00`;
    sumYesterdayEl.className = yesterdayPaytm > 0 ? 'summary-value text-danger' : 'summary-value text-muted';
  }
  
  const creditSaleToday = appState.flows.creditSale || 0;
  document.getElementById('sum-credit-sale').innerText = `- ₹${formatCurrency(creditSaleToday)}`;
  
  const expensesTotal = appState.expenses.reduce((sum, e) => sum + e.amount, 0);
  document.getElementById('sum-expenses').innerText = `- ₹${formatCurrency(expensesTotal)}`;
  
  const officeCash = appState.flows.officeCash || 0;
  const sumOfficeCashEl = document.getElementById('sum-office-cash');
  if (sumOfficeCashEl) {
    sumOfficeCashEl.innerText = officeCash > 0 ? `- ₹${formatCurrency(officeCash)}` : `₹0.00`;
    sumOfficeCashEl.className = officeCash > 0 ? 'summary-value text-danger' : 'summary-value text-muted';
  }
  
  // E. Expected Cash in Hand calculation
  // Expected = (Fuel + Oils + CreditRecv + BoxIn) - (Digital + CreditSale + Expenses + OfficeCash + YesterdayPaytm)
  // Yesterday's Paytm (8 PM - 9 PM) is deducted because those sales are included in today's readings but were paid digitally.
  const expectedCash = (fuelSalesTotal + oilSalesTotal + creditRecv + boxIn) - (digitalPayments + creditSaleToday + expensesTotal + officeCash + yesterdayPaytm);
  document.getElementById('sum-expected-cash').innerText = `₹${formatCurrency(expectedCash)}`;
  
  // F. Actual Cash Counted (Denominations or Quick Bundles)
  let actualCash = 0;
  
  // Calculate detailed denominations notes for preview
  const v500 = appState.denominations.n500 * 500;
  const v200 = appState.denominations.n200 * 200;
  const v100 = appState.denominations.n100 * 100;
  const v50 = appState.denominations.n50 * 50;
  const v20 = appState.denominations.n20 * 20;
  const v10 = appState.denominations.n10 * 10;
  const vcoins = appState.denominations.coins;
  
  // Update UI Result labels in Denominations Box
  document.getElementById('res-500').innerText = `₹${formatCurrency(v500)}`;
  document.getElementById('res-200').innerText = `₹${formatCurrency(v200)}`;
  document.getElementById('res-100').innerText = `₹${formatCurrency(v100)}`;
  document.getElementById('res-50').innerText = `₹${formatCurrency(v50)}`;
  document.getElementById('res-20').innerText = `₹${formatCurrency(v20)}`;
  document.getElementById('res-10').innerText = `₹${formatCurrency(v10)}`;
  document.getElementById('res-coins').innerText = `₹${formatCurrency(vcoins)}`;
  
  if (appState.cashMode === 'bundles') {
    actualCash = appState.cashBundles.reduce((sum, b) => sum + b.amount, 0);
  } else {
    actualCash = v500 + v200 + v100 + v50 + v20 + v10 + vcoins;
  }
  
  document.getElementById('cash-calc-total').innerText = `₹${formatCurrency(actualCash)}`;
  document.getElementById('sum-actual-cash').innerText = `₹${formatCurrency(actualCash)}`;
  
  // G. Calculate Variance / Difference
  const variance = actualCash - expectedCash;
  const alertBox = document.getElementById('variance-alert-box');
  const labelEl = document.getElementById('variance-label');
  const valEl = document.getElementById('variance-value');
  const descEl = document.getElementById('variance-desc');
  
  // Clean classes
  alertBox.className = 'variance-alert';
  
  // Round variance to 2 decimal places to avoid floating arithmetic bugs
  const formattedVariance = Math.round(variance * 100) / 100;
  
  if (formattedVariance === 0) {
    alertBox.classList.add('alert-match');
    labelEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Cash Matched';
    valEl.innerText = '₹0.00';
    descEl.innerText = 'Excellent! Today\'s physical cash matches the calculated sales figures exactly.';
  } else if (formattedVariance < 0) {
    alertBox.classList.add('alert-shortage');
    labelEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Cash Shortage';
    valEl.innerText = `- ₹${formatCurrency(Math.abs(formattedVariance))}`;
    descEl.innerText = 'Attention: The physical cash in hand is LESS than expected. Double-check readings, expenses, and digital payments.';
  } else {
    alertBox.classList.add('alert-excess');
    labelEl.innerHTML = '<i class="fa-solid fa-circle-info"></i> Cash Excess';
    valEl.innerText = `+ ₹${formatCurrency(formattedVariance)}`;
    descEl.innerText = 'Note: There is extra cash in the register compared to expected sales totals. Ensure all credit received or oil sales were logged.';
  }
  
  // Auto Suggest Tomorrow's Carry Box Cash:
  // Usually, manager takes cash notes to bank and leaves coins/small bills. Let's suggest that coins + ₹10 notes + ₹20 notes stay in box!
  const boxSuggestion = (appState.denominations.n20 * 20) + (appState.denominations.n10 * 10) + appState.denominations.coins;
  const carryBoxInput = document.getElementById('carry-box-amount');
  // Only suggest if they haven't typed anything custom yet
  if (!carryBoxInput.value) {
    carryBoxInput.placeholder = `${boxSuggestion.toFixed(2)} (Suggested)`;
  }
  
  // Save active entries to draft store in localStorage in real-time
  saveActiveDraftToLocalStorage();
}

function saveActiveDraftToLocalStorage() {
  const draft = {
    nozzles: appState.nozzles,
    oils: appState.oils,
    expenses: appState.expenses,
    flows: appState.flows,
    denominations: appState.denominations,
    cashMode: appState.cashMode,
    cashBundles: appState.cashBundles
  };
  localStorage.setItem(`fuelflow_draft_${appState.currentDate}`, JSON.stringify(draft));
}

function switchCashMode(mode) {
  appState.cashMode = mode;
  syncCashModeUI();
  calculateReconciliation();
}

function syncCashModeUI() {
  const modeQuickBtn = document.getElementById('mode-quick');
  const modeDetailedBtn = document.getElementById('mode-detailed');
  const panelQuick = document.getElementById('panel-quick-cash');
  const panelDetailed = document.getElementById('panel-detailed-cash');
  
  if (appState.cashMode === 'bundles') {
    modeQuickBtn.classList.add('active');
    modeDetailedBtn.classList.remove('active');
    panelQuick.classList.add('active');
    panelDetailed.classList.remove('active');
  } else {
    modeQuickBtn.classList.remove('active');
    modeDetailedBtn.classList.add('active');
    panelQuick.classList.remove('active');
    panelDetailed.classList.add('active');
  }
}

function renderCashBundlesTable() {
  const container = document.getElementById('bundle-rows-container');
  container.innerHTML = '';
  
  if (!appState.cashBundles || appState.cashBundles.length === 0) {
    appState.cashBundles = [
      { id: 'b_' + Date.now() + '_0', amount: 0 },
      { id: 'b_' + Date.now() + '_1', amount: 0 }
    ];
  }
  
  appState.cashBundles.forEach((bundle, idx) => {
    const row = document.createElement('div');
    row.className = 'bundle-row';
    row.innerHTML = `
      <div class="bundle-input-wrapper">
        <span class="currency-symbol">₹</span>
        <input type="number" class="form-control bundle-input" value="${bundle.amount || ''}" placeholder="0.00" oninput="updateCashBundleField('${bundle.id}', this.value)">
      </div>
      <button class="btn-icon delete-btn" onclick="deleteCashBundleRow('${bundle.id}')" title="Delete Bundle" type="button">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    `;
    container.appendChild(row);
  });
}

function addNewCashBundleRow() {
  const id = 'b_' + Date.now();
  appState.cashBundles.push({
    id: id,
    amount: 0
  });
  renderCashBundlesTable();
  calculateReconciliation();
}

function deleteCashBundleRow(id) {
  // Keep at least one bundle input row
  if (appState.cashBundles.length <= 1) {
    appState.cashBundles = [{ id: 'b_' + Date.now(), amount: 0 }];
  } else {
    appState.cashBundles = appState.cashBundles.filter(b => b.id !== id);
  }
  renderCashBundlesTable();
  calculateReconciliation();
}

function updateCashBundleField(id, value) {
  const bundle = appState.cashBundles.find(b => b.id === id);
  if (bundle) {
    bundle.amount = parseFloat(value) || 0;
  }
  calculateReconciliation();
}

function clearCashCounted() {
  if (appState.cashMode === 'bundles') {
    appState.cashBundles = [
      { id: 'b_' + Date.now() + '_0', amount: 0 },
      { id: 'b_' + Date.now() + '_1', amount: 0 }
    ];
    renderCashBundlesTable();
  } else {
    appState.denominations = {
      n500: 0,
      n200: 0,
      n100: 0,
      n50: 0,
      n20: 0,
      n10: 0,
      coins: 0
    };
    fillDenominationsInputs();
  }
  calculateReconciliation();
}

function confirmAndResetForm() {
  if (confirm('Are you sure you want to clear all inputs for today? This will not delete saved records for other days.')) {
    localStorage.removeItem(`fuelflow_draft_${appState.currentDate}`);
    initializeFreshDayTemplate();
    renderNozzlesTable();
    renderOilsTable();
    renderExpensesTable();
    renderCashBundlesTable();
    syncCashModeUI();
    fillFlowsInputs();
    fillDenominationsInputs();
    calculateReconciliation();
    showToast('Form fields reset.');
  }
}

// -------------------------------------------------------------
// 6. SAVING TO STORAGE & HISTORY TRACKING
// -------------------------------------------------------------

function saveTodayLog() {
  saveCurrentStateToMemory();
  
  // Simple validation
  const totalSales = appState.nozzles.reduce((sum, n) => sum + n.amount, 0) + appState.oils.reduce((sum, o) => sum + o.total, 0);
  if (totalSales === 0 && appState.expenses.length === 0 && appState.flows.paytm === 0) {
    if (!confirm('You are saving a blank log with 0 sales. Do you want to proceed?')) {
      return;
    }
  }
  
  // Check if date already exists
  const existingIndex = appState.logs.findIndex(log => log.date === appState.currentDate);
  
  const logData = {
    date: appState.currentDate,
    nozzles: JSON.parse(JSON.stringify(appState.nozzles)),
    oils: JSON.parse(JSON.stringify(appState.oils)),
    expenses: JSON.parse(JSON.stringify(appState.expenses)),
    flows: JSON.parse(JSON.stringify(appState.flows)),
    denominations: JSON.parse(JSON.stringify(appState.denominations)),
    // Metrics cached for easy search
    metrics: {
      fuelSales: appState.nozzles.reduce((sum, n) => sum + n.amount, 0),
      oilSales: appState.oils.reduce((sum, o) => sum + o.total, 0),
      expenses: appState.expenses.reduce((sum, e) => sum + e.amount, 0),
      expectedCash: parseFloat(document.getElementById('sum-expected-cash').innerText.replace(/[₹,]/g, '')),
      actualCash: parseFloat(document.getElementById('sum-actual-cash').innerText.replace(/[₹,]/g, '')),
      variance: parseFloat(document.getElementById('variance-value').innerText.replace(/[+₹,\s-]/g, '')) * (document.getElementById('variance-label').innerText.includes('Shortage') ? -1 : 1)
    }
  };
  
  if (existingIndex > -1) {
    appState.logs[existingIndex] = logData;
    showToast('Daily log updated successfully!');
  } else {
    appState.logs.push(logData);
    showToast('Daily log saved successfully!');
  }
  
  // Clear the draft, since the data is now finalized and saved in main logs database
  localStorage.removeItem(`fuelflow_draft_${appState.currentDate}`);
  
  saveLogsToLocalStorage();
  renderHistory();
  
  // Switch to history view so they see the saved log
  setTimeout(() => {
    switchTab('history');
  }, 1000);
}

function renderHistory() {
  const container = document.getElementById('history-table-rows');
  container.innerHTML = '';
  
  // Sort logs descending by date
  const sortedLogs = [...appState.logs].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (sortedLogs.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="9" class="text-center text-muted py-5">
          <i class="fa-regular fa-folder-open text-muted d-block mb-2" style="font-size: 2.2rem;"></i>
          No records found. Complete a daily collection entry to populate this table.
        </td>
      </tr>
    `;
    return;
  }
  
  sortedLogs.forEach(log => {
    const fuelVal = log.metrics?.fuelSales ?? log.nozzles.reduce((sum, n) => sum + n.amount, 0);
    const oilVal = log.metrics?.oilSales ?? log.oils.reduce((sum, o) => sum + o.total, 0);
    const expVal = log.metrics?.expenses ?? log.expenses.reduce((sum, e) => sum + e.amount, 0);
    const expected = log.metrics?.expectedCash ?? 0;
    const actual = log.metrics?.actualCash ?? 0;
    const variance = log.metrics?.variance ?? (actual - expected);
    
    // Variance color markup
    let varMarkup = `<span class="text-bold">₹0.00</span>`;
    if (variance < 0) {
      varMarkup = `<span class="text-danger text-bold">- ₹${formatCurrency(Math.abs(variance))}</span>`;
    } else if (variance > 0) {
      varMarkup = `<span class="text-success text-bold">+ ₹${formatCurrency(variance)}</span>`;
    }
    
    const row = document.createElement('tr');
    row.className = 'responsive-row';
    row.innerHTML = `
      <td class="col-date text-bold" data-label="Date">${new Date(log.date).toLocaleDateString('en-IN')}</td>
      <td class="col-fuels" data-label="Fuel Sales">₹${formatCurrency(fuelVal)}</td>
      <td class="col-oils" data-label="Oil Sales">₹${formatCurrency(oilVal)}</td>
      <td class="col-exp text-danger" data-label="Expenses">₹${formatCurrency(expVal)}</td>
      <td class="col-exp-cash text-bold" data-label="Expected Cash">₹${formatCurrency(expected)}</td>
      <td class="col-act-cash text-bold text-primary" data-label="Actual Cash">₹${formatCurrency(actual)}</td>
      <td class="col-variance" data-label="Variance">${varMarkup}</td>
      <td class="col-remarks text-muted text-xs" data-label="Remarks" style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${log.flows.remarks || '--'}
      </td>
      <td class="col-actions" data-label="Actions">
        <div class="table-actions">
          <button class="btn-icon" onclick="editHistoryLog('${log.date}')" title="Edit Entry">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn-icon" onclick="printHistoryLog('${log.date}')" title="Print/Export Report">
            <i class="fa-solid fa-file-pdf"></i>
          </button>
          <button class="btn-icon delete-btn" onclick="deleteHistoryLog('${log.date}')" title="Delete Log">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    container.appendChild(row);
  });
}

function filterHistoryLogs() {
  const query = document.getElementById('history-search').value.toLowerCase();
  const rows = document.querySelectorAll('#history-table-rows tr');
  
  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    if (text.includes(query)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

function editHistoryLog(dateStr) {
  // Set date picker and trigger change load
  appState.currentDate = dateStr;
  document.getElementById('entry-date').value = dateStr;
  updateHeaderDateDisplay(dateStr);
  
  loadDayData(dateStr);
  switchTab('new-entry');
}

function deleteHistoryLog(dateStr) {
  if (confirm(`Are you sure you want to permanently delete the log for ${new Date(dateStr).toLocaleDateString('en-IN')}?`)) {
    appState.logs = appState.logs.filter(l => l.date !== dateStr);
    saveLogsToLocalStorage();
    renderHistory();
    showToast('Record deleted.');
    
    // If we are currently looking at that deleted date, reload workspace
    if (appState.currentDate === dateStr) {
      loadDayData(dateStr);
    }
  }
}

// -------------------------------------------------------------
// 7. PRINTING & REPORT GENERATION (PDF)
// -------------------------------------------------------------

function populatePrintTemplate(logData) {
  // Populate Metadata
  document.getElementById('print-date-val').innerText = new Date(logData.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('print-time-val').innerText = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // Populate Nozzles
  const nozzleTbody = document.getElementById('print-nozzle-rows');
  nozzleTbody.innerHTML = '';
  logData.nozzles.forEach(n => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${n.name}</td>
      <td class="text-right">₹${n.rate.toFixed(2)}</td>
      <td class="text-right">${n.opening.toFixed(2)}</td>
      <td class="text-right">${n.closing.toFixed(2)}</td>
      <td class="text-right">${n.testing.toFixed(2)}</td>
      <td class="text-right text-bold">${n.net.toFixed(2)}</td>
      <td class="text-right text-bold">₹${formatCurrency(n.amount)}</td>
    `;
    nozzleTbody.appendChild(tr);
  });

  // Populate Oils
  const oilTbody = document.getElementById('print-oil-rows');
  oilTbody.innerHTML = '';
  if (logData.oils && logData.oils.length > 0) {
    logData.oils.forEach(o => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${o.description}</td>
        <td class="text-right">₹${o.price.toFixed(2)}</td>
        <td class="text-right">${o.quantity}</td>
        <td class="text-right text-bold">₹${formatCurrency(o.total)}</td>
      `;
      oilTbody.appendChild(tr);
    });
  } else {
    oilTbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No Lubricants Sold</td></tr>`;
  }

  // Populate Expenses
  const expTbody = document.getElementById('print-expense-rows');
  expTbody.innerHTML = '';
  if (logData.expenses && logData.expenses.length > 0) {
    logData.expenses.forEach(e => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${e.description}</td>
        <td class="text-right text-bold text-danger">₹${formatCurrency(e.amount)}</td>
      `;
      expTbody.appendChild(tr);
    });
  } else {
    expTbody.innerHTML = `<tr><td colspan="2" class="text-center text-muted">No Expenses Paid</td></tr>`;
  }

  // Summaries Calculations
  const fuelSales = logData.nozzles.reduce((sum, n) => sum + n.amount, 0);
  const oilSales = logData.oils ? logData.oils.reduce((sum, o) => sum + o.total, 0) : 0;
  const boxIn = logData.flows.boxAmount;
  const creditRecv = logData.flows.creditRecv;
  const yesterdayPaytm = logData.flows.yesterdayPaytm || 0;
  
  const digitalPaytm = logData.flows.paytm;
  const digitalCard = logData.flows.card;
  const creditSaleToday = logData.flows.creditSale;
  const totalExp = logData.expenses ? logData.expenses.reduce((sum, e) => sum + e.amount, 0) : 0;
  const officeCash = logData.flows.officeCash || 0;

  const totalInflows = fuelSales + oilSales + boxIn + creditRecv;
  const totalOutflows = digitalPaytm + digitalCard + creditSaleToday + totalExp + officeCash + yesterdayPaytm;
  const expectedCash = totalInflows - totalOutflows;

  // Actual Cash calc
  let actualCash = 0;
  const v500 = (logData.denominations?.n500 || 0) * 500;
  const v200 = (logData.denominations?.n200 || 0) * 200;
  const v100 = (logData.denominations?.n100 || 0) * 100;
  const v50 = (logData.denominations?.n50 || 0) * 50;
  const v20 = (logData.denominations?.n20 || 0) * 20;
  const v10 = (logData.denominations?.n10 || 0) * 10;
  const vcoins = logData.denominations?.coins || 0;
  
  if (logData.cashMode === 'bundles') {
    actualCash = logData.cashBundles ? logData.cashBundles.reduce((sum, b) => sum + b.amount, 0) : 0;
  } else {
    actualCash = v500 + v200 + v100 + v50 + v20 + v10 + vcoins;
  }
  const variance = actualCash - expectedCash;

  // Insert Into Print Dom
  document.getElementById('print-sum-fuel').innerText = `₹${formatCurrency(fuelSales)}`;
  document.getElementById('print-sum-oil').innerText = `₹${formatCurrency(oilSales)}`;
  document.getElementById('print-sum-box-in').innerText = `₹${formatCurrency(boxIn)}`;
  document.getElementById('print-sum-credit-recv').innerText = `₹${formatCurrency(creditRecv)}`;
  const printYestPaytmEl = document.getElementById('print-sum-yesterday-paytm');
  if (printYestPaytmEl) printYestPaytmEl.innerText = yesterdayPaytm > 0 ? `₹${formatCurrency(yesterdayPaytm)}` : '—';
  document.getElementById('print-total-inflows').innerText = `₹${formatCurrency(totalInflows)}`;

  document.getElementById('print-sum-paytm').innerText = `₹${formatCurrency(digitalPaytm)}`;
  document.getElementById('print-sum-card').innerText = `₹${formatCurrency(digitalCard)}`;
  document.getElementById('print-sum-credit-sale').innerText = `₹${formatCurrency(creditSaleToday)}`;
  document.getElementById('print-sum-expenses').innerText = `₹${formatCurrency(totalExp)}`;
  const printOfficeCashEl = document.getElementById('print-sum-office-cash');
  if (printOfficeCashEl) printOfficeCashEl.innerText = officeCash > 0 ? `₹${formatCurrency(officeCash)}` : '—';
  document.getElementById('print-total-outflows').innerText = `₹${formatCurrency(totalOutflows)}`;

  document.getElementById('print-expected-cash').innerText = `₹${formatCurrency(expectedCash)}`;
  document.getElementById('print-actual-cash').innerText = `₹${formatCurrency(actualCash)}`;
  
  // Format Variance
  let varText = `₹${formatCurrency(variance)}`;
  if (variance < 0) {
    varText = `- ₹${formatCurrency(Math.abs(variance))} (Shortage)`;
  } else if (variance > 0) {
    varText = `+ ₹${formatCurrency(variance)} (Excess)`;
  } else {
    varText = `₹0.00 (Balanced)`;
  }
  document.getElementById('print-variance').innerText = varText;

  // Denominations / Bundles Grid
  const denomGrid = document.getElementById('print-denom-grid');
  if (logData.cashMode === 'bundles') {
    let bundleHtml = '';
    if (logData.cashBundles && logData.cashBundles.length > 0) {
      logData.cashBundles.forEach((b, i) => {
        if (b.amount > 0) {
          bundleHtml += `<div><strong>Bundle ${i+1}:</strong> ₹${formatCurrency(b.amount)}</div>`;
        }
      });
      if (bundleHtml === '') bundleHtml = '<div style="grid-column: span 4;">No Cash Entered</div>';
    } else {
      bundleHtml = '<div style="grid-column: span 4;">No Cash Entered</div>';
    }
    denomGrid.innerHTML = bundleHtml;
  } else {
    denomGrid.innerHTML = `
      <div><strong>₹500:</strong> ${logData.denominations?.n500 || 0} pcs (₹${v500})</div>
      <div><strong>₹200:</strong> ${logData.denominations?.n200 || 0} pcs (₹${v200})</div>
      <div><strong>₹100:</strong> ${logData.denominations?.n100 || 0} pcs (₹${v100})</div>
      <div><strong>₹50:</strong> ${logData.denominations?.n50 || 0} pcs (₹${v50})</div>
      <div><strong>₹20:</strong> ${logData.denominations?.n20 || 0} pcs (₹${v20})</div>
      <div><strong>₹10:</strong> ${logData.denominations?.n10 || 0} pcs (₹${v10})</div>
      <div style="grid-column: span 2;"><strong>Coins/Loose:</strong> ₹${formatCurrency(vcoins)}</div>
    `;
  }

  document.getElementById('print-carry-box').innerText = `₹${formatCurrency(logData.flows.carryBoxAmount)}`;
  document.getElementById('print-remarks').innerText = logData.flows.remarks || 'No notes added for the day.';
}

function printSummaryReport() {
  saveCurrentStateToMemory();
  
  const currentTempLog = {
    date: appState.currentDate,
    nozzles: appState.nozzles,
    oils: appState.oils,
    expenses: appState.expenses,
    flows: appState.flows,
    denominations: appState.denominations
  };
  
  populatePrintTemplate(currentTempLog);
  window.print();
}

function printHistoryLog(dateStr) {
  const log = appState.logs.find(l => l.date === dateStr);
  if (!log) {
    showToast('Failed to find matching historical log data.', true);
    return;
  }
  populatePrintTemplate(log);
  window.print();
}

// -------------------------------------------------------------
// 8. SYSTEM SETTINGS & CONFIGURATIONS
// -------------------------------------------------------------

function renderSettings() {
  // Render Settings Nozzles
  const nozzleContainer = document.getElementById('settings-nozzle-rows');
  nozzleContainer.innerHTML = '';
  
  appState.settings.defaultNozzles.forEach((nozzle, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <input type="text" class="form-control-inline text-bold" value="${nozzle.name}" onchange="updateDefaultNozzleSetting(${idx}, 'name', this.value)">
      </td>
      <td>
        <input type="number" step="0.01" class="form-control-inline text-right" value="${nozzle.rate}" oninput="updateDefaultNozzleSetting(${idx}, 'rate', this.value)">
      </td>
      <td class="text-center">
        <button class="btn-icon delete-btn" onclick="deleteDefaultNozzleSetting(${idx})" title="Remove Nozzle">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    nozzleContainer.appendChild(tr);
  });

  // Render Settings Oils
  const oilContainer = document.getElementById('settings-oil-rows');
  oilContainer.innerHTML = '';
  
  appState.settings.defaultOils.forEach((oil, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <input type="text" class="form-control-inline text-bold" value="${oil.description}" onchange="updateDefaultOilSetting(${idx}, 'description', this.value)">
      </td>
      <td>
        <input type="number" step="0.01" class="form-control-inline text-right" value="${oil.price}" oninput="updateDefaultOilSetting(${idx}, 'price', this.value)">
      </td>
      <td class="text-center">
        <button class="btn-icon delete-btn" onclick="deleteDefaultOilSetting(${idx})" title="Remove Oil">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    oilContainer.appendChild(tr);
  });
}

function updateDefaultNozzleSetting(idx, field, value) {
  const val = field === 'rate' ? parseFloat(value) || 0 : value;
  appState.settings.defaultNozzles[idx][field] = val;
  saveSettingsToLocalStorage();
}

function addDefaultNozzleSetting() {
  appState.settings.defaultNozzles.push({
    name: 'New Fuel Nozzle',
    rate: 100.00
  });
  saveSettingsToLocalStorage();
  renderSettings();
}

function deleteDefaultNozzleSetting(idx) {
  appState.settings.defaultNozzles.splice(idx, 1);
  saveSettingsToLocalStorage();
  renderSettings();
}

function updateDefaultOilSetting(idx, field, value) {
  const val = field === 'price' ? parseFloat(value) || 0 : value;
  appState.settings.defaultOils[idx][field] = val;
  saveSettingsToLocalStorage();
}

function addDefaultOilSetting() {
  appState.settings.defaultOils.push({
    description: 'New Oil Lubricant',
    price: 300.00
  });
  saveSettingsToLocalStorage();
  renderSettings();
}

function deleteDefaultOilSetting(idx) {
  appState.settings.defaultOils.splice(idx, 1);
  saveSettingsToLocalStorage();
  renderSettings();
}

function clearAllApplicationData() {
  if (confirm('CRITICAL WARNING: This will delete ALL daily records from the browser database permanently. Make sure you exported a backup first.\n\nType "RESET" to confirm.')) {
    const text = prompt('Type "RESET" to execute wipe-out:');
    if (text === 'RESET') {
      localStorage.removeItem('fuelflow_logs');
      localStorage.removeItem('fuelflow_settings');
      showToast('Wiped out all database configurations!', true);
      setTimeout(() => {
        location.reload();
      }, 1000);
    }
  }
}

// -------------------------------------------------------------
// 9. BACKUP EXPORT & IMPORT UTILITIES
// -------------------------------------------------------------

function exportBackupJSON() {
  const backup = {
    settings: appState.settings,
    logs: appState.logs,
    exportDate: new Date().toISOString(),
    version: 'fuelflow-1.0.0'
  };
  
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `fuelflow-pump-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('Backup file exported successfully.');
}

function importBackupJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = JSON.parse(evt.target.result);
      
      // Validation check
      if (data.version && data.version.startsWith('fuelflow')) {
        if (confirm(`Backup file contains ${data.logs?.length || 0} history records and pump settings. Overwrite browser data?`)) {
          if (data.settings) appState.settings = data.settings;
          if (data.logs) appState.logs = data.logs;
          
          saveSettingsToLocalStorage();
          saveLogsToLocalStorage();
          
          showToast('Data imported successfully!');
          setTimeout(() => {
            location.reload();
          }, 1000);
        }
      } else {
        alert('Invalid backup file structure. Ensure you upload a valid FuelFlow backup JSON file.');
      }
    } catch(err) {
      alert('Error parsing JSON backup file. Check file corruption.');
    }
  };
  reader.readAsText(file);
}

// -------------------------------------------------------------
// 10. SYSTEM UI AUXILIARY HELPERS
// -------------------------------------------------------------

function formatCurrency(num) {
  // Format numbers with comma separation in Indian Format (Lakhs, Crores) or standard thousands
  // Indian Style currency regex:
  const rounded = Math.round(num * 100) / 100;
  const parts = rounded.toFixed(2).split('.');
  let lastThree = parts[0].substring(parts[0].length - 3);
  const otherBits = parts[0].substring(0, parts[0].length - 3);
  if (otherBits !== '') {
    lastThree = ',' + lastThree;
  }
  const formatted = otherBits.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree + "." + parts[1];
  return formatted;
}

// Toast Alert System
function showToast(message, isDanger = false) {
  // Check if a toast container already exists
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 1000;
    `;
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.style.cssText = `
    background-color: ${isDanger ? 'var(--danger)' : 'var(--bg-secondary)'};
    color: ${isDanger ? 'var(--text-white)' : 'var(--text-main)'};
    padding: 0.85rem 1.5rem;
    border-radius: var(--border-radius);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: 0.9rem;
    border-left: 5px solid ${isDanger ? 'rgba(0,0,0,0.2)' : 'var(--primary)'};
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transform: translateY(20px);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
  `;
  
  toast.innerHTML = `
    <i class="fa-solid ${isDanger ? 'fa-circle-exclamation' : 'fa-circle-check'}" style="color: ${isDanger ? 'white' : 'var(--success)'}"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  // Trigger animation frame
  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });
  
  // Remove after 3.5 seconds
  setTimeout(() => {
    toast.style.transform = 'translateY(-20px)';
    toast.style.opacity = '0';
    setTimeout(() => {
      container.removeChild(toast);
    }, 300);
  }, 3500);
}

// -------------------------------------------------------------
// PWA INSTALL PROMPT HANDLING
// -------------------------------------------------------------
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the default browser install prompt
  e.preventDefault();
  deferredInstallPrompt = e;
  
  // Check if user hasn't dismissed the banner recently
  const dismissed = localStorage.getItem('fuelflow_pwa_dismissed');
  if (dismissed) {
    const dismissedTime = parseInt(dismissed, 10);
    // Don't show again for 7 days after dismissal
    if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) return;
  }
  
  // Show the custom install banner
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'block';
});

// Install button click
document.addEventListener('DOMContentLoaded', () => {
  const installBtn = document.getElementById('pwa-install-btn');
  const dismissBtn = document.getElementById('pwa-dismiss-btn');
  const banner = document.getElementById('pwa-install-banner');
  
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      
      if (outcome === 'accepted') {
        showToast('FuelFlow installed successfully! 🎉', 'success');
      }
      
      deferredInstallPrompt = null;
      if (banner) banner.style.display = 'none';
    });
  }
  
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      if (banner) banner.style.display = 'none';
      localStorage.setItem('fuelflow_pwa_dismissed', Date.now().toString());
    });
  }
});

// Listen for successful installation
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'none';
  console.log('[PWA] FuelFlow was installed');
});
