// storage.js — local high-score table. Uses localStorage so it works
// fully offline and persists across sessions on the same device.

const HIGH_SCORE_KEY = 'gridmunch_highscores_v1';
const MAX_SCORES = 10;

const HighScores = {
  load() {
    try {
      const raw = localStorage.getItem(HIGH_SCORE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (e) {
      console.warn('High score load failed', e);
      return [];
    }
  },

  save(list) {
    try {
      localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('High score save failed', e);
    }
  },

  qualifies(score) {
    const list = this.load();
    if (list.length < MAX_SCORES) return true;
    return score > list[list.length - 1].score;
  },

  add(name, score, level) {
    const list = this.load();
    list.push({ name: name.slice(0, 8).toUpperCase() || 'AAA', score, level, date: Date.now() });
    list.sort((a, b) => b.score - a.score);
    const trimmed = list.slice(0, MAX_SCORES);
    this.save(trimmed);
    return trimmed;
  },

  top() {
    return this.load();
  },

  best() {
    const list = this.load();
    return list.length ? list[0].score : 0;
  },
};
