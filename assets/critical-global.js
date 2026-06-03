function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      "summary, a[href], button:enabled, [tabindex]:not([tabindex^='-']), [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object, iframe"
    )
  );
}

function initEventSummary(wrapper) {
  wrapper.querySelectorAll('[id^="Details-"] summary').forEach((summary) => {
    summary.setAttribute('role', 'button');
    summary.setAttribute('aria-expanded', summary.parentNode.hasAttribute('open'));
  
    if(summary.nextElementSibling.getAttribute('id')) {
      summary.setAttribute('aria-controls', summary.nextElementSibling.id);
    }
  
    summary.addEventListener('click', (event) => {
      event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
    });
  
    if (summary.closest('header-drawer')) return;
    summary.parentElement.addEventListener('keyup', onKeyUpEscape);
  });
}

initEventSummary(document);

const trapFocusHandlers = {};

function trapFocus(container, elementToFocus = container) {
  var elements = getFocusableElements(container);
  var first = elements[0];
  var last = elements[elements.length - 1];

  removeTrapFocus();

  trapFocusHandlers.focusin = (event) => {
    if (
      event.target !== container &&
      event.target !== last &&
      event.target !== first
    )
    return;

    document.addEventListener('keydown', trapFocusHandlers.keydown);
  };

  trapFocusHandlers.focusout = function() {
    document.removeEventListener('keydown', trapFocusHandlers.keydown);
  };

  trapFocusHandlers.keydown = function(event) {
    if (event.code.toUpperCase() !== 'TAB') return; // If not TAB key
    // On the last focusable element and tab forward, focus the first element.
    if (event.target === last && !event.shiftKey) {
      event.preventDefault();
      first.focus();
    }

    //  On the first focusable element and tab backward, focus the last element.
    if (
      (event.target === container || event.target === first) &&
      event.shiftKey
    ) {
      event.preventDefault();
      last.focus();
    }
  };

  document.addEventListener('focusout', trapFocusHandlers.focusout);
  document.addEventListener('focusin', trapFocusHandlers.focusin);

  elementToFocus.focus();
}

// Here run the querySelector to figure out if the browser supports :focus-visible or not and run code based on it.
try {
  document.querySelector(":focus-visible");
} catch(e) {
  focusVisiblePolyfill();
}

function focusVisiblePolyfill() {
  const navKeys = ['ARROWUP', 'ARROWDOWN', 'ARROWLEFT', 'ARROWRIGHT', 'TAB', 'ENTER', 'SPACE', 'ESCAPE', 'HOME', 'END', 'PAGEUP', 'PAGEDOWN']
  let currentFocusedElement = null;
  let mouseClick = null;

  window.addEventListener('keydown', (event) => {
    if(navKeys.includes(event.code.toUpperCase())) {
      mouseClick = false;
    }
  });

  window.addEventListener('mousedown', (event) => {
    mouseClick = true;
  });

  window.addEventListener('focus', () => {
    if (currentFocusedElement) currentFocusedElement.classList.remove('focused');

    if (mouseClick) return;

    currentFocusedElement = document.activeElement;
    currentFocusedElement.classList.add('focused');

  }, true);
}

function pauseAllMedia(wrapper = document, includeProductModel = true, excludeIgnoreVideos = true) {
  wrapper.querySelectorAll(`.js-youtube${excludeIgnoreVideos ? ':not(.ignore-global-pause)' : ''}`).forEach((video) => {
    video.contentWindow.postMessage('{"event":"command","func":"' + 'pauseVideo' + '","args":""}', '*');
  });
  wrapper.querySelectorAll(`.js-vimeo${excludeIgnoreVideos ? ':not(.ignore-global-pause)' : ''}`).forEach((video) => {
    video.contentWindow.postMessage('{"method":"pause"}', '*');
  });
  wrapper.querySelectorAll(`video${excludeIgnoreVideos ? ':not(.video--background)' : ''}`).forEach((video) => video.pause());
  if(includeProductModel) {
    wrapper.querySelectorAll('product-model').forEach((model) => {
      if (model.modelViewerUI) model.modelViewerUI.pause();
    });
  }
}

function updateProductMediaStatus(wrapper) {
  wrapper.querySelectorAll('.product__media img').forEach(e => {
    if(e.complete) {
      addLoadedImageStatus(e);
    } else {
      e.onload = () => {
        addLoadedImageStatus(e);
      };
    }
  });
}

function addLoadedImageStatus(image) {
  const parentElement = image.parentElement;
  if(!parentElement.classList.contains('loaded')) {
    parentElement.classList.add('loaded');
    if(parentElement.nextElementSibling) {
      setTimeout(() => parentElement.nextElementSibling.remove(), 500);
    }
  }
}

function removeTrapFocus(elementToFocus = null) {
  document.removeEventListener('focusin', trapFocusHandlers.focusin);
  document.removeEventListener('focusout', trapFocusHandlers.focusout);
  document.removeEventListener('keydown', trapFocusHandlers.keydown);

  if (elementToFocus) elementToFocus.focus();
}

function onKeyUpEscape(event) {
  if (!event.code || event.code.toUpperCase() !== 'ESCAPE') return;

  const openDetailsElement = event.target.closest('details[open]');
  if (!openDetailsElement) return;

  const summaryElement = openDetailsElement.querySelector('summary');
  openDetailsElement.removeAttribute('open');
  summaryElement.setAttribute('aria-expanded', false);
  summaryElement.focus();
}

function loadColorSwatches() {
  window.loadedBackgroundColorSwatches = true;
  fetch(window.Shopify.routes.root + `?section_id=background-color-swatches`)
  .then(res => res.text())
  .then((html) => {
    document.body.appendChild(getDomHtmlFromText(html, 'style'));
  });
}

/**
 * Debounces a function so it runs only after the user stops triggering it
 * for a given `wait` period. Useful for resize or input events.
 *
 * Example:
 * const onResize = debounce(() => console.log('resized!'), 200);
 * window.addEventListener('resize', onResize);
 *
 * @param {Function} fn - Function to debounce.
 * @param {number} wait - Time in milliseconds to wait before calling `fn`.
 * @param {boolean} immediate - If true, call `fn` immediately on the first trigger.
 * @returns {Function} - Debounced version of `fn`.
 */
