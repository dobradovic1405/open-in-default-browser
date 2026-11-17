# Entscheidungen (Deutsch)

Übersicht aller Entscheidungen zu Tests, Repository, CI und Reporting, mit Begründung und verworfenen Alternativen.
Die vollständige englische Tabelle mit Status steht in [tests/DECISIONS.md](tests/DECISIONS.md). Bei Widersprüchen gilt diese Datei als Quelle, die Nummern (D01 bis D55) sind identisch.

Stand: 2026-11-16

Status: **entschieden** = gilt. **offen** = noch zu entscheiden oder zu tun.

---

## 1. Repository und Lizenz

| # | Entscheidung | Warum | Verworfen | Status |
| --- | --- | --- | --- | --- |
| D01 | Lizenz MIT, Copyright-Inhaber „Denis Obradovic“ | Standard für VS-Code-Erweiterungen. Freizügig, kurz, keine Copyleft-Pflichten | GPL-3.0 (würde Ableitungen ebenfalls zur Open-Source-Pflicht machen) | entschieden |
| D02 | Publisher-ID ist `denis-obradovic` | Muss mit dem Publisher im Marketplace übereinstimmen. Vorher `local`, was keine Veröffentlichung erlaubt | `local` beibehalten | entschieden. Marketplace-Publisher muss noch angelegt werden |
| D03 | Feld `repository` in `package.json` zeigt auf das GitHub-Repository | `vsce package` warnt sonst. Links auf der Marketplace-Seite | leer lassen (Paketierung schlägt fehl) | entschieden |
| D04 | Repository ist öffentlich | Öffentliche Repos bekommen kostenlose GitHub-Actions-Minuten. Zuerst privat gewünscht, dann öffentlich | privat | entschieden (jederzeit änderbar) |
| D05 | Sponsor-Link noch nicht festgelegt | `sponsor.url` in `package.json` wird vom Marketplace unterstützt. Optionen: GitHub Sponsors, Ko-fi, Buy Me a Coffee, PayPal.me | — | **offen** (kein Konto angelegt) |

## 2. Verhalten der Erweiterung und Code

| # | Entscheidung | Warum | Verworfen | Status |
| --- | --- | --- | --- | --- |
| D06 | `.js` wird nicht in `fileExtensions` aufgenommen | Browser zeigen JavaScript als Text, das der Editor besser darstellt. Live-Reload deckt Änderungen an `js`/`mjs` neben einer Seite bereits ab | `js` hinzufügen (würde jedes Skript im Browser öffnen) | entschieden |
| D07 | README-Befehlsname auf „Choose Open Mode“ korrigiert (vorher „Choose HTML Open Mode“) | Muss mit dem Befehl in `package.json` übereinstimmen | alter Name | entschieden |
| D08 | Test-Hook: `activate()` gibt `{ _test: … }` zurück (Launcher austauschen, Server-Port, Batch-Zähler). Keine öffentliche API | Tests dürfen keinen echten Browser öffnen. VS Code gibt nur den Rückgabewert von `activate()` an die Tests weiter, nicht `module.exports` | `module.exports` (Tests teilen keinen Modulzustand mit VS Code); `child_process` mocken (zerbrechlich) | entschieden |
| D09 | Windows: Fenstertitel mit Zero-Width-Space (U+200B, Edge) werden vor dem Abgleich normalisiert | Gefunden durch den Desktop-Test M-16. Edge setzt U+200B vor „Edge“, der Fenstercheck schlug fehl und Seiten blieben offen. Steht im CHANGELOG unter „Unreleased“ | Fall ignorieren (Fehler betrifft echte Edge-Nutzer) | entschieden |
| D10 | Löschbatches werden gezählt (`getDeleteBatches`) und getestet | Anforderung R28 verlangt den Nachweis, dass zwei Löschungen einen Batch bilden | nur Tab-Schließen testen (beweist das Batching nicht) | entschieden |

## 3. Manuelle Tests

