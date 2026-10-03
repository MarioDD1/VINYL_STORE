import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import { useStore } from "../app/StoreContext";
import AlbumCard from "../components/AlbumCard";

export default function CatalogPage({ favorites = false }) {
  const store = useStore();
  const [params, setParams] = useSearchParams();
  const [expanded, setExpanded] = useState(false);
  const genre = params.get("genre") || "";
  const query = params.get("q") || "";
  const sort = params.get("sort") || "default";
  function update(key, value) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next, { replace: true });
  }
  let records = store.records.filter(
    (r) =>
      (!genre || r.genre === genre) &&
      (!favorites || store.favorites.includes(r.id)) &&
      `${r.artist} ${r.title}`.toLowerCase().includes(query.toLowerCase().trim()),
  );
  if (sort === "price-up") records.sort((a, b) => a.price - b.price);
  if (sort === "price-down") records.sort((a, b) => b.price - a.price);
  if (sort === "year") records.sort((a, b) => b.year - a.year);
  if (favorites && !store.user)
    return (
      <section className="page">
        <h2>Ваше избранное</h2>
        <button className="button" onClick={() => store.setAuthOpen(true)}>
          Войти в аккаунт
        </button>
      </section>
    );
  return (
    <section className="catalog" id="catalog">
      <div className="section-heading">
        <div>
          <p className="eyebrow">ВКЛЮЧАЙТЕ. СЛУШАЙТЕ. ВЛЮБЛЯЙТЕСЬ.</p>
          <h2>
            {favorites ? "Ваше избранное" : "На вашей частоте"} <span>↘</span>
          </h2>
        </div>
        <span className="catalog-total">Найдено: {records.length}</span>
      </div>
      <div className="catalog-toolbar">
        <div className="search">
          <span>⌕</span>
          <input
            type="search"
            aria-label="Поиск пластинок"
            placeholder="Исполнитель или название альбома"
            value={query}
            onChange={(e) => update("q", e.target.value)}
          />
        </div>
        <select
          aria-label="Сортировка"
          value={sort}
          onChange={(e) => update("sort", e.target.value)}
        >
          <option value="default">Выбор магазина</option>
          <option value="price-up">Сначала дешевле</option>
          <option value="price-down">Сначала дороже</option>
          <option value="year">Сначала новее</option>
        </select>
      </div>
      <div className="filters">
        {["", ...new Set(store.records.map((r) => r.genre))].map((g) => (
          <button
            key={g}
            className={g === genre ? "selected" : ""}
            onClick={() => update("genre", g)}
          >
            {g || "Все пластинки"}
          </button>
        ))}
      </div>
      <div className="record-grid">
        {(expanded ? records : records.slice(0, 8)).map((record) => (
          <AlbumCard key={record.id} record={record} />
        ))}
        {!records.length && (
          <div className="empty">Пластинки не найдены. Измените поиск или фильтр.</div>
        )}
      </div>
      {!expanded && records.length > 8 && (
        <button className="button more" onClick={() => setExpanded(true)}>
          Показать все пластинки ↓
        </button>
      )}
    </section>
  );
}
