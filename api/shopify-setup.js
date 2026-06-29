// One-time OAuth setup endpoint
// Visit /api/shopify-setup to start the OAuth flow
// Shopify will redirect back here with the access token

const CLIENT_ID     = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const SHOP          = process.env.SHOPIFY_DOMAIN; // 3fu67s-qe.myshopify.com

module.exports = async (req, res) => {
  const { code, hmac, shop } = req.query;

  // Step 1 — No code yet: redirect to Shopify OAuth
  if (!code) {
    const scopes = 'write_draft_orders,write_customers';
    const redirectUri = `https://${req.headers.host}/api/shopify-setup`;
    const installUrl =
      `https://${SHOP}/admin/oauth/authorize` +
      `?client_id=${CLIENT_ID}` +
      `&scope=${scopes}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`;
    return res.redirect(installUrl);
  }

  // Step 2 — Exchange code for access token
  try {
    const tokenRes = await fetch(
      `https://${SHOP}/admin/oauth/access_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:     CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code
        })
      }
    );

    const data = await tokenRes.json();
    const token = data.access_token;

    if (!token) {
      return res.status(400).send(`<pre>Error: ${JSON.stringify(data)}</pre>`);
    }

    // Display the token — copy it to SHOPIFY_ACCESS_TOKEN in Vercel
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Gummi — Shopify Token</title></head>
      <body style="font-family:sans-serif;max-width:600px;margin:60px auto;padding:20px">
        <h2>✅ Success! Your Shopify Access Token:</h2>
        <p style="background:#f0f0f0;padding:16px;border-radius:8px;word-break:break-all;font-family:monospace;font-size:14px">
          ${token}
        </p>
        <p><strong>Next step:</strong> Copy the token above and add it as an environment variable in Vercel:<br>
        Name: <code>SHOPIFY_ACCESS_TOKEN</code><br>
        Value: the token above</p>
        <p style="color:#999;font-size:12px">Keep this token private — do not share it.</p>
      </body>
      </html>
    `);

  } catch (err) {
    return res.status(500).send(`<pre>Error: ${err.message}</pre>`);
  }
};
