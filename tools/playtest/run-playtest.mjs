import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const PORT = 4173;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}/index.html`;
const args = new Set(process.argv.slice(2));
const isHeaded = args.has('--headed');
const isManual = args.has('--manual');
const isSmoke = args.has('--smoke');
const isLong = args.has('--long');
const saveArtifacts = args.has('--save-artifacts') || process.env.PLAYTEST_SAVE_ARTIFACTS === '1';
const retainArtifacts = Number(process.env.PLAYTEST_RETAIN_ARTIFACTS || 10);
const maxSimAvgHpErr = Number(process.env.MAX_SIM_AVG_HP_ERR || 10);
const maxSimAvgAliveErr = Number(process.env.MAX_SIM_AVG_ALIVE_ERR || 0.5);
const targetRounds = Number(process.env.PLAYTEST_ROUNDS || (isLong ? 3 : 1));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function createStaticServer(rootDir, port, host) {
  const server = http.createServer((req, res) => {
    const rawUrl = req.url || '/';
    const clean = decodeURIComponent(rawUrl.split('?')[0]).replace(/^\/+/, '');
    const rel = clean === '' ? 'index.html' : clean;
    const target = path.resolve(rootDir, rel);
    if (!target.startsWith(rootDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.readFile(target, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(target).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function pruneArtifacts(rootDir, keepCount) {
  if (!Number.isFinite(keepCount) || keepCount <= 0) return;
  if (!fs.existsSync(rootDir)) return;

  const dirs = fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const full = path.join(rootDir, d.name);
      const stat = fs.statSync(full);
      return { full, mtime: stat.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  for (let i = keepCount; i < dirs.length; i++) {
    fs.rmSync(dirs[i].full, { recursive: true, force: true });
  }
}

async function clickIfVisible(page, selector) {
  const el = page.locator(selector);
  if (await el.count()) {
    const visible = await el.first().isVisible().catch(() => false);
    if (visible) {
      await el.first().click({ timeout: 1500 }).catch(() => {});
      return true;
    }
  }
  return false;
}

async function ensureBattleRound(page) {
  let lastState = { ok: false, reason: 'unknown' };
  for (let i = 0; i < 30; i++) {
    const state = await page.evaluate(() => {
      const game = window.game || (window.Phaser && Array.isArray(window.Phaser.GAMES) ? window.Phaser.GAMES[0] : null);
      if (!game || !game.scene) return { ok: false, reason: 'no-game' };
      let scene = null;
      try {
        scene = game.scene.getScene('BattleScene');
      } catch {
        scene = null;
      }

      const isActive = !!(scene && scene.sys && scene.sys.isActive && scene.sys.isActive());
      if (!isActive) {
        try {
          game.scene.start('BattleScene');
          return { ok: false, reason: 'start-battle' };
        } catch {
          const activeKeys = (typeof game.scene.getScenes === 'function')
            ? game.scene.getScenes(true).map((s) => s.scene.key)
            : [];
          const allKeys = (game.scene.keys && typeof game.scene.keys === 'object') ? Object.keys(game.scene.keys) : [];
          return { ok: false, reason: 'battle-not-ready', activeKeys, allKeys };
        }
      }

      if (!scene.isPlaying && typeof scene.startRound === 'function') {
        try {
          scene.startRound();
        } catch (e) {
          return { ok: false, reason: `start-round-failed:${String(e)}` };
        }
      }
      return {
        ok: !!scene.isPlaying,
        reason: scene.isPlaying ? 'round-running' : 'round-not-running',
        round: scene.currentRound || 0
      };
    });
    lastState = state;

    if (state.ok) return state;
    await page.waitForTimeout(500);
  }
  return { ok: false, reason: 'timeout', lastState };
}

async function driveBattleRounds(page, rounds, timeoutMs) {
  const startedAt = Date.now();
  let lastState = null;

  while ((Date.now() - startedAt) < timeoutMs) {
    const state = await page.evaluate((target) => {
      const game = window.game || (window.Phaser && Array.isArray(window.Phaser.GAMES) ? window.Phaser.GAMES[0] : null);
      if (!game || !game.scene) return { ok: false, reason: 'no-game' };

      let scene = null;
      try {
        scene = game.scene.getScene('BattleScene');
      } catch {
        scene = null;
      }
      const isActive = !!(scene && scene.sys && scene.sys.isActive && scene.sys.isActive());
      if (!isActive) return { ok: false, reason: 'battle-inactive' };

      const currentRound = scene.currentRound || 0;
      const isPlaying = !!scene.isPlaying;
      const completedRounds = Math.max(0, currentRound - 1);

      if (!isPlaying && currentRound <= target && typeof scene.startRound === 'function') {
        try {
          if (scene.cardManager && Array.isArray(scene.cardManager.hand) && typeof scene._getConstants === 'function') {
            const maxHand = scene._getConstants().MAX_HAND || 7;
            if (scene.cardManager.hand.length > maxHand) {
              scene.cardManager.hand = scene.cardManager.hand.slice(0, maxHand);
              if (typeof scene.cardManager.renderHand === 'function') scene.cardManager.renderHand();
            }
          }
          scene.startRound();
          return { ok: true, action: 'startRound', currentRound, completedRounds, isPlaying: false };
        } catch (e) {
          return { ok: false, reason: `startRound-failed:${String(e)}` };
        }
      }

      return { ok: true, action: 'wait', currentRound, completedRounds, isPlaying };
    }, rounds);

    lastState = state;

    if (state.ok && state.completedRounds >= rounds && !state.isPlaying) {
      return { ok: true, reason: 'completed', state };
    }
    await page.waitForTimeout(500);
  }

  return { ok: false, reason: 'timeout', state: lastState };
}

async function run() {
  const artifactsRoot = path.join(ROOT, 'playtest-artifacts');
  const outDir = saveArtifacts ? path.join(artifactsRoot, nowStamp()) : null;
  if (outDir) fs.mkdirSync(outDir, { recursive: true });

  const logs = {
    startedAt: new Date().toISOString(),
    mode: isManual ? 'manual' : (isLong ? 'long' : (isSmoke ? 'smoke' : 'default')),
    url: BASE_URL,
    targetRounds,
    console: [],
    simCompareSummaries: [],
    pageErrors: [],
    requestFailed: []
  };

  const server = await createStaticServer(ROOT, PORT, HOST);
  let browser;

  try {
    browser = await chromium.launch({ headless: !isHeaded });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const pendingConsoleTasks = [];

    page.on('console', (msg) => {
      const task = (async () => {
        const args = [];
        for (const handle of msg.args()) {
          try {
            args.push(await handle.jsonValue());
          } catch {
            args.push(undefined);
          }
        }

        logs.console.push({ type: msg.type(), text: msg.text(), args });

        const first = args[0];
        const second = args[1];
        if (typeof first === 'string' && first.includes('[SimCompare][Summary]') && second && typeof second === 'object') {
          logs.simCompareSummaries.push(second);
        }
      })();
      pendingConsoleTasks.push(task);
    });
    page.on('pageerror', (err) => {
      logs.pageErrors.push({ message: err.message, stack: err.stack || '' });
    });
    page.on('requestfailed', (req) => {
      logs.requestFailed.push({
        url: req.url(),
        method: req.method(),
        errorText: req.failure()?.errorText || 'unknown'
      });
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Best-effort bootstrap interactions that work for most scene layouts.
    await clickIfVisible(page, '#btn-start');
    await clickIfVisible(page, '#btn-game-start');
    await page.keyboard.press('Enter').catch(() => {});
    await page.keyboard.press('Space').catch(() => {});
    await page.waitForTimeout(800);

    if (await page.locator('canvas').count()) {
      const canvas = page.locator('canvas').first();
      const box = await canvas.boundingBox();
      if (box) {
        const points = [
          [box.x + box.width * 0.5, box.y + box.height * 0.5],
          [box.x + box.width * 0.35, box.y + box.height * 0.6],
          [box.x + box.width * 0.65, box.y + box.height * 0.6]
        ];
        for (const [x, y] of points) {
          await page.mouse.click(x, y).catch(() => {});
          await page.waitForTimeout(300);
        }
      }
    }

    await clickIfVisible(page, '#btn-turn-end');
    const battleState = await ensureBattleRound(page);
    logs.battleBoot = battleState;
    const runState = await driveBattleRounds(page, targetRounds, isManual ? 180000 : 90000);
    logs.battleRun = runState;
    await page.waitForTimeout(1000);
    await Promise.allSettled(pendingConsoleTasks);

    logs.finishedAt = new Date().toISOString();
    if (outDir) {
      await page.screenshot({ path: path.join(outDir, 'final.png'), fullPage: true });
      fs.writeFileSync(path.join(outDir, 'logs.json'), JSON.stringify(logs, null, 2), 'utf8');
      pruneArtifacts(artifactsRoot, retainArtifacts);
    }

    let critical = logs.pageErrors.length;
    if (logs.simCompareSummaries.length > 0) {
      let hpErr = 0;
      let aliveErr = 0;
      for (const s of logs.simCompareSummaries) {
        hpErr = Math.max(
          hpErr,
          Number(s.avgAllyHpErr || 0),
          Number(s.avgEnemyHpErr || 0),
          Number(s.avgAllyBaseHpErr || 0),
          Number(s.avgEnemyBaseHpErr || 0)
        );
        aliveErr = Math.max(
          aliveErr,
          Number(s.avgAllyAliveErr || 0),
          Number(s.avgEnemyAliveErr || 0)
        );
      }

      const last = logs.simCompareSummaries[logs.simCompareSummaries.length - 1];
      console.log(`[playtest] simCompare: rounds=${logs.simCompareSummaries.length}/${targetRounds}, lastTag=${last.tag ?? 'n/a'}, maxHpErr=${hpErr}, maxAliveErr=${aliveErr}`);
      if (hpErr > maxSimAvgHpErr || aliveErr > maxSimAvgAliveErr) {
        critical += 1;
        console.log(`[playtest] simCompare threshold exceeded (maxHpErr<=${maxSimAvgHpErr}, maxAliveErr<=${maxSimAvgAliveErr})`);
      }
      if (isLong && logs.simCompareSummaries.length < targetRounds) {
        critical += 1;
        console.log(`[playtest] simCompare summary count too low (${logs.simCompareSummaries.length}/${targetRounds})`);
      }
    } else {
      console.log('[playtest] simCompare: no summary found');
      critical += 1;
    }

    if (outDir) console.log(`[playtest] done: ${outDir}`);
    else console.log('[playtest] done: artifacts disabled (use --save-artifacts)');
    console.log(`[playtest] battleBoot=${JSON.stringify(logs.battleBoot)}`);
    console.log(`[playtest] battleRun=${JSON.stringify(logs.battleRun)}`);
    console.log(`[playtest] pageErrors=${logs.pageErrors.length}, requestFailed=${logs.requestFailed.length}, console=${logs.console.length}`);
    if (critical > 0) process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((err) => {
  console.error('[playtest] fatal', err);
  process.exit(1);
});
