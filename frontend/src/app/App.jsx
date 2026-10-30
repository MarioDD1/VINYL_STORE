import { Header, Footer } from "../components/Design";
import { useEffect } from "react";
import { Link, Routes, Route, useLocation, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  useEffect(() => {
    if (location.hash)
      requestAnimationFrame(() =>
        document.getElementById(location.hash.slice(1))?.scrollIntoView(),
      );
    else window.scrollTo(0, 0);
  }, [location.pathname, location.hash, store.loading]);
  return (
    <>
      <Header />
      <main>
        {location.pathname !== "/" && !location.pathname.startsWith("/albums/") && <button className={`page-back ${location.pathname === "/catalog" ? "on-banner" : ""}`} onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate(location.pathname === "/catalog" ? "/" : "/catalog")}>← Назад</button>}
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
      <Footer />
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
