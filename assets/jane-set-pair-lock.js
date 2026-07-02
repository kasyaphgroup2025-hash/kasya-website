(() => {
  try {
    if (
      typeof window === 'undefined' ||
      typeof document === 'undefined' ||
      typeof window.fetch !== 'function'
    ) return;

    console.info('[Jane Set AOV Guard] loaded');

  const CONTROL_STYLE_ID = 'jane-set-pair-lock-style';
  const HIDDEN_CONTROL_CLASS = 'jane-set-qty-control-hidden';
  const LOCKED_INPUT_CLASS = 'jane-set-qty-input-locked';
  const IMAGE_LINK_CLASS = 'jane-set-aov-link-disabled';
  const IMAGE_CLASS = 'jane-set-aov-image-disabled';
  const HIDDEN_PRICE_CLASS = 'jane-set-aov-hidden-price';
  const JANE_SET_ROLES = ['Parent', 'Top', 'Pants'];
  const RENDER_DELAYS = [100, 250, 500];
  const CART_SURFACE_SELECTOR = [
    'cart-drawer',
    '[data-cart-drawer]',
    '[id*="cart-drawer" i]',
    '[class*="cart-drawer" i]',
    '[id*="aov" i]',
    '[class*="aov" i]'
  ].join(',');
  const CART_SURFACE_FALLBACK_SELECTOR = [
    '[role="dialog"]',
    '[aria-modal="true"]',
    'aside',
    '[id*="drawer" i]',
    '[class*="drawer" i]',
    '[id*="cart" i]',
    '[class*="cart" i]'
  ].join(',');
  let latestCart = null;
  let isUpdatingJaneSet = false;
  let cartCheckTimer = null;
  let renderTimers = [];
  let lastDebugSignature = '';
  const handledInvalidSetIds = new Set();

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function cartSurfaces() {
    const surfaces = [...document.querySelectorAll(CART_SURFACE_SELECTOR)];
    document.querySelectorAll(CART_SURFACE_FALLBACK_SELECTOR).forEach(element => {
      if (element.closest('[data-jane-set-hero]')) return;
      const text = normalize(element.textContent);
      const hasJaneLine =
        text.includes('jane set') ||
        text.includes('jane blouse') ||
        text.includes('jane pants') ||
        text.includes('janeblouse') ||
        text.includes('janepants');
      const hasCartLanguage =
        text.includes('checkout') ||
        text.includes('subtotal') ||
        text.includes('almost yours') ||
        text.includes('free shipping') ||
        text.includes('reserved');
      if (hasJaneLine && hasCartLanguage && !surfaces.includes(element)) {
        surfaces.push(element);
      }
    });

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const text = normalize(node.nodeValue);
      if (text.includes('almost yours') || text.includes('proceed to checkout')) {
        let element = node.parentElement;
        while (element && element !== document.body) {
          const surfaceText = normalize(element.textContent);
          const hasCartSummary =
            surfaceText.includes('subtotal') &&
            (surfaceText.includes('checkout') || surfaceText.includes('almost yours'));
          const hasJaneLine =
            surfaceText.includes('jane set') ||
            surfaceText.includes('jane blouse') ||
            surfaceText.includes('jane pants');
          if (hasCartSummary && hasJaneLine) {
            if (!surfaces.includes(element)) surfaces.push(element);
            break;
          }
          element = element.parentElement;
        }
      }
      node = walker.nextNode();
    }
    return surfaces;
  }

  function cartSurfaceFor(element) {
    const directSurface = element?.closest?.(CART_SURFACE_SELECTOR);
    if (directSurface) return directSurface;

    return cartSurfaces()
      .filter(surface => surface.contains(element))
      .reduce((smallest, surface) => {
        if (!smallest || smallest.contains(surface)) return surface;
        return smallest;
      }, null);
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
    if (
      normalizedText.includes('jane blouse') ||
      normalizedText.includes('janeblouse')
    ) return 'Top';
    if (
      normalizedText.includes('jane pants') ||
      normalizedText.includes('janepants')
    ) return 'Pants';
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

  function quantityInputsIn(card) {
    return [...card.querySelectorAll(
      'input[type="number"], input[name*="quantity" i], input[class*="quantity" i]'
    )];
  }

  function findQuantityWrapper(input, card) {
    let element = input.parentElement;

    while (element && element !== card) {
      const controls = [...element.querySelectorAll('button, a, [role="button"]')];
      const hasKnownQuantityControl = controls.some(control =>
        ['increase', 'decrease'].includes(controlAction(control))
      );
      const isCompactControl =
        controls.length >= 2 &&
        quantityInputsIn(element).length === 1 &&
        !element.querySelector('img');

      if (hasKnownQuantityControl || isCompactControl) return element;
      element = element.parentElement;
    }

    return null;
  }

  function lockQuantityControls(card) {
    card.dataset.janeSetQtyLocked = 'true';
    card.querySelectorAll('button, a, [role="button"]').forEach(control => {
      const action = controlAction(control);
      control.classList.toggle(
        HIDDEN_CONTROL_CLASS,
        action === 'increase' || action === 'decrease'
      );
    });

    quantityInputsIn(card).forEach(input => {
      input.classList.add(LOCKED_INPUT_CLASS);
      input.readOnly = true;
      input.tabIndex = -1;
      input.setAttribute('aria-readonly', 'true');

      const wrapper = findQuantityWrapper(input, card);
      if (!wrapper) return;
      wrapper.dataset.janeSetQtyWrapper = 'true';
      wrapper.querySelectorAll('button, a, [role="button"]').forEach(control => {
        if (controlAction(control) === 'remove') return;
        control.classList.add(HIDDEN_CONTROL_CLASS);
      });
    });
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
      .${IMAGE_LINK_CLASS} img,
      .${IMAGE_CLASS} {
        cursor: default !important;
      }
    `;
    document.head.appendChild(style);
  }

  function findJaneSetCard(control) {
    const cartSurface = cartSurfaceFor(control);
    if (!cartSurface || control.closest?.('[data-jane-set-hero]')) return null;

    let element = control;

    while (element && cartSurface.contains(element)) {
      const role = itemRoleFromText(element.textContent);
      if (
        role &&
        !cardContainsOtherJaneRole(element, role) &&
        element.querySelector('img') &&
        element.querySelector('a, button, input, [role="button"]')
      ) {
        return { element, role };
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
    const matches = [];

    cartSurfaces().forEach(surface => {
      surface.querySelectorAll('a, img, button, input, [role="button"]').forEach(element => {
        const card = findJaneSetCard(element);
        if (!card || card.role !== role || cardContainsOtherJaneRole(card.element, role)) return;
        if (!matches.includes(card.element)) matches.push(card.element);
      });
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

  function updateParentImage(group, setId) {
    const parentItem = group.find(item => item.properties._set_role === 'Parent');
    if (!parentItem) return;

    const componentItem =
      group.find(item => item.properties._set_role === 'Top' && imageUrl(item)) ||
      group.find(item => item.properties._set_role === 'Pants' && imageUrl(item));
    const selectedColorImage = parentItem.properties?._set_parent_image || '';
    const replacementUrl = selectedColorImage || imageUrl(componentItem);
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
    parentImage.removeAttribute('data-srcset');
    parentImage.dataset.src = replacementUrl;
    parentImage.alt = `${parentItem.properties?._set_color || ''} Jane Set`.trim();
    parentImage.closest('picture')?.querySelectorAll('source').forEach(source => {
      source.removeAttribute('srcset');
      source.removeAttribute('data-srcset');
    });
  }

  function isJaneProductLink(link) {
    if (controlAction(link) === 'remove') return false;
    if (link.querySelector('img')) return true;

    const href = normalize(link.getAttribute('href'));
    const description = normalize([
      link.textContent,
      link.className,
      link.getAttribute('aria-label')
    ].filter(Boolean).join(' '));

    return href.includes('/products/') ||
      /(product.*(title|name)|cart.*(title|name)|jane set|jane blouse|jane pants)/.test(description);
  }

  function disableJaneImageLinks(card) {
    card.querySelectorAll('img').forEach(image => {
      image.classList.add(IMAGE_CLASS);
      image.dataset.janeSetImageClickDisabled = 'true';
      image.draggable = false;

      const link = image.closest('a');
      if (link && card.contains(link)) {
        link.classList.add(IMAGE_LINK_CLASS);
        link.setAttribute('aria-disabled', 'true');
        link.tabIndex = -1;
        return;
      }

      const clickableWrapper = image.closest('[onclick], [role="link"]');
      if (!clickableWrapper || !card.contains(clickableWrapper)) return;
      clickableWrapper.classList.add(IMAGE_LINK_CLASS);
      clickableWrapper.dataset.janeSetImageClickDisabled = 'true';
    });
  }

  function markJaneSetCards() {
    const surfaces = cartSurfaces();
    if (!surfaces.length) return;

    surfaces.forEach(surface => {
      surface.querySelectorAll('[data-jane-set-total]').forEach(element => element.remove());
    });

    let pricesHidden = 0;
    let qtyLocked = 0;
    let imagesDisabled = 0;
    let parentImagesUpdated = 0;
    let cardsFound = 0;

    JANE_SET_ROLES.forEach(role => {
      const cards = findCardsForRole(role);
      cards.forEach((card, index) => {
        const item = latestCart ? resolveJaneItem(card, role, latestCart, index) : null;
        cardsFound += 1;
        card.dataset.janeSetCard = 'true';
        card.dataset.janeSetAovGuarded = 'true';
        card.dataset.janeSetRole = role;
        if (item) card.dataset.janeSetId = item.properties._set_id;

        lockQuantityControls(card);
        qtyLocked += 1;
        card.querySelectorAll('a').forEach(link => {
          if (!isJaneProductLink(link)) return;
          link.classList.add(IMAGE_LINK_CLASS);
          if (link.hasAttribute('href')) {
            link.dataset.janeSetOriginalHref = link.getAttribute('href');
            link.removeAttribute('href');
          }
          link.tabIndex = -1;
          link.setAttribute('aria-disabled', 'true');
        });
        disableJaneImageLinks(card);
        imagesDisabled += card.querySelectorAll(`.${IMAGE_CLASS}`).length;

        if (role === 'Top' || role === 'Pants') {
          priceElementsIn(card).forEach(price => {
            price.classList.add(HIDDEN_PRICE_CLASS);
            price.dataset.janeSetAovPriceHidden = 'true';
            pricesHidden += 1;
          });
        }
      });
    });

    if (latestCart) {
      Object.entries(groupJaneSetItems(latestCart.items)).forEach(([setId, group]) => {
        updateParentImage(group, setId);
        parentImagesUpdated += 1;
      });
    } else {
      const componentImage =
        findCardsForRole('Top')[0]?.querySelector('img') ||
        findCardsForRole('Pants')[0]?.querySelector('img');
      const parentImage = findCardsForRole('Parent')[0]?.querySelector('img');
      if (componentImage?.currentSrc || componentImage?.src) {
        const replacementUrl = componentImage.currentSrc || componentImage.src;
        if (parentImage) {
          parentImage.src = replacementUrl;
          parentImage.removeAttribute('srcset');
          parentImagesUpdated = 1;
        }
      }
    }

    const debugSignature = JSON.stringify({
      cardsFound,
      pricesHidden,
      qtyLocked,
      imagesDisabled,
      parentImagesUpdated
    });
    if (cardsFound && debugSignature !== lastDebugSignature) {
      lastDebugSignature = debugSignature;
      console.info('[Jane Set AOV Guard] cards found:', cardsFound);
      console.info('[Jane Set AOV Guard] applied:', {
        pricesHidden,
        qtyLocked,
        imagesDisabled,
        parentImagesUpdated
      });
    }
  }

  function runRenderBurst() {
    markJaneSetCards();
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(markJaneSetCards);
    }
    renderTimers.forEach(timer => window.clearTimeout(timer));
    renderTimers = [...RENDER_DELAYS, 1000].map(delay =>
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
    if (isUpdatingJaneSet || document.hidden || !cartSurfaces().length) return;
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
    const clickedImage = event.target.closest?.('img');
    const clickedImageCard = clickedImage
      ? clickedImage.closest('[data-jane-set-card="true"]') || findJaneSetCard(clickedImage)?.element
      : null;
    if (clickedImage && clickedImageCard) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      return;
    }

    const clickedLink = event.target.closest?.('a');
    const clickedLinkCard = clickedLink
      ? clickedLink.closest('[data-jane-set-card="true"]') || findJaneSetCard(clickedLink)?.element
      : null;
    if (
      clickedLink &&
      clickedLinkCard &&
      isJaneProductLink(clickedLink)
    ) {
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
    if (
      control.closest('[data-jane-set-qty-wrapper="true"]') &&
      action !== 'remove'
    ) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      return;
    }
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
