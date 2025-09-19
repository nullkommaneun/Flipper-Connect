export function ts(){return new Date().toLocaleTimeString([], {hour12:false});}
export function log(el,type,msg){const line=document.createElement('div');const t=document.createElement('span');t.className='ts';t.textContent=`[${ts()}] `;const tag=document.createElement('span');tag.className='tag';tag.textContent=type?`${type}: `:'';const text=document.createElement('span');if(type==='ERROR')text.className='err';text.textContent=msg;line.append(t,tag,text);el.append(line);el.scrollTop=el.scrollHeight;}
export const shortUuid = (u)=>!u?'':(u.toLowerCase().length>8?u.toLowerCase().slice(0,8)+'…':u.toLowerCase());
export const bufferToHex = (buf)=>Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(' ');
