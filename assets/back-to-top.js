class BackToTop extends HTMLElement
{
  constructor() {
		super();
	}

	connectedCallback() {
		this.isAppear = false;
		this.threshold = 50;
		this.currentScrollTop = 0;
		this.onScrollHandler = this.onScroll.bind(this);
		window.addEventListener('scroll', this.onScrollHandler, false);

		this.onButtonClickHandler = this.onButtonClick.bind(this);
		this.querySelector('button').addEventListener('click', this.onButtonClickHandler);
	}

	onScroll() {
		const scrollTop = document.documentElement.scrollTop;
		if (scrollTop > this.threshold && scrollTop < this.currentScrollTop) {
			if(!this.isAppear) {
				this.appear();	
			}
		} else {
			if(this.isAppear) {
				this.hide();
			}
		}
		this.currentScrollTop = scrollTop;
	}

	onButtonClick(event) {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	appear() {
		this.classList.add('open');
		this.isAppear = true;
	}

	hide() {
		this.classList.remove('open');
		this.isAppear = false;
	}
}

customElements.define('back-to-top', BackToTop);