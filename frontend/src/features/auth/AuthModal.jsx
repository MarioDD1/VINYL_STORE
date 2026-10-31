import { useState } from "react";
import { api } from "../../api/client";
import { useStore } from "../../app/StoreContext";
import Modal from "../../components/Modal";

export default function AuthModal() {
  const store = useStore();
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("customer");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (mode === "verify") {
        await api("verify-email", { email, code: data.code });
        await store.refresh();
        store.setAuthOpen(false);
        store.notify("Почта подтверждена. Добро пожаловать в VINYL ROOM");
      } else if (mode === "register") {
        const result = await api("register", data);
        setEmail(result.email);
        setMode("verify");
        store.notify("Код подтверждения отправлен на почту");
      } else {
        await api("login", data);
        await store.refresh();
        store.setAuthOpen(false);
        store.notify("Добро пожаловать в VINYL ROOM");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    setBusy(true);
    setError("");
    try {
      await api("resend-verification", { email });
      store.notify("Новый код отправлен на почту");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Вход и регистрация" onClose={() => store.setAuthOpen(false)}>
      <p className="eyebrow">ВАША МУЗЫКА. ВАШ КАБИНЕТ.</p>
      <h2>
        {mode === "verify"
          ? "Подтвердите почту"
          : mode === "register"
            ? "Начнём вашу коллекцию"
            : "С возвращением"}
      </h2>
      {mode !== "verify" ? (
        <div className="tabs">
          <button
            type="button"
            className={mode === "login" ? "selected" : ""}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Вход
          </button>
          <button
            type="button"
            className={mode === "register" ? "selected" : ""}
            onClick={() => {
              setMode("register");
              setError("");
            }}
          >
            Регистрация
          </button>
        </div>
      ) : (
        <p>
          Мы отправили шестизначный код на <strong>{email}</strong>. Он действует
          15 минут.
        </p>
      )}
      <form onSubmit={submit} key={mode}>
        {mode === "register" && (
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
        {mode === "verify" ? (
          <>
            <label>
              Код из письма
              <input
                name="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                autoComplete="one-time-code"
                minLength={6}
                maxLength={6}
                required
              />
            </label>
            <button
              className="button dark"
              disabled={busy}
              type="submit"
            >
              {busy ? "Проверяем…" : "Подтвердить и завершить регистрацию"}
            </button>
            <button
              className="guest-button"
              disabled={busy}
              onClick={resendCode}
              type="button"
            >
              Отправить код повторно
            </button>
          </>
        ) : (
          <>
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
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                minLength={mode === "register" ? 8 : 1}
                maxLength={200}
                required
              />
            </label>
            {mode === "register" && (
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
            <button className="button dark" disabled={busy} type="submit">
              {busy ? "Подождите…" : mode === "register" ? "Продолжить" : "Войти"}
            </button>
          </>
        )}
        <div className="form-error" role="alert">
          {error}
        </div>
      </form>
      <button
        className="guest-button"
        onClick={() => store.setAuthOpen(false)}
        type="button"
      >
        Продолжить как гость
      </button>
    </Modal>
  );
}
