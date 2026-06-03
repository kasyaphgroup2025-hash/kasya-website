if (!customElements.get('pinning-list')) {
  class PinningList extends HTMLElement {
    constructor() {
      super();
    }
  
    connectedCallback() {
      this.list = this.querySelector(".pcp__list");
      this.items = this.querySelectorAll(".pcp__item");
      this.wrapper = this.closest('.pcp-wrapper');
      this.heading = this.wrapper.querySelector(".page-width");
      this.setupWindowResize();
      this.initScroll();
    }

    disconnectedCallback() {
      this.destroyScrollEvent();
      window.removeEventListener('resize', this.debouncedOnWindowResize);
    }

    initScroll() {
      // Get item width including the gap
      const gap = parseFloat(window.getComputedStyle(this.list, null).columnGap);
      const itemWidth = this.items[0].offsetWidth;
      const totalWidth = (this.items.length * itemWidth) + (this.items.length - 1) * gap;

      // Calculate maximum translation to stop at the correct position
      const headingComputedStyle = window.getComputedStyle(this.heading, null);
      const maxTranslateX = totalWidth + parseFloat(headingComputedStyle.paddingRight) + parseFloat(headingComputedStyle.marginRight) - 50;
      // Animate gallery horizontally during vertical scroll
      this.cancel = Motion.scroll((progress, info) => {
          this.toggleBackgroundStageClasses(progress);
          const translateValue = progress * maxTranslateX;
          this.list.style.setProperty('--translateValue', `${translateValue}px`);

          if(this.dataset.headingAnimation) {
            // Translate section heading
            this.heading.style.setProperty('--progress', `${(1 - progress)}`);
          }
        }
        ,
        { target: this.wrapper, offset: [`start start`, "end end"] }
      );
    }

    setupWindowResize() {
      this.debouncedOnWindowResize = debounce((event) => {
        this.onWindowResize(event);
      }, 500);

      window.addEventListener('resize', this.debouncedOnWindowResize, false);
    }

    onWindowResize() {
      this.destroyScrollEvent();
      this.initScroll();
    }

    destroyScrollEvent() {
      this.cancel && this.cancel();
    }

    toggleBackgroundStageClasses(progress) {
      this.wrapper.classList.remove('pcp-wrapper--stage1', 'pcp-wrapper--stage2', 'pcp-wrapper--stage3')
      if(progress < 0.38) {
        this.wrapper.classList.add('pcp-wrapper--stage1');
      } else if(progress < 0.7) {
        this.wrapper.classList.add('pcp-wrapper--stage2');
      } else {
        this.wrapper.classList.add('pcp-wrapper--stage3');
      }
    }
  };
  
  customElements.define('pinning-list', PinningList);
}