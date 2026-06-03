class DetailsDisclosure extends HTMLElement {
  constructor() {
    super();
    this.mainDetailsToggle = this.querySelector('details');
    this.content = this.mainDetailsToggle.querySelector('summary').nextElementSibling;
    this.closingTimeout;

    this.mainDetailsToggle.addEventListener('focusout', this.onFocusOut.bind(this));
    this.addEventListener('keyup', this.onContainerKeyUp.bind(this));

    this.openHandler = this.open.bind(this);
    this.closeWithClosingClassHandler = this.closeWithClosingClass.bind(this);

    this.closeButton = this.querySelector('.disclosure__close-button');
    if(this.closeButton) {
      this.onClickCloseButtonHandler = this.onClickCloseButton.bind(this);
      this.closeButton.addEventListener('click', this.onClickCloseButtonHandler);
    }
    
    if(!this.dataset.ignoreHover) {
      this.isAbleToUseMouse = matchMedia('(hover: hover)').matches;

      this.debouncedOnChange = debounce((event) => {
        this.isAbleToUseMouse = matchMedia('(hover: hover)').matches;
        this.initHoverDetails();
      }, 300);

      this.debouncedOnChangeHandler = this.debouncedOnChange.bind(this);
  
      window.addEventListener('resize', this.debouncedOnChangeHandler);
  
      this.initHoverDetails();
    }
    
    this.initClickSummary();
  }

  disconnectedCallback() {
    if(this.isAbleToUseMouse) {
      Shopify.removeEventListener(this.mainDetailsToggle, 'mouseenter', this.openHandler);
      Shopify.removeEventListener(this.mainDetailsToggle, 'mouseleave', this.closeWithClosingClassHandler);
    }

    if(this.closeButton) {
      this.closeButton.removeEventListener('click', this.onClickCloseButtonHandler);
    }

    if(this.debouncedOnChangeHandler) {
      window.removeEventListener('resize', this.debouncedOnChangeHandler);
    }
  }

  initHoverDetails () {
    if(this.isAbleToUseMouse) {
      Shopify.addListener(this.mainDetailsToggle, 'mouseenter', this.openHandler);
      Shopify.addListener(this.mainDetailsToggle, 'mouseleave', this.closeWithClosingClassHandler);
    } else {
      this.mainDetailsToggle.removeEventListener('mouseenter', this.openHandler);
      this.mainDetailsToggle.removeEventListener('mouseleave', this.closeWithClosingClassHandler);
    }
  }

  initClickSummary() {
    this.mainDetailsToggle.querySelector('summary').addEventListener('click', (e) => {
      e.preventDefault();
      if (this.mainDetailsToggle.hasAttribute('open')) {
        this.closeWithClosingClass();
      } else {
        this.open();
      }
    });
  }

  closeWithClosingClass() {
    if(this.classList.contains('ignore-close')) return;
    this.mainDetailsToggle.classList.add('closing');
    if(this.closingTimeout) {
      clearTimeout(this.closingTimeout);
    }
    this.closingTimeout = setTimeout(() => {
      this.close();
      this.mainDetailsToggle.classList.remove('closing');
    }, 300);
  }

  onContainerKeyUp(event) {
    if (event.code.toUpperCase() !== 'ESCAPE') return;

    this.closeWithClosingClass();
    this.mainDetailsToggle.querySelector('summary').focus();
  }

  onFocusOut() {
    setTimeout(() => {
      if (!this.contains(document.activeElement)) this.closeWithClosingClass();
    })
  }

  onClickCloseButton() {
    this.closeWithClosingClass();
  }

  playAnimation() {
    if (!this.animations) this.animations = this.content.getAnimations();
    if (this.mainDetailsToggle.hasAttribute('open')) {
      this.animations.forEach(animation => animation.play());
    } else {
      this.animations.forEach(animation => animation.cancel());
    }
  }

  open() {
    this.mainDetailsToggle.setAttribute('open', true);
    this.mainDetailsToggle.querySelector('summary').setAttribute('aria-expanded', true);
    this.playAnimation();
  }

  close() {
    this.mainDetailsToggle.removeAttribute('open');
    this.mainDetailsToggle.querySelector('summary').setAttribute('aria-expanded', false);
  }
}

customElements.define('details-disclosure', DetailsDisclosure);

let hoverSupport = matchMedia('(hover: hover)').matches;
window.addEventListener('resize', () => {
  hoverSupport = matchMedia('(hover: hover)').matches;
});

class HeaderMenu extends DetailsDisclosure {
  constructor() {
    super();
    this.header = document.querySelector('.header');
    this.mainDetailsToggle.addEventListener('toggle', this.onToggle.bind(this));
    this.querySelectorAll(':scope > details > .header__menu-item--link').forEach(element => element.addEventListener('click', this.onClickSummary.bind(this)));
    this.stickyHeader = this.closest('sticky-header');
  }

  onClickSummary(event) {
    if(hoverSupport && !this.dataset.ignoreHover) {
      event.preventDefault();
      window.location = event.currentTarget.dataset.href;
    }
  }

  open() {
    super.open();
    if(this.stickyHeader) {
      this.stickyHeader.setPreventOpen(true);
      this.stickyHeader.setPreventHide(true);
    }
  }

  close() {
    super.close();
    if(this.stickyHeader) {
      this.stickyHeader.setPreventOpen(false);
      this.stickyHeader.setPreventHide(false);
    }
  }

  onToggle() {
    if (!this.header) return;
    if (document.documentElement.style.getPropertyValue('--header-bottom-position-desktop') === '') {
      document.documentElement.style.setProperty('--header-bottom-position-desktop', `${Math.floor(this.header.getBoundingClientRect().bottom)}px`);
    }
    if(this.mainDetailsToggle.hasAttribute('open')) {
      if(this.content.getBoundingClientRect().bottom > document.documentElement.clientHeight - 50) {
        this.content.classList.add('outside-viewport');
        document.body.classList.add('overflow-hidden');
        this.content.style.setProperty(
          "--top-position",
          `${this.content.getBoundingClientRect().top}px`
        );
      }
    } else {
      this.content.classList.remove('outside-viewport');
      document.body.classList.remove('overflow-hidden');
      this.content.style.removeProperty("--top-position");
    }
  }
}

customElements.define('header-menu', HeaderMenu);
