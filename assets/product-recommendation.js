if (!customElements.get('product-recommendations')) {
	customElements.define('product-recommendations', class ProductRecommendations extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      const handleIntersection = (entries, observer) => {
        if (!entries[0].isIntersecting) return;
        observer.unobserve(this);

        fetch(this.dataset.url)
          .then(response => response.text())
          .then(text => {
            const html = document.createElement('div');
            html.innerHTML = text;
            const recommendations = html.querySelector('product-recommendations');

            if (recommendations && recommendations.innerHTML.trim().length) {
              this.innerHTML = recommendations.innerHTML;
            }

            if (html.querySelector('.recommendation-list')) {
              this.classList.add('product-recommendations--loaded');
            } else {
              this.classList.add('hidden');
            }
          })
          .catch(e => {
            console.error(e);
            this.classList.add('hidden');
          });
      }

      new IntersectionObserver(handleIntersection.bind(this), {rootMargin: '0px 0px 400px 0px'}).observe(this);
    }
  });
}