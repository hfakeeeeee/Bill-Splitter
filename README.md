# Bill Splitter - Ứng dụng tính tiền ăn nhóm

Một ứng dụng web hiện đại để tính toán tiền ăn nhóm một cách thông minh và công bằng với tính năng chia sẻ real-time.

## ✨ Tính năng chính

### 🧮 Tính toán & Quản lý
- 📊 **Tính toán thông minh**: Tự động tính phần trăm giảm giá dựa trên voucher và phí ship
- 👥 **Quản lý thành viên**: Thêm/xóa thành viên dễ dàng với pagination
- 💰 **Tính tiền tự động**: Tự động tính số tiền mỗi người phải trả
- ✅ **Theo dõi thanh toán**: Đánh dấu ai đã trả tiền với visual feedback

### 🌐 Chia sẻ & Collaboration  
- 🔗 **Chia sẻ live**: Tạo link chia sẻ cho nhóm với real-time sync
- ⚡ **Real-time updates**: Thay đổi được cập nhật ngay lập tức cho tất cả thành viên
- 📋 **Copy link dễ dàng**: Nút copy tóm tắt để chia sẻ nhanh chóng
- 🔒 **Quyền hạn**: Người tạo có thể chỉnh sửa, người tham gia chỉ xem

### 💾 Lưu trữ & Sync
- 🗂️ **Multi-sheet**: Quản lý nhiều bill khác nhau
- 💾 **Auto-save**: Tự động lưu và đồng bộ dữ liệu
- 🔄 **Supabase integration**: Database cloud với real-time sync
- 📱 **Offline support**: Vẫn hoạt động khi mất mạng

### 🎨 Giao diện & UX
- 📱 **Responsive design**: Hoạt động tốt trên mọi thiết bị
- 🎨 **Giao diện hiện đại**: Thiết kế đẹp mắt với gradient và animation
- 🌙 **Dark theme**: Giao diện tối dễ nhìn
- ⚡ **Performance optimized**: Load nhanh với lazy loading

### 💳 Thanh toán & QR
- � **QR Code tùy chỉnh**: Upload và quản lý QR code riêng
- 🏦 **Multi-bank support**: Hỗ trợ nhiều ngân hàng phổ biến
- 💳 **Smart QR display**: Hiển thị QR phù hợp với số tiền còn thiếu

## 🚀 Cách sử dụng

### 1. Tạo và quản lý Bill
- **Tạo sheet mới**: Nhấn "Sheet mới" để tạo bill mới
- **Đổi tên sheet**: Nhấn "Đổi tên" để đặt tên cho bill
- **Chuyển đổi sheet**: Dùng dropdown để chuyển qua lại giữa các bill

### 2. Nhập thông tin đơn hàng
- **Tổng tiền đơn**: Số tiền tổng cộng của đơn hàng
- **Tiền giảm giá voucher**: Số tiền được giảm từ voucher  
- **Tiền ship**: Phí vận chuyển
- **Tự động tính**: Phần trăm giảm giá được tính tự động

### 3. Quản lý thành viên
- **Thêm thành viên**: Nhấn "Thêm" hoặc nhập tên và giá rồi Enter
- **Chỉnh sửa**: Click vào tên hoặc giá để chỉnh sửa inline
- **Xóa thành viên**: Nhấn nút X đỏ bên cạnh thành viên
- **Pagination**: Dùng "Trước/Sau" để xem nhiều thành viên

### 4. Theo dõi thanh toán
- **Đánh dấu đã trả**: Nhấn icon thẻ tín dụng → chuyển thành ✅
- **Visual feedback**: Thành viên đã trả có background xanh
- **Filter**: Tick "Chỉ hiện chưa trả" để lọc nhanh
- **Tổng quan**: Xem tổng số đã trả/chưa trả ở tab Tổng quan

### 5. Chia sẻ real-time
- **Tạo link chia sẻ**: Nhấn "Chia sẻ live" 
- **Copy link**: Dùng "Copy tóm tắt" để gửi cho nhóm
- **Real-time sync**: Mọi thay đổi được đồng bộ ngay lập tức
- **Collaborative**: Nhiều người có thể xem và cập nhật cùng lúc

### 6. QR Code thanh toán
- **QR tùy chỉnh**: Upload QR riêng qua "Thêm QR"
- **Chọn QR**: Dropdown chọn QR phù hợp
- **Hiển thị**: Nhấn "Hiện QR" để xem mã thanh toán
- **Smart display**: QR chỉ hiện khi còn người chưa trả

## 🧮 Công thức tính toán

```
Phần trăm giảm = (Tiền giảm giá - Tiền ship) / Tổng tiền đơn × 100%
Tiền phải trả = Giá gốc × (1 - Phần trăm giảm)
Số tiền thiếu = Tổng tiền các thành viên chưa trả
```

