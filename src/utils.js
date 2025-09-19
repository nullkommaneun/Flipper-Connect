export function ts(){return new Date().toLocaleTimeString();}
export function log(el,type,msg){const d=document.createElement('div');d.textContent=`[${ts()}] ${type}: ${msg}`;el.append(d);}