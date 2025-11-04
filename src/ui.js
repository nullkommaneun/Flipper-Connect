// Heartbeat
window.__app_heartbeat = true;

if (window.__diag) {
  window.__diag('INIT: ui.js Modul-Ausführung gestartet.', 'INFO');
}

// Imports
import {BluetoothManager} from './bluetooth.js';
import {log, shortUuid, bufferToHex, bufferToText, bufferToBase64, encodePayload, parseManufacturerData, calculateDistance} from './utils.js';

// 1. Element-Selektoren
const $=s=>document.querySelector(s);
// ... (safeQuery unverändert) ...
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

// Konfiguration für Charts & Stale-Modus
const RSSI_HISTORY_LENGTH = 20;
let chartConfigTemplate; 
const STALE_TIMEOUT = 10000; // 10 Sekunden
let staleCheckInterval = null; // Hält die ID des Timers


// 3. UI-Hilfsfunktionen
// ... (setPreflight, setConnectedUI, renderExplorer, renderParsedData bleiben unverändert) ...
function setPreflight(){
    // ... (unverändert)
}
function setConnectedUI(isConnected){
    // ... (unverändert)
}
function renderExplorer(tree){
  // ... (unverändert)
}
function renderParsedData(parsedData, distance) {
    // ... (unverändert)
}

/**
 * Verarbeitet empfangene Beacon-Daten.
 * @param {BluetoothAdvertisingEvent} event
 */
function handleBeaconData(event) {
    const deviceName = event.device.name || 'Unbekanntes Gerät';
    const deviceId = event.device.id;
    const rssi = event.rssi;
    
    // 1. Daten parsen
    const parsedData = parseManufacturerData(event.manufacturerData);
    
    // 2. Distanz berechnen
    let distance = null;
    if (parsedData.txPower) {
        distance = calculateDistance(rssi, parsedData.txPower, 3.0);
    }
    
    // 3. Für JSON speichern
    recordedData.push({
        timestamp: new Date().toISOString(),
        id: deviceId,
        name: deviceName,
        rssi: rssi,
        manufacturerData: parsedData,
        estimatedDistance: distance ? distance.toFixed(2) + 'm' : null
    });

    // 4. Live-UI
    const dataHtml = renderParsedData(parsedData, distance);
    
    if (!discoveredDevices.has(deviceId)) {
        // --- GERÄT IST NEU: Karteikarte UND Chart erstellen ---
        const card = document.createElement('div');
        card.className = 'beacon-card';
        if (parsedData.txPower) {
            card.classList.add('has-txpower');
        }
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
            chartLabels: chartData.labels,
            rssi: rssi,
            lastSeen: Date.now() // --- NEU: Zeitstempel setzen ---
        }); 
        
        updateChart(discoveredDevices.get(deviceId), rssi);
    
    } else {
        // --- GERÄT IST BEKANNT: Karteikarte UND Chart aktualisieren ---
        const deviceEntry = discoveredDevices.get(deviceId);
        
        deviceEntry.rssi = rssi;
        deviceEntry.lastSeen = Date.now(); // --- NEU: Zeitstempel aktualisieren ---
        
        deviceEntry.card.querySelector('[data-field="rssi"]').textContent = rssi;
        deviceEntry.card.querySelector('[data-field="name"]').textContent = deviceName;
        
        const manufDataEl = deviceEntry.card.querySelector('[data-field="manufData"]');
        manufDataEl.innerHTML = dataHtml;
        
        deviceEntry.card.classList.toggle('has-txpower', !!parsedData.txPower);
        
        updateChart(deviceEntry, rssi);
    }
}

/**
 * Hilfsfunktion zum Aktualisieren eines Graphen mit einem neuen RSSI-Wert.
 */
function updateChart(deviceEntry, rssi) {
    // ... (unverändert)
}

/**
 * Sortiert die Beacon-Liste im DOM nach dem zuletzt gesehenen RSSI.
 */
function sortDisplayByRssi() {
    // ... (unverändert)
}

