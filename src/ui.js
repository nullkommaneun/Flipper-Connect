// Heartbeat
window.__app_heartbeat = true;

if (window.__diag) {
  window.__diag('INIT: ui.js Modul-Ausführung gestartet.', 'INFO');
}

// Imports
import {BluetoothManager} from './bluetooth.js';
import {log, shortUuid, bufferToHex, bufferToText, bufferToBase64, encodePayload, parseManufacturerData} from './utils.js';

// 1. Element-Selektoren
const $=s=>document.querySelector(s);

function safeQuery(selector, context = document) {
    // ... (Code unverändert)
}

let el = {}; 

// 2. Globale Zustandsvariablen
let mgr;
let notifyUnsub=null;
let recordedData = []; 
let discoveredDevices = new Map(); 

// Konfiguration für die Charts
const RSSI_HISTORY_LENGTH = 20;
let chartConfigTemplate; 


// 3. UI-Hilfsfunktionen
// ... (setPreflight, setConnectedUI, renderExplorer, renderParsedData bleiben unverändert) ...
function setPreflight(){
    // ... (Code unverändert)
}
function setConnectedUI(isConnected){
    // ... (Code unverändert)
}
function renderExplorer(tree){
  // ... (Code unverändert)
}
function renderParsedData(parsedData) {
    // ... (Code unverändert)
}


/**
 * Verarbeitet empfangene Beacon-Daten.
 * @param {BluetoothAdvertisingEvent} event
 */
function handleBeaconData(event) {
    const deviceName = event.device.name || 'Unbekanntes Gerät';
    const deviceId = event.device.id;
    const rssi = event.rssi;
    
    const parsedData = parseManufacturerData(event.manufacturerData);
    
    recordedData.push({
        timestamp: new Date().toISOString(),
        id: deviceId,
        name: deviceName,
        rssi: rssi,
        manufacturerData: parsedData 
    });

    const dataHtml = renderParsedData(parsedData);
    
    if (!discoveredDevices.has(deviceId)) {
        // --- GERÄT IST NEU: Karteikarte UND Chart erstellen ---
        const card = document.createElement('div');
        // ... (Code für card.innerHTML unverändert) ...
        card.innerHTML = `
            <span class="rssi" data-field="rssi">${rssi}</span>
            <strong data-field="name">${deviceName}</strong>
            <span class="data-label" data-field="id">${deviceId}</span>
            <div class="chart-container">
                <canvas class="beacon-chart"></canvas>
            </div>
            <span class="data-label">Manufacturer Data:</span>
            <div data-field="manufData">
                ${dataHtml}
            </div>
        `;
        el.beaconDisplay.appendChild(card);
        
        const canvas = safeQuery(`.beacon-chart`, card); 
        // ... (Code für chartData und config unverändert) ...
        const chartData = {
             labels: Array(RSSI_HISTORY_LENGTH).fill(''),
             datasets: [{ /* ... */ }]
        };
        const config = JSON.parse(JSON.stringify(chartConfigTemplate));
        config.data = chartData;
        
        const chart = new Chart(canvas, config);
        
        discoveredDevices.set(deviceId, {
            card: card,
            chart: chart,
            chartData: chartData.datasets[0].data,
            chartLabels: chartData.labels,
            rssi: rssi // WICHTIG: Den aktuellen RSSI-Wert speichern
        }); 
        
        updateChart(discoveredDevices.get(deviceId), rssi);
    
    } else {
        // --- GERÄT IST BEKANNT: Karteikarte UND Chart aktualisieren ---
        const deviceEntry = discoveredDevices.get(deviceId);
        
        deviceEntry.rssi = rssi; // WICHTIG: Den RSSI-Wert aktualisieren
        deviceEntry.card.querySelector('[data-field="rssi"]').textContent = rssi;
        deviceEntry.card.querySelector('[data-field="name"]').textContent = deviceName;
        
        const manufDataEl = deviceEntry.card.querySelector('[data-field="manufData"]');
        manufDataEl.innerHTML = dataHtml;
        
        updateChart(deviceEntry, rssi);
    }
}

