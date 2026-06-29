const crypto = require('crypto');

const PASSPHRASE     = process.env.PAYFAST_PASSPHRASE;
const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
const SHOPIFY_TOKEN  = process.env.SHOPIFY_ACCESS_TOKEN;

module.exports.config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function parseBody(raw) {
  const obj = {};
  for (const pair of raw.split('&')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = decodeURIComponent(pair.slice(0, idx).replace(/\+/g, ' '));
    const val = decodeURIComponent(pair.slice(idx + 1).replace(/\+/g, ' '));
    obj[key] = val;
  }
  return obj;
}

function phpUrlencode(str) {
  return encodeURIComponent(String(str))
    .replace(/%20/g, '+')
    .replace(/[!'()*~]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const rawBody = await getRawBody(req);
  const body = parseBody(rawBody);

  const sigStr = rawBody
    .split('&')
    .filter(p => !p.startsWith('signature='))
    .join('&')
    + (PASSPHRASE ? `&passphrase=${phpUrlencode(PASSPHRASE)}` : '');

  const computed = crypto.createHash('md5').update(sigStr).digest('hex');

  console.log('Computed:', computed);
  console.log('Received:', body.signature);
  console.log('Status:', body.payment_status);

  if (computed !== body.signature) {
    console.error('Signature mismatch. Sig string:', sigStr);
    return res.status(400).send('Invalid signature');
  }

  const isPayment = body.payment_status === 'COMPLETE' || body.payment_status === 'SUBSCR_PAYMENT';
  if (!isPayment) return res.status(200).send('OK');

  const draftOrder = {
    draft_order: {
      line_items: [{ title: 'Gummi Sleep Gummies Monthly Subscription', price: body.amount_gross || '50.00', quantity: 1, requires_shipping: true }],
      customer: { first_name: body.name_first || '', last_name: body.name_last || '', email: body.email_address || '', phone: body.cell_number || '' },
      shipping_address: { first_name: body.name_first || '', last_name: body.name_last || '', address1: body.custom_str1 || '', city: body.custom_str2 || '', province: body.custom_str3 || '', zip: body.custom_str4 || '', country_code: 'ZA', phone: body.cell_number || '' },
      note: `PayFast | ID: ${body.pf_payment_id || '-'} | Status: ${body.payment_status} | Token: ${body.token || '-'} | Amount: R${body.amount_gross}`,
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
          'Content-Type':           'application/json',
          'X-Shopify-Access-Token': SHOPIFY_TOKEN
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
    const draftId = result.draft_order?.id;
    console.log('Draft order created:', draftId);

    // Complete the draft order → converts to a real order
    const completeRes = await fetch(
      `https://${SHOPIFY_DOMAIN}/admin/api/2024-01/draft_orders/${draftId}/complete.json`,
      {
        method: 'PUT',
        headers: {
          'Content-Type':           'application/json',
          'X-Shopify-Access-Token': SHOPIFY_TOKEN
        }
      }
    );

    if (!completeRes.ok) {
      const err = await completeRes.text();
      console.error('Order completion error:', err);
      return res.status(500).send('Order completion failed');
    }

    const completed = await completeRes.json();
    console.log('Order created:', completed.draft_order?.order_id);
    return res.status(200).send('OK');

  } catch (err) {
    console.error('Fetch error:', err.message);
    return res.status(500).send('Server error');
  }
};
