import { useEffect, useState } from "react";
import { api, uploadCover } from "../../api/client";
import { useStore } from "../../app/StoreContext";
import Modal from "../../components/Modal";
import { Cover } from "../../components/AlbumCard";

export default function RecordEditor({ record = {}, onClose }) {
  const store = useStore();
  const [savedId, setSavedId] = useState(record.id);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function choose(event) {
    const candidate = event.target.files[0];
    setError("");
    if (!candidate) {
      setFile(null);
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(candidate.type) ||
      candidate.size > 5 * 1024 * 1024
    ) {
      setError("Выберите JPG, PNG или WebP размером до 5 МБ.");
      event.target.value = "";
      setFile(null);
      return;
    }
    setFile(candidate);
  }
  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    let id = savedId;
    try {
      const result = await api("admin/record", {
        ...Object.fromEntries(new FormData(event.currentTarget)),
        id,
      });
      id = result.id;
      setSavedId(id);
      if (file) await uploadCover(id, file);
      await store.refresh();
      store.notify("Пластинка сохранена");
      onClose();
    } catch (e) {
      setError((id ? "Данные пластинки сохранены. " : "") + e.message);
      await store.refresh().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Редактирование пластинки"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <h2>{record.id ? "Редактировать пластинку" : "Новая пластинка"}</h2>
      <form onSubmit={submit}>
        <label>
          Исполнитель
          <input
            name="artist"
            defaultValue={record.artist || ""}
            maxLength={120}
            required
          />
        </label>
        <label>
          Название альбома
          <input
            name="title"
            defaultValue={record.title || ""}
            maxLength={120}
            required
          />
        </label>
        <div className="form-grid">
          <label>
            Жанр
            <input
              name="genre"
              defaultValue={record.genre || "Рок"}
              maxLength={120}
              required
            />
          </label>
          <label>
            Год
            <input
              name="year"
              type="number"
              min={1900}
              max={2100}
              defaultValue={record.year || new Date().getFullYear()}
              required
            />
          </label>
          <label>
            Цена, ₽
            <input
              name="price"
              type="number"
              min={1}
              max={1000000}
              defaultValue={record.price || 3000}
              required
            />
          </label>
          <label>
            Остаток
            <input
              name="stock"
              type="number"
              min={0}
              max={10000}
              defaultValue={record.stock ?? 1}
              required
            />
          </label>
        </div>
        <label>
          Описание
          <textarea
            name="description"
            defaultValue={record.description || ""}
            maxLength={3000}
            required
          />
        </label>
        <label>
          Запасная иллюстрация
          <select name="cover" defaultValue={record.cover || 0}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>
                Дизайн {i + 1}
              </option>
            ))}
          </select>
        </label>
        <label>
          Загрузить обложку
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={choose}
          />
        </label>
        <p className="muted">
          JPG, PNG или WebP, до 5 МБ. Рекомендуется квадрат 1000×1000. Имя файла может
          быть любым.
        </p>
        {preview ? (
          <img
            className="upload-preview"
            src={preview}
            alt="Предпросмотр новой обложки"
          />
        ) : (
          record.id && <Cover className="upload-preview" record={record} />
        )}
        <div className="form-error" role="alert">
          {error}
        </div>
        <button className="button dark" disabled={busy}>
          {busy ? "Сохранение…" : "Сохранить пластинку"}
        </button>
      </form>
    </Modal>
  );
}
