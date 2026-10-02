// Общие функции для элементов страницы, текста и цен.
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const money = (n) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";
const cover = (r) => `/covers/${r.cover}.svg`;
// Данные каталога и текущие настройки просмотра.
let state = { records: [], favorites: [], user: null };
let genre = "Все пластинки";
let favoriteOnly = false;
let expanded = false;
let cart = {};

try {
  const saved = JSON.parse(localStorage.getItem("vinyl-cart") || "{}");
  if (saved && typeof saved === "object" && !Array.isArray(saved)) {
    for (const [id, q] of Object.entries(saved)) {
      if (/^\d+$/.test(id) && Number.isInteger(q) && q > 0 && q <= 10000) {
        cart[id] = q;
      }
    }
  }
} catch {}

// Все обращения к серверу проходят через одну функцию.
async function api(path, body) {
  const res = await fetch(
    "/api/" + path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await res.json();
  if (!res.ok) {
    throw Error(data.error || "Ошибка запроса");
  }
  return data;
}
let toastTimer;

function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 3500);
}

function show(html) {
  $("#modal-content").innerHTML = html;
  if (!$("#modal").open) {
    $("#modal").showModal();
  }
  $("#modal").scrollTop = 0;
}

function close() {
  $("#modal").close();
}
$("#close-modal").onclick = close;
$("#modal").addEventListener("click", (e) => {
  if (e.target === $("#modal")) {
    const r = e.target.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    ) {
      close();
    }
  }
});

function persistCart() {
  try {
    localStorage.setItem("vinyl-cart", JSON.stringify(cart));
  } catch {}
  $("#cart-count").textContent = Object.values(cart).reduce((a, b) => a + b, 0);
}

async function refresh() {
  state = await api("state");
  $("#account span").textContent = state.user ? state.user.name.split(" ")[0] : "Войти";
  $("#favorite-count").textContent = state.favorites.length;
  persistCart();
  render();
}

