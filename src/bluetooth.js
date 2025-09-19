import { log } from './utils.js';
const UUID128=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
async function loadServiceUUIDs(logEl){
  const FALLBACK=['0000180f-0000-1000-8000-00805f9b34fb','0000180a-0000-1000-8000-00805f9b34fb','19ed82ae-ed21-4c9d-4145-228e62fe0000'];
  try{const res=await fetch('./flipper_services.json',{cache:'no-store'});if(!res.ok)return FALLBACK;const j=await res.json();let uuids=(j?.flipper_services||[]).map(s=>String(s.uuid||'').trim().toLowerCase());uuids=[...new Set(uuids)];return uuids.filter(u=>UUID128.test(u))||FALLBACK;}catch(e){log(logEl,'ERROR','UUID Load fail:'+e.message);return FALLBACK;}}
export class BluetoothManager{
  constructor({onDisconnect,logEl}={}){this.device=null;this.server=null;this.chars=new Map();this.onDisconnect=onDisconnect;this.logEl=logEl;}
  static preflight(){return !!(navigator.bluetooth&&navigator.bluetooth.requestDevice);}
  async connect(){const optionalServices=await loadServiceUUIDs(this.logEl);const options={acceptAllDevices:true,optionalServices};this.device=await navigator.bluetooth.requestDevice(options);this.device.addEventListener('gattserverdisconnected',()=>this.onDisconnect?.());this.server=await this.device.gatt.connect();return this.server.connected;}
  async disconnect(){try{if(this.device?.gatt?.connected)this.device.gatt.disconnect();}finally{this.server=null;this.device=null;this.chars.clear();}}
  async discover(){if(!this.server)throw new Error('Nicht verbunden');const out=[];const services=await this.server.getPrimaryServices();for(const svc of services){const entry={uuid:svc.uuid,characteristics:[]};const chars=await svc.getCharacteristics();for(const c of chars){this.chars.set(c.uuid,c);entry.characteristics.push({uuid:c.uuid,props:{read:c.properties.read,write:c.properties.write||c.properties.writeWithoutResponse,notify:c.properties.notify||c.properties.indicate}});}out.push(entry);}return out;}
  getCharacteristic(uuid){const c=this.chars.get(uuid);if(!c)throw new Error('Unbekannte Characteristic:'+uuid);return c;}
  async read(uuid){const c=this.getCharacteristic(uuid);const v=await c.readValue();return v.buffer;}
  async write(uuid,buf){const c=this.getCharacteristic(uuid);if(c.properties.write){await c.writeValue(buf);return;}if(c.properties.writeWithoutResponse){await c.writeValueWithoutResponse(buf);return;}throw new Error('Characteristic nicht schreibbar');}
  async startNotifications(uuid,cb){const c=this.getCharacteristic(uuid);await c.startNotifications();const handler=(e)=>cb(e.target.value.buffer);c.addEventListener('characteristicvaluechanged',handler);return()=>{try{c.removeEventListener('characteristicvaluechanged',handler);}catch{}try{c.stopNotifications();}catch{}};}
}
