document.addEventListener('DOMContentLoaded', () => {
  const WORKER_URL = 'https://receipt-proxy.kyogom.workers.dev';

  const MOCK_RESULT = {"establishment":"まいばすけっと","validatedEstablishment":false,"date":"","total":1296,"url":"","phoneNumber":"","paymentMethod":"","address":"","cash":0,"change":0,"validatedTotal":false,"subTotal":1201,"validatedSubTotal":true,"tax":0,"tip":0,"taxes":[],"serviceCharges":[],"discount":0,"rounding":0,"discounts":[],"lineItems":[{"qty":0,"desc":"有料 レジ 袋 M","unit":"","price":0,"symbols":[],"discount":0,"lineType":"","descClean":"有料 レジ 袋 M","lineTotal":3,"productCode":"","customFields":{}},{"qty":0,"desc":"雪 メグ 牧場 の 朝","unit":"","price":0,"symbols":["*"],"discount":0,"lineType":"","descClean":"雪 メグ 牧場 の 朝","lineTotal":119,"productCode":"","customFields":{}},{"qty":0,"desc":"割 引 30%","unit":"","price":0,"symbols":["-"],"discount":0,"lineType":"","descClean":"割 引 30%","lineTotal":-36,"productCode":"","customFields":{}},{"qty":0,"desc":"マネケン チョコレート","unit":"","price":0,"symbols":["*"],"discount":0,"lineType":"","descClean":"マネケン チョコレート","lineTotal":159,"productCode":"","customFields":{}}],"summaryItems":[],"customFields":{"Currency":"JPY"},"documentType":"receipt","currency":"JPY"};

  const apiKeyInput = document.getElementById('api-key-input');
  const saveApiKeyBtn = document.getElementById('save-api-key');
  const fileInput = document.getElementById('file-input');
  const fileName = document.getElementById('file-name');
  const loadMockBtn = document.getElementById('load-mock');
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const resultArea = document.getElementById('result-area');
  const itemsList = document.getElementById('items-list');
  const totalAmount = document.getElementById('total-amount');
  const copyButton = document.getElementById('copy-button');
  const taxRadios = document.querySelectorAll('input[name="tax-rate"]');

  let items = [];

  // 保存済みAPI Keyを読み込み
  const savedApiKey = localStorage.getItem('tabscanner_api_key');
  if (savedApiKey) apiKeyInput.value = savedApiKey;

  // API Key保存
  saveApiKeyBtn.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      localStorage.setItem('tabscanner_api_key', apiKey);
      saveApiKeyBtn.textContent = '保存済み';
      setTimeout(() => saveApiKeyBtn.textContent = '保存', 1500);
    }
  });

  // モックデータ読み込み
  loadMockBtn.addEventListener('click', () => {
    hideError();
    displayResult(MOCK_RESULT);
  });

  // ファイル選択時
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showError('API Keyを入力してください');
      return;
    }

    fileName.textContent = file.name;
    showLoading(true);
    hideError();
    hideResult();

    try {
      const token = await uploadFile(file, apiKey);
      const result = await pollResult(token, apiKey);
      displayResult(result);
    } catch (err) {
      showError(err.message);
    } finally {
      showLoading(false);
    }
  });

  // 税率変更時
  taxRadios.forEach(radio => {
    radio.addEventListener('change', calculateTotal);
  });

  // コピーボタン
  copyButton.addEventListener('click', () => {
    const amount = totalAmount.textContent;
    navigator.clipboard.writeText(amount)
      .then(() => {
        copyButton.textContent = 'コピー済み';
        copyButton.classList.add('copied');
        setTimeout(() => {
          copyButton.textContent = 'コピー';
          copyButton.classList.remove('copied');
        }, 2000);
      })
      .catch(() => alert('コピーに失敗しました: ' + amount));
  });

  async function uploadFile(file, apiKey) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', 'receipt');
    formData.append('region', 'jp');

    let response;
    try {
      response = await fetch(`${WORKER_URL}/upload`, {
        method: 'POST',
        headers: { 'apikey': apiKey },
        body: formData
      });
    } catch (e) {
      throw new Error(`ネットワークエラー: ${e.message}`);
    }

    let data;
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`レスポンス解析エラー (${response.status}): ${text.slice(0, 200)}`);
    }

    if (!response.ok) {
      throw new Error(`アップロードエラー (${response.status}): ${JSON.stringify(data)}`);
    }
    if (!data.token) {
      throw new Error(`トークン未取得: ${JSON.stringify(data)}`);
    }
    return data.token;
  }

  async function pollResult(token, apiKey, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
      let response;
      try {
        response = await fetch(`${WORKER_URL}/result/${token}`, {
          method: 'GET',
          headers: { 'apikey': apiKey }
        });
      } catch (e) {
        throw new Error(`ネットワークエラー (attempt ${i + 1}): ${e.message}`);
      }

      let data;
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`レスポンス解析エラー (${response.status}): ${text.slice(0, 200)}`);
      }

      if (!response.ok) {
        throw new Error(`結果取得エラー (${response.status}): ${JSON.stringify(data)}`);
      }
      if (data.status === 'done') return data.result;
      if (data.status === 'failed') {
        throw new Error(`解析失敗: ${JSON.stringify(data)}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error(`タイムアウト: ${maxAttempts}秒経過。token=${token}`);
  }

  function displayResult(result) {
    items = [];
    itemsList.innerHTML = '';

    const lineItems = result.lineItems || [];
    if (lineItems.length === 0) {
      itemsList.innerHTML = '<p class="no-items">項目が見つかりませんでした</p>';
      resultArea.hidden = false;
      return;
    }

    lineItems.forEach((item, index) => {
      const name = item.descClean || item.desc || '不明な項目';
      const price = parseFloat(item.lineTotal || item.price) || 0;
      items.push({ name, price, mode: 'half' }); // none, half, full

      const itemEl = document.createElement('div');
      itemEl.className = 'item';
      itemEl.innerHTML = `
        <div class="item-info">
          <span class="item-name">${escapeHtml(name)}</span>
          <span class="item-price">${formatNumber(price)}円</span>
        </div>
        <div class="segment-control" data-index="${index}">
          <button data-mode="half" class="active">割勘</button>
          <button data-mode="full">立替</button>
          <button data-mode="none">除外</button>
        </div>
      `;

      itemEl.querySelectorAll('.segment-control button').forEach(btn => {
        btn.addEventListener('click', () => {
          itemEl.querySelectorAll('.segment-control button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          items[index].mode = btn.dataset.mode;
          calculateTotal();
        });
      });

      itemsList.appendChild(itemEl);
    });

    resultArea.hidden = false;
    calculateTotal();
  }

  function calculateTotal() {
    const taxRate = parseFloat(document.querySelector('input[name="tax-rate"]:checked')?.value || 0) / 100;
    const subtotal = items.reduce((sum, i) => {
      if (i.mode === 'half') return sum + i.price;
      if (i.mode === 'full') return sum + i.price * 2;
      return sum;
    }, 0);
    totalAmount.textContent = formatNumber(Math.round(subtotal * (1 + taxRate)));
  }

  function showLoading(show) { loading.hidden = !show; }
  function showError(msg) { error.textContent = msg; error.hidden = false; }
  function hideError() { error.hidden = true; }
  function hideResult() { resultArea.hidden = true; }
  function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }
  function formatNumber(n) { const num = Number(n); return isNaN(num) ? '0' : num.toLocaleString('ja-JP'); }
});
