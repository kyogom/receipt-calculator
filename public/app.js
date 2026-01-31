document.addEventListener('DOMContentLoaded', () => {
  const WORKER_URL = 'https://receipt-proxy.kyogom.workers.dev';

  const MOCK_RESULT = {"establishment":"まいばすけっと","validatedEstablishment":false,"date":"","total":1296,"url":"","phoneNumber":"","paymentMethod":"","address":"","cash":0,"change":0,"validatedTotal":false,"subTotal":1201,"validatedSubTotal":true,"tax":0,"tip":0,"taxes":[],"serviceCharges":[],"discount":0,"rounding":0,"discounts":[],"lineItems":[{"qty":0,"desc":"有料 レジ 袋 M","unit":"","price":0,"symbols":[],"discount":0,"lineType":"","descClean":"有料 レジ 袋 M","lineTotal":3,"productCode":"","customFields":{}},{"qty":0,"desc":"雪 メグ 牧場 の 朝","unit":"","price":0,"symbols":["*"],"discount":0,"lineType":"","descClean":"雪 メグ 牧場 の 朝","lineTotal":119,"productCode":"","customFields":{}},{"qty":0,"desc":"割 引 30%","unit":"","price":0,"symbols":["-"],"discount":0,"lineType":"","descClean":"割 引 30%","lineTotal":-36,"productCode":"","customFields":{}},{"qty":0,"desc":"マネケン チョコレート","unit":"","price":0,"symbols":["*"],"discount":0,"lineType":"","descClean":"マネケン チョコレート","lineTotal":159,"productCode":"","customFields":{}},{"qty":0,"desc":"ルヴァン 黒糖 入り","unit":"","price":0,"symbols":["*"],"discount":0,"lineType":"","descClean":"ルヴァン 黒糖 入り","lineTotal":179,"productCode":"","customFields":{}},{"qty":1,"desc":"1 日 分 緑黄色 野菜 サラダ","unit":"","price":0,"symbols":[],"discount":0,"lineType":"","descClean":"日 分 緑黄色 野菜 サラダ","lineTotal":299,"productCode":"","customFields":{}},{"qty":0,"desc":"濃厚 好き W チーズカレー","unit":"","price":0,"symbols":["※","A"],"discount":0,"lineType":"","descClean":"濃厚 好き W チーズカレー","lineTotal":279,"productCode":"","customFields":{}},{"qty":0,"desc":"クノール トマト の ポター","unit":"","price":0,"symbols":["*","B"],"discount":0,"lineType":"","descClean":"クノール トマト の ポター","lineTotal":199,"productCode":"","customFields":{}}],"summaryItems":[],"customFields":{"Currency":"JPY"},"documentType":"receipt","currency":"JPY"};

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

    const response = await fetch(`${WORKER_URL}/upload`, {
      method: 'POST',
      headers: { 'apikey': apiKey },
      body: formData
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || 'アップロードに失敗しました');
    if (!data.token) throw new Error('トークンが取得できませんでした');
    return data.token;
  }

  async function pollResult(token, apiKey, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch(`${WORKER_URL}/result/${token}`, {
        method: 'GET',
        headers: { 'apikey': apiKey }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || '結果の取得に失敗しました');
      if (data.status === 'done') return data.result;
      if (data.status === 'failed') throw new Error('解析に失敗しました');

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('タイムアウト: 解析に時間がかかりすぎています');
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
      items.push({ name, price, checked: false });

      const itemEl = document.createElement('div');
      itemEl.className = 'item';
      itemEl.innerHTML = `
        <input type="checkbox" id="item-${index}" data-index="${index}">
        <label for="item-${index}" class="item-name">${escapeHtml(name)}</label>
        <span class="item-price">${formatNumber(price)}円</span>
      `;

      itemEl.querySelector('input').addEventListener('change', (e) => {
        items[index].checked = e.target.checked;
        calculateTotal();
      });

      itemsList.appendChild(itemEl);
    });

    resultArea.hidden = false;
    calculateTotal();
  }

  function calculateTotal() {
    const taxRate = parseFloat(document.querySelector('input[name="tax-rate"]:checked')?.value || 0) / 100;
    const subtotal = items.filter(i => i.checked).reduce((sum, i) => sum + i.price, 0);
    totalAmount.textContent = formatNumber(Math.round(subtotal * (1 + taxRate)));
  }

  function showLoading(show) { loading.hidden = !show; }
  function showError(msg) { error.textContent = msg; error.hidden = false; }
  function hideError() { error.hidden = true; }
  function hideResult() { resultArea.hidden = true; }
  function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }
  function formatNumber(n) { const num = Number(n); return isNaN(num) ? '0' : num.toLocaleString('ja-JP'); }
});