function debounce(fn, wait, immediate = false) {
  let timeout; // Holds pending timeout reference

  return (...args) => {
    const context = this;
    const callNow = immediate && !timeout;

    // Clear previous timeout (reset the wait period)
    clearTimeout(timeout);

    // Schedule new call
    timeout = setTimeout(() => {
      timeout = null;
      if (!immediate) fn.apply(context, args);
    }, wait);

    // If 'immediate' is true, execute at leading edge
    if (callNow) fn.apply(context, args);
  };
}

/**
 * Throttles a function so it's only called at most once every `wait` milliseconds.
 * 
 * Includes a trailing call — meaning the function will also run one last time
 * after the final event in a burst (e.g. when user stops scrolling).
 *
 * @param {Function} fn - Function to throttle.
 * @param {number} wait - Time in milliseconds between allowed calls.
 * @returns {Function} - Throttled version of `fn`.
 */
function throttle(fn, wait) {
  let timeout = null;   // Holds pending trailing timeout
  let lastArgs = null;  // Stores last arguments for trailing call
  let lastTime = 0;     // Timestamp of the last executed call

  return (...args) => {
    const now = Date.now();
    const remaining = wait - (now - lastTime);
    lastArgs = args;

    if (remaining <= 0) {
      // If enough time has passed, execute immediately
      clearTimeout(timeout);
      timeout = null;
      lastTime = now;
      fn.apply(this, args);
    } else if (!timeout) {
      // Otherwise, schedule a trailing call once remaining time elapses
      timeout = setTimeout(() => {
        lastTime = Date.now();
        timeout = null;
        fn.apply(this, lastArgs);
      }, remaining);
    }
  };
}

function fetchConfig(type = 'json', method = 'POST') {
  return {
    method: method,
    headers: { 'Content-Type': 'application/json', 'Accept': `application/${type}` }
  };
}

function parseHtml(text) {
  return new DOMParser().parseFromString(text, 'text/html');
}

function getDomHtmlFromText(text, selector) {
  return parseHtml(text)
      .querySelector(selector);
}

function getInnerHtmlFromText(text, selector) {
  return getDomHtmlFromText(text, selector).innerHTML;
}

function closeDetailsInAnimation(detailsElement) {
  let animationStart;

  const handleAnimation = (time) => {
    if (animationStart === undefined) {
      animationStart = time;
    }

    const elapsedTime = time - animationStart;

    if (elapsedTime < 400) {
      window.requestAnimationFrame(handleAnimation);
    } else {
      detailsElement.removeAttribute('open');
      if (detailsElement.closest('details[open]')) {
        trapFocus(detailsElement.closest('details[open]'), detailsElement.querySelector('summary'));
      }
    }
  }

  window.requestAnimationFrame(handleAnimation);
}

function loadPhotoswipeLib (implementationCode){
  if(window.photoswipeUrls.loaded) {
    const waitPhotoswipeLoaded = setInterval(() => {
      if(typeof PhotoSwipeLightbox == 'function') {
        clearInterval(waitPhotoswipeLoaded);
        implementationCode();
      }
    }, typeof PhotoSwipeLightbox == 'function' ? 0 : 1000);
    return;
  }
  window.photoswipeUrls.loaded = true;
  //url is URL of external file, implementationCode is the code
  //to be called from the file, body is the location to 
  //insert the <script> element

  var scriptTag = document.createElement('script');
  scriptTag.src = window.photoswipeUrls.lib;

  scriptTag.onload = implementationCode;
  scriptTag.onreadystatechange = implementationCode;

  document.body.appendChild(scriptTag);
}

/*
 * Shopify Common JS
 *
 */
if ((typeof window.Shopify) == 'undefined') {
  window.Shopify = {};
}

Shopify.bind = function(fn, scope) {
  return function() {
    return fn.apply(scope, arguments);
  }
};

Shopify.setSelectorByValue = function(selector, value) {
  for (var i = 0, count = selector.options.length; i < count; i++) {
    var option = selector.options[i];
    if (value == option.value || value == option.innerHTML) {
      selector.selectedIndex = i;
      return i;
    }
  }
};

Shopify.addListener = function(target, eventName, callback) {
  target.addEventListener ? target.addEventListener(eventName, callback, false) : target.attachEvent('on'+eventName, callback);
};

Shopify.removeEventListener = function(target, eventName, callback) {
  if (target.removeEventListener) {
    target.removeEventListener(eventName, callback, false);
  } else if (target.detachEvent) {
    target.detachEvent('on' + eventName, callback);
  }
};

Shopify.postLink = function(path, options) {
  options = options || {};
  var method = options['method'] || 'post';
  var params = options['parameters'] || {};

  var form = document.createElement("form");
  form.setAttribute("method", method);
  form.setAttribute("action", path);

  for(var key in params) {
    var hiddenField = document.createElement("input");
    hiddenField.setAttribute("type", "hidden");
    hiddenField.setAttribute("name", key);
    hiddenField.setAttribute("value", params[key]);
    form.appendChild(hiddenField);
  }
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};

Shopify.CountryProvinceSelector = function(country_domid, province_domid, options) {
  this.countryEl         = document.getElementById(country_domid);
  this.provinceEl        = document.getElementById(province_domid);
  this.provinceContainer = document.getElementById(options['hideElement'] || province_domid);
  Shopify.addListener(this.countryEl, 'change', Shopify.bind(this.countryHandler,this));

  this.initCountry();
  this.initProvince();
};

Shopify.CountryProvinceSelector.prototype = {
  initCountry: function() {
    var value = this.countryEl.getAttribute('data-default');
    Shopify.setSelectorByValue(this.countryEl, value);
    this.countryHandler();
  },

  initProvince: function() {
    var value = this.provinceEl.getAttribute('data-default');
    if (value && this.provinceEl.options.length > 0) {
      Shopify.setSelectorByValue(this.provinceEl, value);
    }
  },

  countryHandler: function(e) {
    var opt       = this.countryEl.options[this.countryEl.selectedIndex];
    var raw       = opt.getAttribute('data-provinces');
    var provinces = JSON.parse(raw);

    this.clearOptions(this.provinceEl);
    if (provinces && provinces.length == 0) {
      this.provinceContainer.style.display = 'none';
    } else {
      for (var i = 0; i < provinces.length; i++) {
        var opt = document.createElement('option');
        opt.value = provinces[i][0];
        opt.innerHTML = provinces[i][1];
        this.provinceEl.appendChild(opt);
      }

      this.provinceContainer.style.display = "";
    }
  },

  clearOptions: function(selector) {
    while (selector.firstChild) {
      selector.removeChild(selector.firstChild);
    }
  },

  setOptions: function(selector, values) {
    for (var i = 0, count = values.length; i < values.length; i++) {
      var opt = document.createElement('option');
      opt.value = values[i];
      opt.innerHTML = values[i];
      selector.appendChild(opt);
    }
  }
};

