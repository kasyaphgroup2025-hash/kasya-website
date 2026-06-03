if (!customElements.get('gallery-lightbox')) {
  customElements.define('gallery-lightbox', class GalleryLightbox extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      loadPhotoswipeLib(() => {
        this.lightbox = new PhotoSwipeLightbox({
          gallery: this,
          children: '.gallery__item__lightbox-btn',
          // dynamic import is not supported in UMD version
          pswpModule: PhotoSwipe,
          tapAction: (pt, evt) => {
            if (evt.target.classList.contains('pswp__img')) {
                this.lightbox.pswp.next();
            } else {
                this.lightbox.pswp.close();
            }
          }
        });
        this.lightbox.init();
      });
    }

    disconnectedCallback() {
      if(this.lightbox) {
        this.lightbox.destroy();
      }
    }
  });
}