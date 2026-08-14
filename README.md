# Portriga – Punkteblock

Punkteblock für das Stichspiel Portriga: Ansagen und Stiche eintragen, Punkte
werden automatisch berechnet, und über alle Partien hinweg entsteht eine
Statistik. Läuft als reine Webseite ohne Server – Bedienung und Rechenlogik
entsprechen genau der bisherigen Python-/Flet-App.

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Seitengerüst mit allen Ansichten |
| `styles.css` | Gestaltung |
| `db.js` | Datenhaltung (ersetzt die frühere SQLite-Datenbank) |
| `app.js` | Spielablauf, Statistik, Bearbeiten |
| `manifest.webmanifest` | Name und Symbol für den Homebildschirm |
| `icon-*.png` | Symbole für Homebildschirm und Browser-Tab |
| `icons_erzeugen.py` | Erzeugt die Icons neu (optional, nur zum Anpassen) |

Keine Abhängigkeiten, kein Build-Schritt. Die Schriften kommen von Google Fonts.

## Symbol auf dem Homebildschirm

Wer die Seite auf dem Handy über „Zum Homebildschirm hinzufügen“ ablegt,
bekommt ein eigenes Symbol statt eines Screenshots der Seite, und die App
öffnet ohne Browserleiste. Dafür sorgen `manifest.webmanifest` und die
`icon-*.png`-Dateien.

Welche Datei genutzt wird:

| Gerät | Quelle |
|---|---|
| iPhone / iPad (Safari) | `icon-180.png` über `apple-touch-icon` |
| Android (Chrome) | `icon-192.png` und `icon-512.png` aus dem Manifest |
| Android, runde Symbole | `icon-maskable-512.png` |
| Browser-Tab | `icon-32.png` |

**Eigenes Symbol verwenden:** Entweder die PNG-Dateien in denselben Größen
austauschen, oder `icons_erzeugen.py` anpassen und neu ausführen:

```bash
pip install pillow
python3 icons_erzeugen.py
```

Wichtig: Handys merken sich Symbole hartnäckig. Nach einer Änderung die alte
Verknüpfung löschen, die Seite neu laden und erst dann wieder ablegen.

## Auf GitHub Pages veröffentlichen

1. Alle Dateien aus diesem Ordner ins Repository legen (direkt im
   Hauptverzeichnis, nicht in einem Unterordner).
2. Im Repository auf **Settings → Pages** gehen.
3. Bei **Source** „Deploy from a branch“ wählen, als Branch `main` und als
   Ordner `/ (root)`.
4. Speichern. Nach etwa einer Minute ist die Seite unter
   `https://DEIN-NAME.github.io/DEIN-REPO/` erreichbar.

Änderungen an den Dateien sind nach dem nächsten Push automatisch live.

## Besucherzählung mit GoatCounter einrichten

1. Auf [goatcounter.com](https://www.goatcounter.com) ein kostenloses Konto
   anlegen. Dabei wird ein Code vergeben, also der Teil vor `.goatcounter.com`
   in der Adresse des Zählers.
2. In `index.html` in der Zeile mit `data-goatcounter` den Platzhalter
   `DEIN-CODE` durch diesen Code ersetzen:

   ```html
   <script data-goatcounter="https://meinspiel.goatcounter.com/count"
           async src="//gc.zgo.at/count.js"></script>
   ```

3. Fertig. Die Auswertung steht unter `https://DEIN-CODE.goatcounter.com`.

Gezählt werden neben dem Seitenaufruf auch die Wechsel zwischen den Ansichten,
damit erkennbar ist, was tatsächlich genutzt wird:

| Pfad | Bedeutung |
|---|---|
| `/` | Startseite |
| `/spiel` | Partie läuft |
| `/spiel-ende` | Partie beendet |
| `/statistik` | Spielerstatistik geöffnet |
| `/bearbeiten` | Bearbeiten-Menü geöffnet |
| `/ereignis/spiel-gestartet` | Partie gestartet |
| `/ereignis/spiel-beendet` | Partie durchgespielt |

GoatCounter setzt keine Cookies und speichert keine personenbezogenen Daten.
Solange der Platzhalter `DEIN-CODE` unverändert bleibt, wird schlicht nichts
gezählt – die Seite funktioniert trotzdem vollständig.

## Wo die Daten liegen

Spieler und Partien werden im `localStorage` des Browsers gespeichert, also
direkt auf dem Gerät. Das bedeutet:

- Die Daten bleiben nach dem Schließen des Tabs erhalten.
- Jedes Gerät und jeder Browser hat einen eigenen Datenbestand.
- Wer die Browserdaten löscht, löscht auch die Partien.

Unter **Bearbeiten → Datensicherung** lässt sich der Bestand als JSON-Datei
herunterladen und auf einem anderen Gerät wieder einlesen.

## Spielregeln in Kürze

- 15 Runden mit 1, 2, 3, 4, 5, 6, 7, 7, 7, 6, 5, 4, 3, 2, 1 Karten.
- Vor jeder Runde sagt jeder Spieler seine Stiche an.
- Ansage getroffen: 10 Punkte plus 3 Punkte je Stich.
- Ansage verfehlt: 3 Minuspunkte je Stich Abweichung.
- In der ersten Runde gibt es keine Minuspunkte.
- Eine Runde lässt sich erst abschließen, wenn die Summe der eingetragenen
  Stiche der Kartenzahl dieser Runde entspricht.

## Statistik

- **Ø Pkt/Spiel** – Durchschnittliche Endpunktzahl.
- **Ø Platz** – Genormte Platzierung: 0 heißt im Schnitt immer Platz 1,
  1 heißt im Schnitt immer letzter Platz. Dadurch bleiben Partien mit
  unterschiedlicher Spieleranzahl vergleichbar.
- **Highscore** – Beste Einzelpartie.

Ein Tipp auf eine Zeile zeigt alle Partien dieses Spielers mit Platz, Punkten,
Rückstand auf Platz 1 und Mitspielern.

## Bearbeiten

Vor jeder Änderung erscheint eine Sicherheitsabfrage.

- **Spieler löschen** – Der Spieler verschwindet aus der Auswahl und aus der
  Statistik-Übersicht. In bereits gespielten Partien erscheint er weiterhin,
  dort dann als „Gelöschter Spieler“, damit die Statistiken der Mitspieler
  unverändert bleiben.
- **Spieler bearbeiten** – Namen ändern.
- **Spiel bearbeiten** – Endpunkte, Datum und Uhrzeit ändern. Plätze und
  Statistikwerte werden neu berechnet.
- **Spiel löschen** – Die Partie verschwindet aus allen Statistiken, die
  daraufhin neu berechnet werden.
