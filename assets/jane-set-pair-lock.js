(() => {
  const CHECK_DELAY = 180;
  const ACTIVE_POLL_INTERVAL = 1500;
  const IDLE_POLL_INTERVAL = 5000;
  let isSyncingJaneSet = false;
  let janeSetSyncTimer = null;
  let janeSetRetryTimer = null;
  let pollTimer = null;
  let previousQuantities = new Map();
  let hasJaneSetItems = false;
  let latestQuantityIntent = null;

  function isJaneSetItem(item) {
    return Boolean(
      item?.properties?._set_id &&
      item.properties._set_name === 'Jane Set'
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

  function snapshotQuantities(items) {
    previousQuantities = new Map(items.map(item => [item.key, item.quantity]));
  }

  function getMatchedQuantity(top, pants) {
    const previousTop = previousQuantities.get(top.key);
    const previousPants = previousQuantities.get(pants.key);
    const topChanged = previousTop !== undefined && top.quantity !== previousTop;
    const pantsChanged = previousPants !== undefined && pants.quantity !== previousPants;

    if (topChanged && !pantsChanged) return top.quantity;
    if (pantsChanged && !topChanged) return pants.quantity;

    if (Number.isInteger(latestQuantityIntent?.quantity)) {
      return latestQuantityIntent.quantity;
    }
    if (latestQuantityIntent?.direction === 'decrease') {
      return Math.min(top.quantity, pants.quantity);
    }
    if (latestQuantityIntent?.direction === 'increase') {
      return Math.max(top.quantity, pants.quantity);
    }
    return Math.max(top.quantity, pants.quantity);
  }

  function getRequiredUpdates(cart) {
    const updates = {};
    const groups = groupJaneSetItems(cart.items);

    Object.values(groups).forEach(items => {
      const top = items.find(item => item.properties._set_role === 'Top');
      const pants = items.find(item => item.properties._set_role === 'Pants');

      if (!top || !pants) {
        items.forEach(item => {
          updates[item.key] = 0;
        });
        return;
      }

      if (top.quantity === pants.quantity) return;

      const matchedQuantity = getMatchedQuantity(top, pants);
      updates[top.key] = matchedQuantity;
      updates[pants.key] = matchedQuantity;
    });

    return updates;
  }

  async function updateJaneSets(updates) {
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
      if (!response.ok) return;

      const cart = await response.json();
      snapshotQuantities(cart.items);
      latestQuantityIntent = null;

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
    } finally {
      isSyncingJaneSet = false;
      scheduleCheck(350);
    }
  }

  async function checkJaneSets() {
    if (isSyncingJaneSet || document.hidden) return;

    try {
      const response = await fetch('/cart.js', {
        headers: { 'Accept': 'application/json' }
      });
      if (!response.ok) return;

      const cart = await response.json();
      hasJaneSetItems = cart.items.some(isJaneSetItem);
      const updates = getRequiredUpdates(cart);
      snapshotQuantities(cart.items);

      if (Object.keys(updates).length) {
        await updateJaneSets(updates);
      }
    } catch (error) {
      // A later cart event or safety poll will retry without disrupting checkout UI.
    } finally {
      schedulePoll();
    }
  }

  function scheduleCheck(delay = CHECK_DELAY) {
    window.clearTimeout(janeSetSyncTimer);
    janeSetSyncTimer = window.setTimeout(checkJaneSets, delay);
  }

  function scheduleInteractionChecks() {
    scheduleCheck(180);
    window.clearTimeout(janeSetRetryTimer);
    janeSetRetryTimer = window.setTimeout(checkJaneSets, 650);
  }

  function schedulePoll() {
    window.clearTimeout(pollTimer);
    pollTimer = window.setTimeout(
      checkJaneSets,
      hasJaneSetItems ? ACTIVE_POLL_INTERVAL : IDLE_POLL_INTERVAL
    );
  }

  document.addEventListener('afterCartChanged', () => {
    if (!isSyncingJaneSet) scheduleCheck();
  });
  document.addEventListener('cart:updated', () => {
    if (!isSyncingJaneSet) scheduleCheck();
  });
  function actionDirection(element) {
    const actionText = [
      element.getAttribute('name'),
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.className,
      element.textContent
    ].filter(Boolean).join(' ').toLowerCase();

    if (/(minus|decrease|decrement|remove|delete|trash)/.test(actionText)) return 'decrease';
    if (/(plus|increase|increment)/.test(actionText)) return 'increase';
    return null;
  }

  function isCartSurface(element) {
    return Boolean(element?.closest?.(
      'cart-drawer, cart-items, [class*="aov" i], [id*="aov" i], [class*="cart" i], [id*="cart" i]'
    ));
  }

  document.addEventListener('change', event => {
    if (!isCartSurface(event.target)) return;
    const quantity = Number.parseInt(event.target.value, 10);
    latestQuantityIntent = {
      quantity: Number.isInteger(quantity) && quantity >= 0 ? quantity : null,
      direction: null
    };
    scheduleInteractionChecks();
  }, true);
  document.addEventListener('click', event => {
    const control = event.target.closest('button, a, [role="button"]');
    if (!control || !isCartSurface(control)) return;

    const direction = actionDirection(control);
    if (!direction) return;
    latestQuantityIntent = { quantity: null, direction };
    scheduleInteractionChecks();
  }, true);
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
