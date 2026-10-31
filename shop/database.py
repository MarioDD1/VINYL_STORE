from .catalog import add_extra_albums, add_genre_albums

import hashlib
import hmac
import os
import secrets
import shutil
import sqlite3 as standard_sqlite3
import tempfile
from contextlib import contextmanager
from pathlib import Path

try:
    from sqlcipher3 import dbapi2 as sqlite3
except ImportError as error:
    raise RuntimeError(
        "Установите зависимости из requirements.txt для работы с зашифрованной БД"
    ) from error

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "shop.sqlite3"
SQLITE_HEADER = b"SQLite format 3\x00"


def _encryption_key():
    key = os.environ.get("DB_ENCRYPTION_KEY", "")
    if len(key) != 64 or any(char not in "0123456789abcdefABCDEF" for char in key):
        raise RuntimeError(
            "Задайте DB_ENCRYPTION_KEY как 64 шестнадцатеричных символа "
            "(32 случайных байта)"
        )
    return key.lower()


def _apply_key(db, key):
    db.execute(f"""PRAGMA key = "x'{key}'" """)
    db.execute("PRAGMA cipher_memory_security = ON")


def _migrate_plaintext_database(key):
    source = standard_sqlite3.connect(DB)
    try:
        checkpoint = source.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone()
        if checkpoint and checkpoint[0]:
            raise RuntimeError("Не удалось синхронизировать WAL старой БД")
        source.execute("PRAGMA journal_mode=DELETE")
    finally:
        source.close()

    descriptor, temporary_name = tempfile.mkstemp(
        prefix=DB.name + ".", suffix=".encrypted", dir=DB.parent
    )
    os.close(descriptor)
    temporary = Path(temporary_name)
    backup = DB.with_name(DB.name + ".encrypted.bak")
    if backup.exists():
        temporary.unlink()
        raise RuntimeError(
            f"Файл резервной копии уже существует: {backup}. "
            "Переместите его перед повторной миграцией."
        )

    try:
        source = sqlite3.connect(DB)
        try:
            source.execute(
                f"ATTACH DATABASE ? AS encrypted KEY \"x'{key}'\"",
                (str(temporary),),
            )
            source.execute("SELECT sqlcipher_export('encrypted')")
            source.execute("DETACH DATABASE encrypted")
        finally:
            source.close()

        encrypted = sqlite3.connect(temporary)
        try:
            _apply_key(encrypted, key)
            check = encrypted.execute("PRAGMA integrity_check").fetchone()
            if not check or check[0] != "ok":
                raise RuntimeError("Проверка зашифрованной копии БД не пройдена")
        finally:
            encrypted.close()

        shutil.copy2(temporary, backup)
        os.replace(temporary, DB)
        for suffix in ("-wal", "-shm"):
            sidecar = Path(str(DB) + suffix)
            if sidecar.exists():
                sidecar.unlink()
    finally:
        if temporary.exists():
            temporary.unlink()


@contextmanager
def connect():
    key = _encryption_key()
    db = sqlite3.connect(DB, timeout=30)
    _apply_key(db, key)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    try:
        with db:
            yield db
    finally:
        db.close()


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), bytes.fromhex(salt), 260000
    ).hex()
    return salt + ":" + digest