| # | Entscheidung | Warum | Verworfen | Status |
| --- | --- | --- | --- | --- |
| D11 | Manuelle Fälle M-01 bis M-19 behalten ihre IDs. Jeder Fall läuft in allen drei Modi (`external`, `both`, `editor`) mit Ergebnismatrix | Die Modi verhalten sich unterschiedlich, ein Lauf pro Fall verdeckt das. Feste IDs halten die Verbindung zur Automatisierung | ein Lauf pro Fall (zu wenig); neue IDs (bricht Verweise) | entschieden |
| D12 | Erwartete Ergebnisse stehen pro Modus in der Fall-Tabelle | Der Tester soll nichts ableiten müssen | eine allgemeine Erwartung (falsch für zwei von drei Modi) | entschieden |
| D13 | Der Testplan darf nicht im Extension Development Host geöffnet werden (Dev-Host-Falle) | Im Modus `external` sendet die Erweiterung `.md`-Dateien an den Browser, also auch den Plan selbst | — (im Plan und in `manual/README.md` dokumentiert) | entschieden |
| D14 | Fälle mit Automatisierung sind als „automatisiert: Mechanik, manuell: visuelle Prüfung“ markiert (M-05, M-08, M-09, M-11) | Automatisierung prüft URLs, Einstellungen, Server, nicht was der Nutzer sieht | Fälle aus dem Plan streichen (visuelle Prüfung fehlte dann) | entschieden |
| D15 | Manuelle Ergebnisse sind noch leer | Nur die Person am Bildschirm sieht den Browser | — | **offen** (Tester füllt aus, siehe O1) |

## 4. Teststruktur

| # | Entscheidung | Warum | Verworfen | Status |
| --- | --- | --- | --- | --- |
| D16 | Ordner nach Testebene: `data/`, `integration/`, `e2e/`, `manual/`, `mutation/`, `testdata/` | Die Ebene sagt, was und wie getestet wird (Testpyramide, ISTQB) | Ordner nach Zweck (Smoke, Regression): ein Test kann beides sein | entschieden |
| D17 | Zweck als Tag im Titel: `@smoke` (5 Tests), `@regression` (7 Tests). Filter mit `--grep` / `--exclude` | Tags dürfen sich überschneiden. Playwright und Mocha unterstützen Titelfilter | Ordner pro Zweck (Überschneidung) | entschieden |
| D18 | Noch kein `unit/`-Ordner | Keine exportierten Funktionen. Unit-Tests brauchen zuerst Module | leerer Ordner (irreführend) | ersetzt durch D57 |
| D19 | Playwright-`testMatch` ist `*.spec.ts`, Mocha lädt `*.test.js` | Trennt beide Frameworks im selben Ordnerbaum | Standard-Matching (würde Mocha-Dateien einsammeln) | entschieden |
| D20 | Playwright-Tests aus dem Repo `playwright-ts-portfolio` übernommen, nur die Beispieldatei-Tests. `sample copy.xsd` entfällt. `login.spec.ts` und `example.spec.ts` bleiben im Portfolio | Nur die Beispieldatei-Tests gehören zu dieser Erweiterung | alles übernehmen (vermischt fremde Projekte) | entschieden |
| D21 | Testdaten bleiben in `tests/testdata/` | Vorhandene Fixtures. Umbenennen würde Dateiinhalte ändern, die Tests prüfen | Ordner umbenennen (nicht den Aufwand wert) | entschieden |

## 5. Testabdeckung und Qualität

| # | Entscheidung | Warum | Verworfen | Status |
| --- | --- | --- | --- | --- |
| D22 | Rückverfolgbarkeitstabelle `tests/traceability.md` ist die Quelle für Anforderungen. Kategorien: automatisiert + manuell, automatisiert, teilweise, nur manuell, keine | Lücken auf einer Seite sichtbar. Der Report nutzt sie | keine Zuordnung (Lücken unsichtbar) | entschieden |
| D23 | UI-Automatisierung (ExTester, Selenium) für Menüs, Tastenkürzel und Palette wird **nicht** umgesetzt | Menüs und Kürzel sind Konfiguration, `package.json`-Prüfungen fangen typische Fehler. UI-Tests hängen am VS-Code-Layout und bräuchten eine zweite Toolchain (ChromeDriver pro VS-Code-Version) | jetzt umsetzen (hoher Aufwand, brüchig). Neu bewerten, wenn Menü-Verdrahtung mehrfach bricht | entschieden |
| D24 | Desktop-Test für M-16 (Edge-Fenster schließt beim Löschen) ist **opt-in** mit `OPEN_IN_BROWSER_DESKTOP_TESTS=1`. Nicht in CI | Der Test nimmt den Fokus und sendet Tastendrücke. Er braucht einen Rechner, der gerade nicht benutzt wird | immer ausführen (stört den Nutzer); nie ausführen (Windows-Pfad ungetestet) | entschieden |
| D25 | Mutationstests mit 6 absichtlichen Fehlern (`tests/mutation/run-mutants.js`). Ergebnis 100 % | Zeigt, ob Tests echte Fehler finden und nicht nur laufen. Fand einen schwachen Test (R29), der dann verbessert wurde | keine (Coverage-Tools messen das nicht) | entschieden |
| D26 | Mutationstests laufen **nicht** in CI | Etwa 6 Minuten (VS Code startet pro Mutant einmal) | in CI (verlangsamt jeden Push) | entschieden. Vor Releases ausführen |
| D27 | Desktop-Mutant (Edge-Zero-Width-Space) ist nicht Teil des Mutationslaufs | Braucht den Opt-in-Desktop-Test | trotzdem aufnehmen (stört den Desktop) | entschieden |

