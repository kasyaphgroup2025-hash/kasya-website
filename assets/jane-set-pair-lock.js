(() => {
  console.info('[Jane Set Pair Lock] loaded and active');

  const REFRESH_DELAY = 150;
  const STYLE_ID = 'jane-set-pair-lock-style';
  const HIDDEN_CONTROL_CLASS = 'jane-set-qty-control-hidden';
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

  function findVisibleCardFromTitle(matchElement, title) {
    const otherTitle = title === 'jane blouse' ? 'jane pants' : 'jane blouse';
    let element = matchElement;

    while (element && element !== document.body && element !== document.documentElement) {
      const cardText = normalize(element.textContent);
      const controls = controlsIn(element);
      const hasQuantityControl = controls.some(control =>
        ['increase', 'decrease'].includes(controlAction(control))
      );
      if (hasQuantityControl && cardText.includes(title) && !cardText.includes(otherTitle)) return element;
      element = element.parentElement;
    }
    return null;
  }

  function findVisibleJaneCards() {
    const cards = new Set();
    ['jane blouse', 'jane pants'].forEach(title => {
      textElementsContaining(title).forEach(element => {
        const card = findVisibleCardFromTitle(element, title);
        if (card) cards.add(card);
      });
    });
    return cards;
  }

  function assignDeleteIdentity(card, cart) {
    if (!cart) return;

    const cardText = normalize(card.textContent);
    const role = cardText.includes('jane blouse')
      ? 'Top'
      : cardText.includes('jane pants')
        ? 'Pants'
        : null;
    if (!role) return;

    let candidates = cart.items.filter(item =>
      isJaneSetItem(item) && item.properties._set_role === role
    );
    const visibleSkuCandidates = candidates.filter(item => {
      const sku = itemSku(item);
      return sku && cardText.includes(sku);
    });
    if (visibleSkuCandidates.length) candidates = visibleSkuCandidates;

    const setIds = new Set(candidates.map(item => item.properties._set_id));
    if (setIds.size !== 1) return;
    card.dataset.janeSetId = [...setIds][0];
    card.dataset.janeSetRole = role;
  }

  function installControlStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${HIDDEN_CONTROL_CLASS} {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function markJaneSetCards(cart) {
    const matchedCards = findVisibleJaneCards();
    const hiddenControls = new Set();

    matchedCards.forEach(card => {
      card.dataset.janeSetCard = 'true';
      card.removeAttribute('data-jane-set-id');
      card.removeAttribute('data-jane-set-role');
      assignDeleteIdentity(card, cart);
      controlsIn(card).forEach(control => {
        if (!['increase', 'decrease'].includes(controlAction(control))) return;
        hiddenControls.add(control);
        control.classList.add(HIDDEN_CONTROL_CLASS);
      });
    });

    document.querySelectorAll('[data-jane-set-card="true"]').forEach(card => {
      if (matchedCards.has(card)) return;
      card.removeAttribute('data-jane-set-card');
      card.removeAttribute('data-jane-set-id');
      card.removeAttribute('data-jane-set-role');
    });
    document.querySelectorAll(`.${HIDDEN_CONTROL_CLASS}`).forEach(control => {
      if (!hiddenControls.has(control)) control.classList.remove(HIDDEN_CONTROL_CLASS);
    });
  }

  function markFromLatestCart() {
    markJaneSetCards(latestCart);
  }

  function runImmediateMarkingBurst() {
    markFromLatestCart();
    window.requestAnimationFrame(markFromLatestCart);
    retryTimers.forEach(timer => window.clearTimeout(timer));
    retryTimers = [
      window.setTimeout(markFromLatestCart, 50),
      window.setTimeout(markFromLatestCart, 150),
      window.setTimeout(markFromLatestCart, 300),
      window.setTimeout(markFromLatestCart, 600)
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
      card.removeAttribute('data-jane-set-id');
      card.removeAttribute('data-jane-set-role');
      assignDeleteIdentity(card, cart);
      if (!card.dataset.janeSetId) {
        throw new Error('Unable to safely match this Jane Set card to one set.');
      }
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
