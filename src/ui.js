// Heartbeat
window.__app_heartbeat = true;

if (window.__diag) {
  window.__diag('INIT: ui.js Modul-Ausführung gestartet.', 'INFO');
}

// Imports
import {BluetoothManager} from './bluetooth.js';
import {log, shortUuid, bufferToHex, bufferToText, bufferToBase64, encodePayload} from './utils.js';

// 1. Element-Selektoren
const $=s=>document.querySelector(s);
function safeQuery(selector, context = document) {
    const element = context.querySelector(selector);
    if (!element) {
        throw new Error(`Kritisches DOM-Element nicht gefunden: ${selector}`);
    }
    return element;
}
let el = {}; // Bleibt leer bis DOM geladen

// 2. Globale Zustandsvariablen
let mgr;
let notifyUnsub=null;
let recordedData = []; // Für den JSON-Download
let discoveredDevices = new Map(); // NEU: Für die Live-UI

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

// (Explorer-Render-Funktion bleibt unverändert)
function renderExplorer(tree){
  el.explorer.innerHTML='';
  el.charSelect.innerHTML='';
  for(const svc of tree){
    const d=document.createElement('details');
    const s=document.createElement('summary');
    s.textContent=`Service ${shortUuid(svc.uuid)} (${svc.uuid})`;
    d.appendChild(s);
    const inner=document.createElement('div');
    inner.className='inner';
    for(const c of svc.characteristics){
      const row=document.createElement('div');
      row.className = 'explorer-row';
      const lt=document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = `Char ${shortUuid(c.uuid)}`;
      const br = document.createElement('br');
      const small = document.createElement('small');
      small.textContent = c.uuid;
      lt.append(strong, br, small);
      const act=document.createElement('div');
      act.className = 'explorer-actions';
      const brBtn=document.createElement('button');
      brBtn.textContent='Lesen';
      brBtn.disabled=!c.props.read;
      brBtn.addEventListener('click',async()=>{try{const buf=await mgr.read(c.uuid);log(el.log,'READ',`${c.uuid}: HEX ${bufferToHex(buf)} TXT ${bufferToText(buf)}`);}catch(e){log(el.log,'ERROR',e.message);}});
      const bwBtn=document.createElement('button');
      bwBtn.textContent='Schreiben';
      bwBtn.disabled=!c.props.write;
      bwBtn.addEventListener('click',async()=>{try{const payload=prompt('Payload (als Text)');if(!payload)return;const buf=encodePayload(payload,'text');await mgr.write(c.uuid,buf);log(el.log,'WRITE',`${c.uuid}: ${payload}`);}catch(e){log(el.log,'ERROR',e.message);}});
      const bnBtn=document.createElement('button');
      bnBtn.textContent='Subscribe';
      bnBtn.disabled=!c.props.notify;
      let sub=false;
      let unsub=null;
      bnBtn.addEventListener('click',async()=>{try{if(!sub){unsub=await mgr.startNotifications(c.uuid,(buf)=>{log(el.log,'NOTIFY',`${c.uuid}: HEX ${bufferToHex(buf)} TXT ${bufferToText(buf)}`);});bnBtn.textContent='Unsubscribe';sub=true;}else{unsub?.();bnBtn.textContent='Subscribe';sub=false;}}catch(e){log(el.log,'ERROR',e.message);}});
      act.append(brBtn, bwBtn, bnBtn);
      row.append(lt, act);
      inner.append(row);
      const opt=document.createElement('option');
      opt.value=c.uuid;
      opt.textContent=c.uuid;
      el.charSelect.append(opt);
    }
    d.append(inner);
    el.explorer.append(d);
  }
}


// --- KOMPLETT NEUE handleBeaconData FUNKTION ---
/**
 * Verarbeitet empfangene Beacon-Daten.
 * Aktualisiert die "Beacon-Liste" UI und speichert Daten für den JSON-Download.
 * @param {BluetoothAdvertisingEvent} event
 */
