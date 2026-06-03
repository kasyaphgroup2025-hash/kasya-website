if (!customElements.get('parallax-element')) {
  class ParallaxElement extends HTMLElement {
    constructor() {
      super();
    }
  
    connectedCallback() {
      this.initParallax();
    }

    initParallax() {
      if(this.dataset.turnOff) return;
      this.parallaxEle = this.querySelector('.parallax-ele') || this.querySelector('img');
      this.speed = parseFloat(this.dataset.speed);
      this.scale = 1 + this.speed;
      const translate = this.speed * 100 / (1 + this.speed);
      Motion.scroll(
        Motion.animate(this.parallaxEle, { transform: [`scale(${this.scale}) translateY(0)`, `scale(${this.scale}) translateY(${translate}%)`], transformOrigin: ['bottom', 'bottom'] }, { easing: 'linear' }),
        { target: this, offset: ['start end', 'end start'] }
      );
    }
  };
  
  customElements.define('parallax-element', ParallaxElement);
}