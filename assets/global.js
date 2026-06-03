class QuantityInput extends HTMLElement {
  constructor() {
    super();
    this.input = this.querySelector('input');
    this.changeEvent = new Event('change', { bubbles: true });
    this.input.addEventListener('change', this.onInputChange.bind(this));
    this.querySelectorAll('button').forEach(
      (button) => button.addEventListener('click', this.onButtonClick.bind(this))
    );
  }

  connectedCallback() {
    this.validateQtyRules();
    this.quantityUpdateHandler = this.onQuantityUpdate.bind(this);
    document.addEventListener('afterQuantityUpdate', this.quantityUpdateHandler);
  }

  disconnectedCallback() {
    if (this.quantityUpdateHandler) {
      document.removeEventListener('afterQuantityUpdate', this.quantityUpdateHandler);
    }
  }

  onInputChange(event) {
    this.validateQtyRules();
  }

  onButtonClick(event) {
    event.preventDefault();
    const previousValue = this.input.value;

    if (event.target.name === 'plus') {
      if (parseInt(this.input.dataset.min) > parseInt(this.input.step) && this.input.value == 0) {
        this.input.value = this.input.dataset.min;
      } else {
        this.input.stepUp();
      }
    } else {
      this.input.stepDown();
    }

    if (previousValue !== this.input.value) this.input.dispatchEvent(this.changeEvent);

    if (this.input.dataset.min === previousValue && event.target.name === 'minus') {
      this.input.value = parseInt(this.input.min);
    }
  }

  onQuantityUpdate() {
    this.validateQtyRules();
  }

  validateQtyRules() {
    if(this.input.value == '' || this.input.value == null) {
      this.input.value = this.input.min;
    } else if(parseInt(this.input.value) % parseInt(this.input.step) > 0) {
      this.input.stepUp();
    }
    const value = parseInt(this.input.value);
    if(this.input.max && (value > parseInt(this.input.max))) {
      this.input.value = this.input.max;
    }
    const finalValue = parseInt(this.input.value);
    if (this.input.min) {
      const buttonMinus = this.querySelector(".quantity__button[name='minus']");
      buttonMinus.classList.toggle('disabled', finalValue <= parseInt(this.input.min));
    }
    if (this.input.max) {
      const max = parseInt(this.input.max);
      const buttonPlus = this.querySelector(".quantity__button[name='plus']");
      buttonPlus.classList.toggle('disabled', finalValue >= max);
    }
  }
}

customElements.define('quantity-input', QuantityInput);

class MenuDrawer extends HTMLElement {
  constructor() {
    super();

    this.mainDetailsToggle = this.querySelector('details');

    this.addEventListener('keyup', this.onKeyUp.bind(this));
    this.addEventListener('focusout', this.onFocusOut.bind(this));
    this.bindEvents();
  }

  bindEvents() {
    this.querySelectorAll('summary:not(.no-control-menu)').forEach(summary => summary.addEventListener('click', this.onSummaryClick.bind(this)));
    this.querySelectorAll('button:not(.no-control-menu)').forEach(button => button.addEventListener('click', this.onCloseButtonClick.bind(this)));
  }

  onKeyUp(event) {
    if(event.code.toUpperCase() !== 'ESCAPE') return;

    const openDetailsElement = event.target.closest('details[open]');
    if(!openDetailsElement) return;

    openDetailsElement === this.mainDetailsToggle ? this.closeMenuDrawer(event, this.mainDetailsToggle.querySelector('summary')) : this.closeSubmenu(openDetailsElement);
  }

