if (!customElements.get('slideshow-component')) {
  customElements.define('slideshow-component', class SlideshowComponent extends SliderComponent {
    constructor() {
      super();
      this.itemSelector = this.dataset.itemSelector || '.slideshow__slide';
      this.ignoreResizeEvent = true;
    }

    init() {
      super.init();
      this.sliderControlWrapper = this.querySelector('.slider-buttons');
      this.enableSliderLooping = true;
      this.autoplayButtonQuerySelector = '.slideshow__autoplay';
      this.autoPlayPausedClass = 'slideshow__autoplay--paused';
  
      if (!this.sliderControlWrapper) return;
  
      if (this.sliderItemsToShow.length > 0) this.currentPage = 1;
  
      this.slider.addEventListener('scroll', this.setSlideVisibility.bind(this));
      this.setSlideVisibility();

      this.querySelectorAll('.banner__price').forEach(ele => {
        ele.innerHTML = Shopify.showPrice(ele.dataset.price * 1);
      });
    }
  
    update() {
      super.update();

      // Update active slide classes
      const oldActive = this.querySelector(`${this.itemSelector}.active`);
      if (oldActive) oldActive.classList.remove('active');
    
      const activeSlide = this.getActiveSlide();
      if (activeSlide) activeSlide.classList.add('active');
    
      // --- Animate autoplay button (visual sync) ---
      if (this.sliderAutoplayButton) {
        this.sliderAutoplayButton.classList.remove(this.autoPlayPausedClass);
        this.sliderAutoplayButton
          .querySelector('.slideshow__progress__path')
          .getAnimations()
          .forEach(anim => {
            anim.cancel();
            anim.play();
          });
      }
    }

    getActiveSlide() {
      // Defensive guard: ensure currentPage is valid
      if (!this.currentPage || isNaN(this.currentPage)) {
        // Try to reset pages if not initialized yet
        if (typeof this.initPages === 'function') {
          this.initPages();
        }
    
        // Fallback to first visible slide if still invalid
        this.currentPage = this.currentPage && !isNaN(this.currentPage)
          ? this.currentPage
          : 1;
      }
    
      // Ensure itemSelector is valid
      const selector = `${this.itemSelector}:nth-child(${this.currentPage})`;
    
      try {
        return this.querySelector(selector);
      } catch (err) {
        console.warn('⚠️ [SlideshowComponent] Invalid selector:', selector, err);
        // fallback gracefully
        return this.querySelector(this.itemSelector);
      }
    }
  
    setSlideVisibility() {
      const activeElement = document.activeElement;
      const activeIndex = this.currentPage ? this.currentPage - 1 : 0;

      this.sliderItemsToShow.forEach((item, index) => {
        const linkElements = item.querySelectorAll('a');
        const isActive = index === activeIndex;

        // If a focused element is inside a slide that is about to be hidden,
        // move focus somewhere safe before toggling aria-hidden.
        if (!isActive && activeElement && item.contains(activeElement)) {
          const activeSlide = this.sliderItemsToShow[activeIndex];

          // Prefer a focusable element inside the active slide
          let focusTarget =
            activeSlide &&
            activeSlide.querySelector(
              'a[href], button, [role="button"], [tabindex]:not([tabindex="-1"])'
            );

          // Fallback: use an active dot or navigation button
          if (!focusTarget) {
            focusTarget =
              this.querySelector('.slider-counter__link[aria-current="true"]') ||
              this.querySelector('.slider-button--next, .slider-button--prev') ||
              this; // as a last resort, focus slider container
          }

          if (focusTarget && typeof focusTarget.focus === 'function') {
            focusTarget.focus();
          } else if (typeof activeElement.blur === 'function') {
            activeElement.blur();
          }
        }

        if (isActive) {
          if (linkElements.length) {
            linkElements.forEach((button) => {
              button.removeAttribute('tabindex');
            });
          }
          item.setAttribute('aria-hidden', 'false');
          item.removeAttribute('tabindex');
        } else {
          if (linkElements.length) {
            linkElements.forEach((button) => {
              button.setAttribute('tabindex', '-1');
            });
          }
          item.setAttribute('aria-hidden', 'true');
          item.setAttribute('tabindex', '-1');
        }
      });
    }
  
    play() {
      super.play();
      this.playVideo();
      this.runAutoplayButton();
    }

    playVideo() {
      // --- Cleanup old video event listeners ---
      if (this._videoListeners?.length) {
        this._videoListeners.forEach(({ el, type, handler }) => {
          el.removeEventListener(type, handler);
        });
      }
      this._videoListeners = [];

      this.querySelectorAll('deferred-media').forEach(dm => {
        // Pause all other DeferredMedia when slide changes
        if (window.customElements?.get('deferred-media')) {
          try {
            customElements.upgrade(dm);
            dm.pause();
          } catch (e) {
            // Ignore DOM upgrade race conditions
          }
        }
      });
    
      if (this.prevButton) this.prevButton.removeAttribute('disabled');
    
      const activeSlide = this.getActiveSlide();
      // --- Handle DeferredMedia playback ---
      const dm = activeSlide ? activeSlide.querySelector('deferred-media') : null;
    
      // Helper: update CSS --speed for autoplay button
      const setAutoplaySpeedCSS = (seconds) => {
        if (this.sliderAutoplayButton) {
          this.sliderAutoplayButton.style.setProperty('--speed', `${seconds}s`);
        }
      };
    
      if (!dm) {
        
        // No video → use default autoplay delay
        setAutoplaySpeedCSS(this.autoplaySpeed / 1000);
    
        if (this.isAutoplay && this.autoplayButtonIsSetToPlay) {
          clearTimeout(this.autoplay);
          this.autoplay = setTimeout(() => this.autoRotateSlides(), this.autoplaySpeed);
        }
        return;
      }
    
      // --- Video slide handling ---
      dm.play().then(() => {
        const getVideoEl = () => dm.deferredElement || dm.querySelector('video');
    
        const startWithDuration = () => {
          const videoEl = getVideoEl();
          if (!videoEl) return;
      
          const duration = (videoEl.duration && !isNaN(videoEl.duration)) ? videoEl.duration : 5;
          setAutoplaySpeedCSS(duration); // 🔥 update CSS --speed
      
          // Autoplay slideshow delay based on video duration
          if (this.isAutoplay && this.autoplayButtonIsSetToPlay) {
            clearTimeout(this.autoplay);
            this.autoplay = setTimeout(() => this.autoRotateSlides(), duration * 1000);
      
            // Handle early video end
            const onEnded = () => {
              clearTimeout(this.autoplay);
              this.autoRotateSlides();
            };
            videoEl.addEventListener('ended', onEnded, { once: true });
            this._videoListeners.push({ el: videoEl, type: 'ended', handler: onEnded });
          }
        };
      
        const waitForVideo = () => {
          const videoEl = getVideoEl();
          if (!videoEl) {
            requestAnimationFrame(waitForVideo);
            return;
          }
          if (isNaN(videoEl.duration) || !videoEl.duration) {
            const onLoaded = startWithDuration;
            videoEl.addEventListener('loadedmetadata', onLoaded, { once: true });
            this._videoListeners.push({ el: videoEl, type: 'loadedmetadata', handler: onLoaded });
          } else {
            startWithDuration();
          }
        };
      
        waitForVideo();
      });
    }

    pause() {
      super.pause();
      this.runAutoplayButton(false);
      const activeSlide = this.getActiveSlide();
      const dm = activeSlide ? activeSlide.querySelector('deferred-media') : null;
      if(dm) {
        dm.pause();
      }
    }

    runAutoplayButton(play = true) {
      if(this.sliderAutoplayButton) {
        this.sliderAutoplayButton.classList.toggle(this.autoPlayPausedClass, !play);
        this.sliderAutoplayButton.querySelector('.slideshow__progress__path').getAnimations().forEach((anim) => {
          if(play) {
            anim.cancel();
            anim.play();
          } else {
            anim.pause();
          }
        });
      }
    }

    beforeUpdateAutoplay() {
      if(this.sliderAutoplayButton) {
        this.sliderAutoplayButton.querySelector('.slideshow__progress__path').getAnimations().forEach((anim) => {
          anim.pause();
        });
      }
    }
  });
}