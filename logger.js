/* === logger.js === */

/**
 * Protokolliert eine Nachricht im Diagnosefenster im UI.
 * @param {string} message - Die anzuzeigende Nachricht.
 * @param {string} [level='info'] - Der Log-Level (z.B. 'info', 'error', 'warn', 'utils', 'bt').
 */
export function diagLog(message, level = 'info') {
    // Fangen Sie den Fall ab, dass das DOM noch nicht bereit ist (sehr früher Fehler)
    const logContainer = document.getElementById('diag-log');
    if (!logContainer) {
        console.log(`[DIAG-FALLBACK | ${level}] ${message}`);
        return;
    }

    const entry = document.createElement('div');
    entry.className = `log-entry ${getLogLevelClass(level)}`;
    
    const timestamp = new Date().toLocaleTimeString('de-DE', { hour12: false });
    
    entry.innerHTML = `
        <span class="log-time">[${timestamp}]</span>
        <span class="log-level">[${level.toUpperCase()}]</span>
        <span class="log-msg">${message}</span>
    `;
    
    // Oben einfügen und Scrollen
    logContainer.prepend(entry);

    // Nur die letzten 100 Einträge behalten, um Überlauf zu vermeiden
    while (logContainer.children.length > 100) {
        logContainer.removeChild(logContainer.lastChild);
    }
}

/**
 * Gibt die CSS-Klasse basierend auf dem Log-Level zurück.
 * @param {string} level - Der Log-Level.
 * @returns {string} Die CSS-Klasse.
 */
function getLogLevelClass(level) {
    switch (level) {
        case 'error': return 'log-error';
        case 'warn': return 'log-warn';
        case 'utils': return 'log-utils';
        case 'bt': return 'log-bt';
        case 'info':
        default:
            return 'log-info';
    }
}
