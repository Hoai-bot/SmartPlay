# 🧩 SmartPlay IC Da Lat - Rời Xa Màn Hình, Tự Chơi Say Mê

> **Trạm phát minh trò chơi 0 đồng** giúp trẻ em tự chơi độc lập, an toàn và rời xa thiết bị điện tử.  
> Ứng dụng web giáo dục nhẹ gọn, chạy hoàn toàn offline (Client-side), tối ưu hóa trải nghiệm cho phụ huynh hiện đại.

🌐 **Website chính thức:** [play.icdalat.edu.vn](https://play.icdalat.edu.vn)  
🏫 **Đơn vị bảo trợ:** Viện Nghiên Cứu & Đổi Mới Giáo Dục IC Da Lat (`icdalat.edu.vn`)

---

## 📖 Giới thiệu Dự án

Trong thời đại công nghệ số, phụ huynh gặp rất nhiều khó khăn trong việc giúp con rời xa màn hình điện thoại mà không phải liên tục mua đồ chơi tốn kém. **SmartPlay** ra đời nhằm giải quyết bài toán đó thông qua công thức 3 thành tố:

$$\text{Trò chơi} = \text{Vật dụng có sẵn (0đ)} + \text{Ngữ cảnh nhà ở} + \text{Cốt truyện/Nhiệm vụ}$$

Chỉ mất **30 - 60 giây kích hoạt ban đầu**, phụ huynh có thể yên tâm để con tự khám phá và vận động an toàn ngay trong tầm mắt.

---

## ✨ Tính Năng Nổi Bật

* 🎲 **Bốc Thăm Nhiệm Vụ 3D:** Hiệu ứng lật thẻ bài ngẫu nhiên theo độ tuổi và vị trí trong nhà (Phòng khách, Nhà bếp, Ban công...).
* 📚 **Kho Tàng 300 Trò Chơi Tự Chơi:** Tích hợp sẵn 300 kịch bản được phân loại khoa học theo 3 nhóm tuổi:
  * **1 - 3 tuổi:** Phát triển giác quan, vận động thô/tinh an toàn (không dị vật nhỏ).
  * **4 - 5 tuổi:** Phát triển trí tưởng tượng, đóng vai và thăng bằng.
  * **6 - 8 tuổi:** Tư duy STEM, logic và thử thách giải quyết vấn đề.
* 🛡️ **Cam Kết An Toàn & Miễn Trừ Pháp Lý (Clickwrap Modal):** Cảnh báo an toàn rõ ràng trên từng trò chơi và cam kết giám sát của người lớn trước khi sử dụng.
* ⏱️ **Đồng Hồ Đếm Giờ Tự Chơi (Play Timer):** Hẹn giờ 10, 15, 20 hoặc 30 phút để con rèn luyện tính độc lập.
* 🏆 **Game Hóa (Gamification) & Lưu Trữ Offline:** Tự động đếm giờ con rời xa màn hình, mở khóa 4 cấp bậc huy hiệu và lưu lịch sử trực tiếp trên trình duyệt (`localStorage`).

---

## 🛠️ Công Nghệ Sử Dụng

Dự án được xây dựng theo kiến trúc **Zero-Fee (0 đồng)**, không phụ thuộc vào máy chủ cơ sở dữ liệu đắt đỏ:

* **Frontend:** HTML5, Modern JavaScript (ES6+).
* **Styling:** [Tailwind CSS CDN](https://tailwindcss.com/), [FontAwesome 6 Icons](https://fontawesome.com/).
* **Hiệu ứng & UI:** Canvas Confetti, CSS 3D Transforms (`rotateY`).
* **Lưu trữ dữ liệu:** Trình duyệt nội bộ `localStorage` (hoạt động tốt cả khi mất mạng).
* **Hosting:** GitHub Pages / Vercel (kết nối CNAME Subdomain).

---

## 🚀 Hướng Dẫn Cài Đặt & Triển Khai (Deployment)

Toàn bộ ứng dụng được đóng gói trọn vẹn trong một file duy nhất: `index.html`.

### 1. Chạy trên máy cục bộ (Local)
1. Clone repository về máy:
   ```bash
   git clone [https://github.com/](https://github.com/)<tai-khoan-cua-ban>/<ten-repo>.git
