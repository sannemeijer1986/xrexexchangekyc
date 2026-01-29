(() => {
  const STATE_CONFIGS = {
    basic: {
      storageKey: 'xrexexchangekyc.basicState.v2',
      min: 1,
      max: 4,
      labels: {
        1: 'Not submitted',
        2: 'Submitted',
        3: 'Approved',
        4: 'Rejected',
      },
    },
    identity: {
      storageKey: 'xrexexchangekyc.identityState.v1',
      min: 1,
      max: 5,
      labels: {
        1: 'Not submitted',
        2: 'Submitted',
        3: 'Resubmission',
        4: 'Approved',
        5: 'Rejected',
      },
    },
    questionnaire: {
      storageKey: 'xrexexchangekyc.questionnaireState.v1',
      min: 1,
      max: 5,
      labels: {
        1: 'Not enabled',
        2: 'Enabled & not submitted',
        3: 'Submitted',
        4: 'Approved',
        5: 'Rejected',
      },
    },
    bank: {
      storageKey: 'xrexexchangekyc.bankState.v2',
      min: 1,
      max: 5,
      labels: {
        1: 'Not submitted',
        2: 'Submitted',
        3: 'Resubmission',
        4: 'Approved',
        5: 'Rejected',
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

  const updateGradientBackground = () => {
    const container = document.querySelector('.content');
    if (!container) return;
    const hasResubmission = Object.keys(STATE_CONFIGS).some((group) => {
      return getLabel(group, states[group]) === 'Resubmission';
    });
    const isKycIdle = ['basic', 'identity'].every((group) => {
      return states[group] === 1;
    });
    container.classList.toggle('has-resubmission', hasResubmission);
    container.classList.toggle('has-kyc-progress', isKycIdle);
  };

  const updateBankAvailability = () => {
    const bankGroup = document.querySelector('[data-state-group="bank"]');
    if (!bankGroup) return;
    const isUnlocked = states.basic >= 2 && states.identity >= 2;
    bankGroup.classList.toggle('is-locked', !isUnlocked);
    bankGroup.setAttribute('aria-disabled', String(!isUnlocked));
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
    if (nameEl) {
      const label = getLabel(group, value);
      nameEl.textContent = label;
      nameEl.dataset.stateLabel = label;
    }
    if (downBtn) downBtn.disabled = value <= config.min;
    if (upBtn) upBtn.disabled = value >= config.max;
    updateGradientBackground();
    updateBankAvailability();
  };
  const initStates = () => {
    Object.keys(STATE_CONFIGS).forEach((group) => {
      const config = STATE_CONFIGS[group];
      const initial = readStored(config.storageKey, config.min);
      const clamped = clamp(initial, config.min, config.max);
      states[group] = clamped;
      applyDatasetState(group, clamped);
    });
    updateGradientBackground();
    updateBankAvailability();
  };

  const initBadgeControls = () => {
    const badge = document.querySelector('.build-badge');
    if (!badge) return;
    const header = badge.querySelector('.build-badge__header');
    const body = badge.querySelector('.build-badge__body');
    const toggleCollapse = () => {
      const isCollapsed = badge.classList.toggle('is-collapsed');
      if (header) header.setAttribute('aria-expanded', String(!isCollapsed));
      if (body) body.hidden = false;
    };

    if (header) {
      header.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleCollapse();
      });
    }

    badge.addEventListener('click', (event) => {
      if (!badge.classList.contains('is-collapsed')) return;
      if (event.target.closest('[data-state-action]')) return;
      toggleCollapse();
    });

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

  const initHeaderScrollSwap = () => {
    const header = document.querySelector('.app-header');
    const statusBar = document.querySelector('.status-bar');
    const scroller = document.querySelector('.content');
    if (!header || !scroller) return;

    let isScrolled = false;
    let ticking = false;
    const threshold = 4;

    const apply = () => {
      const shouldBeScrolled = scroller.scrollTop > threshold;
      if (shouldBeScrolled !== isScrolled) {
        isScrolled = shouldBeScrolled;
        header.classList.toggle('is-scrolled', isScrolled);
        if (statusBar) statusBar.classList.toggle('is-scrolled', isScrolled);
      }
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    apply();
  };

  initHeaderScrollSwap();

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
