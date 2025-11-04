/* === ui.js (Auszug: nur die geänderte Funktion) === */

// ... (Andere ui.js Funktionen wie diagLog, startSilentAudio, setupUIListeners bleiben unverändert) ...

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
        // Neue Karten oben einfügen (wird durch Sortierung später ggf. überschrieben)
        beaconDisplay.prepend(card);

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
        if (device.txPower !== undefined) {
            const distance = calculateDistance(device.txPower, device.rssi);
            card.querySelector('.distance-value').textContent = distance ? `~ ${distance} m` : '';
        }
    }
    
    // 5. Beacon-spezifische Daten (iBeacon) aktualisieren
    const detailsEl = card.querySelector('.beacon-details');
    if (device.type === 'iBeacon' && device.beaconData) {
        detailsEl.innerHTML = `
            <span class="beacon-uuid">UUID: ${device.beaconData.uuid}</span>
            <span class="beacon-major">Major: ${device.beaconData.major}</span>
            <span class="beacon-minor">Minor: ${device.beaconData.minor}</span>
            <span class="beacon-tx">TxPower: ${device.beaconData.txPower}</span>
        `;
    } else {
        detailsEl.innerHTML = ''; // Leeren, falls es kein iBeacon (mehr) ist
    }

    // 6. NEU: Telemetriedaten (RuuviTag) aktualisieren
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
        // (Beschleunigungsdaten bei Bedarf hinzufügen, hier weggelassen für Übersichtlichkeit)
        // if (device.telemetry.accelerationX !== undefined && device.telemetry.accelerationX !== null) {
        //     html += `<span class="accel-data">Acc (X/Y/Z): ${device.telemetry.accelerationX.toFixed(2)} / ${device.telemetry.accelerationY.toFixed(2)} / ${device.telemetry.accelerationZ.toFixed(2)} G</span>`;
        // }
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

// ... (getRssiColor und andere ui.js Funktionen) ...
