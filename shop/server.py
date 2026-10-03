import hmac
import json
import os
import secrets
import sqlite3
import time
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
from .database import ROOT, connect, init, password_hash
from .covers import cover_info
from . import covers
from .uploads import MAX_UPLOAD_BYTES, save_cover

INVITE = os.environ.get("ADMIN_INVITE_CODE") or secrets.token_urlsafe(12)
STATUSES = ["Новый", "В обработке", "Отправлен", "Завершён", "Отменён"]


class Handler(BaseHTTPRequestHandler):
    def reply(self, data, status=200, cookie=None):
        payload = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(payload)

    def user(self, db):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
            token = cookie["session"].value if "session" in cookie else ""
        except Exception:
            return None
        row = db.execute(
            "SELECT users.id,name,email,role FROM users JOIN sessions ON"
            " users.id=sessions.user_id WHERE token=? AND expires>?",
            (token, time.time()),
        ).fetchone()
        return dict(row) if row else None

    def do_GET(self):
        path = urlparse(self.path).path
        if path.startswith("/api/"):
            with connect() as db:
                user = self.user(db)
                if path == "/api/state":
                    records = [
                        cover_info(dict(r))
                        for r in db.execute(
                            "SELECT * FROM records WHERE active=1 ORDER BY id"
                        )
                    ]
                    favorites = (
                        [
                            r[0]
                            for r in db.execute(
                                "SELECT record_id FROM favorites WHERE user_id=?",
                                (user["id"],),
                            )
                        ]
                        if user
                        else []
                    )
                    return self.reply(
                        dict(user=user, records=records, favorites=favorites)
                    )
                if path == "/api/orders":
                    if not user:
                        return self.reply({"error": "Войдите в аккаунт"}, 401)
                    query = (
                        "SELECT orders.*,users.name,users.email FROM orders JOIN users"
                        " ON users.id=orders.user_id"
                    )
                    params = ()
                    if user["role"] != "admin":
                        query += " WHERE user_id=?"
                        params = (user["id"],)
                    orders = [
                        dict(r)
                        for r in db.execute(query + " ORDER BY orders.id DESC", params)
                    ]
                    for order in orders:
                        order["items"] = [
                            dict(r)
                            for r in db.execute(
                                "SELECT * FROM order_items WHERE order_id=?",
                                (order["id"],),
                            )
                        ]
                    return self.reply(orders)
                return self.reply({"error": "Не найдено"}, 404)
        self.serve_frontend(path)

    def serve_frontend(self, path):
        if path.startswith("/covers/"):
            asset_root = ROOT / "static" / "covers"
            relative = path.removeprefix("/covers/")
        else:
            asset_root = ROOT / "frontend" / "dist"
            relative = path.lstrip("/")

        target = (asset_root / relative).resolve()
        if not target.is_relative_to(asset_root.resolve()):
            self.send_error(404)
            return

        page_routes = {
            "/", "/index.html", "/catalog", "/favorites", "/cart",
            "/account", "/orders", "/admin",
        }
        if path in page_routes or path.startswith("/albums/"):
            target = asset_root / "index.html"
            if not target.is_file():
                self.build_required()
                return

        if not target.is_file():
            self.send_error(404)
            return

        types = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".svg": "image/svg+xml",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
        }
        self.send_response(200)
        self.send_header(
            "Content-Type", types.get(target.suffix, "application/octet-stream")
        )
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(target.read_bytes())

    def build_required(self):
        # This is a setup notice, not a second implementation of the website.
        html = """<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>VINYL ROOM — нужна сборка React</title>
</head>
<body>
  <main>
    <h1>Сначала выполните сборку React</h1>
    <p>Сервер работает, но файл frontend/dist/index.html ещё не создан.</p>
    <p>В терминале из папки VINYL_STORE выполните:</p>
    <pre>cd frontend
npm ci
npm run build</pre>
    <p>После успешной сборки обновите страницу. Перезапуск сервера не нужен.</p>
    <p>Исходный код интерфейса находится в frontend/src/.</p>
  </main>
</body>
</html>"""
        self.send_response(503)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(html.encode("utf-8"))

    def do_POST(self):
        origin = self.headers.get("Origin")
        if origin and origin != "http://" + self.headers.get("Host", ""):
            return self.reply({"error": "Недопустимый источник запроса"}, 403)
        if urlparse(self.path).path.startswith("/api/admin/cover/"):
            return self.upload_cover()
        try:
            size = int(self.headers.get("Content-Length", 0))
            if size > 65536:
                raise ValueError("Слишком большой запрос")
            body = json.loads(self.rfile.read(size) or b"{}")
            if not isinstance(body, dict):
                raise ValueError("Неверный формат запроса")
            with connect() as db:
                result, cookie = self.mutate(db, urlparse(self.path).path, body)
            self.reply(result, cookie=cookie)
        except PermissionError as error:
            self.reply({"error": str(error)}, 403)
        except (ValueError, KeyError, TypeError) as error:
            self.reply({"error": str(error) or "Проверьте введённые данные"}, 400)
        except sqlite3.IntegrityError:
            self.reply(
                {"error": "Этот email уже зарегистрирован или данные некорректны"}, 409
            )

    def upload_cover(self):
        try:
            with connect() as db:
                user = self.user(db)
                if not user or user["role"] != "admin":
                    raise PermissionError("Загружать обложки может только администратор")
                record_id = int(urlparse(self.path).path.rsplit("/", 1)[1])
                record = db.execute(
                    "SELECT * FROM records WHERE id=? AND active=1", (record_id,)
                ).fetchone()
                if not record:
                    return self.reply({"error": "Пластинка не найдена"}, 404)
                size = int(self.headers.get("Content-Length", 0))
                if not 0 < size <= MAX_UPLOAD_BYTES:
                    return self.reply({"error": "Максимальный размер обложки — 5 МБ"}, 413)
                save_cover(self.rfile.read(size), record_id, covers.UPLOAD_DIR)
                return self.reply(cover_info(dict(record)))
        except PermissionError as error:
            return self.reply({"error": str(error)}, 403)
        except ValueError as error:
            return self.reply({"error": str(error)}, 400)
        except OSError:
            return self.reply({"error": "Не удалось сохранить обложку"}, 500)

    def mutate(self, db, path, b):
        user = self.user(db)
        if path in ["/api/register", "/api/login"]:
            email = str(b.get("email", "")).strip().lower()
            password = str(b.get("password", ""))
            if path.endswith("register"):
                name = str(b.get("name", "")).strip()
                if (
                    not 2 <= len(name) <= 80
                    or "@" not in email
                    or len(email) > 200
                    or not 8 <= len(password) <= 200
                ):
                    raise ValueError(
                        "Укажите имя, корректный email и пароль от 8 до 200 символов"
                    )
                role = b.get("role", "customer")
                if role not in ["customer", "admin"]:
                    raise ValueError("Неизвестная роль")
                if role == "admin" and not hmac.compare_digest(
                    str(b.get("invite", "")), INVITE
                ):
                    raise PermissionError("Неверный код приглашения администратора")
                uid = db.execute(
                    "INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)",
                    (name, email, password_hash(password), role),
                ).lastrowid
            else:
                row = db.execute(
                    "SELECT * FROM users WHERE email=?", (email,)
                ).fetchone()
                if (
                    len(password) > 200
                    or not row
                    or not hmac.compare_digest(
                        row["password"],
                        password_hash(password, row["password"].split(":")[0]),
                    )
                ):
                    raise ValueError("Неверный email или пароль")
                uid = row["id"]
            token = secrets.token_urlsafe(32)
            db.execute("DELETE FROM sessions WHERE expires<?", (time.time(),))
            db.execute(
                "INSERT INTO sessions VALUES(?,?,?)", (token, uid, time.time() + 604800)
            )
            return {
                "ok": True
            }, f"session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800"
        if path == "/api/logout":
            cookie = SimpleCookie(self.headers.get("Cookie", ""))
            if "session" in cookie:
                db.execute(
                    "DELETE FROM sessions WHERE token=?", (cookie["session"].value,)
                )
            return {
                "ok": True
            }, "session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"
        if not user:
            raise PermissionError("Для этого действия войдите в аккаунт")
        if path == "/api/favorite":
            rid = int(b["id"])
            if not db.execute(
                "SELECT id FROM records WHERE id=? AND active=1", (rid,)
            ).fetchone():
                raise ValueError("Пластинка не найдена")
            if db.execute(
                "SELECT 1 FROM favorites WHERE user_id=? AND record_id=?",
                (user["id"], rid),
            ).fetchone():
                db.execute(
                    "DELETE FROM favorites WHERE user_id=? AND record_id=?",
                    (user["id"], rid),
                )
            else:
                db.execute("INSERT INTO favorites VALUES(?,?)", (user["id"], rid))
        elif path == "/api/orders":
            address, phone = (
                str(b.get("address", "")).strip(),
                str(b.get("phone", "")).strip(),
            )
            if (
                not 10 <= len(address) <= 500
                or not 10 <= len("".join(filter(str.isdigit, phone))) <= 15
                or len(phone) > 40
            ):
                raise ValueError("Укажите полный адрес (от 10 символов) и телефон")
            items = b.get("items", [])
            if not isinstance(items, list) or not 1 <= len(items) <= 100:
                raise ValueError("Корзина пуста или слишком велика")
            db.execute("BEGIN IMMEDIATE")
            lines, seen, total = [], set(), 0
            for item in items:
                rid, qty = int(item["id"]), int(item["quantity"])
                r = db.execute(
                    "SELECT * FROM records WHERE id=? AND active=1", (rid,)
                ).fetchone()
                if rid in seen or not r or not 1 <= qty <= r["stock"]:
                    raise ValueError(
                        "Недостаточно пластинок на складе. Обновите корзину"
                    )
                seen.add(rid)
                total += r["price"] * qty
                lines.append((rid, r["artist"] + " — " + r["title"], r["price"], qty))
            oid = db.execute(
                "INSERT INTO orders(user_id,total,address,phone) VALUES(?,?,?,?)",
                (user["id"], total, address, phone),
            ).lastrowid
            for rid, title, price, qty in lines:
                db.execute(
                    "INSERT INTO order_items VALUES(?,?,?,?,?)",
                    (oid, rid, title, price, qty),
                )
                db.execute("UPDATE records SET stock=stock-? WHERE id=?", (qty, rid))
            return {"ok": True, "id": oid}, None
        elif path.startswith("/api/admin/"):
            if user["role"] != "admin":
                raise PermissionError("Доступ только для администратора")
            if path == "/api/admin/record":
                fields = [
                    str(b.get(k, "")).strip() for k in ["artist", "title", "genre"]
                ]
                if any(not v or len(v) > 120 for v in fields):
                    raise ValueError("Заполните исполнителя, название и жанр")
                year, price, stock, cover = [
                    int(b[k]) for k in ["year", "price", "stock", "cover"]
                ]
                if (
                    not 1900 <= year <= 2100
                    or not 1 <= price <= 1000000
                    or not 0 <= stock <= 10000
                    or not 0 <= cover <= 11
                ):
                    raise ValueError("Проверьте год, цену, остаток и обложку")
                description = str(b.get("description", "")).strip()
                if not 1 <= len(description) <= 3000:
                    raise ValueError("Добавьте описание до 3000 символов")
                values = (*fields, year, price, stock, description, cover)
                if b.get("id"):
                    record_id = int(b["id"])
                    if not db.execute("SELECT 1 FROM records WHERE id=? AND active=1", (record_id,)).fetchone():
                        raise ValueError("Пластинка не найдена")
                    db.execute(
                        "UPDATE records SET"
                        " artist=?,title=?,genre=?,year=?,price=?,stock=?,description=?,cover=?"
                        " WHERE id=?",
                        (*values, int(b["id"])),
                    )
                else:
                    cursor = db.execute(
                        "INSERT INTO"
                        " records(artist,title,genre,year,price,stock,description,cover)"
                        " VALUES(?,?,?,?,?,?,?,?)",
                        values,
                    )
                    record_id = cursor.lastrowid
                return {"ok": True, "id": record_id}, None
            elif path == "/api/admin/delete":
                db.execute("UPDATE records SET active=0 WHERE id=?", (int(b["id"]),))
            elif path == "/api/admin/status":
                status = b.get("status")
                if status not in STATUSES:
                    raise ValueError("Неизвестный статус")
                db.execute("BEGIN IMMEDIATE")
                order = db.execute(
                    "SELECT * FROM orders WHERE id=?", (int(b["id"]),)
                ).fetchone()
                if not order:
                    raise ValueError("Заказ не найден")
                if (
                    order["status"] in ["Отменён", "Завершён"]
                    and status != order["status"]
                ):
                    raise ValueError("Этот заказ уже закрыт")
                if status == "Отменён" and order["status"] != status:
                    for line in db.execute(
                        "SELECT * FROM order_items WHERE order_id=?", (order["id"],)
                    ).fetchall():
                        db.execute(
                            "UPDATE records SET stock=stock+? WHERE id=?",
                            (line["quantity"], line["record_id"]),
                        )
                db.execute(
                    "UPDATE orders SET status=? WHERE id=?", (status, order["id"])
                )
            else:
                raise ValueError("Неизвестное действие")
        else:
            raise ValueError("Неизвестное действие")
        return {"ok": True}, None


def main():
    init()
    port = int(os.environ.get("PORT", "8000"))
    print(f"VINYL ROOM: http://localhost:{port}", flush=True)
    print(f"Код регистрации администратора: {INVITE}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
