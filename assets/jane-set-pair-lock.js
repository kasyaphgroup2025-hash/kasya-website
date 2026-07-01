(() => {
  const CHECK_DELAY = 200;
  const ACTIVE_POLL_INTERVAL = 1000;
  const IDLE_POLL_INTERVAL = 5000;
  const CONTROL_EVENTS = ['pointerdown', 'mousedown', 'touchstart', 'click'];
  let isSyncingJaneSet = false;
  let janeSetSyncTimer = null;
  let pollTimer = null;
  let cachedCart = null;
  let previousQuantities = new Map();
  let requestSequence = 0;
  const activeJaneSetRequests = new Map();
  const handledControls = new WeakMap();

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isJaneSetItem(item) {
    return Boolean(
      item?.properties?._set_id &&
      item.properties._set_name === 'Jane Set' &&
      ['Top', 'Pants'].includes(item.properties._set_role)
    );
  }

  function groupJaneSetItems(items) {
    return items.reduce((groups, item) => {
      if (!isJaneSetItem(item)) return groups;
      const setId = item.properties._set_id;
      groups[setId] = groups[setId] || [];
      groups[setId].push(item);
      return groups;
    }, {});
  }

  function pairFor(items, setId) {
    const group = groupJaneSetItems(items)[setId] || [];
    return {
      top: group.find(item => item.properties._set_role === 'Top'),
      pants: group.find(item => item.properties._set_role === 'Pants')
    };
  }

  function snapshotCart(cart) {
    cachedCart = cart;
    previousQuantities = new Map(cart.items.map(item => [item.key, item.quantity]));
    window.requestAnimationFrame(setupJaneSetControls);
  }

  function actionFor(control) {
    const actionText = [
      control.getAttribute('name'),
      control.getAttribute('aria-label'),
      control.getAttribute('title'),
      control.className,
      control.textContent
    ].filter(Boolean).join(' ').toLowerCase();

    if (/(remove|delete|trash)/.test(actionText)) return 'remove';
    if (/(minus|decrease|decrement)/.test(actionText)) return 'decrease';
    if (/(plus|increase|increment)/.test(actionText)) return 'increase';
    return null;
  }

  function isCartSurface(element) {
    return Boolean(element?.closest?.(
      'cart-drawer, cart-items, [class*="aov" i], [id*="aov" i], [class*="cart" i], [id*="cart" i]'
    ));
  }

  function identifyingTokens(item) {
    return {
      sku: normalize(item.properties._set_component_sku || item.sku),
      roleTitle: item.properties._set_role === 'Top' ? 'jane blouse' : 'jane pants'
    };
  }

  function matchingLines(text, items) {
    const normalizedText = normalize(text);
    const skuMatches = items.filter(item => {
      const sku = identifyingTokens(item).sku;
      return sku && normalizedText.includes(sku);
    });
    if (skuMatches.length) return skuMatches;

    return items.filter(item => normalizedText.includes(identifyingTokens(item).roleTitle));
  }

  function actionControls(card) {
    if (!card) return [];
    return [...card.querySelectorAll('button, a, [role="button"]')]
      .filter(control => actionFor(control));
  }

  function matchControl(control) {
    if (!cachedCart) return null;

    const janeLines = cachedCart.items.filter(isJaneSetItem);
    let element = control;
    while (element && element !== document.body) {
      const matches = matchingLines(element.textContent, janeLines);
      if (matches.length === 1) return { card: element, line: matches[0] };
      if (matches.length > 1) return null;
      if (element.matches?.(
        'cart-drawer, cart-items, [class*="aov" i], [id*="aov" i]'
      )) break;
      element = element.parentElement;
    }
    return null;
  }

  function findCardForLine(line, surface = document.body) {
    if (!line || !cachedCart) return null;

    const janeLines = cachedCart.items.filter(isJaneSetItem);
    return [...surface.querySelectorAll('*')]
      .filter(element => {
        if (!actionControls(element).length) return false;
        const matches = matchingLines(element.textContent, janeLines);
        return matches.length === 1 && matches[0].key === line.key;
      })
      .sort((first, second) => first.textContent.length - second.textContent.length)[0] || null;
  }

  function quantityInput(card, control = null) {
    const wrapper = control?.closest?.(
      '[class*="quantity" i], [class*="qty" i], [data-quantity], [data-qty]'
    );
    const selector =
      'input[type="number"], input[name*="quantity" i], [role="spinbutton"], [aria-valuenow]';
    return wrapper?.querySelector(selector) || card?.querySelector(selector) || null;
  }

  function displayedQuantity(card, control, fallbackQuantity) {
    const input = quantityInput(card, control);
    const inputQuantity = Number.parseInt(
      input?.value || input?.getAttribute('aria-valuenow'),
      10
    );
    if (Number.isInteger(inputQuantity) && inputQuantity >= 0) return inputQuantity;

    const wrapper = control?.closest?.(
      '[class*="quantity" i], [class*="qty" i], [data-quantity], [data-qty]'
    ) || card;
    const visibleValue = [...(wrapper?.querySelectorAll('span, output, div') || [])]
      .map(element => String(element.textContent || '').trim())
      .find(value => /^\d+$/.test(value));
    const visibleQuantity = Number.parseInt(visibleValue, 10);
    return Number.isInteger(visibleQuantity) ? visibleQuantity : fallbackQuantity;
  }

  function setOptimisticQuantity(card, quantity) {
    const input = quantityInput(card);
    if (!input) return;

    const value = String(quantity);
    if ('value' in input && String(input.value) !== value) input.value = value;
    if (input.getAttribute('value') !== value) input.setAttribute('value', value);
    if (input.getAttribute('aria-valuenow') !== value) input.setAttribute('aria-valuenow', value);
  }

  function setCardBusy(card, busy, removing = false) {
    if (!card) return;

    card.toggleAttribute('data-jane-set-syncing', busy);
    card.setAttribute('aria-busy', String(busy));
    card.style.opacity = busy && removing ? '0.55' : '';
    actionControls(card).forEach(control => {
      control.toggleAttribute('disabled', busy);
      control.setAttribute('aria-disabled', String(busy));
    });
  }

  function isLatestRequest(setId, requestId) {
    return activeJaneSetRequests.get(setId)?.requestId === requestId;
  }

  function applyActiveRequestToUi(setId) {
    if (!cachedCart) return;
    const request = activeJaneSetRequests.get(setId);
    if (!request) return;

    const { top, pants } = pairFor(cachedCart.items, setId);
    if (!top || !pants) return;
    const topCard = findCardForLine(top);
    const pantsCard = findCardForLine(pants);
    setOptimisticQuantity(topCard, request.targetQty);
    setOptimisticQuantity(pantsCard, request.targetQty);
    setCardBusy(topCard, request.pending, request.targetQty === 0);
    setCardBusy(pantsCard, request.pending, request.targetQty === 0);
  }

  function setupJaneSetControls() {
    if (!cachedCart) return;

    cachedCart.items.filter(isJaneSetItem).forEach(item => {
      const card = findCardForLine(item);
      if (!card) return;
      card.dataset.janeSetControlled = 'true';

      actionControls(card).forEach(control => {
        if (control.dataset.janeSetControlled === 'true') return;
        const clone = control.cloneNode(true);
        clone.dataset.janeSetControlled = 'true';
        control.replaceWith(clone);
      });
    });

    activeJaneSetRequests.forEach((request, setId) => {
      if (request.pending || Date.now() <= request.protectUntil) applyActiveRequestToUi(setId);
    });
  }

  function warnRequestFailure(endpoint, response, body, setId, targetQty) {
    console.warn('Jane Set cart request failed.', {
      endpoint,
      status: response?.status,
      body,
      setId,
      targetQty
    });
  }

  async function requestJson(endpoint, options, setId, targetQty) {
    let response;
    try {
      response = await fetch(endpoint, options);
    } catch (error) {
      warnRequestFailure(endpoint, null, error.message, setId, targetQty);
      throw error;
    }
    const text = await response.text();
    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      data = {};
    }

    if (!response.ok || data.errors) {
      warnRequestFailure(endpoint, response, text || data, setId, targetQty);
      const message = data.description || data.message || data.errors || 'Cart update failed.';
      throw new Error(typeof message === 'string' ? message : 'Cart update failed.');
    }
    return data;
  }

  function jsonRequest(body) {
    return {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    };
  }

  async function fetchLatestCart(setId, targetQty) {
    return requestJson(
      '/cart.js',
      { headers: { 'Accept': 'application/json' } },
      setId,
      targetQty
    );
  }

  async function removePairByIndexes(setId, targetQty, initialCart) {
    const initialPair = pairFor(initialCart.items, setId);
    if (!initialPair.top || !initialPair.pants) throw new Error('Jane Set pair is incomplete.');

    const roles = ['Top', 'Pants'].sort((firstRole, secondRole) => {
      const first = firstRole === 'Top' ? initialPair.top : initialPair.pants;
      const second = secondRole === 'Top' ? initialPair.top : initialPair.pants;
      return initialCart.items.indexOf(second) - initialCart.items.indexOf(first);
    });

    let cart = initialCart;
    for (const role of roles) {
      cart = await fetchLatestCart(setId, targetQty);
      const index = cart.items.findIndex(item =>
        item.properties?._set_id === setId &&
        item.properties?._set_name === 'Jane Set' &&
        item.properties?._set_role === role
      );
      if (index === -1) continue;
      cart = await requestJson(
        '/cart/change.js',
        jsonRequest({ line: index + 1, quantity: 0 }),
        setId,
        targetQty
      );
    }
    return cart;
  }

  async function removePair(setId, targetQty, cart) {
    const { top, pants } = pairFor(cart.items, setId);
    if (!top || !pants) throw new Error('Jane Set pair is incomplete.');

    try {
      return await requestJson(
        '/cart/update.js',
        jsonRequest({
          updates: {
            [top.key]: 0,
            [pants.key]: 0
          }
        }),
        setId,
        targetQty
      );
    } catch (error) {
      return removePairByIndexes(setId, targetQty, cart);
    }
  }

  async function replacePairQuantity(setId, targetQty, requestId) {
    const cart = await fetchLatestCart(setId, targetQty);
    if (!isLatestRequest(setId, requestId)) return null;

    const { top, pants } = pairFor(cart.items, setId);
    if (!top || !pants) throw new Error('Jane Set pair is incomplete.');
    const components = [top, pants].map(item => ({
      id: item.variant_id,
      quantity: targetQty,
      properties: { ...item.properties }
    }));

    const removedCart = await removePair(setId, targetQty, cart);
    if (!isLatestRequest(setId, requestId)) return null;
    if (targetQty === 0) return removedCart;

    await requestJson(
      '/cart/add.js',
      jsonRequest({ items: components }),
      setId,
      targetQty
    );
    if (!isLatestRequest(setId, requestId)) return null;
    return fetchLatestCart(setId, targetQty);
  }

  function dispatchCartRefresh(cart) {
    ['afterCartChanged', 'cart:refresh', 'cart:updated'].forEach(eventName => {
      document.dispatchEvent(new CustomEvent(eventName, {
        bubbles: true,
        detail: {
          source: 'jane-set-pair-lock',
          cartData: cart,
          cart
        }
      }));
    });
  }

  async function runPairAction(match, control, action) {
    const setId = match.line.properties._set_id;
    if (activeJaneSetRequests.get(setId)?.pending) return;

    const pair = pairFor(cachedCart.items, setId);
    if (!pair.top || !pair.pants) return;
    const surface = match.card.closest(
      'cart-drawer, cart-items, [class*="aov" i], [id*="aov" i], [class*="cart" i], [id*="cart" i]'
    );
    const topCard = pair.top.key === match.line.key ? match.card : findCardForLine(pair.top, surface);
    const pantsCard = pair.pants.key === match.line.key ? match.card : findCardForLine(pair.pants, surface);
    const visibleQty = displayedQuantity(match.card, control, match.line.quantity);
    const targetQty = action === 'remove'
      ? 0
      : Math.max(0, visibleQty + (action === 'increase' ? 1 : -1));
    const requestId = ++requestSequence;
    const previousQty = {
      top: displayedQuantity(topCard, null, pair.top.quantity),
      pants: displayedQuantity(pantsCard, null, pair.pants.quantity)
    };

    activeJaneSetRequests.set(setId, {
      requestId,
      targetQty,
      timestamp: Date.now(),
      pending: true,
      protectUntil: Number.POSITIVE_INFINITY
    });
    isSyncingJaneSet = true;
    setOptimisticQuantity(topCard, targetQty);
    setOptimisticQuantity(pantsCard, targetQty);
    setCardBusy(topCard, true, targetQty === 0);
    setCardBusy(pantsCard, true, targetQty === 0);

    try {
      const updatedCart = await replacePairQuantity(setId, targetQty, requestId);
      if (!updatedCart || !isLatestRequest(setId, requestId)) return;

      activeJaneSetRequests.set(setId, {
        requestId,
        targetQty,
        timestamp: Date.now(),
        pending: false,
        protectUntil: Date.now() + 2000
      });
      snapshotCart(updatedCart);
      dispatchCartRefresh(updatedCart);
    } catch (error) {
      if (!isLatestRequest(setId, requestId)) return;
      activeJaneSetRequests.delete(setId);
      setOptimisticQuantity(topCard, previousQty.top);
      setOptimisticQuantity(pantsCard, previousQty.pants);
      console.warn('Jane Set quantity operation failed after all fallbacks.', {
        setId,
        targetQty,
        error
      });
    } finally {
      if (isLatestRequest(setId, requestId)) {
        const state = activeJaneSetRequests.get(setId);
        if (state) state.pending = false;
      }
      isSyncingJaneSet = [...activeJaneSetRequests.values()].some(request => request.pending);
      setCardBusy(topCard, false);
      setCardBusy(pantsCard, false);
      scheduleCheck();
    }
  }

  function suppressJaneSetControlEvent(event) {
    const control = event.target.closest?.('button, a, [role="button"]');
    if (!control || !isCartSurface(control)) return;

    const action = actionFor(control);
    const match = action ? matchControl(control) : null;
    if (!match) return;
    const pair = pairFor(cachedCart.items, match.line.properties._set_id);
    if (!pair.top || !pair.pants) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    const previousEvent = handledControls.get(control);
    const now = Date.now();
    if (previousEvent && now - previousEvent < 800) return;

    const shouldRun =
      event.type === 'pointerdown' ||
      (event.type === 'touchstart' && !('PointerEvent' in window)) ||
      (event.type === 'mousedown' && !('PointerEvent' in window)) ||
      event.type === 'click';
    if (!shouldRun) return;

    handledControls.set(control, now);
    runPairAction(match, control, action);
  }

  CONTROL_EVENTS.forEach(eventName => {
    window.addEventListener(eventName, suppressJaneSetControlEvent, {
      capture: true,
      passive: false
    });
    document.addEventListener(eventName, suppressJaneSetControlEvent, {
      capture: true,
      passive: false
    });
  });

  async function safetyCheck() {
    if (isSyncingJaneSet || document.hidden) return;

    try {
      const cart = await fetchLatestCart('safety-check', null);
      const groups = groupJaneSetItems(cart.items);
      const updates = {};

      Object.entries(groups).forEach(([setId, items]) => {
        if (activeJaneSetRequests.get(setId)?.pending) return;
        const top = items.find(item => item.properties._set_role === 'Top');
        const pants = items.find(item => item.properties._set_role === 'Pants');
        const request = activeJaneSetRequests.get(setId);
        const protectedTarget = request && Date.now() <= request.protectUntil
          ? request.targetQty
          : null;

        if (!top || !pants) {
          items.forEach(item => {
            updates[item.key] = 0;
          });
          return;
        }
        if (
          top.quantity === pants.quantity &&
          (protectedTarget === null || top.quantity === protectedTarget)
        ) return;

        const previousTop = previousQuantities.get(top.key);
        const previousPants = previousQuantities.get(pants.key);
        const topChanged = previousTop !== undefined && top.quantity !== previousTop;
        const pantsChanged = previousPants !== undefined && pants.quantity !== previousPants;
        const targetQty = protectedTarget ?? (
          topChanged && !pantsChanged
            ? top.quantity
            : pantsChanged && !topChanged
              ? pants.quantity
              : Math.min(top.quantity, pants.quantity)
        );
        updates[top.key] = targetQty;
        updates[pants.key] = targetQty;
      });

      snapshotCart(cart);
      if (Object.keys(updates).length) {
        const updatedCart = await requestJson(
          '/cart/update.js',
          jsonRequest({ updates }),
          'safety-check',
          null
        );
        snapshotCart(updatedCart);
        dispatchCartRefresh(updatedCart);
      }
    } catch (error) {
      // Failed requests are already logged with endpoint details.
    } finally {
      schedulePoll();
    }
  }

  function scheduleCheck(delay = CHECK_DELAY) {
    window.clearTimeout(janeSetSyncTimer);
    janeSetSyncTimer = window.setTimeout(safetyCheck, delay);
  }

  function schedulePoll() {
    window.clearTimeout(pollTimer);
    const hasJaneSet = cachedCart?.items?.some(isJaneSetItem);
    pollTimer = window.setTimeout(
      safetyCheck,
      hasJaneSet ? ACTIVE_POLL_INTERVAL : IDLE_POLL_INTERVAL
    );
  }

  document.addEventListener('afterCartChanged', event => {
    if (event.detail?.cartData?.items && !isSyncingJaneSet) snapshotCart(event.detail.cartData);
    if (!isSyncingJaneSet) scheduleCheck();
  });
  document.addEventListener('cart:updated', event => {
    if (event.detail?.cart?.items && !isSyncingJaneSet) snapshotCart(event.detail.cart);
    if (!isSyncingJaneSet) scheduleCheck();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleCheck(0);
  });

  const cartObserver = new MutationObserver(mutations => {
    if (!mutations.some(mutation => isCartSurface(mutation.target))) return;
    setupJaneSetControls();
    activeJaneSetRequests.forEach((request, setId) => {
      if (request.pending || Date.now() <= request.protectUntil) applyActiveRequestToUi(setId);
    });
    if (!isSyncingJaneSet) scheduleCheck();
  });
  cartObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  scheduleCheck(0);
})();
