(() => {
  let cachedCart = null;
  let isRemovingJaneSet = false;
  let quantityControlTimer = null;

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

  function pairFor(items, setId) {
    const setItems = items.filter(item =>
      isJaneSetItem(item) && item.properties._set_id === setId
    );
    return {
      top: setItems.find(item => item.properties._set_role === 'Top'),
      pants: setItems.find(item => item.properties._set_role === 'Pants')
    };
  }

  function identifyingTokens(item) {
    return {
      sku: normalize(item.properties._set_component_sku || item.sku),
      title: item.properties._set_role === 'Top' ? 'jane blouse' : 'jane pants'
    };
  }

  function matchingLines(text) {
    if (!cachedCart) return [];

    const normalizedText = normalize(text);
    const janeLines = cachedCart.items.filter(isJaneSetItem);
    const skuMatches = janeLines.filter(item => {
      const sku = identifyingTokens(item).sku;
      return sku && normalizedText.includes(sku);
    });
    if (skuMatches.length) return skuMatches;

    return janeLines.filter(item => normalizedText.includes(identifyingTokens(item).title));
  }

  function matchJaneSetLine(control) {
    let element = control;
    while (element && element !== document.body) {
      const matches = matchingLines(element.textContent);
      if (matches.length === 1) return matches[0];
      if (matches.length > 1) return null;
      if (element.matches?.(
        'cart-drawer, cart-items, [class*="aov" i], [id*="aov" i]'
      )) break;
      element = element.parentElement;
    }
    return null;
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
    if (/(minus|decrease|decrement)/.test(actionText)) return 'decrease';
    if (/(plus|increase|increment)/.test(actionText)) return 'increase';
    return null;
  }

  function isCartSurface(element) {
    return Boolean(element?.closest?.(
      'cart-drawer, cart-items, [class*="aov" i], [id*="aov" i], [class*="cart" i], [id*="cart" i]'
    ));
  }

  async function fetchCart() {
    const response = await fetch('/cart.js', {
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error('Unable to read cart.');
    return response.json();
  }

  function disableJaneSetQuantityControls() {
    if (!cachedCart) return;

    document.querySelectorAll('button, a, [role="button"]').forEach(control => {
      if (!isCartSurface(control)) return;
      const action = controlAction(control);
      if (!['increase', 'decrease'].includes(action)) return;
      if (!matchJaneSetLine(control)) return;

      control.disabled = true;
      control.setAttribute('aria-disabled', 'true');
      control.setAttribute('data-jane-set-quantity-disabled', 'true');
      control.style.visibility = 'hidden';
    });
  }

  function scheduleQuantityControlUpdate() {
    window.clearTimeout(quantityControlTimer);
    quantityControlTimer = window.setTimeout(disableJaneSetQuantityControls, 0);
  }

  async function removePairByIndexes(setId) {
    let cart = await fetchCart();
    const initialPair = pairFor(cart.items, setId);
    if (!initialPair.top && !initialPair.pants) return cart;

    const roles = ['Top', 'Pants'].sort((firstRole, secondRole) => {
      const first = firstRole === 'Top' ? initialPair.top : initialPair.pants;
      const second = secondRole === 'Top' ? initialPair.top : initialPair.pants;
      return cart.items.indexOf(second) - cart.items.indexOf(first);
    });

    for (const role of roles) {
      cart = await fetchCart();
      const index = cart.items.findIndex(item =>
        item.properties?._set_id === setId &&
        item.properties?._set_name === 'Jane Set' &&
        item.properties?._set_role === role
      );
      if (index === -1) continue;

      const response = await fetch('/cart/change.js', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ line: index + 1, quantity: 0 })
      });
      if (!response.ok) throw new Error('Unable to remove Jane Set component.');
      cart = await response.json();
    }
    return cart;
  }

  async function removePair(setId) {
    const cart = await fetchCart();
    const { top, pants } = pairFor(cart.items, setId);
    const updates = {};
    if (top) updates[top.key] = 0;
    if (pants) updates[pants.key] = 0;
    if (!Object.keys(updates).length) return cart;

    try {
      const response = await fetch('/cart/update.js', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ updates })
      });
      if (!response.ok) throw new Error('Unable to remove Jane Set.');
      return response.json();
    } catch (error) {
      return removePairByIndexes(setId);
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

  async function handleRemove(event) {
    const control = event.target.closest?.('button, a, [role="button"]');
    if (!control || !isCartSurface(control) || controlAction(control) !== 'remove') return;

    const line = matchJaneSetLine(control);
    if (!line) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    if (isRemovingJaneSet) return;
    isRemovingJaneSet = true;

    try {
      const cart = await removePair(line.properties._set_id);
      cachedCart = cart;
      dispatchCartRefresh(cart);
      scheduleQuantityControlUpdate();
    } catch (error) {
      console.warn('Unable to remove the complete Jane Set.', error);
    } finally {
      isRemovingJaneSet = false;
    }
  }

  function blockJaneSetQuantityClick(event) {
    const control = event.target.closest?.('button, a, [role="button"]');
    if (!control || !isCartSurface(control)) return;
    if (!['increase', 'decrease'].includes(controlAction(control))) return;
    if (!matchJaneSetLine(control)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  async function refreshCache() {
    if (document.hidden || isRemovingJaneSet) return;

    try {
      cachedCart = await fetchCart();
      scheduleQuantityControlUpdate();
    } catch (error) {
      // Cart events or visibility changes will retry without touching AOV layout.
    }
  }

  window.addEventListener('click', blockJaneSetQuantityClick, true);
  window.addEventListener('click', handleRemove, true);

  document.addEventListener('afterCartChanged', event => {
    if (event.detail?.cartData?.items) cachedCart = event.detail.cartData;
    scheduleQuantityControlUpdate();
  });
  document.addEventListener('cart:updated', event => {
    if (event.detail?.cart?.items) cachedCart = event.detail.cart;
    scheduleQuantityControlUpdate();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshCache();
  });

  const cartObserver = new MutationObserver(mutations => {
    if (mutations.some(mutation => isCartSurface(mutation.target))) {
      scheduleQuantityControlUpdate();
    }
  });
  cartObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  refreshCache();
})();
