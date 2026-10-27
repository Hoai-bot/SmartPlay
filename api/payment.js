// Serverless Function xử lý Webhook thanh toán và Polling kiểm tra trạng thái
// Hỗ trợ kết nối SePay (sepay.vn), Casso (casso.vn) hoặc Webhook ngân hàng tự động

// Bộ nhớ đệm tạm thời cho các giao dịch thành công (In-Memory Cache)
const paidOrders = global._smartplayPaidOrders || (global._smartplayPaidOrders = new Map());

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 1. WEBHOOK TỪ SEPAY / CASSO / NGÂN HÀNG (POST)
  if (req.method === 'POST') {
    try {
      const data = req.body || {};
      
      // Hỗ trợ format SePay: data.content, data.transferAmount, data.accountNumber
      // Hỗ trợ format Casso: data.data[].description, data.data[].amount
      let content = (data.content || data.description || '').toUpperCase();
      let amount = parseFloat(data.transferAmount || data.amount || 0);
      let accountNumber = String(data.accountNumber || data.subAccount || '');

      // Nếu là format payload mảng của Casso
      if (Array.isArray(data.data) && data.data.length > 0) {
        content = (data.data[0].description || '').toUpperCase();
        amount = parseFloat(data.data[0].amount || 0);
        accountNumber = String(data.data[0].accountNumber || '');
      }

      // Tìm mã đơn hàng có dạng SP + số (ví dụ: SP4821, SP9999...)
      const match = content.match(/SP\d{4,6}/);
      if (match) {
        const orderCode = match[0];
        // Lưu trạng thái đã thanh toán
        paidOrders.set(orderCode, {
          paid: true,
          amount: amount,
          time: new Date().toISOString(),
          accountNumber: accountNumber
        });
        
        console.log(`[PAYMENT WEBHOOK] Kích hoạt thành công đơn hàng: ${orderCode} - Số tiền: ${amount}`);
        return res.status(200).json({ success: true, message: `Activated ${orderCode}` });
      }

      return res.status(200).json({ success: true, message: 'Received webhook, no matching order code found' });
    } catch (err) {
      console.error('[PAYMENT WEBHOOK ERROR]', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // 2. CLIENT POLLING KIỂM TRA ĐƠN HÀNG (GET /api/payment?orderCode=SP1234)
  if (req.method === 'GET') {
    const { orderCode } = req.query || {};
    if (!orderCode) {
      return res.status(400).json({ error: 'Thiếu tham số orderCode' });
    }

    const cleanCode = String(orderCode).trim().toUpperCase();

    // Kiểm tra trong bộ nhớ đệm Webhook
    if (paidOrders.has(cleanCode)) {
      const info = paidOrders.get(cleanCode);
      return res.status(200).json({ success: true, paid: true, data: info });
    }

    // Nếu cấu hình SEPAY_API_KEY trên Vercel: Kiểm tra trực tiếp API SePay theo thời gian thực
    const sepayKey = process.env.SEPAY_API_KEY;
    if (sepayKey) {
      try {
        const sepayRes = await fetch('https://my.sepay.vn/userapi/transactions/list?limit=20', {
          headers: { 'Authorization': `Bearer ${sepayKey.trim()}` }
        });
        if (sepayRes.ok) {
          const transData = await sepayRes.json();
          const list = transData.messages || transData.transactions || [];
          const matchedTrans = list.find(t => {
            const desc = (t.transaction_content || t.description || '').toUpperCase();
            return desc.includes(cleanCode);
          });

          if (matchedTrans) {
            paidOrders.set(cleanCode, {
              paid: true,
              amount: matchedTrans.amount_in || matchedTrans.transferAmount,
              time: matchedTrans.transaction_date
            });
            return res.status(200).json({ success: true, paid: true, data: matchedTrans });
          }
        }
      } catch (e) {
        console.warn('Lỗi kiểm tra SePay API:', e);
      }
    }

    return res.status(200).json({ success: true, paid: false });
  }

  return res.status(405).json({ error: 'Phương thức không được hỗ trợ' });
}
