if (!customElements.get('media-gallery')) {
  class ProductThumbnailVerticalSliderComponent extends SliderComponent {
    constructor() {
      super();
      this.isDragging = false;
      this.dragMoved = false;
      this._freezeScrollHandlers = false;
      this._suppressProgrammaticUntil = 0;
    }
  
    initPages() {
      this.isMobile = window.innerWidth < 750;
      if (this.isMobile) {
        super.initPages();
      } else {
        this.sliderItemsToShow = Array.from(this.sliderItems).filter(el => el.clientHeight > 0);
        if (this.sliderItemsToShow.length < 2) return;
        this.sliderItemOffset =
          this.sliderItemsToShow[1].offsetTop - this.sliderItemsToShow[0].offsetTop;
        this.slidesPerPage = Math.floor(
          (this.slider.clientHeight - this.sliderItemsToShow[0].offsetTop) / this.sliderItemOffset
        );
        this.totalPages = this.sliderItemsToShow.length - this.slidesPerPage + 1;
  
        this.update();
      }
    }

    updateFromScroll() {
      if (!this.sliderItemOffset || !this.totalPages) return;

      const newPage = Math.round(this.slider.scrollTop / this.sliderItemOffset) + 1;
      const clampedPage = Math.max(1, Math.min(newPage, this.totalPages));

      // 🔑 Important: If the page index does not change, do nothing
      if (clampedPage === this.currentPage) return;
      this.update();
    }
  
    update() {
      if (this._freezeScrollHandlers) return; // 👈 tránh giật khi đang animate
  
      if (this.isMobile) {
        super.update();
      } else {
        const prevPage = this.currentPage;
        this.currentPage = Math.round(this.slider.scrollTop / this.sliderItemOffset) + 1;
  
        if (this.currentPageElement && this.pageTotalElement) {
          this.currentPageElement.textContent = this.currentPage;
          this.pageTotalElement.textContent = this.totalPages;
        }
  
        if (this.currentPage !== prevPage) {
          this.dispatchEvent(
            new CustomEvent('slideChanged', {
              detail: {
                currentPage: this.currentPage,
                currentElement: this.sliderItemsToShow[this.currentPage - 1],
              },
            })
          );
        }
  
        if (this.enableSliderLooping) return;
  
        if (this.isSlideVisible(this.sliderItemsToShow[0]) && this.slider.scrollTop < 3) {
          this.prevButton.setAttribute('disabled', 'disabled');
        } else {
          this.prevButton.removeAttribute('disabled');
        }
  
        if (this.isSlideVisible(this.sliderItemsToShow.at(-1))) {
          this.nextButton.setAttribute('disabled', 'disabled');
        } else {
          this.nextButton.removeAttribute('disabled');
        }
      }
    }
  
    isSlideVisible(element, offset = 0) {
      if (this.isMobile) return super.isSlideVisible(element, offset);
      const lastVisible = this.slider.clientHeight + this.slider.scrollTop - offset;
      return (
        element.offsetTop + element.clientHeight <= lastVisible &&
        element.offsetTop >= this.slider.scrollTop
      );
    }
  
    onButtonClick(event) {
      if (this.isMobile) {
        super.onButtonClick(event);
      } else {
        event.preventDefault();
        const step = event.currentTarget.dataset.step || 1;
        const delta =
          event.currentTarget.name === 'next'
            ? step * this.sliderItemOffset
            : -step * this.sliderItemOffset;
        this.slider.scrollTo({ top: this.slider.scrollTop + delta, behavior: 'smooth' });
      }
    }

    enableMouseDrag() {
      super.enableMouseDrag();
      this.slider.querySelectorAll('button').forEach(el => el.setAttribute('draggable', 'false'));
    }
  
    onDragStart(e) {
      if (e.button !== 0) return;
      this.isDragging = true;
      this.dragMoved = false;
      this.startY = e.pageY;
      this.scrollStart = this.slider.scrollTop;
      this.slider.classList.add('is-dragging');
      this._suppressProgrammaticUntil = Number.POSITIVE_INFINITY;
    }
  
    onDragMove(e) {
      if (!this.isDragging) return;
      const deltaY = e.pageY - this.startY;
      if (Math.abs(deltaY) > 5) {
        if (!this.dragMoved) {
          this.dragMoved = true;
          this.slider.querySelectorAll('a').forEach(a => (a.style.pointerEvents = 'none'));
        }
        e.preventDefault();
        this.slider.scrollTop = this.scrollStart - deltaY;
      }
    }
  
    onDragEnd() {
      if (!this.isDragging) return;

      this.isDragging = false;
      this.slider.querySelectorAll('a').forEach(a => (a.style.pointerEvents = ''));

      if (!this.dragMoved) {
        this._suppressProgrammaticUntil = performance.now() + 200;
        return;
      }

      const slider = this.slider;
      const maxScroll = slider.scrollHeight - slider.clientHeight;

      let finalScroll = slider.scrollTop;

      const distanceToBottom = maxScroll - finalScroll;
      const SNAP_THRESHOLD = this.sliderItemOffset ? this.sliderItemOffset * 0.6 : 30;

      if (distanceToBottom > 0 && distanceToBottom < SNAP_THRESHOLD) {
        finalScroll = maxScroll;
      }

      this._freezeScrollHandlers = true;

      this.animateScrollToVertical(finalScroll, 250, 'easeOutQuad', () => {
        this._freezeScrollHandlers = false;
        this._suppressProgrammaticUntil = performance.now() + 200;
        this.slider.classList.remove('is-dragging');
      });
    }
    
    animateScrollToVertical(target, duration = 400, easing = 'easeOutQuad', onComplete) {
      const start = this.slider.scrollTop;
      const distance = target - start;
      const startTime = performance.now();
    
      const easingFunctions = {
        easeOutQuad: t => t * (2 - t),
        easeOutCubic: t => 1 - Math.pow(1 - t, 3),
        easeOutQuart: t => 1 - Math.pow(1 - t, 4),
      };
      const ease = easingFunctions[easing] || easingFunctions.easeOutCubic;
    
      const step = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = ease(progress);
        this.slider.scrollTop = start + distance * eased;
    
        if (elapsed < duration) {
          requestAnimationFrame(step);
        } else {
          this.slider.scrollTop = target; // ensure end position
          if (onComplete) onComplete();
        }
      };
    
      requestAnimationFrame(step);
    }
  }
  customElements.define('product-thumbnail-vertical-slider-component', ProductThumbnailVerticalSliderComponent);
  
  customElements.define('media-gallery', class MediaGallery extends HTMLElement {
    constructor() {
      super();
      this.elements = {
        liveRegion: this.querySelector('[id^="GalleryStatus"]'),
        viewer: this.querySelector('[id^="GalleryViewer"]'),
        thumbnails: this.querySelector('[id^="GalleryThumbnails"]')
      }
      this.mql = window.matchMedia('(min-width: 750px)');
      if(!this.dataset.disableLightbox) {
        loadPhotoswipeLib(() => {
          this.lightbox = new PhotoSwipeLightbox({
            gallery: this,
            children: '.product__modal-opener--image',
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
      if (!this.elements.thumbnails) return;

      this.elements.viewer.addEventListener('slideChanged', debounce(this.onSlideChanged.bind(this), 500));
      this.elements.thumbnails.querySelectorAll('[data-target]').forEach((mediaToSwitch) => {
        mediaToSwitch.querySelector('button').addEventListener('click', this.setActiveMedia.bind(this, mediaToSwitch.dataset.target, false));
      });
      if (this.dataset.desktopLayout.includes('thumbnail') && this.mql.matches) this.removeListSemantic();
    }

    connectedCallback() {
      updateProductMediaStatus(this);
    }

    disconnectedCallback() {
      if(this.lightbox) {
        this.lightbox.destroy();
      }
    }

    onSlideChanged(event) {
      const thumbnail = this.elements.thumbnails.querySelector(`[data-target="${ event.detail.currentElement.dataset.mediaId }"]`);
      this.setActiveThumbnail(thumbnail);
    }

    setActiveMedia(mediaId, prepend, allowScrollIntoView = true) {
      const activeMedia =
          this.elements.viewer.querySelector(`[data-media-id="${mediaId}"]`) ||
          this.elements.viewer.querySelector('[data-media-id]');
        if (!activeMedia) {
          return;
        }
      this.elements.viewer.querySelectorAll('[data-media-id]').forEach((element) => {
        element.classList.remove('is-active');
      });
      activeMedia.classList.add('is-active');

      if (prepend) {
        activeMedia.parentElement.prepend(activeMedia);
        if (this.elements.thumbnails) {
          const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${mediaId}"]`);
          if(!activeThumbnail) {
            return;
          }
          activeThumbnail.parentElement.prepend(activeThumbnail);
        }
        if (this.elements.viewer.slider) {
          this.elements.viewer._suspendUpdates(() => {
            this.elements.viewer.resetPages();
            this.elements.viewer.slider.scrollTo({ left: 0 });
          });
        }
      }

      this.preventStickyHeader();
      
      window.setTimeout(() => {
        if (this.elements.thumbnails) {
          activeMedia.parentElement.scrollTo({ left: activeMedia.offsetLeft });
        }
        if (allowScrollIntoView && ((this.dataset.desktopLayout === "stacked" &&
        window.innerWidth >= 750) ||
        (this.dataset.scrollUpMobile && window.innerWidth < 750))) {
          activeMedia.scrollIntoView({behavior: 'smooth'});
        }
      });
      // this.playActiveMedia(activeMedia, true);

      if (!this.elements.thumbnails) return;
      const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${ mediaId }"]`);
      this.setActiveThumbnail(activeThumbnail);
      this.announceLiveRegion(activeMedia, activeThumbnail.dataset.mediaPosition);
    }

    setActiveThumbnail(thumbnail) {
      if (!this.elements.thumbnails || !thumbnail) return;

      this.elements.thumbnails.querySelectorAll('button').forEach((element) => element.removeAttribute('aria-current'));
      thumbnail.querySelector('button').setAttribute('aria-current', true);
      if (this.elements.thumbnails.isSlideVisible(thumbnail)) return;

      if(this.elements.thumbnails.slider.classList.contains('thumbnail-list--vertical') && window.innerWidth >= 750) {
        this.elements.thumbnails.slider.scrollTo({ top: thumbnail.offsetTop });
      } else {
        this.elements.thumbnails.slider.scrollTo({ left: thumbnail.offsetLeft });
      }
    }

    announceLiveRegion(activeItem, position) {
      const image = activeItem.querySelector('.product__modal-opener--image img');
      if (!image) return;
      image.onload = () => {
        this.elements.liveRegion.setAttribute('aria-hidden', false);
        this.elements.liveRegion.innerHTML = window.accessibilityStrings.imageAvailable.replace(
          '[index]',
          position
        );
        setTimeout(() => {
          this.elements.liveRegion.setAttribute('aria-hidden', true);
        }, 2000);
        addLoadedImageStatus(image);
      };
      image.src = image.src;
    }

    playActiveMedia(activeItem) {
      window.pauseAllMedia(document, false);
      const deferredMedia = activeItem.querySelector('.deferred-media');
      if (deferredMedia) deferredMedia.loadContent(false, true);
    }

    preventStickyHeader() {
      this.stickyHeader = this.stickyHeader || document.querySelector('sticky-header');
      if (!this.stickyHeader) return;
      this.stickyHeader.dispatchEvent(new Event('preventHeaderReveal'));
    }

    removeListSemantic() {
      if (!this.elements.viewer.slider) return;
      this.elements.viewer.slider.setAttribute('role', 'presentation');
      this.elements.viewer.sliderItems.forEach(slide => slide.setAttribute('role', 'presentation'));
    }
  });
}
