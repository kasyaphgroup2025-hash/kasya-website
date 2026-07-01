(() => {
  const CHECK_DELAY = 200;
  const ACTIVE_POLL_INTERVAL = 1000;
  const IDLE_POLL_INTERVAL = 5000;
  let isSyncingJaneSet = false;
  let janeSetSyncTimer = null;
  let pollTimer = null;
  let cachedCart = null;
  let previousQuantities = new Map();
  let hasJaneSetItems = false;
  let latestQuantityIntent = null;
  const setSyncStates = new Map();
  const handledClickEvents = new WeakSet();
  const STALE_REQUEST = Symbol('stale-request');

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

  function isProtectedFromStaleCart(cart) {
    const groups = groupJaneSetItems(cart.items);
    const now = Date.now();

    return Object.entries(groups).some(([setId, items]) => {
      const state = setSyncStates.get(setId);
      if (!state || now > state.protectUntil) return false;
      return items.some(item => item.quantity !== state.pendingTargetQty);
    });
  }

  function snapshotCart(cart, trusted = false) {
    if (!trusted && isProtectedFromStaleCart(cart)) return false;

    cachedCart = cart;
    hasJaneSetItems = cart.items.some(isJaneSetItem);
    previousQuantities = new Map(cart.items.map(item => [item.key, item.quantity]));
    return true;
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
    const sku = item.properties._set_component_sku || item.sku;
    const roleTitle = item.properties._set_role === 'Top' ? 'jane blouse' : 'jane pants';
    return {
      sku: normalize(sku),
      roleTitle
    };
  }

  function matchingLines(text, items) {
    const normalizedText = normalize(text);
    const skuMatches = items.filter(item => {
      const { sku } = identifyingTokens(item);
      return sku && normalizedText.includes(sku);
    });
    if (skuMatches.length) return skuMatches;

    return items.filter(item => {
      const { roleTitle } = identifyingTokens(item);
      return normalizedText.includes(roleTitle);
    });
  }

  function matchClickedLine(control) {
    if (!cachedCart) return null;

    const janeLines = cachedCart.items.filter(isJaneSetItem);
    let element = control;
    while (element && element !== document.body) {
      const matches = matchingLines(element.textContent, janeLines);
      if (matches.length === 1) {
        return {
          card: element,
          line: matches[0]
        };
      }
      if (matches.length > 1) return null;
      if (element.matches?.(
        'cart-drawer, cart-items, [class*="aov" i], [id*="aov" i]'
      )) break;
      element = element.parentElement;
    }

    return null;
  }

  function actionControls(card) {
    if (!card) return [];
    return [...card.querySelectorAll('button, a, [role="button"]')]
      .filter(control => actionFor(control));
  }

  function findCardForLine(line, surface) {
    if (!line || !surface) return null;

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
    const quantityWrapper = control?.closest?.(
      '[class*="quantity" i], [class*="qty" i], [data-quantity], [data-qty]'
    );
    return quantityWrapper?.querySelector(
      'input[type="number"], input[name*="quantity" i], [role="spinbutton"], [aria-valuenow]'
    ) || card?.querySelector(
      'input[type="number"], input[name*="quantity" i], [role="spinbutton"], [aria-valuenow]'
    ) || null;
  }

  function displayedQuantity(card, control, fallbackQuantity) {
    const input = quantityInput(card, control);
    const quantity = Number.parseInt(input?.value || input?.getAttribute('aria-valuenow'), 10);
    if (Number.isInteger(quantity) && quantity >= 0) return quantity;

    const quantityWrapper = control?.closest?.(
      '[class*="quantity" i], [class*="qty" i], [data-quantity], [data-qty]'
    ) || card;
    const visibleQuantity = [...(quantityWrapper?.querySelectorAll('span, output, div') || [])]
      .map(element => String(element.textContent || '').trim())
      .find(value => /^\d+$/.test(value));
    const parsedVisibleQuantity = Number.parseInt(visibleQuantity, 10);
    return Number.isInteger(parsedVisibleQuantity) ? parsedVisibleQuantity : fallbackQuantity;
  }

  function setCardBusy(card, busy) {
    if (!card) return;

    card.toggleAttribute('data-jane-set-syncing', busy);
    card.setAttribute('aria-busy', String(busy));
    if (busy) {
      card.setAttribute('data-jane-pointer-events', card.style.pointerEvents || '');
      card.style.pointerEvents = 'none';
    } else {
      card.style.pointerEvents = card.getAttribute('data-jane-pointer-events') || '';
      card.removeAttribute('data-jane-pointer-events');
    }
    actionControls(card).forEach(control => {
      if (busy) {
        control.setAttribute('data-jane-was-disabled', String(control.disabled));
        control.disabled = true;
        control.setAttribute('aria-disabled', 'true');
      } else {
        const wasDisabled = control.getAttribute('data-jane-was-disabled') === 'true';
        control.disabled = wasDisabled;
        control.removeAttribute('data-jane-was-disabled');
        control.toggleAttribute('aria-disabled', wasDisabled);
      }
    });
  }

  function setOptimisticQuantity(card, quantity) {
    const input = quantityInput(card);
    if (!input) return;

    const quantityValue = String(quantity);
    if ('value' in input && String(input.value) !== quantityValue) input.value = quantityValue;
    if (input.getAttribute('value') !== quantityValue) input.setAttribute('value', quantityValue);
    if (input.getAttribute('aria-valuenow') !== quantityValue) {
      input.setAttribute('aria-valuenow', quantityValue);
    }
  }

  function reapplyProtectedQuantities() {
    if (!cachedCart) return;

    const now = Date.now();
    setSyncStates.forEach((state, setId) => {
      if (now > state.protectUntil) return;

      const { top, pants } = pairFor(cachedCart.items, setId);
      if (!top || !pants) return;
      setOptimisticQuantity(findCardForLine(top, document.body), state.pendingTargetQty);
      setOptimisticQuantity(findCardForLine(pants, document.body), state.pendingTargetQty);
    });
  }

  function dispatchCartRefresh(cart) {
    document.dispatchEvent(new CustomEvent('afterCartChanged', {
      bubbles: true,
      detail: {
        source: 'jane-set-pair-lock',
        cartData: cart
      }
    }));
    document.dispatchEvent(new CustomEvent('cart:refresh', {
      bubbles: true,
      detail: { cart }
    }));
    document.dispatchEvent(new CustomEvent('cart:updated', {
      bubbles: true,
      detail: { cart }
    }));
  }

  function isLatestRequest(setId, requestId) {
    return setSyncStates.get(setId)?.requestId === requestId;
  }

  async function responseJson(response, fallbackMessage) {
    const text = await response.text();
    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      data = {};
    }

    if (!response.ok || data.errors) {
      const message = data.description || data.message || data.errors || text || fallbackMessage;
      throw new Error(typeof message === 'string' ? message : fallbackMessage);
    }

    return data;
  }

  async function fetchLatestCart() {
    const response = await fetch('/cart.js', {
      headers: { 'Accept': 'application/json' }
    });
    return responseJson(response, 'Unable to read the latest cart.');
  }

  async function changePairByLatestIndexes(setId, targetQuantity, initialCart, requestId) {
    const initialPair = pairFor(initialCart.items, setId);
    if (!initialPair.top || !initialPair.pants) {
      throw new Error('Jane Set pair is incomplete.');
    }

    const roles = ['Top', 'Pants'];
    if (targetQuantity === 0) {
      roles.sort((firstRole, secondRole) => {
        const firstLine = firstRole === 'Top' ? initialPair.top : initialPair.pants;
        const secondLine = secondRole === 'Top' ? initialPair.top : initialPair.pants;
        return initialCart.items.indexOf(secondLine) - initialCart.items.indexOf(firstLine);
      });
    }

    let cart = initialCart;
    for (const role of roles) {
      if (!isLatestRequest(setId, requestId)) return STALE_REQUEST;
      cart = await fetchLatestCart();
      const lineIndex = cart.items.findIndex(item =>
        item.properties?._set_id === setId &&
        item.properties?._set_name === 'Jane Set' &&
        item.properties?._set_role === role
      );
      if (lineIndex === -1) {
        if (targetQuantity === 0) continue;
        throw new Error(`Jane Set ${role.toLowerCase()} line is missing.`);
      }

      const response = await fetch('/cart/change.js', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          line: lineIndex + 1,
          quantity: targetQuantity
        })
      });
      cart = await responseJson(response, `Unable to update Jane Set ${role.toLowerCase()}.`);
    }

    return cart;
  }

  async function updatePairFromLatestCart(setId, targetQuantity, requestId) {
    const latestCart = await fetchLatestCart();
    if (!isLatestRequest(setId, requestId)) return STALE_REQUEST;

    const { top, pants } = pairFor(latestCart.items, setId);
    if (!top || !pants) throw new Error('Jane Set pair is incomplete.');

    try {
      const response = await fetch('/cart/update.js', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          updates: {
            [top.key]: targetQuantity,
            [pants.key]: targetQuantity
          }
        })
      });
      return await responseJson(response, 'Unable to update Jane Set quantities.');
    } catch (error) {
      if (!isLatestRequest(setId, requestId)) return STALE_REQUEST;
      console.warn('Jane Set paired cart update failed; trying line-index fallback.', error);
      const fallbackCart = await changePairByLatestIndexes(
        setId,
        targetQuantity,
        latestCart,
        requestId
      );
      if (fallbackCart === STALE_REQUEST) return STALE_REQUEST;
      return isLatestRequest(setId, requestId) ? fallbackCart : STALE_REQUEST;
    }
  }

  async function updateJaneSets(updates) {
    if (isSyncingJaneSet || !Object.keys(updates).length) return null;
    isSyncingJaneSet = true;

    try {
      const response = await fetch('/cart/update.js', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ updates })
      });
      if (!response.ok) throw new Error('Unable to update Jane Set quantities.');

      const cart = await response.json();
      snapshotCart(cart, true);
      latestQuantityIntent = null;
      dispatchCartRefresh(cart);
      return cart;
    } catch (error) {
      return null;
    } finally {
      isSyncingJaneSet = false;
      scheduleCheck(250);
    }
  }

  async function interceptPairAction(clickedMatch, action, control) {
    const clickedLine = clickedMatch.line;
    const surface = clickedMatch.card.closest(
      'cart-drawer, cart-items, [class*="aov" i], [id*="aov" i], [class*="cart" i], [id*="cart" i]'
    );
    const { top, pants } = pairFor(cachedCart.items, clickedLine.properties._set_id);
    if (!top || !pants) return;

    const topCard = top.key === clickedLine.key
      ? clickedMatch.card
      : findCardForLine(top, surface);
    const pantsCard = pants.key === clickedLine.key
      ? clickedMatch.card
      : findCardForLine(pants, surface);
    const currentQuantity = displayedQuantity(clickedMatch.card, control, clickedLine.quantity);
    let quantity = currentQuantity;
    if (action === 'increase') quantity += 1;
    if (action === 'decrease') quantity = Math.max(0, quantity - 1);
    if (action === 'remove') quantity = 0;

    const previousState = setSyncStates.get(clickedLine.properties._set_id);
    const requestId = (previousState?.requestId || 0) + 1;
    setSyncStates.set(clickedLine.properties._set_id, {
      requestId,
      pendingTargetQty: quantity,
      pending: true,
      timestamp: Date.now(),
      protectUntil: Date.now() + 1500
    });

    isSyncingJaneSet = true;
    setCardBusy(topCard, true);
    setCardBusy(pantsCard, true);
    setOptimisticQuantity(topCard, quantity);
    setOptimisticQuantity(pantsCard, quantity);

    try {
      let updatedCart = null;
      try {
        updatedCart = await updatePairFromLatestCart(
          clickedLine.properties._set_id,
          quantity,
          requestId
        );
      } catch (error) {
        console.warn('Jane Set pair update failed.', error);
      }

      if (updatedCart === STALE_REQUEST) return;
      if (updatedCart) {
        if (!isLatestRequest(clickedLine.properties._set_id, requestId)) return;
        setSyncStates.set(clickedLine.properties._set_id, {
          requestId,
          pendingTargetQty: quantity,
          pending: false,
          timestamp: Date.now(),
          protectUntil: Date.now() + 1500
        });
        snapshotCart(updatedCart, true);
        latestQuantityIntent = null;
        dispatchCartRefresh(updatedCart);
      } else {
        const currentState = setSyncStates.get(clickedLine.properties._set_id);
        if (currentState?.requestId === requestId) {
          setSyncStates.delete(clickedLine.properties._set_id);
          setOptimisticQuantity(topCard, top.quantity);
          setOptimisticQuantity(pantsCard, pants.quantity);
        }
      }
    } finally {
      if (isSyncingJaneSet) {
        isSyncingJaneSet = false;
        scheduleCheck(250);
      }
      setCardBusy(topCard, false);
      setCardBusy(pantsCard, false);
    }
  }

  function matchedQuantity(top, pants) {
    const previousTop = previousQuantities.get(top.key);
    const previousPants = previousQuantities.get(pants.key);
    const topChanged = previousTop !== undefined && top.quantity !== previousTop;
    const pantsChanged = previousPants !== undefined && pants.quantity !== previousPants;

    if (topChanged && !pantsChanged) return top.quantity;
    if (pantsChanged && !topChanged) return pants.quantity;
    if (Number.isInteger(latestQuantityIntent?.quantity)) return latestQuantityIntent.quantity;
    if (latestQuantityIntent?.direction === 'decrease') return Math.min(top.quantity, pants.quantity);
    return Math.max(top.quantity, pants.quantity);
  }

  function requiredFallbackUpdates(cart) {
    const updates = {};
    const groups = groupJaneSetItems(cart.items);

    Object.entries(groups).forEach(([setId, items]) => {
      const top = items.find(item => item.properties._set_role === 'Top');
      const pants = items.find(item => item.properties._set_role === 'Pants');
      const syncState = setSyncStates.get(setId);
      const protectedQuantity = syncState && Date.now() <= syncState.protectUntil
        ? syncState.pendingTargetQty
        : null;

      if (!top || !pants) {
        items.forEach(item => {
          updates[item.key] = 0;
        });
      } else if (
        top.quantity !== pants.quantity ||
        (protectedQuantity !== null && top.quantity !== protectedQuantity)
      ) {
        const quantity = protectedQuantity ?? matchedQuantity(top, pants);
        updates[top.key] = quantity;
        updates[pants.key] = quantity;
      }
    });

    return updates;
  }

  async function checkJaneSets() {
    if (isSyncingJaneSet || document.hidden) return;

    try {
      const response = await fetch('/cart.js', {
        headers: { 'Accept': 'application/json' }
      });
      if (!response.ok) return;

      const cart = await response.json();
      const updates = requiredFallbackUpdates(cart);
      snapshotCart(cart, true);

      if (Object.keys(updates).length) await updateJaneSets(updates);
    } catch (error) {
      // A later cart event or safety poll retries without disrupting the drawer.
    } finally {
      schedulePoll();
    }
  }

  function scheduleCheck(delay = CHECK_DELAY) {
    window.clearTimeout(janeSetSyncTimer);
    janeSetSyncTimer = window.setTimeout(checkJaneSets, delay);
  }

  function schedulePoll() {
    window.clearTimeout(pollTimer);
    pollTimer = window.setTimeout(
      checkJaneSets,
      hasJaneSetItems ? ACTIVE_POLL_INTERVAL : IDLE_POLL_INTERVAL
    );
  }

  function handleJaneSetClick(event) {
    if (handledClickEvents.has(event)) return;

    const control = event.target.closest('button, a, [role="button"]');
    if (!control || !isCartSurface(control)) return;

    const action = actionFor(control);
    if (!action) return;

    const clickedMatch = matchClickedLine(control);
    if (!clickedMatch) return;

    const { top, pants } = pairFor(cachedCart.items, clickedMatch.line.properties._set_id);
    if (!top || !pants) return;

    event.preventDefault();
    handledClickEvents.add(event);
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (isSyncingJaneSet) return;
    interceptPairAction(clickedMatch, action, control);
  }

  window.addEventListener('click', handleJaneSetClick, true);
  document.addEventListener('click', handleJaneSetClick, true);

  document.addEventListener('change', event => {
    if (!isCartSurface(event.target)) return;
    const quantity = Number.parseInt(event.target.value, 10);
    latestQuantityIntent = {
      quantity: Number.isInteger(quantity) && quantity >= 0 ? quantity : null,
      direction: null
    };
    scheduleCheck();
  }, true);

  document.addEventListener('afterCartChanged', event => {
    if (event.detail?.cartData?.items) snapshotCart(event.detail.cartData);
    if (!isSyncingJaneSet) scheduleCheck();
  });
  document.addEventListener('cart:updated', event => {
    if (event.detail?.cart?.items) snapshotCart(event.detail.cart);
    if (!isSyncingJaneSet) scheduleCheck();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleCheck(0);
  });

  const cartObserver = new MutationObserver(mutations => {
    if (isSyncingJaneSet) return;
    if (mutations.some(mutation => isCartSurface(mutation.target))) {
      reapplyProtectedQuantities();
      scheduleCheck(250);
    }
  });
  cartObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['value', 'aria-valuenow']
  });

  scheduleCheck(0);
})();
