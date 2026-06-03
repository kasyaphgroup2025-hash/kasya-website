if (!customElements.get('sticky-header')) {
  customElements.define('sticky-header', class StickyHeader extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      this.currentScrollTop = 0;
      this.preventReveal = false;
      this.preventResize = false;
      this.header = document.querySelector('.section-header');
      this.headerTop = document.querySelector('.header-top');
      this.predictiveSearch = this.querySelector('predictive-search');
      this.onScrollHandler = this.onScroll.bind(this);
      this.isToggleNav = this.classList.contains('toggle-nav');
      this.init = !Shopify.designMode;
      this.openStatus = false;
      if (document.readyState === 'complete') {
        this.setupWindowResizeEvent();
      } else {
        window.addEventListener('load', () => this.setupWindowResizeEvent(), { once: true });
      }
      this.calculateThreshold();
      this.hideHeaderOnScrollUp = () => this.preventReveal = true;
      this.addEventListener('preventHeaderReveal', this.hideHeaderOnScrollUp);
      if(this.isToggleNav) {
        this.header.classList.add('toggle-nav');
        this.toggleNavButton = this.querySelector('.header__toggle-nav-button');
        this.onToggleNavClickHandler = this.onToggleNavClick.bind(this);
        this.toggleNavButton.addEventListener('click', this.onToggleNavClickHandler);
        this.nav = this.querySelector('.header__inline-menu');
        setTimeout(() => {
          document.body.style.setProperty('--nav-height', `${this.nav.clientHeight}px`);
        }, 500);
      }

      this.onScroll();

      window.addEventListener('scroll', this.onScrollHandler, false);
    }

    disconnectedCallback() {
      window.removeEventListener('scroll', this.onScrollHandler);
      window.removeEventListener('resize', this.debouncedOnWindowResize);
      if(this.toggleNavButton) {
        this.toggleNavButton.removeEventListener('click', this.onToggleNavClickHandler);
      }
      if(this.timeoutInit) {
        clearTimeout(this.timeoutInit);
      }
    }

    calculateHeaderHeight() {
      this.headerHeight = 0;
      this.fullHeaderHeight = 0;
      this.querySelectorAll(':scope > *').forEach(element => {
        this.fullHeaderHeight += element.clientHeight;
        if(element.classList.contains('header')) {
          this.headerHeight = element.clientHeight;
          this.fullHeaderHeight += parseInt(window.getComputedStyle(element, null).getPropertyValue('margin-top'));
        }
      });
    }

    calculateThreshold() {
      this.headerBoundTop = this.header.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop) + this.fullHeaderHeight;
      this.threshold = this.headerBoundTop + 100;
      if(this.dataset.stickyType == 'always') {
        this.threshold += 100;
      }
    }

    onScroll() {
      const scrollTop = document.documentElement.scrollTop;

      if (this.predictiveSearch && this.predictiveSearch.isOpen) return;
      if(scrollTop > this.currentScrollTop & scrollTop > this.headerBoundTop) {
        // Scrolling down and passed the header: hide the sticky header but keep position fixed.
        if(this.dataset.stickyType == 'always') {
          this.openStickyHeader(scrollTop);
        } else {
          if (this.preventHide) return;
          requestAnimationFrame(this.hide.bind(this));
        }
      } else if (scrollTop < this.currentScrollTop && scrollTop > this.headerBoundTop) {
        // Scrolling up and passed the header: show the sticky header.
        this.openStickyHeader(scrollTop);
      } else if (scrollTop <= this.headerBoundTop) {
        // Scroll above the header: reset the sticky header.
        requestAnimationFrame(this.reset.bind(this));
      }

      this.currentScrollTop = scrollTop;
    }

    openStickyHeader(scrollTop) {
      if(this.preventOpen) return;
      if (!this.preventReveal && scrollTop > this.threshold) {
        requestAnimationFrame(this.reveal.bind(this));
      } else {
        window.clearTimeout(this.isScrolling);

        this.isScrolling = setTimeout(() => {
          this.preventReveal = false;
        }, 66);

        requestAnimationFrame(this.hide.bind(this));
      }
    }

    setupWindowResizeEvent() {
      this.calculateHeaderHeight();
      this.onWindowResize();
      this.debouncedOnWindowResize = debounce((event) => {
        this.onWindowResize(event);
      }, 700);

      window.addEventListener('resize', this.debouncedOnWindowResize, false);
    }

    onWindowResize() {
      if(this.preventResize) return;
      let headerHeight;
      if(this.isToggleNav && window.innerWidth >= 990) {
        const navHeight = this.nav.clientHeight;
        document.body.style.setProperty('--nav-height', `${navHeight}px`);
        if(this.header.classList.contains('shopify-section-header-sticky') && !this.header.classList.contains('open-nav')) {
          headerHeight = this.header.querySelector('header').clientHeight + navHeight + 11;
        } else {
          headerHeight = this.header.querySelector('header').clientHeight;
        }
      } else {
        headerHeight = this.header.querySelector('header').clientHeight;
      }
      document.body.style.setProperty('--header-height', `${headerHeight}px`);
      const stickyHeaderHeight = headerHeight + this.getHeaderTopHeight();
      if(window.innerWidth >= 990) {
        document.body.style.setProperty('--sticky-header-height-desktop', `${stickyHeaderHeight}px`);
      } else {
        document.body.style.setProperty('--sticky-header-height-mobile', `${stickyHeaderHeight}px`);
      }
      this.calculateThreshold();
    }

    getHeaderTopHeight() {
      if(!this.headerTop) {
        return 0;
      }
      return this.headerTop.clientHeight;
    }

    onToggleNavClick() {
      document.body.style.setProperty('--nav-height', `${this.nav.clientHeight}px`);
      this.header.classList.toggle('open-nav');
      document.dispatchEvent(new CustomEvent('toggleNavInSticky', {detail: {
        toggleNav: this.header.classList.contains('open-nav'),
        headerHeight: this.headerHeight
      }}));
    }

    hide() {
      this.header.classList.add('shopify-section-header-hidden', 'shopify-section-header-sticky');
      this.closeMenuDisclosure();
      this.closeSearchModal();
      this.closeToggleNav();
      this.disableOpenStatus();
    }

    reveal() {
      if(this.openStatus) return;
      if(!this.init) {
        this.header.classList.add('shopify-section-header-sticky', 'animate');
      } else {
        this.header.classList.add('shopify-section-header-sticky');
        setTimeout(() => {
          this.header.classList.add('animate');
        }, 500);
        this.init = false;
      }
      this.header.classList.remove('shopify-section-header-hidden');
      if(this.dataset.toggleNav) {
        this.toggleNavButton.removeAttribute('tabindex');
      }
      this.enableOpenStatus();
    }

    reset() {
      this.header.classList.remove('shopify-section-header-hidden', 'shopify-section-header-sticky', 'animate');
      this.closeToggleNav();
      this.disableOpenStatus();
    }

    enableOpenStatus() {
      this.openStatus = true;
      document.dispatchEvent(new CustomEvent('openStickyHeader', {detail: {
        headerHeight: this.headerHeight,
        navHeight: this.nav?.clientHeight || 0,
        toggleNav: this.header.classList.contains('open-nav')
      }}));
    }

    disableOpenStatus() {
      this.openStatus = false;
      document.dispatchEvent(new CustomEvent('closeStickyHeader'));
    }

    closeToggleNav() {
      if(this.dataset.toggleNav) {
        this.toggleNavButton.setAttribute('tabindex', '-1');
        this.header.classList.remove('open-nav');
      }
    }

    closeMenuDisclosure() {
      this.disclosures = this.disclosures || this.header.querySelectorAll('header-menu');
      this.disclosures.forEach(disclosure => disclosure.close());
    }

    closeSearchModal() {
      this.searchModal = this.searchModal || this.header.querySelector('details-modal');
      if(this.searchModal) {
        this.searchModal.close(false);
      }
    }

    setPreventHide(value) {
      this.preventHide = value;
    }

    setPreventOpen(value) {
      this.preventOpen = value;
    }
  });
}