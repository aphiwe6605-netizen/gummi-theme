/* ── GUMMI THEME JS ── */

// FAQ Accordion
document.addEventListener('DOMContentLoaded', function () {
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

  // Product gallery thumbnails
  document.querySelectorAll('.product-gallery__thumb').forEach(function (thumb) {
    thumb.addEventListener('click', function () {
      var src = thumb.querySelector('img') ? thumb.querySelector('img').src : null;
      var mainImg = document.querySelector('.product-gallery__main img');
      if (src && mainImg) mainImg.src = src;
      document.querySelectorAll('.product-gallery__thumb').forEach(function (t) { t.classList.remove('active'); });
      thumb.classList.add('active');
    });
  });

  // Sticky nav shadow on scroll
  var nav = document.querySelector('.site-nav');
  window.addEventListener('scroll', function () {
    if (nav) nav.style.boxShadow = window.scrollY > 20 ? '0 2px 20px rgba(59,31,107,.1)' : 'none';
  });

  // Purchase type toggle (One-time / Subscribe & Save)
  document.querySelectorAll('.purchase-toggle').forEach(function (toggle) {
    var btns = toggle.querySelectorAll('.purchase-toggle__btn');
    var panel = toggle.nextElementSibling;
    while (panel && !panel.classList.contains('subscribe-options')) {
      panel = panel.nextElementSibling;
    }
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        btns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var isSubscribe = btn.dataset.type === 'subscribe';
        if (panel) { panel.classList.toggle('visible', isSubscribe); }
        var form = panel ? panel.nextElementSibling : null;
        var atc = form ? form.querySelector('.add-to-cart') : null;
        if (atc) { atc.textContent = isSubscribe ? 'Subscribe & Save →' : 'Add to Cart →'; }
      });
    });
  });

  // Add to cart
  var atcBtn = document.querySelector('.add-to-cart');
  if (atcBtn) {
    atcBtn.addEventListener('click', function (e) {
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
        setTimeout(function () {
          atcBtn.textContent = 'Add to Cart →';
          atcBtn.disabled = false;
          window.location.href = '/cart';
        }, 1200);
      })
      .catch(function () {
        atcBtn.textContent = 'Add to Cart →';
        atcBtn.disabled = false;
      });
    });
  }
});
