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
      this.status = root.querySelector('[data-carousel-status]');
      this.activeSlide = 0;
      this.visibleLooks = this.getVisibleLooks();
      this.scrollFrame = null;
      this.resizeFrame = null;

      const options = { signal: this.abortController.signal };
      root.addEventListener('click', this.onClick, options);
      root.addEventListener('keydown', this.onKeyDown, options);
      this.track?.addEventListener('scroll', this.onScroll, { ...options, passive: true });
      window.addEventListener('resize', this.onResize, { ...options, passive: true });
      document.addEventListener('shopify:block:select', this.onBlockSelect, options);

      if (this.slides.length) this.activateSlide(0);
    }

    destroy() {
      if (this.scrollFrame) cancelAnimationFrame(this.scrollFrame);
      if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);
      this.abortController.abort();
    }

    getVisibleLooks() {
      return window.matchMedia('(min-width: 990px)').matches ? 2 : 1;
    }

    getGroupStart(index) {
      if (!this.slides.length) return 0;
      const clampedIndex = Math.max(0, Math.min(index, this.slides.length - 1));
      return Math.floor(clampedIndex / this.visibleLooks) * this.visibleLooks;
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
      }
    };

    onKeyDown = (event) => {
      if (event.target !== this.track || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;

      event.preventDefault();
      this.goBy(event.key === 'ArrowRight' ? 1 : -1);
    };

    onScroll = () => {
      if (this.scrollFrame) cancelAnimationFrame(this.scrollFrame);
      this.scrollFrame = requestAnimationFrame(() => {
        if (!this.track || !this.slides.length) return;

        const index = this.slides.reduce((closestIndex, slide, slideIndex) => {
          const currentDistance = Math.abs(slide.offsetLeft - this.track.scrollLeft);
          const closestDistance = Math.abs(this.slides[closestIndex].offsetLeft - this.track.scrollLeft);
          return currentDistance < closestDistance ? slideIndex : closestIndex;
        }, 0);

        this.activateSlide(index);
      });
    };

    onResize = () => {
      if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = requestAnimationFrame(() => {
        this.visibleLooks = this.getVisibleLooks();
        this.goToSlide(this.activeSlide, false);
      });
    };

    onBlockSelect = (event) => {
      const index = this.slides.findIndex((slide) => slide.dataset.blockId === event.detail?.blockId);
      if (index >= 0) this.goToSlide(index, false);
    };

    goBy(direction) {
      if (!this.slides.length) return;
      const groupCount = Math.ceil(this.slides.length / this.visibleLooks);
      const currentGroup = Math.floor(this.activeSlide / this.visibleLooks);
      const nextGroup = (currentGroup + direction + groupCount) % groupCount;
      this.goToSlide(nextGroup * this.visibleLooks, true);
    }

    goToSlide(index, smooth) {
      if (!this.track || !this.slides.length) return;
      const next = this.getGroupStart(index);
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this.track.scrollTo({
        left: this.slides[next].offsetLeft,
        behavior: smooth && !prefersReducedMotion ? 'smooth' : 'auto'
      });
      this.activateSlide(next);
    }

    activateSlide(index) {
      if (!this.slides.length) return;
      this.activeSlide = this.getGroupStart(index);
      const lastVisibleSlide = Math.min(this.activeSlide + this.visibleLooks - 1, this.slides.length - 1);

      this.slides.forEach((slide, slideIndex) => {
        const active = slideIndex >= this.activeSlide && slideIndex <= lastVisibleSlide;
        slide.setAttribute('aria-hidden', String(!active));
        slide.toggleAttribute('inert', !active);
      });

      if (this.status) {
        this.status.textContent = this.visibleLooks > 1
          ? `Looks ${this.activeSlide + 1}–${lastVisibleSlide + 1} of ${this.slides.length}`
          : `Look ${this.activeSlide + 1} of ${this.slides.length}`;
      }
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
