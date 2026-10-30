import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import { useStore } from "../app/StoreContext";
import AlbumCard from "../components/AlbumCard";
import { CatalogBanner, Genres, Radio } from "../components/Design";
export default function CatalogPage({ favorites = false }) {
  const store = useStore();
  const [params, setParams] = useSearchParams();
  const [limit, setLimit] = useState(24);
  const genre = params.get("genre") || "";
  const query = params.get("q") || "";
  const sort = params.get("sort") || "default";
  const stock = params.get("stock") === "1";
  function update(key, value) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next, { replace: true });
    setLimit(24);
  }
  const categories = ["Цветной винил", "Подарочные издания", "Русское", "Новые поступления", "Редкий винтаж", "Скидки", "CD", "Эксклюзивы"];
  const category = params.get("category") || "";
  const categoryMatches = (r) => {
    const description = `${r.description} ${(r.tags || []).join(" ")}`.toLowerCase();
    if (!category) return true;
    if (category === "Новые поступления") return r.id >= Math.max(...store.records.map(x => x.id)) - 11;
    const patterns = { "Цветной винил": /цветн|colou?r.*vinyl/, "Подарочные издания": /подароч|box set/, "Русское": /русск|russian/, "Редкий винтаж": /винтаж|vintage/, "Скидки": /скидк|sale/, "CD": /\bcd\b|компакт.диск/, "Эксклюзивы": /эксклюзив|exclusive/ };
    return patterns[category]?.test(description) || false;
  };
  const choices = (field) => [...new Set(store.records.map(r => r[field]))].sort((a,b) => String(a).localeCompare(String(b), "ru", {numeric:true}));
  let records = store.records.filter(
    (r) =>
      (!genre || r.genre === genre) && categoryMatches(r) &&
      (!params.get("artist") || r.artist === params.get("artist")) &&
      (!params.get("year") || String(r.year) === params.get("year")) &&
      (!params.get("title") || r.title === params.get("title")) &&
      (!params.get("price") || (params.get("price") === "low" ? r.price <= 3000 : params.get("price") === "mid" ? r.price > 3000 && r.price <= 5000 : r.price > 5000)) &&
      (!stock || r.stock > 0) &&
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
    <>
      {!favorites && <CatalogBanner />}
      <section className="catalog" id="catalog">
        <div className="section-heading">
          <h2>{favorites ? "Ваше избранное" : "Каталог"}</h2>
          <span className="catalog-total">Найдено: {records.length}</span>
        </div>
        <Genres compact value={genre} onChange={(value) => update("genre", value)} />
        <div className="edition-filters">{categories.map(name => <button key={name} aria-pressed={category === name} className={category === name ? "selected" : ""} onClick={() => update("category", category === name ? "" : name)}>{name}</button>)}</div>
        <div className="catalog-dropdowns">
          {[["genre", "Жанр"], ["artist", "Исполнитель"], ["year", "Год выпуска"]].map(([field, label]) => <select key={field} aria-label={label} value={params.get(field) || ""} onChange={e => update(field, e.target.value)}><option value="">{label}</option>{choices(field).map(value => <option key={value} value={value}>{value}</option>)}</select>)}
          <select aria-label="Наличие" value={stock ? "1" : ""} onChange={e => update("stock", e.target.value)}><option value="">Наличие</option><option value="1">В наличии</option></select>
          <select aria-label="Название" value={params.get("title") || ""} onChange={e => update("title", e.target.value)}><option value="">Название</option>{choices("title").map(value => <option key={value}>{value}</option>)}</select>
          <select aria-label="Цена" value={params.get("price") || ""} onChange={e => update("price", e.target.value)}><option value="">Цена</option><option value="low">До 3 000 ₽</option><option value="mid">3 001–5 000 ₽</option><option value="high">От 5 001 ₽</option></select>
          <label className="sort-label">≡ Сортировка: <select aria-label="Сортировка" value={sort} onChange={e => update("sort", e.target.value)}><option value="default">По умолчанию</option><option value="price-up">Сначала дешевле</option><option value="price-down">Сначала дороже</option><option value="year">Сначала новее</option></select></label>
        </div>
        <div className="catalog-toolbar"><div className="search"><span>⌕</span><input type="search" aria-label="Поиск пластинок" placeholder="Исполнитель или название альбома" value={query} onChange={e => update("q", e.target.value)} /></div><button className="reset-filters" onClick={() => {setParams({}, {replace:true});setLimit(24);}}>Все пластинки</button></div>
        <div className="record-grid">
          {records.slice(0, limit).map((record) => (
            <AlbumCard key={record.id} record={record} />
          ))}
          {!records.length && (
            <div className="empty">
              Пластинки не найдены. Измените поиск или фильтр.
            </div>
          )}
        </div>
        {records.length > limit && (
          <button className="button more" onClick={() => setLimit(limit + 30)}>
            Показать ещё {Math.min(30, records.length - limit)} позиций
          </button>
        )}
      </section>
      {!favorites && <Radio />}
    </>
  );
}
