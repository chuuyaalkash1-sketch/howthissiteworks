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

  const selectedArticle = useMemo(() => {
    return (
      articles.find((article) => article.id === selectedArticleId) ??
      articles[0]
    );
  }, [selectedArticleId]);

  useEffect(() => {
    loadRatingStatistics();
  }, []);


  async function loadRatingStatistics() {
    try {
      const response = await fetch("/api/ratings");

      if (!response.ok) {
        throw new Error("сервер не смог вернуть рейтинг");
      }

      const data = await response.json();
      setRatingStatistics(data);
    } catch (error) {
      console.error(error);
      setRatingMessage(
        "не удалось получить рейтинг. проверьте, запущен ли python-сервер"
      );
    }
  }
async function submitRating(event) {
    event.preventDefault();

    const numericRating = Number(rating);

    if (!Number.isInteger(numericRating)) {
      setRatingMessage("оценка должна быть целым числом");
      return;
    }

    if (numericRating < 1 || numericRating > 777) {
      setRatingMessage("введите число от 1 до 777");
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ?? "не удалось сохранить оценку"
        );
      }

      setRatingStatistics(data.statistics);
      setRatingMessage(
        `спасибо. ваша оценка ${numericRating} из 777 сохранена`
      );
    } catch (error) {
      console.error(error);
      setRatingMessage(error.message);
    } finally {
      setRatingLoading(false);
    }
  }


  async function submitFile(event) {
    event.preventDefault();

    if (!selectedFile) {
      setUploadMessage("сначала выберите файл");
      return;
    }

    const maximumSize = 10 * 1024 * 1024;

    if (selectedFile.size > maximumSize) {
      setUploadMessage("размер файла превышает 10 МБ");
      return;
    }

    const formData = new FormData();

    formData.append("file", selectedFile);

    setUploadLoading(true);
    setUploadMessage("");

    try {
      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ?? "не удалось отправить файл"
        );
      }

      setUploadMessage(
        `файл «${data.file.original_name}» успешно отправлен`
      );

      setSelectedFile(null);

      event.currentTarget.reset();
    } catch (error) {
      console.error(error);
      setUploadMessage(error.message);
    } finally {
      setUploadLoading(false);
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
            <div className="brand-title">механика веба</div>
            <div className="brand-subtitle">
              рэп
            </div>
          </div>
        </div>

        <nav className="navigation" aria-label="основная навигация">
          <p className="navigation-heading">содержание</p>

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
          этот сайт сам описывает путь своих запросов, работу python-сервера
          и поведение react-интерфейса
        </div>
      </aside>


      <main className="main-content">
        <header className="top-bar">
          <span>расширение знаний</span>
          <span>react + FA + SQL</span>
        </header>

        <article className="article">
          <header className="article-header">
            <h1>{selectedArticle.title}</h1>
            <p className="article-description">
              {selectedArticle.description}
            </p>
          </header>

          <div className="article-tools">
            <span>статья</span>
            <span>обсуждение</span>
            <span>читать</span>
            <span>исходный код</span>
          </div>

          <aside className="contents-box">
            <div className="contents-title">содержание</div>

            <ol>
              {selectedArticle.sections.map((section) => (
                <li key={section.heading}>
                  {section.image && (
  <figure className="article-figure">
    <img
      src={section.image}
      alt={section.imageAlt ?? section.heading}
      className="article-image"
    />

    {section.imageCaption && (
      <figcaption>
        {section.imageCaption}
      </figcaption>
    )}
  </figure>
)}
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
          <figcaption>
            {section.imageCaption}
          </figcaption>
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
            <h2>оценить сайт</h2>

            <p>
              выберите целое число от 1 до 777. сервер проверит значение,
              сохранит его в SQL и вернёт новую статистику
            </p>

            <form onSubmit={submitRating}>
              <label htmlFor="rating-range">
                honest reaction: <strong>{rating}</strong>
              </label>

              <input
                id="rating-range"
                type="range"
                min="1"
                max="777"
                value={rating}
                onChange={(event) => setRating(Number(event.target.value))}
              />

              <div className="range-labels">
                <span>1</span>
                <span>777</span>
              </div>
<label htmlFor="rating-number">
                точное значение
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
                <span className="statistics-label">средняя оценка</span>
                <strong>
                  {ratingStatistics.average === null
                    ? "пока нет"
                    : `${ratingStatistics.average} / 777`}
                </strong>
              </div>

              <div>
                <span className="statistics-label">всего голосов</span>
                <strong>{ratingStatistics.count}</strong>
              </div>
            </div>

            {ratingMessage && (
              <p className="status-message">{ratingMessage}</p>
            )}
          </div>


          <div className="interactive-card">
            <h2>передать файл серверу</h2>

            <p>
              файл будет отправлен через multipart и сохранён
              сервером. максимальный размер - 10 МБ
            </p>

            <form onSubmit={submitFile}>
              <label className="file-drop-zone" htmlFor="file-input">
                <span className="file-icon">⇧</span>

                <span>
                  {selectedFile
                    ? selectedFile.name
                    : "нажмите, чтобы выбрать файл"}
                </span>

                <small>
                  любой тип файла, не более 10 МБ
                </small>
              </label>

<input
                id="file-input"
                className="hidden-file-input"
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
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
                {uploadLoading ? "отправляем…" : "отправить файл"}
              </button>
            </form>

            {uploadMessage && (
              <p className="status-message">{uploadMessage}</p>
            )}

            <p className="privacy-warning">
              отправляйте пароли, документы, банковские сведения!!!
              и другие конфиденциальные данные!
            </p>
          </div>
        </section>


        <footer className="footer">
              учебный проект, спасибо чатгпт
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
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}


export default App;