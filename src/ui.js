// Heartbeat
window.__app_heartbeat = true;

if (window.__diag) {
  window.__diag('INIT: ui.js Modul-Ausführung gestartet.', 'INFO');
}

// Imports (WICHTIG: KEIN calculateDistance)
import {BluetoothManager} from './bluetooth.js';
import {log, shortUuid, bufferToHex, bufferToText, bufferToBase64, encodePayload, parseManufacturerData} from './utils.js';

// 1. Element-Selektoren
const $=s=>document.querySelector(s);
function safeQuery(selector, context = document) {
    const element = context.querySelector(selector);
    if (!element) {
        throw new Error(`Kritisches DOM-Element nicht gefunden: ${selector}`);
    }
    return element;
}

let el = {}; 

// 2. Globale Zustandsvariablen
let mgr;
let notifyUnsub=null;
let recordedData = []; 
let discoveredDevices = new Map(); 

// Konfiguration für Charts & Stale-Modus
const RSSI_HISTORY_LENGTH = 20;
let chartConfigTemplate; 
const STALE_TIMEOUT = 10000; // 10 Sekunden
let staleCheckInterval = null; // Hält die ID des Timers


// 3. UI-Hilfsfunktionen
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

// Wir verwenden die renderParsedData OHNE Distanz
function renderParsedData(parsedData) {
    if (parsedData.type === 'parsed') {
        let html = '<dl class="parsed-data">';
        for (const item of parsedData.data) {
            html += `<dt>Typ</dt><dd>${item.type} (ID: ${item.companyId})</dd>`;
            if (item.uuid) html += `<dt>UUID</dt><dd>${item.uuid}</dd>`;
            if (item.major) html += `<dt>Major</dt><dd>${item.major}</dd>`;
            if (item.minor) html += `<dt>Minor</dt><dd>${item.minor}</dd>`;
            if (item.txPower) html += `<dt>TxPower</dt><dd>${item.txPower} dBm</dd>`;
        }
        html += '</dl>';
        return html;
    } else {
        let html = '<pre class="raw-data">';
        if (Array.isArray(parsedData.data)) {
            for (const item of parsedData.data) {
                html += `ID: ${item.companyId}\nData: ${item.hex}\n`;
            }
        } else {
            html += 'N/A';
        }
        html += '</pre>';
        return html;
    }
}

/**
 * Verarbeitet empfangene Beacon-Daten.
 */
function handleBeaconData(event) {
    const deviceName = event.device.name || 'Unbekanntes Gerät';
    const deviceId = event.device.id;
    const rssi = event.rssi;
    
    // 1. Daten parsen
    const parsedData = parseManufacturerData(event.manufacturerData);
    
    // 2. Für JSON speichern (OHNE Distanz)
    recordedData.push({
        timestamp: new Date().toISOString(),
        id: deviceId,
        name: deviceName,
        rssi: rssi,
        manufacturerData: parsedData,
    });

    // 3. Live-UI
    const dataHtml = renderParsedData(parsedData); // OHNE Distanz
    
    if (!discoveredDevices.has(deviceId)) {
        // --- GERÄT IST NEU ---
        const card = document.createElement('div');
        card.className = 'beacon-card';
        if (parsedData.txPower) {
            card.classList.add('has-txpower');
        }
        const safeDeviceId = deviceId.replace(/[^a-zA-Z0-9_-]/g, '');
        card.id = `device-${safeDeviceId}`; 
        
        card.innerHTML = `
            <span class="rssi" data-field="rssi">${rssi}</span>
            <strong data-field="name">${deviceName}</strong>
            <span class="data-label" data-field="id">${deviceId}</span>
            <div class="chart-container">
                <canvas class="beacon-chart"></canvas>
            </div>
            <span class="data-label">Manufacturer Data:</span>
            <div data-field="manufData">
                ${dataHtml}
            </div>
        `;
        el.beaconDisplay.appendChild(card);
        
        const canvas = safeQuery(`.beacon-chart`, card); 
        
        const chartData = {
             labels: Array(RSSI_HISTORY_LENGTH).fill(''),
             datasets: [{
                label: 'RSSI',
                data: Array(RSSI_HISTORY_LENGTH).fill(null),
                borderColor: '#00ff41',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4 
            }]
        };
        const config = JSON.parse(JSON.stringify(chartConfigTemplate));
        config.data = chartData;
        
        const chart = new Chart(canvas, config);
        
        discoveredDevices.set(deviceId, {
            card: card,
            chart: chart,
            chartData: chartData.datasets[0].data,
            chartLabels: chartData.labels,
            rssi: rssi,
            lastSeen: Date.now() // Zeitstempel setzen
        }); 
        
        updateChart(discoveredDevices.get(deviceId), rssi);
    
    } else {
        // --- GERÄT IST BEKANNT ---
        const deviceEntry = discoveredDevices.get(deviceId);
        
        deviceEntry.rssi = rssi;
        deviceEntry.lastSeen = Date.now(); // Zeitstempel aktualisieren
        
        deviceEntry.card.querySelector('[data-field="rssi"]').textContent = rssi;
        deviceEntry.card.querySelector('[data-field="name"]').textContent = deviceName;
        
        const manufDataEl = deviceEntry.card.querySelector('[data-field="manufData"]');
        manufDataEl.innerHTML = dataHtml;
        
        deviceEntry.card.classList.toggle('has-txpower', !!parsedData.txPower);
        
        updateChart(deviceEntry, rssi);
    }
}

