(function () {
  var script = document.currentScript || document.querySelector('[data-live-seller-tracking]');
  var paramName = 'seller';
  var storageKey = 'kasya_live_seller_tracking';
  var cookieName = 'kasya_live_seller_code';
  var attrCode = '__live_seller_code';
  var attrSource = '__live_seller_source';
  var attrCommissionRate = '__live_seller_commission_rate';
  var source = script?.dataset.source || 'facebook_live';
  var commissionRate = script?.dataset.commissionRate || '10';
  var cartUpdateUrl = script?.dataset.cartUpdateUrl || window.routes?.cart_update_url || '/cart/update.js';
  var expirationDays = parseInt(script?.dataset.expirationDays || '14', 10);

  function getExpiresAt() {
    return Date.now() + expirationDays * 24 * 60 * 60 * 1000;
  }

  function sanitizeSellerCode(value) {
    return (value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : '';
  }

  function setSellerCookie(code) {
    var maxAge = expirationDays * 24 * 60 * 60;
    document.cookie = cookieName + '=' + encodeURIComponent(code) + '; path=/; max-age=' + maxAge + '; SameSite=Lax';
  }

  function clearSellerCookie() {
    document.cookie = cookieName + '=; path=/; max-age=0; SameSite=Lax';
  }

  function getStoredTracking() {
    try {
      var raw = window.localStorage.getItem(storageKey);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && saved.code && saved.expiresAt > Date.now()) return saved;
        window.localStorage.removeItem(storageKey);
        clearSellerCookie();
      }
    } catch (error) {
      /* localStorage can be unavailable in restricted browsing modes. */
    }

    var cookieCode = sanitizeSellerCode(getCookie(cookieName));
    if (!cookieCode) return null;

    return {
      code: cookieCode,
      source: source,
      commissionRate: commissionRate,
      expiresAt: getExpiresAt()
    };
  }

  function saveTracking(code) {
    var tracking = {
      code: code,
      source: source,
      commissionRate: commissionRate,
      expiresAt: getExpiresAt()
    };

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(tracking));
    } catch (error) {
      /* The cookie fallback still preserves attribution for this browser. */
    }

    setSellerCookie(code);
    return tracking;
  }

  function removeSellerParamFromUrl() {
    if (!window.history || !window.history.replaceState) return;

    var url = new URL(window.location.href);
    if (!url.searchParams.has(paramName)) return;

    url.searchParams.delete(paramName);
    window.history.replaceState(window.history.state, document.title, url.pathname + url.search + url.hash);
  }

  function buildCartAttributes(tracking) {
    var attributes = {};
    attributes[attrCode] = tracking.code;
    attributes[attrSource] = tracking.source || source;
    attributes[attrCommissionRate] = tracking.commissionRate || commissionRate;

    return attributes;
  }

  function syncCartAttributes(tracking) {
    if (!tracking || !tracking.code || !window.fetch) return;

    var attributes = buildCartAttributes(tracking);

    return window.fetch(cartUpdateUrl, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ attributes: attributes })
    }).catch(function () {
      /* Tracking must never interrupt normal shopping behavior. */
    });
  }

  function scheduleCartAttributeSync(delay) {
    window.setTimeout(function () {
      syncCartAttributes(getStoredTracking());
    }, delay || 0);
  }

  function bindCartEvents() {
    document.addEventListener('afterCartChanged', function () {
      scheduleCartAttributeSync(0);
      scheduleCartAttributeSync(750);
    });

    document.addEventListener('afterUpdateQuantity', function () {
      scheduleCartAttributeSync(0);
    });

    document.addEventListener('submit', function (event) {
      var form = event.target;
      if (!form || !form.action || form.action.indexOf('/cart/add') === -1) return;
      scheduleCartAttributeSync(750);
    }, true);
  }

  function init() {
    var url = new URL(window.location.href);
    var sellerCode = sanitizeSellerCode(url.searchParams.get(paramName));
    var tracking = sellerCode ? saveTracking(sellerCode) : getStoredTracking();

    if (sellerCode) removeSellerParamFromUrl();
    if (tracking) syncCartAttributes(tracking);
    bindCartEvents();
  }

  init();
})();
