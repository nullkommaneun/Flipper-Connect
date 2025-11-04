/* === ui.js === */
import { diagLog } from './logger.js';
import { calculateDistance } from './utils.js';

// Globale UI-Elemente
const scanButton = document.getElementById('scanButton');
const disconnectButton = document.getElementById('disconnectButton');
const deviceDisplay = document.getElementById('deviceDisplay');
const gattView = document.getElementById('gatt-view');
const beaconView = document.getElementById('beacon-view');
const viewToggle = document.getElementById('viewToggle');
const beaconDisplay = document.getElementById('beaconDisplay');
const sortButton = document.getElementById('sortButton');
const staleToggle = document.getElementById('staleToggle');

// Zustand
let audioCtx = null;
let keepAliveGain = null;

/**
 * Initialisiert alle UI-Event-Listener.
 * @param {object} callbacks - Objekt mit Callback-Funktionen (onScan, onDisconnect, etc.)
 */
export function setupUIListeners(callbacks) {
    diagLog('UI-Listener werden eingerichtet...', 'info');

    scanButton.addEventListener('click', callbacks.onScan);
    disconnectButton.addEventListener('click', callbacks.onDisconnect);
    sortButton.addEventListener('click', callbacks.onSort);

    viewToggle.addEventListener('click', () => {
        if (beaconView.style.display === 'none' || beaconView.style.display === '') {
            beaconView.style.display = 'block';
            gattView.style.display = 'none';
            viewToggle.textContent = 'GATT Explorer anzeigen';
            diagLog('Ansicht: Beacon Sniffer', 'info');
        } else {
            beaconView.style.display = 'none';
            gattView.style.display = 'block';
            viewToggle.textContent = 'Beacon Sniffer anzeigen';
            diagLog('Ansicht: GATT Explorer', 'info');
        }
    });

    staleToggle.addEventListener('change', (event) => {
        const isEnabled = event.target.checked;
        callbacks.onStaleToggle(isEnabled);
        diagLog(`Stale-Modus ${isEnabled ? 'aktiviert' : 'deaktiviert'}.`, 'info');
    });
}

/**
 * Startet einen stillen Audio-Stream, um den Bildschirm (insb. auf Mobilgeräten)
 * beim Scannen aktiv zu halten.
 */
export function startSilentAudio() {
    if (audioCtx) return; // Bereits initialisiert

    try {
        diagLog('Initialisiere Keep-Alive Audio Stream...', 'info');
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Erzeuge einen Oszillator (Quelle)
        const oscillator = audioCtx.createOscillator();
        oscillator.type = 'sine'; // Sinuswelle
        oscillator.frequency.setValueAtTime(20, audioCtx.currentTime); // 20 Hz (unhörbar)

        // Erzeuge einen GainNode (Lautstärkeregler)
        keepAliveGain = audioCtx.createGain();
        keepAliveGain.gain.setValueAtTime(0.0001, audioCtx.currentTime); // Extrem leise

        // Verbinde: Oszillator -> Gain -> Ziel (Lautsprecher)
        oscillator.connect(keepAliveGain);
        keepAliveGain.connect(audioCtx.destination);
        
        // Starte den Oszillator
        oscillator.start();

        // Wichtig: Auf Mobilgeräten muss der AudioContext oft durch eine Benutzergeste
        // "entsperrt" werden. Der Scan-Button ist unsere Geste.
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
         diagLog('Keep-Alive Audio aktiv.', 'info');
    } catch (e) {
        diagLog(`Fehler beim Starten des Audio-Streams: ${e.message}`, 'error');
    }
}

/**
 * Aktualisiert die Beacon-UI-Karte für ein Gerät oder erstellt eine neue.
 * @param {string} deviceId - Die eindeutige ID des Geräts.
 * @param {object} device - Das 'device'-Objekt aus der deviceMap.
 * @param {HTMLElement} beaconDisplay - Das Container-Element.
 */