Shopify.formatMoney = function(t, e) {
  function n(t, e) {
    return void 0 === t ? e : t
  }

  function o(t, e, o, i) {
    if (e = n(e, 2), o = n(o, ","), i = n(i, "."), isNaN(t) || null == t) return 0;
    var r = (t = (t / 100).toFixed(e)).split(".");
    return r[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1" + o) + (r[1] ? i + r[1] : "")
  }
  "string" == typeof t && (t = t.replace(".", ""));
  var i = "",
      r = /\{\{\s*(\w+)\s*\}\}/,
      a = e || moneyFormat;
  switch (a.match(r)[1]) {
    case "amount":
        i = o(t, 2);
        break;
    case "amount_no_decimals":
        i = o(t, 0);
        break;
    case "amount_with_comma_separator":
        i = o(t, 2, ".", ",");
        break;
    case "amount_with_space_separator":
        i = o(t, 2, " ", ",");
        break;
    case "amount_with_period_and_space_separator":
        i = o(t, 2, " ", ".");
        break;
    case "amount_no_decimals_with_comma_separator":
        i = o(t, 0, ".", ",");
        break;
    case "amount_no_decimals_with_space_separator":
        i = o(t, 0, " ");
        break;
    case "amount_with_apostrophe_separator":
        i = o(t, 2, "'", ".")
  }
  return a.replace(r, i)
}

Shopify.showPrice = function(price, noConvert = false) {
  return (!noConvert) ? Shopify.formatMoney(price * Shopify.currency.rate) : Shopify.formatMoney(price);
}

class HTMLUpdateUtility {
  /**
   * Used to swap an HTML node with a new node.
   * The new node is inserted as a previous sibling to the old node, the old node is hidden, and then the old node is removed.
   *
   * The function currently uses a double buffer approach, but this should be replaced by a view transition once it is more widely supported https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
   */
  static viewTransition(oldNode, newContent, preProcessCallbacks = [], postProcessCallbacks = [], scrollY = null) {
    preProcessCallbacks?.forEach((callback) => callback(newContent));

    const newNodeWrapper = document.createElement('div');
    HTMLUpdateUtility.setInnerHTML(newNodeWrapper, newContent.outerHTML);
    const newNode = newNodeWrapper.firstChild;

    // dedupe IDs
    const uniqueKey = Date.now();
    oldNode.querySelectorAll('[id], [form]').forEach((element) => {
      element.id && (element.id = `${element.id}-${uniqueKey}`);
      element.form && element.setAttribute('form', `${element.form.getAttribute('id')}-${uniqueKey}`);
    });

    oldNode.parentNode.insertBefore(newNode, oldNode);
    oldNode.style.display = 'none';

    postProcessCallbacks?.forEach((callback) => callback(newNode));

    if(scrollY) {
      // Restore the scroll position
      window.scrollTo(0, scrollY);
    }

    setTimeout(() => oldNode.remove(), 500);
  }

  // Sets inner HTML and reinjects the script tags to allow execution. By default, scripts are disabled when using element.innerHTML.
  static setInnerHTML(element, html) {
    element.innerHTML = html;
    HTMLUpdateUtility.reinjectsScripts(element);
  }

  static reinjectsScripts(element) {
    element.querySelectorAll('script').forEach(oldScriptTag => {
      const newScriptTag = document.createElement('script');
      Array.from(oldScriptTag.attributes).forEach(attribute => {
        newScriptTag.setAttribute(attribute.name, attribute.value)
      });
      newScriptTag.appendChild(document.createTextNode(oldScriptTag.innerHTML));
      oldScriptTag.parentNode.replaceChild(newScriptTag, oldScriptTag);
    });
  }
}

class DrawerFixed extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close(evt));
    this.stickyHeader = document.querySelector('sticky-header');
  }

  open(triggeredBy) {
    if (triggeredBy) this.setActiveElement(triggeredBy);
    // here the animation doesn't seem to always get triggered. A timeout seem to help
    setTimeout(() => {this.classList.add('animate', 'active')});

    this.addEventListener('transitionend', () => {
      const containerToTrapFocusOn = this.classList.contains('is-empty') ? this.querySelector('.drawer__inner-empty') : (this.classList.contains('drawer--cart') ? document.getElementById('CartDrawer') : document.getElementById('QuickAddDrawer'));
      const focusElement = this.querySelector('.drawer__inner') || this.querySelector('.drawer__close');
      trapFocus(containerToTrapFocusOn, focusElement);
    }, { once: true });

    document.body.classList.add('open-drawer-fixed');
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    return getInnerHtmlFromText(html, selector);
  }

  getSectionDOM(html, selector = '.shopify-section') {
    return getDomHtmlFromText(html, selector);
  }

  setActiveElement(element) {
    this.activeElement = element;
  }

  close(evt) {
    this.querySelector('.drawer__inner').addEventListener('transitionend', () => {
      removeTrapFocus(this.activeElement);
      document.body.classList.remove('open-drawer-fixed');
      this.classList.remove('start-closing', 'closing');
      document.body.dispatchEvent(new CustomEvent('drawerClosed'));
    }, { once: true });
    this.classList.add('closing', 'start-closing');
    this.classList.remove('active');
  }
}

