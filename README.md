# Flipper Web Bluetooth Workbench

[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Eine schlanke, browserbasierte Web-Anwendung zur Interaktion mit Bluetooth LE-Geräten, mit speziellem Fokus auf den Flipper Zero. Sie bietet ein Terminal, einen GATT Service Explorer und einen passiven Beacon Sniffer.

Das Ziel dieses Projekts ist es, ein einfaches, client-seitiges Werkzeug (das auf GitHub Pages läuft) für das Debugging und die Interaktion mit BLE-Geräten bereitzustellen, ohne dass eine Installation nativer Software erforderlich ist.

[Ein Screenshot der Flipper Web Bluetooth Workbench Benutzeroberfläche]
*(Hinweis: Füge hier einen Screenshot deines Projekts ein. Lade ihn ins Repo hoch und verlinke ihn so: `![Screenshot](url_zum_bild.png)`)*

---

## ✨ Features

Die Workbench ist in zwei Hauptphasen unterteilt:

### Phase 1: GATT Explorer (Flipper-Modus)

Dies ist der interaktive Modus zur direkten Kommunikation mit einem verbundenen Gerät.

* **Verbinden & Trennen:** Startet den Web-Bluetooth-Geräte-Picker.
* **Service-Erkundung:** Listet alle Services und Characteristics des verbundenen Geräts in einer Akkordeon-Ansicht auf.
* **Volle GATT-Interaktion:**
    * **Lesen (Read):** Daten von einer Characteristic lesen.
    * **Schreiben (Write):** Daten an eine Characteristic senden (mit oder ohne Antwort).
    * **Abonnieren (Notify/Indicate):** Benachrichtigungen von einer Characteristic abonnieren und im Terminal anzeigen.

### Phase 2: Datenjagd (Beacon Sniffer)

Dies ist ein passiver Abhör-Modus, der die `requestLEScan`-API nutzt.

* **Passiver Scan:** Startet einen systemweiten Scan nach allen BLE-Advertisement-Paketen in der Umgebung.
* **Live-Protokollierung:** Zeigt erkannte Geräte, RSSI (Signalstärke) und Herstellerdaten (Manufacturer Data) live im Terminal an.
* **JSON-Download:** Ermöglicht den Download des gesamten Scan-Protokolls als `*.json`-Datei zur späteren Analyse.

### Terminal-Interface

Das Herzstück der Anwendung für Ein- und Ausgaben.

* **Sicheres Log:** Alle eingehenden Daten (Read, Notify, Scan) werden XSS-sicher über `.textContent` gerendert.
* **Sende-Optionen:** Sende Befehle als reinen **Text** (UTF-8), **Hex**-String oder **Base64**-String.
* **Ziel-Auswahl:** Wähle über ein Dropdown-Menü aus, an welche beschreibbare Characteristic die Daten gesendet werden sollen.

---

## 🛠️ Technologie-Stack

Dieses Projekt wurde bewusst schlank gehalten und nutzt keine Frameworks.

* **Vanilla JavaScript (ES Modules)**: Der gesamte Code ist in modernen, modularen JS-Dateien (`ui.js`, `bluetooth.js`, `utils.js`) geschrieben und nutzt Async/Await intensiv.
* **Web Bluetooth API**: Nutzt sowohl die GATT-Interaktion (`requestDevice`) als auch die LE-Scan-Funktionalität (`requestLEScan`).
* **HTML5 / CSS3**: Semantisches HTML für die Struktur.
* **Pico.css**: Ein "Class-less" Micro-CSS-Framework für sauberes, responsives Styling (inkl. Dark Mode) ohne Aufwand.
* **Chart.js**: Integriert für zukünftige Datenvisualisierungen (z. B. RSSI-Plots).

---

## 🚀 Loslegen

### Voraussetzungen

1.  Ein **moderner Browser**, der die Web Bluetooth API unterstützt (z. B. Chrome, Edge, Opera auf Desktop oder Android).
2.  **Wichtiger Hinweis:** Für die Web Bluetooth API ist ein **sicherer Kontext** erforderlich. Die Seite muss über **HTTPS** oder `http://localhost` aufgerufen werden.

### Benutzung

#### Option 1: Live-Demo (GitHub Pages)

Die einfachste Methode. Besuche einfach die GitHub Pages-Seite, die mit diesem Repository verknüpft ist:

**`https://nullkommaneun.github.io/Flipper-Connect/`**


#### Option 2: Lokale Entwicklung

1.  Klone dieses Repository:
    ```bash
    git clone [https://github.com/]https://nullkommaneun.github.io/Flipper-Connect/.git
    ```
2.  Wechsle in das Verzeichnis:
    ```bash
    cd [Fllipper-Connect]
    ```
3.  Starte einen lokalen Server. Da HTTPS erforderlich ist, funktioniert ein einfaches `python -m http.server` nicht für die Bluetooth-Funktionen.
    * **Empfohlen:** Verwende das **"Live Server"-Add-on in VS Code**. Es startet automatisch einen Server (oft auf `http://127.0.0.1:5500`, was als sicherer Kontext zählt).

---

## 📂 Projektstruktur

```
.
├── index.html            # Die Haupt-HTML-Datei (Struktur, UI-Elemente)
├── style.css             # Benutzerdefinierte Stile (Log-Fenster, Explorer-Layout)
├── src/
│   ├── ui.js             # Haupt-Logik, DOM-Elemente, Event-Listener
│   ├── bluetooth.js      # BluetoothManager-Klasse (GATT, Scan, Verbindung)
│   └── utils.js          # Hilfsfunktionen (Logging, Encoder, Decoder)
└── README.md             # Diese Datei
```

---

## 🛡️ Sicherheit

Ein Hauptaugenmerk bei der Entwicklung lag auf der Sicherheit. Da das Terminal Daten von potenziell unzuverlässigen Quellen (Bluetooth-Geräten) anzeigt, werden alle Log-Ausgaben in der `log()`-Funktion (siehe `utils.js`) **ausschließlich über `.textContent`** gerendert.

Dies verhindert effektiv Cross-Site Scripting (XSS)-Angriffe, selbst wenn ein Gerät versucht, bösartigen HTML- oder Skript-Code zu senden.

---

## 📈 Zukünftige Pläne

* [ ] Implementierung von **Chart.js** zur Visualisierung von RSSI-Werten über die Zeit.
* [ ] Hinzufügen von Filtern für den Beacon-Sniffer (z. B. "Nur Geräte mit 'Flipper' im Namen anzeigen").
* [ ] Speichern von bekannten Geräten oder bevorzugten Characteristics im LocalStorage.

---

## 📄 Lizenz

Dieses Projekt steht unter der MIT-Lizenz. Siehe die `LICENSE`-Datei für Details.

## 🙏 Danksagungen

* An [Pico.css](https://picocss.com/) für das mühelose und saubere Styling.
