var blockEditingTimeout;
function focusBlockEditing(element) {
  if(blockEditingTimeout) {
    clearTimeout(blockEditingTimeout);
    document.querySelectorAll('.block-editing').forEach(element => {
      element.classList.remove('block-editing');
    });
  }
  element.classList.add('block-editing');
  blockEditingTimeout = setTimeout(() => {
    element.classList.remove('block-editing');
  }, 1000);
}

/**
 * Scroll the slider carousel to the selected item.
 * 
 * @param {*} item 
 */
function showSliderItemInViewport(item) {
  const sliderComponent = item.closest('slider-component');
  if(sliderComponent) {
    const isSlider = (window.innerWidth < 750 && sliderComponent.classList.contains('slider-component-mobile'))
      || (window.innerWidth >= 750 && window.innerWidth < 990 && sliderComponent.classList.contains('slider-component-tablet'))
      || (window.innerWidth > 990 && sliderComponent.classList.contains('slider-component-desktop'));
    if(isSlider) {
      sliderComponent.goToSlideByIndex(parseInt(item.dataset.index));
    }
  }
}

/**
 * Select a block in the slideshow section
 * 
 * @param {*} event 
 * @returns 
 */
function selectBlockSlideshow(event) {
  const blockSelectedIsSlide = event.target.classList.contains('slideshow__slide');
  if (!blockSelectedIsSlide) return;

  const parentSlideshowComponent = event.target.closest('slideshow-component');
  parentSlideshowComponent.pause();

  setTimeout(function() {
    parentSlideshowComponent.slider.scrollTo({
      left: event.target.offsetLeft
    });
  }, 200);
}

/**
 * Deselect a block in the slideshow section
 * 
 * @param {*} event 
 * @returns 
 */
function deselectBlockSlideshow(event) {
  const blockDeselectedIsSlide = event.target.classList.contains('slideshow__slide');
  if (!blockDeselectedIsSlide) return;
  const parentSlideshowComponent = event.target.closest('slideshow-component');
  if (parentSlideshowComponent.autoplayButtonIsSetToPlay) parentSlideshowComponent.play();
}

function reloadSlideshow(event) {
  if(event.target.classList.contains('section-slideshow')) {
    const slideshowComponent = event.target.querySelector('slideshow-component');
    slideshowComponent.init();
  }
}

/**
 * Select a block in the header section
 * 
 * @param {*} event 
 * @returns 
 */
 function selectBlockHeader(event) {
  if(event.target.classList.contains('header__menu-badge')) {
    focusBlockEditing(event.target);
    return;
  }

  const blockSelectedIsMegaMenuItem = event.target.classList.contains('mega-menu__column__item');
  if (blockSelectedIsMegaMenuItem) {
    focusBlockEditing(event.target);

    if(window.innerWidth >= 990) {
      const parentMenu = event.target.closest('header-menu');
      parentMenu.classList.add('ignore-close');
      parentMenu.open();
      const sectionHeader = event.target.closest('.section-header');
      sectionHeader.classList.add('focus-by-admin');
    } else {
      const headerDrawer = document.getElementById('header-drawer-menu-mobile');
      const summaryElement = headerDrawer.querySelector('.header__icon--summary');
      
      if(summaryElement.ariaExpanded !== 'true') {
        summaryElement.dispatchEvent(new Event('click'));
        summaryElement.parentNode.open = true;
      }
    }
  };

  const blockSelectedIsRegionSupport = event.target.classList.contains('header__customer-support-region__region');
  if(blockSelectedIsRegionSupport) {
    let timeout = 0;
    let wrapperSelector;
    if(window.innerWidth >= 990) {
      wrapperSelector = 'header-region-desktop';
    } else {
      const headerDrawer = document.getElementById('header-drawer-menu-mobile');
      const summaryElement = headerDrawer.querySelector('.header__icon--summary');
      
      if(summaryElement.ariaExpanded !== 'true') {
        summaryElement.dispatchEvent(new Event('click'));
        summaryElement.parentNode.open = true;
        timeout = 500;
      }
      wrapperSelector = 'header-region-mobile';
    }
    setTimeout(() => {
      const wrapper = document.getElementById(wrapperSelector);
      if(wrapper) {
        const wrapperDetails = wrapper.querySelector('details');
        if(!wrapperDetails.hasAttribute('open')) {
          wrapperDetails.querySelector('summary').dispatchEvent(new Event('click'));
        }
        focusBlockEditing(event.target);
      }
    }, timeout);
  }
}

