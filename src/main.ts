import "./styles.css";
import { GameApp } from "./core/gameApp";
import { requireElement } from "./input/dom";

const canvas = requireElement<HTMLCanvasElement>("game-canvas");
const game = new GameApp(canvas);

void game.start().catch((error: unknown) => {
  console.error("Rapid failed to start", error);
  document.body.textContent = "Rapid could not initialize. Check the browser console for details.";
});

window.addEventListener("pagehide", () => game.dispose(), { once: true });
