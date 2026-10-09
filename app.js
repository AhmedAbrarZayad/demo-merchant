const BACKEND_API_ENDPOINT = '/api/send-webhook';
const HEALTH_ENDPOINT = '/api/health';

const state = {
    config: {
        apiBaseUrl: 'http://localhost:8000',
        shopId: '',
        webhookSecret: ''
    },
    backendUrl: '',
    logs: []
};

const elements = {
    apiBaseUrl: document.getElementById('apiBaseUrl'),
    backendUrl: document.getElementById('backendUrl'),
    shopId: document.getElementById('shopId'),
    webhookSecret: document.getElementById('webhookSecret'),
    toggleSecret: document.getElementById('toggleSecret'),
    testConfig: document.getElementById('testConfig'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    orderConfirmationFields: document.getElementById('orderConfirmationFields'),
    orderCancellationFields: document.getElementById('orderCancellationFields'),
    sendWebhook: document.getElementById('sendWebhook'),
    responseStatus: document.getElementById('responseStatus'),
    responseBody: document.getElementById('responseBody'),
    copyResponse: document.getElementById('copyResponse'),
    logs: document.getElementById('logs'),
    clearLogs: document.getElementById('clearLogs')
};

let currentWebhookType = 'order_confirmation';

function init() {
    loadConfig();
    bindEvents();
    updateSendButtonState();
}

function loadConfig() {
    const saved = localStorage.getItem('demoMerchantConfig');
    if (saved) {
        try {
            const config = JSON.parse(saved);
            state.config = { ...state.config, ...config };
            elements.apiBaseUrl.value = state.config.apiBaseUrl;
            elements.shopId.value = state.config.shopId;
            elements.webhookSecret.value = state.config.webhookSecret;
            if (elements.backendUrl) {
                elements.backendUrl.value = state.config.backendUrl || '';
            }
        } catch (e) {
            console.error('Failed to load config:', e);
        }
    }
    
    if (!state.config.backendUrl) {
        state.config.backendUrl = '';
    }
    
    const savedLogs = localStorage.getItem('demoMerchantLogs');
    if (savedLogs) {
        try {
            state.logs = JSON.parse(savedLogs);
            renderLogs();
        } catch (e) {
            console.error('Failed to load logs:', e);
        }
    }
}

function saveConfig() {
    state.config.apiBaseUrl = elements.apiBaseUrl.value.trim();
    state.config.shopId = elements.shopId.value.trim();
    state.config.webhookSecret = elements.webhookSecret.value;
    if (elements.backendUrl) {
        state.config.backendUrl = elements.backendUrl.value.trim();
    }
    if (!state.config.backendUrl) {
        state.config.backendUrl = '';
    }
    localStorage.setItem('demoMerchantConfig', JSON.stringify(state.config));
}

function bindEvents() {
    elements.apiBaseUrl.addEventListener('input', saveConfig);
    elements.shopId.addEventListener('input', saveConfig);
    elements.webhookSecret.addEventListener('input', saveConfig);
    elements.backendUrl?.addEventListener('input', saveConfig);
    
    elements.toggleSecret.addEventListener('click', () => {
        const type = elements.webhookSecret.type === 'password' ? 'text' : 'password';
        elements.webhookSecret.type = type;
        elements.toggleSecret.textContent = type === 'password' ? '👁' : '🙈';
    });
    
    elements.testConfig.addEventListener('click', testConfiguration);
    
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.type));
    });
    
    elements.sendWebhook.addEventListener('click', sendWebhook);
    elements.copyResponse.addEventListener('click', copyResponse);
    elements.clearLogs.addEventListener('click', clearLogs);
    
    document.querySelectorAll('#orderConfirmationFields input, #orderConfirmationFields textarea').forEach(el => {
        el.addEventListener('input', updateSendButtonState);
    });
    document.querySelectorAll('#orderCancellationFields input, #orderCancellationFields textarea').forEach(el => {
        el.addEventListener('input', updateSendButtonState);
    });
}

function switchTab(type) {
    currentWebhookType = type;
    elements.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
    elements.orderConfirmationFields.classList.toggle('hidden', type !== 'order_confirmation');
    elements.orderCancellationFields.classList.toggle('hidden', type !== 'order_cancellation');
    updateSendButtonState();
}

