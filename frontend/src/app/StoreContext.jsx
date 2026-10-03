import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api } from "../api/client";

const Context = createContext(null);
export const useStore = () => useContext(Context);

function readCart() {
  try {
    const value = JSON.parse(localStorage.getItem("vinyl-cart") || "{}");
    return Object.fromEntries(
      Object.entries(value || {}).filter(
        ([id, count]) =>
          /^\d+$/.test(id) && Number.isInteger(count) && count > 0 && count <= 10000,
      ),
    );
  } catch {
    return {};
  }
}

export function StoreProvider({ children }) {
  const [state, setState] = useState({ user: null, records: [], favorites: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cart, setCart] = useState(readCart);
  const [authOpen, setAuthOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const timer = useRef();

  async function refresh() {
    const next = await api("state");
    setState(next);
    setError("");
    return next;
  }

  async function reload() {
    setLoading(true);
    try {
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    return () => clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("vinyl-cart", JSON.stringify(cart));
    } catch {}
  }, [cart]);

  function notify(message) {
    setNotice(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(""), 3500);
  }

  function requireUser() {
    if (state.user) return true;
    setAuthOpen(true);
    return false;
  }

  function add(record) {
    if (!requireUser()) return;
    if ((cart[record.id] || 0) >= record.stock)
      return notify("Достигнут доступный остаток");
    setCart((previous) => ({
      ...previous,
      [record.id]: (previous[record.id] || 0) + 1,
    }));
    notify("Пластинка добавлена в корзину");
  }

  async function favorite(id) {
    if (!requireUser()) return;
    try {
      await api("favorite", { id });
      await refresh();
    } catch (e) {
      notify(e.message);
    }
  }

  async function logout() {
    await api("logout", {});
    setCart({});
    await refresh();
  }

  return (
    <Context.Provider
      value={{
        ...state,
        loading,
        error,
        reload,
        refresh,
        cart,
        setCart,
        authOpen,
        setAuthOpen,
        requireUser,
        add,
        favorite,
        logout,
        notice,
        notify,
      }}
    >
      {children}
    </Context.Provider>
  );
}
