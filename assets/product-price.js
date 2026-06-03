if (!customElements.get('product-price')) {
	customElements.define('product-price', class ProductPrice extends HTMLElement {
		constructor() {
			super();
		}

		update(price, compareAtPrice, noConvert = false) {
      if(compareAtPrice > price) {
        this.classList.add('price--on-sale');
        if(!this.querySelector('.price__sale .price-item--regular')) {
          const spanPrice = document.createElement('span');
          const sPrice = document.createElement('s');
          sPrice.className = 'price-item price-item--regular light';
          spanPrice.append(sPrice);
          this.querySelector('.price__sale').prepend(spanPrice);
        }
      } else {
        this.classList.remove('price--on-sale');
      }
      const priceText = Shopify.showPrice(price, noConvert);
      const compareAtPriceText = Shopify.showPrice(compareAtPrice, noConvert);
      this.querySelectorAll('.price__regular .price-item--regular, .price-item--sale').forEach(priceTag => {
        priceTag.innerHTML = priceText;
      });

      this.querySelector('.price__sale .price-item--regular').innerHTML = compareAtPriceText;
    }
	});
}