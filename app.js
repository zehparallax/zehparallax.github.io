/* ============================================================
   Portriga – Ablauf und Anzeige
   Portierung von main.py (Flet) auf HTML/JS.
   ============================================================ */

(function () {
  "use strict";

  var MAX_RUNDEN = 15;
  var KARTEN = [1, 2, 3, 4, 5, 6, 7, 7, 7, 6, 5, 4, 3, 2, 1];

  var CHART_FARBEN = [
    "#4A90D9", "#C0392B", "#3F8F4F", "#D98324", "#7D5BA6",
    "#2AA3A3", "#C2588F", "#1F3D7A", "#1E5B2E", "#241A12"
  ];

  /* ---------------- Zustand ---------------- */

  var spielerDaten = [];   // [{spieler_id, name, ansageEl, sticheEl}]
  var historie = [];       // [[{punkte, ansage, stiche}, ...], ...]
  var statsZurueck = "ansicht-setup";
  var sicherheitAktion = null;
  var sicherheitZurueck = "ansicht-bearbeiten";
  var spielPunkteFelder = {}; // {ergebnis_id: inputElement}

  /* ---------------- Kleine Helfer ---------------- */

  function $(id) { return document.getElementById(id); }

  function leere(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  function machen(tag, klasse, text) {
    var el = document.createElement(tag);
    if (klasse) el.className = klasse;
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
  }

  function zahl(n, stellen) {
    var s = String(n);
    while (s.length < (stellen || 2)) s = "0" + s;
    return s;
  }

  // Besucherzählung: läuft nur, wenn GoatCounter geladen wurde.
  function zaehle(pfad, titel, istEreignis) {
    try {
      if (window.goatcounter && typeof window.goatcounter.count === "function") {
        window.goatcounter.count({
          path: pfad,
          title: titel || pfad,
          event: !!istEreignis
        });
      }
    } catch (e) { /* Zählung darf die App nie stören */ }
  }

  /* ---------------- Spiellogik ---------------- */

  // Ansage getroffen: 10 + Stiche*3. Sonst: Abweichung * -3.
  function berechnePunkte(ansage, gemacht) {
    var a = parseInt(ansage, 10) || 0;
    var g = parseInt(gemacht, 10) || 0;
    if (a === g) return 10 + g * 3;
    return Math.abs(a - g) * -3;
  }

  function gesamtpunkte(index) {
    var summe = 0;
    for (var i = 0; i < historie.length; i++) summe += historie[i][index].punkte;
    return summe;
  }

  function rangliste() {
    return spielerDaten
      .map(function (s, i) { return { name: s.name, punkte: gesamtpunkte(i) }; })
      .sort(function (a, b) { return b.punkte - a.punkte; });
  }

  /* ---------------- Navigation ---------------- */

  var ANSICHT_PFADE = {
    "ansicht-setup": ["/", "Setup"],
    "ansicht-spiel": ["/spiel", "Laufende Partie"],
    "ansicht-ende": ["/spiel-ende", "Partie beendet"],
    "ansicht-statistik": ["/statistik", "Spielerstatistik"],
    "ansicht-bearbeiten": ["/bearbeiten", "Bearbeiten"],
    "ansicht-spieler-loeschen": ["/bearbeiten/spieler-loeschen", "Spieler löschen"],
    "ansicht-spieler-bearbeiten": ["/bearbeiten/spieler-bearbeiten", "Spieler bearbeiten"],
    "ansicht-spiel-loeschen": ["/bearbeiten/spiel-loeschen", "Spiel löschen"],
    "ansicht-spiel-bearbeiten": ["/bearbeiten/spiel-bearbeiten", "Spiel bearbeiten"],
    "ansicht-sicherheit": ["/bearbeiten/sicherheitsabfrage", "Sicherheitsabfrage"]
  };

  var ersteAnsicht = true;

  function zeigeAnsicht(id) {
    var alle = document.querySelectorAll(".ansicht");
    for (var i = 0; i < alle.length; i++) alle[i].hidden = true;
    $(id).hidden = false;
    window.scrollTo(0, 0);

    // Die erste Ansicht zählt GoatCounter bereits selbst.
    if (!ersteAnsicht && ANSICHT_PFADE[id]) {
      zaehle(ANSICHT_PFADE[id][0], ANSICHT_PFADE[id][1], false);
    }
    ersteAnsicht = false;
  }

  /* ---------------- Setup: Spielerauswahl ---------------- */

  function spielerSelects() {
    return Array.prototype.slice.call(
      document.querySelectorAll("#spieler-auswahl select")
    );
  }

  /* Baut die Optionen aller Auswahlfelder so auf, dass ein bereits anderswo
     gewählter Spieler dort nicht mehr angeboten wird – jeder Spieler kann
     also nur einmal an einer Partie teilnehmen. */
  function aktualisiereSpielerOptionen() {
    var selects = spielerSelects();
    var gewaehlt = selects.map(function (s) { return s.value; }).filter(Boolean);
    var spieler = DB.alleSpieler();

    selects.forEach(function (sel) {
      var eigene = sel.value;
      var vorher = sel.value;
      leere(sel);

      var platzhalter = machen("option", null, "– bitte wählen –");
      platzhalter.value = "";
      sel.appendChild(platzhalter);

      spieler.forEach(function (sp) {
        var anderswoBelegt = gewaehlt.indexOf(sp.id) !== -1 && sp.id !== eigene;
        if (anderswoBelegt) return;
        var opt = machen("option", null, sp.name);
        opt.value = sp.id;
        sel.appendChild(opt);
      });

      sel.value = vorher;
      if (sel.value !== vorher) sel.value = "";
    });
  }

  function erstelleSpielerFelder() {
    var behaelter = $("spieler-auswahl");
    var anzahl = parseInt($("anzahl-spieler").value, 10);
    leere(behaelter);

    if (!anzahl || anzahl < 1) {
      $("btn-spiel-starten").hidden = true;
      return;
    }
    anzahl = Math.min(anzahl, 10);

    for (var i = 0; i < anzahl; i++) {
      var gruppe = machen("div", "feldgruppe");
      var label = machen("label", "label", "Spieler " + (i + 1));
      label.setAttribute("for", "spieler-wahl-" + i);

      var sel = machen("select", "eingabe");
      sel.id = "spieler-wahl-" + i;
      sel.addEventListener("change", function () {
        aktualisiereSpielerOptionen();
        $("fehler-setup").textContent = "";
      });

      gruppe.appendChild(label);
      gruppe.appendChild(sel);
      behaelter.appendChild(gruppe);
    }

    aktualisiereSpielerOptionen();
    $("btn-spiel-starten").hidden = false;
  }

  function neuenSpielerAnlegen() {
    var feld = $("neuer-spieler");
    var name = (feld.value || "").trim();
    var hinweis = $("hinweis-neuer-spieler");

    if (!name) {
      hinweis.textContent = "Bitte einen Namen eingeben.";
      return;
    }

    var vorhanden = DB.alleSpieler(false).some(function (s) { return s.name === name; });
    DB.spielerAnlegen(name);
    feld.value = "";
    hinweis.textContent = vorhanden
      ? "„" + name + "“ gibt es schon."
      : "„" + name + "“ angelegt.";

    aktualisiereSpielerOptionen();
    feld.focus();
  }

  /* ---------------- Partie starten ---------------- */

  function spielStarten() {
    var fehler = $("fehler-setup");
    fehler.textContent = "";

    var selects = spielerSelects();
    var gewaehlt = selects.map(function (s) { return s.value; });

    if (!gewaehlt.length || gewaehlt.some(function (v) { return !v; })) {
      fehler.textContent = "Bitte für jeden Spieler einen Namen auswählen.";
      return;
    }

    var einmalig = {};
    for (var i = 0; i < gewaehlt.length; i++) {
      if (einmalig[gewaehlt[i]]) {
        fehler.textContent = "Jeder Spieler darf nur einmal ausgewählt werden.";
        return;
      }
      einmalig[gewaehlt[i]] = true;
    }

    var namen = {};
    DB.alleSpieler().forEach(function (s) { namen[s.id] = s.name; });

    spielerDaten = gewaehlt.map(function (id) {
      return { spieler_id: id, name: namen[id] || "?", ansageEl: null, sticheEl: null };
    });
    historie = [];

    baueRundenEingaben();
    zeichneRunde();
    zeigeAnsicht("ansicht-spiel");
    zaehle("/ereignis/spiel-gestartet", "Spiel gestartet", true);
  }

  /* ---------------- Laufende Partie ---------------- */

  function baueRundenEingaben() {
    var behaelter = $("runden-eingaben");
    leere(behaelter);

    spielerDaten.forEach(function (s, i) {
      var karte = machen("div", "spielerkarte");

      var kopf = machen("div", "spielerkarte__kopf");
      kopf.appendChild(machen("span", "spielerkarte__name", s.name));
      karte.appendChild(kopf);

      var paar = machen("div", "paar");

      var ansageFeld = machen("div", "punktefeld");
      var ansageLabel = machen("label", "label", "Ansage");
      ansageLabel.setAttribute("for", "ansage-" + i);
      var ansage = machen("input", "eingabe");
      ansage.type = "number";
      ansage.id = "ansage-" + i;
      ansage.min = "0";
      ansage.inputMode = "numeric";
      ansage.addEventListener("input", pruefeEingaben);
      ansageFeld.appendChild(ansageLabel);
      ansageFeld.appendChild(ansage);

      var sticheFeld = machen("div", "punktefeld");
      var sticheLabel = machen("label", "label", "Stiche");
      sticheLabel.setAttribute("for", "stiche-" + i);
      var stiche = machen("input", "eingabe");
      stiche.type = "number";
      stiche.id = "stiche-" + i;
      stiche.min = "0";
      stiche.inputMode = "numeric";
      stiche.addEventListener("input", pruefeEingaben);
      sticheFeld.appendChild(sticheLabel);
      sticheFeld.appendChild(stiche);

      paar.appendChild(ansageFeld);
      paar.appendChild(sticheFeld);
      karte.appendChild(paar);
      behaelter.appendChild(karte);

      s.ansageEl = ansage;
      s.sticheEl = stiche;
    });
  }

  function zeichneRundenleiste() {
    var leiste = $("rundenleiste");
    leere(leiste);

    for (var r = 0; r < MAX_RUNDEN; r++) {
      var saeule = machen("div", "runde");
      saeule.style.height = Math.round((KARTEN[r] / 7) * 100) + "%";
      if (r < historie.length) saeule.className = "runde runde--gespielt";
      else if (r === historie.length) {
        saeule.className = "runde runde--aktuell";
        saeule.appendChild(machen("span", "runde__zahl", KARTEN[r]));
      }
      leiste.appendChild(saeule);
    }
  }

  function zeichneZwischenstand() {
    var behaelter = $("zwischenstand");
    leere(behaelter);
    if (!historie.length) return;

    behaelter.appendChild(machen("h3", "unterschrift", "Zwischenstand"));
    rangliste().forEach(function (e) {
      var zeile = machen("div", "standzeile");
      zeile.appendChild(machen("span", null, e.name));
      zeile.appendChild(machen("span", "standzeile__punkte", e.punkte));
      behaelter.appendChild(zeile);
    });
  }

  function zeichneRunde() {
    var r = historie.length;
    var karten = KARTEN[r];

    $("rundenstand").innerHTML = "";
    $("rundenstand").appendChild(
      document.createTextNode("Runde " + (r + 1) + " / " + MAX_RUNDEN + " ")
    );
    $("rundenstand").appendChild(
      machen("em", null, karten + (karten === 1 ? " Karte" : " Karten"))
    );

    spielerDaten.forEach(function (s) {
      s.ansageEl.value = "";
      s.sticheEl.value = "";
      s.ansageEl.max = String(karten);
      s.sticheEl.max = String(karten);
    });

    $("hinweis-stiche").textContent = "";
    $("btn-runde-abschliessen").disabled = true;
    $("btn-korrigieren-spiel").disabled = historie.length === 0;

    zeichneRundenleiste();
    zeichneZwischenstand();
  }

  function pruefeEingaben() {
    var alleGefuellt = spielerDaten.every(function (s) {
      return s.ansageEl.value !== "" && s.sticheEl.value !== "";
    });

    var gueltig = false;
    var hinweis = "";

    if (alleGefuellt && historie.length < KARTEN.length) {
      var summe = 0;
      var zahlenOk = true;

      spielerDaten.forEach(function (s) {
        var v = parseInt(s.sticheEl.value, 10);
        if (isNaN(v)) zahlenOk = false;
        else summe += v;
      });

      if (!zahlenOk) {
        hinweis = "Bitte gültige Zahlen eingeben.";
      } else {
        var noetig = KARTEN[historie.length];
        gueltig = summe === noetig;
        if (!gueltig) {
          hinweis = "Summe der Stiche muss " + noetig + " sein (aktuell " + summe + ").";
        }
      }
    }

    $("hinweis-stiche").textContent = hinweis;
    $("btn-runde-abschliessen").disabled = !(alleGefuellt && gueltig);
  }

  function rundeAbschliessen() {
    var rundenIndex = historie.length;
    var rundenDaten = spielerDaten.map(function (s) {
      var ansage = parseInt(s.ansageEl.value, 10) || 0;
      var stiche = parseInt(s.sticheEl.value, 10) || 0;
      var p = berechnePunkte(ansage, stiche);
      // In der ersten Runde gibt es keine Minuspunkte.
      if (rundenIndex === 0 && p < 0) p = 0;
      return { punkte: p, ansage: ansage, stiche: stiche };
    });

    historie.push(rundenDaten);

    if (historie.length === MAX_RUNDEN) {
      beendeSpiel();
      return;
    }

    zeichneRunde();
  }

  function beendeSpiel() {
    var ergebnisse = spielerDaten.map(function (s, i) {
      return { spieler_id: s.spieler_id, punkte: gesamtpunkte(i) };
    });
    DB.spielSpeichern(ergebnisse, MAX_RUNDEN);

    zeichneEndstand();
    zeichneVerlauf();
    zeichneHistorie();
    zeichnePartieStatistik();

    zeigeAnsicht("ansicht-ende");
    zaehle("/ereignis/spiel-beendet", "Spiel beendet", true);
  }

  /* Nimmt die letzte Runde zurück. Stand die Partie schon auf "beendet",
     wird der gespeicherte Eintrag wieder entfernt, damit keine falsche
     Partie in der Statistik hängen bleibt. */
  function letzteRundeKorrigieren() {
    if (!historie.length) return;

    var warSpielende = historie.length === MAX_RUNDEN;
    historie.pop();
    if (warSpielende) DB.letztesSpielLoeschen();

    zeichneRunde();
    zeigeAnsicht("ansicht-spiel");
  }

  function neustart() {
    spielerDaten = [];
    historie = [];
    $("anzahl-spieler").value = "";
    $("fehler-setup").textContent = "";
    $("hinweis-neuer-spieler").textContent = "";
    leere($("spieler-auswahl"));
    $("btn-spiel-starten").hidden = true;
    zeigeAnsicht("ansicht-setup");
  }

  /* ---------------- Endansicht ---------------- */

  function zeichneEndstand() {
    var behaelter = $("endstand");
    leere(behaelter);

    var stand = rangliste();
    var platz = 1;

    stand.forEach(function (e, i) {
      if (i > 0 && e.punkte !== stand[i - 1].punkte) platz = i + 1;
      var sieger = platz === 1;

      var zeile = machen("div", "endzeile" + (sieger ? " endzeile--sieger" : ""));
      zeile.appendChild(machen("span", "endzeile__platz", platz + "."));
      zeile.appendChild(machen("span", "endzeile__name", e.name));
      zeile.appendChild(machen("span", "endzeile__punkte", e.punkte + " Pkt"));
      behaelter.appendChild(zeile);
    });
  }

  function zeichneVerlauf() {
    var behaelter = $("verlauf-chart");
    leere(behaelter);

    var serien = spielerDaten.map(function (s, i) {
      var werte = [];
      var summe = 0;
      historie.forEach(function (r) {
        summe += r[i].punkte;
        werte.push(summe);
      });
      return { name: s.name, werte: werte, farbe: CHART_FARBEN[i % CHART_FARBEN.length] };
    });

    behaelter.appendChild(baueChart(serien));

    var legende = $("chart-legende");
    leere(legende);
    serien.forEach(function (serie) {
      var punkt = machen("span", "legende__punkt");
      var farbe = machen("span", "legende__farbe");
      farbe.style.backgroundColor = serie.farbe;
      punkt.appendChild(farbe);
      punkt.appendChild(machen("span", null, serie.name));
      legende.appendChild(punkt);
    });
  }

  function baueChart(serien) {
    var B = 700, H = 320;
    var links = 44, rechts = 12, oben = 14, unten = 30;
    var flaecheB = B - links - rechts;
    var flaecheH = H - oben - unten;

    var alleWerte = [0];
    serien.forEach(function (s) { alleWerte = alleWerte.concat(s.werte); });
    var min = Math.min.apply(null, alleWerte);
    var max = Math.max.apply(null, alleWerte);
    if (max === min) max = min + 10;

    var spanne = max - min;
    var schritt = Math.max(10, Math.ceil(spanne / 5 / 10) * 10);
    var yUnten = Math.floor(min / schritt) * schritt;
    var yOben = Math.ceil(max / schritt) * schritt;
    if (yOben === yUnten) yOben = yUnten + schritt;

    function xPos(runde) {
      return links + ((runde - 1) / (MAX_RUNDEN - 1)) * flaecheB;
    }
    function yPos(wert) {
      return oben + flaecheH - ((wert - yUnten) / (yOben - yUnten)) * flaecheH;
    }

    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + B + " " + H);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Punkteverlauf über alle Runden");

    function linie(x1, y1, x2, y2, farbe, breite, gestrichelt) {
      var l = document.createElementNS(NS, "line");
      l.setAttribute("x1", x1); l.setAttribute("y1", y1);
      l.setAttribute("x2", x2); l.setAttribute("y2", y2);
      l.setAttribute("stroke", farbe);
      l.setAttribute("stroke-width", breite || 1);
      if (gestrichelt) l.setAttribute("stroke-dasharray", "3 4");
      return l;
    }

    function text(x, y, inhalt, anker, groesse, farbe) {
      var t = document.createElementNS(NS, "text");
      t.setAttribute("x", x); t.setAttribute("y", y);
      t.setAttribute("text-anchor", anker || "middle");
      t.setAttribute("font-size", groesse || 11);
      t.setAttribute("fill", farbe || "#745E45");
      t.setAttribute("font-family", "IBM Plex Mono, monospace");
      t.textContent = inhalt;
      return t;
    }

    // waagerechte Hilfslinien + Y-Beschriftung
    for (var w = yUnten; w <= yOben; w += schritt) {
      var y = yPos(w);
      svg.appendChild(linie(links, y, B - rechts, y, "#D6C09A", w === 0 ? 1.5 : 1, w !== 0));
      svg.appendChild(text(links - 7, y + 3.5, String(w), "end"));
    }

    // X-Beschriftung an den Runden 3, 6, 9, 12, 15
    [3, 6, 9, 12, 15].forEach(function (r) {
      svg.appendChild(text(xPos(r), H - 9, String(r)));
    });

    // Punktelinien je Spieler
    serien.forEach(function (serie) {
      if (!serie.werte.length) return;

      var punkte = serie.werte.map(function (wert, i) {
        return xPos(i + 1) + "," + yPos(wert);
      }).join(" ");

      var pfad = document.createElementNS(NS, "polyline");
      pfad.setAttribute("points", punkte);
      pfad.setAttribute("fill", "none");
      pfad.setAttribute("stroke", serie.farbe);
      pfad.setAttribute("stroke-width", "2.5");
      pfad.setAttribute("stroke-linejoin", "round");
      pfad.setAttribute("stroke-linecap", "round");
      svg.appendChild(pfad);

      var letzterX = xPos(serie.werte.length);
      var letzterY = yPos(serie.werte[serie.werte.length - 1]);
      var kreis = document.createElementNS(NS, "circle");
      kreis.setAttribute("cx", letzterX);
      kreis.setAttribute("cy", letzterY);
      kreis.setAttribute("r", "3.5");
      kreis.setAttribute("fill", serie.farbe);
      svg.appendChild(kreis);
    });

    return svg;
  }

  function zeichneHistorie() {
    var behaelter = $("historie-tabelle");
    leere(behaelter);

    // höchste und niedrigste Rundenpunktzahl der ganzen Partie finden
    var maxP = null, minP = null;
    historie.forEach(function (runde) {
      runde.forEach(function (e) {
        if (maxP === null || e.punkte > maxP) maxP = e.punkte;
        if (minP === null || e.punkte < minP) minP = e.punkte;
      });
    });

    var tabelle = machen("table", "raster");
    var kopf = machen("thead");
    var kopfZeile = machen("tr");
    kopfZeile.appendChild(machen("th", null, "R"));

    spielerDaten.forEach(function (s) {
      var th = machen("th", null, s.name);
      th.appendChild(machen("span", "spaltenkopf__unter", "A / S / P"));
      kopfZeile.appendChild(th);
    });
    kopf.appendChild(kopfZeile);
    tabelle.appendChild(kopf);

    var koerper = machen("tbody");
    historie.forEach(function (runde, r) {
      var zeile = machen("tr");
      zeile.appendChild(machen("td", "zahl", r + 1));

      runde.forEach(function (e) {
        var klasse = "zahl";
        if (e.punkte === maxP) klasse += " zelle--hoch";
        else if (e.punkte === minP) klasse += " zelle--tief";
        zeile.appendChild(
          machen("td", klasse, e.ansage + " / " + e.stiche + " / " + e.punkte)
        );
      });
      koerper.appendChild(zeile);
    });

    var summe = machen("tr", "summenzeile");
    summe.appendChild(machen("td", "zahl", "Σ"));
    spielerDaten.forEach(function (s, i) {
      summe.appendChild(machen("td", "zahl", gesamtpunkte(i)));
    });
    koerper.appendChild(summe);

    tabelle.appendChild(koerper);
    behaelter.appendChild(tabelle);
  }

  function zeichnePartieStatistik() {
    var behaelter = $("partie-statistik");
    leere(behaelter);

    var runden = historie.length;
    spielerDaten.forEach(function (s, i) {
      var richtig = 0, nullAnsagen = 0;
      historie.forEach(function (r) {
        if (r[i].ansage === r[i].stiche) richtig++;
        if (r[i].ansage === 0) nullAnsagen++;
      });
      var prozent = runden ? (richtig / runden) * 100 : 0;

      behaelter.appendChild(
        machen("p", null,
          s.name + ": " + prozent.toFixed(0) + "% richtig angesagt, " +
          nullAnsagen + "× Null angesagt")
      );
      behaelter.lastChild.style.margin = "0";
    });
  }

  /* ---------------- Spielerstatistik ---------------- */

  function zeigeStatistik(zurueck) {
    statsZurueck = zurueck;
    baueStatistik();
    zeigeAnsicht("ansicht-statistik");
  }

  function baueStatistik() {
    var behaelter = $("statistik-inhalt");
    leere(behaelter);

    var rekord = DB.gesamtHighscore();
    if (rekord) {
      var block = machen("div", "rekord");
      block.appendChild(machen("p", "rekord__label", "Highscore"));
      block.appendChild(
        machen("p", "rekord__wert", rekord.name + " mit " + rekord.punkte + " Punkten")
      );
      behaelter.appendChild(block);
    }

    var zeilen = DB.statistikAlleSpieler();
    if (!zeilen.length) {
      behaelter.appendChild(machen("p", "leer", "Noch keine Spieler angelegt."));
      return;
    }

    var rahmen = machen("div", "tabellenrahmen");
    var tabelle = machen("table", "raster");

    var kopf = machen("thead");
    var kopfZeile = machen("tr");
    ["", "Spieler", "Spiele", "Ø Pkt/Spiel", "Ø Platz", "Highscore"].forEach(function (t) {
      kopfZeile.appendChild(machen("th", null, t));
    });
    kopf.appendChild(kopfZeile);
    tabelle.appendChild(kopf);

    var koerper = machen("tbody");

    zeilen.forEach(function (zeile) {
      var tr = machen("tr", "spielerzeile-tr");
      tr.tabIndex = 0;
      tr.setAttribute("role", "button");
      tr.setAttribute("aria-expanded", "false");
      tr.style.cursor = "pointer";

      var pfeil = machen("td", null, "▸");
      pfeil.style.color = "#745E45";
      tr.appendChild(pfeil);
      tr.appendChild(machen("td", null, zeile.name));
      tr.appendChild(machen("td", "zahl", zeile.anzahl_spiele));
      tr.appendChild(machen("td", "zahl",
        zeile.punkte_pro_spiel === null ? "–" : zeile.punkte_pro_spiel.toFixed(1)));
      tr.appendChild(machen("td", "zahl",
        zeile.platzierung_norm === null ? "–" : zeile.platzierung_norm.toFixed(2)));
      tr.appendChild(machen("td", "zahl",
        zeile.highscore === null ? "–" : zeile.highscore));

      var detailZeile = machen("tr");
      detailZeile.hidden = true;
      var detailZelle = machen("td");
      detailZelle.colSpan = 6;
      detailZelle.style.whiteSpace = "normal";
      detailZeile.appendChild(detailZelle);

      var geladen = false;

      function umschalten() {
        if (!geladen) {
          detailZelle.appendChild(bauePartienListe(zeile.id));
          geladen = true;
        }
        var offen = detailZeile.hidden;
        detailZeile.hidden = !offen;
        pfeil.textContent = offen ? "▾" : "▸";
        tr.setAttribute("aria-expanded", offen ? "true" : "false");
      }

      tr.addEventListener("click", umschalten);
      tr.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          umschalten();
        }
      });

      koerper.appendChild(tr);
      koerper.appendChild(detailZeile);
    });

    tabelle.appendChild(koerper);
    rahmen.appendChild(tabelle);
    behaelter.appendChild(rahmen);

    behaelter.appendChild(
      machen("p", "legendetext",
        "Ø Platz ist genormt: 0 = im Schnitt immer Platz 1, 1 = im Schnitt immer " +
        "letzter Platz. So bleiben Partien mit unterschiedlicher Spieleranzahl " +
        "vergleichbar. Tippe auf einen Spieler, um alle seine Partien im Detail zu sehen.")
    );
  }

  function bauePartienListe(spielerId) {
    var behaelter = machen("div", "spielerdetail");
    var partien = DB.spieleEinesSpielers(spielerId);

    if (!partien.length) {
      behaelter.appendChild(machen("p", "leer", "Noch keine Partien gespielt."));
      return behaelter;
    }

    partien.forEach(function (p) {
      var sieg = p.punkte_diff_zu_platz1 === 0;
      var karte = machen("div", "partie" + (sieg ? " partie--sieg" : ""));

      var kopf = machen("div", "partie__kopf");
      kopf.appendChild(machen("span", null, "Platz " + p.platz + " / " + p.spieleranzahl));
      kopf.appendChild(machen("span", null, p.punkte + " Punkte"));
      karte.appendChild(kopf);

      karte.appendChild(machen("p", "partie__text",
        sieg ? "Sieger dieser Partie"
             : p.punkte_diff_zu_platz1 + " Punkte Rückstand auf Platz 1"));

      karte.appendChild(machen("p", "partie__text",
        "Gegner: " + (p.gegner.length ? p.gegner.join(", ") : "–")));

      karte.appendChild(machen("p", "partie__datum", p.datum_anzeige));
      behaelter.appendChild(karte);
    });

    return behaelter;
  }

  /* ---------------- Sicherheitsabfrage ---------------- */

  function frageNach(nachricht, aktion, zurueckAnsicht) {
    $("sicherheit-text").textContent = nachricht;
    sicherheitAktion = aktion;
    sicherheitZurueck = zurueckAnsicht;
    zeigeAnsicht("ansicht-sicherheit");
  }

  /* Führt die bestätigte Aktion aus. Gibt die Aktion eine Ansicht-ID zurück,
     wird dorthin gewechselt – so bleibt z. B. eine Fehlermeldung sichtbar,
     statt dass der Nutzer wortlos im Menü landet. */
  function sicherheitJa() {
    var aktion = sicherheitAktion;
    sicherheitAktion = null;
    var ziel = aktion ? aktion() : null;
    zeigeAnsicht(ziel || "ansicht-bearbeiten");
  }

  function sicherheitNein() {
    sicherheitAktion = null;
    zeigeAnsicht(sicherheitZurueck || "ansicht-bearbeiten");
  }

  /* ---------------- Bearbeiten: Auswahllisten ---------------- */

  function fuelleSpielerAuswahl(sel) {
    leere(sel);
    var platzhalter = machen("option", null, "– bitte wählen –");
    platzhalter.value = "";
    sel.appendChild(platzhalter);

    DB.alleSpieler().forEach(function (s) {
      var opt = machen("option", null, s.name);
      opt.value = s.id;
      sel.appendChild(opt);
    });
  }

  function fuelleSpielAuswahl(sel) {
    leere(sel);
    var platzhalter = machen("option", null, "– bitte wählen –");
    platzhalter.value = "";
    sel.appendChild(platzhalter);

    DB.alleSpiele().forEach(function (sp) {
      var opt = machen("option", null, sp.beschriftung);
      opt.value = sp.id;
      sel.appendChild(opt);
    });
  }

  function nameVon(spielerId) {
    var treffer = DB.alleSpieler().filter(function (s) { return s.id === spielerId; })[0];
    return treffer ? treffer.name : "?";
  }

  function beschriftungVon(sel) {
    var opt = sel.options[sel.selectedIndex];
    return opt ? opt.textContent : "";
  }

  /* ---------------- Spieler löschen ---------------- */

  function oeffneSpielerLoeschen() {
    fuelleSpielerAuswahl($("wahl-spieler-loeschen"));
    $("fehler-spieler-loeschen").textContent = "";
    zeigeAnsicht("ansicht-spieler-loeschen");
  }

  function spielerLoeschenAnfragen() {
    var sel = $("wahl-spieler-loeschen");
    var id = sel.value;
    if (!id) {
      $("fehler-spieler-loeschen").textContent = "Bitte einen Spieler auswählen.";
      return;
    }
    var name = nameVon(id);

    frageNach(
      "Soll der Spieler „" + name + "“ wirklich gelöscht werden? Er wird in " +
      "bisherigen Partien fortan als „Gelöschter Spieler“ angezeigt, erscheint " +
      "nicht mehr in der Statistik-Übersicht und steht für neue Partien nicht " +
      "mehr zur Auswahl.",
      function () {
        DB.spielerLoeschen(id);
        aktualisiereSpielerOptionen();
      },
      "ansicht-spieler-loeschen"
    );
  }

  /* ---------------- Spieler bearbeiten ---------------- */

  function oeffneSpielerBearbeiten() {
    fuelleSpielerAuswahl($("wahl-spieler-bearbeiten"));
    $("neuer-name").value = "";
    $("fehler-spieler-bearbeiten").textContent = "";
    zeigeAnsicht("ansicht-spieler-bearbeiten");
  }

  function spielerBearbeitenAnfragen() {
    var id = $("wahl-spieler-bearbeiten").value;
    var neuerName = ($("neuer-name").value || "").trim();
    var fehler = $("fehler-spieler-bearbeiten");

    if (!id) { fehler.textContent = "Bitte einen Spieler auswählen."; return; }
    if (!neuerName) { fehler.textContent = "Bitte einen Namen eingeben."; return; }

    var alterName = nameVon(id);

    frageNach(
      "Soll „" + alterName + "“ wirklich in „" + neuerName + "“ umbenannt werden?",
      function () {
        var ergebnis = DB.spielerUmbenennen(id, neuerName);
        if (!ergebnis.erfolg) {
          fehler.textContent = ergebnis.fehler || "Fehler beim Speichern.";
          return "ansicht-spieler-bearbeiten";
        }
        aktualisiereSpielerOptionen();
        return null;
      },
      "ansicht-spieler-bearbeiten"
    );
  }

  /* ---------------- Spiel löschen ---------------- */

  function oeffneSpielLoeschen() {
    fuelleSpielAuswahl($("wahl-spiel-loeschen"));
    $("fehler-spiel-loeschen").textContent = "";
    zeigeAnsicht("ansicht-spiel-loeschen");
  }

  function spielLoeschenAnfragen() {
    var sel = $("wahl-spiel-loeschen");
    var id = sel.value;
    if (!id) {
      $("fehler-spiel-loeschen").textContent = "Bitte eine Partie auswählen.";
      return;
    }
    var beschriftung = beschriftungVon(sel);

    frageNach(
      "Soll die Partie „" + beschriftung + "“ wirklich gelöscht werden? " +
      "Sie verschwindet dadurch aus allen Spielerstatistiken.",
      function () { DB.spielLoeschen(id); },
      "ansicht-spiel-loeschen"
    );
  }

  /* ---------------- Spiel bearbeiten ---------------- */

  function oeffneSpielBearbeiten() {
    fuelleSpielAuswahl($("wahl-spiel-bearbeiten"));
    $("spiel-bearbeiten-felder").hidden = true;
    leere($("spiel-punkte-felder"));
    spielPunkteFelder = {};
    $("spiel-datum").value = "";
    $("spiel-zeit").value = "";
    $("fehler-spiel-bearbeiten").textContent = "";
    zeigeAnsicht("ansicht-spiel-bearbeiten");
  }

  // Lädt Datum, Uhrzeit und Endpunkte der gewählten Partie in die Felder.
  function spielAuswahlGeaendert() {
    var id = $("wahl-spiel-bearbeiten").value;
    var felder = $("spiel-punkte-felder");
    leere(felder);
    spielPunkteFelder = {};
    $("fehler-spiel-bearbeiten").textContent = "";

    if (!id) {
      $("spiel-bearbeiten-felder").hidden = true;
      return;
    }

    var details = DB.spielDetails(id);
    if (!details) {
      $("spiel-bearbeiten-felder").hidden = true;
      return;
    }

    var d = DB.isoZuDatum(details.datum);
    if (d) {
      $("spiel-datum").value =
        d.getFullYear() + "-" + zahl(d.getMonth() + 1) + "-" + zahl(d.getDate());
      $("spiel-zeit").value = zahl(d.getHours()) + ":" + zahl(d.getMinutes());
    } else {
      $("spiel-datum").value = "";
      $("spiel-zeit").value = "";
    }

    details.ergebnisse.forEach(function (e) {
      var gruppe = machen("div", "punktefeld");
      var label = machen("label", "label", e.name);
      label.setAttribute("for", "punkte-" + e.ergebnis_id);

      var feld = machen("input", "eingabe");
      feld.type = "number";
      feld.id = "punkte-" + e.ergebnis_id;
      feld.inputMode = "numeric";
      feld.value = String(e.punkte);

      gruppe.appendChild(label);
      gruppe.appendChild(feld);
      felder.appendChild(gruppe);

      spielPunkteFelder[e.ergebnis_id] = feld;
    });

    $("spiel-bearbeiten-felder").hidden = false;
  }

  function spielBearbeitenAnfragen() {
    var sel = $("wahl-spiel-bearbeiten");
    var id = sel.value;
    var fehler = $("fehler-spiel-bearbeiten");

    if (!id) { fehler.textContent = "Bitte eine Partie auswählen."; return; }

    var ids = Object.keys(spielPunkteFelder);
    if (!ids.length) { fehler.textContent = "Bitte zuerst eine Partie auswählen."; return; }

    var datumWert = $("spiel-datum").value;
    var zeitWert = $("spiel-zeit").value;
    if (!datumWert || !zeitWert) {
      fehler.textContent = "Bitte Datum und Uhrzeit angeben.";
      return;
    }

    var punkte = {};
    for (var i = 0; i < ids.length; i++) {
      var roh = spielPunkteFelder[ids[i]].value;
      var wert = parseInt(roh, 10);
      if (roh === "" || isNaN(wert)) {
        fehler.textContent = "Bitte für alle Spieler eine gültige Punktzahl eingeben.";
        return;
      }
      punkte[ids[i]] = wert;
    }

    var neuesDatum = datumWert + "T" + zeitWert + ":00";
    var beschriftung = beschriftungVon(sel);

    frageNach(
      "Sollen die Änderungen an der Partie „" + beschriftung + "“ wirklich " +
      "gespeichert werden?",
      function () { DB.spielBearbeiten(id, neuesDatum, punkte); },
      "ansicht-spiel-bearbeiten"
    );
  }

  /* ---------------- Datensicherung ---------------- */

  function sicherungSpeichern() {
    var inhalt = DB.exportieren();
    var blob = new Blob([inhalt], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var jetzt = new Date();

    var a = document.createElement("a");
    a.href = url;
    a.download = "portriga-sicherung-" + jetzt.getFullYear() +
      zahl(jetzt.getMonth() + 1) + zahl(jetzt.getDate()) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    $("hinweis-sicherung").textContent = "Sicherung heruntergeladen.";
  }

  function sicherungLaden(datei) {
    var leser = new FileReader();
    leser.onload = function () {
      try {
        DB.importieren(String(leser.result));
        $("hinweis-sicherung").textContent = "Sicherung geladen.";
        aktualisiereSpielerOptionen();
      } catch (e) {
        $("hinweis-sicherung").textContent = "Datei konnte nicht gelesen werden.";
      }
    };
    leser.onerror = function () {
      $("hinweis-sicherung").textContent = "Datei konnte nicht gelesen werden.";
    };
    leser.readAsText(datei);
  }

  /* ---------------- Verdrahtung ---------------- */

  function start() {
    if (!DB.speicherVerfuegbar) $("speicherwarnung").hidden = false;

    // Setup
    $("btn-spieler-anlegen").addEventListener("click", neuenSpielerAnlegen);
    $("neuer-spieler").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); neuenSpielerAnlegen(); }
    });
    $("anzahl-spieler").addEventListener("input", erstelleSpielerFelder);
    $("btn-spiel-starten").addEventListener("click", spielStarten);
    $("btn-statistik").addEventListener("click", function () {
      zeigeStatistik("ansicht-setup");
    });
    $("btn-bearbeiten").addEventListener("click", function () {
      zeigeAnsicht("ansicht-bearbeiten");
    });

    // Partie
    $("btn-runde-abschliessen").addEventListener("click", rundeAbschliessen);
    $("btn-korrigieren-spiel").addEventListener("click", letzteRundeKorrigieren);

    // Ende
    $("btn-korrigieren-ende").addEventListener("click", letzteRundeKorrigieren);
    $("btn-neues-spiel").addEventListener("click", neustart);
    $("btn-statistik-ende").addEventListener("click", function () {
      zeigeStatistik("ansicht-ende");
    });

    // Statistik
    $("btn-statistik-zurueck").addEventListener("click", function () {
      zeigeAnsicht(statsZurueck);
    });

    // Bearbeiten
    $("btn-zu-spieler-loeschen").addEventListener("click", oeffneSpielerLoeschen);
    $("btn-zu-spieler-bearbeiten").addEventListener("click", oeffneSpielerBearbeiten);
    $("btn-zu-spiel-loeschen").addEventListener("click", oeffneSpielLoeschen);
    $("btn-zu-spiel-bearbeiten").addEventListener("click", oeffneSpielBearbeiten);
    $("btn-bearbeiten-zurueck").addEventListener("click", function () {
      zeigeAnsicht("ansicht-setup");
    });

    Array.prototype.forEach.call(
      document.querySelectorAll(".zurueck-bearbeiten"),
      function (btn) {
        btn.addEventListener("click", function () {
          zeigeAnsicht("ansicht-bearbeiten");
        });
      }
    );

    $("btn-spieler-loeschen").addEventListener("click", spielerLoeschenAnfragen);
    $("btn-spieler-speichern").addEventListener("click", spielerBearbeitenAnfragen);
    $("btn-spiel-loeschen").addEventListener("click", spielLoeschenAnfragen);
    $("btn-spiel-speichern").addEventListener("click", spielBearbeitenAnfragen);
    $("wahl-spiel-bearbeiten").addEventListener("change", spielAuswahlGeaendert);

    // Beim Spieler-Auswählen den bisherigen Namen vorschlagen
    $("wahl-spieler-bearbeiten").addEventListener("change", function () {
      var id = $("wahl-spieler-bearbeiten").value;
      $("neuer-name").value = id ? nameVon(id) : "";
      $("fehler-spieler-bearbeiten").textContent = "";
    });

    // Sicherheitsabfrage
    $("btn-sicherheit-ja").addEventListener("click", sicherheitJa);
    $("btn-sicherheit-nein").addEventListener("click", sicherheitNein);

    // Datensicherung
    $("btn-export").addEventListener("click", sicherungSpeichern);
    $("btn-import").addEventListener("click", function () {
      $("import-datei").click();
    });
    $("import-datei").addEventListener("change", function (e) {
      if (e.target.files && e.target.files[0]) sicherungLaden(e.target.files[0]);
      e.target.value = "";
    });

    zeigeAnsicht("ansicht-setup");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();