export class BluetoothManager{
  constructor({onDisconnect}={}){this.device=null;this.server=null;this.chars=new Map();this.onDisconnect=onDisconnect;}
  static preflight(){return !!(navigator.bluetooth && navigator.bluetooth.requestDevice);}

  async _loadServiceUUIDs(){
    const FALLBACK=['0000180F-0000-1000-8000-00805F9B34FB','0000180A-0000-1000-8000-00805F9B34FB','19ed82ae-ed21-4c9d-4145-228e62fe0000'];
    try{
      const res=await fetch('./flipper_services.json',{cache:'no-store'});
      if(!res.ok) return FALLBACK;
      const j=await res.json();
      const uuids=(j?.flipper_services||[]).map(s=>s.uuid).filter(Boolean);
      return uuids.length?uuids:FALLBACK;
    }catch{ return FALLBACK; }
  }

  async connect({filters=[]}={}){
    const optionalServices = await this._loadServiceUUIDs();
    const options = filters.length?{filters, optionalServices}:{acceptAllDevices:true, optionalServices};
    this.device = await navigator.bluetooth.requestDevice(options);
    this.device.addEventListener('gattserverdisconnected', ()=>this.onDisconnect?.());
    this.server = await this.device.gatt.connect();
    return this.server.connected;
  }
  async disconnect(){try{if(this.device?.gatt?.connected)this.device.gatt.disconnect();}finally{this.server=null;this.device=null;this.chars.clear();}}

  async discover(){
    if(!this.server) throw new Error('Nicht verbunden.');
    const out=[]; const services=await this.server.getPrimaryServices();
    for(const svc of services){
      const entry={uuid:svc.uuid, characteristics:[]};
      const chars=await svc.getCharacteristics();
      for(const c of chars){
        this.chars.set(c.uuid,c);
        entry.characteristics.push({uuid:c.uuid, props:{read:c.properties.read, write:c.properties.write||c.properties.writeWithoutResponse, notify:c.properties.notify||c.properties.indicate}});
      }
      out.push(entry);
    }
    return out;
  }
  getCharacteristic(uuid){const c=this.chars.get(uuid); if(!c) throw new Error('Unbekannte Characteristic: '+uuid); return c;}
  async read(uuid){const c=this.getCharacteristic(uuid); const v=await c.readValue(); return v.buffer;}
}