export function updateBeaconUI(deviceId, device, beaconDisplay) {
    const cardId = `beacon-${deviceId}`;
    let card = document.getElementById(cardId);

    // 1. Karte erstellen, falls nicht vorhanden
    if (!card) {
        card = document.createElement('div');
        card.id = cardId;
        card.className = 'beacon-card';
        card.innerHTML = `
            <div class="card-header">
                <strong class="device-name">N/A</strong>
                <span class="device-id">${deviceId}</span>
            </div>
            <div class="card-content">
                <div class="rssi-container">
                    <span class="rssi-label">RSSI</span>
                    <span class="rssi-value">- dBm</span>
                    <span class="distance-value">~ ?.? m</span>
                </div>
                <div class="beacon-details">
                    </div>
                <div class="beacon-telemetry">
                    </div>
                <div class="company-info">
                    <span class="company-name"></span>
                    (<span class="device-type"></span>)
                </div>
            </div>
            <div class="card-footer">
                <canvas class="rssi-sparkline"></canvas>
            </div>
        `;
        beaconDisplay.prepend(card); // Neue Karten oben einfügen

        // Chart.js Sparkline initialisieren
        const ctx = card.querySelector('.rssi-sparkline').getContext('2d');
        device.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    borderColor: '#00faff',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { display: false },
                    y: { 
                        display: false,
                        min: -100, // Fester Bereich für RSSI
                        max: -30
                    }
                },
                plugins: { legend: { display: false } },
                animation: { duration: 0 }
            }
        });
    }

    // 2. Karte als "aktiv" markieren (für Stale-Modus)
    card.classList.remove('stale');
    device.lastSeen = Date.now();
    // Speichern des aktuellen RSSI-Werts für die Sortierung
    card.dataset.rssi = device.rssi;

    // 3. Allgemeine Daten aktualisieren
    card.querySelector('.device-name').textContent = device.name;
    card.querySelector('.company-name').textContent = device.company;
    card.querySelector('.device-type').textContent = device.type;

    // 4. RSSI- und Distanzdaten aktualisieren
    const rssiValueEl = card.querySelector('.rssi-value');
    if (device.rssi) {
        rssiValueEl.textContent = `${device.rssi} dBm`;
        rssiValueEl.style.color = getRssiColor(device.rssi);
        
        // Distanz nur anzeigen, wenn TxPower vorhanden ist
        // (device.txPower wird jetzt vom Parser in utils.js zugewiesen)
        if (device.txPower !== undefined && device.txPower !== 127) {
            const distance = calculateDistance(device.txPower, device.rssi);
            card.querySelector('.distance-value').textContent = distance ? `~ ${distance} m` : '';
        } else {
             card.querySelector('.distance-value').textContent = ''; // Keine TxPower, keine Distanz
        }
    }
    
    // 5. Beacon-spezifische Daten (iBeacon) aktualisieren
    const detailsEl = card.querySelector('.beacon-details');
    if (device.type === 'iBeacon' && device.beaconData) {
        detailsEl.innerHTML = `
            <span class="beacon-uuid">UUID: ${device.beaconData.uuid}</span>
            <span class="beacon-major">Major: ${device.beaconData.major}</span>
            <span class="beacon-minor">Minor: ${device.beaconData.minor}</span>
        `;
    } else {
        detailsEl.innerHTML = ''; // Leeren, falls es kein iBeacon (mehr) ist
    }

    // 6. Telemetriedaten (RuuviTag) aktualisieren
    const telemetryEl = card.querySelector('.beacon-telemetry');
    if (device.telemetry) {
        let html = '';
        if (device.telemetry.temperature !== undefined && device.telemetry.temperature !== null) {
            html += `<span>🌡️ ${device.telemetry.temperature.toFixed(2)} °C</span>`;
        }
        if (device.telemetry.humidity !== undefined && device.telemetry.humidity !== null) {
            html += `<span>💧 ${device.telemetry.humidity.toFixed(2)} %</span>`;
        }
        if (device.telemetry.pressure !== undefined && device.telemetry.pressure !== null) {
            html += `<span>📊 ${device.telemetry.pressure.toFixed(2)} hPa</span>`;
        }
        if (device.telemetry.voltage !== undefined && device.telemetry.voltage !== null) {
            html += `<span>⚡ ${device.telemetry.voltage.toFixed(3)} V</span>`;
        }
        telemetryEl.innerHTML = html;
    } else {
        telemetryEl.innerHTML = ''; // Leeren
    }

    // 7. Sparkline aktualisieren
    if (device.chart && device.rssi) {
        const chart = device.chart;
        chart.data.labels.push(Date.now());
        chart.data.datasets[0].data.push(device.rssi);

        // Daten auf die letzten 20 Messpunkte beschränken
        const maxDataPoints = 20;
        if (chart.data.labels.length > maxDataPoints) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }
        chart.update();
    }
}

/**
 * Gibt eine Farbe basierend auf der RSSI-Signalstärke zurück.
 * @param {number} rssi - Der RSSI-Wert.
 * @returns {string} Ein CSS-Farbwert.
 */
function getRssiColor(rssi) {
    if (rssi > -60) return '#00ff00'; // Grün (Sehr gut)
    if (rssi > -75) return '#ffff00'; // Gelb (Gut)
    if (rssi > -90) return '#ffa500'; // Orange (Mittel)
    return '#ff0000'; // Rot (Schwach)
}

/**
 * Setzt den Status der Scan/Disconnect-Buttons.
 * @param {boolean} isScanning - Ob gerade gescannt wird.
 */
export function setScanStatus(isScanning) {
    scanButton.disabled = isScanning;
    disconnectButton.disabled = !isScanning;
    scanButton.textContent = isScanning ? 'Scanne...' : 'Scan starten';
}
