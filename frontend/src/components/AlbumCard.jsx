import { Link } from "react-router-dom";
import { useStore } from "../app/StoreContext";
import { money } from "../api/client";

export function Cover({ record, ...props }) {
  const fallback = `/covers/${record.cover}.svg`;
  return (
    <img
      {...props}
      src={record.cover_url || fallback}
      alt={`Обложка ${record.artist} — ${record.title}`}
      onError={(event) => {
        if (event.currentTarget.getAttribute("src") !== fallback)
          event.currentTarget.src = fallback;
      }}
    />
  );
}

export default function AlbumCard({ record }) {
  const store = useStore();
  const saved = store.favorites.includes(record.id);
  return (
    <article className="album">
      <div className="cover-wrap">
        <Link
          className="cover-open"
          to={`/albums/${record.id}`}
          aria-label={`Подробнее: ${record.artist} — ${record.title}`}
        >
          <Cover record={record} loading="lazy" />
        </Link>
        <button
          className={`heart ${saved ? "saved" : ""}`}
          aria-pressed={saved}
          aria-label={saved ? "Убрать из избранного" : "В избранное"}
          onClick={() => store.favorite(record.id)}
        >
          {saved ? "♥" : "♡"}
        </button>
        <span className="format-tag">LP · 180 G</span>
      </div>
      <div className="album-meta">
        <span>{record.genre}</span>
        <span>{record.year}</span>
      </div>
      <Link className="album-title" to={`/albums/${record.id}`}>
        {record.artist}
      </Link>
      <div className="album-name">{record.title}</div>
      <div className="album-bottom">
        <span className="price">{money(record.price)}</span>
        <button
          className="add"
          disabled={!record.stock}
          onClick={() => store.add(record)}
        >
          {record.stock ? "В корзину +" : "Нет в наличии"}
        </button>
      </div>
    </article>
  );
}