/**
 * NEU: Timer-Funktion, die alte Geräte ausgraut.
 */
function checkStaleDevices() {
    const now = Date.now();
    for (const device of discoveredDevices.values()) {
        const isStale = (now - device.lastSeen) > STALE_TIMEOUT;
        device.card.classList.toggle('is-stale', isStale);
    }
}


// 4. Haupt-Initialisierungs-Funktion
function init() {
    try {
        if (window.__diag) window.__diag('INIT: DOMContentLoaded Event gefeuert.', 'INFO');

        // 1. Abhängigkeiten prüfen
        if (typeof Chart === 'undefined') {
            throw new Error('Chart.js (Chart) ist nicht geladen.');
        }
        if (window.__diag) window.__diag('INIT: Chart.js-Abhängigkeit OK.', 'INFO');

        // 2. Chart-Konfiguration erstellen
        chartConfigTemplate = {
            // ... (unverändert)
        };

        // 3. DOM-Elemente sicher zuweisen
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
            sortRssi: safeQuery('#btnSortRssi')
        };
        if (window.__diag) window.__diag('INIT: DOM-Elemente erfolgreich geprüft und zugewiesen.', 'INFO');
        
        // 4. Preflight-Check ausführen
        setPreflight();
        
        // 5. Bluetooth Manager initialisieren
        mgr = new BluetoothManager({
            // ... (unverändert)
        });
        
        // 6. Alle Event-Listener registrieren
        // ... (el.connect, el.disconnect, el.send bleiben unverändert) ...
        el.connect.addEventListener('click',async()=>{/*...*/});
        el.disconnect.addEventListener('click',async()=>{/*...*/});
        el.send.addEventListener('click',async()=>{/*...*/});
        
        // --- 'startScan' LISTENER ANGEPASST ---
        el.startScan.addEventListener('click', async () => {
          try {
              recordedData = []; 
              discoveredDevices.clear(); 
              el.beaconDisplay.innerHTML = ''; 
              
              log(el.log, 'INFO', 'Starte passiven Scan (Datenjagd)...');
              
              await mgr.startScan(handleBeaconData); 
              
              log(el.log, 'INFO', 'Beacon-Liste wird aufgebaut...');
              
              // NEU: Starte den "Stale"-Checker
              if (staleCheckInterval) clearInterval(staleCheckInterval);
              staleCheckInterval = setInterval(checkStaleDevices, 2000); // Prüft alle 2 Sek.
              
              el.startScan.disabled = true;
              el.stopScan.disabled = false;
              el.download.disabled = true; 
              el.connect.disabled = true;
              el.disconnect.disabled = true;
              el.send.disabled = true;
              
          } catch (e) {
              log(el.log, 'ERROR', `Scan konnte nicht gestartet werden: ${e.message}`);
              // ... (Fehlerbehandlung unverändert) ...
              if (window.__diag) window.__diag(`SCAN-FEHLER: ${e.message}`);
          }
        });
        
        // --- 'stopScan' LISTENER ANGEPASST ---
        el.stopScan.addEventListener('click', () => {
          mgr.stopScan();
          
          // NEU: Stoppe den "Stale"-Checker
          if (staleCheckInterval) clearInterval(staleCheckInterval);
          staleCheckInterval = null;
          
          el.startScan.disabled = false;
          el.stopScan.disabled = true;
          el.download.disabled = false; 
          setConnectedUI(false); 
          log(el.log, 'INFO', 'Scan gestoppt. Download ist bereit.');
        });
        
        // ... (el.download, el.sortRssi bleiben unverändert) ...
        el.download.addEventListener('click', () => {/*...*/});
        el.sortRssi.addEventListener('click', () => {/*...*/});

        if (window.__diag) window.__diag('INIT: App-Initialisierung (Listener) ERFOLGREICH.', 'INFO');
        
    } catch (e) {
        // ... (Fehlerbehandlung unverändert) ...
    }
}

// 5. Event Listener
document.addEventListener('DOMContentLoaded', init);
 
