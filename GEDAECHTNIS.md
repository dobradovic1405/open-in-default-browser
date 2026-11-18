# Gedächtnis des Projekts

Was man über dieses Projekt wissen muss, ohne den Verlauf nachzulesen. Die Begründungen stehen in [ENTSCHEIDUNGEN.md](ENTSCHEIDUNGEN.md). Die vollständige Tabelle steht in [tests/DECISIONS.md](tests/DECISIONS.md).

Stand: 2026-11-17

## Projekt

- VS-Code-Erweiterung „Open in Default Browser“. Öffnet Dateien im Standardbrowser oder in VS Code, mit Live-Reload und Löschbehandlung.
- Version im CHANGELOG: 1.10.0. Unveröffentlichte Änderung: Edge-Fix unter Windows (Zero-Width-Space im Fenstertitel).
- Repository liegt auf GitHub, öffentlich. Hauptbranch: `main`. Letzter Commit: `b2d4aa1 Add test suites, quality report and CI; split helpers into lib/`. Vorher: `94a4f8d VSCodeExtension to open external browser`.
- Plattform der Entwicklung: Windows 11. Shell im Projekt ist PowerShell, Git Bash ist ebenfalls verfügbar.

## Stand der Arbeit

- Testsuite (2026-11-17): `npm test` grün. Unit 33/33, Daten 40/40, Smoke 32/32 (plus 1 übersprungen), Rest grün. M-16 (Desktop, mit Opt-in) grün.
- Mutationstests nach dem Refactor: 6 von 6 gefunden (100 %). Ergebnis in `tests/mutation/results.json`.
- Zwei instabile Tests behoben (D58). Vorher schlugen zwei von drei Gesamtläufen fehl.
- Refactor: Hilfsfunktionen in `lib/paths.js` und `lib/html.js` (D57). `extension.js` importiert sie.
- Commit und Push auf `main` sind erfolgt (O5, Commit `b2d4aa1`).

## Arbeitsregeln

Diese Regeln stammen aus den Vorgaben der Sitzung. Sie sind nicht in einem Gespräch mit Denis bestätigt worden.

- Antworten an Denis auf Deutsch. Code, Kommentare in Dateien und Testdoku bleiben englisch. Report-Texte sind englisch (D59, ersetzt D51).
- Commits enden mit `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`. Pull Requests enden mit `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Commit und Push nur auf ausdrückliche Anweisung.
- Entscheidungen werden mit Begründung und verworfenen Alternativen festgehalten, nicht nur als Ergebnis.

## Wichtige technische Fakten

- Test-Hooks in `extension.js`: `activate()` gibt `{ _test: … }` zurück. Das ist keine öffentliche API (D08).
- Browserstart in Tests ist austauschbar über `setBrowserLauncher`. Tests öffnen so keinen echten Browser.
- Windows-Fenstertitel werden vor dem Abgleich um U+200B, U+200C, U+200D und U+FEFF bereinigt (D09).
- Der Desktop-Test M-16 ist opt-in mit `OPEN_IN_BROWSER_DESKTOP_TESTS=1` (D24).
- Im Modus `external` schickt die Erweiterung `.md`-Dateien an den Browser. Den Testplan nie im Extension Development Host öffnen (D13).
- Mocha 12, Playwright für Datentests, VS Code 1.146.0 für Integrationstests (über `@vscode/test-electron`).
- `npx @vscode/vsce@3.9.2` für das Paketieren (D38).
- Smoke-Tests haben `@smoke` im Titel, Regressionstests `@regression`.
- Unit-Tests (`tests/unit/`) laufen ohne VS Code in Node (`npm run test:unit`). Sie testen die Module in `lib/`.
- Die Ebene „Systemtest“ heißt im Projekt `e2e/` (D56). Es gibt keinen Ordner `system/`.
- Der Report (`report/`) liest die Ergebnisse aus `.vscode-test/` und `tests/mutation/results.json`. Eine Historie gibt es noch nicht (O6).

## Offene Punkte

- O1: Manuelle Ergebnisse ausfüllen (Tester).
- O2: Sponsor-Plattform und Konto (Denis).
- O3: Marketplace-Publisher `denis-obradovic` anlegen (Denis).
- O4: VS-Code-Testversion pinnen oder nicht (Denis).
- O5: Commit und Push für CI. Freigegeben, siehe Stand der Arbeit.
- O6: Report-Historie für Trends (später).
- O7: `extension.js` weiter aufteilen: Server, Watcher, Tabs (später). Hilfsfunktionen und Unit-Tests sind fertig.

## Quellen

- [ENTSCHEIDUNGEN.md](ENTSCHEIDUNGEN.md): Entscheidungen mit Begründung (deutsch).
- [tests/DECISIONS.md](tests/DECISIONS.md): Vollständige Entscheidungsliste (englisch, Quelle).
- [tests/README.md](tests/README.md): Testordner und Befehle.
- [tests/traceability.md](tests/traceability.md): Anforderungen und Testabdeckung.
- [report/README.md](report/README.md): Qualitätsreport.
