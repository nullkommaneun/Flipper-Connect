/* === utils.js === */
import { diagLog } from './ui.js';

// Das Company ID Mapping (wird von loadCompanyIDs geladen)
let companyIDs = {};

/**
 * Lädt die Company ID JSON-Datei.
 */
export async function loadCompanyIDs() {
    try {
        const response = await fetch('./company_ids.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        companyIDs = await response.json();
        diagLog('Company IDs geladen.', 'utils');
    } catch (error) {
        diagLog(`Fehler beim Laden der Company IDs: ${error}`, 'error');
    }
}

/**
 * Berechnet die ungefähre Distanz in Metern aus RSSI und TxPower.
 */
export function calculateDistance(txPower, rssi) {
    if (txPower === undefined || rssi === undefined) {
        return null;
    }
    // Standard-TxPower, falls nicht im Advertisement, aber Gerät bekannt (Platzhalter)
    // Ein echter TxPower-Wert von 0 ist unwahrscheinlich, wird oft als Platzhalter für "nicht verfügbar" genutzt.
    // Wir nehmen einen Standardwert von -59 an, wenn txPower 0 oder ungültig ist.
    const effectiveTxPower = (txPower === 0) ? -59 : txPower;

    if (rssi === 0) {
        return null; // Kann nicht berechnet werden
    }

    const ratio = rssi * 1.0 / effectiveTxPower;
    if (ratio < 1.0) {
        return Math.pow(ratio, 10).toFixed(2);
    } else {
        const distance = (0.89976) * Math.pow(ratio, 7.7095) + 0.111;
        return distance.toFixed(2);
    }
}

// -------------------------------------------------------------------------
// NEUE PARSING-ARCHITEKTUR (PHASE 3)
// -------------------------------------------------------------------------

/**
 * Haupt-Parser (Dispatcher) für eingehende Advertisement-Pakete.
 * Untersucht Manufacturer Data und Service Data.
 *
 * @param {BluetoothAdvertisingEvent} event - Das BLE Advertising Event.
 * @returns {object} Ein Objekt mit geparsten Daten (deviceInfo, beaconData, telemetry).
 */
export function parseAdvertisementData(event) {
    const deviceName = event.device.name || 'N/A';
    const manufacturerData = event.manufacturerData;
    const serviceData = event.serviceData;

    let parsedData = {
        name: deviceName,
        company: 'Unknown',
        type: 'Generic BLE',
        telemetry: null // Hier landen Sensorwerte
    };

    // 1. Manufacturer Data parsen (iBeacon, RuuviTag, etc.)
    if (manufacturerData) {
        for (const [companyID, dataView] of manufacturerData.entries()) {
            
            // Name des Herstellers nachschlagen
            if (companyIDs[companyID]) {
                parsedData.company = companyIDs[companyID];
            }

            // Parser-Dispatcher
            switch (companyID) {
                case 0x004C: // Apple (iBeacon)
                    parsedData.type = 'iBeacon';
                    parsedData.beaconData = parseAppleIBeacon(dataView);
                    break;
                case 0x0499: // Ruuvi Innovations Ltd (RuuviTag)
                    parsedData.type = 'RuuviTag';
                    // Versuch, das Format zu parsen
                    const ruuviData = parseRuuviTag(dataView);
                    if (ruuviData) {
                        parsedData.telemetry = ruuviData;
                    } else {
                        parsedData.type = 'RuuviTag (Unknown Format)';
                    }
                    break;
                // Zukünftige industrielle Parser hier einfügen...
                // case 0x0059: // Nordic Semiconductor
                // case 0x00D2: // Bosch
                //     break;
            }
        }
    }

    // 2. Service Data parsen (z.B. BTHome)
    // (Implementierung in einem späteren Schritt, hier als Platzhalter)
    if (serviceData) {
         for (const [uuid, dataView] of serviceData.entries()) {
             // BTHome (0xFCD2) oder andere Service-basierte Protokolle
             // if (uuid.includes('fcd2')) {
             //    parsedData.type = 'BTHome';
             //    parsedData.telemetry = parseBTHome(dataView);
             // }
         }
    }

    return parsedData;
}


/**
 * Parst Apple iBeacon Daten (Company ID 0x004C).
 * @param {DataView} dataView - Die Manufacturer-spezifischen Daten.
 * @returns {object} Gep_arste iBeacon-Daten (uuid, major, minor, txPower).
 */
function parseAppleIBeacon(dataView) {
    if (dataView.byteLength < 25 || dataView.getUint8(0) !== 0x02 || dataView.getUint8(1) !== 0x15) {
        diagLog('Keine gültigen iBeacon-Daten (Header falsch).', 'utils');
        return null;
    }

    // UUID (16 Bytes)
    let uuid = '';
    for (let i = 2; i < 18; i++) {
        let hex = dataView.getUint8(i).toString(16).padStart(2, '0');
        uuid += hex;
        if (i === 5 || i === 7 || i === 9 || i === 11) {
            uuid += '-';
        }
    }

    const major = dataView.getUint16(18, false); // Big Endian
    const minor = dataView.getUint16(20, false); // Big Endian
    const txPower = dataView.getInt8(22); // Gemessene Leistung bei 1m

    return { uuid, major, minor, txPower };
}

/**
 * Parst RuuviTag Daten (Company ID 0x0499).
 * Fokussiert auf Data Format 5.
 * @param {DataView} dataView - Die Manufacturer-spezifischen Daten.
 * @returns {object|null} Ein Objekt mit Telemetriedaten oder null.
 */
function parseRuuviTag(dataView) {
    const format = dataView.getUint8(0);

    if (format === 0x05) {
        // Data Format 5 (RAWv2)
        if (dataView.byteLength < 24) {
            diagLog('RuuviFormat 5: Paket zu kurz.', 'utils');
            return null;
        }

        try {
            const telemetry = {};

            // Temperatur (Bytes 1-2): Int16, 0.005 Grad Celsius
            const temp = dataView.getInt16(1, false); // Big Endian
            telemetry.temperature = (temp === -32768) ? null : (temp * 0.005);

            // Luftfeuchtigkeit (Bytes 3-4): UInt16, 0.0025 %
            const humidity = dataView.getUint16(3, false);
            telemetry.humidity = (humidity === 0xFFFF) ? null : (humidity * 0.0025);

            // Luftdruck (Bytes 5-6): UInt16, Pa, Offset -50000
            const pressure = dataView.getUint16(5, false);
            telemetry.pressure = (pressure === 0xFFFF) ? null : ((pressure + 50000) / 100); // Umrechnung in hPa

            // Beschleunigung X (Bytes 7-8): Int16, mG
            const accX = dataView.getInt16(7, false);
            telemetry.accelerationX = (accX === -32768) ? null : (accX / 1000); // Umrechnung in G

            // Beschleunigung Y (Bytes 9-10): Int16, mG
            const accY = dataView.getInt16(9, false);
            telemetry.accelerationY = (accY === -32768) ? null : (accY / 1000); // Umrechnung in G

            // Beschleunigung Z (Bytes 11-12): Int16, mG
            const accZ = dataView.getInt16(11, false);
            telemetry.accelerationZ = (accZ === -32768) ? null : (accZ / 1000); // Umrechnung in G

            // Power Info (Bytes 13-14)
            const powerInfo = dataView.getUint16(13, false);
            // Spannung (oberste 11 bits)
            const voltage = (powerInfo >>> 5) + 1600; // Offset 1600mV
            telemetry.voltage = (voltage === 4647) ? null : (voltage / 1000); // Umrechnung in V
            // Tx Power (unterste 5 bits)
            // const txPower = (powerInfo & 0x001F) * 2 - 40; // Offset -40dBm
            // (Wir nutzen TxPower aus dem iBeacon-Teil, falls vorhanden, oder das txPower des Events)

            return telemetry;

        } catch (e) {
            diagLog(`Fehler beim Parsen von RuuviTag: ${e}`, 'error');
            return null;
        }
    }
    
    // Andere Ruuvi-Formate (3, 4) könnten hier implementiert werden.
    diagLog(`Unbekanntes RuuviFormat: ${format}`, 'utils');
    return null;
}
