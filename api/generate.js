export const maxDuration = 30; // Cho phép Vercel Serverless Function chạy tối đa 30s

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

  // Lấy API key và làm sạch khoảng trắng / dấu nháy kép thừa nếu có
  let apiKey = process.env.GEMINI_API_KEY || clientKey || '';
  apiKey = apiKey.trim().replace(/^[\"\']|[\"\']$/g, '');

  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên Vercel hoặc chưa nhập Key' });
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

  // Thử các endpoint chính thức hỗ trợ generateContent:
  // v1/models/gemini-1.5-flash (bản ổn định GA)
  // v1beta/models/gemini-2.0-flash (bản mới nhất)
  // v1/models/gemini-2.0-flash
  const candidateConfigs = [
    { version: 'v1', model: 'gemini-1.5-flash' },
    { version: 'v1beta', model: 'gemini-2.0-flash' },
    { version: 'v1', model: 'gemini-2.0-flash' },
    { version: 'v1beta', model: 'gemini-1.5-flash' }
  ];

  let errors = [];
  let rawText = '';
  let finalStatusCode = 502;

  for (const { version, model } of candidateConfigs) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\nYêu cầu từ phụ huynh: "${prompt}"` }] }],
          generationConfig: { temperature: 0.7, responseMimeType: 'application/json' }
        })
      });

      if (!response.ok) {
        finalStatusCode = response.status;
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error?.message || response.statusText;
        errors.push(`${model}(${version}): ${errMsg}`);

        // Nếu gặp lỗi 429 (Rate Limit) hoặc 400 (API Key không hợp lệ) thì phản hồi ngay
        if (response.status === 429) {
          return res.status(429).json({ error: 'Google API đang bị quá tải lượt gọi trong 1 phút (429 Rate Limit). Vui lòng đợi 5-10 giây rồi thử lại.' });
        }
        if (response.status === 400 && errMsg.includes('API_KEY_INVALID')) {
          return res.status(400).json({ error: 'API Key không hợp lệ. Vui lòng kiểm tra lại key trên Vercel.' });
        }
        continue;
      }

      const data = await response.json();
      rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (rawText) break;
    } catch (err) {
      errors.push(`${model}(${version}): ${err.message}`);
    }
  }

  if (!rawText) {
    return res.status(finalStatusCode).json({ 
      error: errors.length > 0 ? errors[0] : 'Không thể kết nối đến máy chủ Google Gemini' 
    });
  }

  try {
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi định dạng JSON phản hồi từ AI', raw: rawText });
  }
}
