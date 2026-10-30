import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useStore } from "../app/StoreContext";
import assets from "../design-assets.json";
import genreIcons from "../genre-icons.json";
import { playlist } from "./Radio";
import SpinningRecord from "./SpinningRecord";
export const homeAssets = assets["70-251"];
export const catalogAssets = assets["70-549"];
export const albumAssets = assets["70-6"];
export const cartAssets = assets["70-1259"];

// Scale the containing layer, preserving the SVG's intrinsic dimensions.
export function DesignIcon({ src, className = "", label = "" }) {
  const ref = useRef(null);
  const [size, setSize] = useState(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    if (!size || !ref.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setScale(
        Math.min(
          entry.contentRect.width / size.width,
          entry.contentRect.height / size.height,
        ),
      ),
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [size]);
  return (
    <span ref={ref} className={`design-icon ${className}`}>
      <img
        src={src}
        alt={label}
        onLoad={(e) =>
          setSize({
            width: e.currentTarget.naturalWidth,
            height: e.currentTarget.naturalHeight,
          })
        }
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
      />
    </span>
  );
}
export function Header() {
  const store = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const home = location.pathname === "/";
  const light = home || location.pathname === "/catalog";
  const icons = light ? homeAssets : albumAssets;
  const [query, setQuery] = useState("");
  useEffect(
    () => setQuery(new URLSearchParams(location.search).get("q") || ""),
    [location.search],
  );
  const count = Object.values(store.cart).reduce((a, b) => a + b, 0);
  return (
    <header
      className={`site-header ${light ? "light" : ""} ${home ? "home-header" : ""}`}
    >
      {!home && (
        <Link to="/" className="header-logo" aria-label="SPIN — главная">
          <DesignIcon src={light ? catalogAssets.imgVector10 : albumAssets.imgVector} />
        </Link>
      )}
      <div className="header-actions">
        <form
          className="header-search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/catalog?q=${encodeURIComponent(query)}#catalog`);
          }}
        >
          <button type="submit" aria-label="Найти">
            <DesignIcon src={icons.imgAkarIconsSearch} />
          </button>
          <input
            aria-label="Поиск"
            placeholder="Поиск"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
        <Link
          className="header-circle"
          to="/favorites"
          aria-label={`Избранное (${store.favorites.length})`}
        >
          <DesignIcon
            key={store.favorites.length}
            className="favorite-feedback"
            src={icons.imgGroup}
          />
        </Link>
        {store.user ? (
          <Link className="header-circle" to="/account" aria-label="Мой аккаунт">
            <DesignIcon src={icons.imgBiPersonHeart} />
          </Link>
        ) : (
          <button
            className="header-circle"
            aria-label="Войти"
            onClick={() => store.setAuthOpen(true)}
          >
            <DesignIcon src={icons.imgBiPersonHeart} />
          </button>
        )}
        <Link
          className="header-circle cart-link"
          to="/cart"
          aria-label={`Корзина (${count})`}
        >
          <DesignIcon key={count} className="cart-feedback" src={icons.imgFrame82} />
          {count > 0 && <b>{count}</b>}
        </Link>
      </div>
    </header>
  );
}
const genreValue = (name) => name === "Электронная" ? "Электроника" : name;
const genres = genreIcons.map(({ name }) => genreValue(name));
export function Genres({ compact = false, value = "", onChange }) {
  const { records } = useStore();
  const availableGenres = [
    ...new Set([...(compact ? ["Рок", "Классика", "Lo-fi", "Панк", "Кантри", "Джаз", "Инди", "Хип-хоп"] : []), ...genres, ...records.map((record) => record.genre)]),
  ];
  return (
    <div className={`genre-tiles ${compact ? "compact" : ""}`}>
      {availableGenres.map((genre) => {
        const icon = genreIcons.find(({ name }) => genreValue(name) === genre);
        const content = (
          <>
            {icon ? (
              <DesignIcon src={icon.src} />
            ) : (
              <span className="genre-disc" aria-hidden="true">
                ♪
              </span>
            )}
            <span>{icon?.name || genre}</span>
          </>
        );
        return onChange ? (
          <button
            key={genre}
            aria-pressed={value === genre}
            onClick={() => onChange(value === genre ? "" : genre)}
          >
            {content}
          </button>
        ) : (
          <Link key={genre} to={`/catalog?genre=${encodeURIComponent(genre)}#catalog`}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}
export function CatalogBanner() {
  return (
    <section className="catalog-banner">
      <div>
        <h1>Каталог</h1>
        <p>
          Эксклюзивные и популярные виниловые
          <br />
          пластинки со всего мира
        </p>
        <a className="button white" href="#catalog">
          Перейти к каталогу
        </a>
      </div>
      <SpinningRecord src={catalogAssets.imgImage54} />
    </section>
  );
}
export { default as Radio } from "./Radio";
export function Footer() {
  return (
    <footer className="site-footer">
      <Link className="footer-brand" to="/" aria-label="SPIN — главная">
        <DesignIcon src={homeAssets.imgVector8} />
        <strong>SPIN</strong>
        <span>
          Эксклюзивные и популярные
          <br />
          пластинки со всего мира
        </span>
      </Link>
      <div>
        <h3>Каталог</h3>
        <Link to="/catalog">Все пластинки</Link>
        <Link to="/#popular">Популярное</Link>
        <Link to="/#new">Новинки</Link>
        <Link to="/#genres">Жанры</Link>
        <Link to="/favorites">Избранное</Link>
        <Link to="/orders">Мои заказы</Link>
      </div>
      <div>
        <h3>Радио</h3>
        {playlist.map(([, name]) => (
          <Link key={name} to="/#radio">
            {name}
          </Link>
        ))}
      </div>
    </footer>
  );
}
