import { Link, useParams } from "react-router-dom";
import { useStore } from "../app/StoreContext";
import AlbumCard, { Cover } from "../components/AlbumCard";
import { DesignIcon, Radio, albumAssets as a } from "../components/Design";
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
  const similar = [
    ...store.records.filter((r) => r.id !== record.id && r.genre === record.genre),
    ...store.records.filter((r) => r.id !== record.id && r.genre !== record.genre),
  ].slice(0, 4);
  return (
    <div className="product-page">
      <section className="product-top">
        <Link className="back-link" to="/catalog">
          ← Каталог
        </Link>
        <div className="album-detail">
          <Cover record={record} />
          <div className="product-info">
            <div className="product-tools">
              <span className="product-format">LP · {record.year}</span>
              <button
                className="plain-button"
                aria-label="Поделиться альбомом"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    store.notify("Ссылка скопирована");
                  } catch {
                    store.notify("Ссылка на альбом: " + window.location.href);
                  }
                }}
              >
                <DesignIcon src={a.imgBasilShareSolid} />
              </button>
              <button
                className="plain-button"
                aria-label="В избранное"
                aria-pressed={store.favorites.includes(record.id)}
                onClick={() => store.favorite(record.id)}
              >
                {store.favorites.includes(record.id) ? (
                  <DesignIcon src="/design/heart-saved.svg" />
                ) : (
                  <DesignIcon src={a.imgGroup3} />
                )}
              </button>
            </div>
            <h1>{record.title}</h1>
            <h2>{record.artist}</h2>
            <p>{record.description}</p>
            <div className="product-buy">
              <span className="price">{money(record.price)}</span>
              <button
                className="button"
                disabled={!record.stock}
                onClick={() => store.add(record)}
              >
                В корзину <DesignIcon src={a.imgVector1} />
              </button>
            </div>
            <small>
              {record.stock ? `В наличии: ${record.stock} шт.` : "Нет в наличии"}
            </small>
          </div>
        </div>
        <div className="specifications">
          <h2>Характеристики</h2>
          <dl>
            {[
              ["Исполнитель", record.artist],
              ["Альбом", record.title],
              ["Год выпуска", record.year],
              ["Жанр", record.genre],
              ["Носитель", "Виниловая пластинка"],
              ["Получение", "Самовывоз"],
            ].map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <Radio key={record.id} record={record} />
      {!!similar.length && (
        <section className="collection-panel related">
          <h2>Похожие альбомы</h2>
          <div className="record-grid">
            {similar.map((r) => (
              <AlbumCard record={r} key={r.id} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
