#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright';

function parseArgs(argv) {
  const args = {
    url: null,
    iterations: 1,
    pauseMs: 300,
    headless: true,
    screenshotDir: 'output/web-game',
    actionsFile: null,
    actionsJson: null,
    click: null,
    clickSelector: null,
    autoStart: true,
    browserExecutable: process.env.PLAYWRIGHT_CHROME_EXECUTABLE || null,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--url' && next) {
      args.url = next;
      i++;
    } else if (arg === '--iterations' && next) {
      args.iterations = parseInt(next, 10);
      i++;
    } else if (arg === '--pause-ms' && next) {
      args.pauseMs = parseInt(next, 10);
      i++;
    } else if (arg === '--headless' && next) {
      args.headless = !(next === '0' || next === 'false');
      i++;
    } else if (arg === '--screenshot-dir' && next) {
      args.screenshotDir = next;
      i++;
    } else if (arg === '--actions-file' && next) {
      args.actionsFile = next;
      i++;
    } else if (arg === '--actions-json' && next) {
      args.actionsJson = next;
      i++;
    } else if (arg === '--click' && next) {
      const parts = next.split(',').map((v) => parseFloat(v.trim()));
      if (parts.length === 2 && parts.every((v) => Number.isFinite(v))) {
        args.click = { x: parts[0], y: parts[1] };
      }
      i++;
    } else if (arg === '--click-selector' && next) {
      args.clickSelector = next;
      i++;
    } else if (arg === '--auto-start' && next) {
      args.autoStart = !(next === '0' || next === 'false');
      i++;
    } else if (arg === '--browser-executable' && next) {
      args.browserExecutable = next;
      i++;
    }
  }
  if (!args.url) throw new Error('--url is required');
  return args;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function clearOldArtifacts(dir) {
  const names = ['fatal.log', 'run-meta.json', 'shot-0.png', 'state-0.json', 'errors-0.json'];
  for (const n of names) {
    const p = path.join(dir, n);
    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
  }
}

function latestTestingChromeExecutable() {
  const root = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
  if (!fs.existsSync(root)) return null;
  const entries = fs.readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith('chromium-'))
    .map((e) => e.name)
    .sort((a, b) => {
      const ai = parseInt(a.replace('chromium-', ''), 10) || 0;
      const bi = parseInt(b.replace('chromium-', ''), 10) || 0;
      return bi - ai;
    });
  for (const folder of entries) {
    const candidate = path.join(
      root,
      folder,
      'chrome-mac-arm64',
      'Google Chrome for Testing.app',
      'Contents',
      'MacOS',
      'Google Chrome for Testing'
    );
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function resolveExecutablePath(explicitPath) {
  const candidates = [];
  if (explicitPath) candidates.push(explicitPath);
  const fromCache = latestTestingChromeExecutable();
  if (fromCache) candidates.push(fromCache);
  candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

const buttonNameToKey = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  enter: 'Enter',
  space: 'Space',
  a: 'KeyA',
  b: 'KeyB',
};

function makeVirtualTimeShim() {
  return `(() => {
    const origRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    window.advanceTime = (ms) => new Promise((resolve) => {
      const start = performance.now();
      function step(now) {
        if (now - start >= ms) return resolve();
        origRequestAnimationFrame(step);
      }
      origRequestAnimationFrame(step);
    });
  })();`;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCanvasHandle(page) {
  const handle = await page.evaluateHandle(() => {
    let best = null;
    let bestArea = 0;
    for (const canvas of document.querySelectorAll('canvas')) {
      const area = (canvas.width || canvas.clientWidth || 0) * (canvas.height || canvas.clientHeight || 0);
      if (area > bestArea) {
        bestArea = area;
        best = canvas;
      }
    }
    return best;
  });
  return handle.asElement();
}

async function captureScreenshot(page, canvas, outPath) {
  if (canvas) {
    try {
      const png = await canvas.screenshot({ type: 'png' });
      fs.writeFileSync(outPath, png);
      return;
    } catch {
      // fallback below
    }
  }
  const clip = canvas ? await canvas.boundingBox() : null;
  const png = clip
    ? await page.screenshot({ type: 'png', omitBackground: false, clip })
    : await page.screenshot({ type: 'png', omitBackground: false });
  fs.writeFileSync(outPath, png);
}

async function doChoreography(page, canvas, steps) {
  for (const step of steps) {
    const buttons = new Set(step.buttons || []);
    for (const button of buttons) {
      if (button === 'left_mouse_button' || button === 'right_mouse_button') {
        const bbox = canvas ? await canvas.boundingBox() : null;
        if (!bbox) continue;
        const x = typeof step.mouse_x === 'number' ? step.mouse_x : bbox.width / 2;
        const y = typeof step.mouse_y === 'number' ? step.mouse_y : bbox.height / 2;
        await page.mouse.move(bbox.x + x, bbox.y + y);
        await page.mouse.down({ button: button === 'left_mouse_button' ? 'left' : 'right' });
      } else if (buttonNameToKey[button]) {
        await page.keyboard.down(buttonNameToKey[button]);
      }
    }
    const frames = step.frames || 1;
    for (let i = 0; i < frames; i++) {
      await page.evaluate(async () => {
        if (typeof window.advanceTime === 'function') await window.advanceTime(1000 / 60);
      });
    }
    for (const button of buttons) {
      if (button === 'left_mouse_button' || button === 'right_mouse_button') {
        await page.mouse.up({ button: button === 'left_mouse_button' ? 'left' : 'right' });
      } else if (buttonNameToKey[button]) {
        await page.keyboard.up(buttonNameToKey[button]);
      }
    }
  }
}

function parseSteps(args) {
  if (args.actionsFile) {
    const parsed = JSON.parse(fs.readFileSync(args.actionsFile, 'utf8'));
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.steps)) return parsed.steps;
  }
  if (args.actionsJson) {
    const parsed = JSON.parse(args.actionsJson);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.steps)) return parsed.steps;
  }
  if (args.click) {
    return [{ buttons: ['left_mouse_button'], frames: 2, mouse_x: args.click.x, mouse_y: args.click.y }];
  }
  return [{ buttons: [], frames: 90 }];
}

