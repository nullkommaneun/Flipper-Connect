# Flipper Web Bluetooth Workbench (No-JSON-Module Build)
- Entfernt `import ... assert { type: 'json' }` (macht auf Mobile/Pages Probleme).
- Lädt `flipper_services.json` via `fetch()` mit Fallback auf harte Defaults.
- Preflight-Update garantiert, Service-Explorer nach `connect()`.
