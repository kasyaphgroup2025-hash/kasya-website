if (!customElements.get('video-reel')) {
  customElements.define('video-reel', class VideoReel extends HTMLElement {
    constructor() {
      super();
      this._onMouseEnterHandler = this._onMouseEnter.bind(this);
      this._onMouseLeaveHandler = this._onMouseLeave.bind(this);
      this._loadedContent = false;
    }
  
    connectedCallback() {
      this.deferredMedia = this.querySelector('deferred-media');
      if (!this.deferredMedia || this.dataset.ignoreHover) return;
      this.addEventListener('mouseenter', this._onMouseEnterHandler);
      this.addEventListener('mouseleave', this._onMouseLeaveHandler);
    }
  
    disconnectedCallback() {
      if (!this.deferredMedia || this.dataset.ignoreHover) return;
      this.removeEventListener('mouseenter', this._onMouseEnterHandler);
      this.removeEventListener('mouseleave', this._onMouseLeaveHandler);
    }
  
    _onMouseEnter() {
      if (this.deferredMedia) {
        this.deferredMedia.loadContent(false, true);
      }
    }
  
    _onMouseLeave() {
      if (this.deferredMedia) {
        this.deferredMedia.pause();
      }
    }
  });
}

if (!customElements.get('shoppable-reels')) {
  customElements.define('shoppable-reels', class ShoppableReels extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      this.popup = document.getElementById('shoppable-reels-popup');
      this.reels = Array.from(this.querySelectorAll('video-reel[data-has-video]'));

      this._handlers = {
        openPopup: (i) => (e) => {
          if (e.target.closest('.reel-item-product')) {
            return;
          }
          const currentDm = e.target.closest('deferred-media');
          this.reels.forEach((reel) => {
            const dm = reel.deferredMedia;
            if(dm && (dm.isPlaying || dm == currentDm)) {
              reel.classList.add('wait-for-playing');
              dm.pause();
            }
          });
          
          this.popup.open(this.reels, i, this.dataset.position, (this.dataset.isFullscreen !== undefined), parseInt(this.dataset.floatingPopupSize), this.dataset.floatingPopupSizeLevel, this.dataset.productCardsInPopup === "overlay", currentDm);
        }
      };

      this.reels.forEach((reel, i) => {
        reel.parentNode.dataset.index = i;
        reel.addEventListener('click', this._handlers.openPopup(i));
      });
    }

    disconnectedCallback() {
      this.reels.forEach((reel, i) => {
        reel.removeEventListener('click', this._handlers.openPopup(i));
      });
    }

    playWaitingVideo() {
      this.reels.forEach((reel, i) => {
        if(reel.classList.contains('wait-for-playing')) {
          reel.classList.remove('wait-for-playing');
          const dm = reel.querySelector('deferred-media');
          dm.play();
        }
      });
    }
  });
}

