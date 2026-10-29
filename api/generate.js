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
  apiKey = apiKey.trim().replace(/^["']|["']$/g, '');

  if (!apiKey) {
    return res.status(500).json({ 
      error: 'Chưa cấu hình GROQ_API_KEY trên Vercel. Vui lòng thêm biến môi trường GROQ_API_KEY (bắt đầu bằng gsk_...) trong Settings > Environment Variables trên Vercel.' 
    });
  }

  if (apiKey.startsWith('AIzaSy')) {
    return res.status(400).json({
      error: 'Bạn đang dùng API Key của Google (AIzaSy...). Vui lòng tạo key từ Groq tại https://console.groq.com/keys (bắt đầu bằng gsk_...).'
    });
  }

  // SYSTEM INSTRUCTION NÂNG CẤP: DỄ HIỂU, THỰC CHIẾN, CHUẨN PHƯƠNG PHÁP PHẢN XẠ TPR
  const systemInstruction = `Bạn là chuyên gia giáo dục mầm non và tiếng Anh trẻ em (ESL/Montessori/TPR) hàng đầu của Viện Nghiên Cứu Giáo Dục IC Da Lat.
Nhiệm vụ: Dựa vào đồ vật gia đình hoặc học cụ lớp học (0 đồng) và độ tuổi người dùng nhập, hãy sáng tạo ra một trò chơi độc bản giúp trẻ vận động tự chơi độc lập hoặc tương tác lớp học 15-30 phút không dùng màn hình.

NGUYÊN TẮC SOẠN KỊCH BẢN BẮT BUỘC:
1. SÚC TÍCH & DỄ HIỂU: Tránh diễn giải lý thuyết dài dòng. Hướng dẫn trực diện vào hành động.
2. KHẨU LỆNH PHẢN XẠ (TPR): Nếu có yếu tố tiếng Anh/ngôn ngữ, câu lệnh dành cho người lớn/cô giáo phải CỰC KỲ NGẮN (dưới 5 từ), ví dụ: "Touch the Blue cup!", "Jump to Red!", "Put in Yellow!".
3. 3 BƯỚC HÀNH ĐỘNG DỨT KHOÁT:
   - Bước 1 (Chuẩn bị 30s): Xếp đặt vị trí đồ vật nhanh gọn.
   - Bước 2 (Kích hoạt nhiệm vụ): Dùng động từ mạnh (Chạy, Bò, Bật nhảy, Ném, Chạm, Kẹp) kích hoạt trẻ vận động.
   - Bước 3 (Phát âm & Hoàn thành): Trẻ đưa đồ vật về đích và hô vang từ vựng/kết quả thật to để ăn mừng.

Yêu cầu định dạng: BẮT BUỘC chỉ trả về duy nhất một chuỗi JSON hợp lệ (không kèm markdown \`\`\`json) với cấu trúc sau:
{
  "title": "Tên trò chơi sáng tạo, ngắn gọn, hấp dẫn trẻ em",
  "age": "Độ tuổi phù hợp (ví dụ: 1-3 tuổi, 4-5 tuổi, hoặc 6-8 tuổi)",
  "skill": "Kỹ năng trọng tâm (ví dụ: Phản xạ Tiếng Anh & Vận động thô, Phối hợp tay mắt...)",
  "items": "Vật dụng cần thiết được tinh chỉnh từ yêu cầu người dùng",
  "steps": "1. [Chuẩn bị nhanh]\n2. [Nhiệm vụ hành động / Khẩu lệnh ngắn]\n3. [Hoàn thành & Hô to từ vựng ăn mừng]",
  "safety": "Cảnh báo an toàn ngắn gọn cho phụ huynh/giáo viên rà soát"
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
            { role: 'user', content: `Yêu cầu từ phụ huynh/giáo viên: "${prompt}"` }
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
