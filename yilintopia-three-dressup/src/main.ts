import './style.css';
import { Game } from './game/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const uiRoot = document.querySelector<HTMLDivElement>('#ui-root');

if (!canvas || !uiRoot) {
  throw new Error('缺少 canvas 或 UI 容器');
}

const game = new Game(canvas, uiRoot);
game.start();

Object.assign(window, { yilintopia: game });
