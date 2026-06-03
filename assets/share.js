if (!customElements.get('share-button')) {
  customElements.define('share-button', class ShareButton extends HTMLElement {
    constructor() {
      super();

      this.elements = {
        shareButton: this.querySelector('button'),
        network: this.querySelector('.share-button__network'),
        linkButton: this.querySelector('.share-button__network__link--copy'),
        urlInput: this.querySelector('input')
      }
      this.urlToShare = this.elements.urlInput ? this.elements.urlInput.value : document.location.href;

      if (navigator.share) {
        this.elements.shareButton.classList.remove('large-up-hide');
        this.elements.shareButton.addEventListener('click', () => { navigator.share({ url: this.urlToShare, title: document.title }); });
        this.elements.network.classList.add('hidden');
      } else {
        this.elements.network.classList.remove('small-hide', 'medium-hide');
        if(this.elements.linkButton) {
          this.elements.linkButton.addEventListener('click', this.copyToClipboard.bind(this));
        }
        if(this.elements.network.classList.contains('share-button__network--floating')) {
          this.elements.shareButton.classList.remove('large-up-hide', 'hidden');       
          const networkList = this.elements.network.querySelectorAll('.share-button__network__link');
          this.elements.network.style.setProperty('--item-length', networkList.length);
          this.elements.shareButton.addEventListener('click', () => { this.elements.shareButton.classList.toggle('open'); });
        } else {
          this.elements.shareButton.classList.add('hidden');
        }
      }
    }

    copyToClipboard(e) {
      if(this.copyTimeout) {
        clearTimeout(this.copyTimeout);
      }
      navigator.clipboard.writeText(this.urlToShare).then(() => {
        this.elements.linkButton.querySelector('span').textContent = window.accessibilityStrings.shareSuccess;
        this.copyTimeout = setTimeout(() => {
          this.elements.linkButton.querySelector('span').textContent = window.accessibilityStrings.copyToClipboard;
        }, 5000);
      });
    }

    updateUrl(url, currentVariant = {}) {
      this.urlToShare = url;
      this.elements.urlInput.value = url;

      // Update url in social network links
      if(!navigator.share) {
        const encodeUrl = encodeURIComponent(url);
        this.querySelectorAll('a.share-button__network__link').forEach((ele) => {
          if(ele.href.includes("facebook.com")) {
            // This is the Facebook link
            const stringSplit = ele.href.split('?u=');
            ele.href = `${stringSplit[0]}?u=${encodeUrl}`;
          } else if(ele.href.includes('twitter.com')) {
            // This is the Twitter or Pinterest link
            const stringSplit = ele.href.split('&url=');
            ele.href = `${stringSplit[0]}&url=${encodeUrl}`;
          } else if (ele.href.includes('pinterest.com')) {
            const stringSplit = ele.href.split('&url=');
            let newUrl = `${stringSplit[0]}&url=${encodeUrl}`;
            if(currentVariant && currentVariant.featured_media) {
              const reg = /media=(.*?)&/g;
              const newMediaUrl = encodeURIComponent(`${currentVariant.featured_media.preview_image.src}&width=1024&height=1024&crop=center`);
              newUrl = newUrl.replace(reg, `media=${newMediaUrl}&`);
            }
            ele.href = newUrl;
          } else {
            // This is the email link
            const stringSplit = ele.href.split('&body=');
            ele.href = `${stringSplit[0]}&body=${encodeUrl}`;
          }
        });
      }
    }
  });
}
