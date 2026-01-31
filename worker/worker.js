export default {
  async fetch(request, env) {
    // CORSヘッダー
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, apikey',
    };

    // OPTIONSリクエスト（プリフライト）
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // /upload → TabScanner process API
    if (path === '/upload' && request.method === 'POST') {
      const apiKey = request.headers.get('apikey');
      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'API Key required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const formData = await request.formData();

      const response = await fetch('https://api.tabscanner.com/api/2/process', {
        method: 'POST',
        headers: { 'apikey': apiKey },
        body: formData
      });

      const data = await response.text();
      return new Response(data, {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // /result/:token → TabScanner result API
    if (path.startsWith('/result/') && request.method === 'GET') {
      const token = path.replace('/result/', '');
      const apiKey = request.headers.get('apikey');

      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'API Key required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const response = await fetch(`https://api.tabscanner.com/api/result/${token}`, {
        method: 'GET',
        headers: { 'apikey': apiKey }
      });

      const data = await response.text();
      return new Response(data, {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};