/**
 * Deselect a block in the header section
 * 
 * @param {*} event 
 * @returns 
 */
 function deselectBlockHeader(event) {
  const blockSelectedIsMegaMenuItem = event.target.classList.contains('mega-menu__column__item');
  if (blockSelectedIsMegaMenuItem) {
    const parentMenu = event.target.closest('header-menu');
    parentMenu.classList.remove('ignore-close');
    parentMenu.close();
    const sectionHeader = event.target.closest('.section-header');
    sectionHeader.classList.remove('focus-by-admin');
  }

  const blockSelectedIsRegionSupport = event.target.classList.contains('header__customer-support-region__region');
  if(blockSelectedIsRegionSupport) {
    if(window.innerWidth >= 990) {
      wrapperSelector = 'header-region-desktop';
      const wrapper = document.getElementById('header-region-desktop');
      if(wrapper) {
        const wrapperDetails = wrapper.querySelector('details');
        if(wrapperDetails.hasAttribute('open')) {
          wrapperDetails.querySelector('summary').dispatchEvent(new Event('click'));
        }
      }
    }
  }
}

/**
 * Select a block in the lookbook section
 * 
 * @param {*} event 
 * @returns 
 */
 function selectBlockLookbook(event) {
  const blockSelectedIsLookbookItem = event.target.classList.contains('lookbook__hotspot');
  if (!blockSelectedIsLookbookItem) return;

  if(!event.target.classList.contains('lookbook__hotspot--with-slider')) {
    event.target.open();
  } else {
    event.target.closest('lookbook-slider').openProductTarget(event.target.querySelector('button'));
  }
}

/**
 * Deselect a block in the lookbook section
 * 
 * @param {*} event 
 * @returns 
 */
 function deselectBlockLookbook(event) {
  const blockSelectedIsLookbookItem = event.target.classList.contains('lookbook__hotspot');
  if (!blockSelectedIsLookbookItem) return;

  if(!event.target.classList.contains('lookbook__hotspot--with-slider')) {
    event.target.closeWithClosingClass();
  }
}

/**
 * Select the Background color swatches section
 * 
 * @param {*} event 
 * @returns 
 */
 function selectBackgroundColorSwatchesSection(event) {
  if (!event.target.classList.contains('background-color-swatches')) {
    document.querySelectorAll('.background-color-swatches__inner').forEach(ele => ele.classList.remove('open'));
    return;
  }

  event.target.querySelector('.background-color-swatches__inner').classList.add('open');
}

/**
 * Select the cart drawer section
 * 
 * @param {*} event 
 * @returns 
 */
 function selectCartDrawerSection(event) {
  if (!event.target.classList.contains('cart-drawer-section')) {
    return;
  }

  event.target.querySelector('cart-drawer').open();
}

/**
 * Deselect the cart drawer section
 * 
 * @param {*} event 
 * @returns 
 */
 function deselectCartDrawerSection(event) {
  if (!event.target.classList.contains('cart-drawer-section')) {
    return;
  }

  event.target.querySelector('cart-drawer').close();
}

/**
 * Select a block in the announcement bar section
 * 
 * @param {*} event 
 * @returns 
 */
 function selectBlockAnnouncementBar(event) {
  const blockSelected = event.target.classList.contains('announcement-bar');
  if (!blockSelected) return;

  const parentSliderComponent = event.target.closest('slider-component');
  parentSliderComponent.pause();

  setTimeout(function() {
    parentSliderComponent.slider.scrollTo({
      left: event.target.offsetLeft
    });
  }, 200);
}

/**
 * Deselect a block in the announcement bar section
 * 
 * @param {*} event 
 * @returns 
 */
function deselectBlockAnnouncementBar(event) {
  const blockDeselected = event.target.classList.contains('announcement-bar');
  if (!blockDeselected) return;
  const parentSliderComponent = event.target.closest('slider-component');
  if (parentSliderComponent.autoplayButtonIsSetToPlay) parentSliderComponent.play();
}

/**
 * Select a block in tabs section
 * 
 * @param {*} event 
 * @returns 
 */
 function selectBlockTabs(event) {
  const blockSelectedIsTabItem = event.target.classList.contains('tabs__item-label') || event.target.closest('.tabs__tab-content');
  if (!blockSelectedIsTabItem) return;

  const tab = event.target.classList.contains('tabs__item-label') ? event.target : document.getElementById(event.target.closest('.tabs__tab-content').getAttribute('aria-labelledby'));
  const tabs = tab.closest('custom-tabs');
  tabs.selectTab(tab);
}

/**
 * Select the quick view popup section
 * 
 * @param {*} event 
 * @returns 
 */
 function selectQuickViewPopupSection(event) {
  
  if (!event.target.classList.contains('shopify-quickview-popup')) {
    return;
  }

  event.target.querySelector('quick-view-modal-opener button').dispatchEvent(new Event('click'));
}

/**
 * Deselect the quick view popup section
 * 
 * @param {*} event 
 * @returns 
 */
function deselectQuickViewPopupSection(event) {
  if (!event.target.classList.contains('shopify-quickview-popup')) {
    return;
  }

  event.target.querySelector('quick-view-modal').hide(true);
}

/**
 * Select the cookies banner section
 * 
 * @param {*} event 
 * @returns 
 */
 function selectCookiesBannerSection(event) {
  
  if (!event.target.classList.contains('cookies-banner-section')) {
    return;
  }

  event.target.querySelector('cookies-banner').showBanner();
}

