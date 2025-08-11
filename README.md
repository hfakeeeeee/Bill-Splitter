# Bill Splitter - Ứng dụng tính tiền ăn nhóm

Một ứng dụng web hiện đại để tính toán tiền ăn nhóm một cách thông minh và công bằng.

## Tính năng

- 📊 **Tính toán thông minh**: Tự động tính phần trăm giảm giá dựa trên voucher và phí ship
- 👥 **Quản lý thành viên**: Thêm/xóa thành viên dễ dàng
- 💰 **Tính tiền tự động**: Tự động tính số tiền mỗi người phải trả
- 📱 **Responsive**: Hoạt động tốt trên mọi thiết bị
- 🎨 **Giao diện hiện đại**: Thiết kế đẹp mắt với gradient và animation
- 💾 **Lưu trữ dữ liệu**: Tự động lưu và khôi phục dữ liệu khi refresh trang
- ✅ **Kiểm tra tổng tiền**: Tự động kiểm tra và cảnh báo khi tổng tiền không khớp
- 🗑️ **Xóa dữ liệu**: Nút xóa tất cả dữ liệu để bắt đầu mới
- 💳 **QR Code chuyển khoản**: Hiển thị QR code để thanh toán
- ✅ **Đánh dấu đã trả tiền**: Theo dõi ai đã trả tiền rồi

## Cách sử dụng

### 1. Nhập thông tin đơn hàng
- **Tổng tiền đơn**: Số tiền tổng cộng của đơn hàng
- **Tiền giảm giá voucher**: Số tiền được giảm từ voucher
- **Tiền ship**: Phí vận chuyển

### 2. Thêm thành viên
- Nhấn "Thêm thành viên" để thêm người mới
- Nhập tên và giá gốc của món ăn cho từng người
- Ứng dụng sẽ tự động tính số tiền phải trả

### 3. Đánh dấu đã trả tiền
- Nhấn vào icon thẻ tín dụng bên cạnh tên thành viên
- Icon sẽ chuyển thành dấu tích xanh khi đã trả tiền
- Thành viên đã trả tiền sẽ có background màu xanh nhạt

### 4. Hiển thị QR Code
- Khi có người chưa trả tiền, phần QR Code sẽ xuất hiện
- Chọn ngân hàng từ dropdown menu
- Nhấn "Hiện QR" để xem mã QR chuyển khoản
- Nhấn "Ẩn QR" để ẩn đi

### 5. Kiểm tra tổng tiền
- Ứng dụng sẽ tự động kiểm tra tổng tiền của các thành viên có khớp với tổng tiền đơn không
- Hiển thị thông báo:
  - ✅ **Xanh**: Tổng tiền khớp chính xác
  - ⚠️ **Vàng**: Tổng tiền gần đúng (sai số nhỏ)
  - ❌ **Đỏ**: Tổng tiền không khớp (cần kiểm tra lại)

### 6. Công thức tính toán
```
Phần trăm giảm = (Tiền giảm giá - Tiền ship) / Tổng tiền đơn × 100%
Tiền phải trả = Giá gốc × (1 - Phần trăm giảm)
```

## Tính năng lưu trữ

- **Tự động lưu**: Dữ liệu được lưu tự động vào localStorage của trình duyệt
- **Khôi phục**: Khi refresh trang, dữ liệu sẽ được khôi phục tự động
- **Xóa dữ liệu**: Nhấn nút "Xóa tất cả" để xóa toàn bộ dữ liệu và bắt đầu mới

## Cài đặt QR Codes

1. **Tạo thư mục**: Tạo thư mục `public/qr-codes/` trong dự án
2. **Thêm QR codes**: Đặt các file QR code với tên:
   - `momo.png` - QR code MoMo
   - `vcb.png` - QR code Vietcombank
   - `tcb.png` - QR code Techcombank
   - `acb.png` - QR code ACB
   - `mb.png` - QR code MB Bank
3. **Định dạng**: Chỉ hỗ trợ file PNG, JPG, JPEG

## Cài đặt và chạy

1. **Cài đặt dependencies:**
```bash
npm install
```

2. **Chạy ứng dụng:**
```bash
npm start
```

3. **Mở trình duyệt:**
Truy cập [http://localhost:3000](http://localhost:3000)

## Công nghệ sử dụng

- **React 18**: Framework JavaScript hiện đại
- **CSS3**: Styling với gradient và animation
- **Lucide React**: Icons đẹp mắt
- **LocalStorage**: Lưu trữ dữ liệu cục bộ
- **Responsive Design**: Tương thích mọi thiết bị

## Ví dụ sử dụng

**Tình huống**: Đặt đồ ăn nhóm với 4 người
- Tổng tiền: 500,000 VNĐ
- Voucher giảm: 50,000 VNĐ  
- Phí ship: 20,000 VNĐ
- Phần trăm giảm: (50,000 - 20,000) / 500,000 = 6%

**Kết quả**: Mỗi người sẽ được giảm 6% trên giá gốc của mình!

## Hosting

Ứng dụng có thể được host trên các nền tảng:
- **Vercel**: Deploy tự động từ GitHub
- **Netlify**: Drag & drop build folder
- **GitHub Pages**: Host static files
- **Firebase Hosting**: Hosting của Google

## Tác giả

Ứng dụng được tạo để giải quyết vấn đề tính tiền ăn nhóm một cách công bằng và minh bạch. 