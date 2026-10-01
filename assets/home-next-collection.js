(() => {
  if (window.HomeNextCollectionManager) {
    window.HomeNextCollectionManager.initializeAll();
    return;
  }

  class HomeNextCollectionController {
    constructor(root) {
      this.root = root;
      this.sectionId = root.dataset.sectionId;
      this.track = root.querySelector('[data-product-carousel-track]');
      this.previousButton = root.querySelector('[data-product-carousel-previous]');
      this.nextButton = root.querySelector('[data-product-carousel-next]');
      this.abortController = new AbortController();
      this.scrollFrame = null;

      if (!this.track) return;

      const options = { signal: this.abortController.signal };
      root.addEventListener('click', this.onClick, options);
      this.track.addEventListener('scroll', this.onScroll, { ...options, passive: true });
      window.addEventListener('resize', this.onResize, { ...options, passive: true });
      requestAnimationFrame(this.updateControls);
    }

    destroy() {
      if (this.scrollFrame) cancelAnimationFrame(this.scrollFrame);
      this.abortController.abort();
    }

    onClick = (event) => {
      if (event.target.closest('[data-product-carousel-previous]')) {
        event.preventDefault();
        this.scrollBy(-1);
        return;
      }

      if (event.target.closest('[data-product-carousel-next]')) {
        event.preventDefault();
        this.scrollBy(1);
      }
    };

    onScroll = () => {
      if (this.scrollFrame) cancelAnimationFrame(this.scrollFrame);
      this.scrollFrame = requestAnimationFrame(this.updateControls);
    };

    onResize = () => {
      if (this.scrollFrame) cancelAnimationFrame(this.scrollFrame);
      this.scrollFrame = requestAnimationFrame(this.updateControls);
    };

    scrollBy(direction) {
      const firstItem = this.track.querySelector('[data-product-carousel-item]');
      if (!firstItem) return;

      const gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.track.scrollBy({
        left: direction * (firstItem.getBoundingClientRect().width + gap),
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
    }

    updateControls = () => {
      if (!this.track) return;

      const maximumScroll = Math.max(0, this.track.scrollWidth - this.track.clientWidth);
      const overflowing = maximumScroll > 2;
      this.root.classList.toggle('is-overflowing', overflowing);

      if (this.previousButton) this.previousButton.disabled = !overflowing || this.track.scrollLeft <= 2;
      if (this.nextButton) this.nextButton.disabled = !overflowing || this.track.scrollLeft >= maximumScroll - 2;
    };
  }

  const controllers = new Map();

  const initialize = (root) => {
    if (!root?.dataset.sectionId) return;
    const sectionId = root.dataset.sectionId;
    controllers.get(sectionId)?.destroy();
    controllers.set(sectionId, new HomeNextCollectionController(root));
  };

  const initializeAll = (scope = document) => {
    if (scope.matches?.('[data-home-next-collection][data-section-id]')) initialize(scope);
    scope.querySelectorAll?.('[data-home-next-collection][data-section-id]').forEach(initialize);
  };

  document.addEventListener('shopify:section:load', (event) => initializeAll(event.target));
  document.addEventListener('shopify:section:unload', (event) => {
    const root = event.target.matches?.('[data-home-next-collection][data-section-id]')
      ? event.target
      : event.target.querySelector?.('[data-home-next-collection][data-section-id]');
    if (!root) return;

    const controller = controllers.get(root.dataset.sectionId);
    if (controller?.root !== root) return;
    controller.destroy();
    controllers.delete(root.dataset.sectionId);
  });

  window.HomeNextCollectionManager = { initialize, initializeAll };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeAll(), { once: true });
  } else {
    initializeAll();
  }
})();