class ModalDialog extends HTMLElement {
  constructor() {
    super();
    this.querySelector('[id^="ModalClose-"]').addEventListener(
      'click',
      this.hide.bind(this, false)
    );
    this.addEventListener('keyup', (event) => {
      if (event.code.toUpperCase() === 'ESCAPE') this.hide();
    });
    if (this.classList.contains('media-modal')) {
      this.addEventListener('pointerup', (event) => {
        if (event.pointerType === 'mouse' && !event.target.closest('deferred-media, product-model')) this.hide();
      });
    } else {
      this.addEventListener('click', (event) => {
        if (event.target === this) this.hide();
      });
    }
  }

  connectedCallback() {
    if (this.moved) return;
    this.moved = true;
    document.body.appendChild(this);
  }

  show(opener) {
    this.removeAttribute('hidden');
    this.openedBy = opener;
    const popup = this.querySelector('.template-popup');
    document.body.classList.add('overflow-hidden');
    this.setAttribute('open', '');
    if (popup) popup.loadContent();
    trapFocus(this, this.querySelector('[role="dialog"]'));
    window.pauseAllMedia();
  }

  hide() {
    this.classList.add('closing');
    setTimeout(() => {
      document.body.classList.remove('overflow-hidden');
      document.body.dispatchEvent(new CustomEvent('modalClosed'));
      this.removeAttribute('open');
      removeTrapFocus(this.openedBy);
      window.pauseAllMedia();
      this.classList.remove('closing');
    }, 600);
  }
}
customElements.define('modal-dialog', ModalDialog);

class ModalOpener extends HTMLElement {
  constructor() {
    super();

    const button = this.querySelector('button');

    if (!button) return;
    button.addEventListener('click', () => {
      const modal = document.querySelector(this.dataset.modal);
      if (modal) modal.show(button);
    });
  }
}
customElements.define('modal-opener', ModalOpener);

