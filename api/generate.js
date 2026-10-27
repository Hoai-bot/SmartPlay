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

  // Ưu tiên: API key từ biến môi trường Vercel > API key truyền từ client
  const apiKey = process.env.GEMINI_API_KEY || clientKey;
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

  // Danh sách các model CHUẨN XÁC, không dùng model không tồn tại
  const candidateModels = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
  ];

  let lastError = null;
  let rawText = '';
  let statusCode = 502;

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
        statusCode = response.status;
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error?.message || response.statusText;
        lastError = new Error(errMsg);
        // Nếu lỗi 429 (Rate limit) thì dừng ngay để báo cho client đợi
        if (response.status === 429) {
          return res.status(429).json({ error: 'Hệ thống đang quá tải lượt tạo trong 1 phút (429 Rate Limit). Vui lòng đợi 5-10 giây rồi thử lại.' });
        }
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
    return res.status(statusCode).json({ error: lastError ? lastError.message : 'Không thể kết nối đến máy chủ Google Gemini' });
  }

  try {
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi định dạng JSON phản hồi từ AI', raw: rawText });
  }
}
