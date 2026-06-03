class CookiesBanner extends HTMLElement
{
	constructor() {
		super();

		this.initCookieBanner();
		this.attactEvents = false;
	}

	disconnectedCallback() {
		this.removeEvents();
	}

	initCookieBanner() {
		const userCanBeTracked = window.Shopify.customerPrivacy.userCanBeTracked();
		const userTrackingConsent = window.Shopify.customerPrivacy.getTrackingConsent();
		
		if(!userCanBeTracked && userTrackingConsent === 'no_interaction') {
			this.showBanner();
		}
	}

	removeEvents() {
		const acceptButton = this.querySelector('.cookies-banner__button--accept');
		const declineButton = this.querySelector('.cookies-banner__button--decline');
		
		if(acceptButton) {
			acceptButton.removeEventListener('click', this.onAcceptHandler);
		}

		if(declineButton) {
			declineButton.removeEventListener('click', this.onDeclineHandler);
		}
	}

	hideBanner(removeEvent = true) {
		this.classList.remove('open');
		if(removeEvent && !Shopify.designMode) {
			this.removeEvents();
		}
	}

	showBanner() {
		if(Shopify.designMode) {
			this.afterShowBanner();
		} else {
			fetch(window.Shopify.routes.root + '?section_id=cookies-banner&view=ajax')
				.then((response) => response.text())
				.then((responseText) => {
					const cookiesBannerInner = getDomHtmlFromText(responseText, '.cookies-banner__inner');
					this.appendChild(cookiesBannerInner);
					this.afterShowBanner();
				});
		}
	}

	openBanner() {
		this.classList.add('open');
	}

	afterShowBanner() {
		this.openBanner();
		if(!this.attactEvents) {
			this.onAcceptHandler = this.onAccept.bind(this);
			this.onDeclineHandler = this.onDecline.bind(this);
			this.querySelector('.cookies-banner__button--accept').addEventListener('click', this.onAcceptHandler);
			this.querySelector('.cookies-banner__button--decline').addEventListener('click', this.onDeclineHandler);
			this.attactEvents = true;
		}
	}

	onAccept(e) {
		window.Shopify.customerPrivacy.setTrackingConsent(true, this.hideBanner.bind(this));
	}

	onDecline() {
		window.Shopify.customerPrivacy.setTrackingConsent(false, this.hideBanner.bind(this));
	}
}

window.Shopify.loadFeatures(
	[
		{
			name: 'consent-tracking-api',
			version: '0.1',
		}
	],
	function(error) {
		if (error) {
			throw error;
		}

		customElements.define('cookies-banner', CookiesBanner);
	}
);