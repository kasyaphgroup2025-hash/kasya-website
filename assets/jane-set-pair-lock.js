(() => {
  const CHECK_DELAY = 180;
  const ACTIVE_POLL_INTERVAL = 1500;
  const IDLE_POLL_INTERVAL = 5000;
  let isSyncingJaneSet = false;
  let checkTimer = null;
  let pollTimer = null;
  let previousQuantities = new Map();
  let hasJaneSetItems = false;

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
    window.clearTimeout(checkTimer);
    checkTimer = window.setTimeout(checkJaneSets, delay);
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
  document.addEventListener('change', () => scheduleCheck(250), true);
  document.addEventListener('click', event => {
    if (event.target.closest('button, a, [role="button"]')) scheduleCheck(350);
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleCheck(0);
  });

  scheduleCheck(0);
})();