class SliderComponent extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.init();
  }

  init() {
    this.slider = this.querySelector('[id^="Slider-"]');
    this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
    this.enableSliderLooping = this.dataset.loop;
    this.currentPageElement = this.querySelector('.slider-counter--current');
    this.pageTotalElement = this.querySelector('.slider-counter--total');
    this.prevButton = (this.dataset.outsidePrevButtonId != undefined ? this.closest('[id^="shopify-section"]').querySelector('#' + CSS.escape(`${this.dataset.outsidePrevButtonId}`)) : this.querySelector('button[name="previous"]'));
    this.nextButton = (this.dataset.outsideNextButtonId != undefined ? this.closest('[id^="shopify-section"]').querySelector('#' + CSS.escape(`${this.dataset.outsideNextButtonId}`)) : this.querySelector('button[name="next"]'));
    this.isAutoplay = this.slider.dataset.autoplay === 'true';
    this.autoplayButtonQuerySelector = '.slider__autoplay';
    this.autoPlayPausedClass = 'slider__autoplay--paused';
    this.sliderControlButtons = this.querySelectorAll('.slider-counter__link');
    this.currentPage = 1;
    
    if (!this.slider) return;
    this.sliderFirstItemNode = this.slider.querySelector('.slider__slide');

    // Enable mouse drag only on non-touch devices
    if (!('ontouchstart' in window) && window.matchMedia('(pointer: fine)').matches) {
      this.enableMouseDrag();
    }

    this.initPages();
    
    if(this.nextButton) {
      this.onButtonClickHandler = this.onButtonClick.bind(this);
      this.prevButton.addEventListener('click', this.onButtonClickHandler);
      this.nextButton.addEventListener('click', this.onButtonClickHandler);
    }

    if (this.isAutoplay) this.setAutoPlay();

    if (this.sliderControlButtons) {
      this.sliderControlLinksArray = Array.from(this.sliderControlButtons);
      this.linkToSlideHandlers = [];
      this.sliderControlLinksArray.forEach((link, i) => {
        const handler = this.linkToSlide.bind(this);
        this.linkToSlideHandlers[i] = handler;
        link.addEventListener('click', handler);
      });
    }

    this.onScrollHandler = this.handleScroll.bind(this);
    this.slider.addEventListener('scroll', this.onScrollHandler, { passive: true });

    if(!this.ignoreResizeEvent) {
      setTimeout(() => {
        this.onResizeHandler = debounce(() => this.handleResize(), 500);
        window.addEventListener('resize', this.onResizeHandler, true);
      }, 500);
    }
  }

  disconnectedCallback() {
    if (this.prevButton && this.onButtonClickHandler)
      this.prevButton.removeEventListener('click', this.onButtonClickHandler);
    if (this.nextButton && this.onButtonClickHandler)
      this.nextButton.removeEventListener('click', this.onButtonClickHandler);
  
    if (this.sliderControlLinksArray && this.linkToSlideHandlers)
      this.sliderControlLinksArray.forEach((link, i) =>
        link.removeEventListener('click', this.linkToSlideHandlers[i])
      );
  
    if (!this.ignoreResizeEvent && this.onResizeHandler)
      window.removeEventListener('resize', this.onResizeHandler, true);
  
    if (this.slider && this.onScrollHandler)
      this.slider.removeEventListener('scroll', this.onScrollHandler);

    if (this._listeners) {
      this._listeners.forEach(([el, evt, handler, opts]) => el.removeEventListener(evt, handler, opts));
      this._listeners = [];
    }
  }

  initPages() {
    // Collect all visible slider items (those with width > 0)
    this.sliderItemsToShow = Array.from(this.sliderItems).filter(el => el.clientWidth > 0);
    
    // If there are fewer than 2 visible slides, just initialize minimal pagination
    if (this.sliderItemsToShow.length < 2) {
      // Fallback to single-slide setup
      this.slidesPerPage = 1;
      this.totalPages = this.sliderItemsToShow.length || 1;
      this.currentPage = 1;
      this.update(); // Sync navigation buttons and counter
      return;
    }
    
    // Calculate distance between the first two visible slides
    const dx = this.sliderItemsToShow[1].offsetLeft - this.sliderItemsToShow[0].offsetLeft;

    // Guard against invalid or zero offset (can happen with transitions or hidden elements)
    this.sliderItemOffset = Math.abs(dx) > 0.5 ? dx : this.slider.clientWidth;

    this.maxScrollLeft = Math.max(0, this.slider.scrollWidth - this.slider.clientWidth);
    this.scrollMarginLeft = this.sliderFirstItemNode ? parseFloat(getComputedStyle(this.sliderFirstItemNode).scrollMarginInlineStart) * (document.dir == 'rtl' ? -1 : 1) : 0;
    // Calculate how many slides fit per page (as a float, then round up)
    const perPageF = (this.slider.clientWidth - Math.abs(this.scrollMarginLeft)) / Math.abs(this.sliderItemOffset);
    this.slidesPerPage = Math.max(1, Math.round(perPageF));

    // Determine total number of scrollable pages
    const approxPages = Math.round((this.maxScrollLeft - this.scrollMarginLeft) / Math.abs(this.sliderItemOffset)) + 1;
    this.totalPages = Math.max(1, approxPages);

    // Hide any extra control dots beyond the last valid page
    if (this.sliderControlButtons.length) {
      const limit = this.sliderItemsToShow.length - this.slidesPerPage;
      this.sliderControlButtons.forEach((link, i) => link.classList.toggle('hidden', i > limit));
    }
    
    // Update pagination UI (buttons, dots, counters)
    this.update();
  }

  resetPages() {
    this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
    this.initPages();
  }

  handleResize(event) {
    if ((event && event.target !== window)) return;
    this.initPages();
  }

  handleScroll() {
    if (this._scrollingRaf) cancelAnimationFrame(this._scrollingRaf);
  
    this._scrollingRaf = requestAnimationFrame(() => {
      if (this._scrollEndTimeout) clearTimeout(this._scrollEndTimeout);

      // Debounce 80ms to wait for the browser’s scroll correction
      this._scrollEndTimeout = setTimeout(() => {
        this.updateFromScroll(true);  // 👈 add the scrollEnded flag
      }, 80);
    });
  }

  
  /**
   * Compute current page from scroll position.
   * A "page" is the index of the first visible slide in the viewport.
   * Works for normal, peek, and half-bleed layouts.
   */
  _getPageFromScroll() {
    if (!this.slider || !this.sliderItemOffset) {
      return this.currentPage || 1;
    }

    const margin = this.scrollMarginLeft || 0;

    // Logical scroll position starting from the logical first slide
    const logicalScroll = this.slider.scrollLeft - margin;

    // Convert scroll distance to slide index (0-based)
    // Use floor so we change page only after crossing a slide boundary.
    const rawIndex = logicalScroll / this.sliderItemOffset;
    let page = Math.round(rawIndex) + 1; // tiny epsilon to avoid float issues

    const maxPages = this.totalPages || (this.sliderItemsToShow?.length || 1);

    if (page < 1) page = 1;
    if (page > maxPages) page = maxPages;

    return page;
  }

  updateFromScroll(scrollEnded) {
    if (!this.sliderItemOffset || !this.totalPages || !scrollEnded) return;
    this.update();
  }

  update() {
    // ✅ prevent update while suspended (e.g. prepend slide)
    if (this.isUpdating) return;
    const previousPage = this.currentPage;
    this.currentPage = this._getPageFromScroll();

    if (this.currentPageElement && this.pageTotalElement) {
      this.currentPageElement.textContent = this.currentPage;
      this.pageTotalElement.textContent = this.totalPages;
    }

    if (this.currentPage && this.currentPage != previousPage) {
      this.dispatchEvent(new CustomEvent('slideChanged', { detail: {
        currentPage: this.currentPage,
        currentElement: this.sliderItemsToShow[this.currentPage - 1]
      }}));
    }

    if (this.sliderControlButtons.length) {
      this.sliderControlButtons.forEach(link => {
        link.classList.remove('slider-counter__link--active');
        link.removeAttribute('aria-current');
      });
  
      this.sliderControlButtons[this.currentPage - 1].classList.add('slider-counter__link--active');
      this.sliderControlButtons[this.currentPage - 1].setAttribute('aria-current', true);
    }

    if (this.isAutoplay && this.autoplayButtonIsSetToPlay) this.play();

    this.updateNavButtons();
  }

  updateNavButtons() {
    if(this.enableSliderLooping) return;
   // ---- Button enable/disable logic ----
    // Use a small epsilon to tolerate tiny scroll rounding errors.
    const EPSILON = 2;

    if (this.prevButton && this.sliderItemsToShow.length) {
      const firstSlide = this.sliderItemsToShow[0];

      // At the very start if:
      // - first slide is fully visible, OR
      // - scrollLeft is effectively at the left-most position (within EPSILON)
      const atStart =
        this.isSlideVisible(firstSlide) ||
        Math.abs(this.slider.scrollLeft - (this.scrollMarginLeft || 0)) <= EPSILON;

      if (atStart) {
        this.prevButton.setAttribute('disabled', 'disabled');
      } else {
        this.prevButton.removeAttribute('disabled');
      }
    }

    if (this.nextButton && this.sliderItemsToShow.length) {
      const lastSlide = this.sliderItemsToShow[this.sliderItemsToShow.length - 1];

      // At the very end if:
      // - last slide is fully visible, OR
      // - scrollLeft has reached (or almost reached) maxScrollLeft
      const atEnd =
        this.isSlideVisible(lastSlide) ||
        this.slider.scrollLeft >= (this.maxScrollLeft - EPSILON);

      if (atEnd) {
        this.nextButton.setAttribute('disabled', 'disabled');
      } else {
        this.nextButton.removeAttribute('disabled');
      }
    } 
  }

  isSlideVisible(element, offset = 0) {
    if(!element) return false;
    const sliderRect = this.slider.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const visibleArea = sliderRect.width - offset;
    
    const fullyVisible =
      elementRect.left >= sliderRect.left - 1 &&
      elementRect.right <= sliderRect.left + visibleArea + 1;
    return fullyVisible;
  }

  setAutoPlay() {
    this.sliderAutoplayButton = this.querySelector(this.autoplayButtonQuerySelector);
    this.autoplaySpeed = this.slider.dataset.speed * 1000;
    if(this.sliderAutoplayButton) {
      this.sliderAutoplayButton.addEventListener('click', this.autoPlayToggle.bind(this));
    }

    this.play();
    this.autoplayButtonIsSetToPlay = true;
  }

  linkToSlide(event) {
    event.preventDefault();
    this.goToSlideByTarget(event.currentTarget);
  }

  goToSlideByTarget(target) {
    this.goToSlideByIndex(this.sliderControlLinksArray.indexOf(target));
  }

  /**
   * @param {integer} index | start by 0 
   */
  goToSlideByIndex(index) {
    const slideScrollPosition = this.slider.scrollLeft + this.sliderItemOffset * (index + 1 - this.currentPage) + this.scrollMarginLeft;
    this.slider.scrollTo({
      left: slideScrollPosition
    });
  }

  autoPlayToggle() {
    this.togglePlayButtonState();
    this.autoplayButtonIsSetToPlay ? this.pause() : this.play();
    this.autoplayButtonIsSetToPlay = !this.autoplayButtonIsSetToPlay;
  }

  play() {
    this.slider.setAttribute('aria-live', 'off');
    clearTimeout(this.autoplay);
    this.autoplay = setTimeout(this.autoRotateSlides.bind(this), this.autoplaySpeed);
  }

  pause() {
    this.slider.setAttribute('aria-live', 'polite');
    clearTimeout(this.autoplay);
  }

  togglePlayButtonState() {
    if(!this.sliderAutoplayButton) return;
    if (!this.autoplayButtonIsSetToPlay) {
      this.sliderAutoplayButton.classList.add(this.autoPlayPausedClass);
      this.sliderAutoplayButton.setAttribute('aria-label', window.accessibilityStrings.playSlideshow);
    } else {
      this.sliderAutoplayButton.classList.remove(this.autoPlayPausedClass);
      this.sliderAutoplayButton.setAttribute('aria-label', window.accessibilityStrings.pauseSlideshow);
    }
  }

  beforeUpdateAutoplay() { 
  }

  autoRotateSlides() {
    this.beforeUpdateAutoplay();
    const slideScrollPosition = this.currentPage === this.totalPages ? 0 : this.slider.scrollLeft + this.sliderItemOffset + this.scrollMarginLeft;
    this.slider.scrollTo({
      left: slideScrollPosition
    });
  }

  onButtonClick(event) {
    event.preventDefault();
    const step = event.currentTarget.dataset.step || 1;
    this.slideScrollPosition = event.currentTarget.name === 'next' ? this.slider.scrollLeft + (step * this.sliderItemOffset) + this.scrollMarginLeft : this.slider.scrollLeft - (step * this.sliderItemOffset) - (this.currentPage > 2 ? this.scrollMarginLeft : 0);
    this.slider.scrollTo({
      left: this.slideScrollPosition
    });
    if(this.enableSliderLooping) {
      const isFirstSlide = this.currentPage === 1;
      const isLastSlide = this.currentPage === this.sliderItemsToShow.length;
  
      if (!isFirstSlide && !isLastSlide) return;
  
      if (isFirstSlide && event.currentTarget.name === 'previous') {
        this.slideScrollPosition = this.slider.scrollLeft + this.sliderFirstItemNode.clientWidth * this.sliderItemsToShow.length + this.scrollMarginLeft;
      } else if (isLastSlide && event.currentTarget.name === 'next') {
        this.slideScrollPosition = 0;
      }
      this.slider.scrollTo({
        left: this.slideScrollPosition
      });
    }
  }

  enableMouseDrag() {
    // Prevent default drag behavior on links and images inside the slider
    this.slider.querySelectorAll('a, img').forEach(el => {
      el.setAttribute('draggable', 'false');
    });
    this.isDragging = false;
    this.dragMoved = false;
    this.startX = 0;
    this.scrollStart = 0;
  
    this._onDragStart = this.onDragStart.bind(this);
    this._onDragMove = this.onDragMove.bind(this);
    this._onDragEnd = this.onDragEnd.bind(this);
    this._onClickCapture = this.onClickCapture.bind(this);
  
    this._listeners = [
      [this.slider, 'mousedown', this._onDragStart],
      [document, 'mousemove', this._onDragMove],
      [document, 'mouseup', this._onDragEnd],
      [this.slider, 'click', this._onClickCapture, true],
    ];
    
    this._listeners.forEach(([el, evt, handler, opts]) => el.addEventListener(evt, handler, opts));
  
    // Disable native drag ghost image
    this.slider.querySelectorAll('a, img').forEach(el => {
      el.setAttribute('draggable', 'false');
    });
  }
  
  onDragStart(e) {
    if (e.button !== 0) return;

    // 🔒 Do not start slider drag when the user interacts with 3D model
    // This lets model-viewer capture drag to rotate the 3D object.
    const inProductModel =
      e.target.closest('product-model') ||
      e.target.closest('model-viewer');

    if (inProductModel) {
      return; // Let the 3D viewer handle this drag normally
    }
  
    this.isDragging = true;
    this.dragMoved = false;
    this.dragStartX = e.pageX;
    this.dragStartY = e.pageY;
    this.startX = e.pageX;
    this.scrollStart = this.slider.scrollLeft;
  
    // Temporarily disable smooth scroll while dragging
    this.slider.classList.add('is-dragging');
  }
  
  onDragMove(e) {
    if (!this.isDragging) return;
  
    const deltaX = e.pageX - this.startX;
    const deltaY = e.pageY - this.dragStartY;
  
    // Only count as drag if moved more than 5px
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      if (!this.dragMoved) {
        this.dragMoved = true;
        // Disable pointer events on links while dragging
        this.slider.querySelectorAll('a').forEach(a => a.style.pointerEvents = 'none');
      }
  
      e.preventDefault();
      this.slider.scrollLeft = this.scrollStart - deltaX;
    }
  }
  
  onDragEnd(e) {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.slider.classList.remove('is-dragging');
    this.slider.querySelectorAll('a').forEach(a => (a.style.pointerEvents = ''));

    // If the user actually dragged, block the “ghost” click
    if (this.dragMoved) {
      const activeElement = e.target;
      if (activeElement && activeElement.tagName !== 'A') {
        this.dragPreventClick = true;

        const preventOnce = (ev) => {
          if (this.dragPreventClick) {
            ev.stopImmediatePropagation();
            ev.preventDefault();
            this.dragPreventClick = false;
            this.slider.removeEventListener('click', preventOnce, true);
          }
        };

        this.slider.addEventListener('click', preventOnce, true);
      }
    }

    if (!this.dragMoved) return;
    this.dragMoved = false;

    // Disable the snap class while we perform our own animation
    this.slider.classList.add('slider--no-snap');

    const firstSlide = this.sliderItemsToShow[0] || this.slider.firstElementChild;
    const slideWidth = this.sliderItemOffset || firstSlide?.clientWidth || 0;

    if (!firstSlide || !slideWidth) {
      this.slider.classList.remove('slider--no-snap');
      return;
    }

    // 1) Find the slide that is most visible in the viewport => currentIndex
    const sliderRect = this.slider.getBoundingClientRect();
    let currentIndex = 0;
    let maxVisible = -1;

    this.sliderItemsToShow.forEach((slide, idx) => {
      const rect = slide.getBoundingClientRect();
      const visibleWidth = Math.min(rect.right, sliderRect.right) - Math.max(rect.left, sliderRect.left);
      if (visibleWidth > maxVisible) {
        maxVisible = visibleWidth;
        currentIndex = idx;
      }
    });

    // 2) Use the pointer delta to decide whether to move to the next/previous slide or snap back to the current one
    const pointerDelta = e.pageX - this.dragStartX;
    const threshold = slideWidth * 0.2; // need to drag at least 20% of the slide width to switch slides
    const isRtl = document.dir === 'rtl';

    let targetIndex = currentIndex;

    if (Math.abs(pointerDelta) > threshold) {
      const dragToLeft = pointerDelta < 0;
      // LTR: dragging left => next (+1), dragging right => previous (-1)
      // RTL: directions are reversed
      const step = !isRtl
        ? (dragToLeft ? 1 : -1)
        : (dragToLeft ? -1 : 1);

      targetIndex = currentIndex + step;
    }

    // Clamp index
    const maxIndex = this.sliderItemsToShow.length - 1;
    if (targetIndex < 0) targetIndex = 0;
    if (targetIndex > maxIndex) targetIndex = maxIndex;

    // 3) Calculate targetScrollLeft from offsetLeft — works for both LTR and RTL
    const baseOffset = firstSlide.offsetLeft;
    let targetScrollLeft = this.sliderItemsToShow[targetIndex].offsetLeft - baseOffset;
  
    // Clamp the final scroll value within [0, maxScrollLeft]
    if(document.dir != 'rtl') {
      if (targetScrollLeft < 0) targetScrollLeft = 0;
      if (targetScrollLeft > this.maxScrollLeft) targetScrollLeft = this.maxScrollLeft;
    } else {
      if (targetScrollLeft > 0) targetScrollLeft = 0;
      if (targetScrollLeft < this.maxScrollLeft * (-1)) targetScrollLeft = this.maxScrollLeft * (-1);
    }
    
    // 4) Animate to the target snap position
    this.animateScrollTo(targetScrollLeft, 400, 'easeOutCubic', () => {
      requestAnimationFrame(() => {
        this.slider.classList.remove('slider--no-snap');
      });
    });
  }
  
  animateScrollTo(target, duration = 400, easing = 'easeOutCubic', onComplete) {
    const start = this.slider.scrollLeft;
    const distance = target - start;
    const startTime = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
  
    // Temporarily disable scroll snapping during animation
    const prevSnap = this.slider.style.scrollSnapType;
    this.slider.style.scrollSnapType = 'none';
  
    const step = now => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = ease(progress);
      this.slider.scrollLeft = start + distance * eased;
  
      if (elapsed < duration) {
        requestAnimationFrame(step);
      } else {
        // 👇 Force browser to commit final scroll position
        this.slider.scrollLeft = target;
  
        // 👇 Delay restoring snap one animation frame later
        requestAnimationFrame(() => {
          this.slider.style.scrollSnapType = prevSnap || '';
          if (onComplete) onComplete();
        });
      }
    };
  
    requestAnimationFrame(step);
  }
  
  onClickCapture(e) {
    // Prevent click if the user was dragging
    if (this.dragMoved) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }

  /** 🧩 Helper: suspend update events temporarily */
  _suspendUpdates(callback) {
    this.isUpdating = true;
    try {
      callback?.();
    } finally {
      requestAnimationFrame(() => {
        delete this.isUpdating;
      });
    }
  }
}

