(() => {
  if (window.Home88OutfitManager) {
    window.Home88OutfitManager.initializeAll();
    return;
  }

  class Home88OutfitController {
    constructor(root) {
      this.root = root;
      this.sectionId = root.dataset.sectionId;
      this.abortController = new AbortController();
      this.track = root.querySelector('[data-carousel-track]');
      this.slides = Array.from(root.querySelectorAll('[data-carousel-slide]'));
      this.dots = Array.from(root.querySelectorAll('[data-carousel-dot]'));
      this.previousButton = root.querySelector('[data-carousel-previous]');
      this.nextButton = root.querySelector('[data-carousel-next]');
      this.productTray = root.querySelector('[data-product-tray]');
      this.productSlots = Array.from(root.querySelectorAll('[data-product-slot]'));
      this.looks = this.readLooks();
      this.activeSlide = 0;
      this.activeLook = -1;
      this.scrollFrame = null;

      const options = { signal: this.abortController.signal };
      root.addEventListener('click', this.onClick, options);
      root.addEventListener('keydown', this.onKeyDown, options);
      this.track?.addEventListener('scroll', this.onScroll, { ...options, passive: true });
      document.addEventListener('shopify:block:select', this.onBlockSelect, options);

      if (this.slides.length) this.activateSlide(0, false);
    }

    destroy() {
      if (this.scrollFrame) cancelAnimationFrame(this.scrollFrame);
      this.abortController.abort();
    }

    readLooks() {
      return Array.from(this.root.querySelectorAll('[data-look-json]')).map((node) => {
        try {
          return JSON.parse(node.textContent);
        } catch (error) {
          return null;
        }
      });
    }

    onClick = (event) => {
      if (event.target.closest('[data-carousel-previous]')) {
        event.preventDefault();
        this.goBy(-1);
        return;
      }

      if (event.target.closest('[data-carousel-next]')) {
        event.preventDefault();
        this.goBy(1);
        return;
      }

      const dot = event.target.closest('[data-carousel-dot]');
      if (dot && this.root.contains(dot)) {
        event.preventDefault();
        this.goToSlide(Number(dot.dataset.carouselDot), true);
      }
    };

    onKeyDown = (event) => {
      if (!this.track || event.target !== this.track) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

      event.preventDefault();
      this.goBy(event.key === 'ArrowRight' ? 1 : -1);
    };

    onScroll = () => {
      if (this.scrollFrame) cancelAnimationFrame(this.scrollFrame);
      this.scrollFrame = requestAnimationFrame(() => {
        if (!this.track?.clientWidth) return;
        const index = Math.round(this.track.scrollLeft / this.track.clientWidth);
        this.activateSlide(index, false);
      });
    };

    onBlockSelect = (event) => {
      const index = this.slides.findIndex((slide) => slide.dataset.blockId === event.detail?.blockId);
      if (index >= 0) this.goToSlide(index, false);
    };

    goBy(direction) {
      if (!this.slides.length) return;
      const next = (this.activeSlide + direction + this.slides.length) % this.slides.length;
      this.goToSlide(next, true);
    }

    goToSlide(index, smooth) {
      if (!this.track || !this.slides.length) return;
      const next = Math.max(0, Math.min(index, this.slides.length - 1));
      this.track.scrollTo({
        left: this.track.clientWidth * next,
        behavior: smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto'
      });
      this.activateSlide(next, false);
    }

    activateSlide(index, announce) {
      if (!this.slides.length) return;
      this.activeSlide = Math.max(0, Math.min(index, this.slides.length - 1));

      this.slides.forEach((slide, slideIndex) => {
        slide.setAttribute('aria-hidden', String(slideIndex !== this.activeSlide));
      });

      this.dots.forEach((dot, dotIndex) => {
        const active = dotIndex === this.activeSlide;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-current', String(active));
      });

      const lookIndex = Number(this.slides[this.activeSlide]?.dataset.lookIndex || 0);
      if (lookIndex !== this.activeLook) this.activateLook(lookIndex, announce);
    }

    activateLook(index, announce) {
      const look = this.looks[index];
      if (!look) return;

      this.activeLook = index;
      let productCount = 0;
      this.productSlots.forEach((slot, productIndex) => {
        if (this.updateProduct(slot, look.products?.[productIndex])) productCount += 1;
      });

      if (this.productTray) {
        this.productTray.dataset.productCount = String(productCount);
        this.productTray.setAttribute('aria-live', announce ? 'polite' : 'off');
      }
    }

    updateProduct(slot, product) {
      if (!slot) return false;
      const valid = Boolean(product?.url);
      slot.hidden = !valid;
      if (!valid) return false;

      const image = slot.querySelector('[data-product-image]');
      const title = slot.querySelector('[data-product-title]');
      const button = slot.querySelector('[data-product-button]');

      if (image) {
        if (product.image?.src) {
          image.src = product.image.src;
          image.alt = product.image.alt || product.title || '';
          image.hidden = false;
        } else {
          image.removeAttribute('src');
          image.alt = product.title || '';
          image.hidden = true;
        }
      }

      if (title) title.textContent = product.title || '';
      slot.querySelectorAll('[data-product-link]').forEach((link) => {
        link.href = product.url;
        link.removeAttribute('aria-disabled');
      });

      if (button) {
        button.dataset.productUrl = product.url;
        button.disabled = false;
        button.removeAttribute('aria-disabled');
        button.setAttribute('aria-label', `See fit and colors for ${product.title || 'this product'}`);
      }

      return true;
    }
  }

  const controllers = new Map();

  const initialize = (root) => {
    if (!root?.dataset.sectionId) return;
    const sectionId = root.dataset.sectionId;
    controllers.get(sectionId)?.destroy();
    controllers.set(sectionId, new Home88OutfitController(root));
  };

  const initializeAll = (scope = document) => {
    if (scope.matches?.('[data-home-88-outfit][data-section-id]')) initialize(scope);
    scope.querySelectorAll?.('[data-home-88-outfit][data-section-id]').forEach(initialize);
  };

  document.addEventListener('shopify:section:load', (event) => initializeAll(event.target));
  document.addEventListener('shopify:section:unload', (event) => {
    const root = event.target.matches?.('[data-home-88-outfit][data-section-id]')
      ? event.target
      : event.target.querySelector?.('[data-home-88-outfit][data-section-id]');
    if (!root) return;
    const controller = controllers.get(root.dataset.sectionId);
    if (controller?.root !== root) return;
    controller.destroy();
    controllers.delete(root.dataset.sectionId);
  });

  window.Home88OutfitManager = { initialize, initializeAll };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeAll(), { once: true });
  } else {
    initializeAll();
  }
})();
