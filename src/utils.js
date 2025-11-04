/**
 * Erzeugt einen Zeitstempel im Format HH:MM:SS.
 * @returns {string}
 */
export function ts() {
    // ... (Code unverändert)
}

/**
 * Schreibt eine formatierte Zeile in ein Log-Element (XSS-sicher).
 * @param {HTMLElement} el
 * @param {'INFO'|'ERROR'|'READ'|'WRITE'|'NOTIFY'|'TAG'|string} type
 * @param {string} msg
 */
export function log(el, type, msg) {
    // ... (Code unverändert)
}

/**
 * Kürzt eine UUID auf 8 Zeichen mit "…"
 * @param {string} u
 * @returns {string}
 */
export const shortUuid = (u) => {
    // ... (Code unverändert)
};

/**
 * Konvertiert ein ArrayBuffer in einen Hex-String (mit Leerzeichen).
 * @param {ArrayBuffer} buf
 * @returns {string}
 */
export const bufferToHex = (buf) => {
    // ... (Code unverändert)
};

/**
 * Versucht, ein ArrayBuffer als UTF-8-Text zu dekodieren.
 * @param {ArrayBuffer} buf
 * @returns {string}
 */
export const bufferToText = (buf) => {
    // ... (Code unverändert)
};

/**
 * Konvertiert ein ArrayBuffer in einen Base64-String.
 * @param {ArrayBuffer} buf
 * @returns {string}
 */
export const bufferToBase64 = (buf) => {
    // ... (Code unverändert)
};

/**
 * Kodiert einen String-Payload in ein ArrayBuffer gemäß dem gewählten Encoding.
 * @param {string} input
 * @param {'text'|'hex'|'base64'} enc
 * @returns {ArrayBuffer}
 */
export function encodePayload(input, enc) {
    // ... (Code unverändert)
}


// --- NEUER CODE AB HIER ---

/**
 * NEU: Formatiert 16 Bytes (aus einem DataView) in einen UUID-String.
 * @param {DataView} dataView - Das DataView, das die UUID enthält.
 * @param {number} offset - Der Start-Index der UUID (Standard 0).
 * @returns {string} Die formatierte UUID.
 */
function bytesToUuid(dataView, offset = 0) {
    const bytes = new Uint8Array(dataView.buffer, offset, 16);
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0'));
    return [
        hex.slice(0, 4).join(''),
        hex.slice(4, 6).join(''),
        hex.slice(6, 8).join(''),
        hex.slice(8, 10).join(''),
        hex.slice(10, 16).join('')
    ].join('-');
}

/**
 * NEU: Versucht, Apple iBeacon-Daten zu parsen.
 * Spec: 0x02 (Typ), 0x15 (Länge 21), 16B UUID, 2B Major, 2B Minor, 1B TX Power
 * @param {DataView} dataView - Die Rohdaten von Apple (ohne Company ID).
 * @returns {object|null} Ein Objekt mit den iBeacon-Daten oder null.
 */
function parseAppleiBeacon(dataView) {
    if (dataView.byteLength >= 23 &&
        dataView.getUint8(0) === 0x02 && // Typ: iBeacon
        dataView.getUint8(1) === 0x15) { // Länge: 21 Bytes
        
        const uuid = bytesToUuid(dataView, 2); // UUID (Bytes 2-17)
        const major = dataView.getUint16(18); // Major (Bytes 18-19)
        const minor = dataView.getUint16(20); // Minor (Bytes 20-21)
        const txPower = dataView.getInt8(22);   // TX Power (Byte 22, signed)
        
        return {
            type: 'iBeacon (Apple)',
            uuid,
            major,
            minor,
            txPower: `${txPower} dBm`,
        };
    }
    return null; // Kein iBeacon
}

/**
 * NEU: Haupt-Parser für Manufacturer-Daten.
 * Nimmt die Map von der Web Bluetooth API.
 * @param {Map<number, DataView>} manufDataMap
 * @returns {object} Ein Objekt, das entweder geparste Daten oder Rohdaten enthält.
 */
export function parseManufacturerData(manufDataMap) {
    let parsedResults = [];
    let rawHex = [];

    if (!manufDataMap || manufDataMap.size === 0) {
        return { type: 'raw', data: 'N/A' };
    }

    for (let [companyId, dataView] of manufDataMap.entries()) {
        const companyIdHex = `0x${companyId.toString(16).toUpperCase().padStart(4, '0')}`;
        let parsed = null;

        if (companyId === 0x004C) { // Apple
            parsed = parseAppleiBeacon(dataView);
        }
        // HINWEIS: Hier könnte man 'else if' für Google, etc. hinzufügen
        
        if (parsed) {
            parsed.companyId = companyIdHex;
            parsedResults.push(parsed);
        }
        
        // Rohdaten immer speichern
        rawHex.push({
            companyId: companyIdHex,
            hex: bufferToHex(dataView.buffer)
        });
    }

    // Wir geben die geparsten Daten ODER die Rohdaten zurück
    if (parsedResults.length > 0) {
        return { type: 'parsed', data: parsedResults };
    } else {
        return { type: 'raw', data: rawHex };
    }
}