### Kiểm tra tổng tiền tự động
- ✅ **Xanh**: Tổng tiền khớp chính xác  
- ⚠️ **Vàng**: Tổng tiền gần đúng (sai số < 1000 VNĐ)
- ❌ **Đỏ**: Tổng tiền không khớp (cần kiểm tra lại)

## 🔧 Cài đặt và chạy

### Prerequisites
```bash
Node.js >= 16.0.0
npm >= 8.0.0
```

### Development
```bash
# Clone repository
git clone https://github.com/hfakeeeeee/Bill-Splitter.git
cd Bill-Splitter

# Cài đặt dependencies
npm install

# Chạy development server
npm start

# Mở trình duyệt: http://localhost:3000
```

### Production Build
```bash
# Build cho production
npm run build

# Deploy lên GitHub Pages  
npm run deploy
```

## ⚙️ Cấu hình Environment

### Supabase Setup (Optional)
1. Tạo project tại [supabase.com](https://supabase.com)
2. Tạo file `.env.local`:
```bash
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
REACT_APP_ENV=production
```
3. Khởi động lại server

### QR Codes Setup
1. **Default QR codes**: Đặt trong `public/qr-codes/`
   - `momo.png`, `vcb.png`, `tcb.png`, `acb.png`, `mb.png`
2. **Custom QR codes**: Upload trực tiếp trong app

## 🛠️ Công nghệ sử dụng

### Frontend
- **React 18**: Framework JavaScript hiện đại với hooks
- **CSS3**: Advanced styling với variables, grid, flexbox
- **Lucide React**: Beautiful icon library  
- **Responsive Design**: Mobile-first approach

### Backend & Database  
- **Supabase**: PostgreSQL database với real-time sync
- **Real-time subscriptions**: WebSocket cho live updates
- **localStorage**: Fallback storage cho offline mode

### Development & Deploy
- **Create React App**: Zero-config build setup
- **GitHub Pages**: Static hosting với CI/CD
- **ESLint**: Code quality và consistency

## 📱 Browser Support

| Browser | Version | Status |
|---------|---------|---------|
| Chrome | 90+ | ✅ Full support |
| Firefox | 88+ | ✅ Full support |
| Safari | 14+ | ✅ Full support |
| Edge | 90+ | ✅ Full support |
| Mobile Safari | iOS 14+ | ✅ Optimized |
| Chrome Mobile | Android 8+ | ✅ Optimized |

## 📊 Performance

- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s  
- **Time to Interactive**: < 3.0s
- **Bundle size**: < 500KB gzipped
- **Lighthouse Score**: 95+ performance

## 🎯 Use Cases

### Personal Use
- 👨‍👩‍👧‍👦 **Family dinners**: Chia tiền ăn gia đình
- 🍕 **Friend gatherings**: Tính tiền party, picnic
- 🎂 **Special occasions**: Sinh nhật, celebration

### Business Use  
- 🏢 **Office lunch**: Team lunch, company events
- 🎓 **Student groups**: Group study, club activities
- 🏘️ **Community events**: Neighborhood gatherings

### Advanced Features
- 📈 **Large groups**: Hỗ trợ 100+ thành viên với pagination
- 🔄 **Multiple bills**: Quản lý nhiều bill cùng lúc
- 🌐 **Remote collaboration**: Real-time cho team phân tán

## 🎨 Design System

### Color Palette
```css
Primary: #6d5efc (Purple)
Success: #22c55e (Green)  
Warning: #f59e0b (Orange)
Danger: #ef4444 (Red)
Background: Gradient dark theme
```

### Typography
- **Font**: Inter (system fallback)
- **Sizes**: 8px - 24px responsive scale
- **Weights**: 400, 500, 600, 700

### Layout
- **Grid**: CSS Grid với responsive breakpoints
- **Spacing**: 4px base unit system
- **Components**: Modular, reusable design

## 🤝 Contributing

1. **Fork** repository này
2. **Create** feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** changes: `git commit -m 'Add amazing feature'`  
4. **Push** to branch: `git push origin feature/amazing-feature`
5. **Open** Pull Request

### Development Guidelines
- Follow existing code style
- Add tests for new features
- Update documentation
- Ensure responsive design
- Test on multiple browsers

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

## 👨‍💻 Author

**Made by HFake**

- 📧 Email: [Contact](mailto:huynguyenquoc.work@gmail.com)
- 🌐 GitHub: [@hfakeeeeee](https://github.com/hfakeeeeee)
- 📱 Facebook: [HFake](https://www.facebook.com/HFakeee/)

## 🙏 Acknowledgments

- React team cho amazing framework
- Supabase cho real-time database  
- Lucide cho beautiful icons
- Community feedback và suggestions

---

⭐ **Star this repository** nếu project hữu ích cho bạn! 