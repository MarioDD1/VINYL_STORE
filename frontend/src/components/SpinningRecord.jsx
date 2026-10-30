import { useEffect, useRef, useState } from "react";

export default function SpinningRecord({ src }) {
  const element = useRef(null);
  const angle = useRef(-80.91);
  const drag = useRef(null);
  const velocity = useRef(0);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [value, setValue] = useState(279);
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const paint = () =>
    element.current?.style.setProperty("--rotation", `${angle.current}deg`);
  const announce = () =>
    setValue(Math.round(((angle.current % 360) + 360) % 360) % 360);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (paused || reduced) {
      paint();
      return;
    }
    let frame, last;
    const tick = (time) => {
      const dt = last === undefined ? 0 : Math.min((time - last) / 1000, 0.05);
      last = time;
      if (!drag.current && !paused && !reduced && !document.hidden) {
        angle.current += (7 + velocity.current) * dt;
        velocity.current *= Math.exp(-dt * 2.5);
        paint();
      }
      frame = requestAnimationFrame(tick);
    };
    paint();
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused, reduced]);
  function pointerAngle(event) {
    const box = element.current.getBoundingClientRect();
    return (
      (Math.atan2(
        event.clientY - box.top - box.height / 2,
        event.clientX - box.left - box.width / 2,
      ) *
        180) /
      Math.PI
    );
  }
  function release(event) {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    announce();
    if (element.current.hasPointerCapture(event.pointerId))
      element.current.releasePointerCapture(event.pointerId);
  }
  return (
    <>
      <div
        ref={element}
        className={`banner-record spinning-record ${dragging ? "dragging" : ""}`}
        role="slider"
        tabIndex={0}
        aria-label="Повернуть пластинку"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={value}
        aria-valuetext={`${value} градусов`}
        aria-describedby="record-instructions"
        onPointerDown={(event) => {
          if (event.button !== 0 || drag.current) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            id: event.pointerId,
            angle: pointerAngle(event),
            time: event.timeStamp,
          };
          velocity.current = 0;
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (!drag.current || drag.current.id !== event.pointerId) return;
          const next = pointerAngle(event);
          const delta = ((next - drag.current.angle + 540) % 360) - 180;
          const dt = Math.max(event.timeStamp - drag.current.time, 8) / 1000;
          angle.current += delta;
          velocity.current = Math.max(-180, Math.min(180, delta / dt));
          drag.current = { id: event.pointerId, angle: next, time: event.timeStamp };
          paint();
        }}
        onPointerUp={release}
        onPointerCancel={(event) => {
          velocity.current = 0;
          release(event);
        }}
        onLostPointerCapture={release}
        onKeyDown={(event) => {
          const steps = { ArrowRight: 15, ArrowUp: 15, ArrowLeft: -15, ArrowDown: -15 };
          if (!(event.key in steps) && event.key !== "Home" && event.key !== "End")
            return;
          event.preventDefault();
          velocity.current = 0;
          angle.current =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? 359
                : angle.current + steps[event.key];
          paint();
          announce();
        }}
      >
        <img src={src} alt="Виниловая пластинка SPIN" draggable={false} />
      </div>
      <div className="record-controls">
        <span id="record-instructions">Крутите пластинку рукой или клавишами ← →</span>
        {!reduced && (
          <button
            type="button"
            onClick={() => {
              setPaused(!paused);
              velocity.current = 0;
            }}
            aria-pressed={paused}
          >
            {paused ? "Продолжить вращение" : "Остановить вращение"}
          </button>
        )}
      </div>
    </>
  );
}
