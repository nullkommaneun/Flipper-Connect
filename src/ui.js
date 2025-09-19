import {BluetoothManager} from './bluetooth.js';
import {log, shortUuid, bufferToHex} from './utils.js';

const $=s=>document.querySelector(s);
const el={ preflight:$('#preflight'), connect:$('#btnConnect'), disconnect:$('#btnDisconnect'), state:$('#connState'), log:$('#log'), explorer:$('#explorer'), btnClear:$('#btnClearLog'), btnCopy:$('#btnCopyLog') };
let mgr;

function setPreflight(){
  if(BluetoothManager.preflight()){ el.preflight.textContent='Web Bluetooth: OK'; el.preflight.classList.add('success'); }
  else { el.preflight.textContent='Web Bluetooth nicht unterstützt'; el.preflight.classList.add('error'); }
}
function setConnectedUI(y){ el.connect.disabled=y; el.disconnect.disabled=!y; el.state.textContent=y?'Verbunden':'Getrennt'; }

function renderExplorer(tree){
  el.explorer.innerHTML='';
  for(const svc of tree){
    const d=document.createElement('details');
    const s=document.createElement('summary');
    s.textContent=`Service ${shortUuid(svc.uuid)} (${svc.uuid})`; d.appendChild(s);
    const inner=document.createElement('div'); inner.className='inner';
    for(const c of svc.characteristics){
      const row=document.createElement('div'); row.style.display='flex'; row.style.justifyContent='space-between'; row.style.alignItems='center'; row.style.gap='.5rem';
      const lt=document.createElement('div'); lt.innerHTML=`<strong>Char ${shortUuid(c.uuid)}</strong><br><small>${c.uuid}</small>`;
      const act=document.createElement('div'); act.style.display='flex'; act.style.gap='.5rem';
      const br=document.createElement('button'); br.textContent='Lesen'; br.disabled=!c.props.read;
      br.addEventListener('click', async ()=>{ try{ const buf=await mgr.read(c.uuid); log(el.log,'READ',`${c.uuid}: HEX ${bufferToHex(buf)}`);}catch(e){log(el.log,'ERROR',e.message);} });
      act.append(br); row.append(lt,act); inner.append(row);
    }
    d.append(inner); el.explorer.append(d);
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  setPreflight();
  mgr=new BluetoothManager({onDisconnect:()=>{setConnectedUI(false); log(el.log,'DISCONNECTED','Getrennt');}});

  el.connect.addEventListener('click', async ()=>{
    try{
      log(el.log,'INFO','Geräteauswahl …');
      const ok=await mgr.connect(); // acceptAllDevices + optionalServices aus JSON
      if(ok){ setConnectedUI(true); log(el.log,'CONNECTED', mgr.device?.name || 'Unbekannt'); const tree=await mgr.discover(); renderExplorer(tree); }
    }catch(e){ log(el.log,'ERROR', e.message || String(e)); }
  });

  el.disconnect.addEventListener('click', async ()=>{ await mgr.disconnect(); setConnectedUI(false); log(el.log,'DISCONNECTED','Trennen ok'); });

  el.btnClear.addEventListener('click', ()=>{ el.log.textContent=''; });
  el.btnCopy.addEventListener('click', async ()=>{ try{ await navigator.clipboard.writeText(el.log.textContent); log(el.log,'INFO','Konsole kopiert'); }catch(e){ log(el.log,'ERROR','Clipboard fehlgeschlagen'); } });
});
