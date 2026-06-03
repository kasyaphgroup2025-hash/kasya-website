if (!customElements.get('cart-product-recommendations')) {
	customElements.define('cart-product-recommendations', class CartProductRecommendations extends HTMLElement {
		constructor() {
			super();
      this.handleRequests = [];
		}

		update() {
      let results = [];
      let resultIds = [];
			let totalItem = 0;
      this.limit = parseInt(this.dataset.limit);
      this.classList.add('loading');
      const loading = this.querySelector('.cart__recommendation-loading');
      if(loading) {
        loading.classList.remove('hidden');
      }
      fetch(`${routes.cart_url}.js`)
      .then(response => response.json())
      .then(cart => {
        if(cart.item_count > 0) {
          const productIds = cart.items.map((item) => {
            return item.product_id;
          });
          if(productIds.length == 0) {
            this.classList.add('hidden');
            return;
          }
          this.classList.remove('hidden');
          const cartItemsLength = productIds.length;
          const limit = Math.round(parseFloat(this.limit / cartItemsLength)) + cartItemsLength - 1;
          productIds.forEach((pId, index) => {
            const url = `${this.dataset.url}?section_id=${this.dataset.sectionId}&product_id=${pId}&limit=${limit}`;
            const controller = new AbortController();
            const signal = controller.signal;
            this.handleRequests.push(controller);
            fetch(url, { signal })
              .then(response => response.text())
              .then(text => {
                const resultList = getDomHtmlFromText(text, '.item-list');
                if(resultList) {
                  resultList.querySelectorAll(this.dataset.itemSelector).forEach((item, itemIndex) => {
                    const itemId = item.dataset.productId;
                    if(!resultIds.includes(itemId)) {
                      results.push(item);
                      resultIds.push(itemId);
                    }
                  });
                }
                
                totalItem++;
                if(totalItem == cartItemsLength) {
                  this.classList.remove('loading');
                  this.renderResults(results);
                  if(!this.querySelector('.cart__recommendation-list .grid__item')) {
                    this.classList.add('hidden');
                  }
                }
              });
          });
        } else {
          this.classList.remove('loading');
        }
      });
    }

    renderResults(items) {
      if(this.querySelector('.cart__recommendation-loading')) {
        if(this.dataset.removeLoading) {
          this.querySelector('.cart__recommendation-loading').remove();
        } else {
          this.querySelector('.cart__recommendation-loading').classList.add('hidden');
        }
      }
      this.handleRequests = [];
      this.fisherYates(items);
      const finalItems = items.slice(0, this.limit);
      const list = this.querySelector('.cart__recommendation-list');
      const sliderComponent = document.createElement('slider-component');
      sliderComponent.classList.add('slider-mobile-gutter', 'por');
      this.dataset.componentClasses.split(' ').forEach((htmlClass, indexClass) => {
        sliderComponent.classList.add(htmlClass);
      });
      sliderComponent.dataset.outsidePrevButtonId = `Slider-${this.dataset.sectionId}-prev-button`;
      sliderComponent.dataset.outsideNextButtonId = `Slider-${this.dataset.sectionId}-next-button`;
      const sliderList = document.createElement('ul');
      sliderList.id = `Slider-${this.dataset.sectionId}`;
      sliderList.classList.add('grid');
      this.dataset.gridClasses.split(' ').forEach((htmlClass, indexClass) => {
        sliderList.classList.add(htmlClass);
      });
      finalItems.forEach((item, index) => {
        const sliderItem = document.createElement('li');
        sliderItem.id = `Slide-${this.dataset.sectionId}-${(index + 1)}`;
        sliderItem.classList.add('grid__item', 'slider__slide');
        sliderItem.appendChild(item);
        sliderList.appendChild(sliderItem);
      });
      sliderComponent.appendChild(sliderList);
      list.innerHTML = '';
      list.appendChild(sliderComponent);
      sliderComponent.init();
    }

    fisherYates( array ){
      var count = array.length, randomnumber, temp;
      while( count ){
        randomnumber = Math.random() * count-- | 0;
        temp = array[count];
        array[count] = array[randomnumber];
        array[randomnumber] = temp
      }
    }

    disconnectedCallback() {
      if(this.handleRequests.length > 0) {
        this.classList.remove('loading');
        this.handleRequests.forEach((controller, index) => {
          controller.abort();
        });
      }
    }
  });
}