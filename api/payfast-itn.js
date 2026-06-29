// PayFast ITN → Shopify Draft Order
// Deployed on Vercel — receives payment notifications from PayFast
// and creates a draft order in Shopify for each completed subscription payment.

const crypto = require('crypto');

const PASSPHRASE    = process.env.PAYFAST_PASSPHRASE;   // Gummiwellness_2003
const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;       // 3fu67s-qe.myshopify.com
const SHOPIFY_TOKEN  = process.env.SHOPIFY_ACCESS_TOKEN; // from Shopify custom app

// Match PHP's urlencode() — spaces become +, and extra chars are percent-encoded
function phpUrlencode(str) {
  return encodeURIComponent(String(str))
    .replace(/%20/g, '+')
    .replace(/[!'()*~]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

module.exports = async (req, res) => {
  // PayFast sends POST; reject everything else
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const body = req.body; // Vercel auto-parses application/x-www-form-urlencoded

  // ── 1. Verify signature ──────────────────────────────────────────────────
  const sigParts = Object.entries(body)
    .filter(([k, v]) => k !== 'signature' && v !== '')
    .map(([k, v]) => `${k}=${phpUrlencode(v)}`);

  let sigStr = sigParts.join('&');
  if (PASSPHRASE) sigStr += `&passphrase=${phpUrlencode(PASSPHRASE)}`;

  const computed = crypto.createHash('md5').update(sigStr).digest('hex');

  if (computed !== body.signature) {
    console.error('PayFast ITN: signature mismatch');
    console.error('Expected:', computed);
    console.error('Received:', body.signature);
    return res.status(400).send('Invalid signature');
  }

  // ── 2. Only process completed payments ──────────────────────────────────
  // COMPLETE = once-off or first subscription payment
  // SUBSCR_PAYMENT = recurring subscription billing
  const isPayment = body.payment_status === 'COMPLETE' ||
                    body.payment_status === 'SUBSCR_PAYMENT';

  if (!isPayment) {
    console.log('PayFast ITN: status', body.payment_status, '— skipping');
    return res.status(200).send('OK');
  }

  // ── 3. Create Shopify draft order ────────────────────────────────────────
  const draftOrder = {
    draft_order: {
      line_items: [
        {
          title:    'Gummi Sleep Gummies Monthly Subscription',
          price:    '450.00',
          quantity: 1,
          requires_shipping: true
        }
      ],
      customer: {
        first_name: body.name_first || '',
        last_name:  body.name_last  || '',
        email:      body.email_address || '',
        phone:      body.cell_number   || ''
      },
      shipping_address: {
        first_name:   body.name_first    || '',
        last_name:    body.name_last     || '',
        address1:     body.custom_str1   || '', // street address
        city:         body.custom_str2   || '', // city/town
        province:     body.custom_str3   || '', // province
        zip:          body.custom_str4   || '', // postal code
        country_code: 'ZA',
        phone:        body.cell_number   || ''
      },
      note: [
        `PayFast payment`,
        `Payment ID: ${body.pf_payment_id || '-'}`,
        `Status: ${body.payment_status}`,
        `Subscription token: ${body.token || '-'}`,
        `Amount: R${body.amount_gross || '450.00'}`
      ].join(' | '),
      tags: 'subscription,payfast',
      use_customer_default_address: false
    }
  };

  try {
    const shopifyRes = await fetch(
      `https://${SHOPIFY_DOMAIN}/admin/api/2024-01/draft_orders.json`,
      {
        method:  'POST',
        headers: {
          'Content-Type':             'application/json',
          'X-Shopify-Access-Token':   SHOPIFY_TOKEN
        },
        body: JSON.stringify(draftOrder)
      }
    );

    if (!shopifyRes.ok) {
      const err = await shopifyRes.text();
      console.error('Shopify API error:', err);
      return res.status(500).send('Order creation failed');
    }

    const result = await shopifyRes.json();
    console.log('Draft order created:', result.draft_order?.id);
    return res.status(200).send('OK');

  } catch (err) {
    console.error('Fetch error:', err);
    return res.status(500).send('Server error');
  }
};
