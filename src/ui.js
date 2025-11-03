```javascript
import {BluetoothManager} from './bluetooth.js';
import {log, shortUuid, bufferToHex, bufferToText, bufferToBase64, encodePayload} from './utils.js';

// 1. NEUEN KNOPF ZUM 'el'-OBJEKT HINZUGEFÜGT
const $=s=>document.querySelector(s);
const el={
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
    // --- NEU ---
    download: $('#btnDownloadLog') 
};
let mgr;
let notifyUnsub=null;
// --- NEU: Datenspeicher für den JSON-Download ---
let recordedData = [];


function setPreflight(){if(BluetoothManager.preflight()){el.preflight.textContent='Web Bluetooth: OK';}else{el.preflight.textContent='Web Bluetooth nicht unterstützt';}}
function setConnectedUI(y){el.connect.disabled=y;el.disconnect.disabled=!y;el.state.textContent=y?'Verbunden':'Getrennt';el.send.disabled=!y;}

function renderExplorer(tree){
  el.explorer.innerHTML='';el.charSelect.innerHTML='';
  for(const svc of tree){const d=document.createElement('details');const s=document.createElement('summary');s.textContent=`Service ${shortUuid(svc.uuid)} (${svc.uuid})`;d.appendChild(s);const inner=document.createElement('div');inner.className='inner';
    for(const c of svc.characteristics){const row=document.createElement('div');row.style.display='flex';row.style.justifyContent='space-between';row.style.alignItems='center';row.style.gap='.5rem';const lt=document.createElement('div');lt.innerHTML=`<strong>Char ${shortUuid(c.uuid)}</strong><br><small>${c.uuid}</small>`;const act=document.createElement('div');act.style.display='flex';act.style.gap='.5rem';
      const br=document.createElement('button');br.textContent='Lesen';br.disabled=!c.props.read;br.addEventListener('click',async()=>{try{const buf=await mgr.read(c.uuid);log(el.log,'READ',`${c.uuid}: HEX ${bufferToHex(buf)} TXT ${bufferToText(buf)}`);}catch(e){log(el.log,'ERROR',e.message);}});
      const bw=document.createElement('button');bw.textContent='Schreiben';bw.disabled=!c.props.write;bw.addEventListener('click',async()=>{try{const payload=prompt('Payload');if(!payload)return;const buf=encodePayload(payload,'text');await mgr.write(c.uuid,buf);log(el.log,'WRITE',`${c.uuid}: ${payload}`);}catch(e){log(el.log,'ERROR',e.message);}});
      const bn=document.createElement('button');bn.textContent='Subscribe';bn.disabled=!c.props.notify;let sub=false;let unsub=null;bn.addEventListener('click',async()=>{try{if(!sub){unsub=await mgr.startNotifications(c.uuid,(buf)=>{log(el.log,'NOTIFY',`${c.uuid}: HEX ${bufferToHex(buf)} TXT ${bufferToText(buf)}`);});bn.textContent='Unsubscribe';sub=true;}else{unsub?.();bn.textContent='Subscribe';sub=false;}}catch(e){log(el.log,'ERROR',e.message);}});
      act.append(br,bw,bn);row.append(lt,act);inner.append(row);const opt=document.createElement('option');opt.value=c.uuid;opt.textContent=shortUuid(c.uuid);el.charSelect.append(opt);}d.append(inner);el.explorer.append(d);}}

// --- ANGEPASST: Callback-Funktion für die Datenjagd (Phase 2) ---
/**
 * Loggt UND SPEICHERT die Beacon-Daten.
 */
function handleBeaconData(event) {
    const deviceName = event.device.name || 'Unbekanntes Gerät';
    const rssi = event.rssi;
    const manufData = event.manufacturerData;

    // 1. INS TERMINAL LOGGEN (wie bisher)
    log(el.log, 'TAG', `[${deviceName}] RSSI: ${rssi} dBm`);
    
    // 2. FÜR JSON-DOWNLOAD VORBEREITEN UND SPEICHERN
    const manufDataArray = []; // Ein sauberes Array für die JSON-Datei
    
    if (manufData && manufData.size > 0) {
        for (let [companyId, dataView] of manufData.entries()) {
            // Benutze deinen 'bufferToHex'-Helper
            const hexData = bufferToHex(dataView.buffer);
            const companyIdHex = `0x${companyId.toString(16).toUpperCase()}`;

            // Loggen (wie bisher)
            log(el.log, 'INFO', `  Manuf. ID: ${companyIdHex}`);
            log(el.log, 'INFO', `  Adv Data: ${hexData}`);
            
            // Für JSON-Datei speichern
            manufDataArray.push({
                companyId: companyIdHex,
                advData: hexData
            });
        }
    }

    // Das komplette Event-Objekt in unser 'recordedData'-Array pushen
    recordedData.push({
        timestamp: new Date().toISOString(),
        name: deviceName,
        rssi: rssi,
        manufacturerData: manufDataArray
    });
}
// --- Ende der Anpassung ---


document.addEventListener('DOMContentLoaded',()=>{
  setPreflight();
  mgr=new BluetoothManager({onDisconnect:()=>{setConnectedUI(false);log(el.log,'DISCONNECTED','Getrennt');},logEl:el.log});
  
  // Dein alter Code (Phase 1: Flipper Explorer)
  el.connect.addEventListener('click',async()=>{try{log(el.log,'INFO','Geräteauswahl…');const ok=await mgr.connect();if(ok){setConnectedUI(true);log(el.log,'CONNECTED',mgr.device?.name||'Unbekannt');const tree=await mgr.discover();renderExplorer(tree);}}catch(e){log(el.log,'ERROR',e.message);}});
  el.disconnect.addEventListener('click',async()=>{await mgr.disconnect();setConnectedUI(false);log(el.log,'DISCONNECTED','Trennen ok');});
  el.send.addEventListener('click',async()=>{try{const uuid=el.charSelect.value;if(!uuid)throw new Error('Keine Characteristic gewählt');const payload=el.input.value;const enc=el.encoding.value;const buf=encodePayload(payload,enc);await mgr.write(uuid,buf);log(el.log,'WRITE',`${uuid}: ${payload}`);}catch(e){log(el.log,'ERROR',e.message);}});

  // --- ANGEPASST: Click-Listener für Phase 2 (Datenjagd) ---
  el.startScan.addEventListener('click', async () => {
    try {
        // Datenspeicher leeren
        recordedData = []; 
        log(el.log, 'INFO', 'Starte passiven Scan (Datenjagd)...');
        log(el.log, 'INFO', 'Datenspeicher (recordedData) wurde geleert.');
        
        await mgr.startScan(handleBeaconData);
        
        // UI-Status aktualisieren
        el.startScan.disabled = true;
        el.stopScan.disabled = false;
        el.download.disabled = true; // Download erst nach Stopp aktivieren
        
        // Phase 1 (Flipper) deaktivieren, während Scan läuft
        el.connect.disabled = true;
        el.disconnect.disabled = true;
        el.send.disabled = true;
        
    } catch (e) {
        log(el.log, 'ERROR', e.message);
    }
  });

  el.stopScan.addEventListener('click', () => {
    mgr.stopScan();
    
    // UI-Status zurücksetzen
    el.startScan.disabled = false;
    el.stopScan.disabled = true;
    el.download.disabled = false; // Download JETZT aktivieren
    
    // Phase 1 (Flipper) UI auf "Getrennt" zurücksetzen
    setConnectedUI(false); 
    log(el.log, 'INFO', 'Scan gestoppt. Download ist bereit.');
  });
  
  // --- NEU: Click-Listener für den Download-Knopf ---
  el.download.addEventListener('click', () => {
    if (recordedData.length === 0) {
        log(el.log, 'ERROR', 'Keine Daten zum Herunterladen vorhanden.');
        return;
    }

    log(el.log, 'INFO', 'Erstelle JSON-Datei...');

    // 1. Daten in einen JSON-String umwandeln
    // (null, 2) fügt hübsche Einrückungen hinzu, damit ich es besser lesen kann
    const jsonData = JSON.stringify(recordedData, null, 2);

    // 2. Einen "Blob" erstellen (eine Datei im Speicher)
    const blob = new Blob([jsonData], { type: 'application/json' });

    // 3. Einen unsichtbaren Download-Link erstellen
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beacon_log_${new Date().toISOString()}.json`; // Dateiname
    
    // 4. Den Link klicken und wieder entfernen
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    log(el.log, 'INFO', 'Download gestartet...');
  });
  // --- Ende des neuen Blocks ---
});
