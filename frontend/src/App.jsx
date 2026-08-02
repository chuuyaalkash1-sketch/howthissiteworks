import { useEffect, useMemo, useState } from "react";
import { articles } from "./articles";
import "./styles.css";

function App() {
  const [selectedArticleId, setSelectedArticleId] = useState("overview");

  const [rating, setRating] = useState(389);
  const [ratingStatistics, setRatingStatistics] = useState({
    count: 0,
    average: null,
    minimum: 1,
    maximum: 777,
  });
  const [ratingMessage, setRatingMessage] = useState("");
  const [ratingLoading, setRatingLoading] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);

  const [authMode, setAuthMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(
    () => localStorage.getItem("access_token") ?? ""
  );
  const [currentUser, setCurrentUser] = useState(null);
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [myFiles, setMyFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);

  const selectedArticle = useMemo(() => {
    return (
      articles.find((article) => article.id === selectedArticleId) ??
      articles[0]
    );
  }, [selectedArticleId]);

  useEffect(() => {
    loadRatingStatistics();
  }, []);

  useEffect(() => {
    if (!token) {
      setCurrentUser(null);
      setMyFiles([]);
      return;
    }

    async function loadCurrentUser() {
      try {
        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await readJsonResponse(response);
        setCurrentUser(data);
      } catch (error) {
        console.error(error);
        localStorage.removeItem("access_token");
        setToken("");
        setCurrentUser(null);
        setMyFiles([]);
      }
    }

    loadCurrentUser();
  }, [token]);

  useEffect(() => {
    if (currentUser && token) {
      loadMyFiles();
    }
  }, [currentUser, token]);

  async function readJsonResponse(response) {
    const responseText = await response.text();
    let data = {};

    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Сервер ответил с кодом ${response.status}: ${responseText}`
        );
      }
    }

    if (!response.ok) {
      throw new Error(
        data.detail ?? `Ошибка запроса. HTTP ${response.status}`
      );
    }

    return data;
  }

  async function loadRatingStatistics() {
    try {
      const response = await fetch("/api/ratings");
      const data = await readJsonResponse(response);
      setRatingStatistics(data);
    } catch (error) {
      console.error(error);
      setRatingMessage("Не удалось получить рейтинг");
    }
  }

  async function submitRating(event) {
    event.preventDefault();

    const numericRating = Number(rating);

    if (!Number.isInteger(numericRating)) {
      setRatingMessage("Оценка должна быть целым числом");
      return;
    }

    if (numericRating < 1 || numericRating > 777) {
      setRatingMessage("Введите число от 1 до 777");
      return;
    }

    setRatingLoading(true);
    setRatingMessage("");

    try {
      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          value: numericRating,
        }),
      });

      const data = await readJsonResponse(response);

      if (data.statistics) {
        setRatingStatistics(data.statistics);
      } else {
        await loadRatingStatistics();
      }

      setRatingMessage(
        `Спасибо. Ваша оценка ${numericRating} из 777 сохранена`
      );
    } catch (error) {
      console.error(error);
      setRatingMessage(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить оценку"
      );
    } finally {
      setRatingLoading(false);
    }
  }

  async function submitAuth(event) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthMessage("");

    const endpoint =
      authMode === "register"
        ? "/api/auth/register"
        : "/api/auth/login";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await readJsonResponse(response);

      localStorage.setItem("access_token", data.access_token);
      setToken(data.access_token);
      setCurrentUser(data.user);
      setUsername("");
      setPassword("");

      setAuthMessage(
        authMode === "register"
          ? "Аккаунт создан"
          : "Вы успешно вошли"
      );
    } catch (error) {
      console.error(error);
      setAuthMessage(
        error instanceof Error
          ? error.message
          : "Не удалось выполнить вход"
      );
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("access_token");
    setToken("");
    setCurrentUser(null);
    setMyFiles([]);
    setSelectedFile(null);
    setAuthMessage("Вы вышли из аккаунта");
    setUploadMessage("");
  }

  async function loadMyFiles() {
    if (!token) {
      return;
    }

    setFilesLoading(true);

    try {
      const response = await fetch("/api/my-files", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await readJsonResponse(response);
      setMyFiles(data.files ?? []);
    } catch (error) {
      console.error(error);
      setUploadMessage(
        error instanceof Error
          ? error.message
          : "Не удалось загрузить список файлов"
      );
    } finally {
      setFilesLoading(false);
    }
  }

  async function submitFile(event) {
    event.preventDefault();

    const form = event.currentTarget;

    if (!currentUser || !token) {
      setUploadMessage("Сначала войдите в аккаунт");
      return;
    }

    if (!selectedFile) {
      setUploadMessage("Сначала выберите файл");
      return;
    }

    const maximumSize = 10 * 1024 * 1024;

    if (selectedFile.size > maximumSize) {
      setUploadMessage("Размер файла превышает 10 МБ");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    setUploadLoading(true);
    setUploadMessage("");

    try {
      const response = await fetch("/api/uploads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await readJsonResponse(response);
      const originalName =
        data.file?.original_name ?? selectedFile.name;

      setUploadMessage(
        `Файл «${originalName}» успешно отправлен`
      );

      setSelectedFile(null);
      form.reset();
      await loadMyFiles();
    } catch (error) {
      console.error(error);
      setUploadMessage(
        error instanceof Error
          ? error.message
          : "Не удалось отправить файл"
      );
    } finally {
      setUploadLoading(false);
    }
  }

  async function downloadFile(file) {
    try {
      const response = await fetch(
        `/api/my-files/${file.id}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        await readJsonResponse(response);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = file.original_name;
      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(objectUrl);
      setUploadMessage(`Файл «${file.original_name}» скачан`);
    } catch (error) {
      console.error(error);
      setUploadMessage(
        error instanceof Error
          ? error.message
          : "Не удалось скачать файл"
      );
    }
  }

  async function deleteFile(fileId) {
    const confirmed = window.confirm("Удалить этот файл?");

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/my-files/${fileId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      await readJsonResponse(response);
      await loadMyFiles();
      setUploadMessage("Файл удалён");
    } catch (error) {
      console.error(error);
      setUploadMessage(
        error instanceof Error
          ? error.message
          : "Не удалось удалить файл"
      );
    }
  }

  function navigateToArticle(articleId) {
    setSelectedArticleId(articleId);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <div className="site-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">W</div>

          <div>
            <div className="brand-title">Механика веба</div>
            <div className="brand-subtitle">рэп</div>
          </div>
        </div>

        <nav className="navigation" aria-label="Основная навигация">
          <p className="navigation-heading">Содержание</p>

          {articles.map((article) => (
            <button
              key={article.id}
              type="button"
              className={
                article.id === selectedArticleId
                  ? "navigation-link active"
                  : "navigation-link"
              }
              onClick={() => navigateToArticle(article.id)}
            >
              {article.shortTitle}
            </button>
          ))}
        </nav>

        <div className="sidebar-note">
          Этот сайт описывает свою работу.
        </div>
      </aside>

      <main className="main-content">
        <header className="top-bar">
          <span>Расширение знаний</span>
          <span>React + FastAPI + SQLite</span>
        </header>

        <article className="article">
          <header className="article-header">
            <h1>{selectedArticle.title}</h1>
            <p className="article-description">
              {selectedArticle.description}
            </p>
          </header>

          <div className="article-tools">
            <span>Статья</span>
            <span>Обсуждение</span>
            <span>Читать</span>
            <span>Исходный код</span>
          </div>

          <aside className="contents-box">
            <div className="contents-title">Содержание</div>

            <ol>
              {selectedArticle.sections.map((section) => (
                <li key={section.heading}>
                  <a href={`#${createAnchor(section.heading)}`}>
                    {section.heading}
                  </a>
                </li>
              ))}
            </ol>
          </aside>

          {selectedArticle.sections.map((section) => (
            <section
              className="article-section"
              id={createAnchor(section.heading)}
              key={section.heading}
            >
              <h2>{section.heading}</h2>

              {section.image && (
                <figure className="article-figure">
                  <img
                    src={section.image}
                    alt={section.imageAlt ?? section.heading}
                    className="article-image"
                  />

                  {section.imageCaption && (
                    <figcaption>{section.imageCaption}</figcaption>
                  )}
                </figure>
              )}

              {section.paragraphs.map((paragraph, index) => (
                <p key={`${section.heading}-${index}`}>
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </article>

        <section className="interactive-section">
          <div className="interactive-card">
            <h2>Оценить сайт</h2>

            <p>Выберите целое число от 1 до 777</p>

            <form onSubmit={submitRating}>
              <label htmlFor="rating-range">
                Honest reaction: <strong>{rating}</strong>
              </label>

              <input
                id="rating-range"
                type="range"
                min="1"
                max="777"
                value={rating}
                onChange={(event) =>
                  setRating(Number(event.target.value))
                }
              />

              <div className="range-labels">
                <span>1</span>
                <span>777</span>
              </div>

              <label htmlFor="rating-number">
                Точное значение
              </label>

              <input
                id="rating-number"
                className="number-input"
                type="number"
                min="1"
                max="777"
                step="1"
                value={rating}
                onChange={(event) => setRating(event.target.value)}
              />

              <button
                className="primary-button"
                type="submit"
                disabled={ratingLoading}
              >
                {ratingLoading ? "Сохраняем…" : "Отправить оценку"}
              </button>
            </form>

            <div className="statistics">
              <div>
                <span className="statistics-label">Средняя оценка</span>
                <strong>
                  {ratingStatistics.average === null
                    ? "пока нет"
                    : `${ratingStatistics.average} / 777`}
                </strong>
              </div>

              <div>
                <span className="statistics-label">Всего голосов</span>
                <strong>{ratingStatistics.count}</strong>
              </div>
            </div>

            {ratingMessage && (
              <p className="status-message">{ratingMessage}</p>
            )}
          </div>

          <div className="interactive-card auth-section">
            <h2>Личный кабинет</h2>

            {!currentUser ? (
              <>
                <div className="auth-switch">
                  <button
                    type="button"
                    className={
                      authMode === "login"
                        ? "primary-button"
                        : ""
                    }
                    onClick={() => {
                      setAuthMode("login");
                      setAuthMessage("");
                    }}
                  >
                    Вход
                  </button>

                  <button
                    type="button"
                    className={
                      authMode === "register"
                        ? "primary-button"
                        : ""
                    }
                    onClick={() => {
                      setAuthMode("register");
                      setAuthMessage("");
                    }}
                  >
                    Регистрация
                  </button>
                </div>

                <form onSubmit={submitAuth}>
                  <label htmlFor="auth-username">
                    Имя пользователя
                  </label>

                  <input
                    id="auth-username"
                    className="number-input"
                    type="text"
                    minLength="3"
                    maxLength="40"
                    value={username}
                    required
                    autoComplete="username"
                    onChange={(event) =>
                      setUsername(event.target.value)
                    }
                  />

                  <label htmlFor="auth-password">
                    Пароль
                  </label>

                  <input
                    id="auth-password"
                    className="number-input"
                    type="password"
                    minLength="8"
                    maxLength="128"
                    value={password}
                    required
                    autoComplete={
                      authMode === "register"
                        ? "new-password"
                        : "current-password"
                    }
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                  />

                  <button
                    className="primary-button"
                    type="submit"
                    disabled={authLoading}
                  >
                    {authLoading
                      ? "Подождите…"
                      : authMode === "register"
                        ? "Создать аккаунт"
                        : "Войти"}
                  </button>
                </form>
              </>
            ) : (
              <div>
                <p>
                  Вы вошли как{" "}
                  <strong>{currentUser.username}</strong>
                </p>

                <button
                  className="primary-button"
                  type="button"
                  onClick={logout}
                >
                  Выйти
                </button>
              </div>
            )}

            {authMessage && (
              <p className="status-message">{authMessage}</p>
            )}
          </div>

          <div className="interactive-card">
            <h2>Передать файл серверу</h2>

            <p>
              Файл будет отправлен через multipart и сохранён
              сервером. Максимальный размер - 10 МБ
            </p>

            {currentUser ? (
              <form onSubmit={submitFile}>
                <label
                  className="file-drop-zone"
                  htmlFor="file-input"
                >
                  <span className="file-icon">⇧</span>

                  <span>
                    {selectedFile
                      ? selectedFile.name
                      : "Нажмите, чтобы выбрать файл"}
                  </span>

                  <small>Любой тип файла, не более 10 МБ</small>
                </label>

                <input
                  id="file-input"
                  className="hidden-file-input"
                  type="file"
                  onChange={(event) => {
                    const file =
                      event.target.files?.[0] ?? null;
                    setSelectedFile(file);
                    setUploadMessage("");
                  }}
                />

                {selectedFile && (
                  <div className="selected-file">
                    <span>{selectedFile.name}</span>
                    <span>{formatBytes(selectedFile.size)}</span>
                  </div>
                )}

                <button
                  className="primary-button"
                  type="submit"
                  disabled={uploadLoading}
                >
                  {uploadLoading
                    ? "Отправляем…"
                    : "Отправить файл"}
                </button>
              </form>
            ) : (
              <p>Войдите в аккаунт, чтобы загружать файлы</p>
            )}

            {uploadMessage && (
              <p className="status-message">{uploadMessage}</p>
            )}

            <p className="privacy-warning">
              Отправляйте пароли, документы, банковские сведения!!!
              И другие конфиденциальные данные!
            </p>
          </div>

          {currentUser && (
            <div className="interactive-card my-files">
              <h2>Мои файлы</h2>

              {filesLoading ? (
                <p>Загрузка списка…</p>
              ) : myFiles.length === 0 ? (
                <p>Вы пока не загрузили ни одного файла</p>
              ) : (
                <ul>
                  {myFiles.map((file) => (
                    <li key={file.id}>
                      <span>
                        <strong>{file.original_name}</strong>
                        {typeof file.size === "number" && (
                          <> — {formatBytes(file.size)}</>
                        )}
                      </span>

                      <div>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => downloadFile(file)}
                        >
                          Скачать
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteFile(file.id)}
                        >
                          Удалить
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <footer className="footer">
          Учебный проект, спасибо чагпт
        </footer>
      </main>
    </div>
  );
}

function createAnchor(text) {
  return text
    .toLowerCase()
    .replaceAll(" ", "-")
    .replaceAll(/[^\p{L}\p{N}-]/gu, "");
}

function formatBytes(bytes) {
  if (bytes === 0) {
    return "0 Б";
  }

  const units = ["Б", "КБ", "МБ", "ГБ"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export default App;
