/* ── GUMMI THEME JS ── */

// ── Buy 2 Get 1 Free — gift auto-sync ──
var GIFT_VARIANT_ID = 47726355447913;
var GIFT_PROP = '_gummi_gift';

function syncGiftItems(onChanged, onSynced) {
  fetch('/cart.js')
    .then(function(r) { return r.json(); })
    .then(function(cart) {
      var paidQty = 0, giftQty = 0, giftKey = null;
      cart.items.forEach(function(item) {
        if (item.variant_id === GIFT_VARIANT_ID) {
          if (item.properties && item.properties[GIFT_PROP] === 'true') {
            giftQty = item.quantity;
            giftKey = item.key;
          } else {
            paidQty += item.quantity;
          }
        }
      });
      var expected = Math.floor(paidQty / 2);
      if (expected === giftQty) { if (onSynced) onSynced(); return; }
      var url, body, props = {};
      props[GIFT_PROP] = 'true';
      if (expected === 0 && giftKey) {
        url = '/cart/change.js'; body = { id: giftKey, quantity: 0 };
      } else if (giftKey) {
        url = '/cart/change.js'; body = { id: giftKey, quantity: expected };
      } else {
        url = '/cart/add.js'; body = { id: GIFT_VARIANT_ID, quantity: expected, properties: props };
      }
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function() { if (onChanged) onChanged(); });
    });
}

// FAQ Accordion
document.addEventListener('DOMContentLoaded', function () {

  // Sync gift items on cart page load
  if (window.location.pathname === '/cart') {
    syncGiftItems(function() { window.location.reload(); });
  }

  document.querySelectorAll('.faq-question').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item');
      var isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(function (i) { i.classList.remove('open'); });
      if (!isOpen) item.classList.add('open');
    });
  });

  // Quantity selector
  var qtyInput = document.querySelector('.qty-input');
  if (qtyInput) {
    document.querySelector('.qty-minus') && document.querySelector('.qty-minus').addEventListener('click', function () {
      var val = parseInt(qtyInput.value);
      if (val > 1) qtyInput.value = val - 1;
    });
    document.querySelector('.qty-plus') && document.querySelector('.qty-plus').addEventListener('click', function () {
      qtyInput.value = parseInt(qtyInput.value) + 1;
    });
  }

  // Product gallery thumbnails + swipe
  var thumbs = Array.from(document.querySelectorAll('.product-gallery__thumb'));
  var mainImg = document.querySelector('.product-gallery__main img');

  if (mainImg) {
    mainImg.style.transition = 'opacity 0.25s ease';
  }

  function activateThumb(index) {
    if (index < 0 || index >= thumbs.length) return;
    var thumbImg = thumbs[index].querySelector('img');
    if (thumbImg && mainImg) {
      mainImg.style.opacity = '0';
      setTimeout(function () {
        mainImg.src = thumbImg.src.replace(/width=\d+/, 'width=900');
        mainImg.style.opacity = '1';
      }, 200);
    }
    thumbs.forEach(function (t) { t.classList.remove('active'); });
    thumbs[index].classList.add('active');
  }

  function activeIndex() {
    return thumbs.findIndex(function (t) { return t.classList.contains('active'); });
  }

  thumbs.forEach(function (thumb, i) {
    thumb.addEventListener('click', function () { activateThumb(i); });
  });

  // Swipe on the main image
  var galleryMain = document.querySelector('.product-gallery__main');
  if (galleryMain) {
    var touchStartX = 0;
    galleryMain.addEventListener('touchstart', function (e) {
      touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });
    galleryMain.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) < 40) return; // too small
      if (dx < 0) {
        activateThumb(activeIndex() + 1); // swipe left → next
      } else {
        activateThumb(activeIndex() - 1); // swipe right → prev
      }
    }, { passive: true });
  }

  // Sticky nav shadow on scroll
  var nav = document.querySelector('.site-nav');
  window.addEventListener('scroll', function () {
    if (nav) nav.style.boxShadow = window.scrollY > 20 ? '0 2px 20px rgba(59,31,107,.1)' : 'none';
  });

  // Purchase type toggle (One-time / Subscribe & Save)
  document.querySelectorAll('.purchase-toggle').forEach(function (toggle) {
    var btns = toggle.querySelectorAll('.purchase-toggle__btn');
    // Find the nearest subscribe-options panel
    var panel = toggle.nextElementSibling;
    while (panel && !panel.classList.contains('subscribe-options')) {
      panel = panel.nextElementSibling;
    }

    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        btns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');

        var isSubscribe = btn.dataset.type === 'subscribe';
        if (panel) {
          panel.classList.toggle('visible', isSubscribe);
        }

        // Update price display
        var priceEl = document.getElementById('product-price');
        if (priceEl) {
          var basePrice = parseFloat(priceEl.dataset.basePrice);
          if (!basePrice) {
            // Store the original price on first toggle
            var raw = priceEl.textContent.replace(/[^\d.]/g, '');
            basePrice = parseFloat(raw);
            priceEl.dataset.basePrice = basePrice;
          }
          var discounted = (basePrice * 0.9).toFixed(2);
          // Format as South African Rand matching Shopify money format
          priceEl.textContent = isSubscribe
            ? 'R ' + discounted
            : 'R ' + basePrice.toFixed(2);

          // Update savings badge to reflect actual saving vs compare-at price
          var savingsBadge = document.getElementById('savings-badge');
          if (savingsBadge) {
            var compareAtEl = document.getElementById('compare-at-price');
            if (compareAtEl) {
              var compareAtRaw = compareAtEl.textContent.replace(/[^\d.]/g, '');
              var compareAt = parseFloat(compareAtRaw);
              var currentPrice = isSubscribe ? parseFloat(discounted) : basePrice;
              var saving = (compareAt - currentPrice).toFixed(2);
              savingsBadge.textContent = 'Save R ' + saving;
            }
          }
        }

        // Update ATC button label
        var form = panel ? panel.nextElementSibling : null;
        var atc = form ? form.querySelector('.add-to-cart') : null;
        if (atc) {
          atc.textContent = isSubscribe ? 'Subscribe & Save →' : 'Add to Cart →';
        }
      });
    });
  });

  // Add to cart
  var atcBtn = document.querySelector('.add-to-cart');
  if (atcBtn) {
    atcBtn.addEventListener('click', function (e) {
      // If subscribe mode is active, go to subscription checkout
      var activeToggle = document.querySelector('.purchase-toggle__btn.active');
      if (activeToggle && activeToggle.dataset.type === 'subscribe') {
        e.preventDefault();
        window.location.href = '/pages/subscribe';
        return;
      }

      // Once-off purchase — normal cart flow
      var variantId = atcBtn.dataset.variantId;
      var qty = qtyInput ? parseInt(qtyInput.value) : 1;
      if (!variantId) return;
      atcBtn.textContent = 'Adding...';
      atcBtn.disabled = true;
      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity: qty })
      })
      .then(function (r) { return r.json(); })
      .then(function () {
        atcBtn.textContent = '✓ Added to Cart!';
        function goToCart() {
          atcBtn.textContent = 'Add to Cart →';
          atcBtn.disabled = false;
          window.location.href = '/cart';
        }
        setTimeout(function () { syncGiftItems(goToCart, goToCart); }, 800);
      })
      .catch(function () {
        atcBtn.textContent = 'Add to Cart →';
        atcBtn.disabled = false;
      });
    });
  }
});
