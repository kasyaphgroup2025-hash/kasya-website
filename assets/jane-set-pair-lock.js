(() => {
  try {
    if (
      typeof window === 'undefined' ||
      typeof document === 'undefined' ||
      typeof window.fetch !== 'function'
    ) return;

    console.info('[Jane Set Pair Lock] paid parent + components loaded');

  const CONTROL_STYLE_ID = 'jane-set-pair-lock-style';
  const HIDDEN_CONTROL_CLASS = 'jane-set-qty-control-hidden';
  const LOCKED_INPUT_CLASS = 'jane-set-qty-input-locked';
  const IMAGE_LINK_CLASS = 'jane-set-image-link-disabled';
  const HIDDEN_PRICE_CLASS = 'jane-set-aov-hidden-price';
  const JANE_SET_ROLES = ['Parent', 'Top', 'Pants'];
  const RENDER_DELAYS = [50, 150, 300, 600];
  let latestCart = null;
  let isUpdatingJaneSet = false;
  let cartCheckTimer = null;
  let renderTimers = [];
  const handledInvalidSetIds = new Set();

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isJaneSetItem(item) {
    return Boolean(
      item?.properties?._set_id &&
      item.properties._set_name === 'Jane Set' &&
      JANE_SET_ROLES.includes(item.properties._set_role)
    );
  }

  function groupJaneSetItems(items) {
    return (items || []).reduce((groups, item) => {
      if (!isJaneSetItem(item)) return groups;
      const setId = item.properties._set_id;
      groups[setId] = groups[setId] || [];
      groups[setId].push(item);
      return groups;
    }, {});
  }

  function itemRoleFromText(text) {
    const normalizedText = normalize(text);
    if (normalizedText.includes('jane blouse')) return 'Top';
    if (normalizedText.includes('jane pants')) return 'Pants';
    if (normalizedText.includes('jane set')) return 'Parent';
    return null;
  }

  function itemSku(item) {
    return normalize(item?.properties?._set_component_sku || item?.sku);
  }

  function controlAction(control) {
    const description = normalize([
      control?.textContent,
      control?.getAttribute?.('name'),
      control?.getAttribute?.('aria-label'),
      control?.getAttribute?.('title'),
      control?.className
    ].filter(Boolean).join(' '));

    if (/(remove|delete|trash)/.test(description)) return 'remove';
    if (
      description === '+' ||
      /(plus|increase|increment|quantity-add)/.test(description)
    ) return 'increase';
    if (
      description === '-' ||
      description === '−' ||
      /(minus|decrease|decrement|quantity-minus)/.test(description)
    ) return 'decrease';
    return null;
  }

  function installStyles() {
    if (document.getElementById(CONTROL_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = CONTROL_STYLE_ID;
    style.textContent = `
      .${HIDDEN_CONTROL_CLASS},
      .${HIDDEN_PRICE_CLASS} {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      .${LOCKED_INPUT_CLASS} {
        pointer-events: none !important;
      }

      .${IMAGE_LINK_CLASS},
      .${IMAGE_LINK_CLASS} img {
        cursor: default !important;
      }
    `;
    document.head.appendChild(style);
  }

  function findJaneSetCard(control) {
    let element = control;

    while (element && element !== document.body && element !== document.documentElement) {
      const role = itemRoleFromText(element.textContent);
      if (role) {
        const controls = [...element.querySelectorAll('button, a, [role="button"]')];
        if (controls.some(candidate => controlAction(candidate))) {
          return { element, role };
        }
      }
      element = element.parentElement;
    }

    return null;
  }

  function cardContainsOtherJaneRole(card, role) {
    return JANE_SET_ROLES.some(otherRole => {
      if (otherRole === role) return false;
      const roleText = {
        Parent: 'jane set',
        Top: 'jane blouse',
        Pants: 'jane pants'
      }[otherRole];
      return normalize(card.textContent).includes(roleText);
    });
  }

  function findCardsForRole(role) {
    const roleText = {
      Parent: 'jane set',
      Top: 'jane blouse',
      Pants: 'jane pants'
    }[role];
    const matches = [];

    document.querySelectorAll('button, a, [role="button"]').forEach(control => {
      if (!controlAction(control)) return;
      const card = findJaneSetCard(control);
      if (!card || card.role !== role || cardContainsOtherJaneRole(card.element, role)) return;
      if (!matches.includes(card.element)) matches.push(card.element);
    });

    return matches;
  }

  function priceElementsIn(card) {
    const zeroPricePattern = /^₱\s*0(?:[.,]00)?$/;
    return [...card.querySelectorAll('span, p, strong, small, div')]
      .filter(element => {
        const text = String(element.textContent || '').trim();
        if (!zeroPricePattern.test(text)) return false;
        return ![...element.children].some(child =>
          zeroPricePattern.test(String(child.textContent || '').trim())
        );
      });
  }

  function cardAttributeText(card) {
    return [card, ...card.querySelectorAll('*')]
      .flatMap(element => [...element.attributes].map(attribute => attribute.value))
      .join(' ')
      .toLowerCase();
  }

  function roleItems(cart, role) {
    return cart.items.filter(item =>
      isJaneSetItem(item) && item.properties._set_role === role
    );
  }

  function resolveJaneItem(card, role, cart, occurrenceIndex = -1) {
    const cardText = normalize(card.textContent);
    const attributes = cardAttributeText(card);
    let candidates = roleItems(cart, role);

    const exactMatches = candidates.filter(item =>
      attributes.includes(normalize(item.key)) ||
      attributes.includes(String(item.variant_id || item.id))
    );
    if (exactMatches.length === 1) return exactMatches[0];

    const skuMatches = candidates.filter(item => {
      const sku = itemSku(item);
      return sku && cardText.includes(sku);
    });
    if (skuMatches.length === 1) return skuMatches[0];
    if (skuMatches.length > 1) candidates = skuMatches;

    if (occurrenceIndex >= 0 && candidates[occurrenceIndex]) {
      return candidates[occurrenceIndex];
    }

    return candidates.length === 1 ? candidates[0] : null;
  }

  function imageUrl(item) {
    return item?.featured_image?.url || item?.image || '';
  }

  function parentHasSelectedColorVariant(parentItem) {
    const selectedColor = normalize(parentItem?.properties?._set_color);
    return (parentItem?.options_with_values || []).some(option =>
      ['color', 'colour'].includes(normalize(option.name)) &&
      normalize(option.value) === selectedColor
    );
  }

  function updateParentImage(group, setId) {
    const parentItem = group.find(item => item.properties._set_role === 'Parent');
    if (!parentItem || parentHasSelectedColorVariant(parentItem)) return;

    const componentItem =
      group.find(item => item.properties._set_role === 'Top' && imageUrl(item)) ||
      group.find(item => item.properties._set_role === 'Pants' && imageUrl(item));
    const replacementUrl = imageUrl(componentItem);
    if (!replacementUrl) return;

    const parentCard = [...document.querySelectorAll('[data-jane-set-card="true"]')]
      .find(card =>
        card.dataset.janeSetRole === 'Parent' &&
        card.dataset.janeSetId === setId
      );
    const parentImage = parentCard?.querySelector('img');
    if (!parentImage) return;

    parentImage.src = replacementUrl;
    parentImage.removeAttribute('srcset');
  }

  function markJaneSetCards() {
    if (!latestCart || !Object.keys(groupJaneSetItems(latestCart.items)).length) return;

    document.querySelectorAll('[data-jane-set-total]').forEach(element => element.remove());

    JANE_SET_ROLES.forEach(role => {
      const cards = findCardsForRole(role);
      cards.forEach((card, index) => {
        const item = resolveJaneItem(card, role, latestCart, index);
        card.dataset.janeSetCard = 'true';
        card.dataset.janeSetRole = role;
        if (item) card.dataset.janeSetId = item.properties._set_id;

        card.querySelectorAll('button, a, [role="button"]').forEach(control => {
          const action = controlAction(control);
          control.classList.toggle(
            HIDDEN_CONTROL_CLASS,
            action === 'increase' || action === 'decrease'
          );
        });
        card.querySelectorAll('input[type="number"], input[name*="quantity" i]').forEach(input => {
          input.classList.add(LOCKED_INPUT_CLASS);
          input.readOnly = true;
          input.tabIndex = -1;
          input.setAttribute('aria-readonly', 'true');
        });
        card.querySelectorAll('a').forEach(link => {
          if (!link.querySelector('img')) return;
          link.classList.add(IMAGE_LINK_CLASS);
          link.tabIndex = -1;
          link.setAttribute('aria-disabled', 'true');
        });

        if (role === 'Top' || role === 'Pants') {
          priceElementsIn(card).forEach(price => price.classList.add(HIDDEN_PRICE_CLASS));
        }
      });
    });

    Object.entries(groupJaneSetItems(latestCart.items)).forEach(([setId, group]) => {
      updateParentImage(group, setId);
    });
  }

  function runRenderBurst() {
    markJaneSetCards();
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(markJaneSetCards);
    }
    renderTimers.forEach(timer => window.clearTimeout(timer));
    renderTimers = RENDER_DELAYS.map(delay =>
      window.setTimeout(markJaneSetCards, delay)
    );
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

  async function removeSetByIndexes(setId) {
    let cart = await fetchCart();
    let indexes = cart.items
      .map((item, index) => ({ item, index }))
      .filter(entry =>
        isJaneSetItem(entry.item) &&
        entry.item.properties._set_id === setId
      )
      .map(entry => entry.index + 1)
      .sort((first, second) => second - first);

    while (indexes.length) {
      const line = indexes.shift();
      const response = await fetch('/cart/change.js', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ line, quantity: 0 })
      });
      if (!response.ok) throw new Error('Unable to remove Jane Set lines.');
      cart = await response.json();
    }

    return cart;
  }

  async function removeSets(cart, setIds) {
    const keys = cart.items
      .filter(item =>
        isJaneSetItem(item) &&
        setIds.includes(item.properties._set_id)
      )
      .map(item => item.key);

    if (!keys.length) return cart;

    try {
      return await updateCart(Object.fromEntries(keys.map(key => [key, 0])));
    } catch (error) {
      let fallbackCart = cart;
      for (const setId of setIds) {
        fallbackCart = await removeSetByIndexes(setId);
      }
      return fallbackCart;
    }
  }

  function incompleteSetIds(cart) {
    return Object.entries(groupJaneSetItems(cart.items))
      .filter(([, items]) => {
        const roles = new Set(items.map(item => item.properties._set_role));
        return !JANE_SET_ROLES.every(role => roles.has(role));
      })
      .map(([setId]) => setId);
  }

  async function cleanOrphans() {
    if (isUpdatingJaneSet || document.hidden) return;
    isUpdatingJaneSet = true;

    try {
      let cart = await fetchCart();
      const orphanSetIds = incompleteSetIds(cart)
        .filter(setId => !handledInvalidSetIds.has(setId));
      if (orphanSetIds.length) {
        orphanSetIds.forEach(setId => handledInvalidSetIds.add(setId));
        cart = await removeSets(cart, orphanSetIds);
        cart = await fetchCart();
        const remainingSetIds = new Set(
          cart.items.filter(isJaneSetItem).map(item => item.properties._set_id)
        );
        const failedSetIds = orphanSetIds.filter(setId => remainingSetIds.has(setId));
        if (failedSetIds.length) {
          console.warn('Incomplete Jane Set lines could not be fully removed.');
        }
      }
      latestCart = cart;
      runRenderBurst();
    } catch (error) {
      console.warn('Unable to clean up an incomplete Jane Set.', error);
    } finally {
      isUpdatingJaneSet = false;
    }
  }

  function scheduleCartCheck() {
    window.clearTimeout(cartCheckTimer);
    cartCheckTimer = window.setTimeout(cleanOrphans, 150);
  }

  function resolveSetId(card, role, cart) {
    if (card.dataset.janeSetId) {
      const setExists = cart.items.some(item =>
        isJaneSetItem(item) &&
        item.properties._set_id === card.dataset.janeSetId
      );
      if (setExists) return card.dataset.janeSetId;
    }

    const cards = findCardsForRole(role);
    const occurrenceIndex = cards.indexOf(card);
    return resolveJaneItem(card, role, cart, occurrenceIndex)?.properties?._set_id || null;
  }

  async function removeClickedSet(card, role) {
    if (isUpdatingJaneSet) return;
    isUpdatingJaneSet = true;

    try {
      const cart = await fetchCart();
      const setId = resolveSetId(card, role, cart);
      if (!setId) throw new Error('Unable to match this Jane Set line.');

      const updatedCart = await removeSets(cart, [setId]);
      latestCart = updatedCart;
      runRenderBurst();
    } catch (error) {
      console.warn('Unable to remove the complete Jane Set.', error);
    } finally {
      isUpdatingJaneSet = false;
    }
  }

  function handleCartControl(event) {
    const imageLink = event.target.closest?.('a');
    const imageCard = imageLink?.closest?.('[data-jane-set-card="true"]');
    if (imageLink?.querySelector('img') && imageCard) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      return;
    }

    const quantityInput = event.target.closest?.('input[type="number"], input[name*="quantity" i]');
    const quantityCard = quantityInput?.closest?.('[data-jane-set-card="true"]');
    if (quantityInput && quantityCard) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      return;
    }

    const control = event.target.closest?.('button, a, [role="button"]');
    if (!control) return;

    const action = controlAction(control);
    if (!action) return;
    const markedCard = control.closest('[data-jane-set-card="true"]');
    const card = markedCard
      ? { element: markedCard, role: markedCard.dataset.janeSetRole }
      : findJaneSetCard(control);
    if (!card || (!markedCard && cardContainsOtherJaneRole(card.element, card.role))) return;

    if (action === 'increase' || action === 'decrease') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      return;
    }

    if (action === 'remove') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      removeClickedSet(card.element, card.role);
    }
  }

  function handleLockedQuantityEvent(event) {
    const input = event.target.closest?.('input[type="number"], input[name*="quantity" i]');
    if (!input || !input.closest('[data-jane-set-card="true"]')) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  installStyles();
  window.addEventListener('click', handleCartControl, true);
  window.addEventListener('change', handleLockedQuantityEvent, true);
  window.addEventListener('input', handleLockedQuantityEvent, true);

  document.addEventListener('afterCartChanged', event => {
    if (event.detail?.cartData?.items) latestCart = event.detail.cartData;
    runRenderBurst();
    scheduleCartCheck();
  });
  document.addEventListener('cart:updated', event => {
    if (event.detail?.cart?.items) latestCart = event.detail.cart;
    runRenderBurst();
    scheduleCartCheck();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleCartCheck();
  });

  if (typeof MutationObserver === 'function' && document.body) {
    const observer = new MutationObserver(() => {
      runRenderBurst();
      scheduleCartCheck();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  cleanOrphans();
  } catch (error) {
    console.warn('[Jane Set Pair Lock] initialization skipped.', error);
  }
})();