customElements.define('slider-component', SliderComponent);

class VariantSelects extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('change', this.onVariantChange);
    this.sectionId = this.dataset.originalSection || this.dataset.section;
  }

  onVariantChange(event) {
    const target = this.getInputForEventTarget(event.target);
    this.publishChangeEvent(target);
  }

  getInputForEventTarget(target) {
    return target.tagName === 'SELECT' ? target.selectedOptions[0] : target;
  }

  get selectedOptionValues() {
    const valueIds = [];
    this.querySelectorAll('select').forEach((select) => {
      valueIds.push(select.options[select.selectedIndex].dataset.optionValueId);
    });
    return valueIds;
  }

  publishChangeEvent(target, recall = false, customSelectedOptionValues = null) {
    const params = {
      sectionId: this.dataset.section,
      target: target,
      selectedOptionValues: (customSelectedOptionValues) ? customSelectedOptionValues : this.selectedOptionValues,
    };
    if(recall) {
      params.recallId = this.dataset.section;
    }
    document.dispatchEvent(new CustomEvent('optionValueSelectionChange', {detail: params}));
  }

  autoCorrectAvailableVariant(newProductInfoNode) {
    const newSelectedOptionValues = [];
    var findSelectedOptionValue;
    var stopFinding = false;
    newProductInfoNode.querySelectorAll('.product-form__input--variant-picker').forEach(fieldset => {
      if(stopFinding == false) {
        if(!fieldset.classList.contains('last')) {
          const currentSelectedOptionValue = fieldset.querySelector('li:not(.hidden) input[type="radio"]:checked, option:not(.hidden)[selected]');
          if(currentSelectedOptionValue) {
             newSelectedOptionValues.push(currentSelectedOptionValue.dataset.optionValueId); 
          } else {
            const altCurrentSelectedOptionValue = fieldset.querySelector('li:not(.hidden) input[type="radio"], option:not(.hidden)');
            newSelectedOptionValues.push(altCurrentSelectedOptionValue.dataset.optionValueId);
            stopFinding = true;
          }
        } else {
          findSelectedOptionValue = fieldset.querySelector('li:not(.hidden) input[type="radio"]:not(:checked), option:not(.hidden):not([selected])');
          if(!findSelectedOptionValue) {
            findSelectedOptionValue = fieldset.querySelector('li:not(.hidden) input[type="radio"]:checked, option:not(.hidden)[selected]');
          }
          newSelectedOptionValues.push(findSelectedOptionValue.dataset.optionValueId); 
        }
      } else {
        const currentSelectedOptionValue = fieldset.querySelector('li input[type="radio"]:checked, option[selected]');
        newSelectedOptionValues.push(currentSelectedOptionValue.dataset.optionValueId); 
        if(fieldset.classList.contains('last')) {
          findSelectedOptionValue = currentSelectedOptionValue;
        }
      }
    });
    this.publishChangeEvent(document.getElementById(findSelectedOptionValue.id), true, newSelectedOptionValues);
  }
}