def init():
    key = _encryption_key()
    DB.parent.mkdir(exist_ok=True)
    if DB.is_file():
        with DB.open("rb") as source:
            header = source.read(len(SQLITE_HEADER))
        if header == SQLITE_HEADER:
            _migrate_plaintext_database(key)
    with connect() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            email_verified INTEGER NOT NULL DEFAULT 1,
            points INTEGER NOT NULL DEFAULT 0 CHECK(points>=0)
        );
        CREATE TABLE IF NOT EXISTS pending_registrations (
            email TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            code_hash TEXT NOT NULL,
            expires REAL NOT NULL,
            sent_at REAL NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            expires REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS records (
            id INTEGER PRIMARY KEY,
            artist TEXT NOT NULL,
            title TEXT NOT NULL,
            genre TEXT NOT NULL,
            year INTEGER NOT NULL,
            price INTEGER NOT NULL CHECK(price>0),
            stock INTEGER NOT NULL CHECK(stock>=0),
            description TEXT NOT NULL,
            cover INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS favorites (
            user_id INTEGER REFERENCES users(id),
            record_id INTEGER REFERENCES records(id),
            PRIMARY KEY(user_id,record_id)
        );
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            created TEXT DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'Новый',
            total INTEGER NOT NULL,
            subtotal INTEGER NOT NULL DEFAULT 0,
            points_used INTEGER NOT NULL DEFAULT 0,
            points_earned INTEGER NOT NULL DEFAULT 0,
            address TEXT NOT NULL,
            phone TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS order_items (
            order_id INTEGER REFERENCES orders(id),
            record_id INTEGER REFERENCES records(id),
            title TEXT NOT NULL,
            price INTEGER NOT NULL,
            quantity INTEGER NOT NULL
        );
        """)
        _add_column(db, "users", "email_verified", "INTEGER NOT NULL DEFAULT 1")
        _add_column(db, "users", "points", "INTEGER NOT NULL DEFAULT 0")
        _add_column(db, "orders", "subtotal", "INTEGER NOT NULL DEFAULT 0")
        _add_column(db, "orders", "points_used", "INTEGER NOT NULL DEFAULT 0")
        _add_column(db, "orders", "points_earned", "INTEGER NOT NULL DEFAULT 0")
        db.execute(
            "UPDATE orders SET subtotal=total WHERE subtotal=0 AND points_used=0"
        )
        if not db.execute("SELECT 1 FROM records LIMIT 1").fetchone():
            rows = [
                (
                    "Miles Davis",
                    "Kind of Blue",
                    "Джаз",
                    1959,
                    4290,
                    12,
                    (
                        "Легендарная запись модального джаза. Тёплый звук, свободные"
                        " импровизации и музыка вне времени."
                    ),
                    0,
                ),
                (
                    "Pink Floyd",
                    "The Dark Side of the Moon",
                    "Рок",
                    1973,
                    5490,
                    8,
                    (
                        "Путешествие сквозь звук и пространство. Один из самых"
                        " узнаваемых альбомов прогрессивного рока."
                    ),
                    1,
                ),
                (
                    "Daft Punk",
                    "Random Access Memories",
                    "Электроника",
                    2013,
                    5990,
                    6,
                    (
                        "Аналоговое тепло, живые инструменты и французская электроника."
                        " Двойной винил для долгого вечера."
                    ),
                    2,
                ),
                (
                    "Fleetwood Mac",
                    "Rumours",
                    "Рок",
                    1977,
                    3890,
                    15,
                    (
                        "Искренние истории, безупречные мелодии и классический звук"
                        " семидесятых."
                    ),
                    3,
                ),
                (
                    "John Coltrane",
                    "Blue Train",
                    "Джаз",
                    1957,
                    4590,
                    7,
                    (
                        "Мощный саксофон и изящный хард-боп. Незаменимая запись в"
                        " джазовой коллекции."
                    ),
                    4,
                ),
                (
                    "The Weeknd",
                    "After Hours",
                    "Поп",
                    2020,
                    4790,
                    9,
                    (
                        "Неоновые синтезаторы и ночной город в одном альбоме."
                        " Современная поп-музыка с характером."
                    ),
                    5,
                ),
                (
                    "Nirvana",
                    "Nevermind",
                    "Рок",
                    1991,
                    4190,
                    10,
                    (
                        "Громкие гитары и энергия поколения. Знаковый альбом"
                        " альтернативной сцены."
                    ),
                    6,
                ),
                (
                    "Sade",
                    "Diamond Life",
                    "Соул",
                    1984,
                    3990,
                    11,
                    "Бархатный голос, утончённый соул и мягкое джазовое настроение.",
                    7,
                ),
                (
                    "Massive Attack",
                    "Mezzanine",
                    "Электроника",
                    1998,
                    5190,
                    5,
                    (
                        "Глубокий бас и гипнотический трип-хоп. Для внимательного"
                        " прослушивания после заката."
                    ),
                    8,
                ),
                (
                    "Amy Winehouse",
                    "Back to Black",
                    "Соул",
                    2006,
                    4490,
                    8,
                    "Винтажный соул и голос, который невозможно забыть.",
                    9,
                ),
                (
                    "David Bowie",
                    "Heroes",
                    "Рок",
                    1977,
                    4390,
                    4,
                    (
                        "Берлинский период: смелые эксперименты и большая музыкальная"
                        " история."
                    ),
                    10,
                ),
                (
                    "Dua Lipa",
                    "Future Nostalgia",
                    "Поп",
                    2020,
                    3790,
                    13,
                    "Диско, яркий бас и танцевальная энергия на каждый день.",
                    11,
                ),
            ]
            db.executemany(
                "INSERT INTO"
                " records(artist,title,genre,year,price,stock,description,cover)"
                " VALUES(?,?,?,?,?,?,?,?)",
                rows,
            )

        add_extra_albums(db)
        add_genre_albums(db)


def _add_column(db, table, column, definition):
    columns = {
        row["name"] for row in db.execute(f"PRAGMA table_info({table})").fetchall()
    }
    if column not in columns:
        db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def verification_code_hash(code, key=None):
    key = key or _encryption_key()
    pepper = hmac.new(bytes.fromhex(key), b"email-verification", hashlib.sha256)
    return hmac.new(pepper.digest(), code.encode(), hashlib.sha256).hexdigest()
