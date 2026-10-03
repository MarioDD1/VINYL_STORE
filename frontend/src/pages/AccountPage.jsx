import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../app/StoreContext";

export default function AccountPage() {
  const store = useStore();
  const navigate = useNavigate();
  if (!store.user)
    return (
      <section className="page">
        <h2>Личный кабинет</h2>
        <button className="button" onClick={() => store.setAuthOpen(true)}>
          Войти или зарегистрироваться
        </button>
      </section>
    );
  return (
    <section className="page narrow">
      <p className="eyebrow">
        {store.user.role === "admin" ? "АДМИНИСТРАТОР" : "ЛИЧНЫЙ КАБИНЕТ"}
      </p>
      <h2>Привет, {store.user.name}</h2>
      <p>{store.user.email}</p>
      <div className="profile-actions">
        <Link className="button dark" to="/orders">
          {store.user.role === "admin" ? "Все заказы магазина" : "Мои заказы"}
        </Link>
        <Link className="button" to="/favorites">
          Моё избранное
        </Link>
        {store.user.role === "admin" && (
          <Link className="button" to="/admin">
            Управление каталогом
          </Link>
        )}
        <button
          className="button"
          onClick={async () => {
            try {
              await store.logout();
              navigate("/");
            } catch (e) {
              store.notify(e.message);
            }
          }}
        >
          Выйти из аккаунта
        </button>
      </div>
    </section>
  );
}
