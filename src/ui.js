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

/**
 * Sucht ein DOM-Element; wirft einen Fehler, wenn es nicht gefunden wird.
 * @param {string} selector 
 * @param {Document|HTMLElement} context 
 * @returns {HTMLElement}
 */
function safeQuery(selector, context = document) {
    const element = context.querySelector(selector);
    if (!element) {
        throw new Error(`Kritisches DOM-Element nicht gefunden: ${selector}`);
    }
    return element;
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
function setPreflight(){
    if(BluetoothManager.preflight()){
        el.preflight.textContent='Web Bluetooth: OK';
        if(window.__diag) window.__diag('Preflight Check: OK', 'INFO');
    } else {
        el.preflight.textContent='Web Bluetooth nicht unterstützt';
        if(window.__diag) window.__diag('Preflight Check: Web Bluetooth nicht unterstützt', 'WARN');
    }
}
function setConnectedUI(isConnected){
    el.connect.disabled=isConnected;
    el.disconnect.disabled=!isConnected;
    el.state.textContent=isConnected?'Verbunden':'Getrennt';
    el.send.disabled=!isConnected;
}

function renderExplorer(tree){
  // ... (Code unverändert)
  el.explorer.innerHTML='';
  el.charSelect.innerHTML='';
  for(const svc of tree){
    const d=document.createElement('details');
    // ...
    el.explorer.append(d);
  }
}

function renderParsedData(parsedData) {
    // ... (Code unverändert)
    if (parsedData.type === 'parsed') {
        let html = '<dl class="parsed-data">';
        // ...
        return html;
    } else {
        let html = '<pre class="raw-data">';
        // ...
        return html;
    }
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
        // ... (Code unverändert)
    });

    const dataHtml = renderParsedData(parsedData);
    
    if (!discoveredDevices.has(deviceId)) {
        // --- GERÄT IST NEU: Karteikarte UND Chart erstellen ---
        const card = document.createElement('div');
        card.className = 'beacon-card';
        
        // Wir bereinigen auch die Karten-ID, nur zur Sicherheit
        const safeDeviceId = deviceId.replace(/[^a-zA-Z0-9_-]/g, '');
        card.id = `device-${safeDeviceId}`; 
        
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
        
        // --- HIER IST DIE KORREKTUR ---
        // Wir suchen nach der Klasse ".beacon-chart" *innerhalb* der "card",
        // die wir gerade erstellt haben.
        const canvas = safeQuery(`.beacon-chart`, card); 
        
        const chartData = {
             labels: Array(RSSI_HISTORY_LENGTH).fill(''),
             datasets: [{
                label: 'RSSI',
                data: Array(RSSI_HISTORY_LENGTH).fill(null),
                borderColor: '#00ff41',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4 
            }]
        };
        const config = JSON.parse(JSON.stringify(chartConfigTemplate));
        config.data = chartData;
        
        const chart = new Chart(canvas, config);
        
        discoveredDevices.set(deviceId, {
            card: card,
            chart: chart,
            chartData: chartData.datasets[0].data,
            chartLabels: chartData.labels
        }); 
        
        updateChart(discoveredDevices.get(deviceId), rssi);
    
    } else {
        // --- GERÄT IST BEKANNT: Karteikarte UND Chart aktualisieren ---
        const deviceEntry = discoveredDevices.get(deviceId);
        
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
    deviceEntry.chartData.shift();
    // ...
    deviceEntry.chart.update('none'); 
}


// 4. Haupt-Initialisierung
document.addEventListener('DOMContentLoaded', () => {
  try {
    if (window.__diag) window.__diag('INIT: DOMContentLoaded Event gefeuert.', 'INFO');

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
        beaconDisplay: safeQuery('#beaconDisplay')
    };
    if (window.__diag) window.__diag('INIT: DOM-Elemente erfolgreich geprüft und zugewiesen.', 'INFO');
    
    setPreflight();
    
    mgr = new BluetoothManager({
        // ... (Code unverändert)
    });
    
    // --- Event Listeners ---
    // ... (el.connect, el.disconnect, el.send bleiben unverändert) ...
    
    // el.startScan, el.stopScan, el.download bleiben unverändert
    el.startScan.addEventListener('click', async () => {
      // ... (Code unverändert)
    });
    el.stopScan.addEventListener('click', () => {
      // ... (Code unverändert)
    });
    el.download.addEventListener('click', () => {
      // ... (Code unverändert)
    });

    if (window.__diag) window.__diag('INIT: App-Initialisierung (Listener) ERFOLGREICH.', 'INFO');
    
  } catch (e) {
    if (window.__diag) {
      window.__diag('KRITISCH: Fehler während der App-Initialisierung (DOMContentLoaded).');
      window.__diag(`FEHLER: ${e.message}`);
      window.__diag(`STACK: ${e.stack}`);
    } else {
      console.error('KRITISCHER FEHLER (DOMContentLoaded):', e);
      alert('Kritischer Init-Fehler: ' + e.message);
    }
    
    const preflightEl = document.getElementById('preflight');
    if (preflightEl) {
        preflightEl.textContent = 'FEHLER: App-Init fehlgeschlagen';
        preflightEl.className = 'badge error';
    }
  }
});