function updateSendButtonState() {
    const hasConfig = state.config.shopId && state.config.webhookSecret;
    let hasFields = false;
    
    if (currentWebhookType === 'order_confirmation') {
        hasFields = document.getElementById('orderId').value.trim() &&
                    document.getElementById('trackingCode').value.trim() &&
                    document.getElementById('amount').value &&
                    document.getElementById('productName').value.trim() &&
                    document.getElementById('productCategory').value.trim() &&
                    document.getElementById('customerName').value.trim();
    } else {
        hasFields = document.getElementById('cancelOrderId').value.trim();
    }
    
    elements.sendWebhook.disabled = !(hasConfig && hasFields);
}

async function testConfiguration() {
    if (!state.config.shopId || !state.config.webhookSecret) {
        showResponse('error', { error: { code: 'missing_config', message: 'Please fill in Shop ID and Webhook Secret' } });
        return;
    }
    
    const testPayload = {
        schema_version: '1.0',
        event_type: 'sale.completed',
        occurred_at: new Date().toISOString(),
        data: {
            order_id: 'TEST-CONFIG',
            tracking_code: 'TEST-TRACKING',
            amount: '1.00',
            currency: 'USD',
            product: { name: 'Test', category: 'Test' },
            customer: { name: 'Test' }
        }
    };
    
    const backendUrl = state.config.backendUrl || '';
    
    try {
        const response = await fetch(`${backendUrl}${BACKEND_API_ENDPOINT}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                apiBaseUrl: state.config.apiBaseUrl,
                shopId: state.config.shopId,
                webhookSecret: state.config.webhookSecret,
                webhookType: 'order_confirmation',
                payload: testPayload
            })
        });
        
        const data = await response.json();
        
        if (response.status === 401 || response.status === 403) {
            showResponse('error', data);
            addLog('order_confirmation', 'error', testPayload, data, response.status);
        } else if (response.status === 404) {
            showResponse('error', { error: { code: 'shop_not_found', message: 'Shop not found. Check your Shop ID.' } });
            addLog('order_confirmation', 'error', testPayload, { error: { code: 'shop_not_found', message: 'Shop not found' } }, response.status);
        } else if (response.status === 400 && data.error?.code === 'invalid_signature') {
            showResponse('error', { error: { code: 'invalid_secret', message: 'Invalid webhook secret. Check your secret in the portal.' } });
            addLog('order_confirmation', 'error', testPayload, { error: { code: 'invalid_secret', message: 'Invalid webhook secret' } }, response.status);
        } else {
            showResponse('success', { message: 'Configuration is valid!', testResponse: data });
            addLog('order_confirmation', 'success', testPayload, data, response.status);
        }
    } catch (error) {
        showResponse('error', { error: { code: 'network_error', message: error.message } });
        addLog('order_confirmation', 'error', testPayload, { error: { code: 'network_error', message: error.message } }, 0);
    }
}

async function sendWebhook() {
    if (!state.config.shopId || !state.config.webhookSecret) {
        showResponse('error', { error: { code: 'missing_config', message: 'Please configure Shop ID and Webhook Secret first' } });
        return;
    }
    
    let payload;
    if (currentWebhookType === 'order_confirmation') {
        payload = buildOrderConfirmationPayload();
    } else {
        payload = buildOrderCancellationPayload();
    }
    
    if (!payload) return;
    
    elements.sendWebhook.disabled = true;
    elements.sendWebhook.textContent = 'Sending...';
    
    const backendUrl = state.config.backendUrl || '';
    
    try {
        const response = await fetch(`${backendUrl}${BACKEND_API_ENDPOINT}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                apiBaseUrl: state.config.apiBaseUrl,
                shopId: state.config.shopId,
                webhookSecret: state.config.webhookSecret,
                webhookType: currentWebhookType,
                payload: payload
            })
        });
        
        const data = await response.json();
        const isSuccess = response.ok && data.success === true;
        
        showResponse(isSuccess ? 'success' : 'error', data);
        addLog(currentWebhookType, isSuccess ? 'success' : 'error', payload, data, response.status);
    } catch (error) {
        showResponse('error', { error: { code: 'network_error', message: error.message } });
        addLog(currentWebhookType, 'error', payload, { error: { code: 'network_error', message: error.message } }, 0);
    } finally {
        elements.sendWebhook.disabled = false;
        elements.sendWebhook.textContent = 'Send Webhook';
        updateSendButtonState();
    }
}

