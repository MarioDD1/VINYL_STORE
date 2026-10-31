import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../../app/StoreContext";
import { api, money } from "../../api/client";
import AlbumCard, { Cover } from "../../components/AlbumCard";
import { DesignIcon, cartAssets } from "../../components/Design";
export default function CartPage() {
  const store = useStore();
  const [checkout, setCheckout] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [orderId, setOrderId] = useState(null),
    [pointsToUse, setPointsToUse] = useState(0);
  const lines = Object.entries(store.cart).map(([id, quantity]) => ({
    id: Number(id),
    quantity,
    record: store.records.find((r) => r.id === Number(id)),
  }));
  const total = lines.reduce((sum, l) => sum + (l.record?.price || 0) * l.quantity, 0),
    count = lines.reduce((sum, l) => sum + l.quantity, 0);
  const maxPoints = Math.min(store.user?.points || 0, Math.floor(total * 0.3));
  const pointsUsed = Math.min(pointsToUse, maxPoints);
  const payable = total - pointsUsed;
  const unavailable = lines.some((l) => !l.record || l.quantity > l.record.stock);
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
        points_to_use: pointsUsed,
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
    <section className="cart-page">
      <h1>Корзина ({count})</h1>
      {!lines.length ? (
        <div className="empty">
          Корзина пуста. <Link to="/catalog">Выбрать пластинку →</Link>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-items">
            {lines.map(({ id, record, quantity: amount }) => (
              <div className="cart-line" key={id}>
                {record && <Cover record={record} />}
                <div className="line-info">
                  <strong>
                    {record ? (
                      <Link to={`/albums/${id}`}>{record.title}</Link>
                    ) : (
                      "Пластинка недоступна"
                    )}
                  </strong>
                  <small>{record?.artist}</small>
                  <p>{record ? "Виниловая пластинка" : "Удалите товар из корзины"}</p>
                  {record && amount > record.stock && (
                    <p role="alert">Недостаточно на складе</p>
                  )}
                </div>
                <span className="cart-line-price">{record && money(record.price)}</span>
                <div className="cart-line-actions">
                  <div className="quantity">
                    <button
                      disabled={busy}
                      onClick={() => quantity(id, amount - 1)}
                      aria-label="Уменьшить количество"
                    >
                      −
                    </button>
                    <span>{amount}</span>
                    <button
                      disabled={busy || !record || amount >= record.stock}
                      onClick={() => quantity(id, amount + 1)}
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
                    <DesignIcon src={cartAssets.imgTrash} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <aside className="cart-summary">
            <h2>Итог</h2>
            <div className="summary-line">
              <span>Товары ({count})</span>
              <b>{money(total)}</b>
            </div>
            <div className="summary-line">
              <span>Самовывоз</span>
              <b>Бесплатно</b>
            </div>
            {store.user && (
              <>
                <div className="summary-line">
                  <span>Ваш баланс</span>
                  <b>{store.user.points} баллов</b>
                </div>
                {maxPoints > 0 && (
                  <label>
                    Списать баллы (до {maxPoints})
                    <input
                      type="number"
                      min="0"
                      max={maxPoints}
                      step="1"
                      value={pointsUsed}
                      onChange={(event) =>
                        setPointsToUse(
                          Math.floor(
                            Math.max(
                              0,
                              Math.min(maxPoints, Number(event.target.value) || 0),
                            ),
                          ),
                        )
                      }
                      disabled={busy}
                    />
                  </label>
                )}
              </>
            )}
            {pointsUsed > 0 && (
              <div className="summary-line">
                <span>Скидка баллами</span>
                <b>−{money(pointsUsed)}</b>
              </div>
            )}
            <div className="total">
              <span>К оплате</span>
              <span>{money(payable)}</span>
            </div>
            {checkout && store.user ? (
              <form className="checkout-form" onSubmit={submit}>
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
                  className="button checkout-button"
                  disabled={busy || unavailable}
                >
                  {busy ? "Оформляем…" : "Подтвердить заказ"}
                </button>
              </form>
            ) : (
              <button
                className="button checkout-button"
                disabled={unavailable}
                onClick={() => {
                  if (store.requireUser()) setCheckout(true);
                }}
              >
                Оформить заказ
              </button>
            )}
            <p>Оплата при получении</p>
            <p>Учебный магазин — реальные платежи и доставка не выполняются.</p>
          </aside>
        </div>
      )}
      <section className="collection-panel related">
        <h2>Вам может понравиться</h2>
        <div className="record-grid">
          {store.records
            .filter((r) => !store.cart[r.id])
            .slice(0, 4)
            .map((record) => (
              <AlbumCard key={record.id} record={record} />
            ))}
        </div>
      </section>
    </section>
  );
}
