import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calculator, Users, Receipt, AlertTriangle, CheckCircle, CreditCard, X } from 'lucide-react';
import './App.css';

function App() {
  const [billData, setBillData] = useState({
    totalAmount: '',
    discount: '',
    shipping: ''
  });

  const [members, setMembers] = useState([
    { id: 1, name: '', originalPrice: '', finalPrice: '', paid: false }
  ]);

  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [validationMessage, setValidationMessage] = useState('');
  const [validationType, setValidationType] = useState(''); // 'success', 'error', 'warning'
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [selectedQR, setSelectedQR] = useState('momo');

  // Danh sách QR codes có sẵn
  const qrCodes = [
    { id: 'Dat', name: 'Dat', file: 'Dat.png' },
    { id: 'Huy', name: 'Huy', file: 'Huy.png' },
    { id: 'Nguyen', name: 'Nguyen', file: 'Nguyen.png' },
    { id: 'Quang', name: 'Quang', file: 'Quang.png' },
    { id: 'Thu', name: 'Thu', file: 'Thu.png' }
  ];

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedBillData = localStorage.getItem('billSplitter_billData');
    const savedMembers = localStorage.getItem('billSplitter_members');
    const savedQR = localStorage.getItem('billSplitter_selectedQR');
    
    if (savedBillData) {
      try {
        setBillData(JSON.parse(savedBillData));
      } catch (error) {
        console.error('Error loading bill data:', error);
      }
    }
    
    if (savedMembers) {
      try {
        setMembers(JSON.parse(savedMembers));
      } catch (error) {
        console.error('Error loading members data:', error);
      }
    }

    if (savedQR) {
      setSelectedQR(savedQR);
    }
    
    setIsDataLoaded(true);
  }, []);

  // Save data to localStorage whenever data changes
  useEffect(() => {
    if (isDataLoaded && (billData.totalAmount !== '' || billData.discount !== '' || billData.shipping !== '')) {
      localStorage.setItem('billSplitter_billData', JSON.stringify(billData));
    }
  }, [billData, isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded && members.length > 0 && members.some(m => m.name || m.originalPrice)) {
      localStorage.setItem('billSplitter_members', JSON.stringify(members));
    }
  }, [members, isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded) {
      localStorage.setItem('billSplitter_selectedQR', selectedQR);
    }
  }, [selectedQR, isDataLoaded]);

  // Tính toán phần trăm giảm giá
  useEffect(() => {
    const total = parseFloat(billData.totalAmount) || 0;
    const discount = parseFloat(billData.discount) || 0;
    const shipping = parseFloat(billData.shipping) || 0;

    if (total > 0) {
      const netDiscount = Math.max(0, discount - shipping);
      const percentage = (netDiscount / total) * 100;
      setDiscountPercentage(Math.min(percentage, 100));
    } else {
      setDiscountPercentage(0);
    }
  }, [billData]);

  // Tính toán giá cuối cho từng thành viên
  useEffect(() => {
    if (isDataLoaded) {
      const updatedMembers = members.map(member => {
        const originalPrice = parseFloat(member.originalPrice) || 0;
        const finalPrice = originalPrice * (1 - discountPercentage / 100);
        return {
          ...member,
          finalPrice: finalPrice.toFixed(0)
        };
      });
      
      // Chỉ cập nhật nếu có thay đổi thực sự
      const hasChanges = updatedMembers.some((member, index) => {
        const currentMember = members[index];
        return member.finalPrice !== currentMember.finalPrice;
      });
      
      if (hasChanges) {
        setMembers(updatedMembers);
      }
    }
  }, [discountPercentage, isDataLoaded]);

  // Kiểm tra tổng tiền
  useEffect(() => {
    const totalOriginalPrice = members.reduce((sum, member) => sum + (parseFloat(member.originalPrice) || 0), 0);
    const expectedTotal = parseFloat(billData.totalAmount) || 0;
    
    if (expectedTotal > 0 && totalOriginalPrice > 0) {
      const difference = Math.abs(totalOriginalPrice - expectedTotal);
      const tolerance = 1000; // Cho phép sai số 1000 VNĐ
      
      if (difference <= tolerance) {
        if (Math.abs(totalOriginalPrice - expectedTotal) < 100) {
          setValidationMessage('✅ Tổng tiền khớp chính xác!');
          setValidationType('success');
        } else {
          setValidationMessage(`⚠️ Tổng tiền gần đúng (sai số: ${difference.toLocaleString()} VNĐ)`);
          setValidationType('warning');
        }
      } else {
        setValidationMessage(`❌ Tổng tiền không khớp! Thiếu: ${(expectedTotal - totalOriginalPrice).toLocaleString()} VNĐ`);
        setValidationType('error');
      }
    } else {
      setValidationMessage('');
      setValidationType('');
    }
  }, [members, billData.totalAmount]);

  const handleBillDataChange = (field, value) => {
    setBillData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addMember = () => {
    const newId = Math.max(...members.map(m => m.id)) + 1;
    setMembers(prev => [...prev, { id: newId, name: '', originalPrice: '', finalPrice: '', paid: false }]);
  };

  const removeMember = (id) => {
    if (members.length > 1) {
      setMembers(prev => prev.filter(member => member.id !== id));
    }
  };

  const updateMember = (id, field, value) => {
    setMembers(prev => prev.map(member => {
      if (member.id === id) {
        const updatedMember = { ...member, [field]: value };
        if (field === 'originalPrice') {
          const originalPrice = parseFloat(value) || 0;
          const finalPrice = originalPrice * (1 - discountPercentage / 100);
          updatedMember.finalPrice = finalPrice.toFixed(0);
        }
        return updatedMember;
      }
      return member;
    }));
  };

  const togglePaid = (id) => {
    setMembers(prev => prev.map(member => 
      member.id === id ? { ...member, paid: !member.paid } : member
    ));
  };

  const clearAllData = () => {
    if (window.confirm('Bạn có chắc muốn xóa tất cả dữ liệu?')) {
      setBillData({ totalAmount: '', discount: '', shipping: '' });
      setMembers([{ id: 1, name: '', originalPrice: '', finalPrice: '', paid: false }]);
      localStorage.removeItem('billSplitter_billData');
      localStorage.removeItem('billSplitter_members');
      localStorage.removeItem('billSplitter_selectedQR');
      setValidationMessage('');
      setValidationType('');
      setIsDataLoaded(false);
      setTimeout(() => setIsDataLoaded(true), 100);
    }
  };

  const totalOriginalPrice = members.reduce((sum, member) => sum + (parseFloat(member.originalPrice) || 0), 0);
  const totalFinalPrice = members.reduce((sum, member) => sum + (parseFloat(member.finalPrice) || 0), 0);
  const totalPaid = members.reduce((sum, member) => sum + (member.paid ? parseFloat(member.finalPrice) || 0 : 0), 0);
  const totalUnpaid = totalFinalPrice - totalPaid;

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <div className="header-content">
            <Receipt className="header-icon" />
            <h1>Bill Splitter</h1>
            <p>Tính tiền ăn nhóm thông minh</p>
          </div>
        </header>

        <div className="main-content">
          {/* Thông tin đơn hàng */}
          <div className="card bill-info">
            <div className="card-header">
              <Calculator className="card-icon" />
              <h2>Thông tin đơn hàng</h2>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Tổng tiền đơn (VNĐ)</label>
                <input
                  type="number"
                  value={billData.totalAmount}
                  onChange={(e) => handleBillDataChange('totalAmount', e.target.value)}
                  placeholder="Nhập tổng tiền..."
                />
              </div>
              <div className="form-group">
                <label>Tiền giảm giá voucher (VNĐ)</label>
                <input
                  type="number"
                  value={billData.discount}
                  onChange={(e) => handleBillDataChange('discount', e.target.value)}
                  placeholder="Nhập tiền giảm giá..."
                />
              </div>
              <div className="form-group">
                <label>Tiền ship (VNĐ)</label>
                <input
                  type="number"
                  value={billData.shipping}
                  onChange={(e) => handleBillDataChange('shipping', e.target.value)}
                  placeholder="Nhập tiền ship..."
                />
              </div>
            </div>
            <div className="discount-info">
              <div className="discount-badge">
                <span>Phần trăm giảm giá:</span>
                <strong>{discountPercentage.toFixed(1)}%</strong>
              </div>
            </div>
          </div>

          {/* Validation Message */}
          {validationMessage && (
            <div className={`validation-message ${validationType}`}>
              {validationType === 'success' && <CheckCircle size={20} />}
              {validationType === 'error' && <AlertTriangle size={20} />}
              {validationType === 'warning' && <AlertTriangle size={20} />}
              <span>{validationMessage}</span>
            </div>
          )}

          {/* Danh sách thành viên */}
          <div className="card members-section">
            <div className="card-header">
              <Users className="card-icon" />
              <h2>Thành viên</h2>
              <div className="header-actions">
                <button className="add-button" onClick={addMember}>
                  <Plus size={20} />
                  Thêm thành viên
                </button>
                <button className="clear-button" onClick={clearAllData}>
                  <Trash2 size={16} />
                  Xóa tất cả
                </button>
              </div>
            </div>
            
            <div className="members-list">
              {members.map((member, index) => (
                <div key={member.id} className={`member-item ${member.paid ? 'paid' : ''}`}>
                  <div className="member-header">
                    <span className="member-number">#{index + 1}</span>
                    <div className="member-actions">
                      <button 
                        className={`paid-button ${member.paid ? 'paid' : ''}`}
                        onClick={() => togglePaid(member.id)}
                        title={member.paid ? 'Đã trả tiền' : 'Chưa trả tiền'}
                      >
                        {member.paid ? <CheckCircle size={16} /> : <CreditCard size={16} />}
                      </button>
                      <button 
                        className="remove-button"
                        onClick={() => removeMember(member.id)}
                        disabled={members.length === 1}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="member-form">
                    <div className="form-group">
                      <label>Tên thành viên</label>
                      <input
                        type="text"
                        value={member.name}
                        onChange={(e) => updateMember(member.id, 'name', e.target.value)}
                        placeholder="Nhập tên..."
                      />
                    </div>
                    <div className="form-group">
                      <label>Giá gốc (VNĐ)</label>
                      <input
                        type="number"
                        value={member.originalPrice}
                        onChange={(e) => updateMember(member.id, 'originalPrice', e.target.value)}
                        placeholder="Nhập giá..."
                      />
                    </div>
                    <div className="form-group">
                      <label>Tiền phải trả (VNĐ)</label>
                      <div className="final-price-display">
                        {parseInt(member.finalPrice) || 0}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tổng kết */}
            <div className="summary">
              <div className="summary-item">
                <span>Tổng giá gốc:</span>
                <strong>{totalOriginalPrice.toLocaleString()} VNĐ</strong>
              </div>
              <div className="summary-item">
                <span>Tổng tiền phải trả:</span>
                <strong>{totalFinalPrice.toLocaleString()} VNĐ</strong>
              </div>
              <div className="summary-item">
                <span>Đã trả:</span>
                <strong className="paid">{totalPaid.toLocaleString()} VNĐ</strong>
              </div>
              <div className="summary-item">
                <span>Chưa trả:</span>
                <strong className="unpaid">{totalUnpaid.toLocaleString()} VNĐ</strong>
              </div>
              <div className="summary-item total">
                <span>Tiết kiệm được:</span>
                <strong>{(totalOriginalPrice - totalFinalPrice).toLocaleString()} VNĐ</strong>
              </div>
            </div>

            {/* QR Code Section */}
            {totalUnpaid > 0 && (
              <div className="qr-section">
                <div className="qr-header">
                  <h3>Chuyển khoản</h3>
                  <div className="qr-selector">
                    <select 
                      value={selectedQR} 
                      onChange={(e) => setSelectedQR(e.target.value)}
                    >
                      {qrCodes.map(qr => (
                        <option key={qr.id} value={qr.id}>{qr.name}</option>
                      ))}
                    </select>
                    <button 
                      className="qr-toggle-button"
                      onClick={() => setShowQR(!showQR)}
                    >
                      {showQR ? <X size={20} /> : <CreditCard size={20} />}
                      {showQR ? 'Ẩn QR' : 'Hiện QR'}
                    </button>
                  </div>
                </div>
                {showQR && (
                  <div className="qr-display">
                    <img 
                      src={`/qr-codes/${qrCodes.find(qr => qr.id === selectedQR)?.file}`} 
                      alt={`QR Code ${qrCodes.find(qr => qr.id === selectedQR)?.name}`}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                    <div className="qr-placeholder" style={{display: 'none'}}>
                      <CreditCard size={48} />
                      <p>Chưa có QR code cho {qrCodes.find(qr => qr.id === selectedQR)?.name}</p>
                      <p>Thêm file vào thư mục /public/qr-codes/</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App; 