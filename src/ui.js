import {BluetoothManager} from './bluetooth.js';
import {log, shortUuid, bufferToHex, bufferToText, bufferToBase64, encodePayload} from './utils.js';

// 1. NEUE KNÖPFE ZUM 'el'-OBJEKT HINZUGEFÜGT
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
    // --- NEU ---
    startScan: $('#btnStartScan'),
    stopScan: $('#btnStopScan')
};
let mgr;let notifyUnsub=null;

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

// --- NEU: Callback-Funktion für die Datenjagd (Phase 2) ---
/**
 * Dies ist der "Lauscher", der die Beacon-Daten empfängt und ins Terminal loggt.
 * @param {BluetoothAdvertisingEvent} event - Das Rohdaten-Paket vom Beacon.
 */
function handleBeaconData(event) {
    const deviceName = event.device.name || 'Unbekanntes Gerät';
    const rssi = event.rssi;
    const manufData = event.manufacturerData; // Das ist der Schatz!

    // Logge die Basis-Infos (mit deinem 'log'-Helper)
    log(el.log, 'TAG', `[${deviceName}] RSSI: ${rssi} dBm`);
    
    // Zeige alle Herstellerdaten (das ist unser "Wörterbuch")
    if (manufData && manufData.size > 0) {
        for (let [companyId, dataView] of manufData.entries()) {
            // Benutze deinen 'bufferToHex'-Helper
            log(el.log, 'INFO', `  Manuf. ID: 0x${companyId.toString(16).toUpperCase()}`);
            log(el.log, 'INFO', `  Adv Data: ${bufferToHex(dataView.buffer)}`);
        }
    }
}
// --- Ende des neuen Blocks ---


document.addEventListener('DOMContentLoaded',()=>{
  setPreflight();
  mgr=new BluetoothManager({onDisconnect:()=>{setConnectedUI(false);log(el.log,'DISCONNECTED','Getrennt');},logEl:el.log});
  
  // Dein alter Code (Phase 1: Flipper Explorer)
  el.connect.addEventListener('click',async()=>{try{log(el.log,'INFO','Geräteauswahl…');const ok=await mgr.connect();if(ok){setConnectedUI(true);log(el.log,'CONNECTED',mgr.device?.name||'Unbekannt');const tree=await mgr.discover();renderExplorer(tree);}}catch(e){log(el.log,'ERROR',e.message);}});
  el.disconnect.addEventListener('click',async()=>{await mgr.disconnect();setConnectedUI(false);log(el.log,'DISCONNECTED','Trennen ok');});
  el.send.addEventListener('click',async()=>{try{const uuid=el.charSelect.value;if(!uuid)throw new Error('Keine Characteristic gewählt');const payload=el.input.value;const enc=el.encoding.value;const buf=encodePayload(payload,enc);await mgr.write(uuid,buf);log(el.log,'WRITE',`${uuid}: ${payload}`);}catch(e){log(el.log,'ERROR',e.message);}});

  // --- NEU: Click-Listener für Phase 2 (Datenjagd) ---
  el.startScan.addEventListener('click', async () => {
    try {
        // Rufe die neue Scan-Funktion auf und übergib ihr unseren "Lauscher"
        await mgr.startScan(handleBeaconData);
        
        // UI-Status aktualisieren
        el.startScan.disabled = true;
        el.stopScan.disabled = false;
        
        // Phase 1 (Flipper) deaktivieren, während Scan läuft
        el.connect.disabled = true;
        el.disconnect.disabled = true;
        el.send.disabled = true;
        
        log(el.log, 'INFO', 'Datenjagd (Scan) gestartet...');
    } catch (e) {
        log(el.log, 'ERROR', e.message);
    }
  });

  el.stopScan.addEventListener('click', () => {
    mgr.stopScan();
    
    // UI-Status zurücksetzen
    el.startScan.disabled = false;
    el.stopScan.disabled = true;
    
    // Phase 1 (Flipper) UI auf "Getrennt" zurücksetzen
    setConnectedUI(false); 
    log(el.log, 'INFO', 'Scan gestoppt.');
  });
  // --- Ende des neuen Blocks ---
});