// Каталог: фильтрация, сортировка и отображение карточек.
function render() {
  const genres = ["Все пластинки", ...new Set(state.records.map((r) => r.genre))];
  if (!genres.includes(genre)) {
    genre = genres[0];
  }
  $("#filters").innerHTML = genres
    .map(
      (g) => /* HTML */ `
        <button class="${genre === g ? "selected" : ""}" data-genre="${esc(g)}">
          ${esc(g)}
        </button>
      `,
    )
    .join("");
  const term = $("#search").value.trim().toLowerCase();
  let records = state.records.filter(
    (r) =>
      (genre === "Все пластинки" || r.genre === genre) &&
      (!favoriteOnly || state.favorites.includes(r.id)) &&
      `${r.artist} ${r.title}`.toLowerCase().includes(term),
  );
  const sort = $("#sort").value;
  if (sort === "price-up") {
    records.sort((a, b) => a.price - b.price);
  }
  if (sort === "price-down") {
    records.sort((a, b) => b.price - a.price);
  }
  if (sort === "year") {
    records.sort((a, b) => b.year - a.year);
  }
  $("#catalog-title").innerHTML =
    (favoriteOnly ? "Ваше избранное" : "На вашей частоте") +
    /* HTML */ `
      <span>↘</span>
    `;
  $("#catalog-total").textContent = `Найдено: ${records.length}`;
  $("#show-all").hidden = expanded || records.length <= 8;
  $("#records").innerHTML =
    (expanded ? records : records.slice(0, 8))
      .map(
        (r) => /* HTML */ `
          <article class="album">
            <div class="cover-wrap">
              <button
                class="cover-open"
                data-detail="${r.id}"
                aria-label="Подробнее: ${esc(r.artist)} — ${esc(r.title)}"
              >
                <img
                  src="${cover(r)}"
                  alt="Арт-обложка ${esc(r.title)}"
                  loading="lazy"
                />
              </button>
              <button
                class="heart ${state.favorites.includes(r.id) ? "saved" : ""}"
                data-favorite="${r.id}"
                aria-label="${state.favorites.includes(r.id) ? "Убрать из избранного" : "В избранное"}"
                aria-pressed="${state.favorites.includes(r.id)}"
              >
                ${state.favorites.includes(r.id) ? "♥" : "♡"}
              </button>
              <span class="format-tag">LP · 180 G</span>
            </div>
            <div class="album-meta">
              <span>${esc(r.genre)}</span>
              <span>${r.year}</span>
            </div>
            <button class="album-title" data-detail="${r.id}">${esc(r.artist)}</button>
            <div class="album-name">${esc(r.title)}</div>
            <div class="album-bottom">
              <span class="price">${money(r.price)}</span>
              <button class="add" data-add="${r.id}" ${!r.stock ? "disabled" : ""}>
                ${r.stock ? "В корзину +" : "Нет в наличии"}
              </button>
            </div>
          </article>
        `,
      )
      .join("") ||
    /* HTML */ `
      <div class="empty">
        Здесь пока нет пластинок.
        <br />
        Попробуйте другой поиск или добавьте альбомы в избранное.
      </div>
    `;
}
$("#filters").onclick = (e) => {
  const b = e.target.closest("[data-genre]");
  if (b) {
    genre = b.dataset.genre;
    render();
  }
};
$("#search").oninput = render;
$("#sort").onchange = render;
$("#show-all").onclick = () => {
  expanded = true;
  render();
};
$("#favorites-nav").onclick = () => {
  if (!state.user) {
    return auth();
  }
  favoriteOnly = !favoriteOnly;
  render();
  $("#catalog").scrollIntoView({ behavior: "smooth" });
};
document.querySelector('nav a[href="#catalog"]').onclick = () => {
  favoriteOnly = false;
  genre = "Все пластинки";
  render();
};
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-detail],[data-favorite],[data-add]");
  if (!b) {
    return;
  }
  try {
    if (b.dataset.detail) {
      detail(+b.dataset.detail);
    }
    if (b.dataset.favorite) {
      if (!state.user) {
        return auth();
      }
      await api("favorite", { id: +b.dataset.favorite });
      await refresh();
    }
    if (b.dataset.add) {
      if (!state.user) {
        return auth();
      }
      const r = state.records.find((r) => r.id === +b.dataset.add);
      if ((cart[r.id] || 0) >= r.stock) {
        return toast("Достигнут доступный остаток");
      }
      cart[r.id] = (cart[r.id] || 0) + 1;
      persistCart();
      toast("Пластинка добавлена в корзину");
    }
  } catch (err) {
    toast(err.message);
  }
});

function detail(id) {
  const r = state.records.find((r) => r.id === id);
  show(/* HTML */ `
    <div class="detail">
      <img src="${cover(r)}" alt="Арт-обложка ${esc(r.title)}" />
      <div>
        <p class="eyebrow">${esc(r.genre)} · ${r.year} · LP</p>
        <h2>${esc(r.artist)}</h2>
        <p>${esc(r.title)}</p>
        <p>${esc(r.description)}</p>
        <div class="price">${money(r.price)}</div>
        <div class="stock">
          ${r.stock ? "В наличии: " + r.stock + " шт." : "Нет в наличии"}
        </div>
        <button
          class="button dark full"
          data-add="${r.id}"
          ${!r.stock ? "disabled" : ""}
        >
          В корзину +
        </button>
        <p>
          Винил 180 г · 12″ · 33⅓ об/мин
          <br />
          Авторская иллюстрация обложки.
        </p>
      </div>
    </div>
  `);
}

