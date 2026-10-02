"""Generate original vector artwork; no external assets or dependencies."""

from pathlib import Path
from html import escape

OUT = Path(__file__).resolve().parent.parent / "static" / "covers"
OUT.mkdir(parents=True, exist_ok=True)
palettes = [
    ("#163a55", "#8db1c2"),
    ("#191e24", "#edb966"),
    ("#c6bba1", "#3c4946"),
    ("#e9e0c7", "#885239"),
    ("#1d5765", "#b8d4cb"),
    ("#751c28", "#f68255"),
    ("#407b97", "#d6e5d5"),
    ("#333c36", "#d1b479"),
    ("#242b2c", "#9eaa91"),
    ("#d7c2a3", "#352f2b"),
    ("#c35538", "#e6d5b5"),
    ("#664c7d", "#e6ba9b"),
]
names = [
    ("MILES DAVIS", "KIND OF BLUE"),
    ("PINK FLOYD", "THE DARK SIDE OF THE MOON"),
    ("DAFT PUNK", "RANDOM ACCESS MEMORIES"),
    ("FLEETWOOD MAC", "RUMOURS"),
    ("JOHN COLTRANE", "BLUE TRAIN"),
    ("THE WEEKND", "AFTER HOURS"),
    ("NIRVANA", "NEVERMIND"),
    ("SADE", "DIAMOND LIFE"),
    ("MASSIVE ATTACK", "MEZZANINE"),
    ("AMY WINEHOUSE", "BACK TO BLACK"),
    ("DAVID BOWIE", "HEROES"),
    ("DUA LIPA", "FUTURE NOSTALGIA"),
]
for i, ((bg, fg), (artist, title)) in enumerate(zip(palettes, names)):
    if i % 4 == 0:
        art = "".join(
            f'<path d="M {x} 340 Q {400-x} 230 {x+60} 100" fill="none" stroke="{fg}"'
            f' stroke-width="14" opacity="{0.25+j*.1}"/>'
            for j, x in enumerate(range(50, 300, 40))
        )
    elif i % 4 == 1:
        art = (
            f'<circle cx="200" cy="215" r="118" fill="{fg}" opacity=".12"/><path d="M'
            f' 90 290 L 200 105 L 310 290 Z" fill="none" stroke="{fg}"'
            ' stroke-width="3"/>'
            + "".join(
                f'<path d="M 200 200 L 400 {210+j*14}" stroke="{c}" stroke-width="8"/>'
                for j, c in enumerate(
                    ["#ce7056", "#dda854", "#e3cb77", "#84a58f", "#6e9aa9"]
                )
            )
            + f'<path d="M 0 240 L 200 200" stroke="{fg}" stroke-width="3"/>'
        )
    elif i % 4 == 2:
        art = "".join(
            f'<ellipse cx="{145+j*100}" cy="215" rx="75" ry="95" fill="none"'
            f' stroke="{fg}" stroke-width="18"/><path d="M {85+j*100} 215 H'
            f' {205+j*100}" stroke="{fg}" stroke-width="35"/>'
            for j in range(2)
        )
    else:
        art = (
            f'<circle cx="205" cy="200" r="110" fill="{fg}" opacity=".2"/><path d="M'
            " 110 325 Q 85 260 155 180 Q 125 100 185 100 Q 235 105 202 180 L 245 325"
            f' Z" fill="{fg}"/><path d="M 240 325 Q 310 220 248 140" fill="none"'
            f' stroke="{fg}" stroke-width="10"/><circle cx="248" cy="120" r="23"'
            f' fill="{fg}"/>'
        )
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><filter'
        ' id="grain"><feTurbulence type="fractalNoise" baseFrequency=".8"'
        ' numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate"'
        ' values="0"/><feComponentTransfer><feFuncA type="linear"'
        ' slope=".13"/></feComponentTransfer><feBlend in="SourceGraphic"'
        ' mode="soft-light"/></filter></defs><rect width="400" height="400"'
        f' fill="{bg}"/><g filter="url(#grain)">{art}</g><text x="25" y="40"'
        f' font-family="Arial,sans-serif" font-size="{26 if len(artist)<15 else 21}"'
        f' font-weight="700" fill="{fg}"'
        f' letter-spacing="1">{escape(artist)}</text><text x="26" y="62"'
        f' font-family="Arial,sans-serif" font-size="10" fill="{fg}"'
        f' letter-spacing="2">{escape(title)}</text><path d="M 25 355 H 375"'
        f' stroke="{fg}" opacity=".4"/><text x="25" y="378"'
        f' font-family="Arial,sans-serif" font-size="8" fill="{fg}"'
        f' letter-spacing="2">VINYL ROOM • ART SERIES / {i+1:02}</text><text x="335"'
        ' y="378" font-family="Arial,sans-serif" font-size="8"'
        f' fill="{fg}">STEREO</text></svg>'
    )
    (OUT / f"{i}.svg").write_text(svg, encoding="utf-8")
print("Created 12 original SVG covers.")
