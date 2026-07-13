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
    recommendationCarousel: '[data-kasya-aov-cart-recommendation-carousel]',
    recommendationTitle: '[data-kasya-aov-cart-recommendation-title]',
    recommendationSubtitle: '[data-kasya-aov-cart-recommendation-subtitle]',
    emptyState: '[data-kasya-aov-cart-empty-state]',
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
    modeHidden: 'hidden'
  };

  const storefrontVisibility = {
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
      'setup'
    ],
    defaultAllowedCollectionHandles: [
      'pants',
      'skirts',
      'tops',
      'dresses',
      'kasya-set',
      'new-in',
      'core-essentials',
      'bundles',
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

  function normalizeRecommendationProduct(product) {
    if (!product) return null;

    return {
      id: product.id || product.product_id || null,
      handle: product.handle || String(product.url || '').split('/products/')[1]?.split('?')[0]?.split('/')[0] || '',
      title: product.title || '',
      url: normalizeProductUrl(product),
      image: normalizeProductImage(product),
      price: Number(product.price || product.price_min || product.variants?.[0]?.price || 0),
      available: product.available !== false,
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
      product?.type,
      product?.vendor,
      ...(product?.tags || []),
      ...(product?.collections || []).flatMap((collection) => [collection.handle, collection.title])
    ].filter(Boolean).join(' '));
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

  function productHasValidPrice(product) {
    if (Number(product?.price) > 0) return true;

    return (product?.variants || []).some((variant) => Number(variant.price) > 0);
  }

  function getRecommendationSourceGroups(productData) {
    const sourceKeys = new Set(['love', 'completePants', 'completeTops', 'completeJane', 'fallback']);

    return Object.entries(productData || {}).filter(([key, products]) => sourceKeys.has(key) && Array.isArray(products));
  }

  function getNewToKasyaProducts(productData) {
    return Array.isArray(productData?.newToKasya) ? productData.newToKasya : [];
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

  function filterRecommendationProducts(products, cart, usedKeys = new Set(), productData = {}) {
    const cartKeys = getCartProductKeys(cart);

    return (products || []).filter((product) => {
      const key = getProductKey(product);
      if (!key || usedKeys.has(key) || cartKeys.has(String(product.handle || '').toLowerCase())) return false;
      if (getProductExclusionReason(product, cart, usedKeys, new Set(), productData)) return false;

      usedKeys.add(key);
      return true;
    }).slice(0, 4);
  }

  function getProductExclusionReason(product, cart, usedKeys = new Set(), seen = new Set(), productData = {}) {
    const cartKeys = getCartProductKeys(cart);
    const key = getProductKey(product);

    if (!key) return 'missing product key';
    if (seen.has(key)) return 'duplicate candidate';
    if (usedKeys.has(key)) return 'already selected in another column';
    if (cartKeys.has(String(product.handle || '').toLowerCase())) return 'already in cart';
    if (!product.available) return 'unavailable or sold out';
    if (isJaneComponentProduct(product)) return 'Jane Blouse/Jane Pants excluded';
    if (productHasHiddenSignal(product)) return 'hidden/unlisted/internal/component signal';
    if (!productIsInAllowedStorefrontCollection(product, productData)) return 'not in allowed storefront collections';
    if (!productHasValidPrice(product)) return 'missing valid price';

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
      Guests are therefore treated as likely new visitors whenever starter products are configured.
    */
    const isLikelyNewGuest = !loggedIn;

    return {
      loggedIn,
      ordersCount,
      isLoggedInNewCustomer,
      isReturningCustomer,
      isLikelyNewGuest,
      isNewOrLikelyNew: isLoggedInNewCustomer || isLikelyNewGuest,
      customerMode: loggedIn
        ? (isReturningCustomer ? 'logged-in-returning' : 'logged-in-new')
        : 'guest-likely-new'
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

  async function getKasyaAovRecommendations(cart, productData = {}, customerContext = getCustomerRecommendationContext(productData)) {
    const starterProducts = filterRecommendationProducts(getNewToKasyaProducts(productData), cart, new Set(), productData);

    if (customerContext.isNewOrLikelyNew && starterProducts.length) {
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
        starterProductCount: starterProducts.length
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
      starterProductCount: starterProducts.length
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
    const candidates = [
      ...automaticCandidates,
      ...fallbackCandidates
    ];
    const cartProfiles = getCartProfiles(cart, candidates);
    const sourceCollections = productData._sources || {};
    const candidateCounts = getRecommendationSourceGroups(productData).reduce((counts, [key, products]) => {
      counts[key] = products.length;
      return counts;
    }, {});
    const seen = new Set();
    const usedKeys = new Set([
      ...recommendations.similar.map(getProductKey),
      ...recommendations.complete.map(getProductKey)
    ]);
    const excluded = candidates.map((product) => {
      const reason = getProductExclusionReason(product, cart, new Set(), seen, productData) ||
        (usedKeys.has(getProductKey(product)) ? '' : 'not enough score for current cart');
      seen.add(getProductKey(product));

      return reason ? {
        handle: product.handle,
        title: product.title,
        reason
      } : null;
    }).filter(Boolean);

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
        selectedCount: getNewToKasyaProducts(productData).length,
        renderedCount: recommendations.mode === newToKasya.modeNew ? recommendations.merged.length : 0
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
      exclusionsByReason: excluded.reduce((reasons, product) => {
        reasons[product.reason] = (reasons[product.reason] || 0) + 1;
        return reasons;
      }, {}),
      excluded
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
      const itemLabel = `${visualItemCount} item${visualItemCount === 1 ? '' : 's'}`;
      const count = this.querySelector(selectors.count);
      const footerCount = this.querySelector(selectors.footerCount);
      const subtotal = this.getCartDisplaySubtotal(cart);

      if (count) count.textContent = `(${visualItemCount})`;
      if (footerCount) footerCount.textContent = itemLabel;
      this.renderSubtotal(subtotal);
    }

    renderSubtotal(subtotal) {
      const subtotalWrap = this.querySelector(selectors.subtotalWrap);

      if (!subtotalWrap) {
        const subtotalElement = this.querySelector(selectors.subtotal);
        if (subtotalElement) subtotalElement.textContent = formatMoney(subtotal);
        return;
      }

      if (subtotal >= offers.discountCents) {
        const finalSubtotal = Math.max(subtotal - offers.previewDiscountCents, 0);

        subtotalWrap.innerHTML = `
          <div class="kasya-aov-cart__subtotal-row">
            <span>Subtotal</span>
            <strong>${formatMoney(subtotal)}</strong>
          </div>
          <div class="kasya-aov-cart__subtotal-row kasya-aov-cart__subtotal-row--savings">
            <span>Save ₱450</span>
            <strong>-${formatMoney(offers.previewDiscountCents)}</strong>
          </div>
          <div class="kasya-aov-cart__subtotal-row kasya-aov-cart__subtotal-row--final">
            <span>Final</span>
            <strong data-kasya-aov-cart-subtotal>${formatMoney(finalSubtotal)}</strong>
          </div>
        `;
        return;
      }

      subtotalWrap.innerHTML = `
        <div class="kasya-aov-cart__subtotal-row">
          <span>Subtotal (<span data-kasya-aov-cart-footer-count></span>)</span>
          <strong data-kasya-aov-cart-subtotal>${formatMoney(subtotal)}</strong>
        </div>
      `;

      const footerCount = this.querySelector(selectors.footerCount);
      if (footerCount && this.cart) {
        const visualItemCount = this.getDisplayItems(this.cart).length;
        footerCount.textContent = `${visualItemCount} item${visualItemCount === 1 ? '' : 's'}`;
      }
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
            <div class="kasya-aov-cart__item-bottomline">
              <div class="kasya-aov-cart__quantity" aria-label="Quantity controls for ${this.escapeHtml(item.product_title)}">
                <button type="button" class="kasya-aov-cart__quantity-button" data-kasya-aov-cart-decrease data-line="${line}" data-key="${this.escapeHtml(item.key)}" data-line-key="${this.escapeHtml(item.key)}" aria-label="Decrease quantity for ${this.escapeHtml(item.product_title)}">-</button>
                <span class="kasya-aov-cart__quantity-value" data-kasya-aov-cart-quantity>${item.quantity}</span>
                <button type="button" class="kasya-aov-cart__quantity-button" data-kasya-aov-cart-increase data-line="${line}" data-key="${this.escapeHtml(item.key)}" data-line-key="${this.escapeHtml(item.key)}" aria-label="Increase quantity for ${this.escapeHtml(item.product_title)}">+</button>
              </div>
              <div class="kasya-aov-cart__item-price">${formatMoney(item.final_line_price)}</div>
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
      const price = this.getJaneSetDisplayPrice(set);
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
              <div class="kasya-aov-cart__item-price">${formatMoney(price)}</div>
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
      const imageMarkup = product.image
        ? `<img class="kasya-aov-cart__recommendation-image" src="${this.escapeHtml(product.image)}" alt="${this.escapeHtml(product.title)}" loading="lazy">`
        : '<div class="kasya-aov-cart__recommendation-image kasya-aov-cart__recommendation-image--placeholder" aria-hidden="true"></div>';
      const options = this.getRecommendationOptions(product);
      const selectedVariant = this.getSelectedRecommendationVariant(product, {});
      const optionMarkup = options.map((option) => this.renderRecommendationOption(product, option)).join('');
      const buttonLabel = selectedVariant ? 'Add' : 'Choose options';

      return `
        <article class="kasya-aov-cart__recommendation-card" data-kasya-aov-cart-recommendation-card data-product-handle="${this.escapeHtml(product.handle)}">
          <a class="kasya-aov-cart__recommendation-image-link" href="${this.escapeHtml(product.url)}" tabindex="-1" aria-hidden="true">
            ${imageMarkup}
          </a>
          <div class="kasya-aov-cart__recommendation-info">
            <a href="${this.escapeHtml(product.url)}" class="kasya-aov-cart__recommendation-title">${this.escapeHtml(product.title)}</a>
            <p class="kasya-aov-cart__recommendation-price">${formatMoney(this.getRecommendationPrice(product, selectedVariant))}</p>
            ${optionMarkup ? `<div class="kasya-aov-cart__recommendation-options">${optionMarkup}</div>` : ''}
            <button type="button" class="kasya-aov-cart__recommendation-add" data-kasya-aov-cart-recommendation-add data-variant-id="${selectedVariant?.id || ''}" ${selectedVariant ? '' : 'disabled'}>
              ${buttonLabel}
            </button>
          </div>
        </article>
      `;
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
      if (!product || !button) return;

      const selections = this.getRecommendationSelections(card);
      const variant = this.getSelectedRecommendationVariant(product, selections);
      button.dataset.variantId = variant?.id || '';
      button.disabled = !variant;
      button.textContent = variant ? 'Add' : 'Choose options';
      if (price) price.textContent = formatMoney(this.getRecommendationPrice(product, variant));
    }

    getRecommendationOptions(product) {
      const options = product.options || [];

      return options.map((option, index) => ({
        name: option.name || option,
        position: option.position || index + 1,
        values: (option.values || []).map((value) => {
          if (typeof value === 'string') return value;
          return value.name || value.value || String(value);
        })
      })).filter((option) => {
        const name = String(option.name || '').toLowerCase();
        return option.values.length > 1 && name !== 'title';
      });
    }

    getRecommendationSelections(card) {
      return Array.from(card.querySelectorAll('[data-kasya-aov-cart-recommendation-option]')).reduce((selections, select) => {
        selections[select.dataset.optionPosition] = select.value;
        return selections;
      }, {});
    }

    getSelectedRecommendationVariant(product, selections) {
      const variants = product.variants || [];

      return variants.find((variant) => {
        if (!variant.available || Number(variant.price) <= 0) return false;

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

    async debugRecommendations() {
      const cart = this.cart || { items: [], item_count: 0 };
      const debug = await getRecommendationDebug(cart, this.recommendationData);
      console.table(debug.finalProducts.similar);
      console.table(debug.finalProducts.complete);
      console.table(debug.finalProducts.merged);
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
        this.renderTimerText(reservation.endedText);
        return;
      }

      this.renderTimerText(`Your products are reserved for ${formatTimer(remainingSeconds)} minutes!`);
    }

    renderTimerText(text) {
      const timerText = this.querySelector(selectors.timerText);

      if (timerText) {
        timerText.textContent = text;
      }
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
        await addKasyaAovCartItem(variantId);
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
})();
