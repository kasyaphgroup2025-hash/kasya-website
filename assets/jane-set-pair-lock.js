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
    hasJaneSetItems = cart.items.some(isJaneSetItem);
    previousQuantities = new Map(cart.items.map(item => [item.key, item.quantity]));
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
      if (matches.length === 1) return matches[0];
      if (matches.length > 1) return null;
      if (element.matches?.(
        'cart-drawer, cart-items, [class*="aov" i], [id*="aov" i]'
      )) break;
      element = element.parentElement;
    }

    return null;
  }

  function dispatchCartRefresh(cart) {
    document.dispatchEvent(new CustomEvent('afterCartChanged', {
      detail: {
        source: 'jane-set-pair-lock',
        cartData: cart
      }
    }));
    document.dispatchEvent(new CustomEvent('cart:refresh', {
      detail: { cart }
    }));
    document.dispatchEvent(new CustomEvent('cart:updated', {
      detail: { cart }
    }));
  }

  async function updateJaneSets(updates, lockAcquired = false) {
    if ((!lockAcquired && isSyncingJaneSet) || !Object.keys(updates).length) return null;
    if (!lockAcquired) isSyncingJaneSet = true;

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
      snapshotCart(cart);
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

  async function interceptPairAction(control, clickedLine, action) {
    isSyncingJaneSet = true;
    control.disabled = true;
    control.setAttribute('aria-busy', 'true');

    try {
      const { top, pants } = pairFor(cachedCart.items, clickedLine.properties._set_id);
      if (!top || !pants) return;

      let quantity = clickedLine.quantity;
      if (action === 'increase') quantity += 1;
      if (action === 'decrease') quantity = Math.max(0, quantity - 1);
      if (action === 'remove') quantity = 0;

      await updateJaneSets({
        [top.key]: quantity,
        [pants.key]: quantity
      }, true);
    } finally {
      if (isSyncingJaneSet) {
        isSyncingJaneSet = false;
        scheduleCheck(250);
      }
      control.disabled = false;
      control.removeAttribute('aria-busy');
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

    Object.values(groups).forEach(items => {
      const top = items.find(item => item.properties._set_role === 'Top');
      const pants = items.find(item => item.properties._set_role === 'Pants');

      if (!top || !pants) {
        items.forEach(item => {
          updates[item.key] = 0;
        });
      } else if (top.quantity !== pants.quantity) {
        const quantity = matchedQuantity(top, pants);
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
      snapshotCart(cart);

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

  document.addEventListener('click', event => {
    if (isSyncingJaneSet) return;

    const control = event.target.closest('button, a, [role="button"]');
    if (!control || !isCartSurface(control)) return;

    const action = actionFor(control);
    if (!action) return;

    const clickedLine = matchClickedLine(control);
    if (!clickedLine) return;

    const { top, pants } = pairFor(cachedCart.items, clickedLine.properties._set_id);
    if (!top || !pants) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    interceptPairAction(control, clickedLine, action);
  }, true);

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