## 6. Korrekturen an Tests (keine Produktänderungen)

| # | Problem | Lösung |
| --- | --- | --- |
| D28 | Live-Reload- und Löschtests liefen gegen den asynchron startenden Dateiwächter | Tests speichern jede Sekunde neu, bis der Wächter reagiert (`waitFor`). Der Löschtest wartet zuerst darauf |
| D29 | Modus-Handler schließt Tabs (unter Windows per PowerShell), eine kurz nach dem Moduswechsel geöffnete Datei konnte dadurch geschlossen werden | `setMode()` wartet 4 s nach dem Wechsel |
| D30 | Modus-Reset im `after`-Hook stoppte den Server während der nächsten Testdatei (E2E) | `after` nutzt ebenfalls `setMode()` und wartet |
| D31 | Browserseiten gelten 3 s nach dem letzten Poll als offen, der nächste Test bekam keinen Browserstart | E2E-Tests warten am Ende 3,5 s |
| D32 | SVG wird als `<img>` angezeigt, nicht als inline `<svg>` | Test prüft das geladene Bild, nicht ein SVG-Element |
| D33 | `ELECTRON_RUN_AS_NODE=1` in manchen Shells lässt VS Code als reines Node laufen | Der Runner entfernt die Variable vor dem Start |

## 7. Werkzeuge und Abhängigkeiten

| # | Entscheidung | Warum | Verworfen | Status |
| --- | --- | --- | --- | --- |
| D34 | Keine `requirements.txt`. Anforderungen stehen in `package.json` (`engines.node >= 20.19.0`) und `package-lock.json`, dokumentiert in `tests/README.md` | Node.js-Projekt. `requirements.txt` gehört zu Python | trotzdem anlegen (falsches Ökosystem) | entschieden |
| D35 | Installation mit `npm ci` in CI und für Testläufe | Exakte Versionen aus dem Lock-File | `npm install` (kann Versionen ändern) | entschieden |
| D36 | Mocha 12 (vorher 10). Nur Dev-Abhängigkeit | Neueste Version ohne verwundbare `diff`- und `glob`-Versionen | bei 10 bleiben (verwundbare Transitiv-Abhängigkeiten) | entschieden |
| D37 | `overrides` in `package.json` für `serialize-javascript`, `glob`, `minimatch` mit festen Versionen | `npm audit` meldete 4 bis 5 Funde, alle in Dev-Abhängigkeiten | `npm audit fix --force` (Breaking Changes) | entschieden. `npm audit` zeigt 0 Funde. Die ausgelieferte Erweiterung hängt nicht davon ab (`npm audit --omit=dev`: 0) |
| D38 | `@vscode/vsce` ist keine Dev-Abhängigkeit. CI und Doku nutzen `npx @vscode/vsce@3.9.2` | Kleiner Dev-Baum. Version festgepinnt, damit das Paket reproduzierbar ist | Dev-Abhängigkeit (zog verwundbare Pakete nach) | entschieden |
| D39 | `.vscodeignore` schließt Tests, CI, Reports und `marked` aus, außer `lib/marked.esm.js` | Kleineres Paket. Die Erweiterung lädt den ESM-Build | alles behalten (Tests und Maps im `.vsix`) | entschieden. Mit `vsce ls` geprüft |
| D40 | Playwright-Reporter: HTML (für Menschen) und JSON (für den Report) | Ein Lauf erzeugt beides | nur HTML (Report kann es nicht lesen) | entschieden |
| D41 | VS-Code-Testversion ist, was `@vscode/test-electron` beim ersten Lauf als „stable“ lädt (hier 1.146.0) | Testet den aktuellen Release | feste Version (mehr Pflege) | **offen** (Entscheidung über Pinnen, siehe O4) |

