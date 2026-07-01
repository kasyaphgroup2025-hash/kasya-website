(() => {
  console.info('[Jane Set Pair Lock] post-AOV quantity sync loaded');

  const ACTION_DELAYS = [250, 500, 900];
  const PASSIVE_CHECK_DELAY = 150;
  let latestCart = null;
  let latestSyncRunId = 0;
  let isSyncingJaneSet = false;
  let passiveCheckTimer = null;
  let pendingPassiveCheck = false;

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
    const setItems = groupJaneSetItems(items)[setId] || [];
    return {
      top: setItems.find(item => item.properties._set_role === 'Top'),
      pants: setItems.find(item => item.properties._set_role === 'Pants')
    };
  }

  function itemSku(item) {
    return normalize(item.properties?._set_component_sku || item.sku);
  }

  function controlAction(control) {
    const actionText = [
      control.getAttribute('name'),
      control.getAttribute('aria-label'),
      control.getAttribute('title'),
      control.className,
      control.textContent
    ].filter(Boolean).join(' ').toLowerCase();

    if (/(remove|delete|trash)/.test(actionText)) return 'remove';
    if (/(minus|decrease|decrement)/.test(actionText) || actionText.trim() === '-') return 'decrease';
    if (/(plus|increase|increment)/.test(actionText) || actionText.trim() === '+') return 'increase';
    return null;
  }

  function findJaneCard(control) {
    let element = control;
    while (element && element !== document.body && element !== document.documentElement) {
      const text = normalize(element.textContent);
      const hasBlouse = text.includes('jane blouse');
      const hasPants = text.includes('jane pants');
      if (hasBlouse !== hasPants) {
        return {
          element,
          role: hasBlouse ? 'Top' : 'Pants'
        };
      }
      element = element.parentElement;
    }
    return null;
  }

  function resolveSetId(card, role, cart) {
    if (!cart) return null;

    const cardText = normalize(card.textContent);
    let candidates = cart.items.filter(item =>
      isJaneSetItem(item) && item.properties._set_role === role
    );
    const skuCandidates = candidates.filter(item => {
      const sku = itemSku(item);
      return sku && cardText.includes(sku);
    });
    if (skuCandidates.length) candidates = skuCandidates;

    const setIds = new Set(candidates.map(item => item.properties._set_id));
    return setIds.size === 1 ? [...setIds][0] : null;
  }

  async function fetchCart() {
    const response = await fetch('/cart.js', {
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error('Unable to read cart.');
    return response.json();
  }

  async function updateCart(updates) {
    const response = await fetch('/cart/update.js', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ updates })
    });
    if (!response.ok) throw new Error('Unable to update cart.');
    return response.json();
  }

  async function removeOrphansByIndexes(setIds) {
    let cart = await fetchCart();

    for (const setId of setIds) {
      let setItems = cart.items
        .map((item, index) => ({ item, index }))
        .filter(entry =>
          isJaneSetItem(entry.item) &&
          entry.item.properties._set_id === setId
        )
        .sort((first, second) => second.index - first.index);

      for (const entry of setItems) {
        cart = await fetchCart();
        const lineIndex = cart.items.findIndex(item =>
          isJaneSetItem(item) &&
          item.properties._set_id === setId &&
          item.properties._set_role === entry.item.properties._set_role
        );
        if (lineIndex === -1) continue;

        const response = await fetch('/cart/change.js', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ line: lineIndex + 1, quantity: 0 })
        });
        if (!response.ok) throw new Error('Unable to remove orphaned Jane Set component.');
        cart = await response.json();
      }
    }
    return cart;
  }

  async function removeOrphans(cart) {
    const orphanKeys = [];
    const orphanSetIds = [];

    Object.entries(groupJaneSetItems(cart.items)).forEach(([setId, items]) => {
      const hasTop = items.some(item => item.properties._set_role === 'Top');
      const hasPants = items.some(item => item.properties._set_role === 'Pants');
      if (hasTop && hasPants) return;
      orphanSetIds.push(setId);
      items.forEach(item => orphanKeys.push(item.key));
    });
    if (!orphanKeys.length) return cart;

    const updates = Object.fromEntries(orphanKeys.map(key => [key, 0]));
    try {
      return await updateCart(updates);
    } catch (error) {
      return removeOrphansByIndexes(orphanSetIds);
    }
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

  function changedRole(beforePair, afterPair, preferredRole) {
    if (!beforePair.top || !beforePair.pants || !afterPair.top || !afterPair.pants) return null;

    const topChanged = beforePair.top.quantity !== afterPair.top.quantity;
    const pantsChanged = beforePair.pants.quantity !== afterPair.pants.quantity;
    if (
      preferredRole === 'Top' &&
      topChanged &&
      !pantsChanged
    ) return 'Top';
    if (
      preferredRole === 'Pants' &&
      pantsChanged &&
      !topChanged
    ) return 'Pants';
    if (topChanged && !pantsChanged) return 'Top';
    if (pantsChanged && !topChanged) return 'Pants';
    return null;
  }

  async function syncAfterAov(runId, beforeCart, intent) {
    if (runId !== latestSyncRunId || isSyncingJaneSet) return;
    isSyncingJaneSet = true;

    try {
      let cart = await fetchCart();
      if (runId !== latestSyncRunId) return;

      const cleanedCart = await removeOrphans(cart);
      if (cleanedCart !== cart) {
        latestCart = cleanedCart;
        dispatchCartRefresh(cleanedCart);
        return;
      }
      cart = cleanedCart;
      latestCart = cart;
      if (!intent.setId || intent.action === 'remove') return;

      const beforePair = pairFor(beforeCart.items, intent.setId);
      const afterPair = pairFor(cart.items, intent.setId);
      if (!afterPair.top || !afterPair.pants) return;
      if (afterPair.top.quantity === afterPair.pants.quantity) return;

      const sourceRole = changedRole(beforePair, afterPair, intent.role);
      if (!sourceRole) return;

      const sourceLine = sourceRole === 'Top' ? afterPair.top : afterPair.pants;
      const partnerLine = sourceRole === 'Top' ? afterPair.pants : afterPair.top;
      const updatedCart = await updateCart({
        [partnerLine.key]: sourceLine.quantity
      });
      if (runId !== latestSyncRunId) return;

      latestCart = updatedCart;
      dispatchCartRefresh(updatedCart);
    } catch (error) {
      console.warn('Unable to synchronize Jane Set after AOV update.', error);
    } finally {
      isSyncingJaneSet = false;
      if (pendingPassiveCheck) {
        pendingPassiveCheck = false;
        schedulePassiveCheck();
      }
    }
  }

  function scheduleActionChecks(beforeCart, intent) {
    const runId = ++latestSyncRunId;
    ACTION_DELAYS.forEach(delay => {
      window.setTimeout(() => syncAfterAov(runId, beforeCart, intent), delay);
    });
  }

  async function passiveCheck() {
    if (isSyncingJaneSet || document.hidden) {
      pendingPassiveCheck = true;
      return;
    }

    try {
      const cart = await fetchCart();
      const cleanedCart = await removeOrphans(cart);
      latestCart = cleanedCart;
      if (cleanedCart !== cart) dispatchCartRefresh(cleanedCart);
    } catch (error) {
      console.warn('Unable to verify Jane Set cart state.', error);
    }
  }

  function schedulePassiveCheck() {
    window.clearTimeout(passiveCheckTimer);
    passiveCheckTimer = window.setTimeout(passiveCheck, PASSIVE_CHECK_DELAY);
  }

  function handleCartClick(event) {
    const control = event.target.closest?.('button, a, [role="button"]');
    if (!control) return;

    const action = controlAction(control);
    if (!['increase', 'decrease', 'remove'].includes(action)) return;
    const card = findJaneCard(control);
    if (!card) return;

    const beforeCart = latestCart;
    if (!beforeCart) {
      schedulePassiveCheck();
      return;
    }
    const setId = resolveSetId(card.element, card.role, beforeCart);
    scheduleActionChecks(beforeCart, {
      action,
      role: card.role,
      setId
    });
  }

  window.addEventListener('click', handleCartClick, true);

  document.addEventListener('afterCartChanged', event => {
    if (event.detail?.cartData?.items) latestCart = event.detail.cartData;
    schedulePassiveCheck();
  });
  document.addEventListener('cart:updated', event => {
    if (event.detail?.cart?.items) latestCart = event.detail.cart;
    schedulePassiveCheck();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) schedulePassiveCheck();
  });

  const observer = new MutationObserver(schedulePassiveCheck);
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  passiveCheck();
})();
