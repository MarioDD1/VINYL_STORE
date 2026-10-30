import { Link } from "react-router-dom";
import { useStore } from "../app/StoreContext";
import AlbumCard from "../components/AlbumCard";
import { DesignIcon, Genres, Radio, homeAssets as a } from "../components/Design";
export default function HomePage() {
  const { records } = useStore();
  const popular = records.slice(0, 3);
  const newest = [...records].sort((x, y) => y.year - x.year).slice(0, 3);
  return (
    <>
      <section className="spin-hero">
        <div className="hero-photo">
          <img
            src={a.imgFrame125}
            alt="Меломаны слушают винил среди любимых альбомов"
          />
        </div>
        <div className="hero-brand">
          <div>
            <DesignIcon src={a.imgVector} />
            <strong>SPIN</strong>
            <p>Эксклюзивные и популярные пластинки со всего мира</p>
          </div>
          <Link to="/catalog">Каталог</Link>
        </div>
        <h1>Give it a spin</h1>
      </section>
      <section className="collection-panel" id="popular">
        <div className="collection-heading">
          <h2>Популярное</h2>
          <Link to="/catalog" aria-label="Все популярные пластинки">
            <DesignIcon className="section-arrow" src={a.imgAkarIconsArrowDown} />
          </Link>
        </div>
        <div className="record-grid featured">
          {popular.map((record) => (
            <AlbumCard key={record.id} record={record} />
          ))}
        </div>
      </section>
      <section className="collection-panel" id="new">
        <div className="collection-heading reversed">
          <h2>Новинки</h2>
          <Link to="/catalog?sort=year" aria-label="Все новинки">
            <DesignIcon
              className="section-arrow reverse"
              src={a.imgAkarIconsArrowDown1}
            />
          </Link>
        </div>
        <div className="record-grid featured">
          {newest.map((record) => (
            <AlbumCard key={record.id} record={record} />
          ))}
        </div>
      </section>
      <section className="spin-about" id="about">
        <div>
          <h2>
            Give it
            <br />a spin
          </h2>
          <strong>
            Мы создаем пространство для меломанов, коллекционеров и всех, кто считает,
            что некоторые вещи лучше звучат на виниле
          </strong>
          <p>
            Мы собираем культовые альбомы, редкие находки и пластинки, которые давно
            хотелось добавить в коллекцию. Здесь можно найти любимых исполнителей,
            открыть для себя что-то новое или просто хорошо провести время выбирая, что
            послушать сегодня.
          </p>
          <p>
            Мы любим музыку во всех её проявлениях и считаем, что винил — это ещё один
            способ получать от неё удовольствие.
          </p>
          <Link className="button white" to="/catalog">
            Перейти в каталог
          </Link>
        </div>
        <DesignIcon className="about-mascot" src={a.imgImage11Vectorized} />
      </section>
      <section className="collection-panel" id="genres">
        <div className="collection-heading">
          <h2>Жанры</h2>
          <Link to="/catalog" aria-label="Все жанры">
            <DesignIcon className="section-arrow" src={a.imgAkarIconsArrowDown2} />
          </Link>
        </div>
        <Genres />
      </section>
      <Radio />
    </>
  );
}
