// ... 前略

  const handleSend = async (content, isImage = false) => {
    const text = content.trim();
    if (!text || !user) return;

    const { error } = await supabase.from('messages').insert([{ 
      content: text, 
      user_id: user.id, 
      receiver_id: ADMIN_ID, 
      is_image: isImage, 
      is_read: false 
    }]);

    if (!error) {
      if (!isImage) {
        setInputText('');
        // 入力欄の高さを一行分（元通り）にリセット
        const textarea = document.querySelector('textarea');
        if (textarea) {
          textarea.style.height = 'auto';
        }
      }
      fetchMessages(user.id);
    }
  };

// ... 中略（return 内の textarea 部分も少し最適化しています）

  <textarea 
    value={inputText} 
    onChange={e => setInputText(e.target.value)} 
    placeholder="MESSAGES..." 
    rows={1} 
    onInput={(e) => { 
      e.target.style.height = 'auto'; 
      e.target.style.height = e.target.scrollHeight + 'px'; 
    }} 
    style={{ 
      flex: 1, 
      background: 'rgba(0,0,0,0.3)', 
      color: '#fff', 
      border: '1px solid rgba(255,255,255,0.2)', 
      borderRadius: '18px', 
      padding: '8px 15px', 
      resize: 'none', 
      fontSize: '16px', 
      outline: 'none', 
      lineHeight: '1.4', 
      maxHeight: '120px',
      overflowY: 'auto' // 最大高さを超えたらスクロール
    }} 
  />

// ... 後略
