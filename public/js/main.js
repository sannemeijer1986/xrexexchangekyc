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
    }) || states.questionnaire === 2;
    const isAwaitingSubmission = ['basic', 'identity'].every((group) => {
      return states[group] === 2;
    });
    container.classList.toggle('has-resubmission', hasResubmission);
    container.classList.toggle('has-kyc-progress', true);
  };

  const updateBankAvailability = () => {
    const bankGroup = document.querySelector('[data-state-group="bank"]');
    if (!bankGroup) return;
    const isUnlocked = states.basic >= 2 && states.identity >= 2;
    bankGroup.classList.toggle('is-locked', !isUnlocked);
    bankGroup.setAttribute('aria-disabled', String(!isUnlocked));
  };

  const updateSetupState = () => {
    const titleEl = document.querySelector('[data-setup-title]');
    const statusEl = document.querySelector('[data-setup-status]');
    const setupStateEl = document.querySelector('[data-setup-state]');
    const firstTimeEl = document.querySelector('[data-setup-first-time]');
    const assetCardEl = document.querySelector('.asset-card');
    const cardTitleEl = document.querySelector('[data-setup-card-title]');
    const cardSubtitleEl = document.querySelector('[data-setup-card-subtitle]');
    const cardCtaEl = document.querySelector('[data-setup-cta]');
    const finalStepEl = document.querySelector('[data-setup-step-final]');
    const heroEl = document.querySelector('[data-setup-hero]');
    const stepSignUpEl = document.querySelector('[data-setup-step="sign-up"]');
    const stepNextEl = document.querySelector('[data-setup-step="next-steps"]');
    const stepFinalEl = document.querySelector('[data-setup-step="final"]');
    const btnSecondaryEl = document.querySelector('[data-setup-btn-secondary]');
    const btnPrimaryEl = document.querySelector('[data-setup-btn-primary]');
    const buttonsWrapEl = document.querySelector('.setup-first__buttons');
    if (!titleEl) return;
    const basic = states.basic;
    const identity = states.identity;
    const bank = states.bank;
    let title = '';
    let label = '';
    let statusText = '';
    let statusState = '';
    let isWarning = false;
    let showCard = false;
    let cardTitle = '';
    let cardSubtitle = '';
    let cardCta = '';
    let finalStepLabel = 'Trade';
    let hideSecondaryBtn = false;
    let hidePrimaryBtn = false;
    let stepState = 'progress';

    const hasResubmission = Object.keys(STATE_CONFIGS).some((group) => {
      return getLabel(group, states[group]) === 'Resubmission';
    }) || states.questionnaire === 2;
    const isQuestionnaireActive = states.questionnaire > 1;
    const isQuestionnaireSubmitted = states.questionnaire >= 3;
    const isQuestionnaireApproved = states.questionnaire === 4;
    const isAllApproved = ['basic', 'identity', 'bank'].every((group) => {
      return getLabel(group, states[group]) === 'Approved';
    }) && (!isQuestionnaireActive || isQuestionnaireApproved);

    if (isAllApproved) {
      showCard = false;
      statusText = 'Approved';
      statusState = 'approved';
    } else if (hasResubmission) {
      title = 'Resubmission content';
      label = 'PI resubmission';
      statusText = 'Action required';
      statusState = 'resubmission';
      isWarning = true;
      showCard = true;
      cardTitle = 'Some required information or documents are missing and need an update.';
      cardCta = 'Review and update';
      hideSecondaryBtn = true;
      stepState = 'resubmission';
    } else if (basic === 1 && identity === 1) {
      title = 'First time content';
      label = 'Setup not started';
      statusText = 'Get started';
      statusState = 'getstarted';
      showCard = true;
      cardTitle = 'Just a few steps to\nunlock the best of XREX!';
      cardCta = 'Get started';
      stepState = 'progress';
    } else if (basic >= 2 && identity >= 2 && bank >= 2 && (!isQuestionnaireActive || isQuestionnaireSubmitted)) {
      title = 'Submitted, please wait content';
      label = 'Submitted BI and PI, awaiting';
      statusText = 'Reviewing';
      statusState = 'reviewing';
      showCard = true;
      cardTitle = 'We\u2019re reviewing your application, we will notify you of further updates.';
      cardSubtitle = 'Reviewing usually takes 1-2 business days';
      finalStepLabel = 'Reviewing';
      hidePrimaryBtn = true;
      stepState = 'reviewing';
    } else if ((basic !== 1 || identity !== 1) && (basic !== 2 && identity !== 2)) {
      title = 'Continue setup content';
      label = 'Setup part 1 started but not finished';
      statusText = 'Continue';
      statusState = 'continue';
      showCard = true;
      cardTitle = 'Pick up where you left off,\njust a few steps to unlock the best of XREX!';
      cardCta = 'Continue';
      stepState = 'progress';
    } else {
      title = 'Continue setup content';
      label = 'Setup part 1 started but not finished';
      statusText = 'Continue';
      statusState = 'continue';
      showCard = true;
      cardTitle = 'Pick up where you left off,\njust a few steps to unlock the best of XREX!';
      cardCta = 'Continue';
      stepState = 'progress';
    }

    titleEl.textContent = title;
    titleEl.dataset.setupLabel = label;
    titleEl.classList.toggle('is-warning', isWarning);
    if (statusEl) {
      statusEl.textContent = statusText;
      statusEl.dataset.setupStatus = statusState;
    }
    if (setupStateEl) setupStateEl.dataset.setupLabel = label;
    const toggleHidden = (el, shouldHide) => {
      if (!el) return;
      el.hidden = shouldHide;
      el.classList.toggle('is-hidden', shouldHide);
    };

    toggleHidden(firstTimeEl, !showCard);
    toggleHidden(titleEl, showCard);
    toggleHidden(setupStateEl, !showCard);
    toggleHidden(assetCardEl, showCard);
    if (cardTitleEl) {
      const safeTitle = cardTitle.replace(/\n/g, '<br />');
      cardTitleEl.innerHTML = safeTitle;
    }
    if (cardSubtitleEl) {
      cardSubtitleEl.textContent = cardSubtitle;
      cardSubtitleEl.hidden = !cardSubtitle;
    }
    if (cardCtaEl && cardCta) cardCtaEl.textContent = cardCta;
    if (finalStepEl) finalStepEl.textContent = finalStepLabel;
    if (btnSecondaryEl) btnSecondaryEl.hidden = hideSecondaryBtn;
    if (btnPrimaryEl) btnPrimaryEl.hidden = hidePrimaryBtn;
    if (heroEl) {
      const useIllustration = statusState === 'getstarted' || statusState === 'continue';
      heroEl.classList.toggle('is-illustration', useIllustration);
      heroEl.style.backgroundImage = useIllustration
        ? "url('assets/illu_setup_1.svg')"
        : '';
    }
    if (buttonsWrapEl) {
      const visibleButtons = Array.from(
        buttonsWrapEl.querySelectorAll('.setup-first__button'),
      ).filter((button) => !button.hidden);
      buttonsWrapEl.classList.toggle('is-single', visibleButtons.length === 1);
      const isWideSingle = visibleButtons.length === 1
        && (stepState === 'reviewing' || stepState === 'resubmission');
      buttonsWrapEl.classList.toggle('is-single-wide', isWideSingle);
    }

    const clearStep = (el) => {
      if (!el) return;
      el.classList.remove('is-done', 'is-current', 'is-rail-before-active', 'is-rail-after-active');
    };
    [stepSignUpEl, stepNextEl, stepFinalEl].forEach(clearStep);

    if (stepState === 'reviewing') {
      if (stepFinalEl) stepFinalEl.classList.add('is-current');
      if (stepSignUpEl) stepSignUpEl.classList.add('is-done', 'is-rail-after-active');
      if (stepNextEl) stepNextEl.classList.add('is-done', 'is-rail-after-active', 'is-rail-before-active');
      if (stepFinalEl) stepFinalEl.classList.add('is-rail-before-active');
    } else {
      if (stepSignUpEl) stepSignUpEl.classList.add('is-done', 'is-rail-after-active');
      if (stepNextEl) stepNextEl.classList.add('is-current', 'is-rail-before-active');
    }

    const updateStepIcon = (el) => {
      if (!el) return;
      const icon = el.querySelector('[data-setup-step-icon]');
      if (!icon) return;
      if (el.classList.contains('is-done')) {
        icon.src = 'assets/icon_timeline_completed.svg';
      } else if (el.classList.contains('is-current')) {
        icon.src = isWarning
          ? 'assets/icon_timeline_activewarning.svg'
          : 'assets/icon_timeline_active.svg';
      } else {
        icon.src = 'assets/icon_timeline_upcoming.svg';
      }
    };

    [stepSignUpEl, stepNextEl, stepFinalEl].forEach(updateStepIcon);
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
    updateSetupState();
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
    updateSetupState();
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

  const initSideMenu = () => {
    const container = document.querySelector('.phone-container');
    const trigger = document.querySelector('[data-menu-trigger]');
    const overlay = document.querySelector('.side-menu-overlay');
    const scrollable = document.querySelector('.side-menu__content');
    if (!container || !trigger || !overlay) return;

    const openMenu = () => {
      container.classList.add('is-menu-open');
      if (scrollable) scrollable.scrollTop = 0;
    };
    const closeMenu = () => container.classList.remove('is-menu-open');

    trigger.addEventListener('click', openMenu);
    overlay.addEventListener('click', (event) => {
      if (event.target.closest('[data-menu-close]')) closeMenu();
    });
  };

  initSideMenu();

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