async function tryAutoStart(page) {
  const startedByHook = await page.evaluate(() => {
    try {
      if (typeof window.__startGameForTest === 'function') {
        window.__startGameForTest();
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  });
  if (startedByHook) {
    await page.waitForTimeout(450);
    return '__startGameForTest';
  }

  const selectors = [
    'text=[ 开始觉醒 ]',
    'text=开始觉醒',
    'text=开始',
    'button:has-text("开始觉醒")',
  ];
  for (const selector of selectors) {
    try {
      await page.click(selector, { timeout: 1000 });
      await page.waitForTimeout(360);
      return selector;
    } catch {
      // try next selector
    }
  }
  // Fallback: find visible text node and click its center.
  const clicked = await page.evaluate(() => {
    const words = ['开始觉醒', '开始'];
    const all = Array.from(document.querySelectorAll('button, div, span, a'));
    for (const el of all) {
      const txt = (el.textContent || '').replace(/\s+/g, '');
      if (!words.some((w) => txt.includes(w))) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) continue;
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      window.__pw_click_point = { x, y };
      return true;
    }
    return false;
  });
  if (clicked) {
    const p = await page.evaluate(() => window.__pw_click_point || null);
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(420);
      return 'text-fallback-center-click';
    }
  }
  return null;
}

async function hasEnteredGame(page) {
  return page.evaluate(() => {
    try {
      if (window.__in_game) return true;
      if (typeof window.render_game_to_text === 'function') {
        const raw = window.render_game_to_text();
        const parsed = JSON.parse(raw);
        if (parsed && parsed.scene === 'game') return true;
      }
    } catch {
      // ignore
    }
    return false;
  });
}

async function main() {
  const args = parseArgs(process.argv);
  ensureDir(args.screenshotDir);
  clearOldArtifacts(args.screenshotDir);

  const executablePath = resolveExecutablePath(args.browserExecutable);
  const launchConfig = executablePath
    ? { executablePath, headless: args.headless }
    : { channel: 'chrome', headless: args.headless };

  const runMeta = {
    timestamp: new Date().toISOString(),
    url: args.url,
    screenshotDir: path.resolve(args.screenshotDir),
    executablePath: executablePath || null,
    launchConfig,
    iterations: args.iterations,
    pauseMs: args.pauseMs,
    autoStart: args.autoStart,
    autoStartSelector: null,
  };
  fs.writeFileSync(path.join(args.screenshotDir, 'run-meta.json'), JSON.stringify(runMeta, null, 2));
  console.log('[pw] run-meta:', runMeta);

  const browser = await chromium.launch(launchConfig);
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push({ type: 'console.error', text: msg.text() });
  });
  page.on('pageerror', (err) => errors.push({ type: 'pageerror', text: String(err) }));

  await page.addInitScript({ content: makeVirtualTimeShim() });
  await page.goto(args.url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));

  let canvas = await getCanvasHandle(page);
  if (args.autoStart) {
    const picked = await tryAutoStart(page);
    if (picked) {
      runMeta.autoStartSelector = picked;
      canvas = await getCanvasHandle(page);
      fs.writeFileSync(path.join(args.screenshotDir, 'run-meta.json'), JSON.stringify(runMeta, null, 2));
    }
  }
  if (args.clickSelector) {
    await page.click(args.clickSelector, { timeout: 5000 });
    await page.waitForTimeout(260);
    canvas = await getCanvasHandle(page);
  }

  const steps = parseSteps(args);

  let entered = await hasEnteredGame(page);
  if (!entered) {
    // Strong fallback: click the known center area of the start button and re-check.
    await page.mouse.click(640, 292);
    await page.waitForTimeout(600);
    entered = await hasEnteredGame(page);
  }
  if (!entered) {
    errors.push({ type: 'start.warn', text: 'Failed to detect in-game HUD after start attempts.' });
  }

  for (let i = 0; i < args.iterations; i++) {
    if (!canvas) canvas = await getCanvasHandle(page);
    await doChoreography(page, canvas, steps);
    await sleep(args.pauseMs);

    const shotPath = path.join(args.screenshotDir, `shot-${i}.png`);
    await captureScreenshot(page, canvas, shotPath);

    let stateValue = null;
    try {
      stateValue = await page.evaluate(() => {
        if (typeof window.render_game_to_text === 'function') return window.render_game_to_text();
        return null;
      });
    } catch (e) {
      errors.push({ type: 'state.error', text: String(e) });
    }
    const statePath = path.join(args.screenshotDir, `state-${i}.json`);
    const payload = stateValue ?? JSON.stringify({ note: 'render_game_to_text unavailable' });
    fs.writeFileSync(statePath, payload);

    const errorPath = path.join(args.screenshotDir, `errors-${i}.json`);
    fs.writeFileSync(errorPath, JSON.stringify(errors, null, 2));
    console.log(`[pw] wrote: ${shotPath}, ${statePath}, ${errorPath}`);
  }

  await browser.close();
}

main().catch((err) => {
  const dir = process.argv.includes('--screenshot-dir')
    ? process.argv[process.argv.indexOf('--screenshot-dir') + 1]
    : 'output/web-game';
  try {
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, 'fatal.log'), String(err?.stack || err));
  } catch {
    // ignore
  }
  console.error(err);
  process.exit(1);
});
