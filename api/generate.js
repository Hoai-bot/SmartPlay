export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
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

  // Ưu tiên: API key từ biến môi trường Vercel > API key truyền từ client
  const apiKey = process.env.GEMINI_API_KEY || clientKey;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ' });
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

  const candidateModels = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest'
  ];

  let lastError = null;
  let rawText = '';

  for (const model of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\nYêu cầu từ phụ huynh: "${prompt}"` }] }],
          generationConfig: { temperature: 0.7, responseMimeType: 'application/json' }
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        lastError = new Error(`Model ${model} (${response.status}): ${errData.error?.message || response.statusText}`);
        continue;
      }

      const data = await response.json();
      rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (rawText) break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!rawText) {
    return res.status(502).json({ error: lastError ? lastError.message : 'Không thể kết nối đến máy chủ Google Gemini' });
  }

  try {
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi định dạng phản hồi từ AI', raw: rawText });
  }
}
