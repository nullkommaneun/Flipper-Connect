// Heartbeat
window.__app_heartbeat = true;

if (window.__diag) {
  window.__diag('INIT: ui.js Modul-Ausführung gestartet.', 'INFO');
}

// Imports
import {BluetoothManager} from './bluetooth.js';
import {log, shortUuid, bufferToHex, bufferToText, bufferToBase64, encodePayload, parseManufacturerData} from './utils.js';

// --- NEUE IMPORT-PRÜFUNG ---
if (typeof BluetoothManager === 'undefined' || typeof log === 'undefined' || typeof parseManufacturerData === 'undefined') {
    throw new Error('KRITISCHER IMPORT-FEHLER: BluetoothManager oder Utils konnten nicht geladen werden. Prüfe die Pfade und die Konsole auf Syntaxfehler in bluetooth.js/utils.js.');
}
// --- ENDE PRÜFUNG ---


// 1. Element-Selektoren
const $=s=>document.querySelector(s);

function safeQuery(selector, context = document) {
    // ... (Code unverändert)
}

let el = {}; 

// 2. Globale Zustandsvariablen
// ... (Code unverändert)
let discoveredDevices = new Map(); 

// Konfiguration für die Charts
const RSSI_HISTORY_LENGTH = 20;
let chartConfigTemplate; 


// 3. UI-Hilfsfunktionen
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
function handleBeaconData(event) {
    // ... (Code unverändert)
}
function updateChart(deviceEntry, rssi) {
    // ... (Code unverändert)
}
function sortDisplayByRssi() {
    // ... (Code unverändert)
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
        sortRssi: safeQuery('#btnSortRssi')
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
    el.connect.addEventListener('click',async()=>{/*...*/});
    el.disconnect.addEventListener('click',async()=>{/*...*/});
    el.send.addEventListener('click',async()=>{/*...*/});
    
    el.startScan.addEventListener('click', async () => {
      try {
          // ... (Code unverändert)
      } catch (e) {
          // ... (Code unverändert)
      }
    });
    
    el.stopScan.addEventListener('click', () => {
      // ... (Code unverändert)
    });
    
    el.download.addEventListener('click', () => {
      // ... (Code unverändert)
    });
    
    el.sortRssi.addEventListener('click', () => {
        sortDisplayByRssi();
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
