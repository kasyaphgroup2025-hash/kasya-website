(function () {
  const selectors = {
    root: '[data-kasya-aov-cart]',
    close: '[data-kasya-aov-cart-close]',
    items: '[data-kasya-aov-cart-items]',
    count: '[data-kasya-aov-cart-count]',
    footerCount: '[data-kasya-aov-cart-footer-count]',
    subtotal: '[data-kasya-aov-cart-subtotal]',
    subtotalWrap: '[data-kasya-aov-cart-subtotal-wrap]',
    recommendations: '[data-kasya-aov-cart-recommendations]',
    recommendationData: '[data-kasya-aov-cart-recommendation-data]',
    stockData: '[data-kasya-aov-cart-stock-data]',
    recommendationCarousel: '[data-kasya-aov-cart-recommendation-carousel]',
    recommendationTitle: '[data-kasya-aov-cart-recommendation-title]',
    recommendationSubtitle: '[data-kasya-aov-cart-recommendation-subtitle]',
    emptyState: '[data-kasya-aov-cart-empty-state]',
    timer: '.kasya-aov-cart__timer',
    timerText: '[data-kasya-aov-cart-timer-text]',
    progressCopy: '[data-kasya-aov-cart-progress-copy]',
    progress: '[data-kasya-aov-cart-progress]',
    milestone: '[data-kasya-aov-cart-milestone]'
  };

  const reservation = {
    duration: 180,
    storageKey: 'kasyaAovCartReservation',
    endedText: 'Your reservation has ended. Please proceed before items sell out.',
    emptyText: 'Add an item to start your reservation timer.'
  };

  const offers = {
    freeShippingCents: 200000,
    discountCents: 300000,
    previewDiscountCents: 45000
  };

  const newToKasya = {
    modeNew: 'new-to-kasya',
    modeAutomatic: 'automatic-youll-love-these-too',
    modeFrequentlyBoughtTogether: 'frequently-bought-together',
    modeHidden: 'hidden'
  };

  const acquisitionPairingPriority = [
    { key: 'ellaV2', label: 'Ella V2' },
    { key: 'aLine', label: 'A-Line Maxi Skirt' },
    { key: 'wideLeg', label: 'Wide-Leg Pants' }
  ];

  const storefrontVisibility = {
    bundleKeywords: [
      'bundle',
      'bundles',
      'add to bundle',
      'add-to-bundle',
      'bundle product',
      'bundle linen',
      'bundle-linen',
      'promo bundle',
      'set bundle',
      'bundle linen pants',
      'bundle-linen-pants',
      'a line maxi skirt soft linen bundle',
      'a-line-maxi-skirt-soft-linen-bundle'
    ],
    colorSplitPatterns: [
      'wide leg pants soft linen',
      'wide-leg pants soft linen',
      'soft linen long skirt'
    ],
    colorSplitColors: [
      'navy blue',
      'red',
      'skintone',
      'skin tone',
      'dark teal',
      'emerald green',
      'gray',
      'army green',
      'black',
      'choco brown',
      'cream',
      'taupe',
      'mocha',
      'old rose'
    ],
    hiddenKeywords: [
      'jane-blouse',
      'jane blouse',
      'jane-pants',
      'jane pants',
      'component',
      'hidden',
      'unlisted',
      'internal',
      'test',
      'virtual',
      'setup',
      'copy'
    ],
    defaultAllowedCollectionHandles: [
      'pants',
      'skirts',
      'tops',
      'dresses',
      'kasya-set',
      'new-in',
      'core-essentials',
      'back-to-rhythm',
      'summer-collection',
      'everyday-edit',
      'premiere',
      'northern-blossom'
    ]
  };

  const formatMoney = (cents) => {
    if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
      return window.Shopify.formatMoney(cents, window.moneyFormat);
    }

    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: window.currencyMain || 'PHP'
    }).format((cents || 0) / 100);
  };

  const formatMoneyClean = (cents) => formatMoney(cents).replace(/\.00\b/, '');

  const parseMoneyToCents = (value) => {
    const normalized = String(value || '').replace(/[^0-9.]/g, '');
    const amount = Number.parseFloat(normalized);

    return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
  };

  const formatTimer = (seconds) => {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
    const remainder = (safeSeconds % 60).toString().padStart(2, '0');

    return `${minutes}:${remainder}`;
  };

  async function fetchKasyaAovCart() {
    const response = await fetch('/cart.js', {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error('Unable to fetch cart.');
    }

    return response.json();
  }

  async function changeKasyaAovCartLine(identifier, quantity) {
    const body = typeof identifier === 'string'
      ? { id: identifier, quantity }
      : { line: identifier, quantity };
    const response = await fetch('/cart/change.js', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error('Unable to update cart line.');
    }

    return response.json();
  }

  async function addKasyaAovCartItem(variantId, quantity = 1, properties = {}) {
    const response = await fetch('/cart/add.js', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: variantId,
        quantity,
        properties
      })
    });

    if (!response.ok) {
      throw new Error('Unable to add item to cart.');
    }

    return response.json();
  }

  async function fetchShopifyRecommendations(productId, intent) {
    if (!productId) return [];

    try {
      const response = await fetch(`/recommendations/products.json?product_id=${encodeURIComponent(productId)}&limit=10&intent=${encodeURIComponent(intent)}`, {
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) return [];
      const data = await response.json();

      return Array.isArray(data.products) ? data.products : [];
    } catch (error) {
      console.warn('[Kasya AOV Cart] Unable to fetch Shopify recommendations.', { productId, intent, error });
      return [];
    }
  }

  async function fetchShopifyProductByHandle(handle) {
    if (!handle) return null;

    try {
      const response = await fetch(`/products/${encodeURIComponent(handle)}.js`, {
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) return null;
      return response.json();
    } catch (error) {
      console.warn('[Kasya AOV Cart] Unable to fetch recommended product details.', { handle, error });
      return null;
    }
  }

  function getProductKey(product) {
    return String(product?.handle || product?.url || product?.title || '').toLowerCase();
  }

  function normalizeProductUrl(product) {
    if (product?.url) return product.url;
    if (product?.handle) return `/products/${product.handle}`;
    return '#';
  }

  function normalizeProductImage(product) {
    if (typeof product?.image === 'string') return product.image;
    if (product?.image?.src) return product.image.src;
    if (product?.featured_image?.src) return product.featured_image.src;
    if (typeof product?.featured_image === 'string') return product.featured_image;
    if (Array.isArray(product?.images) && product.images.length) {
      return typeof product.images[0] === 'string' ? product.images[0] : product.images[0]?.src || null;
    }

    return null;
  }

  function normalizeProductImages(product) {
    const images = [];

    if (product?.image) {
      images.push(product.image);
    }

    if (product?.featured_image) {
      images.push(product.featured_image);
    }

    if (Array.isArray(product?.images)) {
      images.push(...product.images);
    }

    return images.map((image) => {
      if (typeof image === 'string') {
        return { src: image, alt: '' };
      }

      return {
        src: image?.src || image?.url || image?.preview_image?.src || '',
        alt: image?.alt || image?.altText || ''
      };
    }).filter((image) => image.src);
  }

  function normalizeRecommendationProduct(product) {
    if (!product) return null;

    return {
      id: product.id || product.product_id || null,
      handle: product.handle || String(product.url || '').split('/products/')[1]?.split('?')[0]?.split('/')[0] || '',
      title: product.title || '',
      url: normalizeProductUrl(product),
      image: normalizeProductImage(product),
      images: normalizeProductImages(product),
      price: Number(product.price || product.price_min || product.variants?.[0]?.price || 0),
      available: product.available !== false,
      template: product.template || product.template_suffix || product.templateSuffix || '',
      type: product.type || product.product_type || '',
      vendor: product.vendor || '',
      tags: Array.isArray(product.tags) ? product.tags : String(product.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
      collections: product.collections || [],
      options: product.options_with_values || product.options || [],
      variants: product.variants || []
    };
  }

  async function hydrateRecommendationProduct(product) {
    const normalized = normalizeRecommendationProduct(product);
    if (!normalized?.handle) return normalized;
    const hasOptionValues = normalized.options.some((option) => Array.isArray(option?.values) && option.values.length);
    if (normalized.variants.length && hasOptionValues) return normalized;

    const details = await fetchShopifyProductByHandle(normalized.handle);
    if (!details) return normalized;

    return {
      ...normalized,
      ...normalizeRecommendationProduct(details),
      id: normalized.id || details.id || null,
      image: normalized.image || normalizeProductImage(details),
      url: normalized.url || normalizeProductUrl(details)
    };
  }

  async function hydrateRecommendationProducts(products) {
    const hydrated = await Promise.all((products || []).map(hydrateRecommendationProduct));
    const seen = new Set();

    return hydrated.filter((product) => {
      const key = getProductKey(product);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function normalizeText(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function getProductText(product) {
    return normalizeText([
      product?.handle,
      product?.title,
      product?.url,
      product?.template,
      product?.type,
      product?.vendor,
      ...(product?.tags || []),
      ...(product?.collections || []).flatMap((collection) => [collection.handle, collection.title]),
      ...(product?.variants || []).flatMap((variant) => getVariantTextParts(variant))
    ].filter(Boolean).join(' '));
  }

  function getVariantTextParts(variant) {
    if (!variant) return [];

    return [
      variant.title,
      variant.public_title,
      variant.option1,
      variant.option2,
      variant.option3,
      ...(variant.options || [])
    ].filter(Boolean);
  }

  function getVariantText(variant) {
    return normalizeText(getVariantTextParts(variant).join(' '));
  }

  function includesAny(text, words) {
    return words.some((word) => text.includes(word));
  }

  function getProductCategory(product) {
    const text = getProductText(product);

    if (includesAny(text, ['pants', 'pant', 'trouser', 'bottom', 'wide leg', 'wideleg', 'culotte'])) return 'bottom';
    if (includesAny(text, ['blouse', 'top', 'polo', 'shirt', 'camisa', 'tee'])) return 'top';
    if (includesAny(text, ['dress'])) return 'dress';
    if (includesAny(text, ['set', 'co ord', 'coord', 'co-ord'])) return 'set';
    if (includesAny(text, ['kimono', 'cover up', 'coverup', 'jacket', 'outer'])) return 'layer';

    return 'other';
  }

  function getProductKeywords(product) {
    const text = getProductText(product);
    const keywords = [
      'pants',
      'trouser',
      'bottom',
      'wide leg',
      'wideleg',
      'blouse',
      'top',
      'polo',
      'shirt',
      'dress',
      'set',
      'kimono',
      'linen',
      'soft linen',
      'viscose linen',
      'acid linen',
      'daily',
      'everyday',
      'relaxed',
      'easy'
    ];

    return keywords.filter((keyword) => text.includes(keyword));
  }

  function getCollectionKeys(product) {
    return new Set((product?.collections || []).flatMap((collection) => {
      return [collection.handle, collection.title].map(normalizeText).filter(Boolean);
    }));
  }

  function getTagKeys(product) {
    return new Set((product?.tags || []).map(normalizeText).filter(Boolean));
  }

  function getAllowedStorefrontCollections(productData = {}) {
    const configured = (productData._allowedStorefrontCollections || []).flatMap((collection) => {
      return [collection.handle, collection.title].map(normalizeText).filter(Boolean);
    });

    return new Set([
      ...storefrontVisibility.defaultAllowedCollectionHandles.map(normalizeText),
      ...configured
    ]);
  }

  function productHasHiddenSignal(product) {
    const text = getProductText(product);

    return storefrontVisibility.hiddenKeywords.some((keyword) => text.includes(normalizeText(keyword)));
  }

  function productHasBundleSignal(product) {
    const text = getProductText(product);

    return storefrontVisibility.bundleKeywords.some((keyword) => text.includes(normalizeText(keyword)));
  }

  function productHasColorSplitBundleSignal(product) {
    const productIdentity = normalizeText([
      product?.handle,
      product?.title,
      product?.url
    ].filter(Boolean).join(' '));
    if (!productIdentity) return false;

    const hasColor = storefrontVisibility.colorSplitColors
      .some((color) => productIdentity.includes(normalizeText(color)));
    const hasBundleProductPattern = storefrontVisibility.colorSplitPatterns
      .some((pattern) => productIdentity.includes(normalizeText(pattern)));

    return hasColor && hasBundleProductPattern;
  }

  function variantHasBlockedSignal(variant) {
    const text = getVariantText(variant);
    if (!text) return false;

    return text.includes('skintone') ||
      text.includes('skin tone') ||
      storefrontVisibility.bundleKeywords.some((keyword) => text.includes(normalizeText(keyword))) ||
      storefrontVisibility.hiddenKeywords.some((keyword) => text.includes(normalizeText(keyword)));
  }

  function productHasSkintoneVariantSignal(product) {
    return (product?.variants || []).some((variant) => {
      const text = getVariantText(variant);
      return text.includes('skintone') || text.includes('skin tone');
    });
  }

  function getRecommendationAvailableVariants(product) {
    return (product?.variants || []).filter((variant) => {
      if (!variantIsAvailable(variant) || Number(variant.price) <= 0) return false;
      return !variantHasBlockedSignal(variant);
    });
  }

  function getOptionDisplayPriority(option) {
    const name = normalizeText(option?.name || option || '');
    if (name.includes('color') || name.includes('colour')) return 1;
    if (name.includes('size')) return 2;
    return 3;
  }

  function getVariantImage(variant) {
    const image = variant?.featured_image || variant?.image || variant?.featured_media?.preview_image;

    if (typeof image === 'string') return { src: image, alt: variant?.title || '' };
    if (image?.src) return { src: image.src, alt: image.alt || variant?.title || '' };
    if (image?.url) return { src: image.url, alt: image.alt || variant?.title || '' };

    return null;
  }

  function getColorOptionPosition(product) {
    const colorOption = (product?.options || []).find((option, index) => {
      const name = normalizeText(option?.name || option || '');
      return name.includes('color') || name.includes('colour') || index === 0 && name.includes('shade');
    });

    return colorOption?.position || (product?.options || []).indexOf(colorOption) + 1 || null;
  }

  function getSelectedRecommendationColor(product, selections, variant) {
    const colorPosition = getColorOptionPosition(product);
    if (!colorPosition) return '';

    return selections[colorPosition] || variant?.[`option${colorPosition}`] || '';
  }

  function getRecommendationImageForSelection(product, variant, selections = {}) {
    const variantImage = getVariantImage(variant);
    if (variantImage?.src) return variantImage;

    const selectedColor = normalizeText(getSelectedRecommendationColor(product, selections, variant));
    if (selectedColor) {
      const matchedImage = (product.images || []).find((image) => {
        const imageText = normalizeText(`${image.alt || ''} ${image.src || ''}`);
        return imageText.includes(selectedColor);
      });

      if (matchedImage?.src) {
        return {
          src: matchedImage.src,
          alt: matchedImage.alt || `${product.title} ${getSelectedRecommendationColor(product, selections, variant)}`
        };
      }
    }

    return product.image ? { src: product.image, alt: product.title } : null;
  }

  function productIsInAllowedStorefrontCollection(product, productData = {}) {
    const productCollections = getCollectionKeys(product);
    if (!productCollections.size) return true;

    const allowedCollections = getAllowedStorefrontCollections(productData);
    return Array.from(productCollections).some((collection) => allowedCollections.has(collection));
  }

  function isJaneComponentProduct(product) {
    const key = `${product?.handle || ''} ${product?.title || ''}`.toLowerCase();

    return key.includes('jane-blouse') ||
      key.includes('jane blouse') ||
      key.includes('jane-pants') ||
      key.includes('jane pants');
  }

  function getCartProductKeys(cart) {
    return new Set((cart.items || []).map((item) => {
      const handle = item.handle || item.product_handle || String(item.url || '').split('/products/')[1]?.split('?')[0]?.split('/')[0] || '';
      return handle.toLowerCase();
    }).filter(Boolean));
  }

  function getCartProductIds(cart) {
    return new Set((cart.items || []).map((item) => String(item.product_id || '')).filter(Boolean));
  }

  function getManualRecommendationExclusionKeys(productData = {}) {
    return new Set((productData.manualExclusions || []).flatMap((product) => [
      product.handle,
      product.url,
      product.title
    ]).map((value) => String(value || '').toLowerCase()).filter(Boolean));
  }

  function productIsManuallyExcluded(product, productData = {}) {
    const exclusions = getManualRecommendationExclusionKeys(productData);
    if (!exclusions.size) return false;

    return [
      product?.handle,
      product?.url,
      product?.title,
      getProductKey(product)
    ].some((value) => exclusions.has(String(value || '').toLowerCase()));
  }

  function variantIsAvailable(variant) {
    return variant?.available !== false && variant?.available !== 'false';
  }

  function getProductPriceOrVariantExclusionReason(product) {
    const variants = product?.variants || [];

    if (variants.length) {
      if (!variants.some((variant) => Number(variant.price) > 0)) return 'missing valid price';
      if (!getRecommendationAvailableVariants(product).length) return 'no valid available variant';
      return '';
    }

    return Number(product?.price) > 0 ? '' : 'missing valid price';
  }

  function getAcquisitionProductPriceOrVariantExclusionReason(product) {
    const variants = product?.variants || [];
    const productPrice = Number(product?.price);

    if (variants.length) {
      const hasPricedVariant = variants.some((variant) => Number(variant.price) > 0 || productPrice > 0);
      if (!hasPricedVariant) return 'missing valid price';

      const hasAvailablePricedVariant = variants.some((variant) => {
        return variantIsAvailable(variant) && (Number(variant.price) > 0 || productPrice > 0);
      });
      if (!hasAvailablePricedVariant) return 'no valid available variant';

      return '';
    }

    return productPrice > 0 ? '' : 'missing valid price';
  }

  function acquisitionProductHasHiddenSignal(product) {
    const hiddenSignals = ['hidden', 'unlisted', 'internal', 'component', 'virtual', 'setup'];
    const searchableValues = [
      product?.handle,
      product?.title,
      product?.template,
      product?.type,
      ...(product?.tags || [])
    ].map(normalizeText).filter(Boolean);

    return searchableValues.some((value) => {
      const tokens = new Set(value.split(' ').filter(Boolean));
      return hiddenSignals.some((signal) => tokens.has(signal) || value === signal);
    });
  }

  function getLowStockCount(item, stockByKey = {}) {
    const stockFromLiquid = Number(stockByKey[item?.key]);
    if (Number.isFinite(stockFromLiquid) && stockFromLiquid > 0 && stockFromLiquid <= 5) {
      return stockFromLiquid;
    }

    const variant = item?.variant || {};
    const inventoryManagement = variant.inventory_management || item?.variant_inventory_management || item?.inventory_management || '';
    const inventoryPolicy = variant.inventory_policy || item?.variant_inventory_policy || item?.inventory_policy || '';
    const inventoryQuantity = Number(
      variant.inventory_quantity ??
      item?.variant_inventory_quantity ??
      item?.inventory_quantity
    );

    if (inventoryManagement !== 'shopify') return null;
    if (inventoryPolicy === 'continue') return null;
    if (!Number.isFinite(inventoryQuantity) || inventoryQuantity <= 0 || inventoryQuantity > 5) return null;

    return inventoryQuantity;
  }

  function getRecommendationSourceGroups(productData) {
    const sourceKeys = new Set(['love', 'completePants', 'completeTops', 'completeJane', 'fallback']);

    return Object.entries(productData || {}).filter(([key, products]) => sourceKeys.has(key) && Array.isArray(products));
  }

  function getNewToKasyaProducts(productData) {
    return Array.isArray(productData?.newToKasya) ? productData.newToKasya : [];
  }

  function productIsAvailable(product) {
    return product?.available !== false && product?.available !== 'false';
  }

  function getAcquisitionPairings(productData = {}) {
    return productData.acquisitionPairings && typeof productData.acquisitionPairings === 'object'
      ? productData.acquisitionPairings
      : {};
  }

  function getFilteredAcquisitionPairingProducts(pairingData = {}, cart, productData = {}) {
    const selectedProducts = Array.isArray(pairingData.products) ? pairingData.products.slice(0, 4) : [];
    const seen = new Set();
    const finalProducts = [];
    const excluded = [];

    selectedProducts.forEach((product) => {
      const key = String(product?.id || product?.handle || '').toLowerCase();
      const reason = getAcquisitionPairingExclusionReason(product, cart, seen, productData);
      if (key) seen.add(key);

      if (reason) {
        excluded.push(getDebugProductInfo(product, reason, 'acquisition-pairing'));
        return;
      }

      finalProducts.push(product);
    });

    return {
      selectedProducts,
      finalProducts,
      excluded
    };
  }

  function getAcquisitionPairingMatch(cart, productData = {}) {
    const pairings = getAcquisitionPairings(productData);
    const cartKeys = getCartProductKeys(cart);

    return acquisitionPairingPriority.map((pairing) => {
      const data = pairings[pairing.key] || {};
      const trigger = data.trigger;
      const triggerKey = getProductKey(trigger);
      if (!trigger || !triggerKey || !cartKeys.has(triggerKey)) return null;

      const filteredProducts = getFilteredAcquisitionPairingProducts(data, cart, productData);

      return {
        key: pairing.key,
        label: pairing.label,
        trigger,
        selectedProducts: filteredProducts.selectedProducts,
        products: filteredProducts.finalProducts,
        excluded: filteredProducts.excluded
      };
    }).find(Boolean) || null;
  }

  function getAcquisitionPairingDebug(cart, productData = {}) {
    const pairings = getAcquisitionPairings(productData);
    const match = getAcquisitionPairingMatch(cart, productData);
    const groups = acquisitionPairingPriority.reduce((debugGroups, pairing) => {
      const data = pairings[pairing.key] || {};
      const filteredProducts = getFilteredAcquisitionPairingProducts(data, cart, productData);
      const triggerKey = getProductKey(data.trigger);
      const cartHasTrigger = Boolean(triggerKey && getCartProductKeys(cart).has(triggerKey));

      debugGroups[pairing.key] = {
        label: pairing.label,
        cartHasTrigger,
        trigger: data.trigger
          ? {
              handle: data.trigger.handle,
              title: data.trigger.title
            }
          : null,
        selectedCount: filteredProducts.selectedProducts.length,
        renderedCount: filteredProducts.finalProducts.length,
        selectedProducts: filteredProducts.selectedProducts.map((product) => ({
          handle: product.handle,
          title: product.title
        })),
        finalProducts: filteredProducts.finalProducts.map((product) => ({
          handle: product.handle,
          title: product.title
        })),
        excluded: filteredProducts.excluded
      };

      return debugGroups;
    }, {});

    return {
      activeGroup: match?.products?.length ? match.key : null,
      selectedCount: match?.selectedProducts?.length || 0,
      renderedCount: match?.products?.length || 0,
      selectedProducts: (match?.selectedProducts || []).map((product) => ({
        handle: product.handle,
        title: product.title
      })),
      finalProducts: (match?.products || []).map((product) => ({
        handle: product.handle,
        title: product.title
      })),
      excluded: match?.excluded || [],
      groups
    };
  }

  function getAllRecommendationCandidates(productData) {
    const seen = new Set();

    return getRecommendationSourceGroups(productData).flatMap(([, products]) => products).filter((product) => {
      const key = getProductKey(product);
      if (!key || seen.has(key)) return false;

      seen.add(key);
      return true;
    });
  }

  function getDebugProductInfo(product, reason, source) {
    return {
      handle: product.handle,
      title: product.title,
      source,
      reason
    };
  }

  function dedupeDebugProducts(products) {
    return products.reduce((deduped, product) => {
      const key = `${product.source || ''}:${product.handle || product.title || ''}:${product.reason || ''}`.toLowerCase();
      if (key && deduped.seen.has(key)) return deduped;
      if (key) deduped.seen.add(key);
      deduped.items.push(product);
      return deduped;
    }, { seen: new Set(), items: [] }).items;
  }

  function findCandidateForCartItem(item, candidates) {
    const handle = item.handle || item.product_handle || String(item.url || '').split('/products/')[1]?.split('?')[0]?.split('/')[0] || '';
    if (!handle) return null;

    return candidates.find((product) => product.handle === handle) || null;
  }

  function getCartProfiles(cart, candidates) {
    return (cart.items || []).map((item) => {
      const matchedProduct = findCandidateForCartItem(item, candidates);
      const fallbackProduct = {
        handle: item.handle || item.product_handle || String(item.url || '').split('/products/')[1]?.split('?')[0]?.split('/')[0] || '',
        title: item.product_title,
        type: item.product_type,
        vendor: item.vendor,
        tags: [],
        collections: []
      };
      const product = matchedProduct || fallbackProduct;

      return {
        product,
        category: getProductCategory(product),
        keywords: getProductKeywords(product),
        collections: getCollectionKeys(product),
        tags: getTagKeys(product),
        isJaneSet: item.properties?._set_name === 'Jane Set'
      };
    });
  }

  function sharesSet(left, right) {
    return Array.from(left || []).some((value) => right?.has(value));
  }

  function scoreSimilarity(product, cartProfiles) {
    const productCategory = getProductCategory(product);
    const productKeywords = new Set(getProductKeywords(product));
    const productCollections = getCollectionKeys(product);
    const productTags = getTagKeys(product);
    let score = 0;

    cartProfiles.forEach((profile) => {
      if (profile.isJaneSet) score += 1;
      if (profile.category !== 'other' && productCategory === profile.category) score += 8;
      if (profile.product.type && product.type && normalizeText(profile.product.type) === normalizeText(product.type)) score += 5;
      if (sharesSet(productCollections, profile.collections)) score += 6;
      if (sharesSet(productTags, profile.tags)) score += 4;

      profile.keywords.forEach((keyword) => {
        if (productKeywords.has(keyword)) score += keyword.includes('linen') ? 4 : 2;
      });
    });

    return score;
  }

  function scoreCompleteLook(product, cartProfiles) {
    const productCategory = getProductCategory(product);
    const productCollections = getCollectionKeys(product);
    const productTags = getTagKeys(product);
    const hasBottom = cartProfiles.some((profile) => profile.category === 'bottom');
    const hasTop = cartProfiles.some((profile) => profile.category === 'top');
    const hasJaneSet = cartProfiles.some((profile) => profile.isJaneSet);
    const hasDressOrSet = cartProfiles.some((profile) => ['dress', 'set'].includes(profile.category) || profile.isJaneSet);
    let score = 0;

    if (hasJaneSet && ['top', 'bottom', 'layer', 'dress'].includes(productCategory)) score += 7;
    if (hasBottom && productCategory === 'top') score += 10;
    if (hasTop && productCategory === 'bottom') score += 10;
    if (hasDressOrSet && ['layer', 'top', 'bottom'].includes(productCategory)) score += 5;
    if (hasTop && hasBottom && ['layer', 'dress', 'set', 'other'].includes(productCategory)) score += 3;

    cartProfiles.forEach((profile) => {
      if (sharesSet(productCollections, profile.collections)) score += 4;
      if (sharesSet(productTags, profile.tags)) score += 2;
    });

    return score;
  }

  function filterRecommendationProducts(products, cart, usedKeys = new Set(), productData = {}, options = {}) {
    const cartKeys = getCartProductKeys(cart);

    return (products || []).filter((product) => {
      const key = getProductKey(product);
      if (!key || usedKeys.has(key) || cartKeys.has(String(product.handle || '').toLowerCase())) return false;
      if (getProductExclusionReason(product, cart, usedKeys, new Set(), productData, options)) return false;

      usedKeys.add(key);
      return true;
    }).slice(0, 4);
  }

  function getProductExclusionReason(product, cart, usedKeys = new Set(), seen = new Set(), productData = {}, options = {}) {
    const cartKeys = getCartProductKeys(cart);
    const key = getProductKey(product);
    const requireAllowedStorefrontCollection = options.requireAllowedStorefrontCollection !== false;

    if (!key) return 'missing product key';
    if (seen.has(key)) return 'duplicate candidate';
    if (usedKeys.has(key)) return 'already selected in another column';
    if (cartKeys.has(String(product.handle || '').toLowerCase())) return 'already in cart';
    if (productIsManuallyExcluded(product, productData)) return 'manual AOV exclusion';
    if (!productIsAvailable(product)) return 'unavailable or sold out';
    if (isJaneComponentProduct(product)) return 'Jane Blouse/Jane Pants excluded';
    if (productHasColorSplitBundleSignal(product)) return 'color-split bundle product';
    if (productHasBundleSignal(product)) return 'bundle signal found';
    if (productHasHiddenSignal(product)) return 'hidden/unlisted/internal/component signal';
    if (requireAllowedStorefrontCollection && !productIsInAllowedStorefrontCollection(product, productData)) return 'not in allowed storefront collections';
    if ((product.variants || []).length && productHasSkintoneVariantSignal(product) && !getRecommendationAvailableVariants(product).length) return 'skintone variant/option signal';
    const priceOrVariantReason = getProductPriceOrVariantExclusionReason(product);
    if (priceOrVariantReason) return priceOrVariantReason;

    return '';
  }

  function getAcquisitionPairingExclusionReason(product, cart, seen = new Set(), productData = {}) {
    const cartHandles = getCartProductKeys(cart);
    const cartProductIds = getCartProductIds(cart);
    const handle = String(product?.handle || '').toLowerCase();
    const productId = String(product?.id || '');
    const key = String(product?.id || product?.handle || '').toLowerCase();

    if (!handle) return 'missing product handle';
    if (seen.has(key)) return 'duplicate paired product';
    if ((productId && cartProductIds.has(productId)) || cartHandles.has(handle)) return 'already in cart';
    if (productIsManuallyExcluded(product, productData)) return 'manual AOV exclusion';
    if (!productIsAvailable(product)) return 'unavailable or sold out';
    if (isJaneComponentProduct(product)) return 'Jane Blouse/Jane Pants excluded';
    if (acquisitionProductHasHiddenSignal(product)) return 'hidden/unlisted/internal/component signal';

    const priceOrVariantReason = getAcquisitionProductPriceOrVariantExclusionReason(product);
    if (priceOrVariantReason) return priceOrVariantReason;

    return '';
  }

  function getScoredRecommendations(products, cart, cartProfiles, scorer, usedKeys = new Set(), minimumScore = 1, productData = {}) {
    const seen = new Set();

    return (products || []).map((product, index) => ({
      product,
      score: scorer(product, cartProfiles),
      index
    })).filter(({ product, score }) => {
      const reason = getProductExclusionReason(product, cart, usedKeys, seen, productData);
      if (reason) return false;
      const key = getProductKey(product);
      seen.add(key);

      return score >= minimumScore;
    }).sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.index - right.index;
    }).map(({ product }) => {
      usedKeys.add(getProductKey(product));
      return product;
    }).slice(0, 4);
  }

  function cartHasJaneSet(cart) {
    return (cart.items || []).some((item) => item.properties?._set_name === 'Jane Set');
  }

  function cartHasPants(cart) {
    return (cart.items || []).some((item) => {
      const text = `${item.product_title || ''} ${item.product_type || ''} ${item.vendor || ''} ${item.handle || ''}`.toLowerCase();
      return text.includes('pants') || text.includes('bottom') || text.includes('trouser');
    });
  }

  function cartHasTop(cart) {
    return (cart.items || []).some((item) => {
      const text = `${item.product_title || ''} ${item.product_type || ''} ${item.vendor || ''} ${item.handle || ''}`.toLowerCase();
      return text.includes('top') || text.includes('blouse') || text.includes('polo') || text.includes('shirt');
    });
  }

  function getDetectedCartType(cart) {
    if (cartHasJaneSet(cart)) return 'jane-set';
    if (cartHasPants(cart) && cartHasTop(cart)) return 'mixed-top-bottom';
    if (cartHasPants(cart)) return 'pants-bottoms';
    if (cartHasTop(cart)) return 'tops';
    return 'fallback';
  }

  function getCustomerRecommendationContext(productData = {}) {
    const customer = productData._customer || {};
    const loggedIn = Boolean(customer.loggedIn);
    const ordersCount = typeof customer.ordersCount === 'number' ? customer.ordersCount : null;
    const isLoggedInNewCustomer = loggedIn && ordersCount === 0;
    const isReturningCustomer = loggedIn && ordersCount > 0;
    /*
      Guest purchase history cannot be confirmed unless the customer logs in.
      Guests are treated as unknown, not confirmed new customers.
    */
    const isLikelyNewGuest = false;

    return {
      loggedIn,
      ordersCount,
      isLoggedInNewCustomer,
      isReturningCustomer,
      isLikelyNewGuest,
      isNewOrLikelyNew: isLoggedInNewCustomer,
      customerMode: loggedIn
        ? (isReturningCustomer ? 'logged-in-returning' : 'logged-in-new')
        : 'guest-unknown'
    };
  }

  function getCartProductRefs(cart) {
    const seen = new Set();

    return (cart.items || []).map((item) => ({
      id: item.product_id,
      handle: item.handle || item.product_handle || String(item.url || '').split('/products/')[1]?.split('?')[0]?.split('/')[0] || '',
      title: item.product_title || ''
    })).filter((item) => {
      const key = item.id || item.handle;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function getAutomaticRecommendationPools(cart) {
    const refs = getCartProductRefs(cart);
    const relatedResponses = await Promise.all(refs.map((item) => fetchShopifyRecommendations(item.id, 'related')));
    const complementaryResponses = await Promise.all(refs.map((item) => fetchShopifyRecommendations(item.id, 'complementary')));

    return {
      refs,
      related: await hydrateRecommendationProducts(relatedResponses.flat().map(normalizeRecommendationProduct).filter(Boolean)),
      complementary: await hydrateRecommendationProducts(complementaryResponses.flat().map(normalizeRecommendationProduct).filter(Boolean)),
      relatedCount: relatedResponses.reduce((sum, products) => sum + products.length, 0),
      complementaryCount: complementaryResponses.reduce((sum, products) => sum + products.length, 0)
    };
  }

  function mergeRecommendationPairs(similar, complete) {
    const used = new Set();
    const merged = [];
    const maxLength = Math.max(similar.length, complete.length);

    for (let index = 0; index < maxLength && merged.length < 4; index += 1) {
      [similar[index], complete[index]].forEach((product) => {
        const key = getProductKey(product);
        if (product && key && !used.has(key) && merged.length < 4) {
          used.add(key);
          merged.push(product);
        }
      });
    }

    return merged;
  }

  function getNewToKasyaStarterProducts(cart, productData = {}) {
    return filterRecommendationProducts(
      getNewToKasyaProducts(productData),
      cart,
      new Set(),
      productData,
      { requireAllowedStorefrontCollection: false }
    );
  }

  function getNewToKasyaStarterDebug(cart, productData = {}) {
    const selectedProducts = getNewToKasyaProducts(productData);
    const finalProducts = getNewToKasyaStarterProducts(cart, productData);
    const finalKeys = new Set(finalProducts.map(getProductKey));
    const seen = new Set();
    const excluded = selectedProducts.map((product, index) => {
      const key = getProductKey(product);
      let reason = getProductExclusionReason(
        product,
        cart,
        new Set(),
        seen,
        productData,
        { requireAllowedStorefrontCollection: false }
      );

      if (!reason && !finalKeys.has(key)) {
        reason = index >= 4 ? 'beyond max 4 starter products' : 'not rendered';
      }

      if (key) seen.add(key);

      return reason ? getDebugProductInfo(product, reason, 'new-to-kasya') : null;
    }).filter(Boolean);

    return {
      selectedCount: selectedProducts.length,
      renderedCount: finalProducts.length,
      requiredMinimum: 2,
      finalProducts: finalProducts.map((product) => ({
        handle: product.handle,
        title: product.title
      })),
      excluded
    };
  }

  function getNewToKasyaInactiveReason(customerContext, starterProductCount) {
    if (!customerContext.isNewOrLikelyNew) {
      return customerContext.loggedIn
        ? 'logged-in returning or unknown customer'
        : 'guest customer treated as unknown';
    }

    if (starterProductCount < 2) {
      return 'fewer than 2 valid starter products';
    }

    return '';
  }

  async function getKasyaAovRecommendations(cart, productData = {}, customerContext = getCustomerRecommendationContext(productData)) {
    const acquisitionPairing = getAcquisitionPairingMatch(cart, productData);
    if (acquisitionPairing?.products?.length) {
      return {
        similar: [],
        complete: [],
        merged: acquisitionPairing.products.slice(0, 4),
        usedFallback: false,
        automatic: {
          refs: getCartProductRefs(cart),
          related: [],
          complementary: [],
          relatedCount: 0,
          complementaryCount: 0
        },
        mode: newToKasya.modeFrequentlyBoughtTogether,
        title: 'Frequently Bought Together',
        subtitle: 'Based on what customers usually buy together.',
        starterProductCount: getNewToKasyaStarterProducts(cart, productData).length,
        acquisitionPairing: {
          active: true,
          key: acquisitionPairing.key,
          label: acquisitionPairing.label,
          trigger: {
            handle: acquisitionPairing.trigger.handle,
            title: acquisitionPairing.trigger.title
          },
          productCount: acquisitionPairing.products.length
        }
      };
    }

    const starterProducts = getNewToKasyaStarterProducts(cart, productData);

    if (customerContext.isNewOrLikelyNew && starterProducts.length >= 2) {
      return {
        similar: [],
        complete: [],
        merged: starterProducts.slice(0, 4),
        usedFallback: false,
        automatic: {
          refs: getCartProductRefs(cart),
          related: [],
          complementary: [],
          relatedCount: 0,
          complementaryCount: 0
        },
        mode: newToKasya.modeNew,
        title: 'New to Kasya? Start Here',
        subtitle: 'Easy bestsellers to try first.',
        starterProductCount: starterProducts.length,
        acquisitionPairing: {
          active: false
        }
      };
    }

    const automatic = await getAutomaticRecommendationPools(cart);
    const automaticCandidates = [
      ...automatic.related,
      ...automatic.complementary
    ];
    const fallbackCandidates = getAllRecommendationCandidates(productData);
    const cartProfiles = getCartProfiles(cart, [...automaticCandidates, ...fallbackCandidates]);
    const similarUsed = new Set();
    let similar = getScoredRecommendations(automatic.related, cart, cartProfiles, scoreSimilarity, similarUsed, 1, productData);
    const completeUsed = new Set(similar.map(getProductKey));
    let complete = getScoredRecommendations(automatic.complementary, cart, cartProfiles, scoreCompleteLook, completeUsed, 1, productData);
    let usedFallback = false;

    if (!complete.length) {
      complete = getScoredRecommendations(automatic.related, cart, cartProfiles, scoreCompleteLook, completeUsed, 1, productData);
    }

    if (similar.length < 2 || complete.length < 2) {
      usedFallback = true;
      const fallbackSimilarSource = productData.love?.length ? productData.love : fallbackCandidates;
      const fallbackCompleteSource = getFallbackCompleteSource(cart, productData, fallbackCandidates);

      if (similar.length < 2) {
        const existing = new Set(similar.map(getProductKey));
        const fallbackSimilar = getScoredRecommendations(fallbackSimilarSource, cart, cartProfiles, scoreSimilarity, existing, 1, productData);
        similar = [...similar, ...fallbackSimilar].slice(0, 4);
      }

      if (complete.length < 2) {
        const existing = new Set([...similar.map(getProductKey), ...complete.map(getProductKey)]);
        const fallbackComplete = getScoredRecommendations(fallbackCompleteSource, cart, cartProfiles, scoreCompleteLook, existing, 1, productData);
        complete = [...complete, ...fallbackComplete].slice(0, 4);
      }
    }

    const merged = mergeRecommendationPairs(similar, complete);
    const fillUsed = new Set(merged.map(getProductKey));

    if (merged.length < 4) {
      const filler = filterRecommendationProducts([...automaticCandidates, ...fallbackCandidates], cart, fillUsed, productData);
      filler.forEach((product) => {
        if (merged.length < 4) merged.push(product);
      });
    }

    return {
      similar,
      complete,
      merged: merged.slice(0, 4),
      usedFallback,
      automatic,
      mode: merged.length ? newToKasya.modeAutomatic : newToKasya.modeHidden,
      title: 'You’ll Love These Too',
      subtitle: 'Smart picks based on what’s in your cart.',
      starterProductCount: starterProducts.length,
      acquisitionPairing: {
        active: false
      }
    };
  }

  function getFallbackCompleteSource(cart, productData, fallbackCandidates) {
    if (cartHasJaneSet(cart)) {
      return [...(productData.completeJane || []), ...fallbackCandidates];
    }

    if (cartHasPants(cart) && !cartHasTop(cart)) {
      return [...(productData.completePants || []), ...fallbackCandidates];
    }

    if (cartHasTop(cart) && !cartHasPants(cart)) {
      return [...(productData.completeTops || []), ...fallbackCandidates];
    }

    return [...(productData.fallback || []), ...fallbackCandidates];
  }

  async function getRecommendationDebug(cart, productData = {}) {
    const customerContext = getCustomerRecommendationContext(productData);
    const recommendations = await getKasyaAovRecommendations(cart, productData, customerContext);
    const fallbackCandidates = getAllRecommendationCandidates(productData);
    const automaticCandidates = [
      ...recommendations.automatic.related,
      ...recommendations.automatic.complementary
    ];
    const debugCandidates = [
      ...recommendations.automatic.related.map((product) => ({ product, source: 'automatic-related' })),
      ...recommendations.automatic.complementary.map((product) => ({ product, source: 'automatic-complementary' })),
      ...fallbackCandidates.map((product) => ({ product, source: 'fallback' }))
    ];
    const candidates = debugCandidates.map(({ product }) => product);
    const cartProfiles = getCartProfiles(cart, candidates);
    const sourceCollections = productData._sources || {};
    const starterDebug = getNewToKasyaStarterDebug(cart, productData);
    const acquisitionPairingDebug = getAcquisitionPairingDebug(cart, productData);
    const candidateCounts = getRecommendationSourceGroups(productData).reduce((counts, [key, products]) => {
      counts[key] = products.length;
      return counts;
    }, {});
    const seen = new Set();
    const usedKeys = new Set([
      ...recommendations.similar.map(getProductKey),
      ...recommendations.complete.map(getProductKey)
    ]);
    const excluded = debugCandidates.map(({ product, source }) => {
      const reason = getProductExclusionReason(product, cart, new Set(), seen, productData) ||
        (usedKeys.has(getProductKey(product)) ? '' : 'not enough score for current cart');
      seen.add(getProductKey(product));

      return reason ? getDebugProductInfo(product, reason, source) : null;
    }).filter(Boolean);
    const allExcluded = dedupeDebugProducts([...excluded, ...starterDebug.excluded]);
    const excludedByReason = (reason) => allExcluded.filter((product) => product.reason === reason);

    return {
      customer: {
        loggedIn: customerContext.loggedIn,
        ordersCount: customerContext.ordersCount,
        isLoggedInNewCustomer: customerContext.isLoggedInNewCustomer,
        isLikelyNewGuest: customerContext.isLikelyNewGuest,
        mode: customerContext.customerMode
      },
      newToKasya: {
        active: recommendations.mode === newToKasya.modeNew,
        eligibleCustomer: customerContext.isNewOrLikelyNew,
        inactiveReason: recommendations.mode === newToKasya.modeNew
          ? ''
          : getNewToKasyaInactiveReason(customerContext, starterDebug.renderedCount),
        selectedCount: starterDebug.selectedCount,
        renderedCount: recommendations.mode === newToKasya.modeNew ? recommendations.merged.length : starterDebug.renderedCount,
        requiredMinimum: starterDebug.requiredMinimum,
        finalProducts: starterDebug.finalProducts,
        excluded: starterDebug.excluded
      },
      acquisitionPairing: {
        ...(recommendations.acquisitionPairing || { active: false }),
        ...acquisitionPairingDebug
      },
      finalMode: recommendations.mode,
      sourceCollections,
      allowedStorefrontCollections: {
        defaultHandles: productData._defaultAllowedStorefrontCollections || storefrontVisibility.defaultAllowedCollectionHandles,
        configured: productData._allowedStorefrontCollections || []
      },
      candidateCounts,
      automatic: {
        cartProducts: recommendations.automatic.refs,
        relatedCount: recommendations.automatic.relatedCount,
        complementaryCount: recommendations.automatic.complementaryCount
      },
      usedFallback: recommendations.usedFallback,
      cartType: getDetectedCartType(cart),
      cartProfiles: cartProfiles.map((profile) => ({
        handle: profile.product.handle,
        title: profile.product.title,
        category: profile.category,
        keywords: profile.keywords,
        isJaneSet: profile.isJaneSet
      })),
      finalProducts: {
        similar: recommendations.similar.map((product) => ({
          handle: product.handle,
          title: product.title,
          score: scoreSimilarity(product, cartProfiles)
        })),
        complete: recommendations.complete.map((product) => ({
          handle: product.handle,
          title: product.title,
          score: scoreCompleteLook(product, cartProfiles)
        })),
        merged: recommendations.merged.map((product) => ({
          handle: product.handle,
          title: product.title
        }))
      },
      exclusionsByReason: allExcluded.reduce((reasons, product) => {
        reasons[product.reason] = (reasons[product.reason] || 0) + 1;
        return reasons;
      }, {}),
      excludedByBundle: excludedByReason('bundle signal found'),
      excludedByColorSplitBundle: excludedByReason('color-split bundle product'),
      excludedByManualBlocklist: excludedByReason('manual AOV exclusion'),
      excludedBySkintone: excludedByReason('skintone variant/option signal'),
      excludedByHiddenInternal: excludedByReason('hidden/unlisted/internal/component signal'),
      excluded: allExcluded
    };
  }

  class KasyaAovCart extends HTMLElement {
    constructor() {
      super();
      this.cart = null;
      this.isUpdating = false;
      this.timerId = null;
      this.previousOfferSubtotal = null;
      this.activeRecommendationProducts = [];
      this.lastRecommendationMode = newToKasya.modeHidden;
      this.lowStockByKey = {};
      this.onClick = this.onClick.bind(this);
      this.onChange = this.onChange.bind(this);
      this.onKeydown = this.onKeydown.bind(this);
      this.onCartUpdated = this.onCartUpdated.bind(this);
    }

    connectedCallback() {
      this.addEventListener('click', this.onClick);
      this.addEventListener('change', this.onChange);
      document.addEventListener('keydown', this.onKeydown);
      document.addEventListener('afterUpdateQuantity', this.onCartUpdated);
      this.recommendationData = this.getRecommendationData();
      this.lowStockByKey = this.getLowStockData();
      const initialCart = { item_count: Number(this.querySelector(selectors.count)?.textContent.replace(/\D/g, '')) || 0, items: [] };
      this.renderLayoutState(initialCart);
      this.syncTimerWithCart(initialCart);
    }

    disconnectedCallback() {
      this.removeEventListener('click', this.onClick);
      this.removeEventListener('change', this.onChange);
      document.removeEventListener('keydown', this.onKeydown);
      document.removeEventListener('afterUpdateQuantity', this.onCartUpdated);
      this.stopTimer();
    }

    open() {
      this.setAttribute('aria-hidden', 'false');
      this.classList.add('kasya-aov-cart--open');
      document.documentElement.classList.add('kasya-aov-cart-is-open');
      this.refresh();
    }

    close() {
      this.setAttribute('aria-hidden', 'true');
      this.classList.remove('kasya-aov-cart--open');
      document.documentElement.classList.remove('kasya-aov-cart-is-open');
    }

    async refresh() {
      try {
        this.cart = await fetchKasyaAovCart();
        await this.refreshLowStockData();
        this.renderSummary(this.cart);
        this.renderItems(this.cart);
        this.syncTimerWithCart(this.cart);

        if (this.renderLayoutState(this.cart)) {
          return;
        }

        this.renderOfferProgress(this.cart);
        await this.renderRecommendations(this.cart);
      } catch (error) {
        console.warn(error);
      }
    }

    async updateQuantity(identifier, quantity) {
      if (this.isUpdating || !identifier && identifier !== 0) return;

      try {
        this.setUpdating(true);
        await changeKasyaAovCartLine(identifier, quantity);
        await this.refresh();
      } catch (error) {
        console.warn('[Kasya AOV Cart] Unable to update cart item.', error);
      } finally {
        this.setUpdating(false);
      }
    }

    renderSummary(cart) {
      const visualItemCount = this.getDisplayItems(cart).length;
      const count = this.querySelector(selectors.count);

      if (count) count.textContent = `(${visualItemCount})`;
      this.renderSubtotal(cart);
    }

    renderSubtotal(cart) {
      const subtotalWrap = this.querySelector(selectors.subtotalWrap);
      const itemCount = Number(cart?.item_count) || 0;
      const itemLabel = `${itemCount} item${itemCount === 1 ? '' : 's'}`;
      const finalSubtotal = Number.isFinite(cart?.total_price)
        ? cart.total_price
        : Number(cart?.items_subtotal_price) || 0;
      let originalSubtotal = Number.isFinite(cart?.original_total_price)
        ? cart.original_total_price
        : (cart?.items || []).reduce((sum, item) => sum + (Number(item.original_line_price) || Number(item.final_line_price) || 0), 0);
      const reportedDiscount = Math.max(Number(cart?.total_discount) || 0, 0);

      if (reportedDiscount > originalSubtotal - finalSubtotal) {
        originalSubtotal = finalSubtotal + reportedDiscount;
      }

      const discount = Math.max(originalSubtotal - finalSubtotal, reportedDiscount, 0);

      if (!subtotalWrap) {
        const subtotalElement = this.querySelector(selectors.subtotal);
        if (subtotalElement) subtotalElement.textContent = formatMoney(finalSubtotal);
        return;
      }

      if (discount > 0) {
        subtotalWrap.innerHTML = `
          <div class="kasya-aov-cart__subtotal-row">
            <span>Original Subtotal</span>
            <strong class="kasya-aov-cart__subtotal-amount">${formatMoney(originalSubtotal)}</strong>
          </div>
          <div class="kasya-aov-cart__subtotal-row kasya-aov-cart__subtotal-row--savings">
            <span>Discount</span>
            <strong>− ${formatMoney(discount)}</strong>
          </div>
          <div class="kasya-aov-cart__subtotal-row kasya-aov-cart__subtotal-row--final">
            <span>Subtotal (${itemLabel})</span>
            <strong class="kasya-aov-cart__subtotal-amount" data-kasya-aov-cart-subtotal>${formatMoney(finalSubtotal)}</strong>
          </div>
        `;
        return;
      }

      subtotalWrap.innerHTML = `
        <div class="kasya-aov-cart__subtotal-row">
          <span>Subtotal (<span data-kasya-aov-cart-footer-count>${itemLabel}</span>)</span>
          <strong class="kasya-aov-cart__subtotal-amount" data-kasya-aov-cart-subtotal>${formatMoney(finalSubtotal)}</strong>
        </div>
      `;
    }

    renderLinePrice(originalLinePrice, finalLinePrice) {
      const finalPrice = Math.max(Number(finalLinePrice) || 0, 0);
      const originalPrice = Math.max(Number(originalLinePrice) || finalPrice, 0);

      if (originalPrice > finalPrice) {
        return `
          <s class="kasya-aov-cart__item-price-original">${formatMoney(originalPrice)}</s>
          <span class="kasya-aov-cart__item-price-final">${formatMoney(finalPrice)}</span>
        `;
      }

      return `<span class="kasya-aov-cart__item-price-final">${formatMoney(finalPrice)}</span>`;
    }

    renderOfferProgress(cart) {
      const subtotal = this.getCartDisplaySubtotal(cart);
      const copy = this.querySelector(selectors.progressCopy);
      const progress = this.querySelector(selectors.progress);
      const progressPercent = Math.min((subtotal / offers.discountCents) * 100, 100);

      if (copy) {
        if (subtotal < offers.freeShippingCents) {
          copy.textContent = `You are ${formatMoneyClean(offers.freeShippingCents - subtotal)} away from getting FREE SHIPPING`;
        } else if (subtotal < offers.discountCents) {
          copy.textContent = `You unlocked FREE SHIPPING — ${formatMoneyClean(offers.discountCents - subtotal)} away from ₱450 OFF`;
        } else {
          copy.textContent = 'You unlocked FREE SHIPPING and ₱450 OFF';
        }
      }

      if (progress) {
        progress.style.width = `${progressPercent}%`;
      }

      this.renderMilestones(subtotal);
    }

    renderMilestones(subtotal) {
      const freeUnlocked = subtotal >= offers.freeShippingCents;
      const discountUnlocked = subtotal >= offers.discountCents;

      this.classList.toggle('kasya-aov-cart--free-shipping-unlocked', freeUnlocked);
      this.classList.toggle('kasya-aov-cart--discount-unlocked', discountUnlocked);

      if (this.previousOfferSubtotal !== null) {
        if (this.previousOfferSubtotal < offers.freeShippingCents && freeUnlocked) {
          this.animateMilestone('free');
        }

        if (this.previousOfferSubtotal < offers.discountCents && discountUnlocked) {
          this.animateMilestone('discount');
        }
      }

      this.previousOfferSubtotal = subtotal;
    }

    animateMilestone(name) {
      const milestone = this.querySelector(`${selectors.milestone}[data-kasya-aov-cart-milestone="${name}"]`);
      if (!milestone) return;

      milestone.classList.remove('kasya-aov-cart__shipping-milestone--animate');
      window.requestAnimationFrame(() => {
        milestone.classList.add('kasya-aov-cart__shipping-milestone--animate');
        window.setTimeout(() => {
          milestone.classList.remove('kasya-aov-cart__shipping-milestone--animate');
        }, 900);
      });
    }

    renderItems(cart) {
      const container = this.querySelector(selectors.items);

      if (!container) {
        return;
      }

      if (!cart.items.length) {
        container.innerHTML = '';
        return;
      }

      container.innerHTML = this.getDisplayItems(cart).map((item) => {
        if (item.type === 'jane-set') {
          return this.renderJaneSetItem(item);
        }

        return this.renderItem(item.item, item.line);
      }).join('');
    }

    renderItem(item, line) {
      const imageMarkup = item.image
        ? `<img src="${item.image}" alt="${this.escapeHtml(item.product_title)}" loading="lazy" width="110" height="132" class="kasya-aov-cart__item-image">`
        : '<span class="kasya-aov-cart__item-image kasya-aov-cart__item-image--placeholder"></span>';
      const variantMarkup = item.variant_title && item.variant_title !== 'Default Title'
        ? `<p class="kasya-aov-cart__item-variant">${this.escapeHtml(item.variant_title.replaceAll(' / ', ' | '))}</p>`
        : '';
      const skuMarkup = item.sku
        ? `<p class="kasya-aov-cart__item-sku">SKU: ${this.escapeHtml(item.sku)}</p>`
        : '';
      const lowStockCount = getLowStockCount(item, this.lowStockByKey);
      const lowStockMarkup = lowStockCount
        ? `<p class="kasya-aov-cart__item-low-stock">${lowStockCount} only left</p>`
        : '';

      return `
        <article class="kasya-aov-cart__item" data-kasya-aov-cart-item data-line="${line}" data-key="${this.escapeHtml(item.key)}">
          <a class="kasya-aov-cart__item-media" href="${item.url}" tabindex="-1" aria-hidden="true">
            ${imageMarkup}
          </a>
          <div class="kasya-aov-cart__item-content">
            <div class="kasya-aov-cart__item-topline">
              <a class="kasya-aov-cart__item-title" href="${item.url}">${this.escapeHtml(item.product_title)}</a>
              <button type="button" class="kasya-aov-cart__item-remove" data-kasya-aov-cart-remove data-kasya-remove-line data-line="${line}" data-key="${this.escapeHtml(item.key)}" data-line-key="${this.escapeHtml(item.key)}" aria-label="Remove ${this.escapeHtml(item.product_title)}">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            ${variantMarkup}
            ${skuMarkup}
            ${lowStockMarkup}
            <div class="kasya-aov-cart__item-bottomline">
              <div class="kasya-aov-cart__quantity" aria-label="Quantity controls for ${this.escapeHtml(item.product_title)}">
                <button type="button" class="kasya-aov-cart__quantity-button" data-kasya-aov-cart-decrease data-line="${line}" data-key="${this.escapeHtml(item.key)}" data-line-key="${this.escapeHtml(item.key)}" aria-label="Decrease quantity for ${this.escapeHtml(item.product_title)}">-</button>
                <span class="kasya-aov-cart__quantity-value" data-kasya-aov-cart-quantity>${item.quantity}</span>
                <button type="button" class="kasya-aov-cart__quantity-button" data-kasya-aov-cart-increase data-line="${line}" data-key="${this.escapeHtml(item.key)}" data-line-key="${this.escapeHtml(item.key)}" aria-label="Increase quantity for ${this.escapeHtml(item.product_title)}">+</button>
              </div>
              <div class="kasya-aov-cart__item-price">${this.renderLinePrice(item.original_line_price, item.final_line_price)}</div>
            </div>
          </div>
        </article>
      `;
    }

    renderJaneSetItem(set) {
      const image = set.parent?.properties?._set_parent_image || set.parent?.image || set.top?.properties?._set_parent_image || set.top?.image || set.pants?.image;
      const imageMarkup = image
        ? `<img src="${image}" alt="Jane Set" loading="lazy" width="110" height="132" class="kasya-aov-cart__item-image">`
        : '<span class="kasya-aov-cart__item-image kasya-aov-cart__item-image--placeholder"></span>';
      const details = [set.top, set.pants].filter(Boolean).map((item) => {
        const label = item.properties?._set_component_label || item.product_title;
        const size = item.properties?._set_component_size || item.properties?._top_size || item.properties?._pants_size || '';
        const variant = size || (item.variant_title && item.variant_title !== 'Default Title' ? item.variant_title.replaceAll(' / ', ' | ') : '');
        const skuValue = item.properties?._set_component_sku || item.sku || '';
        const sku = skuValue ? ` SKU: ${skuValue}` : '';

        return `<p class="kasya-aov-cart__item-variant">${this.escapeHtml(label)}${variant ? `: ${this.escapeHtml(variant)}` : ''}${this.escapeHtml(sku)}</p>`;
      }).join('');
      const quantity = this.getJaneSetQuantity(set);
      const originalPrice = (set.items || []).reduce((sum, item) => {
        return sum + (Number(item.original_line_price) || Number(item.final_line_price) || 0);
      }, 0);
      const finalPrice = this.getJaneSetActualPrice(set);
      const keys = (set.items || []).map((item) => item.key).filter(Boolean).join(',');
      const setColor = this.getJaneSetColor(set);

      return `
        <article class="kasya-aov-cart__item kasya-aov-cart__item--jane-set" data-kasya-aov-cart-jane-set data-set-id="${this.escapeHtml(set.setId)}" data-set-group-id="${this.escapeHtml(set.setId)}" data-keys="${this.escapeHtml(keys)}" data-line-keys="${this.escapeHtml(keys)}">
          <div class="kasya-aov-cart__item-media">
            ${imageMarkup}
          </div>
          <div class="kasya-aov-cart__item-content">
            <div class="kasya-aov-cart__item-topline">
              <div>
                <p class="kasya-aov-cart__item-kicker">Set</p>
                <span class="kasya-aov-cart__item-title">${this.escapeHtml(setColor)} Jane Set</span>
              </div>
              <button type="button" class="kasya-aov-cart__item-remove" data-kasya-aov-cart-remove-set data-kasya-aov-remove-set data-set-id="${this.escapeHtml(set.setId)}" data-set-group-id="${this.escapeHtml(set.setId)}" data-keys="${this.escapeHtml(keys)}" data-line-keys="${this.escapeHtml(keys)}" aria-label="Remove Jane Set">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            ${details}
            <div class="kasya-aov-cart__item-bottomline">
              <div class="kasya-aov-cart__quantity kasya-aov-cart__quantity--locked" aria-label="Jane Set quantity">
                <span class="kasya-aov-cart__quantity-value">${quantity}</span>
              </div>
              <div class="kasya-aov-cart__item-price">${this.renderLinePrice(originalPrice, finalPrice)}</div>
            </div>
          </div>
        </article>
      `;
    }

    getDisplayItems(cart) {
      const renderedSetIds = new Set();
      const displayItems = [];

      cart.items.forEach((item, index) => {
        const setId = item.properties?._set_id;
        const isJaneSet = setId && item.properties?._set_name === 'Jane Set';

        if (!isJaneSet) {
          displayItems.push({ type: 'item', item, line: index + 1 });
          return;
        }

        if (renderedSetIds.has(setId)) return;
        renderedSetIds.add(setId);

        const setItems = cart.items.filter((candidate) => {
          return candidate.properties?._set_id === setId && candidate.properties?._set_name === 'Jane Set';
        });

        displayItems.push({
          type: 'jane-set',
          setId,
          parent: setItems.find((candidate) => candidate.properties?._set_role === 'Parent'),
          top: setItems.find((candidate) => candidate.properties?._set_role === 'Top'),
          pants: setItems.find((candidate) => candidate.properties?._set_role === 'Pants'),
          items: setItems
        });
      });

      return displayItems;
    }

    getJaneSetQuantity(set) {
      return Math.max(set.parent?.quantity || 0, set.top?.quantity || 0, set.pants?.quantity || 0, 1);
    }

    getJaneSetColor(set) {
      return set.parent?.properties?._set_color ||
        set.top?.properties?._set_color ||
        set.pants?.properties?._set_color ||
        'Jane';
    }

    getJaneSetDisplayPrice(set) {
      const displayPrice = [
        set.parent?.properties?._set_display_price,
        set.top?.properties?._set_display_price,
        set.pants?.properties?._set_display_price
      ].map(parseMoneyToCents).find((price) => price > 0);

      if (displayPrice) {
        return displayPrice * this.getJaneSetQuantity(set);
      }

      if (set.parent?.final_line_price && set.parent.final_line_price > 100) {
        return set.parent.final_line_price;
      }

      return (set.items || []).reduce((sum, item) => sum + (item.final_line_price || 0), 0);
    }

    getJaneSetActualPrice(set) {
      return (set.items || []).reduce((sum, item) => sum + (item.final_line_price || 0), 0);
    }

    async renderRecommendations(cart) {
      const customerContext = getCustomerRecommendationContext(this.recommendationData);
      const recommendations = await getKasyaAovRecommendations(cart, this.recommendationData, customerContext);
      const container = this.querySelector(selectors.recommendations);
      const carousel = this.querySelector(selectors.recommendationCarousel);
      const title = this.querySelector(selectors.recommendationTitle);
      const subtitle = this.querySelector(selectors.recommendationSubtitle);

      if (!container || !carousel) {
        return;
      }

      if (!recommendations.merged.length) {
        container.hidden = true;
        carousel.innerHTML = '';
        this.activeRecommendationProducts = [];
        this.lastRecommendationMode = newToKasya.modeHidden;
        return;
      }

      container.hidden = false;
      this.lastRecommendationMode = recommendations.mode;
      if (title) title.textContent = recommendations.title;
      if (subtitle) subtitle.textContent = recommendations.subtitle;
      this.activeRecommendationProducts = recommendations.merged;
      carousel.innerHTML = recommendations.merged.map((product) => this.renderRecommendationCard(product)).join('');
      this.syncRecommendationCards();

    }

    renderRecommendationCard(product) {
      const options = this.getRecommendationOptions(product);
      const selectedVariant = this.getSelectedRecommendationVariant(product, {});
      const selectedImage = getRecommendationImageForSelection(product, selectedVariant, {});
      const tracking = this.getRecommendationTracking();
      const imageMarkup = selectedImage?.src
        ? `<img class="kasya-aov-cart__recommendation-image" src="${this.escapeHtml(selectedImage.src)}" alt="${this.escapeHtml(selectedImage.alt || product.title)}" loading="lazy">`
        : '<div class="kasya-aov-cart__recommendation-image kasya-aov-cart__recommendation-image--placeholder" aria-hidden="true"></div>';
      const optionMarkup = options.map((option) => this.renderRecommendationOption(product, option)).join('');
      const buttonLabel = selectedVariant ? 'Add' : 'Choose options';

      return `
        <article class="kasya-aov-cart__recommendation-card" data-kasya-aov-cart-recommendation-card data-product-handle="${this.escapeHtml(product.handle)}" data-kasya-aov-source="${this.escapeHtml(tracking.source)}" data-kasya-aov-section="${this.escapeHtml(tracking.section)}">
          <a class="kasya-aov-cart__recommendation-image-link" href="${this.escapeHtml(product.url)}" tabindex="-1" aria-hidden="true">
            ${imageMarkup}
          </a>
          <div class="kasya-aov-cart__recommendation-info">
            <a href="${this.escapeHtml(product.url)}" class="kasya-aov-cart__recommendation-title">${this.escapeHtml(product.title)}</a>
            <p class="kasya-aov-cart__recommendation-price">${formatMoney(this.getRecommendationPrice(product, selectedVariant))}</p>
            ${optionMarkup ? `<div class="kasya-aov-cart__recommendation-options">${optionMarkup}</div>` : ''}
            <button type="button" class="kasya-aov-cart__recommendation-add" data-kasya-aov-cart-recommendation-add data-variant-id="${selectedVariant?.id || ''}" data-kasya-aov-source="${this.escapeHtml(tracking.source)}" data-kasya-aov-section="${this.escapeHtml(tracking.section)}" ${selectedVariant ? '' : 'disabled'}>
              ${buttonLabel}
            </button>
          </div>
        </article>
      `;
    }

    getRecommendationTracking(mode = this.lastRecommendationMode) {
      if (mode === newToKasya.modeNew) {
        return {
          source: 'new_here',
          section: 'New Here'
        };
      }

      if (mode === newToKasya.modeAutomatic) {
        return {
          source: 'youll_love_these_too',
          section: 'You\'ll Love These Too'
        };
      }

      if (mode === newToKasya.modeFrequentlyBoughtTogether) {
        return {
          source: 'frequently_bought_together',
          section: 'Frequently Bought Together'
        };
      }

      const section = this.querySelector(selectors.recommendationTitle)?.textContent?.trim() || 'AOV Recommendation';

      return {
        source: this.getRecommendationTrackingSource(section),
        section
      };
    }

    getRecommendationTrackingSource(section) {
      return String(section || 'aov_recommendation')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'aov_recommendation';
    }

    renderRecommendationOption(product, option) {
      const values = option.values || [];
      if (!values.length) return '';

      return `
        <label class="kasya-aov-cart__recommendation-option">
          <span>${this.escapeHtml(option.name)}</span>
          <select data-kasya-aov-cart-recommendation-option data-option-position="${option.position || 1}" aria-label="${this.escapeHtml(`${product.title} ${option.name}`)}">
            ${values.map((value) => `<option value="${this.escapeHtml(value)}">${this.escapeHtml(value)}</option>`).join('')}
          </select>
        </label>
      `;
    }

    syncRecommendationCards() {
      this.querySelectorAll('[data-kasya-aov-cart-recommendation-card]').forEach((card) => {
        this.syncRecommendationCard(card);
      });
    }

    syncRecommendationCard(card) {
      const product = this.getRecommendationProductByHandle(card.dataset.productHandle);
      const button = card.querySelector('[data-kasya-aov-cart-recommendation-add]');
      const price = card.querySelector('.kasya-aov-cart__recommendation-price');
      const image = card.querySelector('.kasya-aov-cart__recommendation-image');
      if (!product || !button) return;

      const selections = this.getRecommendationSelections(card);
      const variant = this.getSelectedRecommendationVariant(product, selections);
      const selectedImage = getRecommendationImageForSelection(product, variant, selections);
      button.dataset.variantId = variant?.id || '';
      button.disabled = !variant;
      button.textContent = variant ? 'Add' : 'Choose options';
      if (price) price.textContent = formatMoney(this.getRecommendationPrice(product, variant));
      if (image?.tagName === 'IMG' && selectedImage?.src) {
        image.setAttribute('src', selectedImage.src);
        image.removeAttribute('srcset');
        image.setAttribute('alt', selectedImage.alt || product.title);
      }
    }

    getRecommendationOptions(product) {
      const options = product.options || [];
      const validVariants = getRecommendationAvailableVariants(product);

      return options.map((option, index) => ({
        name: option.name || option,
        position: option.position || index + 1,
        values: (option.values || []).map((value) => {
          if (typeof value === 'string') return value;
          return value.name || value.value || String(value);
        }).filter((value) => {
          if (!validVariants.length) return true;
          const position = option.position || index + 1;
          return validVariants.some((variant) => variant[`option${position}`] === value);
        })
      })).filter((option) => {
        const name = String(option.name || '').toLowerCase();
        return option.values.length > 1 && name !== 'title';
      }).sort((left, right) => {
        const priorityDiff = getOptionDisplayPriority(left) - getOptionDisplayPriority(right);
        return priorityDiff || left.position - right.position;
      });
    }

    getRecommendationSelections(card) {
      return Array.from(card.querySelectorAll('[data-kasya-aov-cart-recommendation-option]')).reduce((selections, select) => {
        selections[select.dataset.optionPosition] = select.value;
        return selections;
      }, {});
    }

    getSelectedRecommendationVariant(product, selections) {
      const variants = getRecommendationAvailableVariants(product);

      return variants.find((variant) => {
        return [1, 2, 3].every((position) => {
          const selected = selections[position];
          return !selected || variant[`option${position}`] === selected;
        });
      }) || null;
    }

    getRecommendationPrice(product, variant) {
      return Number(variant?.price || product.price || 0);
    }

    getRecommendationProductByHandle(handle) {
      return [
        ...(this.activeRecommendationProducts || []),
        ...getNewToKasyaProducts(this.recommendationData),
        ...getRecommendationSourceGroups(this.recommendationData)
        .flatMap(([, products]) => products)
      ]
        .find((product) => product.handle === handle);
    }

    getRecommendationData() {
      const dataElement = document.querySelector(selectors.recommendationData);
      if (!dataElement) return {};

      try {
        return JSON.parse(dataElement.textContent || '{}');
      } catch (error) {
        console.warn('[Kasya AOV Cart] Unable to parse recommendation data.', error);
        return {};
      }
    }

    getLowStockData(root = document) {
      const dataElement = root.querySelector(selectors.stockData);
      if (!dataElement) return {};

      try {
        const data = JSON.parse(dataElement.textContent || '{}');
        return data.items || {};
      } catch (error) {
        console.warn('[Kasya AOV Cart] Unable to parse low stock data.', error);
        return {};
      }
    }

    async refreshLowStockData() {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('section_id', 'kasya-aov-cart-drawer');
        const response = await fetch(url.toString(), {
          credentials: 'same-origin',
          headers: { Accept: 'text/html' }
        });
        if (!response.ok) return;

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        this.lowStockByKey = this.getLowStockData(doc);
      } catch (error) {
        console.warn('[Kasya AOV Cart] Unable to refresh low stock data.', error);
      }
    }

    async debugRecommendations() {
      const cart = this.cart || { items: [], item_count: 0 };
      const debug = await getRecommendationDebug(cart, this.recommendationData);
      console.table(debug.finalProducts.similar);
      console.table(debug.finalProducts.complete);
      console.table(debug.finalProducts.merged);
      console.table(debug.acquisitionPairing.groups || {});
      console.table(debug.acquisitionPairing.excluded || []);
      console.table(debug.newToKasya.finalProducts);
      console.table(debug.newToKasya.excluded);
      console.table(debug.excludedByBundle);
      console.table(debug.excludedByColorSplitBundle);
      console.table(debug.excludedByManualBlocklist);
      console.table(debug.excludedBySkintone);
      console.table(debug.excludedByHiddenInternal);
      console.table(debug.excluded);
      console.info('[Kasya AOV Cart] Recommendation debug', debug);
      return debug;
    }

    renderLayoutState(cart) {
      const isEmpty = typeof cart.item_count === 'number'
        ? cart.item_count === 0
        : !cart.items || cart.items.length === 0;

      this.classList.toggle('kasya-aov-cart--empty', isEmpty);

      const emptyState = this.querySelector(selectors.emptyState);
      if (emptyState) {
        emptyState.toggleAttribute('hidden', !isEmpty);
      }

      if (isEmpty) {
        this.previousOfferSubtotal = 0;
        this.classList.remove('kasya-aov-cart--free-shipping-unlocked', 'kasya-aov-cart--discount-unlocked');
      }

      return isEmpty;
    }

    syncTimerWithCart(cart) {
      const itemCount = cart.item_count || 0;
      const storedState = this.getTimerState();
      const now = Date.now();
      const previousCount = storedState.itemCount || 0;
      const shouldReset = itemCount > 0 && (!storedState.expiresAt || itemCount > previousCount);

      if (itemCount === 0) {
        this.clearTimerState();
        this.stopTimer();
        this.renderTimerText(reservation.emptyText);
        return;
      }

      if (shouldReset) {
        this.setTimerState({
          itemCount,
          expiresAt: now + reservation.duration * 1000
        });
      } else {
        this.setTimerState({
          itemCount,
          expiresAt: storedState.expiresAt
        });
      }

      this.startTimer();
    }

    startTimer() {
      this.stopTimer();
      this.tickTimer();
      this.timerId = window.setInterval(() => this.tickTimer(), 1000);
    }

    stopTimer() {
      if (this.timerId) {
        window.clearInterval(this.timerId);
        this.timerId = null;
      }
    }

    tickTimer() {
      const state = this.getTimerState();
      const remainingSeconds = Math.ceil(((state.expiresAt || 0) - Date.now()) / 1000);

      if (!state.expiresAt || remainingSeconds <= 0) {
        this.stopTimer();
        this.renderTimerEndedText();
        return;
      }

      this.renderTimerCountdown(formatTimer(remainingSeconds));
    }

    renderTimerText(text) {
      const timerText = this.querySelector(selectors.timerText);
      const timer = this.querySelector(selectors.timer);

      timer?.classList.remove('kasya-aov-cart__timer--ended');

      if (timerText) {
        timerText.textContent = text;
      }
    }

    renderTimerCountdown(time) {
      const timer = this.querySelector(selectors.timer);
      const timerText = this.querySelector(selectors.timerText);
      if (!timerText) return;

      timer?.classList.remove('kasya-aov-cart__timer--ended');

      const timerTime = document.createElement('strong');
      timerTime.className = 'kasya-aov-cart__timer-time';
      timerTime.dataset.kasyaAovCartTimerTime = '';
      timerTime.textContent = time;

      timerText.replaceChildren(
        document.createTextNode('Your products are reserved for '),
        timerTime,
        document.createTextNode(' minutes!')
      );
    }

    renderTimerEndedText() {
      const timer = this.querySelector(selectors.timer);
      const timerText = this.querySelector(selectors.timerText);
      if (!timerText) return;

      timer?.classList.add('kasya-aov-cart__timer--ended');
      timerText.textContent = reservation.endedText;
    }

    getTimerState() {
      try {
        return JSON.parse(window.sessionStorage.getItem(reservation.storageKey)) || {};
      } catch (error) {
        return {};
      }
    }

    setTimerState(state) {
      try {
        window.sessionStorage.setItem(reservation.storageKey, JSON.stringify(state));
      } catch (error) {
        console.warn(error);
      }
    }

    clearTimerState() {
      try {
        window.sessionStorage.removeItem(reservation.storageKey);
      } catch (error) {
        console.warn(error);
      }
    }

    getCartDisplaySubtotal(cart) {
      let subtotal = typeof cart.items_subtotal_price === 'number' ? cart.items_subtotal_price : cart.total_price || 0;

      this.getDisplayItems(cart).forEach((item) => {
        if (item.type !== 'jane-set') return;

        subtotal = subtotal - this.getJaneSetActualPrice(item) + this.getJaneSetDisplayPrice(item);
      });

      return Math.max(subtotal, 0);
    }

    onCartUpdated(event) {
      if (event.detail && event.detail.cartData) {
        this.cart = event.detail.cartData;
        this.renderSummary(this.cart);
        this.renderItems(this.cart);
        this.syncTimerWithCart(this.cart);

        if (this.renderLayoutState(this.cart)) {
          return;
        }

        this.renderOfferProgress(this.cart);
        this.renderRecommendations(this.cart);
      }
    }

    onClick(event) {
      if (event.target.closest(selectors.close)) {
        event.preventDefault();
        event.stopPropagation();
        this.close();
        return;
      }

      const removeButton = event.target.closest('[data-kasya-aov-cart-remove]');
      if (removeButton) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        this.updateQuantity(this.getLineIdentifier(removeButton), 0);
        return;
      }

      const removeSetButton = event.target.closest('[data-kasya-aov-cart-remove-set], [data-kasya-aov-remove-set]');
      if (removeSetButton) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        this.removeJaneSetByGroup(
          removeSetButton.dataset.setId || removeSetButton.dataset.setGroupId,
          (removeSetButton.dataset.keys || removeSetButton.dataset.lineKeys || '').split(',').filter(Boolean)
        );
        return;
      }

      const decreaseButton = event.target.closest('[data-kasya-aov-cart-decrease]');
      if (decreaseButton) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        const lineElement = decreaseButton.closest('[data-kasya-aov-cart-item]');
        const quantity = Number(lineElement.querySelector('[data-kasya-aov-cart-quantity]').textContent);
        this.updateQuantity(this.getLineIdentifier(decreaseButton), Math.max(quantity - 1, 0));
        return;
      }

      const increaseButton = event.target.closest('[data-kasya-aov-cart-increase]');
      if (increaseButton) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        const lineElement = increaseButton.closest('[data-kasya-aov-cart-item]');
        const quantity = Number(lineElement.querySelector('[data-kasya-aov-cart-quantity]').textContent);
        this.updateQuantity(this.getLineIdentifier(increaseButton), quantity + 1);
        return;
      }

      const recommendationAdd = event.target.closest('[data-kasya-aov-cart-recommendation-add]');
      if (recommendationAdd) {
        event.preventDefault();
        event.stopPropagation();
        this.addRecommendationItem(recommendationAdd);
      }
    }

    onChange(event) {
      const recommendationOption = event.target.closest('[data-kasya-aov-cart-recommendation-option]');
      if (!recommendationOption) return;

      const card = recommendationOption.closest('[data-kasya-aov-cart-recommendation-card]');
      if (card) this.syncRecommendationCard(card);
    }

    onKeydown(event) {
      if (event.key === 'Escape' && this.classList.contains('kasya-aov-cart--open')) {
        this.close();
      }
    }

    async removeItemsByKey(keys, options = {}) {
      if ((!options.keepUpdatingState && this.isUpdating) || !keys.length) return;

      try {
        if (!options.keepUpdatingState) this.setUpdating(true);
        const response = await fetch('/cart/update.js', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            updates: keys.reduce((updates, key) => {
              updates[key] = 0;
              return updates;
            }, {})
          })
        });

        if (!response.ok) {
          throw new Error('Unable to remove Jane Set.');
        }

        await this.refresh();
      } catch (error) {
        console.warn('[Kasya AOV Cart] Unable to remove Jane Set.', error);
      } finally {
        if (!options.keepUpdatingState) this.setUpdating(false);
      }
    }

    async removeJaneSetByGroup(setId, renderedKeys = []) {
      if (this.isUpdating || !setId) {
        console.warn('[Kasya AOV Cart] Missing Jane Set group id; removal skipped.');
        return;
      }

      try {
        this.setUpdating(true);
        const latestCart = await fetchKasyaAovCart();
        const setKeys = (latestCart.items || [])
          .filter((item) => {
            return item.properties?._set_id === setId &&
              item.properties?._set_name === 'Jane Set' &&
              ['Parent', 'Top', 'Pants'].includes(item.properties?._set_role);
          })
          .map((item) => item.key)
          .filter(Boolean);

        if (!setKeys.length) {
          console.warn('[Kasya AOV Cart] No matching Jane Set keys found; removal skipped.', { setId });
          return;
        }

        const renderedKeySet = new Set(renderedKeys.filter(Boolean));
        if (renderedKeySet.size && setKeys.some((key) => !renderedKeySet.has(key))) {
          console.warn('[Kasya AOV Cart] Jane Set keys changed since render; using latest verified cart keys.', { setId, setKeys });
        }

        await this.removeItemsByKey(setKeys, { keepUpdatingState: true });
      } catch (error) {
        console.warn('[Kasya AOV Cart] Unable to remove Jane Set group.', error);
      } finally {
        this.setUpdating(false);
      }
    }

    async addRecommendationItem(button) {
      const variantId = Number(button.dataset.variantId);
      if (this.isUpdating || !Number.isFinite(variantId) || variantId <= 0) return;

      try {
        this.setUpdating(true);
        const card = button.closest('[data-kasya-aov-cart-recommendation-card]');
        const fallbackTracking = this.getRecommendationTracking();
        const tracking = {
          source: button.dataset.kasyaAovSource || card?.dataset.kasyaAovSource || fallbackTracking.source,
          section: button.dataset.kasyaAovSection || card?.dataset.kasyaAovSection || fallbackTracking.section
        };

        await addKasyaAovCartItem(variantId, 1, {
          _kasya_aov_source: tracking.source,
          _kasya_aov_section: tracking.section,
          _kasya_aov_added_from: 'cart_drawer'
        });
        await this.refresh();
      } catch (error) {
        console.warn('[Kasya AOV Cart] Unable to add recommended item.', error);
      } finally {
        this.setUpdating(false);
      }
    }

    getLineIdentifier(control) {
      const key = control.dataset.key || control.dataset.lineKey || control.closest('[data-kasya-aov-cart-item]')?.dataset.key;
      if (key) return key;

      const line = Number(control.dataset.line || control.closest('[data-kasya-aov-cart-item]')?.dataset.line);
      return Number.isFinite(line) ? line : null;
    }

    setUpdating(isUpdating) {
      this.isUpdating = isUpdating;
      this.classList.toggle('kasya-aov-cart--loading', isUpdating);
      this.querySelectorAll('button').forEach((button) => {
        button.disabled = isUpdating;
        button.setAttribute('aria-disabled', String(isUpdating));
      });

      if (!isUpdating) {
        this.syncRecommendationCards();
      }
    }

    escapeHtml(value) {
      return String(value || '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[character]);
    }
  }

  if (!customElements.get('kasya-aov-cart')) {
    customElements.define('kasya-aov-cart', KasyaAovCart);
  }

  window.KasyaAovCart = {
    open() {
      document.querySelector(selectors.root)?.open();
    },
    close() {
      document.querySelector(selectors.root)?.close();
    },
    refresh() {
      return document.querySelector(selectors.root)?.refresh();
    },
    fetchCart: fetchKasyaAovCart,
    changeLine: changeKasyaAovCartLine,
    addItem: addKasyaAovCartItem,
    getRecommendations: getKasyaAovRecommendations,
    debugRecommendations() {
      return document.querySelector(selectors.root)?.debugRecommendations();
    }
  };

  // Kasya AOV Cart Drawer basket icon testing hook - temporary draft preview only.
  // Keeps the original cart drawer available as fallback if the AOV drawer API is missing or fails.
  document.addEventListener('click', (event) => {
    const cartIcon = event.target.closest('#cart-icon-bubble');
    if (!cartIcon || !window.KasyaAovCart?.open) return;

    try {
      window.KasyaAovCart.open();
      event.preventDefault();
      event.stopImmediatePropagation();
    } catch (error) {
      console.warn('[Kasya AOV Cart] Basket icon preview hook failed; falling back to original cart behavior.', error);
    }
  }, true);
})();