// Вход и регистрация в общем модальном окне.
function auth(register = false) {
  show(/* HTML */ `
    <p class="eyebrow">ВАША МУЗЫКА. ВАШ КАБИНЕТ.</p>
    <h2>${register ? "Начнём вашу коллекцию" : "С возвращением"}</h2>
    <p>Войдите, чтобы покупать пластинки и сохранять любимые альбомы.</p>
    <div class="tabs">
      <button id="login-tab" class="${!register ? "selected" : ""}">Вход</button>
      <button id="register-tab" class="${register ? "selected" : ""}">
        Регистрация
      </button>
    </div>
    <form id="auth-form">
      ${
        register
          ? /* HTML */ `
              <label>
                Ваше имя
                <input
                  name="name"
                  autocomplete="name"
                  minlength="2"
                  maxlength="80"
                  required
                />
              </label>
            `
          : ""
      }
      <label>
        Email
        <input
          name="email"
          type="email"
          autocomplete="email"
          maxlength="200"
          required
        />
      </label>
      <label>
        Пароль
        <input
          name="password"
          type="password"
          autocomplete="${register ? "new-password" : "current-password"}"
          minlength="${register ? 8 : 1}"
          maxlength="200"
          required
          placeholder="${register ? "Не менее 8 символов" : "Ваш пароль"}"
        />
      </label>
      ${
        register
          ? /* HTML */ `
              <label>
                Тип аккаунта
                <select name="role" id="role">
                  <option value="customer">Покупатель</option>
                  <option value="admin">Администратор</option>
                </select>
              </label>
              <label id="invite-label" hidden>
                Код приглашения
                <input
                  name="invite"
                  autocomplete="off"
                  placeholder="Код из терминала сервера"
                />
              </label>
            `
          : ""
      }
      <div class="form-error" role="alert"></div>
      <button class="button dark" type="submit">
        ${register ? "Создать аккаунт" : "Войти"} ↗
      </button>
    </form>
    <button class="guest-button" id="guest">Продолжить как гость</button>
  `);
  $("#login-tab").onclick = () => auth(false);
  $("#register-tab").onclick = () => auth(true);
  $("#guest").onclick = close;
  if (register) {
    $("#role").onchange = () => {
      $("#invite-label").hidden = $("#role").value !== "admin";
      $("#invite-label input").required = $("#role").value === "admin";
    };
  }
  bindForm("#auth-form", async (data) => {
    await api(register ? "register" : "login", data);
    await refresh();
    close();
    toast("Добро пожаловать в VINYL ROOM");
  });
}

function bindForm(selector, action) {
  $(selector).onsubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget,
      button = form.querySelector('[type="submit"]');
    button.disabled = true;
    form.querySelector(".form-error").textContent = "";
    try {
      await action(Object.fromEntries(new FormData(form)));
    } catch (err) {
      form.querySelector(".form-error").textContent = err.message;
    } finally {
      button.disabled = false;
    }
  };
}
$("#account").onclick = () => (state.user ? profile() : auth());

// Личный кабинет и действия, доступные текущей роли.
function profile() {
  show(/* HTML */ `
    <p class="eyebrow">
      ${state.user.role === "admin" ? "АДМИНИСТРАТОР" : "ЛИЧНЫЙ КАБИНЕТ"}
    </p>
    <h2>Привет, ${esc(state.user.name)}</h2>
    <p>${esc(state.user.email)}</p>
    <div class="profile-actions">
      <button class="button dark" id="my-orders">
        ${state.user.role === "admin" ? "Все заказы магазина" : "Мои заказы"} ↗
      </button>
      ${
        state.user.role === "admin"
          ? /* HTML */ `
              <button class="button" id="manage">Управление каталогом</button>
            `
          : ""
      }
      <button class="button" id="my-favorites">Моё избранное</button>
      <button class="guest-button" id="logout">Выйти из аккаунта</button>
    </div>
  `);
  $("#my-orders").onclick = () => orders();
  if ($("#manage")) {
    $("#manage").onclick = admin;
  }
  $("#my-favorites").onclick = () => {
    favoriteOnly = true;
    render();
    close();
    $("#catalog").scrollIntoView();
  };
  $("#logout").onclick = async () => {
    try {
      await api("logout", {});
      cart = {};
      favoriteOnly = false;
      await refresh();
      close();
      toast("Вы вышли из аккаунта");
    } catch (e) {
      toast(e.message);
    }
  };
}
$("#cart-button").onclick = showCart;