  onSummaryClick(event) {
    const summaryElement = event.currentTarget;
    const detailsElement = summaryElement.parentNode;
    const parentMenuElement = detailsElement.closest('.has-submenu');
    const isOpen = detailsElement.hasAttribute('open');
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function addTrapFocus() {
      trapFocus(summaryElement.nextElementSibling, detailsElement.querySelector('button') || detailsElement.querySelector(':scope > summary'));
      summaryElement.nextElementSibling.removeEventListener('transitionend', addTrapFocus);
    }

    if (detailsElement === this.mainDetailsToggle) {
      if(isOpen) event.preventDefault();
      isOpen ? this.closeMenuDrawer(event, summaryElement) : this.openMenuDrawer(summaryElement);
      if (window.matchMedia('(max-width: 990px)')) {
        document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
      }
    } else {
      setTimeout(() => {
        detailsElement.classList.add('menu-opening');
        summaryElement.setAttribute('aria-expanded', true);
        parentMenuElement && parentMenuElement.classList.add('submenu-open');
        this.hasBackButton ? document.body.classList.add('open-submenu-mobile') : '';
        !reducedMotion || reducedMotion.matches ? addTrapFocus() : summaryElement.nextElementSibling.addEventListener('transitionend', addTrapFocus);
      }, 100);
    }
  }

  openMenuDrawer(summaryElement) {
    setTimeout(() => {
      this.mainDetailsToggle.classList.add('menu-opening');
    });
    summaryElement.setAttribute('aria-expanded', true);
    trapFocus(this.mainDetailsToggle, summaryElement);
    document.body.classList.add(`overflow-hidden-${this.dataset.breakpoint}`);
    if(this.dataset.id) {
      document.body.classList.add(`open-drawer-${this.dataset.id}`);
    }
  }

  closeMenuDrawer(event, elementToFocus = false) {
    if (event === undefined) return;

    this.mainDetailsToggle.classList.remove('menu-opening');
    this.mainDetailsToggle.querySelectorAll('details').forEach(details => {
      details.removeAttribute('open');
      details.classList.remove('menu-opening');
    });
    this.hasBackButton ? document.body.classList.remove('open-submenu-mobile') : '';
    this.mainDetailsToggle.querySelectorAll('.submenu-open').forEach(submenu => {
      submenu.classList.remove('submenu-open');
    });
    document.body.classList.remove(`overflow-hidden-${this.dataset.breakpoint}`);
    removeTrapFocus(elementToFocus);
    this.closeAnimation(this.mainDetailsToggle);
    if(this.dataset.id) {
      document.body.classList.remove(`open-drawer-${this.dataset.id}`);
    }
  }

  onFocusOut(event) {
    setTimeout(() => {
      if (this.mainDetailsToggle.hasAttribute('open') && !this.mainDetailsToggle.contains(document.activeElement)) this.closeMenuDrawer();
    });
  }

  onCloseButtonClick(event) {
    const detailsElement = event.currentTarget.closest('details');
    this.closeSubmenu(detailsElement);
  }

  closeSubmenu(detailsElement) {
    this.hasBackButton ? document.body.classList.remove('open-submenu-mobile') : '';
    const parentMenuElement = detailsElement.closest('.submenu-open');
    parentMenuElement && parentMenuElement.classList.remove('submenu-open');
    detailsElement.classList.remove('menu-opening');
    detailsElement.querySelector('summary').setAttribute('aria-expanded', false);
    removeTrapFocus(detailsElement.querySelector('summary'));
    this.closeAnimation(detailsElement);
  }

  closeAnimation(detailsElement) {
    closeDetailsInAnimation(detailsElement);
  }
}

customElements.define('menu-drawer', MenuDrawer);

class HeaderDrawer extends MenuDrawer {
  constructor() {
    super();
    this.hasBackButton = true;
  }

  openMenuDrawer(summaryElement) {
    document.body.classList.add(`overflow-hidden-${this.dataset.breakpoint}`);
    this.header = this.header || document.querySelector('.section-header');
    this.headerContent = document.querySelector('.header');
    document.documentElement.style.setProperty('--header-bottom-position', `${parseInt(this.headerContent.getBoundingClientRect().bottom)}px`);
    this.header.classList.add('menu-open');

    setTimeout(() => {
      this.mainDetailsToggle.classList.add('menu-opening');
    });

    summaryElement.setAttribute('aria-expanded', true);
    trapFocus(this.mainDetailsToggle, summaryElement);
  }