/**
 * Hilfsfunktion zum Aktualisieren eines Graphen mit einem neuen RSSI-Wert.
 */
function updateChart(deviceEntry, rssi) {
    // ... (Code unverändert)
}

/**
 * NEU: Sortiert die Beacon-Liste im DOM nach dem zuletzt gesehenen RSSI.
 */
function sortDisplayByRssi() {
    log(el.log, 'INFO', 'Sortiere Beacon-Liste nach RSSI (stärkstes Signal zuerst)...');
    
    // 1. Hole alle Einträge aus der Map
    const devices = Array.from(discoveredDevices.values());
    
    // 2. Sortiere sie (b.rssi - a.rssi für absteigend)
    devices.sort((a, b) => {
        // Fallback für fehlende RSSI-Werte
        const rssiA = a.rssi || -999;
        const rssiB = b.rssi || -999;
        return rssiB - rssiA;
    });
    
    // 3. Hänge die Karten-Elemente in der neuen Reihenfolge an.
    // appendChild verschiebt die Elemente automatisch an das Ende,
    // wodurch die neue Sortierung im DOM entsteht.
    devices.forEach(device => {
        el.beaconDisplay.appendChild(device.card);
    });
}


// 4. Haupt-Initialisierung
document.addEventListener('DOMContentLoaded', () => {
  try {
    if (window.__diag) window.__diag('INIT: DOMContentLoaded Event gefeuert.', 'INFO');

    // Chart.js-Abhängigkeits-Prüfung
    if (typeof Chart === 'undefined') {
        throw new Error('Chart.js (Chart) ist nicht geladen. Prüfe die index.html auf blockierte CDN-Links (z.B. Ad-Blocker).');
    }
    if (window.__diag) window.__diag('INIT: Chart.js-Abhängigkeit OK.', 'INFO');
    
    // Chart.js-Grundkonfiguration definieren
    chartConfigTemplate = {
        // ... (Code unverändert)
    };

    // DOM-Elemente sicher zuweisen
    el = {
        preflight: safeQuery('#preflight'),
        connect: safeQuery('#btnConnect'),
        disconnect: safeQuery('#btnDisconnect'),
        state: safeQuery('#connState'),
        explorer: safeQuery('#explorer'),
        log: safeQuery('#terminalLog'),
        charSelect: safeQuery('#charSelect'),
        encoding: safeQuery('#encoding'),
        input: safeQuery('#terminalInput'),
        send: safeQuery('#btnSend'),
        startScan: safeQuery('#btnStartScan'),
        stopScan: safeQuery('#btnStopScan'),
        download: safeQuery('#btnDownloadLog'),
        beaconDisplay: safeQuery('#beaconDisplay'),
        sortRssi: safeQuery('#btnSortRssi') // NEU
    };
    if (window.__diag) window.__diag('INIT: DOM-Elemente erfolgreich geprüft und zugewiesen.', 'INFO');
    
    setPreflight();
    
    mgr = new BluetoothManager({
        // ... (Code unverändert)
    });
    
    // --- Event Listeners ---
    // ... (el.connect, el.disconnect, el.send bleiben unverändert) ...
    el.connect.addEventListener('click',async()=>{/*...*/});
    el.disconnect.addEventListener('click',async()=>{/*...*/});
    el.send.addEventListener('click',async()=>{/*...*/});
    
    // ... (el.startScan, el.stopScan, el.download bleiben unverändert) ...
    el.startScan.addEventListener('click', async () => {
      // ... (Code unverändert)
    });
    el.stopScan.addEventListener('click', () => {
      // ... (Code unverändert)
    });
    el.download.addEventListener('click', () => {
      // ... (Code unverändert)
    });
    
    // NEUER LISTENER
    el.sortRssi.addEventListener('click', () => {
        sortDisplayByRssi();
    });

    if (window.__diag) window.__diag('INIT: App-Initialisierung (Listener) ERFOLGREICH.', 'INFO');
    
  } catch (e) {
    if (window.__diag) {
      // ... (Error-Handling unverändert) ...
    }
  }
});
 