function cartLines() {
  return Object.entries(cart).map(([id, quantity]) => ({
    record: state.records.find((r) => r.id === +id),
    id: +id,
    quantity,
  }));
}

// Корзина и оформление заказа.
function showCart() {
  const lines = cartLines();
  const total = lines.reduce(
    (sum, line) => sum + (line.record?.price || 0) * line.quantity,
    0,
  );
  show(/* HTML */ `
    <p class="eyebrow">ВАША БУДУЩАЯ КОЛЛЕКЦИЯ</p>
    <h2>
      Корзина
      <span class="muted">(${lines.length})</span>
    </h2>
    ${
      lines.length
        ? lines
            .map(
              (l) => /* HTML */ `
                <div class="cart-line">
                  ${
                    l.record
                      ? /* HTML */ `
                          <img src="${cover(l.record)}" alt="" />
                        `
                      : ""
                  }
                  <div class="line-info">
                    <strong>
                      ${l.record ? esc(l.record.artist) : "Пластинка недоступна"}
                    </strong>
                    <small>
                      ${l.record ? esc(l.record.title) : "Удалите её из корзины"}
                    </small>
                    <p>
                      ${l.record ? money(l.record.price) : "—"}
                      ${
                        l.record && l.quantity > l.record.stock
                          ? " · Недостаточно на складе"
                          : ""
                      }
                    </p>
                  </div>
                  <div class="quantity">
                    <button
                      data-qty="${l.id}"
                      data-delta="-1"
                      aria-label="Уменьшить количество"
                    >
                      −
                    </button>
                    <span>${l.quantity}</span>
                    <button
                      data-qty="${l.id}"
                      data-delta="1"
                      aria-label="Увеличить количество"
                      ${!l.record || l.quantity >= l.record.stock ? "disabled" : ""}
                    >
                      +
                    </button>
                  </div>
                  <button
                    class="remove"
                    data-remove="${l.id}"
                    aria-label="Удалить из корзины"
                  >
                    ×
                  </button>
                </div>
              `,
            )
            .join("") +
          /* HTML */ `
            <div class="total">
              <span>Итого</span>
              <span>${money(total)}</span>
            </div>
            <p>
              Самовывоз — бесплатно. Оплата при получении.
              <br />
              Учебный магазин: реальная оплата и доставка не выполняются.
            </p>
            <button
              class="button dark full"
              id="checkout"
              ${lines.some((l) => !l.record || l.quantity > l.record.stock) ? "disabled" : ""}
            >
              Оформить заказ ↗
            </button>
          `
        : /* HTML */ `
            <div class="empty">
              Пока здесь тихо.
              <br />
              Добавьте первую пластинку из каталога.
            </div>
            <button class="button full" id="continue">Перейти в каталог</button>
          `
    }
  `);
  document.querySelectorAll("[data-qty]").forEach(
    (b) =>
      (b.onclick = () => {
        cart[b.dataset.qty] += +b.dataset.delta;
        if (cart[b.dataset.qty] <= 0) {
          delete cart[b.dataset.qty];
        }
        persistCart();
        showCart();
      }),
  );
  document.querySelectorAll("[data-remove]").forEach(
    (b) =>
      (b.onclick = () => {
        delete cart[b.dataset.remove];
        persistCart();
        showCart();
      }),
  );
  if ($("#checkout")) {
    $("#checkout").onclick = () => (state.user ? checkout() : auth());
  }
  if ($("#continue")) {
    $("#continue").onclick = () => {
      close();
      $("#catalog").scrollIntoView();
    };
  }
}

