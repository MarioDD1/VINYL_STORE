import { useState } from "react";
import { Link } from "react-router-dom";
import { api, money } from "../../api/client";
import { useStore } from "../../app/StoreContext";
import RecordEditor from "./RecordEditor";
import Modal from "../../components/Modal";

export default function AdminPage() {
  const store = useStore();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  if (store.user?.role !== "admin")
    return (
      <section className="page">
        <h2>Доступ только для администратора</h2>
        {!store.user && (
          <button className="button" onClick={() => store.setAuthOpen(true)}>
            Войти
          </button>
        )}
      </section>
    );
  async function remove() {
    setBusy(true);
    try {
      await api("admin/delete", { id: deleting.id });
      await store.refresh();
      setDeleting(null);
    } catch (e) {
      store.notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page">
      <p className="eyebrow">АДМИНИСТРАТОР</p>
      <h2>Управление каталогом</h2>
      <div className="actions">
        <button className="button dark" onClick={() => setEditing({})}>
          Добавить пластинку +
        </button>
        <Link className="button" to="/orders">
          Заказы магазина
        </Link>
      </div>
      <p>
        {store.records.length} пластинок · Остаток:{" "}
        {store.records.reduce((n, r) => n + r.stock, 0)} шт.
      </p>
      {store.records.map((r) => (
        <div className="admin-row" key={r.id}>
          <span>
            <b>{r.artist}</b>
            <br />
            {r.title}
            <br />
            {money(r.price)} · {r.stock} шт.
          </span>
          <button onClick={() => setEditing(r)}>Изменить</button>
          <button onClick={() => setDeleting(r)}>Удалить</button>
        </div>
      ))}
      {editing && (
        <RecordEditor
          key={editing.id || "new"}
          record={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <Modal title="Удалить пластинку" onClose={() => !busy && setDeleting(null)}>
          <h2>Удалить пластинку?</h2>
          <p>
            {deleting.artist} — {deleting.title}. История заказов сохранится.
          </p>
          <button className="button dark" disabled={busy} onClick={remove}>
            Удалить
          </button>
        </Modal>
      )}
    </section>
  );
}
