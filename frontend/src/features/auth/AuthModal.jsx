import { useState } from "react";
import { api } from "../../api/client";
import { useStore } from "../../app/StoreContext";
import Modal from "../../components/Modal";

export default function AuthModal() {
  const store = useStore();
  const [register, setRegister] = useState(false);
  const [role, setRole] = useState("customer");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        register ? "register" : "login",
        Object.fromEntries(new FormData(event.currentTarget)),
      );
      await store.refresh();
      store.setAuthOpen(false);
      store.notify("Добро пожаловать в VINYL ROOM");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Вход и регистрация" onClose={() => store.setAuthOpen(false)}>
      <p className="eyebrow">ВАША МУЗЫКА. ВАШ КАБИНЕТ.</p>
      <h2>{register ? "Начнём вашу коллекцию" : "С возвращением"}</h2>
      <div className="tabs">
        <button
          className={!register ? "selected" : ""}
          onClick={() => {
            setRegister(false);
            setError("");
          }}
        >
          Вход
        </button>
        <button
          className={register ? "selected" : ""}
          onClick={() => {
            setRegister(true);
            setError("");
          }}
        >
          Регистрация
        </button>
      </div>
      <form onSubmit={submit} key={String(register)}>
        {register && (
          <label>
            Ваше имя
            <input
              name="name"
              autoComplete="name"
              minLength={2}
              maxLength={80}
              required
            />
          </label>
        )}
        <label>
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            maxLength={200}
            required
          />
        </label>
        <label>
          Пароль
          <input
            name="password"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            minLength={register ? 8 : 1}
            maxLength={200}
            required
          />
        </label>
        {register && (
          <>
            <label>
              Тип аккаунта
              <select
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="customer">Покупатель</option>
                <option value="admin">Администратор</option>
              </select>
            </label>
            {role === "admin" && (
              <label>
                Код приглашения
                <input name="invite" required autoComplete="off" />
              </label>
            )}
          </>
        )}
        <div className="form-error" role="alert">
          {error}
        </div>
        <button className="button dark" disabled={busy}>
          {busy ? "Подождите…" : register ? "Создать аккаунт" : "Войти"}
        </button>
      </form>
      <button className="guest-button" onClick={() => store.setAuthOpen(false)}>
        Продолжить как гость
      </button>
    </Modal>
  );
}
