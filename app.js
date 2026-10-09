const elements = {
  attributionStatus: document.getElementById('attributionStatus'),
  shopId: document.getElementById('shopId'),
  trackingCode: document.getElementById('trackingCode'),
  completeOrder: document.getElementById('completeOrder'),
  cancelOrder: document.getElementById('cancelOrder'),
  checkoutHelp: document.getElementById('checkoutHelp'),
  responseStatus: document.getElementById('responseStatus'),
  responseBody: document.getElementById('responseBody'),
  copyResponse: document.getElementById('copyResponse')
};

let attributed = false;
let configured = false;
let lastCompletedSale = null;

function currentSale() {
  let metadata = {};
  const metadataText = document.getElementById('metadata').value.trim();
  if (metadataText) {
    metadata = JSON.parse(metadataText);
    if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') throw new Error('Metadata must be a JSON object.');
  }
  const sale = {
    order_id: document.getElementById('orderId').value.trim(),
    amount: document.getElementById('amount').value,
    product_name: document.getElementById('productName').value.trim(),
    product_category: document.getElementById('productCategory').value.trim(),
    product_image_url: document.getElementById('productImageUrl').value.trim(),
    customer_name: document.getElementById('customerName').value.trim(),
    metadata
  };
  if (!sale.order_id || !sale.amount || !sale.product_name || !sale.product_category || !sale.customer_name) throw new Error('Fill in every required checkout field.');
  return sale;
}

function showResponse(ok, data, status) {
  elements.responseStatus.className = `status-badge ${ok ? 'success' : 'error'}`;
  elements.responseStatus.textContent = status ? `${status} ${ok ? 'accepted' : 'error'}` : (ok ? 'Success' : 'Error');
  elements.responseBody.textContent = JSON.stringify(data, null, 2);
  elements.copyResponse.disabled = false;
}

async function loadAttribution() {
  try {
    const response = await fetch('/api/attribution', { cache: 'no-store', credentials: 'same-origin' });
    const data = await response.json();
    attributed = Boolean(data.attributed);
    configured = Boolean(data.configured);
    elements.shopId.textContent = data.shopId || 'Server not configured';
    elements.trackingCode.textContent = attributed ? 'Stored in an HttpOnly server cookie' : 'No attribution captured';
    elements.attributionStatus.className = `attribution ${attributed ? 'success' : 'error'}`;
    elements.attributionStatus.textContent = attributed ? 'Attributed visitor — 30-day cookie active' : 'No marketer attribution';
    elements.checkoutHelp.textContent = !configured
      ? 'The merchant server needs its MassiveMarket endpoint, Shop ID, and webhook secret environment variables.'
      : attributed ? 'Checkout will use the captured tracking code automatically.' : 'Open this shop through a marketer’s public link before checking out.';
  } catch (error) {
    elements.attributionStatus.className = 'attribution error';
    elements.attributionStatus.textContent = 'Could not check attribution';
    elements.checkoutHelp.textContent = error.message;
  }
  elements.completeOrder.disabled = !(attributed && configured);
  elements.cancelOrder.disabled = !(attributed && configured && lastCompletedSale);
}

async function send(webhookType) {
  let sale;
  try { sale = webhookType === 'order_cancellation' ? lastCompletedSale : currentSale(); }
  catch (error) { showResponse(false, { error: { code: 'invalid_checkout', message: error.message } }); return; }
  if (!sale) { showResponse(false, { error: { code: 'missing_order', message: 'Complete an order before cancelling it.' } }); return; }

  elements.completeOrder.disabled = true;
  elements.cancelOrder.disabled = true;
  try {
    const response = await fetch('/api/send-webhook', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookType, sale })
    });
    const data = await response.json();
    const ok = response.ok && data.success === true;
    showResponse(ok, data, response.status);
    if (ok && webhookType === 'order_confirmation') lastCompletedSale = sale;
    if (ok && webhookType === 'order_cancellation') lastCompletedSale = null;
  } catch (error) {
    showResponse(false, { error: { code: 'network_error', message: error.message } });
  } finally {
    elements.completeOrder.disabled = !(attributed && configured);
    elements.cancelOrder.disabled = !(attributed && configured && lastCompletedSale);
  }
}

elements.completeOrder.addEventListener('click', () => void send('order_confirmation'));
elements.cancelOrder.addEventListener('click', () => void send('order_cancellation'));
elements.copyResponse.addEventListener('click', () => void navigator.clipboard.writeText(elements.responseBody.textContent));
void loadAttribution();
