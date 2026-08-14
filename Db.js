/* ============================================================
   Portriga – Datenhaltung
   Ersetzt die frühere SQLite-Datenbank (db.py) durch localStorage.
   Datenmodell und Funktionsnamen entsprechen 1:1 der Python-Version.
   ============================================================ */

var DB = (function () {
  "use strict";

  var SPEICHER_SCHLUESSEL = "portriga_db_v1";

  // Fällt automatisch auf reinen Arbeitsspeicher zurück, wenn localStorage
  // nicht verfügbar ist (z. B. privater Modus mit blockiertem Speicher).
  var speicherVerfuegbar = (function () {
    try {
      var t = "__portriga_test__";
      window.localStorage.setItem(t, "1");
      window.localStorage.removeItem(t);
      return true;
    } catch (e) {
      return false;
    }
  })();

  var speicherFallback = null;
  var daten = null;

  function leereDaten() {
    return { spieler: [], spiele: [], ergebnisse: [] };
  }

  function lade() {
    if (daten) return daten;

    var roh = null;
    try {
      roh = speicherVerfuegbar
        ? window.localStorage.getItem(SPEICHER_SCHLUESSEL)
        : speicherFallback;
    } catch (e) {
      roh = null;
    }

    if (!roh) {
      daten = leereDaten();
      return daten;
    }

    try {
      var geparst = JSON.parse(roh);
      daten = {
        spieler: Array.isArray(geparst.spieler) ? geparst.spieler : [],
        spiele: Array.isArray(geparst.spiele) ? geparst.spiele : [],
        ergebnisse: Array.isArray(geparst.ergebnisse) ? geparst.ergebnisse : []
      };
      // Ältere Datenstände ohne geloescht-Feld nachziehen.
      daten.spieler.forEach(function (s) {
        if (typeof s.geloescht === "undefined") s.geloescht = 0;
      });
    } catch (e) {
      daten = leereDaten();
    }
    return daten;
  }

  function sichere() {
    var roh = JSON.stringify(daten);
    try {
      if (speicherVerfuegbar) {
        window.localStorage.setItem(SPEICHER_SCHLUESSEL, roh);
      } else {
        speicherFallback = roh;
      }
    } catch (e) {
      speicherFallback = roh;
    }
  }

  function neueId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID().replace(/-/g, "");
    }
    var s = "";
    for (var i = 0; i < 32; i++) {
      s += Math.floor(Math.random() * 16).toString(16);
    }
    return s;
  }

  /* ---------------- ZEIT ----------------
     Zeitstempel werden bewusst in lokaler Zeit gespeichert, damit angezeigte
     und bearbeitbare Uhrzeiten der tatsächlichen Wanduhrzeit entsprechen. */

  function zahl(n, stellen) {
    var s = String(n);
    while (s.length < (stellen || 2)) s = "0" + s;
    return s;
  }

  function jetztIso() {
    return datumZuIso(new Date());
  }

  function datumZuIso(d) {
    return (
      d.getFullYear() +
      "-" + zahl(d.getMonth() + 1) +
      "-" + zahl(d.getDate()) +
      "T" + zahl(d.getHours()) +
      ":" + zahl(d.getMinutes()) +
      ":" + zahl(d.getSeconds())
    );
  }

  function isoZuDatum(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(iso || "");
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  }

  function datumAnzeige(iso) {
    var d = isoZuDatum(iso);
    if (!d || isNaN(d.getTime())) return iso || "";
    return (
      zahl(d.getDate()) + "." + zahl(d.getMonth() + 1) + "." + d.getFullYear() +
      ", " + zahl(d.getHours()) + ":" + zahl(d.getMinutes()) + " Uhr"
    );
  }

  /* ---------------- SPIELERVERWALTUNG ---------------- */

  function alleSpieler(nurAktive) {
    if (typeof nurAktive === "undefined") nurAktive = true;
    var d = lade();
    return d.spieler
      .filter(function (s) {
        return nurAktive ? !s.geloescht : true;
      })
      .slice()
      .sort(function (a, b) {
        return a.name.localeCompare(b.name, "de", { sensitivity: "base" });
      })
      .map(function (s) {
        return { id: s.id, name: s.name };
      });
  }

  function spielerNachId(id) {
    var d = lade();
    for (var i = 0; i < d.spieler.length; i++) {
      if (d.spieler[i].id === id) return d.spieler[i];
    }
    return null;
  }

  // Legt einen neuen Spieler an oder gibt die ID zurück, falls der Name
  // bereits existiert. Namen sind eindeutig (Groß-/Kleinschreibung zählt).
  function spielerAnlegen(name) {
    name = (name || "").trim();
    if (!name) return null;

    var d = lade();
    for (var i = 0; i < d.spieler.length; i++) {
      if (d.spieler[i].name === name) return d.spieler[i].id;
    }

    var id = neueId();
    d.spieler.push({
      id: id,
      name: name,
      aktualisiert_am: jetztIso(),
      geloescht: 0
    });
    sichere();
    return id;
  }

  /* "Löscht" einen Spieler: Der Datensatz bleibt erhalten (damit bisherige
     Partien und die Statistiken der anderen Spieler intakt bleiben), wird aber
     als gelöscht markiert und in "Gelöschter Spieler" umbenannt. Dadurch
     erscheint er in allen Partien, in denen er mitgespielt hat, fortan als
     "Gelöschter Spieler", steht für neue Partien nicht mehr zur Auswahl und
     wird in der Statistik-Übersicht nicht mehr als eigener Spieler geführt. */
  function spielerLoeschen(spielerId) {
    var d = lade();
    var spieler = spielerNachId(spielerId);
    if (!spieler) return;

    var basis = "Gelöschter Spieler";
    var name = basis;
    var zaehler = 2;
    while (
      d.spieler.some(function (s) {
        return s.name === name && s.id !== spielerId;
      })
    ) {
      name = basis + " (" + zaehler + ")";
      zaehler++;
    }

    spieler.name = name;
    spieler.geloescht = 1;
    spieler.aktualisiert_am = jetztIso();
    sichere();
  }

  // Gibt {erfolg, fehler} zurück.
  function spielerUmbenennen(spielerId, neuerName) {
    neuerName = (neuerName || "").trim();
    if (!neuerName) return { erfolg: false, fehler: "Name darf nicht leer sein." };

    var d = lade();
    var belegt = d.spieler.some(function (s) {
      return s.name === neuerName && s.id !== spielerId;
    });
    if (belegt) return { erfolg: false, fehler: "Dieser Name wird bereits verwendet." };

    var spieler = spielerNachId(spielerId);
    if (!spieler) return { erfolg: false, fehler: "Spieler nicht gefunden." };

    spieler.name = neuerName;
    spieler.aktualisiert_am = jetztIso();
    sichere();
    return { erfolg: true, fehler: null };
  }

  /* ---------------- SPIELERGEBNISSE ---------------- */

  // Berechnet Platz, Punktdifferenz zu Platz 1 und normierte Platzierung
  // aus einer Liste von {punkte}-Einträgen. Punktgleiche teilen sich den Platz.
  function berechnePlaetze(eintraege) {
    var sortiert = eintraege.slice().sort(function (a, b) {
      return b.punkte - a.punkte;
    });
    var punktePlatz1 = sortiert.length ? sortiert[0].punkte : 0;
    var spieleranzahl = sortiert.length;
    var plaetze = [];

    for (var i = 0; i < sortiert.length; i++) {
      if (i > 0 && sortiert[i].punkte === sortiert[i - 1].punkte) {
        plaetze.push(plaetze[i - 1]);
      } else {
        plaetze.push(i + 1);
      }
    }

    return sortiert.map(function (e, i) {
      var platz = plaetze[i];
      return {
        eintrag: e,
        platz: platz,
        punkte_diff_zu_platz1: punktePlatz1 - e.punkte,
        normierte_platzierung:
          spieleranzahl > 1 ? (platz - 1) / (spieleranzahl - 1) : 0.0
      };
    });
  }

  /* Speichert das Endergebnis einer kompletten Partie.
     ergebnisse: [{spieler_id, punkte}], maxRunden: gespielte Runden */
  function spielSpeichern(ergebnisse, maxRunden) {
    var spieleranzahl = ergebnisse.length;
    if (spieleranzahl === 0) return null;

    var d = lade();
    var jetzt = jetztIso();
    var spielId = neueId();

    d.spiele.push({
      id: spielId,
      datum: jetzt,
      spieleranzahl: spieleranzahl,
      max_runden: maxRunden,
      aktualisiert_am: jetzt
    });

    berechnePlaetze(ergebnisse).forEach(function (r) {
      d.ergebnisse.push({
        id: neueId(),
        spiel_id: spielId,
        spieler_id: r.eintrag.spieler_id,
        punkte: r.eintrag.punkte,
        platz: r.platz,
        spieleranzahl: spieleranzahl,
        punkte_diff_zu_platz1: r.punkte_diff_zu_platz1,
        normierte_platzierung: r.normierte_platzierung,
        max_runden: maxRunden,
        aktualisiert_am: jetzt
      });
    });

    sichere();
    return spielId;
  }

  /* Löscht die zuletzt gespeicherte Partie wieder. Wird gebraucht, wenn nach
     Spielende noch die letzte Runde korrigiert wird, damit kein falscher
     Eintrag in der Statistik stehen bleibt. */
  function letztesSpielLoeschen() {
    var d = lade();
    if (!d.spiele.length) return;

    var neuestes = d.spiele.slice().sort(function (a, b) {
      return a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0;
    })[0];

    spielLoeschen(neuestes.id);
  }

  // Punktbeste Partie über alle aktiven Spieler: {name, punkte} oder null.
  function gesamtHighscore() {
    var d = lade();
    var beste = null;

    d.ergebnisse.forEach(function (e) {
      var s = spielerNachId(e.spieler_id);
      if (!s || s.geloescht) return;
      if (!beste || e.punkte > beste.punkte) {
        beste = { name: s.name, punkte: e.punkte };
      }
    });

    return beste;
  }

  /* Statistik-Zeile je aktivem Spieler. Gelöschte Spieler tauchen hier nicht
     mehr auf, bleiben aber innerhalb der Partien anderer Spieler sichtbar. */
  function statistikAlleSpieler() {
    var d = lade();

    return alleSpieler(true).map(function (s) {
      var eigene = d.ergebnisse.filter(function (e) {
        return e.spieler_id === s.id;
      });

      var anzahl = eigene.length;
      var punkteSumme = 0;
      var normSumme = 0;
      var highscore = null;

      eigene.forEach(function (e) {
        punkteSumme += e.punkte;
        normSumme += e.normierte_platzierung;
        if (highscore === null || e.punkte > highscore) highscore = e.punkte;
      });

      return {
        id: s.id,
        name: s.name,
        anzahl_spiele: anzahl,
        punkte_pro_spiel: anzahl ? punkteSumme / anzahl : null,
        platzierung_norm: anzahl ? normSumme / anzahl : null,
        highscore: highscore
      };
    });
  }

  // Alle Partien eines Spielers, neueste zuerst.
  function spieleEinesSpielers(spielerId) {
    var d = lade();

    var eigene = d.ergebnisse.filter(function (e) {
      return e.spieler_id === spielerId;
    });

    var mitSpiel = eigene
      .map(function (e) {
        var spiel = d.spiele.filter(function (sp) {
          return sp.id === e.spiel_id;
        })[0];
        return spiel ? { ergebnis: e, spiel: spiel } : null;
      })
      .filter(Boolean);

    mitSpiel.sort(function (a, b) {
      return a.spiel.datum < b.spiel.datum ? 1 : a.spiel.datum > b.spiel.datum ? -1 : 0;
    });

    return mitSpiel.map(function (x) {
      var gegner = d.ergebnisse
        .filter(function (e) {
          return e.spiel_id === x.spiel.id && e.spieler_id !== spielerId;
        })
        .sort(function (a, b) {
          return a.platz - b.platz;
        })
        .map(function (e) {
          var s = spielerNachId(e.spieler_id);
          return s ? s.name : "?";
        });

      return {
        datum_anzeige: datumAnzeige(x.spiel.datum),
        platz: x.ergebnis.platz,
        spieleranzahl: x.ergebnis.spieleranzahl,
        punkte: x.ergebnis.punkte,
        punkte_diff_zu_platz1: x.ergebnis.punkte_diff_zu_platz1,
        gegner: gegner
      };
    });
  }

  /* ---------------- PARTIEN BEARBEITEN ---------------- */

  // Alle Partien (neueste zuerst) inkl. Beschriftung für Auswahllisten.
  function alleSpiele() {
    var d = lade();

    return d.spiele
      .slice()
      .sort(function (a, b) {
        return a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0;
      })
      .map(function (sp) {
        var namen = d.ergebnisse
          .filter(function (e) {
            return e.spiel_id === sp.id;
          })
          .sort(function (a, b) {
            return a.platz - b.platz;
          })
          .map(function (e) {
            var s = spielerNachId(e.spieler_id);
            return s ? s.name : "?";
          });

        var anzeige = datumAnzeige(sp.datum);
        return {
          id: sp.id,
          datum: sp.datum,
          datum_anzeige: anzeige,
          max_runden: sp.max_runden,
          beschriftung: namen.length ? anzeige + " – " + namen.join(", ") : anzeige
        };
      });
  }

  // Datum, Rundenzahl und Ergebnisse einer einzelnen Partie, oder null.
  function spielDetails(spielId) {
    var d = lade();
    var spiel = d.spiele.filter(function (sp) {
      return sp.id === spielId;
    })[0];
    if (!spiel) return null;

    var ergebnisse = d.ergebnisse
      .filter(function (e) {
        return e.spiel_id === spielId;
      })
      .sort(function (a, b) {
        return a.platz - b.platz;
      })
      .map(function (e) {
        var s = spielerNachId(e.spieler_id);
        return {
          ergebnis_id: e.id,
          spieler_id: e.spieler_id,
          name: s ? s.name : "?",
          punkte: e.punkte
        };
      });

    return {
      id: spiel.id,
      datum: spiel.datum,
      max_runden: spiel.max_runden,
      ergebnisse: ergebnisse
    };
  }

  /* Löscht eine komplette Partie inkl. aller Ergebnisse. Die Partie
     verschwindet dadurch aus allen Spielerstatistiken, die live aus den
     verbleibenden Daten berechnet werden. */
  function spielLoeschen(spielId) {
    var d = lade();
    d.spiele = d.spiele.filter(function (sp) {
      return sp.id !== spielId;
    });
    d.ergebnisse = d.ergebnisse.filter(function (e) {
      return e.spiel_id !== spielId;
    });
    sichere();
  }

  /* Bearbeitet eine bestehende Partie: Datum/Uhrzeit und Endpunktzahlen.
     Platz, Punktdifferenz zu Platz 1 und normierte Platzierung werden aus den
     neuen Punktzahlen neu berechnet, damit Statistiken korrekt bleiben.
     punkteNachErgebnisId: { ergebnis_id: neue_punkte } */
  function spielBearbeiten(spielId, neuesDatum, punkteNachErgebnisId) {
    var d = lade();
    var spiel = d.spiele.filter(function (sp) {
      return sp.id === spielId;
    })[0];
    if (!spiel) return;

    var jetzt = jetztIso();
    spiel.datum = neuesDatum;
    spiel.aktualisiert_am = jetzt;

    var eigene = d.ergebnisse.filter(function (e) {
      return e.spiel_id === spielId;
    });
    if (!eigene.length) {
      sichere();
      return;
    }

    eigene.forEach(function (e) {
      if (Object.prototype.hasOwnProperty.call(punkteNachErgebnisId, e.id)) {
        e.punkte = punkteNachErgebnisId[e.id];
      }
    });

    berechnePlaetze(eigene).forEach(function (r) {
      var e = r.eintrag;
      e.platz = r.platz;
      e.punkte_diff_zu_platz1 = r.punkte_diff_zu_platz1;
      e.normierte_platzierung = r.normierte_platzierung;
      e.aktualisiert_am = jetzt;
    });

    sichere();
  }

  /* ---------------- DATENSICHERUNG ---------------- */

  function exportieren() {
    return JSON.stringify(lade(), null, 2);
  }

  function importieren(roh) {
    var geparst = JSON.parse(roh);
    if (
      !geparst ||
      !Array.isArray(geparst.spieler) ||
      !Array.isArray(geparst.spiele) ||
      !Array.isArray(geparst.ergebnisse)
    ) {
      throw new Error("Datei enthält keine Portriga-Sicherung.");
    }
    daten = {
      spieler: geparst.spieler,
      spiele: geparst.spiele,
      ergebnisse: geparst.ergebnisse
    };
    daten.spieler.forEach(function (s) {
      if (typeof s.geloescht === "undefined") s.geloescht = 0;
    });
    sichere();
  }

  return {
    speicherVerfuegbar: speicherVerfuegbar,
    jetztIso: jetztIso,
    datumZuIso: datumZuIso,
    isoZuDatum: isoZuDatum,
    datumAnzeige: datumAnzeige,

    alleSpieler: alleSpieler,
    spielerAnlegen: spielerAnlegen,
    spielerLoeschen: spielerLoeschen,
    spielerUmbenennen: spielerUmbenennen,

    spielSpeichern: spielSpeichern,
    letztesSpielLoeschen: letztesSpielLoeschen,
    gesamtHighscore: gesamtHighscore,
    statistikAlleSpieler: statistikAlleSpieler,
    spieleEinesSpielers: spieleEinesSpielers,

    alleSpiele: alleSpiele,
    spielDetails: spielDetails,
    spielLoeschen: spielLoeschen,
    spielBearbeiten: spielBearbeiten,

    exportieren: exportieren,
    importieren: importieren
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = DB;
}