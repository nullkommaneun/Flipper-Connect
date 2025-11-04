/**
 * Erzeugt einen Zeitstempel im Format HH:MM:SS.
 * @returns {string}
 */
export function ts() {
    return new Date().toLocaleTimeString([], { hour12: false });
}

/**
 * Schreibt eine formatierte Zeile in ein Log-Element (XSS-sicher).
 * @param {HTMLElement} el - Das <pre> oder <div> Log-Element.
 * @param {'INFO'|'ERROR'|'READ'|'WRITE'|'NOTIFY'|'TAG'|string} type - Der Typ des Logs.
 * @param {string} msg - Die Log-Nachricht.
 */
export function log(el, type, msg) {
    const line = document.createElement('div');
    
    // Zeitstempel
    const t = document.createElement('span');
    t.className = 'ts';
    t.textContent = `[${ts()}] `; // Sicher

    // Tag (z.B. INFO, ERROR)
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = type ? `${type}: ` : ''; // Sicher

    // Nachricht
    const text = document.createElement('span');
    if (type === 'ERROR') {
        text.className = 'err';
    }
    text.textContent = msg; // Sicher

    line.append(t, tag, text);
    el.append(line);
    
    // Automatisch nach unten scrollen
    el.scrollTop = el.scrollHeight;
}

/**
 * Kürzt eine UUID auf 8 Zeichen mit "…"
 * @param {string} u - Die UUID.
 * @returns {string} Die gekürzte UUID.
 */
export const shortUuid = (u) => {
    if (!u) return '';
    const lower = u.toLowerCase();
    return lower.length > 8 ? lower.slice(0, 8) + '…' : lower;
};

/**
 * Konvertiert ein ArrayBuffer in einen Hex-String (mit Leerzeichen).
 * @param {ArrayBuffer} buf - Das Eingabe-Buffer.
 * @returns {string} Ein Hex-String, z.B. "0a 1f 2b".
 */
export const bufferToHex = (buf) => {
    return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
};

/**
 * Versucht, ein ArrayBuffer als UTF-8-Text zu dekodieren.
 * @param {ArrayBuffer} buf - Das Eingabe-Buffer.
 * @returns {string} Der dekodierte Text oder ein leerer String bei Fehler.
 */
export const bufferToText = (buf) => {
    try {
        return new TextDecoder().decode(buf);
    } catch {
        return ''; // Bei ungültiger UTF-8-Sequenz
    }
};

/**
 * Konvertiert ein ArrayBuffer in einen Base64-String.
 * (REFAKTORED: Verwendet TextDecoder('latin1') für Effizienz).
 * @param {ArrayBuffer} buf - Das Eingabe-Buffer.
 * @returns {string} Der Base64-kodierte String.
 */
export const bufferToBase64 = (buf) => {
    // 'latin1' mappt jedes Byte (0-255) 1:1 auf ein Zeichen.
    // Dies ist der effizienteste Weg, einen Binärstring für btoa() zu erstellen.
    const s = new TextDecoder('latin1').decode(buf);
    return btoa(s);
};

/**
 * Kodiert einen String-Payload in ein ArrayBuffer gemäß dem gewählten Encoding.
 * @param {string} input - Der Eingabe-String (Text, Hex oder Base64).
 * @param {'text'|'hex'|'base64'} enc - Das zu verwendende Encoding.
 * @returns {ArrayBuffer} Das kodierte Buffer.
 * @throws {Error} Wenn das Hex- oder Base64-Format ungültig ist.
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
            // (REFAKTORED: Fängt Fehler von atob ab)
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

    // Standard ist 'text' (UTF-8)
    return new TextEncoder().encode(input).buffer;
}
