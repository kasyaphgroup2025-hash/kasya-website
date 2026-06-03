class FooterCollapseBlock extends HTMLElement
{
  constructor() {
    super();

    this.working = false;
    this.link = this.querySelector('.footer-block__collapse-link');
    this.content = this.querySelector('.footer-block__details-content');
    this.stickyHeader = document.querySelector('sticky-header');

    this.link.addEventListener('click', this.onLinkClick.bind(this));
  }

  onLinkClick(event) {
    event.preventDefault();
    if (this.working || window.innerWidth >= 750) return;
    this.working = true;
    this.classList.add('overflow-hidden');
    if(this.stickyHeader) {
      this.stickyHeader.dispatchEvent(new Event('preventHeaderReveal'));
    }
    this.hasAttribute('open')
      ? this.close()
      : this.open();
  }

  open() {
    this.setAttribute('open', true);
    window.requestAnimationFrame(() => this.expand());
  }

  expand() {
    const startHeightNumber = this.getElementLinkHeight();
    const startHeight = `${startHeightNumber}px`;
    this.style.height = startHeight;
    const endHeight = `${startHeightNumber + this.content.offsetHeight}px`;
    this.runAnimation(startHeight, endHeight, true);
  }

  close() {
    window.requestAnimationFrame(() => this.collapse());
  }

  collapse() {
    const startHeight = `${this.offsetHeight}px`;
    const endHeight = `${this.getElementLinkHeight()}px`;
    this.runAnimation(startHeight, endHeight, false);
  }

  runAnimation(startHeight, endHeight, isOpening) {
    this.animation = this.animate({
      height: [startHeight, endHeight]
    }, {
      duration: 400,
      easing: 'ease-out'
    });
    this.animation.onfinish = () => this.onAnimationFinish(isOpening);
  }

  onAnimationFinish(isOpening) {
    this.animation = null;
    this.working = false;
    this.style.height = '';
    this.classList.remove('overflow-hidden');
    if(!isOpening) {
      this.removeAttribute('open');
    }
  }

  getElementLinkHeight() {
    const style = getComputedStyle(this.link.parentElement);
    let total = this.link.offsetHeight + parseInt(style.marginTop) + parseInt(style.marginBottom);
    if(this.querySelector('.footer__logo')) {
      total += this.querySelector('.footer__logo').offsetHeight;
    }
    return total;
  }
}

customElements.define('footer-collapse-block', FooterCollapseBlock);