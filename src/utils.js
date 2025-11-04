/**
 * Erzeugt einen Zeitstempel im Format HH:MM:SS.
 * @returns {string}
 */
export function ts() {
    return new Date().toLocaleTimeString([], { hour12: false });
}

/**
 * Schreibt eine formatierte Zeile in ein Log-Element (XSS-sicher).
 * @param {HTMLElement} el
 * @param {'INFO'|'ERROR'|'READ'|'WRITE'|'NOTIFY'|'TAG'|string} type
 * @param {string} msg
 */
export function log(el, type, msg) {
    const line = document.createElement('div');
    const t = document.createElement('span');
    t.className = 'ts';
    t.textContent = `[${ts()}] `;
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = type ? `${type}: ` : '';
    const text = document.createElement('span');
    if (type === 'ERROR') {
        text.className = 'err';
    }
    text.textContent = msg;
    line.append(t, tag, text);
    el.append(line);
    el.scrollTop = el.scrollHeight;
}

/**
 * Kürzt eine UUID auf 8 Zeichen mit "…"
 * @param {string} u
 * @returns {string}
 */
export const shortUuid = (u) => {
    if (!u) return '';
    const lower = u.toLowerCase();
    return lower.length > 8 ? lower.slice(0, 8) + '…' : lower;
};

/**
 * Konvertiert ein ArrayBuffer in einen Hex-String (mit Leerzeichen).
 * @param {ArrayBuffer} buf
 * @returns {string}
 */
export const bufferToHex = (buf) => {
    return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
};

/**
 * Versucht, ein ArrayBuffer als UTF-8-Text zu dekodieren.
 * @param {ArrayBuffer} buf
 * @returns {string}
 */
export const bufferToText = (buf) => {
    try {
        return new TextDecoder().decode(buf);
    } catch {
        return '';
    }
};

/**
 * Konvertiert ein ArrayBuffer in einen Base64-String.
 * @param {ArrayBuffer} buf
 * @returns {string}
 */
export const bufferToBase64 = (buf) => {
    const s = new TextDecoder('latin1').decode(buf);
    return btoa(s);
};

/**
 * Kodiert einen String-Payload in ein ArrayBuffer gemäß dem gewählten Encoding.
 * @param {string} input
 * @param {'text'|'hex'|'base64'} enc
 * @returns {ArrayBuffer}
 */
export function encodePayload(input, enc) {
    if (enc === 'hex') {
        const clean = input.replace(/\s+/g, '').toLowerCase();
        if (!/^([0-9a-f]{2})+$/.test(clean)) {
            throw new Error('Ungültiges Hex-Format');
        }
        const bytes = clean.match(/.{1,2}/g).map(h => parseInt(h, 16));
        return new Uint8Array(bytes).buffer;
    }

    if (enc === 'base64') {
        try {
            const bin = atob(input.trim());
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) {
                bytes[i] = bin.charCodeAt(i);
            }
            return bytes.buffer;
        } catch(e) {
            throw new Error('Ungültiges Base64-Format');
        }
    }
    return new TextEncoder().encode(input).buffer;
}


// --- Parser- und Distanzlogik (DIESE FEHLTE) ---

/**
 * Formatiert 16 Bytes (aus einem DataView) in einen UUID-String.
 * @param {DataView} dataView
 * @param {number} offset
 * @returns {string}
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
 * Hilfsfunktion zur Distanzberechnung (Log-Distance Path Loss Model).
 * @param {number} rssi - Aktuell gemessener RSSI (z.B. -70)
 * @param {number} txPower - Kalibrierte Sendeleistung auf 1m (z.B. -59)
 * @param {number} n - Umweltfaktor (typ. 2.0-4.0)
 * @returns {number} Geschätzte Distanz in Metern
 */
export function calculateDistance(rssi, txPower, n = 3.0) {
    if (rssi === 0 || txPower === 0) {
        return -1.0; // Ungültige Werte
    }

    const ratio = rssi * 1.0 / txPower;
    if (ratio < 1.0) {
        return Math.pow(ratio, 10);
    } else {
        const distance = Math.pow(10, ((txPower - rssi) / (10 * n)));
        return distance;
    }
}


/**
 * Versucht, Apple iBeacon-Daten zu parsen.
 * @param {DataView} dataView
 * @returns {object|null}
 */
function parseAppleiBeacon(dataView) {
    if (dataView.byteLength >= 23 &&
        dataView.getUint8(0) === 0x02 &&
        dataView.getUint8(1) === 0x15) { 
        
        const uuid = bytesToUuid(dataView, 2);
        const major = dataView.getUint16(18);
        const minor = dataView.getUint16(20);
        const txPower = dataView.getInt8(22); // Als Zahl (z.B. -59)
        
        return {
            type: 'iBeacon (Apple)',
            uuid,
            major,
            minor,
            txPower: txPower, 
        };
    }
    return null;
}

/**
 * Haupt-Parser für Manufacturer-Daten.
 * @param {Map<number, DataView>} manufDataMap
 * @returns {object}
 */
export function parseManufacturerData(manufDataMap) {
    let parsedResults = [];
    let rawHex = [];
    let topTxPower = null; 

    if (!manufDataMap || manufDataMap.size === 0) {
        return { type: 'raw', data: 'N/A' };
    }

    for (let [companyId, dataView] of manufDataMap.entries()) {
        const companyIdHex = `0x${companyId.toString(16).toUpperCase().padStart(4, '0')}`;
        let parsed = null;

        if (companyId === 0x004C) { // Apple
            parsed = parseAppleiBeacon(dataView);
        }
        
        if (parsed) {
            parsed.companyId = companyIdHex;
            parsedResults.push(parsed);
            if (parsed.txPower && topTxPower === null) {
                topTxPower = parsed.txPower;
            }
        }
        
        rawHex.push({
            companyId: companyIdHex,
            hex: bufferToHex(dataView.buffer)
        });
    }

    if (parsedResults.length > 0) {
        return { type: 'parsed', data: parsedResults, txPower: topTxPower };
    } else {
        return { type: 'raw', data: rawHex };
    }
}
