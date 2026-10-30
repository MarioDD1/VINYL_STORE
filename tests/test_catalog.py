import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from shop import database


class CatalogMigrationTests(unittest.TestCase):
    def test_expansion_is_idempotent_and_preserves_edits_and_deletions(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(database, "DB", Path(directory) / "shop.sqlite3"):
                database.init()
                with database.connect() as db:
                    self.assertEqual(db.execute("SELECT COUNT(*) FROM records").fetchone()[0], 56)
                    genres = {row[0] for row in db.execute("SELECT DISTINCT genre FROM records")}
                    self.assertTrue({"Классика", "Lo-fi", "Панк", "Кантри", "Инди", "Хип-хоп"} <= genres)
                    db.execute("UPDATE records SET price=1234,stock=2 WHERE artist='Max Richter'")
                    db.execute("UPDATE records SET active=0 WHERE artist='Clairo'")
                database.init()
                with database.connect() as db:
                    self.assertEqual(db.execute("SELECT COUNT(*) FROM records").fetchone()[0], 56)
                    self.assertEqual(tuple(db.execute("SELECT price,stock FROM records WHERE artist='Max Richter'").fetchone()), (1234, 2))
                    self.assertEqual(db.execute("SELECT active FROM records WHERE artist='Clairo'").fetchone()[0], 0)