## 8. Continuous Integration

| # | Entscheidung | Warum | Verworfen | Status |
| --- | --- | --- | --- | --- |
| D42 | CI mit GitHub Actions (`.github/workflows/tests.yml`), nicht GitLab | Repository liegt auf GitHub. Kostenlos für öffentliche Repos | GitLab (zweites Repo oder Spiegel nötig) | entschieden |
| D43 | Auslöser: jeder Push auf jedem Branch und jeder Pull Request | Probleme erscheinen vor dem Merge | nur `main` (vorheriger Zustand) | entschieden |
| D44 | Runner `windows-latest`, Node 20.19 | Browser-Handling ist Windows-spezifisch, Testhost ist VS Code | Ubuntu (Windows-Pfad ungetestet, virtuelles Display nötig) | entschieden |
| D45 | Reihenfolge: zuerst Smoke-Gate, dann der Rest. Datentests laufen parallel. Umgesetzt in `tests/run-all.js` | Schlagen die Smoke-Tests fehl, werden die übrigen VS-Code-Tests übersprungen (schnelles Feedback). Datentests teilen keinen Zustand mit VS Code | ein einziger Lauf (kein frühes Feedback) | entschieden |
| D46 | Noch keine parallelen VS-Code-Instanzen | Lohnt erst ab etwa 5 Minuten. Heute etwa 85 s | Work-Stealing-Pool mit Prioritäten (überdimensioniert für 78 Tests) | entschieden. Nächster Schritt bei langsamer Suite: VS-Code-Tests nach Datei auf Instanzen verteilen, jede mit eigenem `--user-data-dir` |
| D47 | Paketprüfung läuft in CI | Fängt kaputte Pakete (fehlende Dateien, falsches Manifest) vor dem Release ab | nur lokal prüfen (wird vergessen) | entschieden |
| D48 | Qualitätsreport wird in CI gebaut und als Artefakt `quality-report` hochgeladen, plus Zusammenfassung auf der Run-Seite | Stakeholder sehen das Ergebnis ohne eigenen Lauf | keine | entschieden |
| D49 | Report-Schritt läuft mit `if: !cancelled()` | Ein fehlgeschlagener Test soll trotzdem einen Report liefern | nur bei Erfolg (kein Report, wenn er am nötigsten ist) | entschieden |

## 9. Reporting

| # | Entscheidung | Warum | Verworfen | Status |
| --- | --- | --- | --- | --- |
| D50 | Eigener Ein-Seiten-Report in `report/` (nur Node, eine HTML-Datei, keine Bibliotheken) | Stakeholder brauchen eine Seite, die man auf einen Blick erfasst. Kein Standardtool liefert das. Der Ordner kann ein eigenes Repo werden | Allure (zu detailliert, Ein-Seiter nur kostenpflichtig), mochawesome (nur Details) | entschieden. Allure kann später die Detailebene ergänzen |
| D51 | Report-Beschriftung auf Deutsch | Stakeholder sprechen Deutsch | Englisch (Testdoku ist Englisch) | entschieden. Änderung: Strings in `build-report.js` |
| D52 | Abdeckungs-KPI = automatisch geprüfte Anforderungen (automatisiert + automatisiert und manuell) geteilt durch alle. Teilweise zählt nicht | Teilweise ist keine Prüfung. Mitzählen würde die Abdeckung überhöhen | teilweise mitzählen (überhöht) | entschieden |
| D53 | Gesamtstatus: rot, wenn ein automatischer Test fehlschlägt; gelb, wenn manuelle Fälle offen sind, Lücken bestehen oder ein Mutant überlebt; sonst grün | Einfache Regel, die Stakeholder nachvollziehen können | mehr Farben oder Gewichtungen (schwerer lesbar) | entschieden |
| D54 | Reifegradmodell mit vier Stufen: manueller Plan; Smoke automatisiert; Regression und Integration mit mindestens 50 % Abdeckung; verifiziert (E2E, Mutationsscore mindestens 80 %, und **die CI-Pipeline lief**) | Klarer nächster Schritt. Interne Regeln, keine Industrienorm, das sagt der Report auch | ISTQB oder TMMi (zu schwer für eine Erweiterung) | entschieden. Stufe 4 braucht `GITHUB_ACTIONS=true`, lokal nicht erreichbar |
| D55 | Report zeigt nur den aktuellen Lauf, keine Historie | Historie braucht gespeicherte Ergebnisse früherer Läufe | jetzt bauen (noch nicht nötig) | **offen** (O6) |


