import known from '../flipper_services.json' assert { type: 'json' };

export class BluetoothManager{
  constructor({onDisconnect}={}){this.device=null;this.server=null;this.chars=new Map();this.onDisconnect=onDisconnect;}
  static preflight(){return !!(navigator.bluetooth && navigator.bluetooth.requestDevice);}
  async connect({filters=[]}={}){
    const optionalServices = known.flipper_services.map(s=>s.uuid);
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
