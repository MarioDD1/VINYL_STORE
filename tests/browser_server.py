"""Isolated local server used only by Playwright; no real user data is changed."""
import os
import sys
import tempfile
from pathlib import Path
from http.server import ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shop import database, covers, server

os.environ['DB_ENCRYPTION_KEY'] = 'c' * 64

with tempfile.TemporaryDirectory() as directory:
    database.DB = Path(directory) / 'shop.sqlite3'
    covers.UPLOAD_DIR = Path(directory) / 'uploads'
    server.INVITE = 'browser-test-invite'
    database.init()
    verification_codes = {}
    server.send_verification_email = lambda email, code: verification_codes.update(
        {email: code}
    )

    class TestHandler(server.Handler):
        def do_GET(self):
            if self.path.startswith('/__test__/verification-code?'):
                email = parse_qs(urlparse(self.path).query).get('email', [''])[0]
                code = verification_codes.get(email)
                return self.reply({'code': code} if code else {'error': 'Not found'}, 200 if code else 404)
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
