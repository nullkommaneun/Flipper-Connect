// WICHTIG: Die Imports müssen an der Spitze bleiben.
import {BluetoothManager} from './bluetooth.js';
import {log, shortUuid, bufferToHex, bufferToText, bufferToBase64, encodePayload} from './utils.js';

// Diagnostik-Heartbeat: "ui.js" wurde geladen und wird geparst
if (window.__diag) {
  window.__diag('INIT: ui.js Modul-Parsing gestartet.', 'INFO');
}

// ... (dein restlicher Code: const $, const el, let mgr, ...) ...
// ... (alle deine Funktionen: setPreflight, setConnectedUI, renderExplorer, ...) ...

const $=s=>document.querySelector(s);
const el={
    preflight:$('#preflight'),
    connect:$('#btnConnect'),
    disconnect:$('#btnDisconnect'),
    // ... (alle deine 'el' Definitionen) ...
    download: $('#btnDownloadLog') 
};
let mgr;
// ... (restliche globale Variablen) ...
let recordedData = [];

// ... (alle deine Funktionen wie setPreflight, renderExplorer, handleBeaconData, etc.) ...
function setPreflight(){
    // ... (Inhalt von setPreflight) ...
    // Hinzufügen eines Diagnose-Logs
    if(BluetoothManager.preflight()){
        el.preflight.textContent='Web Bluetooth: OK';
        if(window.__diag) window.__diag('Preflight Check: OK', 'INFO');
    } else {
        el.preflight.textContent='Web Bluetooth nicht unterstützt';
        if(window.__diag) window.__diag('Preflight Check: Web Bluetooth nicht unterstützt', 'WARN');
    }
}
// ... (alle anderen Funktionen) ...


// --- WICHTIGE ÄNDERUNG HIER ---
// Der gesamte DOMContentLoaded-Listener wird in ein try...catch gehüllt
document.addEventListener('DOMContentLoaded', () => {
  try {
    if (window.__diag) window.__diag('INIT: DOMContentLoaded Event gefeuert.', 'INFO');
    
    // --- DEIN BISHERIGER CODE STARTET HIER ---
    setPreflight();
    
    mgr = new BluetoothManager({
        onDisconnect: () => {
            setConnectedUI(false);
            log(el.log, 'DISCONNECTED', 'Getrennt');
        },
        logEl: el.log
    });
    
    // ... (alle deine el.connect.addEventListener, el.startScan.addEventListener, etc.) ...
    
    // --- DEIN BISHERIGER CODE ENDET HIER ---

    if (window.__diag) window.__diag('INIT: App-Initialisierung (Listener) ERFOLGREICH.', 'INFO');
    
  } catch (e) {
    // Fangt Fehler *während* der Initialisierung ab (z.B. el.connect ist null)
    if (window.__diag) {
      window.__diag('KRITISCH: Fehler während der App-Initialisierung (DOMContentLoaded).');
      window.__diag(`FEHLER: ${e.message}`);
      window.__diag(`STACK: ${e.stack}`);
    } else {
      // Failsafe, falls __diag aus irgendeinem Grund nicht existiert
      console.error('KRITISCHER FEHLER (DOMContentLoaded):', e);
      alert('Kritischer Init-Fehler: ' + e.message);
    }
    
    // UI über den Fehler informieren
    const preflightEl = document.getElementById('preflight');
    if (preflightEl) {
        preflightEl.textContent = 'FEHLER: App-Init fehlgeschlagen';
        preflightEl.className = 'badge error';
    }
  }
});