/**
 * Hilfsfunktion zum Aktualisieren eines Graphen mit einem neuen RSSI-Wert.
 */
function updateChart(deviceEntry, rssi) {
    deviceEntry.chartData.shift();
    deviceEntry.chartLabels.shift();
    deviceEntry.chartData.push(rssi);
    deviceEntry.chartLabels.push('');
    
    const minRssi = Math.min(...deviceEntry.chartData.filter(v => v !== null));
    const maxRssi = Math.max(...deviceEntry.chartData.filter(v => v !== null));
    deviceEntry.chart.options.scales.y.min = minRssi - 5;
    deviceEntry.chart.options.scales.y.max = maxRssi + 5;
    
    deviceEntry.chart.update('none'); 
}

/**
 * Sortiert die Beacon-Liste im DOM nach dem zuletzt gesehenen RSSI.
 */
function sortDisplayByRssi() {
    log(el.log, 'INFO', 'Sortiere Beacon-Liste nach RSSI (stärkstes Signal zuerst)...');
    
    const devices = Array.from(discoveredDevices.values());
    
    devices.sort((a, b) => {
        const rssiA = a.rssi || -999;
        const rssiB = b.rssi || -999;
        return rssiB - rssiA;
    });
    
    devices.forEach(device => {
        el.beaconDisplay.appendChild(device.card);
    });
}

/**
 * Timer-Funktion, die alte Geräte ausgraut.
 */
function checkStaleDevices() {
    const now = Date.now();
    for (const device of discoveredDevices.values()) {
        const isStale = (now - device.lastSeen) > STALE_TIMEOUT;
        device.card.classList.toggle('is-stale', isStale);
    }
}


