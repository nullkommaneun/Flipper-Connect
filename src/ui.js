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
// ... (safeQuery unverändert) ...
let el = {}; 

// 2. Globale Zustandsvariablen
let mgr;
let notifyUnsub=null;
let recordedData = []; 
let discoveredDevices = new Map(); 

// --- NEU: Konfiguration für die Charts ---
const RSSI_HISTORY_LENGTH = 20; // Zeige die letzten 20 RSSI-Werte
let chartConfigTemplate; // Definieren wir in DOMContentLoaded


// 3. UI-Hilfsfunktionen
// ... (setPreflight, setConnectedUI, renderExplorer, renderParsedData unverändert) ...
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
    // ... (Restlicher Code unverändert)
    el.explorer.append(d);
  }
}
function renderParsedData(parsedData) {
    // ... (Code unverändert)
    if (parsedData.type === 'parsed') {
        // ...
        return html;
    } else {
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
        card.id = `device-${deviceId}`; 
        
        // NEU: <canvas> für den Graphen hinzugefügt
        card.innerHTML = `
            <span class="rssi" data-field="rssi">${rssi}</span>
            <strong data-field="name">${deviceName}</strong>
            <span class="data-label" data-field="id">${deviceId}</span>
            
            <div class="chart-container">
                <canvas id="chart-${deviceId}"></canvas>
            </div>
            
            <span class="data-label">Manufacturer Data:</span>
            <div data-field="manufData">
                ${dataHtml}
            </div>
        `;
        el.beaconDisplay.appendChild(card);
        
        // --- NEU: Chart.js initialisieren ---
        const canvas = safeQuery(`#chart-${deviceId}`);
        const chartData = {
             labels: Array(RSSI_HISTORY_LENGTH).fill(''),
             datasets: [{
                label: 'RSSI',
                data: Array(RSSI_HISTORY_LENGTH).fill(null), // Mit 'null' füllen, damit es leer startet
                borderColor: '#00ff41', // Linienfarbe (Hacker-Grün)
                borderWidth: 2,
                pointRadius: 0, // Keine Punkte
                tension: 0.4 // Glatte Kurven
            }]
        };
        // Tiefenkopie der Vorlage erstellen
        const config = JSON.parse(JSON.stringify(chartConfigTemplate));
        config.data = chartData;
        
        const chart = new Chart(canvas, config);
        
        // Chart-Instanz und Daten speichern
        discoveredDevices.set(deviceId, {
            card: card,
            chart: chart,
            chartData: chartData.datasets[0].data,
            chartLabels: chartData.labels
        }); 
        
        // Den ersten RSSI-Wert hinzufügen
        updateChart(discoveredDevices.get(deviceId), rssi);
    
    } else {
        // --- GERÄT IST BEKANNT: Karteikarte UND Chart aktualisieren ---
        const deviceEntry = discoveredDevices.get(deviceId);
        
        deviceEntry.card.querySelector('[data-field="rssi"]').textContent = rssi;
        deviceEntry.card.querySelector('[data-field="name"]').textContent = deviceName;
        
        const manufDataEl = deviceEntry.card.querySelector('[data-field="manufData"]');
        manufDataEl.innerHTML = dataHtml;
        
        // NEU: Chart aktualisieren
        updateChart(deviceEntry, rssi);
    }
}

/**
 * NEU: Hilfsfunktion zum Aktualisieren eines Graphen mit einem neuen RSSI-Wert.
 */
function updateChart(deviceEntry, rssi) {
    // Alten Wert entfernen (shift)
    deviceEntry.chartData.shift();
    deviceEntry.chartLabels.shift();
    
    // Neuen Wert hinzufügen (push)
    deviceEntry.chartData.push(rssi);
    deviceEntry.chartLabels.push('');
    
    // Y-Achse dynamisch anpassen (optional, aber nützlich)
    const minRssi = Math.min(...deviceEntry.chartData.filter(v => v !== null));
    const maxRssi = Math.max(...deviceEntry.chartData.filter(v => v !== null));
    deviceEntry.chart.options.scales.y.min = minRssi - 5;
    deviceEntry.chart.options.scales.y.max = maxRssi + 5;
    
    // Chart neu zeichnen
    deviceEntry.chart.update('none'); // 'none' für keine Animation
}


