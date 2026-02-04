(() => {
  const STATE_CONFIGS = {
    basic: {
      storageKey: 'xrexexchangekyc.basicState.v2',
      min: 1,
      max: 3,
      labels: {
        1: 'Not submitted',
        2: 'Submitted',
        3: 'Approved',
      },
    },
    identity: {
      storageKey: 'xrexexchangekyc.identityState.v1',
      min: 1,
      max: 4,
      labels: {
        1: 'Not submitted',
        2: 'Submitted',
        3: 'Approved',
        4: 'Resubmission',
      },
    },
    questionnaire: {
      storageKey: 'xrexexchangekyc.questionnaireState.v1',
      min: 1,
      max: 4,
      labels: {
        1: 'Not enabled',
        2: 'Enabled, awaiting...',
        3: 'Approved',
        4: 'More info required',
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
  let rejectedOverride = false;

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
    }) || states.questionnaire === 2 || states.questionnaire === 4;
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
    if (!isUnlocked && states.bank !== 1) {
      setState('bank', 1, { force: true });
    }
  };

  const updateQuestionnaireAvailability = () => {
    const questionnaireGroup = document.querySelector('[data-state-group="questionnaire"]');
    const basicGroup = document.querySelector('[data-state-group="basic"]');
    const identityGroup = document.querySelector('[data-state-group="identity"]');
    if (!questionnaireGroup) return;
    const isUnlocked = states.basic >= 2 && states.identity >= 2;
    questionnaireGroup.classList.toggle('is-locked', !isUnlocked);
    questionnaireGroup.setAttribute('aria-disabled', String(!isUnlocked));
    if (!isUnlocked && states.questionnaire !== 1) {
      setState('questionnaire', 1, { force: true });
    }
    if (states.questionnaire >= 2) {
      if (states.basic !== 3) setState('basic', 3, { force: true });
      if (states.identity !== 3) setState('identity', 3, { force: true });
    }
    const lockBasicIdentity = states.questionnaire >= 2;
    if (basicGroup) {
      basicGroup.classList.toggle('is-locked', lockBasicIdentity);
      basicGroup.setAttribute('aria-disabled', String(lockBasicIdentity));
    }
    if (identityGroup) {
      identityGroup.classList.toggle('is-locked', lockBasicIdentity);
      identityGroup.setAttribute('aria-disabled', String(lockBasicIdentity));
    }
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
    }) || states.questionnaire === 2 || states.questionnaire === 4;
    const isQuestionnaireActive = states.questionnaire > 1;
    const isQuestionnaireSubmitted = states.questionnaire === 3;
    const isQuestionnaireApproved = states.questionnaire === 3;
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
      cardTitle = 'Pick up where you left off,\nunlock the best of XREX!';
      cardCta = 'Continue';
      stepState = 'progress';
    } else {
      title = 'Continue setup content';
      label = 'Setup part 1 started but not finished';
      statusText = 'Continue';
      statusState = 'continue';
      showCard = true;
      cardTitle = 'Pick up where you left off,\nunlock the best of XREX!';
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
      let illustration = '';
      if (statusState === 'getstarted' || statusState === 'continue') {
        illustration = 'assets/illu_setup_1.png';
      } else if (statusState === 'resubmission') {
        illustration = 'assets/illu_setup_2_resubmit.png';
      } else if (statusState === 'reviewing') {
        illustration = 'assets/illu_setup_3_reviewing.png';
      }
      heroEl.classList.toggle('is-illustration', Boolean(illustration));
      heroEl.style.backgroundImage = illustration ? `url('${illustration}')` : '';
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

  const updateChecklistItems = () => {
    const basicItem = document.querySelector('[data-checklist-item="basic"]');
    const identityItem = document.querySelector('[data-checklist-item="identity"]');
    const bankItem = document.querySelector('[data-checklist-item="bank"]');
    const questionnaireItem = document.querySelector('[data-checklist-item="questionnaire"]');
    const stepsEl = document.querySelector('[data-checklist-steps]');
    const ringEl = document.querySelector('[data-checklist-ring]');
    const ctaEl = document.querySelector('[data-checklist-cta]');
    const ctaNoteEl = document.querySelector('[data-checklist-cta-note]');
    const checklistCard = document.querySelector('.setup-checklist__card');
    const checklistContent = document.querySelector('.setup-checklist__content');
    const rejectedEl = document.querySelector('[data-checklist-rejected]');

    const resetItemState = (item, defaultIcon) => {
      if (!item) return;
      const icon = item.querySelector('[data-checklist-icon]');
      const iconWrap = item.querySelector('.setup-checklist__item-icon');
      const action = item.querySelector('[data-checklist-action]');
      const status = item.querySelector('[data-checklist-status]');
      const meta = item.querySelector('.setup-checklist__item-meta');
      if (icon) icon.src = defaultIcon;
      if (iconWrap) iconWrap.classList.remove('setup-checklist__item-icon--transparent');
      if (status) {
        status.textContent = '';
        status.classList.remove('setup-checklist__item-status-label--success', 'setup-checklist__item-status-label--warning');
      }
      if (meta) meta.hidden = false;
      if (action) {
        action.disabled = false;
        action.classList.remove('is-disabled');
      }
    };

    const applyProcessingState = (item, defaultIcon) => {
      if (!item) return;
      const icon = item.querySelector('[data-checklist-icon]');
      const iconWrap = item.querySelector('.setup-checklist__item-icon');
      const action = item.querySelector('[data-checklist-action]');
      const status = item.querySelector('[data-checklist-status]');
      const meta = item.querySelector('.setup-checklist__item-meta');
      if (icon) icon.src = 'assets/icon_processing.svg';
      if (iconWrap) iconWrap.classList.add('setup-checklist__item-icon--transparent');
      if (status) {
        status.textContent = 'Reviewing';
        status.classList.remove('setup-checklist__item-status-label--success', 'setup-checklist__item-status-label--warning');
      }
      if (meta) meta.hidden = true;
      if (action) {
        action.disabled = true;
        action.classList.add('is-disabled');
      }
    };

    if (states.basic === 2) {
      applyProcessingState(basicItem, 'assets/icon-checklist-basicprofile.svg');
    } else if (states.basic === 3) {
      if (basicItem) {
        const icon = basicItem.querySelector('[data-checklist-icon]');
        const iconWrap = basicItem.querySelector('.setup-checklist__item-icon');
        const action = basicItem.querySelector('[data-checklist-action]');
        const status = basicItem.querySelector('[data-checklist-status]');
        const meta = basicItem.querySelector('.setup-checklist__item-meta');
        if (icon) icon.src = 'assets/icon_timeline_completed.svg';
        if (iconWrap) iconWrap.classList.add('setup-checklist__item-icon--transparent');
        if (status) {
          status.textContent = 'Verified';
          status.classList.remove('setup-checklist__item-status-label--warning');
          status.classList.add('setup-checklist__item-status-label--success');
        }
        if (meta) meta.hidden = true;
        if (action) {
          action.disabled = true;
          action.classList.add('is-disabled');
        }
      }
    } else {
      resetItemState(basicItem, 'assets/icon-checklist-basicprofile.svg');
    }

    if (states.identity === 2) {
      applyProcessingState(identityItem, 'assets/icon-checklist-identityverification.svg');
    } else if (states.identity === 3) {
      if (identityItem) {
        const icon = identityItem.querySelector('[data-checklist-icon]');
        const iconWrap = identityItem.querySelector('.setup-checklist__item-icon');
        const action = identityItem.querySelector('[data-checklist-action]');
        const status = identityItem.querySelector('[data-checklist-status]');
        const meta = identityItem.querySelector('.setup-checklist__item-meta');
        if (icon) icon.src = 'assets/icon_timeline_completed.svg';
        if (iconWrap) iconWrap.classList.add('setup-checklist__item-icon--transparent');
        if (status) {
          status.textContent = 'Verified';
          status.classList.remove('setup-checklist__item-status-label--warning');
          status.classList.add('setup-checklist__item-status-label--success');
        }
        if (meta) meta.hidden = true;
        if (action) {
          action.disabled = true;
          action.classList.add('is-disabled');
        }
      }
    } else if (states.identity === 4) {
      if (identityItem) {
        const icon = identityItem.querySelector('[data-checklist-icon]');
        const iconWrap = identityItem.querySelector('.setup-checklist__item-icon');
        const action = identityItem.querySelector('[data-checklist-action]');
        const status = identityItem.querySelector('[data-checklist-status]');
        const meta = identityItem.querySelector('.setup-checklist__item-meta');
        if (icon) icon.src = 'assets/icon-checklist-identityverification.svg';
        if (iconWrap) iconWrap.classList.remove('setup-checklist__item-icon--transparent');
        if (status) {
          status.textContent = '{$resubmissionMessage}';
          status.classList.remove('setup-checklist__item-status-label--success');
          status.classList.add('setup-checklist__item-status-label--warning');
        }
        if (meta) meta.hidden = true;
        if (action) {
          action.disabled = false;
          action.classList.remove('is-disabled');
        }
      }
    } else {
      resetItemState(identityItem, 'assets/icon-checklist-identityverification.svg');
    }

    const bankUnlocked = states.basic >= 2 && states.identity >= 2;
    if (bankItem) {
      bankItem.classList.toggle('is-disabled', !bankUnlocked);
      const action = bankItem.querySelector('[data-checklist-action]');
      const icon = bankItem.querySelector('[data-checklist-icon]');
      const status = bankItem.querySelector('[data-checklist-status]');
      const meta = bankItem.querySelector('.setup-checklist__item-meta');
      const isBankProcessing = states.bank === 2;
      if (action) {
        action.disabled = !bankUnlocked || isBankProcessing;
        action.classList.toggle('is-disabled', !bankUnlocked || isBankProcessing);
      }
      if (icon) {
        icon.src = isBankProcessing ? 'assets/icon_processing.svg' : 'assets/icon_bankaccounts.svg';
      }
      if (status) status.textContent = isBankProcessing ? 'Reviewing' : '';
      if (meta) meta.hidden = isBankProcessing;
      bankItem.classList.toggle('is-processing', isBankProcessing);
    }

    if (ctaEl) {
      const isBankProcessing = states.bank === 2;
      ctaEl.disabled = isBankProcessing;
      ctaEl.classList.toggle('is-disabled', isBankProcessing);
      if (ctaNoteEl) ctaNoteEl.hidden = !isBankProcessing;
    }

    const isQuestionnaireActive = states.questionnaire >= 2;
    if (questionnaireItem) {
      const shouldHide = !isQuestionnaireActive;
      questionnaireItem.hidden = shouldHide;
      questionnaireItem.classList.toggle('is-hidden', shouldHide);
      questionnaireItem.classList.remove('is-disabled');
      const action = questionnaireItem.querySelector('[data-checklist-action]');
      const meta = questionnaireItem.querySelector('[data-checklist-meta]');
      const status = questionnaireItem.querySelector('[data-checklist-status]');
      if (action) {
        const isApproved = states.questionnaire === 3;
        action.disabled = !isQuestionnaireActive || isApproved;
        action.classList.toggle('is-disabled', !isQuestionnaireActive || isApproved);
      }
      if (meta) {
        meta.textContent = (states.questionnaire === 2 || states.questionnaire === 4)
          ? 'Our team needs a bit more information. Please complete a short form by'
          : '';
        meta.hidden = !meta.textContent;
      }
      if (status) {
        if (states.questionnaire === 2 || states.questionnaire === 4) {
          status.textContent = '02/09/2077';
          status.classList.remove('setup-checklist__item-status-label--success');
          status.classList.add('setup-checklist__item-status-label--warning');
        } else if (states.questionnaire === 3) {
          status.textContent = 'Verified';
          status.classList.remove('setup-checklist__item-status-label--warning');
          status.classList.add('setup-checklist__item-status-label--success');
        } else {
          status.textContent = '';
          status.classList.remove('setup-checklist__item-status-label--warning', 'setup-checklist__item-status-label--success');
        }
        status.hidden = !status.textContent;
      }
    }

    let stepsRemaining = 4;
    if (states.basic >= 2 || states.identity >= 2) stepsRemaining = 3;
    if (states.basic >= 2 && states.identity >= 2) stepsRemaining = 2;
    if (isQuestionnaireActive) stepsRemaining += 1;
    if (states.bank === 2) stepsRemaining = Math.max(1, stepsRemaining - 1);
    if (states.identity === 4) stepsRemaining += 1;

    if (stepsEl) {
      stepsEl.textContent = `${stepsRemaining} step${stepsRemaining === 1 ? '' : 's'} to go`;
    }

    if (ringEl) {
      const totalSteps = isQuestionnaireActive ? 6 : 5;
      const completedSteps = Math.max(0, totalSteps - stepsRemaining);
      const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
      ringEl.style.setProperty('--progress', `${progressPercent}%`);
    }

    const isRejected = rejectedOverride;
    if (rejectedEl) rejectedEl.hidden = !isRejected;
    if (checklistCard) checklistCard.hidden = false;
    if (checklistContent) checklistContent.hidden = isRejected;
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
    updateQuestionnaireAvailability();
    updateSetupState();
    updateChecklistItems();
    requestAnimationFrame(() => {
      updateBankAvailability();
      updateQuestionnaireAvailability();
      updateChecklistItems();
    });
  };
  const initStates = () => {
    Object.keys(STATE_CONFIGS).forEach((group) => {
      const config = STATE_CONFIGS[group];
      const initial = config.min;
      const clamped = clamp(initial, config.min, config.max);
      states[group] = clamped;
      applyDatasetState(group, clamped);
      try {
        if (window.localStorage) {
          window.localStorage.setItem(config.storageKey, String(clamped));
        }
      } catch (_) {
        // ignore storage errors
      }
    });
    rejectedOverride = false;
    updateGradientBackground();
    updateBankAvailability();
    updateQuestionnaireAvailability();
    updateSetupState();
    updateChecklistItems();
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
    updateBankAvailability();
    updateQuestionnaireAvailability();
    updateChecklistItems();
  };

  const initRejectedToggle = () => {
    const checkbox = document.querySelector('[data-rejected-toggle]');
    const badge = document.querySelector('.build-badge');
    const groups = document.querySelectorAll('.build-badge__group');
    if (!checkbox) return;
    checkbox.checked = false;
    const applyLock = (isLocked) => {
      if (badge) badge.classList.toggle('is-rejected', isLocked);
      groups.forEach((group) => group.classList.toggle('is-locked', isLocked));
    };
    applyLock(checkbox.checked);
    updateChecklistItems();
    checkbox.addEventListener('change', () => {
      rejectedOverride = checkbox.checked;
      applyLock(rejectedOverride);
      updateChecklistItems();
    });
  };

  const initChecklistPanel = () => {
    const panel = document.querySelector('[data-setup-checklist]');
    const container = document.querySelector('.phone-container');
    if (!panel) return;
    const openButtons = document.querySelectorAll('[data-setup-open]');
    const closeButtons = panel.querySelectorAll('[data-setup-close]');

    const setOpen = (nextOpen) => {
      if (nextOpen) {
        panel.hidden = false;
        if (container) {
          container.classList.remove('is-checklist-open');
          container.classList.remove('is-checklist-fading');
        }
        const scrollBody = panel.querySelector('.setup-checklist__body');
        if (scrollBody) scrollBody.scrollTop = 0;
        requestAnimationFrame(() => {
          panel.classList.add('is-open');
        });
        setTimeout(() => {
          if (container && panel.classList.contains('is-open')) {
            container.classList.add('is-checklist-fading');
          }
        }, 80);
        setTimeout(() => {
          if (container && panel.classList.contains('is-open')) {
            container.classList.add('is-checklist-open');
          }
        }, 350);
      } else {
        panel.classList.remove('is-open');
        if (container) {
          container.classList.add('is-checklist-fading');
          container.classList.remove('is-checklist-open');
          requestAnimationFrame(() => {
            container.classList.remove('is-checklist-fading');
          });
        }
        const onEnd = () => {
          if (!panel.classList.contains('is-open')) {
            panel.hidden = true;
          }
          panel.removeEventListener('transitionend', onEnd);
        };
        panel.addEventListener('transitionend', onEnd);
        setTimeout(onEnd, 400);
      }
    };

    openButtons.forEach((button) => {
      button.addEventListener('click', () => {
        if (container && container.classList.contains('is-menu-open')) {
          container.classList.remove('is-menu-open');
          setTimeout(() => setOpen(true), 220);
        } else {
          setOpen(true);
        }
      });
    });
    closeButtons.forEach((button) => {
      button.addEventListener('click', () => setOpen(false));
    });

    panel.querySelectorAll('[data-checklist-item-action]').forEach((item) => {
      item.addEventListener('click', (event) => {
        if (event.target.closest('.setup-checklist__item-action')) return;
        const action = item.querySelector('.setup-checklist__item-action');
        if (action && !action.disabled) action.click();
      });
    });

    setOpen(true);
  };

  initStates();
  initBadgeControls();
  initChecklistPanel();
  initRejectedToggle();

  const initHeaderScrollSwap = () => {
    const header = document.querySelector('.app-header');
    const topChrome = document.querySelector('.top-chrome');
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
        if (topChrome) topChrome.classList.toggle('is-scrolled', isScrolled);
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
