import http.cookiejar
import json
import tempfile
import threading
import unittest
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

    def test_complete_roles_and_order_lifecycle(self):
        guest, customer, other, admin = [self.client() for _ in range(4)]

        # Гостю доступен каталог, но не личные данные и действия покупателя.
        code, state = self.call(guest, "state")
        self.assertEqual(code, 200)
        self.assertIsNone(state["user"])
        self.assertEqual(len(state["records"]), 20)
        self.assertEqual(self.call(guest, "orders")[0], 401)
        self.assertEqual(self.call(guest, "favorite", {"id": 1})[0], 403)
        # Создаём покупателей и проверяем защиту роли администратора.
        for client, email in [
            (customer, "buyer@example.com"),
            (other, "other@example.com"),
        ]:
            self.assertEqual(
                self.call(
                    client,
                    "register",
                    {"name": "Покупатель", "email": email, "password": "test-password"},
                )[0],
                200,
            )
        self.assertEqual(self.call(customer, "admin/delete", {"id": 1})[0], 403)
        self.assertEqual(
            self.call(
                admin,
                "register",
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
            self.call(
                admin,
                "register",
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
        self.assertEqual(len(self.call(guest, "state")[1]["records"]), 20)
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

    def test_static_files(self):
        for path in ["/", "/styles.css", "/app.js", "/covers/0.svg", "/covers/11.svg"]:
            with urllib.request.urlopen(self.base + path) as response:
                self.assertEqual(response.code, 200)
                self.assertGreater(len(response.read()), 100)
        with self.assertRaises(urllib.error.HTTPError) as error:
            urllib.request.urlopen(self.base + "/../shop/server.py")
        self.assertEqual(error.exception.code, 404)
        error.exception.close()


if __name__ == "__main__":
    unittest.main()