## 10. Unit-Tests, Ebenen und Stabilität

| # | Entscheidung | Warum | Verworfen | Status |
| --- | --- | --- | --- | --- |
| D56 | Kein Ordner `system/`. Die Ebene, die ISTQB "Systemtest" nennt, deckt `e2e/` ab: die ganze Erweiterung läuft in VS Code, die Seiten werden in einem echten Browser geprüft. Manuelle Fälle und der Desktop-Test M-16 gehören zur selben Ebene | Ordner folgen der Testebene (D16). `e2e` benennt die Ebene, die wir testen. Umbenennen würde nur das Etikett ändern und die Verweise in der Doku brechen | `e2e/` in `system/` umbenennen (nur Etikett, viele Verweise); leerer Ordner `system/` (irreführend, siehe D18) | entschieden |
| D57 | Unit-Tests in `tests/unit/`, Mocha in reinem Node (`npm run test:unit`, Teil von `npm test`). Reine Hilfsfunktionen liegen in `lib/paths.js` und `lib/html.js`, `extension.js` importiert sie. Ergebnisse gehen nach `.vscode-test/unit-results.json` und als Ebene "Unit" in den Report | Reine Funktionen laufen in Millisekunden ohne VS Code. Mocha passt zu den anderen Suiten. `lib/` wird mitgeliefert, weil `.vscodeignore` nur `tests` und `report` ausschließt | Hilfsfunktionen aus `extension.js` exportieren (D08: keine öffentliche API, und Modulzustand wird mit VS Code geteilt); gesamten Code auf einmal verschieben (groß und riskant, Mutationstests hängen an exakten Code-Ankern) | entschieden. Server, Watcher und Tabs liegen weiter in `extension.js` (O7) |
| D58 | Zwei instabile Tests wurden behoben. (a) Die `beforeEach` der VS-Code-Tests wartet bei geändertem Modus auf den Handler (`setMode`). Der Handler stoppt den Server Sekunden später, und das traf den nächsten Test. (b) Der Chromium-Reload-Test wertet eine zerstörte Seitenkontext-Ausführung während der Prüfung als den Reload, auf den er wartet, und prüft danach den Marker erneut | Beide Ursachen wurden vor dem Fix in Logs gefunden. Danach drei volle Läufe in Folge grün (vorher zwei von drei fehlgeschlagen) | Tests wiederholen (verdeckt die Ursache); längere feste Wartezeiten (langsamer und trotzdem wacklig) | entschieden |
 und den Test-Hooks

Diese Punkte sind in D08 und D09 enthalten. Zusätzlich wurde geprüft:
- `npm run test:files` (Playwright, Datentests): 40 von 40 bestanden.
- `npm run test:smoke` (VS Code, Smoke-Gate): 5 von 5 bestanden.
- Nicht geprüft: vollständiger `test:extension`-Lauf, Mutationstests, der manuelle Edge-Test M-16.

## Offene Punkte

| # | Punkt | Wer |
| --- | --- | --- |
| O1 | Ergebnismatrix in `tests/manual/test-plan.md` ausfüllen (D15) | Tester |
| O2 | Sponsor-Plattform wählen und Konto anlegen (D05) | Denis |
| O3 | Marketplace-Publisher mit ID `denis-obradovic` anlegen (D02) | Denis |
| O4 | Entscheiden, ob die VS-Code-Testversion gepinnt wird (D41) | Denis |
| O5 | Commit und Push, damit CI erstmals auf GitHub läuft (D42 bis D49). Braucht Freigabe | Denis |
| O6 | Report-Historie für Trends speichern (D55) | später |
| O7 | `extension.js` weiter aufteilen: Server, Watcher und Tabs in Module (D57). Hilfsfunktionen und Unit-Tests sind fertig | später |
