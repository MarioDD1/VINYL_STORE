"""Local album artwork with automatic fallback to the original SVGs."""
import re
import unicodedata
from .database import ROOT

COVER_DIR = ROOT / "static" / "covers" / "albums"
EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")


def cover_stem(record):
    name = f"{record['artist']}-{record['title']}"
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or f"album-{record['id']}"


def cover_info(record):
    stem = cover_stem(record)
    record["cover_filename"] = stem + ".jpg"
    record["cover_url"] = f"/covers/{record['cover']}.svg"
    record["has_cover"] = False
    for extension in EXTENSIONS:
        path = COVER_DIR / (stem + extension)
        if path.is_file():
            record["cover_url"] = (
                f"/covers/albums/{path.name}?v={path.stat().st_mtime_ns}"
            )
            record["has_cover"] = True
            break
    return record
