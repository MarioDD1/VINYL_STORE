export async function api(path, data, options = {}) {
  const response = await fetch(`/api/${path}`, {
    credentials: "same-origin",
    ...(data === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
    ...options,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Не удалось выполнить запрос");
  return result;
}

export function uploadCover(id, file) {
  return api(`admin/cover/${id}`, undefined, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
}

export const money = (value) => new Intl.NumberFormat("ru-RU").format(value) + " ₽";