function checkout() {
  show(/* HTML */ `
    <p class="eyebrow">ПОЧТИ В ВАШИХ РУКАХ</p>
    <h2>Оформление заказа</h2>
    <p>
      Укажите контактные данные. Оплата при получении, самовывоз — бесплатно. Это
      учебный магазин.
    </p>
    <form id="checkout-form">
      <label>
        Телефон
        <input
          name="phone"
          type="tel"
          autocomplete="tel"
          placeholder="+7 999 123-45-67"
          maxlength="40"
          required
        />
      </label>
      <label>
        Город и адрес для связи
        <textarea
          name="address"
          autocomplete="street-address"
          minlength="10"
          maxlength="500"
          placeholder="Город, улица, дом, квартира"
          required
        ></textarea>
      </label>
      <div class="form-error" role="alert"></div>
      <button class="button dark" type="submit">Подтвердить заказ ↗</button>
    </form>
  `);
  bindForm("#checkout-form", async (data) => {
    const result = await api("orders", {
      ...data,
      items: cartLines().map((l) => ({ id: l.id, quantity: l.quantity })),
    });
    cart = {};
    persistCart();
    await refresh();
    show(/* HTML */ `
      <p class="eyebrow">СПАСИБО ЗА ВЫБОР</p>
      <h2>Заказ №${result.id} оформлен ✳</h2>
      <p>Статус и состав заказа доступны в личном кабинете. Оплата — при получении.</p>
      <button class="button dark full" id="success-orders">Мои заказы</button>
    `);
    $("#success-orders").onclick = () => orders();
  });
}

async function orders() {
  try {
    const list = await api("orders");
    show(/* HTML */ `
      <p class="eyebrow">
        ${state.user.role === "admin" ? "УПРАВЛЕНИЕ МАГАЗИНОМ" : "ЛИЧНЫЙ КАБИНЕТ"}
      </p>
      <h2>${state.user.role === "admin" ? "Заказы магазина" : "Мои заказы"}</h2>
      ${
        list.length
          ? list
              .map(
                (o) => /* HTML */ `
                  <article class="order">
                    <div class="order-heading">
                      <strong>Заказ №${o.id} · ${money(o.total)}</strong>
                      <span class="status">${esc(o.status)}</span>
                    </div>
                    <p>
                      ${new Date(o.created.replace(" ", "T") + "Z").toLocaleString("ru-RU")}
                    </p>
                    ${o.items
                      .map(
                        (i) => /* HTML */ `
                          <p>
                            ${esc(i.title)} × ${i.quantity} —
                            ${money(i.price * i.quantity)}
                          </p>
                        `,
                      )
                      .join("")}
                    <p>
                      ${esc(o.name)} · ${esc(o.phone)}
                      <br />
                      ${esc(o.address)}
                    </p>
                    ${
                      state.user.role === "admin"
                        ? /* HTML */ `
                            <label>
                              Статус заказа
                              <select
                                data-status="${o.id}"
                                ${["Отменён", "Завершён"].includes(o.status) ? "disabled" : ""}
                              >
                                ${[
                                  "Новый",
                                  "В обработке",
                                  "Отправлен",
                                  "Завершён",
                                  "Отменён",
                                ]
                                  .map(
                                    (s) => /* HTML */ `
                                      <option ${s === o.status ? "selected" : ""}>
                                        ${s}
                                      </option>
                                    `,
                                  )
                                  .join("")}
                              </select>
                            </label>
                          `
                        : ""
                    }
                  </article>
                `,
              )
              .join("")
          : /* HTML */ `
              <div class="empty">
                Заказов пока нет. Ваша первая пластинка ждёт в каталоге.
              </div>
            `
      }
    `);
    document.querySelectorAll("[data-status]").forEach(
      (s) =>
        (s.onchange = async () => {
          s.disabled = true;
          try {
            await api("admin/status", { id: +s.dataset.status, status: s.value });
            await refresh();
            await orders();
            toast("Статус заказа обновлён");
          } catch (e) {
            toast(e.message);
            await orders();
          }
        }),
    );
  } catch (e) {
    toast(e.message);
  }
}

