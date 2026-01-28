(() => {
  const STATE_CONFIGS = {
    basic: {
      storageKey: 'xrexexchangekyc.basicState.v1',
      min: 1,
      max: 3,
      labels: {
        1: 'Not submitted',
        2: 'Completed',
        3: 'Rejected',
      },
    },
    kyc: {
      storageKey: 'xrexexchangekyc.kycState.v1',
      min: 1,
      max: 4,
      labels: {
        1: 'Unverified',
        2: 'Attention (resubmit)',
        3: 'Verified',
        4: 'Rejected',
      },
    },
    bank: {
      storageKey: 'xrexexchangekyc.bankState.v1',
      min: 1,
      max: 4,
      labels: {
        1: 'No bank account',
        2: 'Processing',
        3: 'Bank account verified',
        4: 'Bank account rejected',
      },
    },
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const readStored = (key, fallback) => {
    try {
      const stored = window.localStorage ? window.localStorage.getItem(key) : null;
      if (stored !== null) {
        const parsed = parseInt(stored, 10);
        if (!Number.isNaN(parsed)) return parsed;
      }
    } catch (_) {
      // ignore storage errors
    }
    return fallback;
  };

  const states = {};

  const applyDatasetState = (group, value) => {
    const datasetKey = `${group}State`;
    document.documentElement.dataset[datasetKey] = `state-${value}`;
  };

  const setState = (group, next, opts = {}) => {
    const config = STATE_CONFIGS[group];
    if (!config) return config?.min ?? 1;
    const clamped = clamp(parseInt(next, 10), config.min, config.max);
    if (!opts.force && states[group] === clamped) return clamped;

    states[group] = clamped;
    try {
      if (window.localStorage) {
        window.localStorage.setItem(config.storageKey, String(clamped));
      }
    } catch (_) {
      // ignore storage errors
    }
    applyDatasetState(group, clamped);
    updateGroupUI(group);
    return clamped;
  };

  const changeState = (group, delta) => {
    return setState(group, states[group] + (delta || 0));
  };

  const getLabel = (group, value) => {
    const config = STATE_CONFIGS[group];
    if (!config) return '';
    return config.labels[value] || '';
  };

  const updateGroupUI = (group) => {
    const config = STATE_CONFIGS[group];
    const groupEl = document.querySelector(`[data-state-group="${group}"]`);
    if (!config || !groupEl) return;

    const valueEl = groupEl.querySelector('[data-state-value]');
    const nameEl = groupEl.querySelector('[data-state-name]');
    const downBtn = groupEl.querySelector('[data-state-action="down"]');
    const upBtn = groupEl.querySelector('[data-state-action="up"]');
    const value = states[group];

    if (valueEl) valueEl.textContent = value;
    if (nameEl) nameEl.textContent = getLabel(group, value);
    if (downBtn) downBtn.disabled = value <= config.min;
    if (upBtn) upBtn.disabled = value >= config.max;
  };

  const initStates = () => {
    Object.keys(STATE_CONFIGS).forEach((group) => {
      const config = STATE_CONFIGS[group];
      const initial = readStored(config.storageKey, config.min);
      const clamped = clamp(initial, config.min, config.max);
      states[group] = clamped;
      applyDatasetState(group, clamped);
    });
  };

  const initBadgeControls = () => {
    const badge = document.querySelector('.build-badge');
    if (!badge) return;

    badge.addEventListener('click', (event) => {
      const button = event.target.closest('[data-state-action]');
      if (!button) return;
      const groupEl = button.closest('[data-state-group]');
      if (!groupEl) return;
      const group = groupEl.getAttribute('data-state-group');
      if (!STATE_CONFIGS[group]) return;

      const action = button.getAttribute('data-state-action');
      if (action === 'down') changeState(group, -1);
      if (action === 'up') changeState(group, 1);
    });

    Object.keys(STATE_CONFIGS).forEach((group) => updateGroupUI(group));
  };

  initStates();
  initBadgeControls();

  try {
    window.prototypeStates = {
      get: (group) => states[group],
      set: (group, value) => setState(group, value),
      change: (group, delta) => changeState(group, delta),
      label: (group, value) => getLabel(group, value),
    };
  } catch (_) {
    // ignore exposure errors
  }
})();
