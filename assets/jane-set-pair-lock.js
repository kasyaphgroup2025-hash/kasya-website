(() => {
  'use strict';

  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined'
  ) return;

  console.info('[Jane Set AOV Safe Core] loaded');
  console.info('[Jane Set Delete Guard] loaded');
  console.info('[Jane Set Quantity Guard] loaded');
  console.info('[Jane Set Component Price Guard] loaded');
  console.info('[Jane Set Image Click Guard] loaded');
  console.info('[Jane Set Title Click Guard] loaded');
  console.info('[Jane Set Product URL Guard] loaded');
  console.info('[Jane Set Title Link Removal] loaded');

  const JANE_ROLES = ['Parent', 'Top', 'Pants'];
  const PRICE_HIDDEN_CLASS = 'jane-set-component-price-hidden';
  const QUANTITY_BUTTON_HIDDEN_CLASS = 'jane-set-aov-qty-button-hidden';
  let priceCheckTimer = null;

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function controlDescription(control) {
    return normalize([
      control.textContent,
      control.className,
      control.getAttribute('class'),
      control.getAttribute('aria-label'),
      control.getAttribute('title'),
      control.getAttribute('name'),
      control.querySelector('svg')?.getAttribute('aria-label'),
      control.querySelector('svg')?.className?.baseVal,
      control.querySelector('use')?.getAttribute('href')
    ].filter(Boolean).join(' '));
  }

  function deleteControlFrom(target) {
    const control = target.closest?.('button, a, [role="button"]');
    if (!control) return null;

    return /(remove|delete|trash)/.test(controlDescription(control)) ? control : null;
  }

  function quantityAction(control) {
    const text = normalize(control.textContent);
    const description = controlDescription(control);

    if (/(remove|delete|trash)/.test(description)) return null;
    if (
      text === '+' ||
      /(plus|increase|increment)/.test(description)
    ) return 'increase';
    if (
      text === '-' ||
      text === '−' ||
      /(minus|decrease|decrement)/.test(description)
    ) return 'decrease';
    return null;
  }

  function navigationControlFrom(event) {
    const path = typeof event.composedPath === 'function'
      ? event.composedPath()
      : [event.target];

    return path.find(element =>
      element instanceof Element &&
      element.matches?.('a, [role="link"], [onclick]')
    ) || null;
  }

  function isAllowedCartControl(control) {
    if (!control) return false;
    const description = controlDescription(control);
    return /(remove|delete|trash|checkout|close|continue shopping)/.test(description) ||
      Boolean(quantityAction(control));
  }

  function janeProductNavigationFrom(event) {
    const path = typeof event.composedPath === 'function'
      ? event.composedPath()
      : [event.target];

    return path.find(element => {
      if (!(element instanceof Element)) return false;
      if (!element.matches?.('a, [role="link"], [onclick], [data-href], [data-url]')) {
        return false;
      }

      const navigationValue = normalize([
        element.getAttribute('href'),
        element.getAttribute('data-href'),
        element.getAttribute('data-url'),
        element.getAttribute('onclick'),
        element.textContent
      ].filter(Boolean).join(' '));
      const hasJaneTarget =
        navigationValue.includes('jane-set') ||
        navigationValue.includes('jane-blouse') ||
        navigationValue.includes('jane-pants') ||
        navigationValue.includes('jane-coordinates-set') ||
        navigationValue.includes('jane set') ||
        navigationValue.includes('jane blouse') ||
        navigationValue.includes('jane pants');
      const isNavigation =
        navigationValue.includes('/products/') ||
        element.matches('[role="link"], [onclick], [data-href], [data-url]');

      return hasJaneTarget && isNavigation;
    }) || null;
  }

  function blockJaneProductNavigation(event) {
    const directControl = event.target.closest?.('button, a, [role="button"]');
    if (isAllowedCartControl(directControl)) return;

    const navigation = janeProductNavigationFrom(event);
    if (!navigation || !isCartContext(navigation)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  function findJaneCard(control) {
    let element = control;

    while (element && element !== document.body && element !== document.documentElement) {
      const text = normalize(element.textContent);
      const roles = [
        text.includes('jane set') && 'Parent',
        text.includes('jane blouse') && 'Top',
        text.includes('jane pants') && 'Pants'
      ].filter(Boolean);

      if (roles.length === 1) {
        return { element, role: roles[0] };
      }
      if (roles.length > 1) return null;
      element = element.parentElement;
    }

    return null;
  }

  function installPriceStyle() {
    if (document.getElementById('jane-set-component-price-style')) return;

    const style = document.createElement('style');
    style.id = 'jane-set-component-price-style';
    style.textContent = `
      .${PRICE_HIDDEN_CLASS} {
        display: none !important;
        visibility: hidden !important;
      }

      .${QUANTITY_BUTTON_HIDDEN_CLASS} {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        width: 0 !important;
        min-width: 0 !important;
        max-width: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        overflow: hidden !important;
      }
    `;
    document.head.appendChild(style);
  }

  function isCartContext(card) {
    if (card.closest(
      'cart-drawer, [data-cart-drawer], [id*="cart" i], [class*="cart" i], [id*="aov" i], [class*="aov" i]'
    )) return true;

    let element = card.parentElement;
    while (element && element !== document.body) {
      const text = normalize(element.textContent);
      if (
        text.includes('subtotal') &&
        (text.includes('checkout') || text.includes('almost yours'))
      ) return true;
      element = element.parentElement;
    }
    return false;
  }

  function isJaneReviewContext(element) {
    return Boolean(element?.closest(
      '[data-jane-set-hero], [data-jane-review], .jane-set-review, .jane-set-hero'
    ));
  }

  function janeCartCards() {
    const cards = [];
    document.querySelectorAll('button, [role="button"]').forEach(control => {
      const card = findJaneCard(control);
      if (
        JANE_ROLES.includes(card?.role) &&
        isCartContext(card.element) &&
        !cards.includes(card.element)
      ) {
        cards.push(card.element);
      }
    });
    return cards;
  }

  function componentCards() {
    return janeCartCards().filter(card =>
      ['Top', 'Pants'].includes(findJaneCard(card)?.role)
    );
  }

  function hideComponentPrices() {
    const zeroPrice = /^(?:(?:₱|php)\s*)?0(?:[.,]00)?$|^free$/i;

    componentCards().forEach(card => {
      card.querySelectorAll('span, p, strong, small, div').forEach(element => {
        const text = String(element.textContent || '').trim();
        const childHasPrice = [...element.children].some(child =>
          zeroPrice.test(String(child.textContent || '').trim())
        );
        if (zeroPrice.test(text) && !childHasPrice) {
          element.classList.add(PRICE_HIDDEN_CLASS);
          element.dataset.janeSetComponentPriceHidden = 'true';
        }
      });
    });
  }

  function hideJaneQuantityButtons() {
    janeCartCards().forEach(card => {
      if (isJaneReviewContext(card) || !isCartContext(card)) return;

      card.querySelectorAll(
        'button, a, span, div, i, svg, [role="button"], [aria-label], [title]'
      ).forEach(control => {
        if (quantityAction(control)) {
          control.classList.add(QUANTITY_BUTTON_HIDDEN_CLASS);
        }
      });
    });
  }

  function removeJaneSetTitleLinks() {
    janeCartCards().forEach(card => {
      card.querySelectorAll('a').forEach(link => {
        if (link.querySelector('img') || deleteControlFrom(link)) return;

        const linkValue = normalize([
          link.textContent,
          link.getAttribute('href')
        ].filter(Boolean).join(' '));
        const isJaneTitle =
          linkValue.includes('jane set') ||
          linkValue.includes('jane blouse') ||
          linkValue.includes('jane pants') ||
          linkValue.includes('jane-set') ||
          linkValue.includes('jane-blouse') ||
          linkValue.includes('jane-pants') ||
          linkValue.includes('jane-coordinates-set') ||
          (
            linkValue.includes('/products/') &&
            linkValue.includes('premium-ity')
          );
        if (!isJaneTitle) return;

        const replacement = document.createElement('span');
        replacement.className = link.className;
        replacement.style.cssText = link.style.cssText;
        replacement.style.cursor = 'default';
        replacement.dataset.janeSetTitleLinkRemoved = 'true';
        while (link.firstChild) replacement.appendChild(link.firstChild);
        link.replaceWith(replacement);
      });
    });
  }

  function applyLightweightCartGuards() {
    hideComponentPrices();
    hideJaneQuantityButtons();
    removeJaneSetTitleLinks();
  }

  function schedulePriceCheck() {
    window.clearTimeout(priceCheckTimer);
    priceCheckTimer = window.setTimeout(applyLightweightCartGuards, 150);
  }

  function isJaneItem(item) {
    return Boolean(
      item?.properties?._set_id &&
      item.properties._set_name === 'Jane Set' &&
      JANE_ROLES.includes(item.properties._set_role)
    );
  }

  function visibleSku(card) {
    const match = String(card.textContent || '').match(/SKU:\s*([A-Z0-9_-]+)/i);
    return normalize(match?.[1]);
  }

  function occurrenceIndex(card, role) {
    const cards = [];
    document.querySelectorAll('button, a, [role="button"]').forEach(candidate => {
      if (!deleteControlFrom(candidate)) return;
      const candidateCard = findJaneCard(candidate);
      if (
        candidateCard?.role === role &&
        !cards.includes(candidateCard.element)
      ) {
        cards.push(candidateCard.element);
      }
    });
    return cards.indexOf(card);
  }

  function matchCartItem(cart, card, role) {
    let candidates = cart.items.filter(item =>
      isJaneItem(item) && item.properties._set_role === role
    );
    const sku = visibleSku(card);

    if (sku) {
      const skuMatches = candidates.filter(item =>
        normalize(item.properties?._set_component_sku || item.sku) === sku
      );
      if (skuMatches.length === 1) return skuMatches[0];
      if (skuMatches.length) candidates = skuMatches;
    }

    const index = occurrenceIndex(card, role);
    return candidates[index] || (candidates.length === 1 ? candidates[0] : null);
  }

  async function removeJaneSet(card, role) {
    const cartResponse = await fetch('/cart.js', {
      headers: { 'Accept': 'application/json' }
    });
    if (!cartResponse.ok) throw new Error('Unable to read the cart.');

    const cart = await cartResponse.json();
    const clickedItem = matchCartItem(cart, card, role);
    const setId = clickedItem?.properties?._set_id;
    if (!setId) throw new Error('Unable to match the Jane Set line.');

    const setItems = cart.items.filter(item =>
      isJaneItem(item) && item.properties._set_id === setId
    );
    const updates = Object.fromEntries(setItems.map(item => [item.key, 0]));
    if (!Object.keys(updates).length) return;

    const updateResponse = await fetch('/cart/update.js', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ updates })
    });
    if (!updateResponse.ok) throw new Error('Unable to remove the Jane Set.');
  }

  ['click', 'auxclick', 'pointerdown', 'touchend'].forEach(eventName => {
    document.addEventListener(eventName, blockJaneProductNavigation, true);
  });

  document.addEventListener('click', event => {
    const clickedLink = event.target.closest?.('a');
    const rawControl = event.target.closest?.('button, a, [role="button"]');
    const clickedImage =
      event.target.closest?.('img') ||
      clickedLink?.querySelector('img');
    if (clickedImage) {
      const imageCard = findJaneCard(clickedImage);
      if (
        imageCard &&
        JANE_ROLES.includes(imageCard.role) &&
        isCartContext(imageCard.element)
      ) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        return;
      }
    }

    const navigationControl = navigationControlFrom(event);
    if (navigationControl && !isAllowedCartControl(rawControl)) {
      const titleCard =
        findJaneCard(navigationControl) ||
        findJaneCard(event.target);
      if (
        titleCard &&
        JANE_ROLES.includes(titleCard.role) &&
        isCartContext(titleCard.element)
      ) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        return;
      }
    }

    if (!rawControl) return;

    const rawDescription = controlDescription(rawControl);
    if (
      findJaneCard(rawControl) ||
      /(add to cart|cart|bag)/.test(rawDescription)
    ) {
      schedulePriceCheck();
    }

    const quantityChange = quantityAction(rawControl);
    if (quantityChange) {
      if (isJaneReviewContext(rawControl)) return;

      const quantityCard = findJaneCard(rawControl);
      if (
        !quantityCard ||
        !JANE_ROLES.includes(quantityCard.role) ||
        !isCartContext(quantityCard.element)
      ) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      return;
    }

    let control = deleteControlFrom(rawControl);
    let card = control ? findJaneCard(control) : null;
    const iconOnlyDelete =
      !control &&
      rawControl.querySelector('svg') &&
      !normalize(rawControl.textContent) &&
      !rawControl.closest('[class*="quantity" i], [class*="stepper" i], [class*="counter" i]');

    if (iconOnlyDelete) {
      card = findJaneCard(rawControl);
      if (card) control = rawControl;
    }
    if (!card || !JANE_ROLES.includes(card.role)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    removeJaneSet(card.element, card.role).catch(error => {
      console.warn('[Jane Set Delete Guard] remove failed.', error);
    });
  }, true);

  document.addEventListener('afterCartChanged', schedulePriceCheck);
  document.addEventListener('cart:updated', schedulePriceCheck);
  installPriceStyle();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyLightweightCartGuards, { once: true });
  } else {
    applyLightweightCartGuards();
  }
})();
