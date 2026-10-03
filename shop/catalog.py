"""Дополнительные альбомы. Цены и остатки — учебные данные."""

EXTRA_ALBUMS = [
    (
        'Radiohead',
        'In Rainbows',
        'Рок',
        2007,
        4990,
        7,
        'Гитарные фактуры, электроника и выразительный вокал.',
        1,
    ),
    (
        'Radiohead',
        'OK Computer',
        'Рок',
        1997,
        5190,
        6,
        'Атмосферный альтернативный рок с электронными экспериментами.',
        6,
    ),
    (
        'Fleet Foxes',
        'Helplessness Blues',
        'Фолк',
        2011,
        4490,
        8,
        'Акустические инструменты и многоголосные гармонии.',
        3,
    ),
    (
        'Fleet Foxes',
        'Shore',
        'Фолк',
        2020,
        4790,
        5,
        'Светлые мелодии и просторные фолк-аранжировки.',
        7,
    ),
    (
        'Norah Jones',
        'Come Away With Me',
        'Джаз',
        2002,
        4290,
        10,
        'Мягкое фортепиано, джаз и камерные песни.',
        0,
    ),
    (
        'Norah Jones',
        'Feels Like Home',
        'Джаз',
        2004,
        4190,
        8,
        'Тёплый вокал на пересечении джаза, фолка и кантри.',
        4,
    ),
    (
        'Norah Jones',
        'Not Too Late',
        'Джаз',
        2007,
        3990,
        6,
        'Спокойные авторские песни и акустическое звучание.',
        9,
    ),
    (
        'Norah Jones',
        'The Fall',
        'Поп',
        2009,
        4090,
        7,
        'Гитарные аранжировки и новое прочтение камерной поп-музыки.',
        11,
    ),
]


def add_extra_albums(db):
    # Миграция выполняется один раз; не восстанавливает удалённые товары.
    db.execute("CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY)")
    migration = "catalog_expansion_2026_10"
    if db.execute("SELECT 1 FROM migrations WHERE name=?", (migration,)).fetchone():
        return
    for album in EXTRA_ALBUMS:
        exists = db.execute(
            "SELECT 1 FROM records WHERE artist=? AND title=?", album[:2]
        ).fetchone()
        if not exists:
            db.execute(
                "INSERT INTO records "
                "(artist,title,genre,year,price,stock,description,cover) "
                "VALUES(?,?,?,?,?,?,?,?)", album
            )
    db.execute("INSERT INTO migrations VALUES(?)", (migration,))