customElements.define('variant-selects', VariantSelects);

class VariantRadios extends VariantSelects {
  constructor() {
    super();
  }

  connectedCallback() {
    this.loadBackgroundColorSwatches();
  }

  get selectedOptionValues() {
    return Array.from(this.querySelectorAll('input[type="radio"]:checked')).map(
      ({ dataset }) => dataset.optionValueId
    );
  }

  loadBackgroundColorSwatches() {
    if(!window.loadedBackgroundColorSwatches && this.querySelectorAll('.product-form__input__radio-label--color').length > 0) {
      loadColorSwatches();
    }
  }
}

customElements.define('variant-radios', VariantRadios);

const deferredMediaObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if(entry.isIntersecting) {
      entry.target.loadContent(false);
    } else {
      entry.target.pause();
    }
  });
});

class DeferredMedia extends HTMLElement {
  constructor() {
    super();
    if(this.dataset.ignore) {
      return;
    }
    this.isPlaying = false;
    this.poster = this.querySelector('[id^="Deferred-Poster-"]');
    if (this.poster) {
      this.posterClickHandler = this.onPosterClick.bind(this);
      this.poster.addEventListener('click', this.posterClickHandler);
    }

    if(this.dataset.autoplay) {
      deferredMediaObserver.observe(this);
    }
  }