  closeMenuDrawer(event, elementToFocus) {
    if (event === undefined) return;
    super.closeMenuDrawer(event, elementToFocus);
    this.header.classList.remove('menu-open');
  }
}

customElements.define('header-drawer', HeaderDrawer);

class BackButtonMenu extends HTMLElement {
  constructor() {
    super();

    this.button = this.querySelector('button');
    this.onButtonClickHandler = this.onButtonClick.bind(this);
    this.button.addEventListener('click', this.onButtonClickHandler);
    this.headerDrawer = document.querySelector('header-drawer');
  }

  disconnectedCallback() {
    this.button.removeEventListener('click', this.onButtonClickHandler);
  }

  onButtonClick() {
    const openingElements = this.headerDrawer.querySelectorAll('.menu-opening');
    if(openingElements.length == 1) {
      this.headerDrawer.querySelector('.header__icon').dispatchEvent(new Event('click'));
    } else {
      const lastElement = openingElements[openingElements.length - 1];
      lastElement.querySelector(':scope > div > div > .menu-drawer__close-button').dispatchEvent(new Event('click'));
    }
  }
}

customElements.define('back-button-menu', BackButtonMenu);

const animateResizeObserver = new ResizeObserver((entries, observer) => {
  if(window.innerWidth >= 750) {
    entries.forEach(entry => {
      if(!entry.target.inited) {
        entry.target.createObserver();
        observer.unobserve(entry.target);
      }
    });
  }
});

class UseAnimate extends HTMLElement {
  constructor() {
    super();
    if(!window.appearAnimate) return;
    this.inited = false;
  }

  connectedCallback() {
    if(window.innerWidth >= 750) {
      this.createObserver();
    } else {
      animateResizeObserver.observe(this);
    }
  }

  disconnectedCallback() {
    if(this.stop) {
      this.stop();
    }
    if(this.inited) {
      animateResizeObserver.unobserve(this);
    }
  }

  createObserver() {
    this.inited = true;
    this.stop = Motion.inView(this, (info) => {
      this.showImages();
    });
  }

  showImages() {
    this.classList.add('loaded');
  }
}

customElements.define('use-animate', UseAnimate);

class ToastMessageManager extends HTMLElement {
  constructor() {
    super();
  }

  pushMessage(content, type) {
    var toast = document.createElement('toast-message');
    toast.setContent(content, type);
    this.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('open');
    }, 300);
  }
}

customElements.define('toast-message-manager', ToastMessageManager);

class ToastMessage extends HTMLElement
{
  constructor() {
    super();
    this.waitToCloseTimeout = setTimeout(() => {
      this.close();
    }, 3300);
  }

  connectedCallback() {
    this.appendCloseButton();
  }

  setContent(str, type) {
    this.appendChild(document.createElement('div'));
    this.contentWrapper = this.querySelector('div');
    this.contentWrapper.classList.add('alert');
    this.contentWrapper.textContent = str;
    this.contentWrapper.classList.add(`alert--${type}`);
  }
 
  close() {
    this.classList.remove('open');
    setTimeout(() => {
      this.remove();
    }, 300);
  }

  appendCloseButton() {
    const button = document.createElement('button');
    button.setAttribute('type', 'button');
    button.classList.add('toast__button', 'color-foreground');
    const icon = document.querySelector('.icon-close-sample').cloneNode(true);
    icon.classList.remove('hidden');
    button.appendChild(icon);
    this.onButtonClickHandler = this.onButtonClick.bind(this);
    button.addEventListener('click', this.onButtonClickHandler);
    this.contentWrapper.appendChild(button);
  }

  onButtonClick() {
    if(this.waitToCloseTimeout) {
      clearTimeout(this.waitToCloseTimeout);
    }
    this.close();
  }
}

customElements.define('toast-message', ToastMessage);

function pushMessage(content, type) {
  document.querySelector('toast-message-manager').pushMessage(content, type);
}

function pushSuccessMessage(content) {
  pushMessage(content, 'success');
}

function pushErrorMessage(content) {
  pushMessage(content, 'error');
}