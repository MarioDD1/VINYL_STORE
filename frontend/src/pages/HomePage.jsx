import CatalogPage from "./CatalogPage";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span></span>
            ДЛЯ ТЕХ, КТО СЛУШАЕТ
          </p>
          <h1>
            Хорошая музыка.
            <br />
            В правильном
            <br />
            <em>формате.</em>
          </h1>
          <p className="hero-description">
            Тот самый звук. Настоящие обложки. Особенный ритуал.
            <br />
            Найдите пластинку, которая станет частью вашей истории.
          </p>
          <a className="button dark" href="#catalog">
            Найти свою пластинку
            <span>↗</span>
          </a>
          <div className="hero-footnote">
            <span className="tiny-disc">◉</span>
            От первой пластинки до большой коллекции
          </div>
        </div>
        <div className="hero-art">
          <div className="orbit orbit-one"></div>
          <div className="orbit orbit-two"></div>
          <span className="art-caption">
            ANALOG SOUND.
            <br />
            TIMELESS FEELING.
          </span>
          <div className="record">
            <div className="record-label">
              <span>VINYL ROOM</span>
              <b>VR</b>
              <small>SIDE A · 33⅓ RPM</small>
            </div>
          </div>
          <div className="hero-sleeve">
            <div className="sleeve-lines"></div>
            <small>THE ART OF LISTENING</small>
            <strong>
              FEEL
              <br />
              EVERY
              <br />
              <i>GROOVE.</i>
            </strong>
            <span>VOL. 001 &nbsp; / &nbsp; STEREO</span>
          </div>
          <div className="round-sticker">
            ЗВУК,
            <br />
            КОТОРЫЙ
            <br />
            ЧУВСТВУЕШЬ
            <b>↗</b>
          </div>
          <span className="art-index">01 — ∞</span>
        </div>
      </section>
      <div className="benefits">
        <span>
          ◎<b>Бережная упаковка</b>
          для каждой пластинки
        </span>
        <span>
          ♫<b>Разные жанры</b>
          одно увлечение
        </span>
        <span>
          ↗<b>Новые открытия</b>в вашей коллекции
        </span>
      </div>
      <CatalogPage />
      <section className="about" id="about">
        <span className="about-icon">✳</span>
        <div>
          <p className="eyebrow">МЕНЬШЕ ШУМА. БОЛЬШЕ МУЗЫКИ.</p>
          <h2>
            Поставьте жизнь
            <br />
            на нужную скорость.
          </h2>
        </div>
        <p>
          Мы верим в музыку, к которой хочется возвращаться. В шорох иглы, большие
          обложки и альбомы, которые слушают целиком.
          <br />
          <br />
          VINYL ROOM — место для вашей следующей любимой пластинки.
        </p>
      </section>
    </>
  );
}
