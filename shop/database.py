import hashlib
import secrets
import sqlite3
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "shop.sqlite3"


@contextmanager
def connect():
    db = sqlite3.connect(DB)
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
    DB.parent.mkdir(exist_ok=True)
    with connect() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL
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
