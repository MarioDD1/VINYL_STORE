import http.cookiejar
import json
import os
import sqlite3 as standard_sqlite3
import tempfile
import threading
import unittest
from unittest.mock import patch
import urllib.error
import urllib.request
from pathlib import Path
from http.server import ThreadingHTTPServer
from shop import database, server


class ShopTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.old_db = database.DB
        cls.old_key = os.environ.get("DB_ENCRYPTION_KEY")
        os.environ["DB_ENCRYPTION_KEY"] = "b" * 64
        database.DB = Path(cls.temp.name) / "test.sqlite3"
        database.init()
        cls.http = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.base = "http://127.0.0.1:" + str(cls.http.server_port)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join()
        database.DB = cls.old_db
        if cls.old_key is None:
            os.environ.pop("DB_ENCRYPTION_KEY", None)
        else:
            os.environ["DB_ENCRYPTION_KEY"] = cls.old_key
        cls.temp.cleanup()

    def client(self):
        return urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
        )

    def call(self, client, path, body=None, origin=None):
        headers = {"Content-Type": "application/json"}
        if origin:
            headers["Origin"] = origin
        req = urllib.request.Request(
            self.base + "/api/" + path,
            data=json.dumps(body).encode() if body is not None else None,
            headers=headers,
        )
        try:
            response = client.open(req)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.code, json.loads(response.read())

    def register(self, client, body):
        with patch.object(server, "send_verification_email") as send_email:
            code, result = self.call(client, "register", body)
        if code != 200:
            return code, result
        verification_code = send_email.call_args.args[1]
        return self.call(
            client,
            "verify-email",
            {"email": result["email"], "code": verification_code},
        )

    def test_complete_roles_and_order_lifecycle(self):
        guest, customer, other, admin = [self.client() for _ in range(4)]

        # Гостю доступен каталог, но не личные данные и действия покупателя.
        code, state = self.call(guest, "state")
        self.assertEqual(code, 200)
        self.assertIsNone(state["user"])
        self.assertEqual(len(state["records"]), 56)
        self.assertEqual(self.call(guest, "orders")[0], 401)
        self.assertEqual(self.call(guest, "favorite", {"id": 1})[0], 403)
        # Создаём покупателей и проверяем защиту роли администратора.
        for client, email in [
            (customer, "buyer@example.com"),
            (other, "other@example.com"),
        ]:
            self.assertEqual(
                self.register(
                    client,
                    {"name": "Покупатель", "email": email, "password": "test-password"},
                )[0],
                200,
            )
        self.assertEqual(self.call(customer, "admin/delete", {"id": 1})[0], 403)
        self.assertEqual(
            self.register(
                admin,
                {
                    "name": "Администратор",
                    "email": "admin@example.com",
                    "password": "test-password",
                    "role": "admin",
                    "invite": "wrong",
                },
            )[0],
            403,
        )
        self.assertEqual(
            self.register(
                admin,
                {
                    "name": "Администратор",
                    "email": "admin@example.com",
                    "password": "test-password",
                    "role": "admin",
                    "invite": server.INVITE,
                },
            )[0],
            200,
        )
        self.assertEqual(self.call(customer, "favorite", {"id": 1})[0], 200)
        self.assertEqual(self.call(customer, "state")[1]["favorites"], [1])
        self.assertEqual(self.call(other, "state")[1]["favorites"], [])
        self.assertEqual(
            self.call(customer, "favorite", {"id": 1}, "http://evil.example")[0], 403
        )
        # Цена заказа берётся с сервера, остаток уменьшается после покупки.
        before = state["records"][0]
        order = {
            "address": "Москва, улица Примерная, дом 10",
            "phone": "+7 999 123 45 67",
            "items": [{"id": 1, "quantity": 2}],
            "total": 1,
        }
        code, result = self.call(customer, "orders", order)
        self.assertEqual(code, 200)
        oid = result["id"]
        saved = self.call(customer, "orders")[1][0]
        self.assertEqual(saved["total"], before["price"] * 2)
        self.assertEqual(self.call(other, "orders")[1], [])
        self.assertEqual(
            self.call(guest, "state")[1]["records"][0]["stock"], before["stock"] - 2
        )
        # Неудачный заказ не должен частично списывать остатки.
        order["items"] = [{"id": 1, "quantity": 1}, {"id": 2, "quantity": 99999}]
        self.assertEqual(self.call(customer, "orders", order)[0], 400)
        self.assertEqual(
            self.call(guest, "state")[1]["records"][0]["stock"], before["stock"] - 2
        )
        self.assertEqual(len(self.call(admin, "orders")[1]), 1)
        self.assertEqual(
            self.call(customer, "admin/status", {"id": oid, "status": "Отменён"})[0],
            403,
        )
        # Повторная отмена возвращает товар на склад только один раз.
        for _ in range(2):
            self.assertEqual(
                self.call(admin, "admin/status", {"id": oid, "status": "Отменён"})[0],
                200,
            )
        self.assertEqual(
            self.call(guest, "state")[1]["records"][0]["stock"], before["stock"]
        )
        self.assertEqual(
            self.call(admin, "admin/status", {"id": oid, "status": "Новый"})[0], 400
        )
        # Администратор может добавить, изменить и убрать пластинку.
        record = dict(
            artist="Test",
            title="New record",
            genre="Джаз",
            year=2026,
            price=1500,
            stock=3,
            description="Описание пластинки",
            cover=2,
        )
        self.assertEqual(self.call(admin, "admin/record", record)[0], 200)
        new = self.call(admin, "state")[1]["records"][-1]
        record.update(id=new["id"], price=1700)
        self.assertEqual(self.call(admin, "admin/record", record)[0], 200)
        self.assertEqual(self.call(admin, "state")[1]["records"][-1]["price"], 1700)
        self.assertEqual(self.call(admin, "admin/delete", {"id": new["id"]})[0], 200)
        self.assertEqual(len(self.call(guest, "state")[1]["records"]), 56)
        self.assertEqual(self.call(customer, "logout", {})[0], 200)
        self.assertIsNone(self.call(customer, "state")[1]["user"])
        self.assertEqual(
            self.call(
                customer, "login", {"email": "buyer@example.com", "password": "wrong"}
            )[0],
            400,
        )
        self.assertEqual(
            self.call(
                customer,
                "login",
                {"email": "buyer@example.com", "password": "test-password"},
            )[0],
            200,
        )
        self.assertEqual(self.call(customer, "state")[1]["user"]["role"], "customer")

    def test_email_verification_and_loyalty_points(self):
        customer = self.client()
        registration = {
            "name": "Бонусный покупатель",
            "email": "points@example.com",
            "password": "test-password",
        }
        with patch.object(server, "send_verification_email") as send_email:
            code, pending = self.call(customer, "register", registration)
            code_again, pending_again = self.call(customer, "register", registration)
        self.assertEqual(code, 200)
        self.assertTrue(pending["verification_required"])
        self.assertEqual(code_again, 200)
        self.assertTrue(pending_again["verification_required"])
        send_email.assert_called_once()
        verification_code = send_email.call_args.args[1]
        self.assertEqual(
            self.call(
                self.client(),
                "login",
                {"email": registration["email"], "password": registration["password"]},
            )[0],
            400,
        )
        self.assertEqual(
            self.call(
                customer,
                "verify-email",
                {"email": registration["email"], "code": "000000"},
            )[0],
            400,
        )
        self.assertEqual(
            self.call(
                customer,
                "verify-email",
                {"email": registration["email"], "code": verification_code},
            )[0],
            200,
        )
        self.assertTrue(self.call(customer, "state")[1]["user"]["email_verified"])
        self.assertEqual(self.call(customer, "state")[1]["user"]["points"], 0)

        order = {
            "address": "Москва, улица Примерная, дом 10",
            "phone": "+7 999 123 45 67",
            "items": [{"id": 2, "quantity": 1}],
        }
        code, result = self.call(customer, "orders", order)
        self.assertEqual(code, 200)
        self.assertEqual(result["points_earned"], result["total"] * 5 // 100)
        self.assertEqual(self.call(customer, "state")[1]["user"]["points"], 0)
        admin = self.client()
        self.assertEqual(
            self.register(
                admin,
                {
                    "name": "Администратор баллов",
                    "email": "points-admin@example.com",
                    "password": "test-password",
                    "role": "admin",
                    "invite": server.INVITE,
                },
            )[0],
            200,
        )
        self.assertEqual(
            self.call(
                admin,
                "admin/status",
                {"id": result["id"], "status": "Завершён"},
            )[0],
            200,
        )
        earned = result["points_earned"]
        self.assertEqual(self.call(customer, "state")[1]["user"]["points"], earned)

        order["points_to_use"] = earned
        code, discounted = self.call(customer, "orders", order)
        self.assertEqual(code, 200)
        self.assertEqual(discounted["points_used"], earned)
        self.assertEqual(discounted["total"], discounted["subtotal"] - earned)
        self.assertEqual(
            self.call(customer, "state")[1]["user"]["points"], 0
        )
        self.assertEqual(
            self.call(
                admin,
                "admin/status",
                {"id": discounted["id"], "status": "Отменён"},
            )[0],
            200,
        )
        self.assertEqual(self.call(customer, "state")[1]["user"]["points"], earned)

    def test_plaintext_database_is_migrated_with_encrypted_backup(self):
        with tempfile.TemporaryDirectory() as directory:
            original_db = database.DB
            database.DB = Path(directory) / "legacy.sqlite3"
            try:
                plain = standard_sqlite3.connect(database.DB)
                plain.executescript("""
                    CREATE TABLE users (
                        id INTEGER PRIMARY KEY, name TEXT NOT NULL,
                        email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
                        role TEXT NOT NULL
                    );
                    CREATE TABLE records (
                        id INTEGER PRIMARY KEY, artist TEXT NOT NULL,
                        title TEXT NOT NULL, genre TEXT NOT NULL, year INTEGER NOT NULL,
                        price INTEGER NOT NULL, stock INTEGER NOT NULL,
                        description TEXT NOT NULL, cover INTEGER NOT NULL DEFAULT 0,
                        active INTEGER NOT NULL DEFAULT 1
                    );
                    INSERT INTO users VALUES(1, 'Legacy', 'legacy@example.com',
                        'salt:digest', 'customer');
                    INSERT INTO records VALUES(1, 'Artist', 'Album', 'Rock', 2000,
                        1000, 3, 'Description', 0, 1);
                """)
                plain.close()

                database.init()
                with database.DB.open("rb") as encrypted:
                    self.assertNotEqual(
                        encrypted.read(len(database.SQLITE_HEADER)),
                        database.SQLITE_HEADER,
                    )
                backup = database.DB.with_name(database.DB.name + ".encrypted.bak")
                self.assertTrue(backup.is_file())
                with backup.open("rb") as encrypted_backup:
                    self.assertNotEqual(
                        encrypted_backup.read(len(database.SQLITE_HEADER)),
                        database.SQLITE_HEADER,
                    )
                with database.connect() as db:
                    self.assertEqual(
                        db.execute("SELECT email FROM users WHERE id=1").fetchone()[0],
                        "legacy@example.com",
                    )
                    self.assertEqual(
                        db.execute("SELECT points FROM users WHERE id=1").fetchone()[0],
                        0,
                    )
            finally:
                database.DB = original_db

    def test_static_files(self):
        for path in ["/covers/0.svg", "/covers/11.svg"]:
            with urllib.request.urlopen(self.base + path) as response:
                self.assertEqual(response.code, 200)
                self.assertGreater(len(response.read()), 100)
        with self.assertRaises(urllib.error.HTTPError) as error:
            urllib.request.urlopen(self.base + "/../shop/server.py")
        self.assertEqual(error.exception.code, 404)
        error.exception.close()


    def test_missing_build_and_recovery(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            cover_dir = root / "static" / "covers"
            cover_dir.mkdir(parents=True)
            (cover_dir / "test.svg").write_text("<svg/>", encoding="utf-8")
            with patch.object(server, "ROOT", root):
                for route in ["/", "/catalog", "/albums/1", "/admin"]:
                    with self.assertRaises(urllib.error.HTTPError) as caught:
                        urllib.request.urlopen(self.base + route)
                    with caught.exception as response:
                        self.assertEqual(response.code, 503)
                        text = response.read().decode("utf-8")
                        self.assertIn("Сначала выполните сборку React", text)
                        self.assertIn("npm run build", text)
                        self.assertEqual(response.headers["Cache-Control"], "no-store")

                # API and covers remain available even before the React build.
                self.assertEqual(self.call(self.client(), "state")[0], 200)
                with urllib.request.urlopen(self.base + "/covers/test.svg") as response:
                    self.assertEqual(response.read(), b"<svg/>")

                build = root / "frontend" / "dist"
                build.mkdir(parents=True)
                (build / "index.html").write_text("<html>React build</html>")
                assets = build / "assets"
                assets.mkdir()
                (assets / "app.js").write_text("console.log('React');")
                for route in ["/", "/catalog", "/albums/1", "/admin"]:
                    with urllib.request.urlopen(self.base + route) as response:
                        self.assertEqual(response.code, 200)
                        self.assertIn(b"React build", response.read())
                with urllib.request.urlopen(self.base + "/assets/app.js") as response:
                    self.assertEqual(response.code, 200)

                for route in ["/app.js", "/styles.css", "/assets/missing.js",
                              "/covers/../index.html", "/../shop/server.py"]:
                    with self.assertRaises(urllib.error.HTTPError) as caught:
                        urllib.request.urlopen(self.base + route)
                    with caught.exception as response:
                        self.assertEqual(response.code, 404)


if __name__ == "__main__":
    unittest.main()
