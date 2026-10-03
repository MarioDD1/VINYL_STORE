import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../../app/StoreContext";
import { api, money } from "../../api/client";
import { Cover } from "../../components/AlbumCard";

export default function CartPage() {
  const store = useStore();
  const [checkout, setCheckout] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState(null);
  const lines = Object.entries(store.cart).map(([id, quantity]) => ({
    id: Number(id),
    quantity,
    record: store.records.find((r) => r.id === Number(id)),
  }));
  function quantity(id, next) {
    store.setCart((previous) => {
      const copy = { ...previous };
      if (next <= 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api("orders", {
        ...Object.fromEntries(new FormData(event.currentTarget)),
        items: lines.map(({ id, quantity }) => ({ id, quantity })),
      });
      store.setCart({});
      setOrderId(result.id);
      await store.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (orderId)
    return (
      <section className="page">
        <h2>Заказ №{orderId} оформлен ✳</h2>
        <Link className="button" to="/orders">
          Мои заказы
        </Link>
      </section>
    );
  return (
    <section className="page narrow">
      <h2>Корзина ({lines.length})</h2>
      {!lines.length ? (
        <div className="empty">
          Корзина пуста. <Link to="/catalog">Выбрать пластинку →</Link>
        </div>
      ) : (
        <>
          {lines.map(({ id, record, quantity: count }) => (
            <div className="cart-line" key={id}>
              {record && <Cover record={record} />}
              <div className="line-info">
                <strong>{record?.artist || "Пластинка недоступна"}</strong>
                <small>{record?.title}</small>
                <p>
                  {record ? money(record.price) : "Удалите товар из корзины"}
                  {record && count > record.stock ? " · Недостаточно на складе" : ""}
                </p>
              </div>
              <div className="quantity">
                <button
                  disabled={busy}
                  onClick={() => quantity(id, count - 1)}
                  aria-label="Уменьшить количество"
                >
                  −
                </button>
                <span>{count}</span>
                <button
                  disabled={busy || !record || count >= record.stock}
                  onClick={() => quantity(id, count + 1)}
                  aria-label="Увеличить количество"
                >
                  +
                </button>
              </div>
              <button
                className="remove"
                disabled={busy}
                onClick={() => quantity(id, 0)}
                aria-label="Удалить из корзины"
              >
                ×
              </button>
            </div>
          ))}
          <div className="total">
            <span>Итого</span>
            <span>
              {money(
                lines.reduce(
                  (total, l) => total + (l.record?.price || 0) * l.quantity,
                  0,
                ),
              )}
            </span>
          </div>
          <p>
            Самовывоз — бесплатно. Оплата при получении. Учебный магазин: реальные
            платежи и доставка не выполняются.
          </p>
          {checkout && store.user ? (
            <form className="surface" onSubmit={submit}>
              <label>
                Телефон
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  maxLength={40}
                />
              </label>
              <label>
                Город и адрес для связи
                <textarea
                  name="address"
                  autoComplete="street-address"
                  minLength={10}
                  maxLength={500}
                  required
                />
              </label>
              <div className="form-error" role="alert">
                {error}
              </div>
              <button
                className="button dark"
                disabled={
                  busy || lines.some((l) => !l.record || l.quantity > l.record.stock)
                }
              >
                {busy ? "Оформляем…" : "Подтвердить заказ"}
              </button>
            </form>
          ) : (
            <button
              className="button dark"
              disabled={lines.some((l) => !l.record || l.quantity > l.record.stock)}
              onClick={() => {
                if (store.requireUser()) setCheckout(true);
              }}
            >
              Оформить заказ ↗
            </button>
          )}
        </>
      )}
    </section>
  );
}