if (!customElements.get('shoppable-reels-popup')) {
  customElements.define('shoppable-reels-popup', class ShoppableReelsPopup extends HTMLElement {
    constructor() {
      super();

      // --- state ---
      this._viewingDrawer = false;
      this.currentIndex   = 0;
      this.scrollOffset   = 0;
      this.total = 0;

      // scroll + snap
      this.wheelActive    = false;
      this.touchActive    = false;
      this.mouseActive    = false;   // ✅ new: mouse drag
      this.isSnapping     = false;
      this.snapTimer      = null;
      this._snapReleaseTimer = null;

      // tuning
      this.WHEEL_MULTIPLIER = 1.0;
      this.SNAP_DEBOUNCE    = 180;
      this.SNAP_DURATION    = 700;
      this.POST_SNAP_LOCK   = 80;

      this.CAN_HOVER = window.matchMedia('(hover: hover)').matches;

      // ended listener refs
      this._currentEndedTarget = null;
      this._currentOnEnded     = null;

      this.fullscreenClass = 'reels-popup--fullscreen';
      this.floatingPopupSize = null;
      this.bodyFlagClass = 'open-reels-popup';

      // --- Add near your constructor fields ---
      /** Keep MutationObservers for each deferred-media to attach ended later */
      this._endedObservers = new Map();

      // bind handlers
      this._handlers = {
        close:  () => this.close(),
        next:   () => {
          if(this.currentIndex + 1 >= this.total) return;
          this.snapTo(this.currentIndex + 1);
        },
        prev:   () => {
          if(this.currentIndex - 1 < 0) return;
          this.snapTo(this.currentIndex - 1);
        },
        keydown:(e) => this.handleKeydown(e),
        wheel:  (e) => this.handleWheel(e),
        touchStart: (e) => this.onTouchStart(e),
        touchMove:  (e) => this.onTouchMove(e),
        touchEnd:   () => this.onTouchEnd(),
        expand: () => this.expand(),
        collapse: () => this.collapse(),
        // ✅ mouse drag handlers
        mouseDown: (e) => this.onMouseDown(e),
        mouseMove: (e) => this.onMouseMove(e),
        mouseUp:   () => this.onMouseUp(),
        mute: () => this.toggleMute(),
        drawerClosed: () => this.setViewingDrawer(false),
        transitionEnd: (e) => this.onSnapEnd(e),
        focusin: (e) => this.onFocusIn(e),
        hoverIn: () => this.onHoverIn(),
        hoverOut: () => this.onHoverOut(),
        resize: throttle(() => {
          if (!this.popup?.classList.contains('open')) return;
          this.goToCurrentItem(false);
        }, 150),
      };
    }

    connectedCallback() {
      this.popup    = this.querySelector('.reels-popup');
      this.track    = this.popup?.querySelector('.reels-track');
      this.closeBtn = this.popup?.querySelector('.popup-close');
      this.overlay = this.popup?.querySelector('.reels-popup__overlay');
      this.prevBtn  = this.popup?.querySelector('.reels-prev');
      this.nextBtn  = this.popup?.querySelector('.reels-next');
      this.expandBtn  = this.popup?.querySelector('.reels-expand');
      this.collapseBtn  = this.popup?.querySelector('.reels-collapse');
      this.muteBtn = this.popup?.querySelector('.reels-mute');

      if (!this._popupInited) {
        if (this.track) {
          this.track.style.willChange = 'transform';
          this.track.style.transitionProperty = 'transform';
          this.track.style.transitionTimingFunction = 'ease';
          this.track.style.transitionDuration = '0ms';
        }

        this.closeBtn?.addEventListener('click', this._handlers.close);
        this.overlay?.addEventListener('click', this._handlers.close);
        this.prevBtn?.addEventListener('click', this._handlers.prev);
        this.nextBtn?.addEventListener('click', this._handlers.next);
        this.expandBtn?.addEventListener('click', this._handlers.expand);
        this.collapseBtn?.addEventListener('click', this._handlers.collapse);
        this.muteBtn?.addEventListener('click', this._handlers.mute);

        document.addEventListener('keydown', this._handlers.keydown);
        this.popup?.addEventListener('wheel', this._handlers.wheel, { passive: false });

        this._hasTouch = (
          'ontouchstart' in window ||
          navigator.maxTouchPoints > 0 ||
          navigator.msMaxTouchPoints > 0
        );

        if (this._hasTouch) {
          this.track?.addEventListener('touchstart', this._handlers.touchStart, { passive: true });
          this.track?.addEventListener('touchmove',  this._handlers.touchMove,  { passive: true });
          this.track?.addEventListener('touchend',   this._handlers.touchEnd,   { passive: true });
        }

        // ✅ mouse drag
        this.track?.addEventListener('mousedown', this._handlers.mouseDown);
        document.addEventListener('mousemove', this._handlers.mouseMove);
        document.addEventListener('mouseup', this._handlers.mouseUp);

        this.track?.addEventListener('transitionend', this._handlers.transitionEnd);

        document.body.addEventListener('drawerClosed', this._handlers.drawerClosed);

        this._popupInited = true;
      }

      this.popup?.addEventListener('focusin', this._handlers.focusin);
      
      if (this.CAN_HOVER) {
        this.popup?.addEventListener('mouseenter', this._handlers.hoverIn);
        this.popup?.addEventListener('mouseleave', this._handlers.hoverOut);
      }

      window.addEventListener('resize', this._handlers.resize, { passive: true });
    }

    disconnectedCallback() {
      window.removeEventListener('resize', this._handlers.resize);

      // --- Remove popup-level listeners ---
      document.removeEventListener('keydown', this._handlers.keydown);
      this.popup?.removeEventListener('wheel', this._handlers.wheel);
      this.track?.removeEventListener('transitionend', this._handlers.transitionEnd);

      this.closeBtn?.removeEventListener('click', this._handlers.close);
      this.overlay?.removeEventListener('click', this._handlers.close);
      this.prevBtn?.removeEventListener('click', this._handlers.prev);
      this.nextBtn?.removeEventListener('click', this._handlers.next);
      this.expandBtn?.removeEventListener('click', this._handlers.expand);
      this.collapseBtn?.removeEventListener('click', this._handlers.collapse);
      this.muteBtn?.removeEventListener('click', this._handlers.mute);

      // --- Remove mouse drag handlers ---
      this.track?.removeEventListener('mousedown', this._handlers.mouseDown);
      document.removeEventListener('mousemove', this._handlers.mouseMove);
      document.removeEventListener('mouseup', this._handlers.mouseUp);

      // --- Remove custom events ---
      document.body.removeEventListener('drawerClosed', this._handlers.drawerClosed);

      this.popup?.removeEventListener('focusin', this._handlers.focusin);

      if (this._hasTouch) {
        this.track?.removeEventListener('touchstart', this._handlers.touchStart);
      this.track?.removeEventListener('touchmove', this._handlers.touchMove);
      this.track?.removeEventListener('touchend', this._handlers.touchEnd);
      }

      // --- Nullify handler refs ---
      this._handlers = null;

      this.cleanup();
    }

    onMouseDown(e) {
      if (e.button !== 0) return; // only left button
      this.mouseActive = true;
      this._mouseStartY = e.clientY;
      this._mouseStartOffset = this.scrollOffset;
      this._mouseMoved = false; // ✅ new: track if user actually dragged
      if (this.snapTimer) clearTimeout(this.snapTimer);
    }

    // --- Mouse drag events ---
    onMouseMove(e) {
      if (!this.mouseActive) return;
      const dy = this._mouseStartY - e.clientY;
      if (Math.abs(dy) > 10) {
        this._mouseMoved = true;
      }
      let newOffset = this._mouseStartOffset + dy;
      this.scrollOffset = this._applyOverscrollDamping(newOffset);
      this.applyTransform(false);
    }

    onMouseUp(e) {
      if (!this.mouseActive) return;
      this.mouseActive = false;
      if (!this._mouseMoved) return; // treat as click
      const dy = this.scrollOffset - this._mouseStartOffset;
      const dt = Date.now() - this._mouseStartTime;
      const velocity = Math.abs(dy / dt);
      const targetIndex = this._decideTargetIndex(dy, velocity);
      this.snapTo(targetIndex);
    }

    onHoverIn() {
      if (!this.popup?.classList.contains('open') || this.popup.classList.contains(this.fullscreenClass)) return;
      if (!this.CAN_HOVER) return; // no hover → skip (mobile)

      // Only block scroll in collapsed mode
      if (!this.popup.classList.contains(this.fullscreenClass)) {
        document.body.classList.add('overflow-hidden');
      }
    }

    onHoverOut() {
      if (!this.CAN_HOVER || this.popup.classList.contains(this.fullscreenClass)) return;
      document.body.classList.remove('overflow-hidden');
    }

    // --- Mute / Unmute control ---
    applyMuteState() {
      const isMuted = this.isMuted();
      this.muteBtn?.classList.toggle('is-muted', isMuted);
      // Apply mute state to all active videos
      const videos = this.track?.querySelectorAll('video') || [];
      videos.forEach(v => v.muted = isMuted);
    }

    toggleMute() {
      const current = this.isMuted();
      BtStorageUtil.set('reelsMuted', (!current).toString());
      this.applyMuteState();
    }

    isMuted() {
      const stored = BtStorageUtil.get('reelsMuted');
      if (stored === null) return true; // default: muted
      return stored === 'true';
    }
    
    // ---------- open/close ----------
    open(reels, index, position, isFullscreen, floatingPopupSize, floatingPopupSizeLevel, showProduct, opener) {
      this.floatingPopupSize = floatingPopupSize
      this.style.setProperty('--floating-popup-size', `${floatingPopupSize}px`);
      this.popup.classList.add('open');
      this.track.innerHTML = '';
      this.popup.dataset.position = position;
      this.popup.classList.toggle(this.fullscreenClass, isFullscreen);
      this.popup.dataset.floatingPopupSizeLevel = floatingPopupSizeLevel;
      this.opener = opener;
      this.total = reels.length;
      if(isFullscreen) {
        document.body.classList.add(this.bodyFlagClass);
      }

      reels.forEach((reel) => {
        const item = document.createElement('div');
        item.className = 'reels-item w100 h100 flex justify-center align-center';
        
        const dm = reel.querySelector('deferred-media');
        if (dm) {
          const clone = dm.cloneNode(true);
          clone.classList.add('allow-pause', 'h100', 'in-popup');
          clone.querySelector('.deferred-media__poster').classList.remove('zoom');
          const posterImg = clone?.poster?.querySelector('img');
          if(posterImg) {
            posterImg.removeAttribute('loading');
            posterImg.classList.add('zoom');
          }
          if(reel.dataset.colorScheme) {
            clone.classList.add(`color-${reel.dataset.colorScheme}`);
          }

          if(reel.deferredMedia.dataset.autoplay) {
            deferredMediaObserver.unobserve(clone);
            clone.removeAttribute('data-autoplay');
            clone.isPlaying = false;
          }
          
          // 🚫 Disable loop for HTML5 video
          clone.querySelectorAll('video').forEach(v => {
            this._resetVideoTag(v, true);
          });

          if(showProduct) {
            const tpl = reel.querySelector('.reel-item-product');
            if (tpl) {
              const productNode = tpl.cloneNode(true);
              const quickAddNode = reel.querySelector('.reel-quick-add-btn-tpl');
              productNode.appendChild(quickAddNode.content.firstElementChild.cloneNode(true));
              clone.appendChild(productNode);
            }
          }

          const progress = document.createElement('video-progress');
          clone.appendChild(progress);

          if (reel.dataset.popupFitMode == 'contain') {
            item.classList.add('reels-item--contain');
            clone.appendChild(reel.querySelector('.reels-item__blur-tpl').content.cloneNode(true));
          }

          item.appendChild(clone);
        }

        this.track.appendChild(item);
      });

      this.currentIndex = Math.max(0, Math.min(this.totalItems() - 1, index || 0));
      this.goToCurrentItem(false);
      this.updateNavButtons();
      this._updateFocusability();

      // autoplay first video
      const dm = this.activeDeferredMedia();
      if (dm) {
        // Force the video element to be created immediately
        // dm.loadContent(true, false);

        // Now try to play inside the same gesture callback
        try {
          const p = this.playMedia(dm);
          dm.poster.focus();
          if (p && typeof p.catch === 'function') {
            p.catch(err => {
              console.warn('Safari autoplay blocked:', err);
            });
          }
        } catch (err) {
          console.warn('Error calling dm.play():', err);
        }
      }

      this.showGestureHint();
      this.applyMuteState();
      this.closeBtn.focus();

      // after building/positioning the track & setting currentIndex
      this.bindEndedForAllVideos();
    }

    /** Bind ended for all videos once popup is ready */
    bindEndedForAllVideos() {
      // Get all deferred-media inside the popup track
      const dms = this.popup?.querySelectorAll('deferred-media');
      if (!dms || !dms.length) return;

      dms.forEach(dm => this._ensureEndedBindingForDM(dm));
    }

    /** Find the <video> inside a deferred-media (if already loaded) */
    _findVideoInDM(dm) {
      // In popup, once loaded, there is either a direct <video> or inside a wrapper
      // Avoid posters/templates
      const vids = dm.querySelectorAll('video');
      return vids && vids.length ? vids[vids.length - 1] : null;
    }

    /** Stable bind for a single <video> */
    _bindEndedToVideo(video) {
      // Prevent duplicate bindings if this video was already initialized
      if(video._onEndedHandler) return;
      // Force non-loop in popup, otherwise 'ended' never fires on looping media
      if (video.loop) video.loop = false;

      // Create a stable handler so removeEventListener actually works
      if (!video._onEndedHandler) {
        video._onEndedHandler = () => {
          // Single step next on every natural end
          this.onVideoEnded && this.onVideoEnded();
        };
      }

      // If metadata not ready, attach once loaded then bind 'ended'
      if (video.readyState < 2) {
        const onLoadedData = () => {
          video.removeEventListener('ended', video._onEndedHandler);
          // ‘ended’ can be bound anytime after element is in DOM; binding here to be safe
          video.addEventListener('ended', video._onEndedHandler);
        };
        video.addEventListener('loadeddata', onLoadedData, { once: true });
      } else {
        // Already ready → bind now
        video.addEventListener('ended', video._onEndedHandler);
      }
    }

    /** Ensure ended listener will exist even if the <video> is injected later */
    _ensureEndedBindingForDM(dm) {
      // If the video is already present (dm has loaded content), bind now
      const v = this._findVideoInDM(dm);
      if (v) {
        this._bindEndedToVideo(v);
        return;
      }

      // Otherwise, observe this dm until a <video> appears
      if (this._endedObservers.has(dm)) return; // already observing

      const mo = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'childList' && (m.addedNodes?.length || m.removedNodes?.length)) {
            const video = this._findVideoInDM(dm);
            if (video) {
              this._bindEndedToVideo(video);
              const obs = this._endedObservers.get(dm);
              if (obs) obs.disconnect();
              this._endedObservers.delete(dm);
              break;
            }
          }
        }
      });

      mo.observe(dm, { childList: true, subtree: true });
      this._endedObservers.set(dm, mo);
    }

    _resetVideoTag(video, allowPause = false) {
      video.muted = this.isMuted();
      if(!video.dataset.reset) {
        video.removeAttribute('autoplay');
        video.classList.add('h100', 'zoom', 'video--background');
        // Reset playback state so cloned videos always start from the beginning
        video.currentTime = 0;
        if(allowPause)
          video.pause(); // ensure it's not "playing" in the cloned node
        video.removeAttribute('loop'); // avoid edge cases from slider videos
        video.dataset.reset = true;
      }
    }

    /** Optional: call in disconnectedCallback / when closing popup to clean observers */
    _cleanupEndedObservers() {
      if (!this._endedObservers) return;
      this._endedObservers.forEach(obs => {
        try { obs.disconnect(); } catch (_) {}
      });
      this._endedObservers.clear();
    }

    goToItemByIndex(index, animate = true) {
      this.currentIndex = index;
      this.goToCurrentItem(animate);
    }

    goToCurrentItem(animate = true) {
      this.scrollOffset = this.currentIndex * this.itemHeight();
      this.applyTransform(animate);
      this._updateFocusability();
    }

    isWorking() {
      return this.popup.classList.contains('open');
    }

    showGestureHint() {
      if (BtStorageUtil.get('reelsSwipeHintShown')) return;
    
      const hint = this.popup.querySelector('.reels-swipe-hint');
      if (!hint) return;
    
      hint.classList.add('is-visible');
    
      // auto hide sau 4s
      setTimeout(() => {
        hint.classList.remove('is-visible');
      }, 4000);
    
      BtStorageUtil.set('reelsSwipeHintShown', 'true');
    }

    switchMode(isExpand) {
      this.popup.addEventListener('transitionend', () => {
        this.scrollOffset = this.currentIndex * this.itemHeight();
        this.applyTransform(false);
      }, { once: true });
      this.popup.classList.toggle(this.fullscreenClass, isExpand);
      document.body.classList.toggle(this.bodyFlagClass, isExpand);
    }

    expand() {
      this.switchMode(true);
    }

    collapse() {
      this.switchMode(false);
    }

    close() {
      document.body.classList.remove(this.bodyFlagClass);
      this.popup.classList.remove('open');
      this.cleanup();
      if(this.opener) {
        this.opener?.poster?.focus();
        this.opener.closest('shoppable-reels')?.playWaitingVideo();
      }
    }

    cleanup() {
      this.pauseAll();
      // this.unbindEndedListener();
      this.setViewingDrawer(false);
      
      if (this.snapTimer) clearTimeout(this.snapTimer);
      if (this._snapReleaseTimer) clearTimeout(this._snapReleaseTimer);
      this.snapTimer = null;
      this._snapReleaseTimer = null;
      this.isSnapping = false;
      if (this.track) this.track.style.pointerEvents = '';
      // Clear all 'ended' listeners
      const videos = this.popup?.querySelectorAll('video');
      if (videos) {
        videos.forEach(video => {
          if (video._onEndedHandler) {
            video.removeEventListener('ended', video._onEndedHandler);
            delete video._onEndedHandler;
          }
        });
      }

      if (this.CAN_HOVER) {
        this.popup?.removeEventListener('mouseenter', this._handlers.hoverIn);
        this.popup?.removeEventListener('mouseleave', this._handlers.hoverOut);
        document.body.classList.remove('overflow-hidden');
      }

      // Disconnect mutation observers
      if (this._endedObservers) {
        this._endedObservers.forEach(observer => {
          try { observer.disconnect(); } catch (_) {}
        });
        this._endedObservers.clear();
      }
      if (this.track) {
        this.track.style.pointerEvents = '';
        this.track.innerHTML = '';
      }
    }

    // ---------- wheel / touch ----------
    handleWheel(e) {
      if (!this.popup.classList.contains('open')) return;
      e.preventDefault();
      e.stopPropagation();
      if (this.isSnapping) return;

      this.wheelActive = true;
      this.scrollOffset += (e.deltaY * this.WHEEL_MULTIPLIER);

      const max = (this.totalItems() - 1) * this.itemHeight();
      if (this.scrollOffset < 0) this.scrollOffset = 0;
      if (this.scrollOffset > max) this.scrollOffset = max;

      this.applyTransform(false);

      if (this.snapTimer) clearTimeout(this.snapTimer);
      // Adaptive debounce: if user scrolls slowly, snap sooner
      const debounce =
      Math.abs(e.deltaY) < 10
        ? 30
        : Math.abs(e.deltaY) < 30
        ? 60
        : this.SNAP_DEBOUNCE;

      this.snapTimer = setTimeout(() => this.snapToNearest(), debounce);
    }

    onTouchStart(e) {
      this.touchActive = true;
      this._touchStartY = e.touches[0].clientY;
      this._touchStartOffset = this.scrollOffset;
      this._touchStartTime = Date.now(); // Save the timestamp when the touch starts
      if (this.snapTimer) clearTimeout(this.snapTimer);
      this.applyTransform(false);
    }

    // --- Touch events ---
    onTouchMove(e) {
      if (!this.touchActive) return;
      const dy = this._touchStartY - e.touches[0].clientY;
      let newOffset = this._touchStartOffset + dy;
      this.scrollOffset = this._applyOverscrollDamping(newOffset);
      this.applyTransform(false);
    }

    onTouchEnd() {
      this.touchActive = false;

      const dy = this.scrollOffset - this._touchStartOffset;
      const dt = Date.now() - this._touchStartTime || 1;
      const velocity = Math.abs(dy / dt);

      // Treat very small movement as a tap (e.g. tapping pause/play, buttons, etc.)
      const TAP_MOVE_THRESHOLD = 10;      // px
      const TAP_VELOCITY_THRESHOLD = 0.25; // px/ms

      if (Math.abs(dy) < TAP_MOVE_THRESHOLD && velocity < TAP_VELOCITY_THRESHOLD) {
        // Reset back to the exact current item position and do NOT snap/play again
        this.scrollOffset = this.currentIndex * this.itemHeight();
        this.applyTransform(true);
        return;
      }

      const targetIndex = this._decideTargetIndex(dy, velocity);
      this.snapTo(targetIndex);
    }

    // ---------- snap ----------
    snapToNearest() {
      const ih = this.itemHeight();
      const idx = Math.round(this.scrollOffset / ih);
      this.snapTo(idx);
    }

    snapTo(index) {
      // 👉 If a snap is already running, finish it immediately before starting new one
      if (this.isSnapping) {
        this.finishSnap(true);
      }
    
      const ih = this.itemHeight();
      this.scrollOffset = index * ih;
      this.isSnapping = true;
    
      this.currentIndex = index;
      this.updateNavButtons();
      
      this.applyTransform(true);
    
      if (this._snapReleaseTimer) clearTimeout(this._snapReleaseTimer);
      this._snapReleaseTimer = setTimeout(() => {
        if (this.isSnapping) this.finishSnap();
      }, this.SNAP_DURATION + 120);
    }

    onSnapEnd(e) {
      if (e && e.target !== this.track) return;
      if (e && e.propertyName && e.propertyName !== 'transform') return;
      if (!this.isSnapping) return;
      this.finishSnap();
    }

    async finishSnap(force = false) {
      if (!this.isSnapping && !force) return;
      this.isSnapping = false;
      this.pauseAll(this.currentIndex);
      try { await (this._pendingReady || Promise.resolve()); } catch(_) {}
    
      this.playActiveMedia();
    
      this.wheelActive = false;
      this.activeDeferredMedia()?.focus();

      this._updateFocusability();
      // Keep focus in the active slide, avoid browser auto-scrolling
      const dm = this.activeDeferredMedia() || this.closeBtn;
      if (dm && dm.focus) {
        try { dm.focus({ preventScroll: true }); } catch(_) { dm.focus(); }
      }
    }

    // --- autoplay & ended handling ---
    onVideoEnded() {
      const dm = this.activeDeferredMedia();
      const progress = dm.querySelector('video-progress');
      if (progress) progress._set(100, true); // force 100% instantly
      
      if (this._viewingDrawer || this.wheelActive || this.needRepeat) {
        if(this.needRepeat) {
          this.needRepeat = false;
        }
        // If the drawer is open or user is scrolling → loop the current video instead of auto-next
        
        // HTML5 video
        const v = dm?.querySelector('video');
        if (v) {
          v.currentTime = 0;
          requestAnimationFrame(() => v.play().catch(()=>{}));
          return;
        }
      }

      // 👉 Otherwise auto-next to the next item (loop back to first if at the end)
      const total = this.totalItems();
      const nextIndex = (this.currentIndex + 1) % total;
      this.snapTo(nextIndex);

      // Safety fallback in case transitionend was missed
      setTimeout(() => {
        if (this.isSnapping) this.finishSnap();
      }, this.SNAP_DURATION + 150);
    }

    // ---------- helpers ----------
    totalItems() { return this.total }
    itemHeight() { return this.popup.classList.contains(this.fullscreenClass) ? (this.track?.firstElementChild?.offsetHeight || 1) : this.floatingPopupSize; }
    activeItem() { return this.track?.children?.[this.currentIndex] || null; }
    activeDeferredMedia() { return this.activeItem()?.querySelector('deferred-media') || null; }

    applyTransform(animate) {
      if (!this.track) return;
      this.track.style.transitionDuration = animate ? `${this.SNAP_DURATION}ms` : '0ms';
      this.track.style.transform = `translate3d(0, ${-this.scrollOffset}px, 0)`;
    }

    updateNavButtons() {
      if (!this.prevBtn || !this.nextBtn) return;
      const total = this.totalItems();
      this.prevBtn.disabled = false;
      this.nextBtn.disabled = false;
      if (this.currentIndex === 0) {
        this.prevBtn.disabled = true;
      }
      if (this.currentIndex === total - 1) {
        this.nextBtn.disabled = true;
      }
    }

    playActiveMedia() {
      const dm = this.activeDeferredMedia();
      if (dm) {
        return this.playMedia(dm);
      }
    }

    playMedia(dm) {
      const video = dm.querySelector('video');
      if (video) {
        this._resetVideoTag(video, false);
        // --- Reset to start if video was already near its end ---
        if (video.duration && video.currentTime / video.duration > 0.8) {
          this.needRepeat = true;
        }
      } else {
        dm.loadContent(false, false).then(() => {
          this._resetVideoTag(dm.querySelector('video'), false);
        });
      }
      return dm.play().then(() => {
        const progress = dm.querySelector('video-progress');
        if (progress) progress.attach(dm);
        const posterImg = dm?.poster?.querySelector('img');
        if(posterImg && !posterImg.classList.contains('hidden')) {
          setTimeout(() => {
            posterImg.classList.add('hidden');
          }, 300);
        }
      });
    }

    pauseAll(skipIndex = null) {
      if (!this.track) return;
      Array.from(this.track.children).forEach((item, idx) => {
        if (skipIndex !== null && idx === skipIndex) return;
        const dm = item.querySelector('deferred-media');
        try { dm.pause?.(); } catch(_) {}
      });
    }

    handleKeydown(e) {
      if (!this.popup.classList.contains('open')) return;
      switch (e.key) {
        case 'Escape': this.close(); break;
        case 'ArrowUp':
        case 'ArrowLeft': this.snapTo(this.currentIndex - 1); break;
        case 'ArrowDown':
        case 'ArrowRight': this.snapTo(this.currentIndex + 1); break;
      }
    }

    setViewingDrawer(value) { this._viewingDrawer = !!value; }

    // Return index of the .reels-item that contains `node` (or -1 if none)
    _getItemIndexFromNode(node) {
      if (!this.track) return -1;
      let el = node instanceof Node ? node : null;
      while (el && el !== this.track) {
        if (el.classList?.contains('reels-item')) {
          return Array.prototype.indexOf.call(this.track.children, el);
        }
        el = el.parentNode;
      }
      return -1;
    }

    // List all focusable elements inside a root node
    _getFocusable(root) {
      if (!root) return [];
      const sel = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
      ].join(',');
      return Array.from(root.querySelectorAll(sel)).filter(el => el.offsetParent !== null || el === document.activeElement);
    }

    // Enable focus inside current item; disable elsewhere
    _updateFocusability() {
      if (!this.track) return;
      const items = Array.from(this.track.children);
      items.forEach((item, idx) => {
        const focusables = this._getFocusable(item);
        const active = idx === this.currentIndex;

        // Use inert if available to fully remove from focus order + AT
        if ('inert' in item) {
          item.inert = !active;
        }

        // Fallback: force everything non-focusable when not active
        focusables.forEach(el => {
          if (active) {
            // If we previously forced tabindex="-1", remove it
            if (el.__reelsForcedTabIndex === true) {
              el.removeAttribute('tabindex');
              delete el.__reelsForcedTabIndex;
            }
            el.setAttribute('aria-hidden', 'false');
          } else {
            // Only set tabindex=-1 if it’s naturally focusable (don’t overwrite explicit custom tabindex)
            if (!el.hasAttribute('tabindex')) {
              el.setAttribute('tabindex', '-1');
              el.__reelsForcedTabIndex = true;
            }
            el.setAttribute('aria-hidden', 'true');
          }
        });
      });
    }

    // Keep the visual position centered and manage focus when Tab lands on another item
    onFocusIn(e) {
      if (!this.popup?.classList.contains('open')) return;

      const idx = this._getItemIndexFromNode(e.target);
      if (idx < 0) return;

      // If user focused something in a non-active item → snap there and refocus safely
      if (idx !== this.currentIndex) {
        // Save the element the browser tried to focus
        const wanted = e.target;

        // Snap to that item
        this.snapTo(idx);

        // After snap finishes, focus again without scrolling page
        // (finishSnap already gọi playActiveMedia; ta chỉ cần set focus)
        const refocus = () => {
          // Prefer the same element if it still exists, else focus the active deferred-media
          const stillThere = this.activeItem()?.contains(wanted) ? wanted : (this.activeDeferredMedia() || this.closeBtn);
          if (stillThere && stillThere.focus) {
            try { stillThere.focus({ preventScroll: true }); } catch(_) { stillThere.focus(); }
          }
          this.popup?.removeEventListener('transitionend', refocus);
        };

        // If snap animates with transition, wait; otherwise do ngay
        this.popup?.addEventListener('transitionend', refocus, { once: true });
        // Fallback timeout in case transitionend is missed
        setTimeout(refocus, this.SNAP_DURATION + 120);
      }
    }

    // --- Helpers ---
    _applyOverscrollDamping(offset) {
      const max = (this.totalItems() - 1) * this.itemHeight();

      if (offset < 0) {
        return offset * 0.3; // damp when pulling below first video
      } else if (offset > max) {
        const extra = offset - max;
        return max + extra * 0.3; // damp when pulling beyond last video
      }
      return offset;
    }

    _decideTargetIndex(dy, velocity) {
      const ih = this.itemHeight();
      const threshold = ih * 0.25;
      let targetIndex = this.currentIndex;
      const maxOffset = (this.totalItems() - 1) * ih;

      if (this.scrollOffset < 0) {
        targetIndex = 0; // snap back to first
      } else if (this.scrollOffset > maxOffset) {
        targetIndex = this.totalItems() - 1; // snap back to last
      } else {
        if (Math.abs(dy) > threshold || velocity > 0.3) {
          if (dy > 0) targetIndex = this.currentIndex + 1;
          else targetIndex = this.currentIndex - 1;
        }
      }
      return targetIndex;
    }
  });
}

if (!customElements.get('reel-quick-add')) {
  customElements.define('reel-quick-add', class ReelQuickAdd extends HTMLElement {
    constructor() {
      super();

      this.button = this.querySelector('button');
      this.onClickHandler = this.onClick.bind(this);
      this.button.addEventListener('click', this.onClickHandler);
    }

    onClick(e) {
      this.closest('shoppable-reels-popup').setViewingDrawer(true);
      // super.onClick(e);
    }

    disconnectedCallback() {
      this.button.removeEventListener('click', this.onClickHandler);
    }
  });
}