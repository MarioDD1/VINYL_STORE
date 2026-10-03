import { Link, useParams } from "react-router-dom";
import { useStore } from "../app/StoreContext";
import AlbumCard, { Cover } from "../components/AlbumCard";
import { money } from "../api/client";

export default function AlbumPage() {
  const { id } = useParams();
  const store = useStore();
  const record = store.records.find((r) => String(r.id) === id);
  if (!record)
    return (
      <section className="page">
        <h2>Пластинка не найдена</h2>
        <Link to="/catalog">Вернуться в каталог</Link>
      </section>
    );
  const similar = store.records
    .filter((r) => r.id !== record.id && r.genre === record.genre)
    .slice(0, 4);
  return (
    <section className="page">
      <Link className="back-link" to="/catalog">
        ← Каталог
      </Link>
      <div className="album-detail">
        <Cover record={record} />
        <div>
          <p className="eyebrow">
            {record.genre} · {record.year} · LP
          </p>
          <h1>{record.artist}</h1>
          <h2>{record.title}</h2>
          <p>{record.description}</p>
          <p>Винил · 180 г · 12″ · 33⅓ об/мин</p>
          <p>
            {record.has_cover ? "Обложка альбома" : "Временная иллюстрация обложки"}
          </p>
          <div className="price">{money(record.price)}</div>
          <p>{record.stock ? `В наличии: ${record.stock} шт.` : "Нет в наличии"}</p>
          <div className="actions">
            <button
              className="button dark"
              disabled={!record.stock}
              onClick={() => store.add(record)}
            >
              В корзину +
            </button>
            <button className="button" onClick={() => store.favorite(record.id)}>
              {store.favorites.includes(record.id) ? "♥ В избранном" : "♡ В избранное"}
            </button>
          </div>
          <p className="muted">Самовывоз — бесплатно. Оплата при получении.</p>
        </div>
      </div>
      {!!similar.length && (
        <>
          <h2>На похожей частоте</h2>
          <div className="record-grid">
            {similar.map((r) => (
              <AlbumCard record={r} key={r.id} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
