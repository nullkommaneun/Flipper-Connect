// Heartbeat (bleibt ganz oben)
window.__app_heartbeat = true;

if (window.__diag) {
  window.__diag('INIT: ui.js Modul-Ausführung gestartet.', 'INFO');
}

// Imports (bleiben oben)
import {BluetoothManager} from './bluetooth.js';
import {log, shortUuid, bufferToHex, bufferToText, bufferToBase64, encodePayload} from './utils.js';

// 1. Element-Selektoren
const $=s=>document.querySelector(s);

// NEUE STRUKTUR: Deklariere 'el' als leer.
// Wir füllen es erst, wenn das DOM bereit ist.
let el = {};

// 2. Globale Zustandsvariablen (bleiben)
let mgr;
let notifyUnsub=null;
let recordedData = [];

// 3. UI-Hilfsfunktionen
// (Alle Funktionen wie setPreflight, setConnectedUI, renderExplorer, handleBeaconData
//  bleiben hier unverändert. Sie werden erst *nach* der Initialisierung von 'el' aufgerufen.)

function setPreflight(){
    // ... (Code unverändert)
    if(BluetoothManager.preflight()){
        el.preflight.textContent='Web Bluetooth: OK';
        if(window.__diag) window.__diag('Preflight Check: OK', 'INFO');
    } else {
        el.preflight.textContent='Web Bluetooth nicht unterstützt';
        if(window.__diag) window.__diag('Preflight Check: Web Bluetooth nicht unterstützt', 'WARN');
    }
}
function setConnectedUI(isConnected){
    // ... (Code unverändert)
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
    // ... (restlicher Code der Funktion)
    el.explorer.append(d);
  }
}
function handleBeaconData(event) {
    // ... (Code unverändert)
    const deviceName = event.device.name || 'Unbekanntes Gerät';
    // ... (restlicher Code der Funktion)
}


// 4. Haupt-Initialisierung (Jetzt KORREKT)
document.addEventListener('DOMContentLoaded', () => {
  try {
    if (window.__diag) window.__diag('INIT: DOMContentLoaded Event gefeuert.', 'INFO');

    // --- NEU: ZUERST die DOM-Elemente sicher zuweisen ---
    // Jetzt ist garantiert, dass alle Elemente existieren.
    el = {
        preflight:$('#preflight'),
        connect:$('#btnConnect'),
        disconnect:$('#btnDisconnect'),
        state:$('#connState'),
        explorer:$('#explorer'),
        log:$('#terminalLog'),
        charSelect:$('#charSelect'),
        encoding:$('#encoding'),
        input:$('#terminalInput'),
        send:$('#btnSend'),
        startScan: $('#btnStartScan'),
        stopScan: $('#btnStopScan'),
        download: $('#btnDownloadLog') 
    };
    if (window.__diag) window.__diag('INIT: DOM-Elemente zugewiesen.', 'INFO');
    
    // Jetzt den Rest der Initialisierung sicher ausführen
    setPreflight();
    
    mgr = new BluetoothManager({
        onDisconnect: () => {
            setConnectedUI(false);
            log(el.log, 'DISCONNECTED', 'Getrennt');
        },
        logEl: el.log
    });
    
    // --- Event Listeners ---
    // Dieser Code (der vorher abgestürzt ist) wird jetzt funktionieren.
    
    // Phase 1: Flipper Explorer
    el.connect.addEventListener('click',async()=>{try{log(el.log,'INFO','Geräteauswahl…');const ok=await mgr.connect();if(ok){setConnectedUI(true);log(el.log,'CONNECTED',mgr.device?.name||'Unbekannt');const tree=await mgr.discover();renderExplorer(tree);}}catch(e){log(el.log,'ERROR',e.message);}});
    el.disconnect.addEventListener('click',async()=>{await mgr.disconnect();setConnectedUI(false);log(el.log,'DISCONNECTED','Trennen ok');});
    el.send.addEventListener('click',async()=>{try{const uuid=el.charSelect.value;if(!uuid)throw new Error('Keine Characteristic gewählt');const payload=el.input.value;const enc=el.encoding.value;const buf=encodePayload(payload,enc);await mgr.write(uuid,buf);log(el.log,'WRITE',`${uuid}: ${payload}`);}catch(e){log(el.log,'ERROR',e.message);}});

    // Phase 2: Datenjagd (Beacon Sniffer)
    el.startScan.addEventListener('click', async () => {
      try {
          recordedData = []; 
          log(el.log, 'INFO', 'Starte passiven Scan (Datenjagd)...');
          log(el.log, 'INFO', 'Datenspeicher (recordedData) wurde geleert.');
          
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
      // Dieser Block fängt jetzt z.B. Tippfehler in den 'el'-Zuweisungen ab
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
 