function buildOrderConfirmationPayload() {
    const orderId = document.getElementById('orderId').value.trim();
    const trackingCode = document.getElementById('trackingCode').value.trim();
    const amount = document.getElementById('amount').value;
    const productName = document.getElementById('productName').value.trim();
    const productCategory = document.getElementById('productCategory').value.trim();
    const productImageUrl = document.getElementById('productImageUrl').value.trim();
    const customerName = document.getElementById('customerName').value.trim();
    let metadata = {};
    
    try {
        const metadataStr = document.getElementById('metadata').value.trim();
        if (metadataStr) {
            metadata = JSON.parse(metadataStr);
        }
    } catch (e) {
        showResponse('error', { error: { code: 'invalid_metadata', message: 'Metadata must be valid JSON' } });
        return null;
    }
    
    if (!orderId || !trackingCode || !amount || !productName || !productCategory || !customerName) {
        showResponse('error', { error: { code: 'missing_fields', message: 'Please fill in all required fields' } });
        return null;
    }
    
    return {
        schema_version: '1.0',
        event_type: 'sale.completed',
        occurred_at: new Date().toISOString(),
        data: {
            order_id: orderId,
            tracking_code: trackingCode,
            amount: parseFloat(amount).toFixed(2),
            currency: 'USD',
            product: {
                name: productName,
                category: productCategory,
                image_url: productImageUrl
            },
            customer: {
                name: customerName
            },
            metadata
        }
    };
}

function buildOrderCancellationPayload() {
    const orderId = document.getElementById('cancelOrderId').value.trim();
    const reason = document.getElementById('cancelReason').value.trim();
    
    if (!orderId) {
        showResponse('error', { error: { code: 'missing_fields', message: 'Please enter Order ID to cancel' } });
        return null;
    }
    
    return {
        schema_version: '1.0',
        event_type: 'sale.cancelled',
        occurred_at: new Date().toISOString(),
        data: {
            order_id: orderId,
            reason: reason || 'Cancelled by merchant'
        }
    };
}

async function generateSignature(payload, secret) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);
    
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function showResponse(status, data) {
    elements.responseStatus.className = `status-badge ${status}`;
    elements.responseStatus.textContent = status === 'success' ? 'Success' : status === 'error' ? 'Error' : 'Pending';
    elements.responseBody.textContent = JSON.stringify(data, null, 2);
    elements.copyResponse.disabled = false;
    
    if (status === 'success') {
        elements.responseBody.style.borderLeft = '4px solid #10b981';
    } else if (status === 'error') {
        elements.responseBody.style.borderLeft = '4px solid #ef4444';
    } else {
        elements.responseBody.style.borderLeft = '4px solid #f59e0b';
    }
}

async function copyResponse() {
    try {
        await navigator.clipboard.writeText(elements.responseBody.textContent);
        const original = elements.copyResponse.textContent;
        elements.copyResponse.textContent = '✓';
        setTimeout(() => elements.copyResponse.textContent = original, 1500);
    } catch (e) {
        console.error('Failed to copy:', e);
    }
}

function addLog(type, status, request, response, httpStatus) {
    const log = {
        id: Date.now(),
        type,
        status,
        request,
        response,
        httpStatus,
        timestamp: new Date().toISOString()
    };
    
    state.logs.unshift(log);
    if (state.logs.length > 50) state.logs.pop();
    localStorage.setItem('demoMerchantLogs', JSON.stringify(state.logs));
    renderLogs();
}

function renderLogs() {
    if (state.logs.length === 0) {
        elements.logs.innerHTML = '<p class="empty-logs">No requests sent yet.</p>';
        return;
    }
    
    elements.logs.innerHTML = state.logs.map(log => `
        <div class="log-entry">
            <div class="log-entry-header">
                <span class="log-entry-type">${log.type.replace('_', ' ')}</span>
                <span class="log-entry-time">${new Date(log.timestamp).toLocaleTimeString()}</span>
                <span class="log-entry-status ${log.status}">${log.status}</span>
            </div>
            <div class="log-entry-details">${JSON.stringify({
                request: log.request,
                response: log.response,
                httpStatus: log.httpStatus
            }, null, 2)}</div>
        </div>
    `).join('');
}

function clearLogs() {
    state.logs = [];
    localStorage.removeItem('demoMerchantLogs');
    renderLogs();
}

document.addEventListener('DOMContentLoaded', init);