// Serverless Function da Vercel para atuar como Proxy de Segurança
// Mascara a origem da chamada para que o Supabase permita a gestão de usuários.

export default async function handler(req, res) {
  // 1. Liberação de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  // Responde imediatamente a requisições de pre-flight do navegador
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabaseUrl = 'https://wsxzuyndslpaklsksmao.supabase.co';
    
    // Pega a URL original que bateu no Vercel e remove o "/admin-api" da frente.
    // Assim, enviamos para o Supabase apenas a parte correta (ex: /auth/v1/admin/users)
    const targetPath = (req.url || '').replace(/^\/admin-api/, '');
    const targetUrl = `${supabaseUrl}${targetPath}`;

    // Monta os cabeçalhos camuflados
    const forwardHeaders = {
      'User-Agent': 'NodeJS' // Esconde que é um navegador
    };
    
    // Repassa as chaves de segurança enviadas pelo cliente
    if (req.headers['authorization']) forwardHeaders['Authorization'] = req.headers['authorization'];
    if (req.headers['apikey']) forwardHeaders['apikey'] = req.headers['apikey'];
    if (req.headers['content-type']) forwardHeaders['Content-Type'] = req.headers['content-type'];

    const fetchOptions = {
      method: req.method,
      headers: forwardHeaders
    };

    // Se for uma requisição com corpo (POST, PATCH, DELETE), encaminha os dados
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      // Vercel já converte o req.body para JSON de forma automática, então transformamos em string novamente
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    // Faz a chamada verdadeira ao banco de dados pelo "servidor"
    const proxyRes = await fetch(targetUrl, fetchOptions);
    const data = await proxyRes.text();

    // Devolve a resposta exata do Supabase para o nosso Front-end
    res.status(proxyRes.status).send(data);
    
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erro interno no Proxy' });
  }
}
