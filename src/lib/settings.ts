export interface Settings {
  moveEveryMin: number;
  eyeEveryMin: number;
  eyeBreaksOn: boolean;
  soundOn: boolean;
  /** Keep the always-on-top mini window open (reopened on first click after reload). */
  floatOn: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  moveEveryMin: 45,
  eyeEveryMin: 20,
  eyeBreaksOn: true,
  soundOn: true,
  floatOn: false,
};

const KEY = "bouge.settings";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — settings last for this session only */
  }
}
