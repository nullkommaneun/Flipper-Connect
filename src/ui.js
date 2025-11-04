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

// NEU: Eine "sichere" Query-Funktion, die Fehler wirft
function safeQuery(selector, context = document) {
    const element = context.querySelector(selector);
    if (!element) {
        // Dieser Fehler wird sofort vom try...catch in DOMContentLoaded gefangen
        throw new Error(`Kritisches DOM-Element nicht gefunden: ${selector}`);
    }
    return element;
}

// Deklariere 'el' als leer.
let el = {};

// 2. Globale Zustandsvariablen (bleiben)
let mgr;
let notifyUnsub=null;
let recordedData = [];

// 3. UI-Hilfsfunktionen
// (Alle Funktionen wie setPreflight, setConnectedUI, renderExplorer, handleBeaconData
//  bleiben hier unverändert.)

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
function handleBeaconData(event) {
    const deviceName = event.device.name || 'Unbekanntes Gerät';
    const rssi = event.rssi;
    const manufData = event.manufacturerData;
    log(el.log, 'TAG', `[${deviceName}] RSSI: ${rssi} dBm`);
    const manufDataArray = [];
    if (manufData && manufData.size > 0) {
        for (let [companyId, dataView] of manufData.entries()) {
            const hexData = bufferToHex(dataView.buffer);
            const companyIdHex = `0x${companyId.toString(16).toUpperCase()}`;
            log(el.log, 'INFO', `  Manuf. ID: ${companyIdHex}`);
            log(el.log, 'INFO', `  Adv Data: ${hexData}`);
            manufDataArray.push({
                companyId: companyIdHex,
                advData: hexData
            });
        }
    }
    recordedData.push({
        timestamp: new Date().toISOString(),
        name: deviceName,
        rssi: rssi,
        manufacturerData: manufDataArray
    });
}


// 4. Haupt-Initialisierung
document.addEventListener('DOMContentLoaded', () => {
  try {
    if (window.__diag) window.__diag('INIT: DOMContentLoaded Event gefeuert.', 'INFO');

    // --- NEU: Wir verwenden 'safeQuery', um fehlende IDs sofort zu finden ---
    el = {
        preflight: safeQuery('#preflight'),
        connect: safeQuery('#btnConnect'), // <-- Wenn #btnConnect fehlt, wirft dies einen Fehler
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
        download: safeQuery('#btnDownloadLog') 
    };
    if (window.__diag) window.__diag('INIT: DOM-Elemente erfolgreich geprüft und zugewiesen.', 'INFO');
    
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
    el.connect.addEventListener('click',async()=>{try{log(el.log,'INFO','Geräteauswahl…');const ok=await mgr.connect();if(ok){setConnectedUI(true);log(el.log,'CONNECTED',mgr.device?.name||'Unbekannt');const tree=await mgr.discover();renderExplorer(tree);}}catch(e){log(el.log,'ERROR',e.message);}});
    el.disconnect.addEventListener('click',async()=>{await mgr.disconnect();setConnectedUI(false);log(el.log,'DISCONNECTED','Trennen ok');});
    el.send.addEventListener('click',async()=>{try{const uuid=el.charSelect.value;if(!uuid)throw new Error('Keine Characteristic gewählt');const payload=el.input.value;const enc=el.encoding.value;const buf=encodePayload(payload,enc);await mgr.write(uuid,buf);log(el.log,'WRITE',`${uuid}: ${payload}`);}catch(e){log(el.log,'ERROR',e.message);}});
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
      // Dieser Block fängt jetzt den "Kritisches DOM-Element nicht gefunden"-Fehler ab
      window.__diag('KRITISCH: Fehler während der App-Initialisierung (DOMContentLoaded).');
      window.__diag(`FEHLER: ${e.message}`); // <-- HIER STEHT DANN WELCHES ELEMENT FEHLT
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
 
