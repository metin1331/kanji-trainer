const PRESS_MS = 280;
const HOLD_AT = PRESS_MS * 0.4;

type Press = {
  pointerId: number;
  holding: boolean;
  paused: boolean;
  time: number;
};

const presses = new WeakMap<HTMLElement, Press>();

function animationOf(el: HTMLElement) {
  return el.getAnimations().find((anim): anim is CSSAnimation => {
    return anim instanceof CSSAnimation && anim.animationName === "mm-press";
  });
}

function timeOf(anim: Animation) {
  return typeof anim.currentTime === "number" ? anim.currentTime : 0;
}

function snapshot(el: HTMLElement, press: Press) {
  const anim = animationOf(el);
  if (!anim) return;
  press.time = timeOf(anim);
  press.paused = anim.playState === "paused";
}

function watch(el: HTMLElement) {
  const press = presses.get(el);
  if (!press?.holding || press.paused) return;
  const anim = animationOf(el);
  if (!anim) {
    requestAnimationFrame(() => watch(el));
    return;
  }
  const time = timeOf(anim);
  press.time = time;
  if (time >= HOLD_AT) {
    const latest = presses.get(el);
    if (!latest?.holding) return;
    anim.currentTime = HOLD_AT;
    anim.pause();
    latest.time = HOLD_AT;
    latest.paused = true;
    return;
  }
  requestAnimationFrame(() => watch(el));
}

export function beginPress(el: HTMLElement, pointerId: number) {
  const current = presses.get(el);
  if (current?.holding && current.pointerId === pointerId) return;
  el.classList.remove("is-pressed");
  void el.offsetWidth;
  el.classList.add("is-pressed");
  const press: Press = { pointerId, holding: true, paused: false, time: 0 };
  presses.set(el, press);
  const stop = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
    endPress(el);
  };
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
  requestAnimationFrame(() => watch(el));
}

export function endPress(el: HTMLElement) {
  const press = presses.get(el);
  if (!press?.holding) return;
  press.holding = false;
  const anim = animationOf(el);
  if (!anim) return;
  press.time = timeOf(anim);
  if (anim.playState === "paused") anim.play();
  press.paused = false;
}

export function isHolding(el: HTMLElement) {
  return presses.get(el)?.holding === true;
}

export function restorePresses(root: ParentNode | null) {
  if (!root) return;
  root.querySelectorAll<HTMLElement>("button, a").forEach((el) => {
    const press = presses.get(el);
    if (!press) return;
    if (!el.classList.contains("is-pressed")) el.classList.add("is-pressed");
    const anim = animationOf(el);
    if (!anim) return;
    const time = timeOf(anim);
    if (press.time > 0 && time + 16 < press.time) anim.currentTime = press.time;
    if (press.paused && anim.playState !== "paused") {
      anim.currentTime = HOLD_AT;
      anim.pause();
    }
    snapshot(el, press);
  });
}

export function whenPressFinishes(el: HTMLElement, action: () => void) {
  const anim = animationOf(el);
  if (!anim || anim.playState === "finished") {
    action();
    return;
  }
  anim.addEventListener("finish", () => action(), { once: true });
}

export function clearFinishedPress(el: HTMLElement) {
  if (isHolding(el)) return;
  el.classList.remove("is-pressed");
  presses.delete(el);
}
