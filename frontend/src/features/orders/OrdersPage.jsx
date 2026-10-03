import { useEffect, useState } from "react";
import { useStore } from "../../app/StoreContext";
import { api, money } from "../../api/client";

const statuses = ["Новый", "В обработке", "Отправлен", "Завершён", "Отменён"];
export default function OrdersPage() {
  const store = useStore();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);
  async function load() {
    setError("");
    try {
      setOrders(await api("orders"));
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    setOrders(null);
    if (store.user) load();
  }, [store.user?.id]);
  async function change(id, status) {
    setBusy(id);
    try {
      await api("admin/status", { id, status });
      await load();
      await store.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="page narrow">
      <h2>{store.user?.role === "admin" ? "Заказы магазина" : "Мои заказы"}</h2>
      {!store.user ? (
        <button className="button" onClick={() => store.setAuthOpen(true)}>
          Войти
        </button>
      ) : (
        <>
          {error && (
            <div role="alert">
              {error} <button onClick={load}>Повторить</button>
            </div>
          )}
          {!orders && !error && <p>Загрузка заказов…</p>}
          {orders?.length === 0 && <div className="empty">Заказов пока нет.</div>}
          {orders?.map((order) => (
            <article className="order" key={order.id}>
              <div className="order-heading">
                <strong>
                  Заказ №{order.id} · {money(order.total)}
                </strong>
                <span className="status">{order.status}</span>
              </div>
              <p>
                {new Date(order.created.replace(" ", "T") + "Z").toLocaleString(
                  "ru-RU",
                )}
              </p>
              {order.items.map((item) => (
                <p key={item.record_id}>
                  {item.title} × {item.quantity} — {money(item.price * item.quantity)}
                </p>
              ))}
              <p>
                {order.name} · {order.phone}
                <br />
                {order.address}
              </p>
              {store.user.role === "admin" && (
                <label>
                  Статус заказа
                  <select
                    value={order.status}
                    disabled={
                      busy === order.id ||
                      ["Отменён", "Завершён"].includes(order.status)
                    }
                    onChange={(e) => change(order.id, e.target.value)}
                  >
                    {statuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
              )}
            </article>
          ))}
        </>
      )}
    </section>
  );
}
