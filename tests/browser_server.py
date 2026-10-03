"""Isolated local server used only by Playwright; no real user data is changed."""
import sys
import tempfile
from pathlib import Path
from http.server import ThreadingHTTPServer

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shop import database, covers, server

with tempfile.TemporaryDirectory() as directory:
    database.DB = Path(directory) / 'shop.sqlite3'
    covers.UPLOAD_DIR = Path(directory) / 'uploads'
    server.INVITE = 'browser-test-invite'
    database.init()

    class TestHandler(server.Handler):
        def do_GET(self):
            # Test uploads stay in a temporary directory, outside the real assets.
            if self.path.startswith('/covers/uploads/'):
                filename = self.path.split('?')[0].rsplit('/', 1)[1]
                target = covers.UPLOAD_DIR / filename
                if target.is_file():
                    self.send_response(200)
                    self.send_header('Content-Type', 'image/jpeg')
                    self.end_headers()
                    self.wfile.write(target.read_bytes())
                    return
            super().do_GET()

    ThreadingHTTPServer(('127.0.0.1', 8010), TestHandler).serve_forever()