// Панель администратора: каталог и редактирование пластинок.
function admin() {
  show(/* HTML */ `
    <p class="eyebrow">АДМИНИСТРАТОР</p>
    <h2>Управление каталогом</h2>
    <p>
      ${state.records.length} пластинок · Остаток
      ${state.records.reduce((sum, r) => sum + r.stock, 0)} шт.
    </p>
    <button class="button dark full" id="new-record">Добавить пластинку +</button>
    <div class="admin-list">
      ${state.records
        .map(
          (r) => /* HTML */ `
            <div class="admin-row">
              <span>
                <b>${esc(r.artist)}</b>
                <br />
                ${esc(r.title)}
                <br />
                ${money(r.price)} · ${r.stock} шт.
              </span>
              <button data-edit="${r.id}">Изменить</button>
              <button data-delete="${r.id}">Удалить</button>
            </div>
          `,
        )
        .join("")}
    </div>
  `);
  $("#new-record").onclick = () => editRecord();
  document
    .querySelectorAll("[data-edit]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          editRecord(state.records.find((r) => r.id === +b.dataset.edit))),
    );
  document.querySelectorAll("[data-delete]").forEach(
    (b) =>
      (b.onclick = () => {
        const r = state.records.find((r) => r.id === +b.dataset.delete);
        show(/* HTML */ `
          <h2>Удалить пластинку?</h2>
          <p>
            ${esc(r.artist)} — ${esc(r.title)} исчезнет из каталога. История заказов
            сохранится.
          </p>
          <div class="tabs">
            <button id="cancel-delete">Отмена</button>
            <button id="confirm-delete" class="selected">Удалить</button>
          </div>
        `);
        $("#cancel-delete").onclick = admin;
        $("#confirm-delete").onclick = async () => {
          try {
            await api("admin/delete", { id: r.id });
            await refresh();
            admin();
            toast("Пластинка удалена");
          } catch (e) {
            toast(e.message);
          }
        };
      }),
  );
}

function editRecord(r = {}) {
  show(/* HTML */ `
    <p class="eyebrow">КАТАЛОГ</p>
    <h2>${r.id ? "Редактировать" : "Новая пластинка"}</h2>
    <form id="record-form">
      <label>
        Исполнитель
        <input name="artist" value="${esc(r.artist || "")}" maxlength="120" required />
      </label>
      <label>
        Название альбома
        <input name="title" value="${esc(r.title || "")}" maxlength="120" required />
      </label>
      <div class="form-grid">
        <label>
          Жанр
          <input
            name="genre"
            list="genres"
            value="${esc(r.genre || "Рок")}"
            maxlength="120"
            required
          />
          <datalist id="genres">
            <option>Рок</option>
            <option>Джаз</option>
            <option>Электроника</option>
            <option>Соул</option>
            <option>Поп</option>
          </datalist>
        </label>
        <label>
          Год
          <input
            type="number"
            name="year"
            min="1900"
            max="2100"
            value="${r.year || 2026}"
            required
          />
        </label>
        <label>
          Цена, ₽
          <input
            name="price"
            type="number"
            min="1"
            max="1000000"
            value="${r.price || 3000}"
            required
          />
        </label>
        <label>
          Остаток, шт.
          <input
            name="stock"
            type="number"
            min="0"
            max="10000"
            value="${r.stock ?? 1}"
            required
          />
        </label>
      </div>
      <label>
        Арт-обложка
        <select name="cover">
          ${Array.from(
            { length: 12 },
            (_, i) => /* HTML */ `
              <option value="${i}" ${i === r.cover ? "selected" : ""}>
                Дизайн ${i + 1}
              </option>
            `,
          ).join("")}
        </select>
      </label>
      <label>
        Описание
        <textarea name="description" maxlength="3000" required>
${esc(r.description || "")}</textarea>
      </label>
      <div class="form-error" role="alert"></div>
      <button class="button dark" type="submit">Сохранить пластинку</button>
    </form>
  `);
  bindForm("#record-form", async (data) => {
    await api("admin/record", { ...data, id: r.id });
    await refresh();
    admin();
    toast("Каталог обновлён");
  });
}
refresh().catch((e) => {
  $("#records").innerHTML = /* HTML */ `
    <div class="empty">
      Не удалось загрузить каталог. Убедитесь, что сервер запущен, и обновите страницу.
    </div>
  `;
  toast(e.message);
});
