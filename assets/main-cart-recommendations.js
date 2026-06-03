if (!customElements.get('main-cart-recommendations')) {
	customElements.define('main-cart-recommendations', class MainCartRecommendations extends HTMLElement {
		constructor() {
			super();
      this.handleRequests = [];
      this.productRecommendation = this.querySelector('cart-product-recommendations');
      if(this.productRecommendation && !this.classList.contains('empty')) {
        this.productRecommendation.update();
      }

      // this.cartItems = document.querySelector('cart-items');
      // if(this.cartItems) {
      //   this.cartItems.addEventListener('afterUpdateQuantity', () => {
      //     this.update();
      //   });
      // }
		}

		update() {
      fetch(`${routes.cart_url}.js`)
      .then(response => response.json())
      .then(cart => {
        if(cart.item_count > 0) {
          if(this.productRecommendation) {
            this.productRecommendation.classList.remove('hidden');
            const productIds = cart.items.map((item) => {
              return item.product_id;
            });
            this.productRecommendation.dataset.productIds = productIds;
            this.productRecommendation.update();
            this.classList.remove('hidden');
          }
        } else {
          if(this.productRecommendation) {
            this.productRecommendation.classList.add('loading');
          }
          fetch(`${routes.cart_url}?section_id=${this.dataset.sectionId}`)
          .then(response => response.text())
          .then(text => {
            this.productRecommendation.classList.add('hidden');
            const html = parseHtml(text);
            const newWrapper = html.querySelector('main-cart-recommendations');
            this.classList.toggle('hidden', newWrapper.classList.contains('hidden'));
            const cartEmptyRecommendation = html.querySelector('.cart__empty-recommendation');
            if(cartEmptyRecommendation) {
              this.appendChild(cartEmptyRecommendation);
            }
          });
        }
      });
    }
  });
}