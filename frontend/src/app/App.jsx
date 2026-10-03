import { useEffect } from "react";
import { Link, Routes, Route, useLocation } from "react-router-dom";
import { useStore } from "./StoreContext";
import AuthModal from "../features/auth/AuthModal";
import HomePage from "../pages/HomePage";
import CatalogPage from "../pages/CatalogPage";
import AlbumPage from "../pages/AlbumPage";
import AccountPage from "../pages/AccountPage";
import CartPage from "../features/cart/CartPage";
import OrdersPage from "../features/orders/OrdersPage";
import AdminPage from "../features/admin/AdminPage";

export default function App() {
  const store = useStore();
  const location = useLocation();
  useEffect(() => {
    if (location.hash)
      requestAnimationFrame(() =>
        document.getElementById(location.hash.slice(1))?.scrollIntoView(),
      );
    else window.scrollTo(0, 0);
  }, [location.pathname, location.hash, store.loading]);
  return (
    <>
      <div className="announcement">
        НЕ ПРОСТО МУЗЫКА. ВАША КОЛЛЕКЦИЯ ИСТОРИЙ.<span>33⅓ RPM · EST. 2026</span>
      </div>
      <header>
        <Link className="brand" to="/" aria-label="Vinyl Room — главная">
          <span className="brand-disc">◉</span> VINYL<span>ROOM</span>
          <small>RECORD STORE</small>
        </Link>
        <nav>
          <Link to="/catalog">Каталог</Link>
          <Link to="/favorites">
            Избранное <span>{store.favorites.length}</span>
          </Link>
          <Link to="/#about">О магазине</Link>
        </nav>
        <div className="header-actions">
          {store.user ? (
            <Link to="/account">♙ {store.user.name.split(" ")[0]}</Link>
          ) : (
            <button className="icon-button" onClick={() => store.setAuthOpen(true)}>
              ♙ Войти
            </button>
          )}
          <Link className="cart-button" to="/cart">
            Корзина <b>{Object.values(store.cart).reduce((a, b) => a + b, 0)}</b>
          </Link>
        </div>
      </header>
      <main>
        {store.loading ? (
          <div className="page" role="status">
            Загружаем коллекцию…
          </div>
        ) : store.error ? (
          <div className="page" role="alert">
            {store.error}{" "}
            <button className="button" onClick={store.reload}>
              Повторить
            </button>
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/favorites" element={<CatalogPage favorites />} />
            <Route path="/albums/:id" element={<AlbumPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route
              path="*"
              element={
                <section className="page">
                  <h2>Страница не найдена</h2>
                  <Link to="/">На главную</Link>
                </section>
              }
            />
          </Routes>
        )}
      </main>
      <footer>
        <Link className="brand" to="/">
          ◉ VINYL<span>ROOM</span>
        </Link>
        <span>Музыка остаётся с вами.</span>
        <small>© 2026 VINYL ROOM · Учебный магазин</small>
      </footer>
      {store.authOpen && <AuthModal />}
      <div
        id="toast"
        role="status"
        aria-live="polite"
        className={store.notice ? "visible" : ""}
      >
        {store.notice}
      </div>
    </>
  );
}
