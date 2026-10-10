const KEY = 'piano-notes-practice';

const defaults = { stars: {}, tuningCents: 0, showLetters: false };

export function load() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...defaults };
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // private mode etc.: progress just won't persist
  }
}
