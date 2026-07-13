if (!customElements.get('cart-product-recommendations')) {
	customElements.define('cart-product-recommendations', class CartProductRecommendations extends HTMLElement {
		constructor() {
			super();
      this.handleRequests = [];
      CartProductRecommendations.installJaneCartUpsellHardBlock();
		}

    connectedCallback() {
      this.pruneBlockedCartUpsells();
    }

		update() {
      let results = [];
      let resultIds = [];
			let totalItem = 0;
      this.limit = parseInt(this.dataset.limit);
      this.classList.add('loading');
      const loading = this.querySelector('.cart__recommendation-loading');
      if(loading) {
        loading.classList.remove('hidden');
      }
      fetch(`${routes.cart_url}.js`)
      .then(response => response.json())
      .then(cart => {
        if(cart.item_count > 0) {
          const productIds = cart.items.map((item) => {
            return item.product_id;
          });
          if(productIds.length == 0) {
            this.classList.add('hidden');
            return;
          }
          this.classList.remove('hidden');
          const cartItemsLength = productIds.length;
          const limit = Math.round(parseFloat(this.limit / cartItemsLength)) + cartItemsLength - 1;
          productIds.forEach((pId, index) => {
            const url = `${this.dataset.url}?section_id=${this.dataset.sectionId}&product_id=${pId}&limit=${limit}`;
            const controller = new AbortController();
            const signal = controller.signal;
            this.handleRequests.push(controller);
            fetch(url, { signal })
              .then(response => response.text())
              .then(text => {
                const resultList = getDomHtmlFromText(text, '.item-list');
                if(resultList) {
                  resultList.querySelectorAll(this.dataset.itemSelector).forEach((item, itemIndex) => {
                    const itemId = item.dataset.productId;
                    if(!this.isBlockedCartUpsell(item) && !resultIds.includes(itemId)) {
                      results.push(item);
                      resultIds.push(itemId);
                    }
                  });
                }
                
                totalItem++;
                if(totalItem == cartItemsLength) {
                  this.classList.remove('loading');
                  this.renderResults(results);
                  this.pruneBlockedCartUpsells();
                  if(!this.querySelector('.cart__recommendation-list .grid__item')) {
                    this.classList.add('hidden');
                  }
                }
              });
          });
        } else {
          this.classList.remove('loading');
        }
      });
    }

    isBlockedCartUpsell(item) {
      return CartProductRecommendations.isBlockedJaneCartUpsell(item);
    }

    pruneBlockedCartUpsells() {
      CartProductRecommendations.pruneBlockedJaneCartUpsells(this);
    }

    renderResults(items) {
      if(this.querySelector('.cart__recommendation-loading')) {
        if(this.dataset.removeLoading) {
          this.querySelector('.cart__recommendation-loading').remove();
        } else {
          this.querySelector('.cart__recommendation-loading').classList.add('hidden');
        }
      }
      this.handleRequests = [];
      this.fisherYates(items);
      const finalItems = items.filter((item) => !this.isBlockedCartUpsell(item)).slice(0, this.limit);
      if(finalItems.length === 0) {
        const list = this.querySelector('.cart__recommendation-list');
        if(list) list.innerHTML = '';
        this.classList.add('hidden');
        return;
      }
      const list = this.querySelector('.cart__recommendation-list');
      const sliderComponent = document.createElement('slider-component');
      sliderComponent.classList.add('slider-mobile-gutter', 'por');
      this.dataset.componentClasses.split(' ').forEach((htmlClass, indexClass) => {
        sliderComponent.classList.add(htmlClass);
      });
      sliderComponent.dataset.outsidePrevButtonId = `Slider-${this.dataset.sectionId}-prev-button`;
      sliderComponent.dataset.outsideNextButtonId = `Slider-${this.dataset.sectionId}-next-button`;
      const sliderList = document.createElement('ul');
      sliderList.id = `Slider-${this.dataset.sectionId}`;
      sliderList.classList.add('grid');
      this.dataset.gridClasses.split(' ').forEach((htmlClass, indexClass) => {
        sliderList.classList.add(htmlClass);
      });
      finalItems.forEach((item, index) => {
        const sliderItem = document.createElement('li');
        sliderItem.id = `Slide-${this.dataset.sectionId}-${(index + 1)}`;
        sliderItem.classList.add('grid__item', 'slider__slide');
        sliderItem.appendChild(item);
        sliderList.appendChild(sliderItem);
      });
      sliderComponent.appendChild(sliderList);
      list.innerHTML = '';
      list.appendChild(sliderComponent);
      sliderComponent.init();
      this.pruneBlockedCartUpsells();
    }

    static installJaneCartUpsellHardBlock() {
      if(window.janeCartUpsellHardBlockInstalled) return;
      window.janeCartUpsellHardBlockInstalled = true;

      document.addEventListener('submit', (event) => {
        if(CartProductRecommendations.shouldBlockJaneCartUpsellAction(event.target)) {
          event.preventDefault();
          event.stopPropagation();
          if(typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
          CartProductRecommendations.pruneBlockedJaneCartUpsells();
        }
      }, true);

      document.addEventListener('click', (event) => {
        const clickedAddControl = event.target.closest?.('button[name="add"], [type="submit"], .cart-submit-button, [data-add-to-cart], a[href*="/cart/add"]');
        if(clickedAddControl && CartProductRecommendations.shouldBlockJaneCartUpsellAction(clickedAddControl)) {
          event.preventDefault();
          event.stopPropagation();
          if(typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
          CartProductRecommendations.pruneBlockedJaneCartUpsells();
        }
      }, true);

      document.addEventListener('afterCartChanged', () => CartProductRecommendations.scheduleJaneCartUpsellPrune(), { passive: true });
      document.addEventListener('DOMContentLoaded', () => CartProductRecommendations.scheduleJaneCartUpsellPrune(), { once: true });

      const cartDrawer = document.querySelector('cart-drawer');
      if(cartDrawer && 'MutationObserver' in window) {
        const observer = new MutationObserver(() => CartProductRecommendations.scheduleJaneCartUpsellPrune(cartDrawer));
        observer.observe(cartDrawer, { childList: true, subtree: true });
      }
    }

    static scheduleJaneCartUpsellPrune(root = document) {
      if(window.janeCartUpsellPruneQueued) return;
      window.janeCartUpsellPruneQueued = true;
      requestAnimationFrame(() => {
        window.janeCartUpsellPruneQueued = false;
        CartProductRecommendations.pruneBlockedJaneCartUpsells(root);
      });
    }

    static shouldBlockJaneCartUpsellAction(element) {
      const surface = CartProductRecommendations.getCartUpsellSurface(element);
      if(!surface) return false;
      const card = CartProductRecommendations.getCartUpsellCard(element, surface);
      return CartProductRecommendations.isBlockedJaneCartUpsell(card || element);
    }

    static getCartUpsellSurface(element) {
      return element?.closest?.('cart-product-recommendations, .cart-drawer__recommendation, .cart__recommendation-list, main-cart-recommendations, [class*="upsell"], [class*="recommend"], [id*="upsell"], [id*="recommend"]');
    }

    static getCartUpsellCard(element, surface) {
      if(!element) return null;
      const card = element.closest?.('cart-drawer-product-recommendation-item, .cart-drawer__recommendation-item, .grid__item, .slider__slide, .item, [data-product-id], li');
      if(card && (!surface || surface.contains(card))) return card;
      return surface || null;
    }

    static isBlockedJaneCartUpsell(item) {
      if(!item) return false;

      const dataset = item.dataset || {};
      const handle = (dataset.productHandle || dataset.handle || '').toLowerCase();
      const title = (dataset.productTitle || dataset.title || '').toLowerCase();
      const tags = (dataset.productTags || dataset.tags || '').toLowerCase();
      const productUrl = (dataset.productUrl || item.querySelector?.('a[href*="/products/"]')?.getAttribute('href') || '').toLowerCase();
      const content = (item.textContent || '').toLowerCase();
      const janeText = `${handle} ${title} ${tags} ${productUrl} ${content}`;

      if(janeText.includes('no-cart-upsell')) return true;
      if(handle.includes('jane') || productUrl.includes('/products/') && productUrl.includes('jane')) return true;
      if(janeText.includes('jane set') || janeText.includes('jane blouse') || janeText.includes('jane pants')) return true;
      if(/\bsku\s*:\s*jane/i.test(content) || /\bjane(blouse|pants)?[a-z0-9-]*/i.test(content)) return true;

      return false;
    }

    static pruneBlockedJaneCartUpsells(root = document) {
      const scopedRoot = root || document;
      const surfaces = scopedRoot.matches?.('cart-product-recommendations, .cart-drawer__recommendation, .cart__recommendation-list, main-cart-recommendations, [class*="upsell"], [class*="recommend"], [id*="upsell"], [id*="recommend"]')
        ? [scopedRoot]
        : Array.from(scopedRoot.querySelectorAll?.('cart-product-recommendations, .cart-drawer__recommendation, .cart__recommendation-list, main-cart-recommendations, [class*="upsell"], [class*="recommend"], [id*="upsell"], [id*="recommend"]') || []);

      surfaces.forEach((surface) => {
        surface.querySelectorAll('cart-drawer-product-recommendation-item, .cart-drawer__recommendation-item, .grid__item, .slider__slide, .item, [data-product-id], li').forEach((candidate) => {
          if(CartProductRecommendations.isBlockedJaneCartUpsell(candidate)) {
            candidate.remove();
          }
        });

        const remainingItems = surface.querySelectorAll('cart-drawer-product-recommendation-item, .cart-drawer__recommendation-item, .grid__item, .slider__slide, .item, [data-product-id], li');
        if(remainingItems.length === 0 && surface.matches('cart-product-recommendations, .cart-drawer__recommendation, .cart__recommendation-list, main-cart-recommendations')) {
          surface.classList.add('hidden');
        }
      });
    }

    fisherYates( array ){
      var count = array.length, randomnumber, temp;
      while( count ){
        randomnumber = Math.random() * count-- | 0;
        temp = array[count];
        array[count] = array[randomnumber];
        array[randomnumber] = temp
      }
    }

    disconnectedCallback() {
      if(this.handleRequests.length > 0) {
        this.classList.remove('loading');
        this.handleRequests.forEach((controller, index) => {
          controller.abort();
        });
      }
    }
  });
}
