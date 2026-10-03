import base64
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from shop import covers
from shop.uploads import save_cover, MAX_UPLOAD_BYTES


class UploadTests(unittest.TestCase):
    def test_supported_formats_and_stable_filename(self):
        with tempfile.TemporaryDirectory() as directory:
            record = dict(id=42, artist='Old name', title='Album', cover=0)
            with patch.object(covers, 'UPLOAD_DIR', Path(directory)):
                for image_format in ['JPEG', 'PNG', 'WEBP']:
                    payload = io.BytesIO()
                    Image.new('RGB', (40, 60), 'red').save(payload, image_format)
                    target = save_cover(payload.getvalue(), 42, directory)
                    self.assertEqual(target.name, '42.jpg')
                    with Image.open(target) as image:
                        self.assertEqual(image.format, 'JPEG')
                    record['artist'] = 'Changed name'
                    self.assertTrue(covers.cover_info(record)['has_cover'])
                    self.assertIn('/covers/uploads/42.jpg', record['cover_url'])

    def test_invalid_files_do_not_replace_existing_cover(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / '1.jpg'
            target.write_bytes(b'original')
            bad_png = base64.b64decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII="
            )
            for payload in [b'', bad_png, b'<svg onload="alert(1)"></svg>', b'x'*(MAX_UPLOAD_BYTES+1)]:
                with self.assertRaises(ValueError):
                    save_cover(payload, 1, directory)
                self.assertEqual(target.read_bytes(), b'original')

    def test_oversized_dimensions_are_rejected(self):
        payload = io.BytesIO()
        Image.new('RGB', (4097, 1)).save(payload, 'PNG')
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                save_cover(payload.getvalue(), 1, directory)
            self.assertEqual(list(Path(directory).iterdir()), [])
