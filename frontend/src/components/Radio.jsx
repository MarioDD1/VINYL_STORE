import { useEffect, useRef, useState } from "react";
import assets from "../design-assets.json";

export const playlist = [
  ["Zu zweit", "Schwefelgelb", "zu-zweit"],
  ["Build God, Then We'll Talk (Live in Denver)", "Panic! At The Disco", "build"],
  ["All Eyes On Me", "Bo Burnham", "all-eyes-on-me"],
  ["Meirymdy Bol", "Moldanazar", "meirymdy-bol"],
  ["Sans contrefaçon", "Mylène Farmer", "sans-contrefacon"],
  ["Ribs", "Lorde", "ribs"],
];
const time = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export default function Radio() {
  const audio = useRef(null), disc = useRef(null), drag = useRef(null);
  const [selected, setSelected] = useState(0), [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0), [duration, setDuration] = useState(0), [error, setError] = useState("");
  const a = assets["70-251"];
  const play = () => { setError(""); audio.current.play().catch(() => setError("Не удалось начать воспроизведение. Нажмите ещё раз.")); };
  const choose = (index) => {
    drag.current = null;
    audio.current.pause();
    setSelected(index); setPosition(0); setDuration(0); setError("");
    audio.current.src = `/audio/${playlist[index][2]}.mp3`;
    play();
  };
  const seek = (value) => {
    if (!Number.isFinite(audio.current.duration)) return;
    audio.current.currentTime = Math.max(0, Math.min(audio.current.duration, value));
    setPosition(audio.current.currentTime);
  };
  useEffect(() => {
    let frame;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const paint = () => {
      if (disc.current && (!reduced.matches || drag.current))
        disc.current.style.setProperty("--radio-angle", `${audio.current.currentTime * 12}deg`);
      frame = requestAnimationFrame(paint);
    };
    paint();
    return () => cancelAnimationFrame(frame);
  }, []);
  const angle = (event) => {
    const b = disc.current.getBoundingClientRect();
    return Math.atan2(event.clientY - b.y - b.height / 2, event.clientX - b.x - b.width / 2) * 180 / Math.PI;
  };
  const release = (event) => {
    const state = drag.current;
    if (!state) return;
    drag.current = null;
    if (disc.current.hasPointerCapture(event.pointerId)) disc.current.releasePointerCapture(event.pointerId);
    if (state.resume) play();
  };
  return <section className="radio" id="radio">
    <audio ref={audio} src={`/audio/${playlist[0][2]}.mp3`} preload="metadata"
      onLoadedMetadata={() => setDuration(Number.isFinite(audio.current.duration) ? audio.current.duration : 0)}
      onTimeUpdate={() => setPosition(audio.current.currentTime)} onPlaying={() => setPlaying(true)}
      onPause={() => setPlaying(false)} onWaiting={() => setPlaying(false)}
      onEnded={() => choose((selected + 1) % playlist.length)} onError={() => { setPlaying(false); setError("Не удалось загрузить трек. Попробуйте следующий."); }} />
    <div className="radio-heading"><h2>Наше радио</h2><p>Шесть любимых треков. Включайте музыку и крутите пластинку, чтобы перемотать песню: один оборот — 30 секунд.</p></div>
    <div className="radio-body">
      <div className="turntable">
        <img src={a.imgImage59} alt="Проигрыватель винила" />
        <div ref={disc} className="radio-vinyl interactive-radio-vinyl" role="slider" tabIndex={0}
          aria-label="Перемотать песню пластинкой" aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(position)} aria-valuetext={time(position)}
          onPointerDown={(e) => { if (e.button !== 0 || !duration) return; e.preventDefault(); disc.current.focus(); drag.current = { angle: angle(e), resume: !audio.current.paused, position: audio.current.currentTime }; disc.current.setPointerCapture(e.pointerId); audio.current.pause(); }}
          onPointerMove={(e) => { if (!drag.current) return; const next = angle(e); const delta = ((next - drag.current.angle + 540) % 360) - 180; drag.current.angle = next; drag.current.position = Math.max(0, Math.min(duration, drag.current.position + delta / 12)); seek(drag.current.position); }}
          onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
          onKeyDown={(e) => { const value = { ArrowRight: position + 5, ArrowLeft: position - 5, Home: 0, End: duration }[e.key]; if (value !== undefined) { e.preventDefault(); seek(value); } }}>
          <img src={a.imgImage54} alt="Пластинка SPIN" draggable="false" />
        </div>
      </div>
      <ol className="radio-list real-playlist">{playlist.map(([title, artist], i) => <li key={title}><button onClick={() => choose(i)} className={selected === i ? "active" : ""} aria-pressed={selected === i}><span>{String(i + 1).padStart(2, "0")}</span><div>{title}<small>{artist}</small></div></button></li>)}</ol>
    </div>
    <div className="player-row"><div><h3>{playlist[selected][0]}</h3></div><div className="player-controls real-controls">
      <button aria-label="Предыдущий трек" onClick={() => choose((selected + playlist.length - 1) % playlist.length)}>⏮</button>
      <button aria-label={playing ? "Пауза" : "Воспроизвести"} onClick={() => audio.current.paused ? play() : audio.current.pause()}>{playing ? "Ⅱ" : "▶"}</button>
      <button aria-label="Следующий трек" onClick={() => choose((selected + 1) % playlist.length)}>⏭</button>
    </div></div>
    <input className="audio-progress" type="range" aria-label="Позиция трека" min="0" max={duration || 0} step="0.1" value={position} disabled={!duration} onChange={(e) => seek(Number(e.target.value))} />
    <div className="player-time"><span>{time(position)}</span><span>{time(duration)}</span></div>
    {error && <p role="alert">{error}</p>}
  </section>;
}
