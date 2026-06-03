if (!customElements.get('details-accordion')) {
  customElements.define('details-accordion', class DetailsAccordion extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      this.init();
    }

    init() {
      // Store the <details> element
      this.el = this.querySelector('details');
      // Store the <summary> element
      this.summary = this.querySelector('summary');
      // Store the <div class="content"> element
      this.content = this.summary.nextElementSibling;
  
      // Store the animation object (so we can cancel it if needed)
      this.animation = null;
      // Store if the element is closing
      this.isClosing = false;
      // Store if the element is expanding
      this.isExpanding = false;
      // Detect user clicks on the summary element

      if(!this.dataset.ignoreSetupEvent) {
        this.setupEventListener();
      }
    }

    setupEventListener() {
      this.onClickSummaryHandler = this.onClick.bind(this);
      this.summary.addEventListener('click', this.onClickSummaryHandler);
    }
  
    onClick(e) {
      // Stop default behaviour from the browser
      e.preventDefault();
      
      this.toggleContent();
    }

    toggleContent() {
      // Add an overflow on the <details> to avoid content overflowing
      this.el.style.overflow = 'hidden';
      // Check if the element is being closed or is already closed
      if (this.isClosing || !this.el.open) {
        this.open();
      // Check if the element is being openned or is already open
      } else if (this.isExpanding || this.el.open) {
        this.shrink();
      }
      if(this.dataset.ignoreSetupEvent) {
        return false;
      }
    }

    disconnectedCallback() {
      this.summary.removeEventListener('click', this.onClickSummaryHandler);
    }
  
    shrink() {
      if(this.dataset.ignoreSetupEvent) {
        this.querySelector('summary').setAttribute('aria-expanded', false);
      } else {
        this.summary.setAttribute('aria-expanded', false);
      }
      // Set the element as "being closed"
      this.isClosing = true;
      
      // Store the current height of the element
      const startHeight = `${this.el.offsetHeight}px`;
      // Calculate the height of the summary
      let endHeight;
      if(this.dataset.ignoreSetupEvent) {
        endHeight = `${this.querySelector('summary').offsetHeight}px`;
      } else {
        endHeight = `${this.summary.offsetHeight}px`;
      }
      
      // If there is already an animation running
      if (this.animation) {
        // Cancel the current animation
        this.animation.cancel();
      }
      // Start a WAAPI animation
      this.animation = this.el.animate({
        // Set the keyframes from the startHeight to endHeight
        height: [startHeight, endHeight]
      }, {
        duration: 400,
        easing: 'ease-out'
      });
      
      // When the animation is complete, call onAnimationFinish()
      this.animation.onfinish = () => this.onAnimationFinish(false);
      // If the animation is cancelled, isClosing variable is set to false
      this.animation.oncancel = () => this.isClosing = false;
    }
  
    open() {
      // Apply a fixed height on the element
      this.el.style.height = `${this.el.offsetHeight}px`;
      // Force the [open] attribute on the details element
      this.el.open = true;
      // Wait for the next frame to call the expand function
      window.requestAnimationFrame(() => this.expand());
    }
  
    expand() {
      // Set the element as "being expanding"
      this.isExpanding = true;
      // Get the current fixed height of the element
      const startHeight = `${this.el.offsetHeight}px`;
      // Calculate the open height of the element (summary height + content height)
      let endHeight;
      if(this.dataset.ignoreSetupEvent) {
        this.querySelector('summary').setAttribute('aria-expanded', true);
        endHeight = `${this.querySelector('summary').offsetHeight + this.querySelector('summary').nextElementSibling.offsetHeight}px`;
      } else {
        this.summary.setAttribute('aria-expanded', true);
        endHeight = `${this.summary.offsetHeight + this.summary.nextElementSibling.offsetHeight}px`;
      }
      
      // If there is already an animation running
      if (this.animation) {
        // Cancel the current animation
        this.animation.cancel();
      }
      
      // Start a WAAPI animation
      this.animation = this.el.animate({
        // Set the keyframes from the startHeight to endHeight
        height: [startHeight, endHeight]
      }, {
        duration: 400,
        easing: 'ease-out'
      });
      // When the animation is complete, call onAnimationFinish()
      this.animation.onfinish = () => this.onAnimationFinish(true);
      // If the animation is cancelled, isExpanding variable is set to false
      this.animation.oncancel = () => this.isExpanding = false;
    }
  
    onAnimationFinish(open) {
      // Set the open attribute based on the parameter
      this.el.open = open;
      // Clear the stored animation
      this.animation = null;
      // Reset isClosing & isExpanding
      this.isClosing = false;
      this.isExpanding = false;
      // Remove the overflow hidden and the fixed height
      this.el.style.height = this.el.style.overflow = '';
    }
  });
}