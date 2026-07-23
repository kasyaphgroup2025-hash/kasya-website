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
      this.title = root.querySelector('[data-look-title]');
      this.description = root.querySelector('[data-look-description]');
      this.triggers = Array.from(root.querySelectorAll('[data-look-trigger]'));
      this.dots = Array.from(root.querySelectorAll('[data-carousel-dot]'));
      this.images = Array.from(root.querySelectorAll('[data-carousel-image]'));
      this.productSlots = Array.from(root.querySelectorAll('[data-product-slot]'));
      this.looks = this.readLooks();
      this.activeLook = 0;
      this.activeSlide = 0;
      this.scrollFrame = null;

      const options = { signal: this.abortController.signal };
      root.addEventListener('click', this.onClick, options);
      root.addEventListener('keydown', this.onKeyDown, options);
      this.track?.addEventListener('scroll', this.onScroll, { ...options, passive: true });
      document.addEventListener('shopify:block:select', this.onBlockSelect, options);
      document.addEventListener('shopify:block:deselect', this.onBlockDeselect, options);
      this.activateLook(0, { focus: false });
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
      const trigger = event.target.closest('[data-look-trigger]');
      if (trigger && this.root.contains(trigger)) {
        event.preventDefault();
        this.activateLook(Number(trigger.dataset.lookTrigger), { focus: true });
        return;
      }

      const dot = event.target.closest('[data-carousel-dot]');
      if (dot && this.root.contains(dot)) {
        event.preventDefault();
        this.goToSlide(Number(dot.dataset.carouselDot), true);
      }
    };

    onKeyDown = (event) => {
      const trigger = event.target.closest('[data-look-trigger]');
      if (!trigger || !this.root.contains(trigger)) return;

      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const current = Number(trigger.dataset.lookTrigger);
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const next = (current + direction + this.triggers.length) % this.triggers.length;
        this.activateLook(next, { focus: true });
      }
    };

    onScroll = () => {
      if (this.scrollFrame) cancelAnimationFrame(this.scrollFrame);
      this.scrollFrame = requestAnimationFrame(() => {
        if (!this.track?.clientWidth) return;
        const index = Math.round(this.track.scrollLeft / this.track.clientWidth);
        this.setActiveDot(index);
      });
    };

    onBlockSelect = (event) => {
      const index = this.looks.findIndex((look) => look?.blockId === event.detail?.blockId);
      if (index >= 0) this.activateLook(index, { focus: false });
    };

    onBlockDeselect = () => {};

    activateLook(index, { focus = false } = {}) {
      const look = this.looks[index];
      const trigger = this.triggers[index];
      if (!look || !trigger) return;

      this.activeLook = index;
      this.title.textContent = look.title || '';
      this.description.textContent = look.description || '';
      this.root.style.setProperty('--active-position-mobile', look.positionMobile || 'center center');
      this.root.style.setProperty('--active-position-desktop', look.positionDesktop || 'center center');

      this.images.forEach((image, imageIndex) => this.updateImage(image, look.images?.[imageIndex]));
      this.productSlots.forEach((slot, productIndex) => this.updateProduct(slot, look.products?.[productIndex]));
      this.triggers.forEach((item, triggerIndex) => {
        const active = triggerIndex === index;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-selected', String(active));
        item.tabIndex = active ? 0 : -1;
      });

      this.goToSlide(0, false);
      if (focus) trigger.focus({ preventScroll: true });
    }

    updateImage(image, data) {
      if (!image) return;
      if (data?.src) {
        image.src = data.src;
        image.alt = data.alt || '';
        image.hidden = false;
      } else {
        image.removeAttribute('src');
        image.alt = data?.alt || '';
        image.hidden = true;
      }
    }

    updateProduct(slot, product) {
      if (!slot) return;
      const image = slot.querySelector('[data-product-image]');
      const title = slot.querySelector('[data-product-title]');
      const button = slot.querySelector('[data-product-button]');
      this.updateImage(image, product?.image);
      title.textContent = product?.title || '';
      button.textContent = product?.buttonLabel || 'See Color & Fit';

      slot.querySelectorAll('[data-product-link]').forEach((link) => {
        if (product?.url) {
          link.href = product.url;
          link.removeAttribute('aria-disabled');
        } else {
          link.removeAttribute('href');
          link.setAttribute('aria-disabled', 'true');
        }
      });
    }

    goToSlide(index, smooth) {
      if (!this.track) return;
      this.activeSlide = Math.max(0, Math.min(index, this.dots.length - 1));
      this.track.scrollTo({ left: this.track.clientWidth * this.activeSlide, behavior: smooth ? 'smooth' : 'auto' });
      this.setActiveDot(this.activeSlide);
    }

    setActiveDot(index) {
      this.activeSlide = Math.max(0, Math.min(index, this.dots.length - 1));
      this.dots.forEach((dot, dotIndex) => {
        const active = dotIndex === this.activeSlide;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-current', String(active));
      });
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
