import {BluetoothManager} from './bluetooth.js';
import {log, shortUuid, bufferToHex, bufferToText, bufferToBase64, encodePayload} from './utils.js';

const $=s=>document.querySelector(s);
const el={preflight:$('#preflight'),connect:$('#btnConnect'),disconnect:$('#btnDisconnect'),state:$('#connState'),explorer:$('#explorer'),log:$('#terminalLog'),charSelect:$('#charSelect'),encoding:$('#encoding'),input:$('#terminalInput'),send:$('#btnSend')};
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

document.addEventListener('DOMContentLoaded',()=>{
  setPreflight();
  mgr=new BluetoothManager({onDisconnect:()=>{setConnectedUI(false);log(el.log,'DISCONNECTED','Getrennt');},logEl:el.log});
  el.connect.addEventListener('click',async()=>{try{log(el.log,'INFO','Geräteauswahl…');const ok=await mgr.connect();if(ok){setConnectedUI(true);log(el.log,'CONNECTED',mgr.device?.name||'Unbekannt');const tree=await mgr.discover();renderExplorer(tree);}}catch(e){log(el.log,'ERROR',e.message);}});
  el.disconnect.addEventListener('click',async()=>{await mgr.disconnect();setConnectedUI(false);log(el.log,'DISCONNECTED','Trennen ok');});
  el.send.addEventListener('click',async()=>{try{const uuid=el.charSelect.value;if(!uuid)throw new Error('Keine Characteristic gewählt');const payload=el.input.value;const enc=el.encoding.value;const buf=encodePayload(payload,enc);await mgr.write(uuid,buf);log(el.log,'WRITE',`${uuid}: ${payload}`);}catch(e){log(el.log,'ERROR',e.message);}});
});
