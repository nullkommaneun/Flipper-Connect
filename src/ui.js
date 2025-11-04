// Heartbeat
window.__app_heartbeat = true;

if (window.__diag) {
  window.__diag('INIT: ui.js Modul-Ausführung gestartet.', 'INFO');
}

// Imports
import {BluetoothManager} from './bluetooth.js';
// NEU: parseManufacturerData importiert
import {log, shortUuid, bufferToHex, bufferToText, bufferToBase64, encodePayload, parseManufacturerData} from './utils.js';

// 1. Element-Selektoren
const $=s=>document.querySelector(s);
// ... (safeQuery unverändert) ...
let el = {}; 

// 2. Globale Zustandsvariablen
// ... (unverändert) ...
let discoveredDevices = new Map();

// 3. UI-Hilfsfunktionen
// ... (setPreflight, setConnectedUI, renderExplorer unverändert) ...


// --- NEUE HILFSFUNKTION (in ui.js) ---
/**
 * Erstellt den HTML-Inhalt für die Manufacturer-Daten (geparst oder roh).
 * @param {object} parsedData - Das Ergebnis von parseManufacturerData
 * @returns {string} HTML-String
 */
function renderParsedData(parsedData) {
    if (parsedData.type === 'parsed') {
        // Daten sind geparst (z.B. iBeacon)
        let html = '<dl class="parsed-data">';
        for (const item of parsedData.data) {
            html += `<dt>Typ</dt><dd>${item.type} (ID: ${item.companyId})</dd>`;
            if (item.uuid) html += `<dt>UUID</dt><dd>${item.uuid}</dd>`;
            if (item.major) html += `<dt>Major</dt><dd>${item.major}</dd>`;
            if (item.minor) html += `<dt>Minor</dt><dd>${item.minor}</dd>`;
            if (item.txPower) html += `<dt>TxPower</dt><dd>${item.txPower}</dd>`;
        }
        html += '</dl>';
        return html;
    } else {
        // Daten sind roh (Hex)
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


// --- ANGEPASSTE handleBeaconData FUNKTION ---
/**
 * Verarbeitet empfangene Beacon-Daten.
 * Aktualisiert die "Beacon-Liste" UI und speichert Daten für den JSON-Download.
 * @param {BluetoothAdvertisingEvent} event
 */
function handleBeaconData(event) {
    const deviceName = event.device.name || 'Unbekanntes Gerät';
    const deviceId = event.device.id;
    const rssi = event.rssi;
    
    // 1. DATEN PARSEN (NEU)
    // Wir rufen unseren neuen Parser aus utils.js auf
    const parsedData = parseManufacturerData(event.manufacturerData);
    
    // 2. Daten für JSON-Download speichern (jetzt mit geparsten Daten)
    recordedData.push({
        timestamp: new Date().toISOString(),
        id: deviceId,
        name: deviceName,
        rssi: rssi,
        manufacturerData: parsedData // Speichert das saubere Objekt
    });

    // 3. Live-UI aktualisieren
    const dataHtml = renderParsedData(parsedData); // HTML für die Daten generieren
    
    if (!discoveredDevices.has(deviceId)) {
        // --- GERÄT IST NEU: Karteikarte erstellen ---
        const card = document.createElement('div');
        card.className = 'beacon-card';
        card.id = `device-${deviceId}`; 
        
        // (Wir verwenden data-field="manufData" als Container für die neuen Daten)
        card.innerHTML = `
            <span class="rssi" data-field="rssi">${rssi}</span>
            <strong data-field="name">${deviceName}</strong>
            <span class="data-label" data-field="id">${deviceId}</span>
            <span class="data-label">Manufacturer Data:</span>
            <div data-field="manufData">
                ${dataHtml}
            </div>
        `;
        
        el.beaconDisplay.appendChild(card);
        discoveredDevices.set(deviceId, card); 
    
    } else {
        // --- GERÄT IST BEKANNT: Karteikarte aktualisieren ---
        const card = discoveredDevices.get(deviceId);
        
        card.querySelector('[data-field="rssi"]').textContent = rssi;
        card.querySelector('[data-field="name"]').textContent = deviceName;
        
        // Nur den Daten-Container aktualisieren
        const manufDataEl = card.querySelector('[data-field="manufData"]');
        manufDataEl.innerHTML = dataHtml;
    }
}
// --- ENDE ÄNDERUNG ---


// 4. Haupt-Initialisierung
document.addEventListener('DOMContentLoaded', () => {
  try {
    if (window.__diag) window.__diag('INIT: DOMContentLoaded Event gefeuert.', 'INFO');

    // DOM-Elemente sicher zuweisen
    el = {
        preflight: safeQuery('#preflight'),
        connect: safeQuery('#btnConnect'),
        disconnect: safeQuery('#btnDisconnect'),
        state: safeQuery('#connState'),
        explorer: safeQuery('#explorer'),
        log: safeQuery('#terminalLog'),
        charSelect: safeQuery('#charSelect'),
        encoding: safeQuery('#encoding'),
        input: safeQuery('#input'),
        send: safeQuery('#btnSend'),
        startScan: safeQuery('#btnStartScan'),
        stopScan: safeQuery('#btnStopScan'),
        download: safeQuery('#btnDownloadLog'),
        beaconDisplay: safeQuery('#beaconDisplay')
    };
    
    // ... (Rest der Datei bleibt unverändert) ...
    // ... (el.connect.addEventListener, el.startScan.addEventListener, etc.) ...

    if (window.__diag) window.__diag('INIT: App-Initialisierung (Listener) ERFOLGREICH.', 'INFO');
    
  } catch (e) {
    // ... (Error-Handling unverändert) ...
  }
});