function handleBeaconData(event) {
    const deviceName = event.device.name || 'Unbekanntes Gerät';
    const deviceId = event.device.id;
    const rssi = event.rssi;
    const manufData = event.manufacturerData;
    
    // 1. Daten für JSON-Download speichern (wie bisher)
    const manufDataArray = [];
    let manufDataHex = ''; // Brauchen wir für die UI
    
    if (manufData && manufData.size > 0) {
        for (let [companyId, dataView] of manufData.entries()) {
            const hexData = bufferToHex(dataView.buffer);
            const companyIdHex = `0x${companyId.toString(16).toUpperCase()}`;
            
            // Für JSON
            manufDataArray.push({ companyId: companyIdHex, advData: hexData });
            
            // Für UI (wir fügen alles zu einem lesbaren String zusammen)
            manufDataHex += `ID: ${companyIdHex}\nData: ${hexData}\n`;
        }
    }
    recordedData.push({
        timestamp: new Date().toISOString(),
        id: deviceId,
        name: deviceName,
        rssi: rssi,
        manufacturerData: manufDataArray
    });

    // 2. Live-UI aktualisieren
    if (!discoveredDevices.has(deviceId)) {
        // --- GERÄT IST NEU: Karteikarte erstellen ---
        const card = document.createElement('div');
        card.className = 'beacon-card';
        card.id = `device-${deviceId}`; // Eindeutige ID für die Karte
        
        // (Wir verwenden innerHTML für eine einfache Vorlage. Da die Daten
        // (deviceName, rssi, manufDataHex) von der Bluetooth API kommen
        // und nicht vom Benutzer, ist das XSS-Risiko hier gering.)
        card.innerHTML = `
            <span class="rssi" data-field="rssi">${rssi}</span>
            <strong data-field="name">${deviceName}</strong>
            <span class="data-label" data-field="id">${deviceId}</span>
            <span class="data-label">Manufacturer Data:</span>
            <pre data-field="manufData">${manufDataHex || 'N/A'}</pre>
        `;
        
        el.beaconDisplay.appendChild(card);
        discoveredDevices.set(deviceId, card); // Karte in der Map speichern
    
    } else {
        // --- GERÄT IST BEKANNT: Karteikarte aktualisieren ---
        const card = discoveredDevices.get(deviceId);
        
        // (Wir verwenden gezielte Abfragen, um nur die Werte zu aktualisieren)
        card.querySelector('[data-field="rssi"]').textContent = rssi;
        card.querySelector('[data-field="name"]').textContent = deviceName;
        
        const manufDataEl = card.querySelector('[data-field="manufData"]');
        manufDataEl.textContent = manufDataHex || 'N/A';
    }
}
// --- ENDE NEUE FUNKTION ---


// 4. Haupt-Initialisierung
document.addEventListener('DOMContentLoaded', () => {
  try {
    if (window.__diag) window.__diag('INIT: DOMContentLoaded Event gefeuert.', 'INFO');

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
        beaconDisplay: safeQuery('#beaconDisplay') // NEU
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
    
    // Phase 1 (unverändert)
    el.connect.addEventListener('click',async()=>{try{log(el.log,'INFO','Geräteauswahl…');const ok=await mgr.connect();if(ok){setConnectedUI(true);log(el.log,'CONNECTED',mgr.device?.name||'Unbekannt');const tree=await mgr.discover();renderExplorer(tree);}}catch(e){log(el.log,'ERROR',e.message);}});
    el.disconnect.addEventListener('click',async()=>{await mgr.disconnect();setConnectedUI(false);log(el.log,'DISCONNECTED','Trennen ok');});
    el.send.addEventListener('click',async()=>{try{const uuid=el.charSelect.value;if(!uuid)throw new Error('Keine Characteristic gewählt');const payload=el.input.value;const enc=el.encoding.value;const buf=encodePayload(payload,enc);await mgr.write(uuid,buf);log(el.log,'WRITE',`${uuid}: ${payload}`);}catch(e){log(el.log,'ERROR',e.message);}});

    // Phase 2 (AKTUALISIERT)
    el.startScan.addEventListener('click', async () => {
      try {
          // Listen und Datenspeicher leeren
          recordedData = []; 
          discoveredDevices.clear();
          el.beaconDisplay.innerHTML = ''; // UI leeren
          
          log(el.log, 'INFO', 'Starte passiven Scan (Datenjagd)...');
          log(el.log, 'INFO', 'Beacon-Liste wird aufgebaut...');
          
          await mgr.startScan(handleBeaconData); // Unsere NEUE Handler-Funktion
          
          el.startScan.disabled = true;
          el.stopScan.disabled = false;
          el.download.disabled = true; 
          el.connect.disabled = true;
          el.disconnect.disabled = true;
          el.send.disabled = true;
          
      } catch (e) {
          log(el.log, 'ERROR', e.message); // Fehler im Aktions-Log
      }
    });

    el.stopScan.addEventListener('click', () => {
      mgr.stopScan();
      
      el.startScan.disabled = false;
      el.stopScan.disabled = true;
      el.download.disabled = false; 
      
      setConnectedUI(false); 
      log(el.log, 'INFO', 'Scan gestoppt. Download ist bereit.'); // Info im Aktions-Log
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
