"""Validate and normalize administrator uploads; never trust client filenames."""
import io
import os
import tempfile
import warnings
from pathlib import Path
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_UPLOAD_BYTES = 5 * 1024 * 1024


def save_cover(payload, record_id, directory):
    if not payload or len(payload) > MAX_UPLOAD_BYTES:
        raise ValueError("Обложка должна быть размером от 1 байта до 5 МБ")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(payload)) as source:
                if source.format not in {"JPEG", "PNG", "WEBP"}:
                    raise ValueError("Поддерживаются только JPG, PNG и WebP")
                if max(source.size) > 4096:
                    raise ValueError("Размер изображения не должен превышать 4096×4096")
                source.verify()
            with Image.open(io.BytesIO(payload)) as source:
                image = ImageOps.exif_transpose(source).convert("RGB")
                image.thumbnail((1600, 1600))
                output = io.BytesIO()
                image.save(output, "JPEG", quality=92)
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError,
            Image.DecompressionBombWarning) as error:
        raise ValueError("Не удалось прочитать изображение. Выберите другой файл") from error

    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / f"{int(record_id)}.jpg"
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=directory, suffix=".tmp", delete=False) as file:
            temporary = Path(file.name)
            file.write(output.getvalue())
        os.replace(temporary, target)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()
    return target
