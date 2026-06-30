(() => {
  const GROUP_CLASS = 'jane-set-aov-group';
  const COMPONENT_ATTRIBUTE = 'data-jane-set-aov-component';
  let cartSnapshot = null;
  let refreshTimer = null;
  let applying = false;

  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const escapeSelector = (value) => window.CSS?.escape ? window.CSS.escape(String(value)) : String(value).replace(/["\\]/g, '\\$&');

  function getJaneSetGroups(cart) {
    return cart.items.reduce((groups, item) => {
      const properties = item.properties || {};
      if (!properties._set_id || properties._set_name !== 'Jane Set') return groups;

      groups[properties._set_id] = groups[properties._set_id] || [];
      groups[properties._set_id].push(item);
      return groups;
    }, {});
  }

  function getSearchValues(item) {
    return [
      item.key,
      item.variant_id,
      item.sku,
      item.product_title,
      item.properties?._set_component_label,
      item.properties?._set_component_sku
    ].filter(Boolean).map(normalize);
  }

  function containsItemText(element, item) {
    const text = normalize(element.textContent);
    return getSearchValues(item).some(value => value.length > 3 && text.includes(value));
  }

  function findItemCard(root, item, otherItem) {
    const selectors = [
      `[data-key="${escapeSelector(item.key)}"]`,
      `[data-line-item-key="${escapeSelector(item.key)}"]`,
      `[data-variant-id="${escapeSelector(item.variant_id)}"]`,
      `[data-product-id="${escapeSelector(item.product_id)}"]`
    ];

    for (const selector of selectors) {
      const match = root.querySelector(selector);
      if (match) {
        return match.closest('li, article, [class*="item" i], [class*="product" i]') || match;
      }
    }

    const textElements = root.querySelectorAll('a, h1, h2, h3, h4, h5, h6, p, span, div');
    for (const element of textElements) {
      if (!containsItemText(element, item)) continue;

      let card = element;
      while (card.parentElement && card.parentElement !== root) {
        const parent = card.parentElement;
        if (otherItem && containsItemText(parent, otherItem)) break;
        card = parent;
      }
      return card;
    }

    return null;
  }

  function createGroupCard(setId, items) {
    const top = items.find(item => item.properties?._set_role === 'Top');
    const pants = items.find(item => item.properties?._set_role === 'Pants');
    const displayItem = top || pants;
    const color = displayItem?.properties?._set_color || 'Jane';
    const total = items.reduce((sum, item) => sum + item.final_line_price, 0);
    const displayPrice = displayItem?.properties?._set_display_price || formatMoney(total);
    const card = document.createElement('article');

    card.className = GROUP_CLASS;
    card.dataset.janeSetId = setId;
    card.innerHTML = `
      <div class="${GROUP_CLASS}__content">
        <strong class="${GROUP_CLASS}__title">${escapeHtml(`${color} Jane Set`)}</strong>
        ${componentMarkup(top, `${color} Blouse`)}
        ${componentMarkup(pants, `${color} Pants`)}
        <strong class="${GROUP_CLASS}__price">${escapeHtml(displayPrice)}</strong>
      </div>
      <button type="button" class="${GROUP_CLASS}__remove" aria-label="${escapeHtml(`Remove ${color} Jane Set`)}">
        Remove
      </button>
    `;

    card.querySelector(`.${GROUP_CLASS}__remove`).addEventListener('click', () => removeSet(items, card));
    return card;
  }

  function componentMarkup(item, fallbackLabel) {
    if (!item) {
      return `<p class="${GROUP_CLASS}__warning">Incomplete set</p>`;
    }

    const properties = item.properties || {};
    const label = properties._set_component_label || fallbackLabel;
    const size = properties._set_component_size ||
      (properties._set_role === 'Top' ? properties._top_size : properties._pants_size);
    const sku = properties._set_component_sku || item.sku || '';

    return `
      <div class="${GROUP_CLASS}__component">
        <span>${escapeHtml(`${label}: ${size || ''}`)}</span>
        ${sku ? `<small>SKU: ${escapeHtml(sku)}</small>` : ''}
      </div>
    `;
  }

  function escapeHtml(value) {
    const element = document.createElement('span');
    element.textContent = String(value || '');
    return element.innerHTML;
  }

  function formatMoney(cents) {
    if (window.Shopify?.formatMoney) return window.Shopify.formatMoney(cents);
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: cartSnapshot?.currency || 'PHP',
      maximumFractionDigits: 0
    }).format(cents / 100);
  }

  function getAppRoots(items) {
    const selectors = '[id*="aov" i], [class*="aov" i], [id*="avada" i], [class*="avada" i]';
    const candidates = [];
    const visited = new Set();

    function inspectRoot(root) {
      if (!root || visited.has(root)) return;
      visited.add(root);

      root.querySelectorAll(selectors).forEach(element => {
        if (element.closest('cart-drawer') || element.closest('[data-jane-set-hero]')) return;
        if (items.every(item => containsItemText(element, item))) candidates.push(element);
      });

      root.querySelectorAll('*').forEach(element => {
        if (element.shadowRoot) inspectRoot(element.shadowRoot);
      });
    }

    inspectRoot(document);
    return candidates.filter(candidate => {
      return !candidates.some(other => other !== candidate && candidate.contains(other) && items.every(item => containsItemText(other, item)));
    });
  }

  function applyGroups(cart) {
    if (applying) return;
    applying = true;

    try {
      const groups = getJaneSetGroups(cart);
      Object.entries(groups).forEach(([setId, items]) => {
        if (items.length < 2) {
          removeSet(items);
          return;
        }

        getAppRoots(items).forEach(root => {
          if (root.querySelector(`.${GROUP_CLASS}[data-jane-set-id="${escapeSelector(setId)}"]`)) return;

          const top = items.find(item => item.properties?._set_role === 'Top');
          const pants = items.find(item => item.properties?._set_role === 'Pants');
          const topCard = top ? findItemCard(root, top, pants) : null;
          const pantsCard = pants ? findItemCard(root, pants, top) : null;
          const firstCard = topCard || pantsCard;
          if (!firstCard) return;

          firstCard.before(createGroupCard(setId, items));
          [topCard, pantsCard].filter(Boolean).forEach(card => {
            card.hidden = true;
            card.setAttribute(COMPONENT_ATTRIBUTE, setId);
          });
          updateVisibleCount(root, cart);
        });
      });
    } finally {
      applying = false;
    }
  }

  function updateVisibleCount(root, cart) {
    const groups = getJaneSetGroups(cart);
    const componentCount = Object.values(groups).reduce((sum, items) => sum + items.reduce((quantity, item) => quantity + item.quantity, 0), 0);
    const visualCount = cart.item_count - componentCount + Object.keys(groups).length;

    root.querySelectorAll('h1, h2, h3, [class*="title" i], [class*="header" i]').forEach(element => {
      if (!/almost yours|cart/i.test(element.textContent || '')) return;
      if (/\(\d+\)/.test(element.textContent)) {
        element.textContent = element.textContent.replace(/\(\d+\)/, `(${visualCount})`);
      }
    });
  }

  async function removeSet(items, card) {
    const updates = items.reduce((result, item) => {
      result[item.key] = 0;
      return result;
    }, {});

    card?.querySelector(`.${GROUP_CLASS}__remove`)?.setAttribute('disabled', 'disabled');

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

      const cart = await response.json();
      cartSnapshot = cart;
      card?.remove();
      const setId = items[0]?.properties?._set_id;
      if (setId) {
        document.querySelectorAll(`[${COMPONENT_ATTRIBUTE}="${escapeSelector(setId)}"]`).forEach(element => element.remove());
      }
      document.dispatchEvent(new CustomEvent('afterCartChanged', {
        detail: { source: 'jane-set-aov-remove', cartData: cart }
      }));
      document.dispatchEvent(new CustomEvent('cart:refresh', { detail: { cart } }));
      scheduleRefresh(100);
    } catch (error) {
      card?.querySelector(`.${GROUP_CLASS}__remove`)?.removeAttribute('disabled');
      console.error(error);
    }
  }

  async function refresh() {
    try {
      const response = await fetch('/cart.js', { headers: { 'Accept': 'application/json' } });
      if (!response.ok) return;
      cartSnapshot = await response.json();
      applyGroups(cartSnapshot);
    } catch (error) {
      console.error(error);
    }
  }

  function scheduleRefresh(delay = 60) {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refresh, delay);
  }

  function burstRefresh() {
    [0, 150, 500, 1200].forEach(delay => window.setTimeout(refresh, delay));
  }

  function addStyles() {
    if (document.getElementById('JaneSetAovStyles')) return;
    const styles = document.createElement('style');
    styles.id = 'JaneSetAovStyles';
    styles.textContent = `
      .${GROUP_CLASS} {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin: 12px 0;
        padding: 16px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.12);
        background: #fff;
        color: #111;
      }
      .${GROUP_CLASS}__content { display: grid; gap: 8px; min-width: 0; }
      .${GROUP_CLASS}__title { font-size: 16px; }
      .${GROUP_CLASS}__component { display: grid; gap: 2px; font-size: 13px; }
      .${GROUP_CLASS}__component small { color: #666; }
      .${GROUP_CLASS}__price { margin-top: 4px; font-size: 16px; }
      .${GROUP_CLASS}__remove {
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font: inherit;
        text-decoration: underline;
      }
      .${GROUP_CLASS}__warning { color: #b42318; font-size: 12px; }
    `;
    document.head.appendChild(styles);
  }

  addStyles();
  document.addEventListener('afterCartChanged', burstRefresh);
  document.addEventListener('cart:updated', burstRefresh);
  new MutationObserver(() => scheduleRefresh()).observe(document.body, { childList: true, subtree: true });
  burstRefresh();
})();
