"""Erzeugt die Icons für Homebildschirm, Tab und Manifest.

Motiv: der Kartenbogen 1 → 7 → 1, also dieselbe Rundenleiste, die in der App
über der laufenden Partie steht. Symmetrisch, damit es nicht wie eine
Signalstärke-Anzeige wirkt.
"""

from PIL import Image, ImageDraw

TISCH_OBEN = (62, 43, 30)     # #3E2B1E
TISCH_UNTEN = (44, 30, 21)    # #2C1E15
GOLD = (200, 145, 44)         # #C8912C
GOLD_HELL = (228, 180, 72)    # #E4B448

BOGEN = [1, 3, 5, 7, 5, 3, 1]
SS = 4  # Supersampling für saubere Kanten


def zeichne(groesse, inhalt_anteil, rund=False):
    s = groesse * SS
    bild = Image.new("RGB", (s, s), TISCH_UNTEN)
    zeichner = ImageDraw.Draw(bild)

    # senkrechter Verlauf als Hintergrund
    for y in range(s):
        t = y / max(1, s - 1)
        farbe = tuple(
            round(TISCH_OBEN[i] + (TISCH_UNTEN[i] - TISCH_OBEN[i]) * t)
            for i in range(3)
        )
        zeichner.line([(0, y), (s, y)], fill=farbe)

    # Balkengeometrie
    inhalt_b = s * inhalt_anteil
    inhalt_h = s * inhalt_anteil * 0.78
    n = len(BOGEN)
    lueckenanteil = 0.38
    balken_b = inhalt_b / (n + (n - 1) * lueckenanteil)
    luecke = balken_b * lueckenanteil

    start_x = (s - inhalt_b) / 2
    boden_y = (s + inhalt_h) / 2
    radius = balken_b * 0.22

    for i, hoehe in enumerate(BOGEN):
        x0 = start_x + i * (balken_b + luecke)
        x1 = x0 + balken_b
        h = inhalt_h * (hoehe / max(BOGEN))
        y0 = boden_y - h
        farbe = GOLD_HELL if hoehe == max(BOGEN) else GOLD
        zeichner.rounded_rectangle(
            [x0, y0, x1, boden_y], radius=radius, fill=farbe
        )

    # Grundlinie unter den Balken, wie der Strich in der App
    linien_y = boden_y + balken_b * 0.30
    zeichner.rounded_rectangle(
        [start_x, linien_y, start_x + inhalt_b, linien_y + balken_b * 0.16],
        radius=balken_b * 0.08,
        fill=GOLD,
    )

    bild = bild.resize((groesse, groesse), Image.LANCZOS)

    if rund:
        maske = Image.new("L", (groesse * SS, groesse * SS), 0)
        ImageDraw.Draw(maske).rounded_rectangle(
            [0, 0, groesse * SS, groesse * SS],
            radius=groesse * SS * 0.22,
            fill=255,
        )
        maske = maske.resize((groesse, groesse), Image.LANCZOS)
        rgba = bild.convert("RGBA")
        rgba.putalpha(maske)
        return rgba

    return bild


# Homebildschirm iOS: randfüllend, ohne Transparenz (iOS rundet selbst ab)
zeichne(180, 0.72).save("icon-180.png")

# Android / Manifest
zeichne(192, 0.72).save("icon-192.png")
zeichne(512, 0.72).save("icon-512.png")

# Maskable: Motiv im sicheren Bereich, damit nichts abgeschnitten wird
zeichne(512, 0.54).save("icon-maskable-512.png")

# Browser-Tab
zeichne(32, 0.80).save("icon-32.png")
zeichne(180, 0.72, rund=True).save("vorschau-rund.png")

print("Icons erzeugt.")