// 4. Haupt-Initialisierungs-Funktion
function init() {
    try {
        if (window.__diag) window.__diag('INIT: DOMContentLoaded Event gefeuert.', 'INFO');

        // 1. Abhängigkeiten prüfen
        if (typeof Chart === 'undefined') {
            throw new Error('Chart.js (Chart) ist nicht geladen.');
        }
        if (window.__diag) window.__diag('INIT: Chart.js-Abhängigkeit OK.', 'INFO');

        // 2. Chart-Konfiguration erstellen
        chartConfigTemplate = {
            type: 'line',
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: {
                    x: { display: false, grid: { display: false } },
                    y: { 
                        display: true, 
                        grid: { color: '#333333' }, 
                        ticks: { color: '#8f8f8f', font: { size: 10 } },
                        min: -100, 
                        max: -20
                    }
                }
            }
        };

        // 3. DOM-Elemente sicher zuweisen
        el = {
            preflight: safeQuery('#preflight'),
            connect: safeQuery('#btnConnect'),
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
            download: safeQuery('#btnDownloadLog'),
            beaconDisplay: safeQuery('#beaconDisplay'),
            sortRssi: safeQuery('#btnSortRssi')
        };
        if (window.__diag) window.__diag('INIT: DOM-Elemente erfolgreich geprüft und zugewiesen.', 'INFO');
        
        // 4. Preflight-Check ausführen
        setPreflight();
        
        // 5. Bluetooth Manager initialisieren
        mgr = new BluetoothManager({
            onDisconnect: () => {
                setConnectedUI(false);
                log(el.log, 'DISCONNECTED', 'Getrennt');
            },
            logEl: el.log
        });
        
        // 6. Alle Event-Listener registrieren
        el.connect.addEventListener('click',async()=>{try{log(el.log,'INFO','Geräteauswahl…');const ok=await mgr.connect();if(ok){setConnectedUI(true);log(el.log,'CONNECTED',mgr.device?.name||'Unbekannt');const tree=await mgr.discover();renderExplorer(tree);}}catch(e){log(el.log,'ERROR',e.message);}});
        el.disconnect.addEventListener('click',async()=>{await mgr.disconnect();setConnectedUI(false);log(el.log,'DISCONNECTED','Trennen ok');});
        el.send.addEventListener('click',async()=>{try{const uuid=el.charSelect.value;if(!uuid)throw new Error('Keine Characteristic gewählt');const payload=el.input.value;const enc=el.encoding.value;const buf=encodePayload(payload,enc);await mgr.write(uuid,buf);log(el.log,'WRITE',`${uuid}: ${payload}`);}catch(e){log(el.log,'ERROR',e.message);}});
        
        el.startScan.addEventListener('click', async () => {
          try {
              recordedData = []; 
              discoveredDevices.clear(); 
              el.beaconDisplay.innerHTML = ''; 
              
              log(el.log, 'INFO', 'Starte passiven Scan (Datenjagd)...');
              
              await mgr.startScan(handleBeaconData); 
              
              log(el.log, 'INFO', 'Beacon-Liste wird aufgebaut...');
              
              if (staleCheckInterval) clearInterval(staleCheckInterval);
              staleCheckInterval = setInterval(checkStaleDevices, 2000); 
              
              el.startScan.disabled = true;
              el.stopScan.disabled = false;
              el.download.disabled = true; 
              el.connect.disabled = true;
              el.disconnect.disabled = true;
              el.send.disabled = true;
              
          } catch (e) {
              log(el.log, 'ERROR', `Scan konnte nicht gestartet werden: ${e.message}`);
              if (e.name === 'NotAllowedError') {
                  log(el.log, 'ERROR', 'Browser-Berechtigung fehlt oder wurde verweigert.');
                  log(el.log, 'ERROR', 'Prüfe Standort-Dienste (GPS) und Browser-Berechtigungen.');
              } else {
                  log(el.log, 'ERROR', 'Möglicherweise ein Hardware- oder Browser-Problem.');
              }
              if (window.__diag) window.__diag(`SCAN-FEHLER: ${e.message}`);
          }
        });
        
        el.stopScan.addEventListener('click', () => {
          mgr.stopScan();
          
          if (staleCheckInterval) clearInterval(staleCheckInterval);
          staleCheckInterval = null;
          
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
        
        el.sortRssi.addEventListener('click', () => {
            sortDisplayByRssi();
        });

        if (window.__diag) window.__diag('INIT: App-Initialisierung (Listener) ERFOLGREICH.', 'INFO');
        
    } catch (e) {
        if (window.__diag) {
          window.__diag('KRITISCH: Fehler während der App-Initialisierung (DOMContentLoaded).');
          window.__diag(`FEHLER: ${e.message}`);
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
}

// 5. Event Listener
document.addEventListener('DOMContentLoaded', init);
 
