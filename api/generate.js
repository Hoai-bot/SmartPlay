export const maxDuration = 30;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Chỉ chấp nhận phương thức POST' });
  }

  const { prompt, apiKey: clientKey } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: 'Thiếu nội dung prompt' });
  }

  // Lấy API key Groq từ biến môi trường Vercel hoặc client
  let apiKey = process.env.GROQ_API_KEY || clientKey || '';
  apiKey = apiKey.trim().replace(/^[\"\']|[\"\']$/g, '');

  if (!apiKey) {
    return res.status(500).json({ 
      error: 'Chưa cấu hình GROQ_API_KEY trên Vercel. Vui lòng thêm biến môi trường GROQ_API_KEY (bắt đầu bằng gsk_...) trong Settings > Environment Variables trên Vercel.' 
    });
  }

  // Kiểm tra nếu người dùng vô tình dán nhầm key Google (AIzaSy...)
  if (apiKey.startsWith('AIzaSy')) {
    return res.status(400).json({
      error: 'Bạn đang dùng API Key của Google (AIzaSy...). Vui lòng tạo key từ Groq tại https://console.groq.com/keys (bắt đầu bằng gsk_...).'
    });
  }

  const systemInstruction = `Bạn là chuyên gia giáo dục mầm non quốc tế hàng đầu (Montessori, Reggio Emilia, STEM) của Viện Nghiên Cứu Giáo Dục IC Da Lat.
Nhiệm vụ: Dựa vào đồ vật gia đình 0 đồng và độ tuổi người dùng nhập, hãy sáng tạo ra một trò chơi độc bản giúp trẻ tự chơi độc lập 15-30 phút không dùng màn hình điện thoại.

Yêu cầu định dạng: BẮT BUỘC chỉ trả về duy nhất một chuỗi JSON hợp lệ (không kèm markdown \`\`\`json) với cấu trúc sau:
{
  "title": "Tên trò chơi sáng tạo, hấp dẫn trẻ em",
  "age": "Độ tuổi phù hợp (ví dụ: 1-3 tuổi, 4-5 tuổi, hoặc 6-8 tuổi)",
  "skill": "Kỹ năng trọng tâm (ví dụ: Vận động tinh, Tư duy STEM, Phối hợp tay mắt...)",
  "items": "Vật dụng cần thiết được tinh chỉnh từ yêu cầu người dùng",
  "steps": "1. [Bước chuẩn bị]\n2. [Bước kích hoạt nhiệm vụ]\n3. [Bước phát triển/hoàn thành]",
  "safety": "Cảnh báo an toàn bắt buộc cho phụ huynh rà soát"
}`;

  // 1. Tự động truy vấn danh sách model đang hoạt động thực tế trên tài khoản Groq của bạn
  let availableModels = [];
  try {
    const listRes = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (listRes.ok) {
      const listData = await listRes.json();
      availableModels = (listData.data || []).map(m => m.id);
    }
  } catch (e) {
    console.warn("Không thể lấy danh sách model tự động:", e);
  }

  // Các model ưu tiên theo thứ tự
  const preferredModels = [
    'llama-3.3-70b-versatile',
    'llama-3.1-70b-versatile',
    'llama-3.1-8b-instant',
    'llama3-70b-8192',
    'llama3-8b-8192',
    'mixtral-8x7b-32768',
    'gemma2-9b-it'
  ];

  // Lọc lấy các model có sẵn trong tài khoản, nếu không lấy được list thì thử danh sách mặc định
  let modelsToTry = preferredModels.filter(m => availableModels.includes(m));
  if (modelsToTry.length === 0) {
    modelsToTry = availableModels.length > 0 ? availableModels.slice(0, 4) : preferredModels;
  }

  let lastError = null;
  let parsedResult = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: `Yêu cầu từ phụ huynh: "${prompt}"` }
          ],
          temperature: 0.6,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error?.message || response.statusText;
        lastError = new Error(`Groq (${model}): ${errMsg}`);
        continue;
      }

      const data = await response.json();
      const rawText = data.choices?.[0]?.message?.content || '{}';
      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedResult = JSON.parse(cleanJson);
      if (parsedResult && parsedResult.title) break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!parsedResult) {
    return res.status(502).json({ 
      error: lastError ? lastError.message : 'Không thể kết nối đến máy chủ Groq AI' 
    });
  }

  return res.status(200).json(parsedResult);
}