// 4. Haupt-Initialisierung
document.addEventListener('DOMContentLoaded', () => {
  try {
    if (window.__diag) window.__diag('INIT: DOMContentLoaded Event gefeuert.', 'INFO');

    // --- NEU: Chart.js-Grundkonfiguration definieren ---
    chartConfigTemplate = {
        type: 'line',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }, // Legende ausblenden
                tooltip: { enabled: false } // Tooltips ausblenden
            },
            scales: {
                x: { // X-Achse (Zeit)
                    display: false, // Achsenbeschriftung ausblenden
                    grid: { display: false }
                },
                y: { // Y-Achse (RSSI)
                    display: true, // Achse anzeigen
                    grid: { color: '#333333' }, // Gitterlinien-Farbe
                    ticks: { 
                        color: '#8f8f8f', // Achsen-Zahlen-Farbe
                        font: { size: 10 }
                    },
                    min: -100, // Standard-Min/Max
                    max: -20
                }
            }
        }
    };
    // --- Ende NEU ---

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
        onDisconnect: () => {
            setConnectedUI(false);
            log(el.log, 'DISCONNECTED', 'Getrennt');
        },
        logEl: el.log
    });
    
    // --- Event Listeners ---
    // ... (el.connect, el.disconnect, el.send bleiben unverändert) ...
    el.connect.addEventListener('click',async()=>{try{log(el.log,'INFO','Geräteauswahl…');const ok=await mgr.connect();if(ok){setConnectedUI(true);log(el.log,'CONNECTED',mgr.device?.name||'Unbekannt');const tree=await mgr.discover();renderExplorer(tree);}}catch(e){log(el.log,'ERROR',e.message);}});
    el.disconnect.addEventListener('click',async()=>{await mgr.disconnect();setConnectedUI(false);log(el.log,'DISCONNECTED','Trennen ok');});
    el.send.addEventListener('click',async()=>{try{const uuid=el.charSelect.value;if(!uuid)throw new Error('Keine Characteristic gewählt');const payload=el.input.value;const enc=el.encoding.value;const buf=encodePayload(payload,enc);await mgr.write(uuid,buf);log(el.log,'WRITE',`${uuid}: ${payload}`);}catch(e){log(el.log,'ERROR',e.message);}});
    
    // WICHTIG: 'el.startScan' muss 'discoveredDevices.clear()' aufrufen
    el.startScan.addEventListener('click', async () => {
      try {
          recordedData = []; 
          discoveredDevices.clear(); // Map leeren
          el.beaconDisplay.innerHTML = ''; 
          log(el.log, 'INFO', 'Starte passiven Scan (Datenjagd)...');
          log(el.log, 'INFO', 'Beacon-Liste wird aufgebaut...');
          await mgr.startScan(handleBeaconData); 
          el.startScan.disabled = true;
          el.stopScan.disabled = false;
          el.download.disabled = true; 
          el.connect.disabled = true;
          el.disconnect.disabled = true;
          el.send.disabled = true;
      } catch (e) {
          log(el.log, 'ERROR', e.message); 
      }
    });
    
    // ... (el.stopScan, el.download bleiben unverändert) ...
    el.stopScan.addEventListener('click', () => {
      mgr.stopScan();
      el.startScan.disabled = false;
      el.stopScan.disabled = true;
      el.download.disabled = false; 
      setConnectedUI(false); 
      log(el.log, 'INFO', 'Scan gestoppt. Download ist bereit.'); 
    });
    el.download.addEventListener('click', () => {
      if (recordedData.length === 0) {
          log(el.log, 'ERROR', 'Keine Daten zum Herunterladen vorhanden.');
          return;
      }
      log(el.log, 'INFO', 'Erstelle JSON-Datei...');
      const jsonData = JSON.stringify(recordedData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `beacon_log_${new Date().toISOString()}.json`; 
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      log(el.log, 'INFO', 'Download gestartet...');
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
