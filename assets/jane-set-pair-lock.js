(() => {
  console.info('[Jane Set Pair Lock] loaded and active');

  const REFRESH_DELAY = 150;
  const STYLE_ID = 'jane-set-pair-lock-style';
  let refreshTimer = null;
  let retryTimers = [];
  let isUpdatingCart = false;
  let isRefreshingState = false;
  let latestCart = null;

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

  function itemSku(item) {
    return normalize(item.properties?._set_component_sku || item.sku);
  }

  function roleTitle(item) {
    return item.properties._set_role === 'Top' ? 'jane blouse' : 'jane pants';
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

  function controlsIn(element) {
    return [...element.querySelectorAll('button, a, [role="button"]')];
  }

  function textElementsContaining(token) {
    if (!token) return [];

    const elements = [];
    const seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();

    while (node) {
      if (normalize(node.nodeValue).includes(token)) {
        const element = node.parentElement;
        if (element && !seen.has(element)) {
          seen.add(element);
          elements.push(element);
        }
      }
      node = walker.nextNode();
    }
    return elements;
  }

  function cardContainsOtherItem(card, item, cartItems) {
    const cardText = normalize(card.textContent);
    return cartItems.some(otherItem => {
      if (otherItem.key === item.key) return false;
      const otherSku = itemSku(otherItem);
      return otherSku && cardText.includes(otherSku);
    });
  }

  function findCardFromMatch(matchElement, item, cartItems) {
    const titleTokens = [
      normalize(item.product_title || item.product?.title),
      roleTitle(item)
    ].filter(Boolean);
    let element = matchElement;

    while (element && element !== document.body && element !== document.documentElement) {
      const cardText = normalize(element.textContent);
      const controls = controlsIn(element);
      const hasQuantityControl = controls.some(control =>
        ['increase', 'decrease'].includes(controlAction(control))
      );
      const hasProductTitle = titleTokens.some(title => cardText.includes(title));

      if (
        hasQuantityControl &&
        hasProductTitle &&
        !cardContainsOtherItem(element, item, cartItems)
      ) {
        return element;
      }
      element = element.parentElement;
    }
    return null;
  }

  function findCardForItem(item, cartItems) {
    const sku = itemSku(item);
    const duplicateSkuCount = sku
      ? cartItems.filter(cartItem => itemSku(cartItem) === sku).length
      : 0;
    const matchTokens = [];

    if (sku && duplicateSkuCount === 1) matchTokens.push(sku);
    matchTokens.push(
      normalize(item.product_title || item.product?.title),
      roleTitle(item)
    );

    for (const token of matchTokens.filter(Boolean)) {
      const cards = textElementsContaining(token)
        .map(element => findCardFromMatch(element, item, cartItems))
        .filter(Boolean);
      const uniqueCards = [...new Set(cards)];
      if (uniqueCards.length === 1) return uniqueCards[0];
    }
    return null;
  }

  function installControlStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      [data-jane-set-qty-wrapper="true"] button,
      [data-jane-set-qty-wrapper="true"] a,
      [data-jane-set-qty-wrapper="true"] [role="button"] {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function commonQuantityWrapper(card, quantityControls) {
    if (!card || !quantityControls.length) return null;

    const preferredWrapper = quantityControls[0].closest(
      'quantity-input, [class*="quantity" i], [class*="qty" i], [data-quantity], [data-qty]'
    );
    if (
      preferredWrapper &&
      preferredWrapper !== card &&
      quantityControls.every(control => preferredWrapper.contains(control)) &&
      !controlsIn(preferredWrapper).some(control => controlAction(control) === 'remove')
    ) {
      return preferredWrapper;
    }

    let wrapper = quantityControls[0].parentElement;
    while (
      wrapper &&
      wrapper !== card &&
      !quantityControls.every(control => wrapper.contains(control))
    ) {
      wrapper = wrapper.parentElement;
    }
    if (
      !wrapper ||
      wrapper === card ||
      controlsIn(wrapper).some(control => controlAction(control) === 'remove')
    ) {
      return null;
    }
    return wrapper;
  }

  function markJaneSetCards(cart) {
    const matchedCards = new Set();
    const matchedWrappers = new Set();

    cart.items.filter(isJaneSetItem).forEach(item => {
      const card = findCardForItem(item, cart.items);
      if (!card) return;

      const quantityControls = controlsIn(card).filter(control =>
        ['increase', 'decrease'].includes(controlAction(control))
      );
      const quantityWrapper = commonQuantityWrapper(card, quantityControls);
      if (!quantityWrapper) return;

      matchedCards.add(card);
      matchedWrappers.add(quantityWrapper);
      card.dataset.janeSetCard = 'true';
      card.dataset.janeSetId = item.properties._set_id;
      card.dataset.janeSetRole = item.properties._set_role;
      quantityWrapper.dataset.janeSetQtyWrapper = 'true';
    });

    document.querySelectorAll('[data-jane-set-card="true"]').forEach(card => {
      if (matchedCards.has(card)) return;
      card.removeAttribute('data-jane-set-card');
      card.removeAttribute('data-jane-set-id');
      card.removeAttribute('data-jane-set-role');
    });
    document.querySelectorAll('[data-jane-set-qty-wrapper="true"]').forEach(wrapper => {
      if (!matchedWrappers.has(wrapper)) wrapper.removeAttribute('data-jane-set-qty-wrapper');
    });
  }

  function markFromLatestCart() {
    if (latestCart) markJaneSetCards(latestCart);
  }

  function runImmediateMarkingBurst() {
    markFromLatestCart();
    window.requestAnimationFrame(markFromLatestCart);
    retryTimers.forEach(timer => window.clearTimeout(timer));
    retryTimers = [
      window.setTimeout(markFromLatestCart, 50),
      window.setTimeout(markFromLatestCart, 150)
    ];
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

  async function removeByIndexes(setId) {
    let cart = await fetchCart();
    const setItems = cart.items
      .map((item, index) => ({ item, index }))
      .filter(entry =>
        isJaneSetItem(entry.item) &&
        entry.item.properties._set_id === setId
      )
      .sort((first, second) => second.index - first.index);

    for (const entry of setItems) {
      cart = await fetchCart();
      const index = cart.items.findIndex(item =>
        isJaneSetItem(item) &&
        item.properties._set_id === setId &&
        item.properties._set_role === entry.item.properties._set_role
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

  async function removeSet(setId, cart) {
    const updates = {};
    cart.items.forEach(item => {
      if (isJaneSetItem(item) && item.properties._set_id === setId) {
        updates[item.key] = 0;
      }
    });
    if (!Object.keys(updates).length) return cart;

    try {
      return await updateCart(updates);
    } catch (error) {
      return removeByIndexes(setId);
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

  async function removeOrphans(cart) {
    const orphanSetIds = Object.entries(groupJaneSetItems(cart.items))
      .filter(([, items]) => {
        const hasTop = items.some(item => item.properties._set_role === 'Top');
        const hasPants = items.some(item => item.properties._set_role === 'Pants');
        return !hasTop || !hasPants;
      })
      .map(([setId]) => setId);
    if (!orphanSetIds.length) return cart;

    const updates = {};
    cart.items.forEach(item => {
      if (isJaneSetItem(item) && orphanSetIds.includes(item.properties._set_id)) {
        updates[item.key] = 0;
      }
    });
    try {
      return await updateCart(updates);
    } catch (error) {
      let updatedCart = cart;
      for (const setId of orphanSetIds) {
        updatedCart = await removeByIndexes(setId);
      }
      return updatedCart;
    }
  }

  async function refreshJaneSetState() {
    if (isUpdatingCart || isRefreshingState || document.hidden) return;
    isRefreshingState = true;

    try {
      let cart = await fetchCart();
      const cleanedCart = await removeOrphans(cart);
      if (cleanedCart !== cart) {
        cart = cleanedCart;
        dispatchCartRefresh(cart);
      }
      latestCart = cart;
      markJaneSetCards(cart);
    } catch (error) {
      console.warn('Unable to refresh Jane Set cart controls.', error);
    } finally {
      isRefreshingState = false;
    }
  }

  function scheduleRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refreshJaneSetState, REFRESH_DELAY);
  }

  async function handleCartControl(event) {
    const control = event.target.closest?.('button, a, [role="button"]');
    if (!control) return;

    const card = control.closest('[data-jane-set-card="true"]');
    if (!card) return;
    const action = controlAction(control);

    if (['increase', 'decrease'].includes(action)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      return;
    }
    if (action !== 'remove') return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    if (isUpdatingCart) return;
    isUpdatingCart = true;

    try {
      const cart = await fetchCart();
      const updatedCart = await removeSet(card.dataset.janeSetId, cart);
      latestCart = updatedCart;
      dispatchCartRefresh(updatedCart);
      markJaneSetCards(updatedCart);
    } catch (error) {
      console.warn('Unable to remove the complete Jane Set.', error);
    } finally {
      isUpdatingCart = false;
      scheduleRefresh();
    }
  }

  installControlStyle();
  window.addEventListener('click', handleCartControl, true);

  document.addEventListener('afterCartChanged', event => {
    if (event.detail?.cartData?.items) latestCart = event.detail.cartData;
    runImmediateMarkingBurst();
    scheduleRefresh();
  });
  document.addEventListener('cart:updated', event => {
    if (event.detail?.cart?.items) latestCart = event.detail.cart;
    runImmediateMarkingBurst();
    scheduleRefresh();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleRefresh();
  });

  const observer = new MutationObserver(() => {
    runImmediateMarkingBurst();
    scheduleRefresh();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  scheduleRefresh();
})();
