// game.js — state machine, main loop, scoring, and canvas rendering.

const LEVEL_KEYS = ['level1', 'level2', 'level3'];

const SCATTER_COLOR_CORNERS = {
  // corners are in maze tile coordinates, chosen to sit just inside walls
  topRight: { row: 1, col: 17 },
  topLeft: { row: 1, col: 1 },
  bottomRight: { row: 19, col: 17 },
  bottomLeft: { row: 19, col: 1 },
};

const GHOST_DEFS = [
  { personality: 'chaser', color: '#f2545b', corner: SCATTER_COLOR_CORNERS.topRight, spawnOffset: { dr: 0, dc: 0, delay: 0 } },
  { personality: 'flanker', color: '#b57bff', corner: SCATTER_COLOR_CORNERS.topLeft, spawnOffset: { dr: 0, dc: -1, delay: 2 } },
  { personality: 'pincer', color: '#45c4a0', corner: SCATTER_COLOR_CORNERS.bottomLeft, spawnOffset: { dr: 0, dc: 1, delay: 4 } },
  { personality: 'wanderer', color: '#f2a93b', corner: SCATTER_COLOR_CORNERS.bottomRight, spawnOffset: { dr: 0, dc: 0, delay: 6 } },
];

const STATE = {
  MENU: 'menu',
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  DYING: 'dying',
  LEVEL_COMPLETE: 'level_complete',
  GAME_OVER: 'game_over',
  NAME_ENTRY: 'name_entry',
};

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.input = new InputManager(this.canvas);

    this.state = STATE.MENU;
    this.score = 0;
    this.lives = 3;
    this.levelIndex = 0; // index into LEVEL_KEYS, wraps with scaling difficulty
    this.levelNumber = 1;
    this.pelletsEatenThisLevel = 0;
    this.fruitSpawned = [false, false];
    this.fruit = null;
    this.globalMode = 'scatter';
    this.modeTimer = 7;
    this.modeSchedule = [7, 20, 7, 20, 5, 20, 5, Infinity];
    this.modeIndex = 0;
    this.frightenedDuration = 7;
    this.stateTimer = 0;
    this.combo = 0;

    this._bindOverlayButtons();
    this._resize();
    window.addEventListener('resize', () => this._resize());

    this._loadLevel(this.levelNumber);
    this._updateHud();
    this._renderHighScoreList('list-menu-scores');

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this._loop(t));
  }

  // ---------- setup ----------

  _bindOverlayButtons() {
    document.getElementById('btn-start').addEventListener('click', () => this._startNewGame());
    document.getElementById('btn-resume').addEventListener('click', () => this._resume());
    document.getElementById('btn-restart').addEventListener('click', () => this._startNewGame());
    document.getElementById('btn-submit-name').addEventListener('click', () => this._submitName());
    document.getElementById('input-name').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._submitName();
    });
    document.getElementById('btn-menu-from-gameover').addEventListener('click', () => this._toMenu());
  }

  _resize() {
    const maze = this.maze || new Maze(LEVEL_KEYS[0]);
    const wrap = document.getElementById('canvas-wrap');
    const availW = wrap.clientWidth;
    const availH = wrap.clientHeight;
    const tile = Math.floor(Math.min(availW / maze.cols, availH / maze.rows));
    this.tile = Math.max(10, tile);
    this.canvas.width = maze.cols * this.tile;
    this.canvas.height = maze.rows * this.tile;
  }

  _loadLevel(levelNumber) {
    const key = LEVEL_KEYS[(levelNumber - 1) % LEVEL_KEYS.length];
    this.maze = new Maze(key);
    this.player = new Player(this.maze);
    this.ghosts = GHOST_DEFS.map((def) => {
      const g = new Ghost(this.maze, def.personality, def.color, def.corner, def.spawnOffset);
      g.applyLevelSpeed(levelNumber);
      return g;
    });
    this.player.speed = 5.6 + Math.min(levelNumber - 1, 6) * 0.08;
    this.frightenedDuration = Math.max(2, 7 - (levelNumber - 1) * 0.6);
    this.pelletsEatenThisLevel = 0;
    this.fruitSpawned = [false, false];
    this.fruit = null;
    this.globalMode = 'scatter';
    this.modeIndex = 0;
    this.modeTimer = this.modeSchedule[0];
    this._resize();
  }

  _startNewGame() {
    this.score = 0;
    this.lives = 3;
    this.levelNumber = 1;
    this._loadLevel(this.levelNumber);
    this._setState(STATE.READY);
    this.stateTimer = 1.6;
    this._hideAllOverlays();
    this._updateHud();
  }

  _toMenu() {
    this._setState(STATE.MENU);
    this._hideAllOverlays();
    document.getElementById('screen-start').classList.remove('hidden');
    this._renderHighScoreList('list-menu-scores');
  }

  // ---------- state machine ----------

  _setState(s) {
    this.state = s;
  }

  _hideAllOverlays() {
    document.querySelectorAll('.overlay').forEach((el) => el.classList.add('hidden'));
  }

  _pause() {
    if (this.state !== STATE.PLAYING) return;
    this._setState(STATE.PAUSED);
    document.getElementById('screen-pause').classList.remove('hidden');
  }

  _resume() {
    if (this.state !== STATE.PAUSED) return;
    this._setState(STATE.PLAYING);
    document.getElementById('screen-pause').classList.add('hidden');
  }

  _loseLife() {
    this._setState(STATE.DYING);
    this.stateTimer = 1.3;
    this.lives -= 1;
    this._updateHud();
  }

  _afterDying() {
    if (this.lives <= 0) {
      this._gameOver();
      return;
    }
    this.player.reset(this.maze);
    this.ghosts.forEach((g) => g.reset(this.maze));
    this.globalMode = 'scatter';
    this.modeIndex = 0;
    this.modeTimer = this.modeSchedule[0];
    this._setState(STATE.READY);
    this.stateTimer = 1.4;
  }

  _levelComplete() {
    this._setState(STATE.LEVEL_COMPLETE);
    this.stateTimer = 1.8;
  }

  _afterLevelComplete() {
    this.levelNumber += 1;
    this._loadLevel(this.levelNumber);
    this._setState(STATE.READY);
    this.stateTimer = 1.4;
    this._updateHud();
  }

  _gameOver() {
    this._setState(STATE.GAME_OVER);
    document.getElementById('final-score').textContent = this.score;
    document.getElementById('final-score-inline').textContent = this.score;
    if (HighScores.qualifies(this.score)) {
      this._setState(STATE.NAME_ENTRY);
      document.getElementById('screen-nameentry').classList.remove('hidden');
      const nameInput = document.getElementById('input-name');
      nameInput.value = '';
      setTimeout(() => nameInput.focus(), 50);
    } else {
      document.getElementById('screen-gameover').classList.remove('hidden');
      this._renderHighScoreList('list-gameover-scores');
    }
  }

  _submitName() {
    const name = document.getElementById('input-name').value || 'AAA';
    HighScores.add(name, this.score, this.levelNumber);
    document.getElementById('screen-nameentry').classList.add('hidden');
    document.getElementById('screen-gameover').classList.remove('hidden');
    this._renderHighScoreList('list-gameover-scores');
    this._setState(STATE.GAME_OVER);
  }

  _renderHighScoreList(elId) {
    const el = document.getElementById(elId);
    const list = HighScores.top();
    if (list.length === 0) {
      el.innerHTML = '<li class="empty">No scores yet — be the first.</li>';
      return;
    }
    el.innerHTML = list
      .map((s, i) => `<li><span class="rank">${i + 1}</span><span class="name">${escapeHtml(s.name)}</span><span class="score">${s.score}</span></li>`)
      .join('');
  }

  _updateHud() {
    document.getElementById('hud-score').textContent = this.score;
    document.getElementById('hud-highscore').textContent = Math.max(HighScores.best(), this.score);
    document.getElementById('hud-level').textContent = this.levelNumber;
    const livesEl = document.getElementById('hud-lives');
    livesEl.innerHTML = '';
    for (let i = 0; i < this.lives; i++) {
      const dot = document.createElement('span');
      dot.className = 'life-dot';
      livesEl.appendChild(dot);
    }
  }

  // ---------- main loop ----------

  _loop(now) {
    const dt = Math.min(0.033, (now - this.lastTime) / 1000);
    this.lastTime = now;

    if (this.input.consumePause()) {
      if (this.state === STATE.PLAYING) this._pause();
      else if (this.state === STATE.PAUSED) this._resume();
    }

    this._update(dt);
    this._render();
    requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    switch (this.state) {
      case STATE.READY:
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this._setState(STATE.PLAYING);
        break;
      case STATE.PLAYING:
        this._updatePlaying(dt);
        break;
      case STATE.DYING:
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this._afterDying();
        break;
      case STATE.LEVEL_COMPLETE:
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this._afterLevelComplete();
        break;
      default:
        break;
    }
  }

  _updatePlaying(dt) {
    // mode timer (scatter/chase alternation)
    if (this.modeTimer !== Infinity) {
      this.modeTimer -= dt;
      if (this.modeTimer <= 0) {
        this.modeIndex = Math.min(this.modeIndex + 1, this.modeSchedule.length - 1);
        this.globalMode = this.globalMode === 'scatter' ? 'chase' : 'scatter';
        this.modeTimer = this.modeSchedule[this.modeIndex];
      }
    }

    this.player.setDesiredDirection(this.input.desired);
    this.player.update(dt, this.maze);

    const eaten = this.maze.eatAt(Math.round(this.player.row), Math.round(this.player.col));
    if (eaten === 'pellet') {
      this.score += 10;
      this.pelletsEatenThisLevel++;
    } else if (eaten === 'power') {
      this.score += 50;
      this.combo = 0;
      this.ghosts.forEach((g) => g.enterFrightened(this.frightenedDuration));
    }

    this._maybeSpawnFruit();
    if (this.fruit) {
      const d = Math.hypot(this.player.row - this.fruit.row, this.player.col - this.fruit.col);
      if (d < 0.5) {
        this.score += this.fruit.value;
        this.fruit = null;
      } else {
        this.fruit.timer -= dt;
        if (this.fruit.timer <= 0) this.fruit = null;
      }
    }

    const chaser = this.ghosts[0];
    for (const g of this.ghosts) {
      g.update(dt, this.maze, this.player, chaser, this.globalMode);
    }

    this._checkGhostCollisions();

    if (this.maze.cleared()) {
      this._levelComplete();
    }

    this._updateHud();
  }

  _maybeSpawnFruit() {
    const total = this.maze.totalPellets;
    const eaten = this.pelletsEatenThisLevel;
    const thresholds = [Math.floor(total * 0.35), Math.floor(total * 0.7)];
    for (let i = 0; i < thresholds.length; i++) {
      if (!this.fruitSpawned[i] && eaten >= thresholds[i] && !this.fruit) {
        this.fruitSpawned[i] = true;
        this.fruit = {
          row: this.maze.ghostStart.row + 3,
          col: this.maze.ghostStart.col,
          value: 100 * (i + 1) + this.levelNumber * 20,
          timer: 9,
        };
      }
    }
  }

  _checkGhostCollisions() {
    for (const g of this.ghosts) {
      if (g.mode === 'pen' || g.mode === 'eaten') continue;
      const d = Math.hypot(this.player.row - g.row, this.player.col - g.col);
      if (d < 0.6) {
        if (g.mode === 'frightened') {
          g.getEaten();
          this.combo += 1;
          this.score += 200 * Math.min(this.combo, 8);
        } else {
          this._loseLife();
          return;
        }
      }
    }
  }

  // ---------- rendering ----------

  _render() {
    const ctx = this.ctx;
    const tile = this.tile;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.maze.draw(ctx, tile);

    if (this.fruit) {
      const x = this.fruit.col * tile + tile / 2;
      const y = this.fruit.row * tile + tile / 2;
      ctx.save();
      ctx.fillStyle = '#f2545b';
      ctx.shadowColor = 'rgba(242, 84, 91, 0.8)';
      ctx.shadowBlur = tile * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, tile * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (this.state !== STATE.MENU) {
      this.player.draw(ctx, tile);
      for (const g of this.ghosts) {
        if (g.mode === 'pen' && g.penTimer > 0.05) {
          // still draw them bobbing in the pen
        }
        g.draw(ctx, tile);
      }
    }

    if (this.state === STATE.READY) {
      this._drawCenterText('READY!', '#f2c14e');
    } else if (this.state === STATE.LEVEL_COMPLETE) {
      this._drawCenterText('LEVEL CLEAR', '#4fe9da');
    } else if (this.state === STATE.DYING) {
      this._drawCenterText('OUCH!', '#f2545b');
    }
  }

  _drawCenterText(text, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.floor(this.tile * 1.1)}px 'Courier New', monospace`;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = this.tile;
    ctx.fillText(text, this.canvas.width / 2, this.canvas.height / 2);
    ctx.restore();
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

window.addEventListener('DOMContentLoaded', () => {
  window.gridMunchGame = new Game();
});