  disconnectedCallback() {
    if(this.poster) {
      this.poster.removeEventListener('click', this.posterClickHandler);
    }
  }

  onPosterClick() {
    return this.loadContent(true, true);
  }

  loadContent(focus = true, play = false) {
    if (!this.deferredElement) {
      if(!this.hasAttribute('loaded')) {
        this.setAttribute('loaded', true);
        if(!this.dataset.loaded) {
          const content = document.createElement('div');
          content.appendChild(this.querySelector('template').content.firstElementChild.cloneNode(true));
          const el = content.querySelector('video, model-viewer, iframe');
          this.querySelector('template').remove();
          this.deferredElement = this.appendChild(el);
        } else {
          this.deferredElement = this.querySelector('video, model-viewer, iframe');  
        }
      } else {
        this.deferredElement = this.querySelector('video, model-viewer, iframe');
      }
    }
    if(this.deferredElement) {
      if(!this.isPlaying) {
        if (focus) this.deferredElement.focus();
        if (this.deferredElement.getAttribute('autoplay') || this.dataset.autoplay || play) {
          // force autoplay for safari
          return this.playVideoTag();
        }
      } else {
        this.pause();
      }
    }
    return Promise.resolve();
  }

  play() {
    if (this.isPlaying) {
      return this.playPromise ? this.playPromise : Promise.resolve(); // already playing
    }

    if (!this.deferredElement) {
      return this.loadContent(false, true);
    } else {
      return this.playVideoTag();
    }
  }

  playVideoTag() {
    if (!this.deferredElement) {
      return Promise.reject(new Error("No media element found"));
    }

    if (this.deferredElement.nodeName === 'VIDEO') {
      // HTML5 video returns a real Promise
      this.isPlaying = true;
      this.playPromise = this.deferredElement.play()
        .then(() => {
          this.classList.add('playing');
        })
        .catch(err => {
          this.isPlaying = false;
          this.classList.remove('playing');
      });
    } else if (this.deferredElement.classList.contains('js-youtube')) {
      this.deferredElement.contentWindow.postMessage(
        '{"event":"command","func":"playVideo","args":""}', '*'
      );
      this.isPlaying = true;
      this.classList.add('playing');
      this.playPromise = Promise.resolve();
    } else if (this.deferredElement.classList.contains('js-vimeo')) {
      this.deferredElement.contentWindow.postMessage(
        '{"method":"play"}', '*'
      );
      this.isPlaying = true;
      this.classList.add('playing');
      this.playPromise = Promise.resolve();
    }

    return this.playPromise;
  }

  pause() {
    if(!this.hasAttribute('loaded') || !this.isPlaying) {
      return;
    }
    if (this.playPromise !== undefined) {
      this.playPromise.then(_ => {
        // Automatic playback started!
        // Show playing UI.
        // We can now safely pause video...
        this.pauseAllMedia();
      })
      .catch(error => {
        // Auto-play was prevented
        // Show paused UI.
        console.log(error);
      });
    } else {
      this.pauseAllMedia();
    }
  }

  pauseAllMedia() {
    if(this.deferredElement && this.isPlaying) {
      window.pauseAllMedia(this, true, false);
      this.isPlaying = false;
      this.classList.remove('playing');
    }
  }
}

customElements.define('deferred-media', DeferredMedia);

class BtStorageUtil {
  static set(key, value, isSession = false) {
    if (isSession) {
      sessionStorage.setItem(
        `bt-${key}`,
        typeof value === 'object' ? JSON.stringify(value) : value
      );
    } else {
      localStorage.setItem(`bt-${key}`, typeof value === 'object' ? JSON.stringify(value) : value);
    }
  }

  static get(key, isJson, isSession = false) {
    const value = isSession ? sessionStorage.getItem(`bt-${key}`) : localStorage.getItem(`bt-${key}`);
    if (isJson) {
      return JSON.parse(value);
    }
    return value;
  }

  static remove(key, isSession = false) {
    if (isSession) {
      sessionStorage.removeItem(`bt-${key}`);
    } else {
      localStorage.removeItem(`bt-${key}`);
    }
  }
}