/**
 * Deselect the cookie banner section
 * 
 * @param {*} event 
 * @returns 
 */
 function deselectCookiesBannerSection(event) {
  if (!event.target.classList.contains('cookies-banner-section')) {
    return;
  }

  event.target.querySelector('cookies-banner').hideBanner(false);
}

/**
 * Select the search suggestions section
 * 
 * @param {*} event 
 * @returns 
 */
function selectSearchSuggestionsSection(event) {
  if (!event.target.classList.contains('predictive-search-section')) {
    return;
  }

  document.querySelector('.header__icon--search').dispatchEvent(new Event('click'));
}

/**
 * Deselect the search suggestions section
 * 
 * @param {*} event 
 * @returns 
 */
 function deselectSearchSuggestionsSection(event) {
  if (!event.target.classList.contains('predictive-search-section')) {
    return;
  }

  document.querySelector('.header__search').close();
}

/**
 * Select/deselect a block in the collapsible content section
 * 
 * @param {*} event 
 * @returns 
 */
function toggleBlockCollapsibleContent(event, isOpen) {
  const blockSelected = event.target.classList.contains('accordion');
  if (!blockSelected) return;

  const details = event.target.querySelector(':scope > details');
  if((!details.open && isOpen) || (details.open && !isOpen))
    event.target.querySelector('.summary-accordion').dispatchEvent(new Event('click'));
}

function reloadHeader(event) {
  if(event.target.classList.contains('section-header')) {
    initEventSummary(event.target);
  }
}

function reloadProductDetails(event) {
  if(event.target.classList.contains('section-featured-product')) {
    const mediaGallery = event.target.querySelector('media-gallery');
    if(mediaGallery) {
      updateProductMediaStatus(mediaGallery);
    }
  }
}

/**
 * Select/deselect the search email signup popup section
 * 
 * @param {*} event 
 * @returns 
 */
function toggleSelectEmailSignupPopupSection(event, isOpen) {
  if (!event.target.classList.contains('email-signup-popup-section')) {
    return;
  }

  (isOpen) ? event.target.querySelector('email-signup-popup').openPopup() : event.target.querySelector('email-signup-popup').hide();
}

/**
 * Select/deselect the Shoppable Reels section
 * 
 * @param {*} event 
 * @returns 
 */
function toggleShoppableReelsPopup(event) {
  if (!event.target.classList.contains('shoppable-reels-section')) {
    return;
  }

  document.getElementById('shoppable-reels-popup').close();
}

/**
 * Select/deselect the Video reel block
 * 
 * @param {*} event 
 * @returns 
 */
function toogleVideoReelBlock(event, isSelected) {
  const target = event.target.classList.contains('shoppable-reels__item') ? event.target : (event.target.closest('.shoppable-reels__item'));
  if(target && isSelected) {
    showSliderItemInViewport(target);
    const popup = document.getElementById('shoppable-reels-popup');
    if(popup.isWorking()) {
      popup.goToItemByIndex(parseInt(target.dataset.index), false);
      popup.pauseAll();
      popup.playActiveMedia();
    }
  }
}

/**
 * Select a block in the Collection list or Testimonial section
 * 
 * @param (*) event
 * @returns
 */
function selectItemInCollectionListTestimonial(event) {
  if(event.target.classList.contains('collection-list__item') || event.target.classList.contains('testimonials__slide')) {
    showSliderItemInViewport(event.target);
  }
}

document.addEventListener('shopify:section:select', function(event) {
  selectBackgroundColorSwatchesSection(event);
  selectCartDrawerSection(event);
  selectQuickViewPopupSection(event);
  selectCookiesBannerSection(event);
  selectSearchSuggestionsSection(event);
  toggleSelectEmailSignupPopupSection(event, true);
});

document.addEventListener('shopify:section:deselect', function(event) {
  deselectCartDrawerSection(event);
  deselectQuickViewPopupSection(event);
  deselectCookiesBannerSection(event);
  deselectSearchSuggestionsSection(event);
  toggleSelectEmailSignupPopupSection(event, false);
  toggleShoppableReelsPopup(event)
});

document.addEventListener('shopify:section:load', function(event) {
  reloadHeader(event);
  reloadProductDetails(event);
  toggleShoppableReelsPopup(event);
});

document.addEventListener('shopify:block:select', function(event) {
  selectBlockSlideshow(event);
  selectBlockHeader(event);
  selectBlockTabs(event);
  selectBlockLookbook(event);
  selectBlockAnnouncementBar(event);
  toggleBlockCollapsibleContent(event, true);
  toogleVideoReelBlock(event, true);
  selectItemInCollectionListTestimonial(event);
});

document.addEventListener('shopify:block:deselect', function(event) {
  deselectBlockSlideshow(event);
  deselectBlockHeader(event);
  deselectBlockLookbook(event);
  deselectBlockAnnouncementBar(event);
  toggleBlockCollapsibleContent(event, false);
});
