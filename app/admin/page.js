"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

// ... (Avatarコンポーネントは変更なし)

export default function AdminPage() {
  const [viewMode, setViewMode] = useState('GLOBAL');
  const [guests, setGuests] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState(null);
  
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null); // textareaへの参照を追加
  const longPressTimer = useRef(null);
  const prevMsgCountRef = useRef(0);

  // ... (scrollToBottom, fetchGuests, fetchMessages, useEffectなどは変更なし)

  // 全員への一斉送信処理（スマホ対応強化版）
  const handleSendAll = async (e, content, isImage = false) => {
    // イベントのデフォルト挙動を停止（ボタン押下時の予期せぬスクロール防止）
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const text = typeof content === 'string' ? content.trim() : "";
    if (!text || isUploading) return;

    // 最新のゲストリストを取得（状態が古い場合を考慮）
    const { data: latestGuests } = await supabase.from('profiles').select('id');
    const targetIds = (latestGuests || guests)
      .filter(g => g.id !== ADMIN_ID)
      .map(g => g.id);

    if (targetIds.length === 0) {
      alert("送信先のユーザーが見つかりません。");
      return;
    }

    const inserts = targetIds.map(id => ({
      content: text,
      user_id: ADMIN_ID,
      receiver_id: id,
      is_image: isImage,
      is_read: false
    }));

    // 送信直後にキーボードを閉じる（スマホ対策）
    if (textareaRef.current) {
      textareaRef.current.blur();
    }

    const { error } = await supabase.from('messages').insert(inserts);
    
    if (!error) {
      if (!isImage) {
        setInputText('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      }
      fetchMessages();
    } else {
      console.error("Send Error:", error);
      alert("送信に失敗しました。");
    }
  };

  // ... (handleImageUpload, executeDelete, openMenu, renderMessages は変更なし)

  return (
    <div onClick={() => setContextMenu(null)} style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', overflow: 'hidden', fontFamily: 'serif' }}>
      {/* ... ヘッダー等 ... */}
      
      <header style={{ padding: '15px', background: '#800000', borderBottom: '1px solid #D4AF37', textAlign: 'center', flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.4rem', fontStyle: 'italic', fontWeight: 'bold', margin: 0, letterSpacing: '2px' }}>for VAU - HOST</h1>
        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '15px' }}>
          {['GLOBAL', 'DIRECT'].map(mode => (
            <button key={mode} type="button" onClick={() => setViewMode(mode)} style={{ background: viewMode === mode ? '#D4AF37' : 'transparent', color: viewMode === mode ? '#000' : '#fff', border: '1px solid #D4AF37', padding: '6px 20px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>{mode}</button>
          ))}
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* メインチャットエリア */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#050505', position: 'relative' }}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>{renderMessages()}</div>
          
          {viewMode === 'GLOBAL' && (
            <div style={{ 
              padding: '10px 15px', 
              background: '#800000', 
              borderTop: '1px solid #D4AF37', 
              flexShrink: 0,
              // スマホのキーボード表示時の余白調整
              paddingBottom: 'calc(15px + env(safe-area-inset-bottom))' 
            }}>
              <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()} 
                  style={{ background: 'transparent', border: 'none', color: '#D4AF37', fontSize: '1.8rem', padding: '0 5px', cursor: 'pointer' }}
                >
                  {isUploading ? '...' : '⊕'}
                </button>
                <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
                
                <textarea 
                  ref={textareaRef}
                  value={inputText} 
                  onChange={e => setInputText(e.target.value)} 
                  placeholder="全員へ一斉送信..." 
                  rows={1} 
                  onInput={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }} 
                  style={{ 
                    flex: 1, 
                    background: 'rgba(0,0,0,0.3)', 
                    color: '#fff', 
                    border: '1px solid rgba(255,255,255,0.2)', 
                    borderRadius: '20px', 
                    padding: '10px 15px', 
                    resize: 'none', 
                    fontSize: '16px', // iOSでのズーム防止のため16px以上を推奨
                    outline: 'none', 
                    lineHeight: '1.2'
                  }} 
                />
                
                <button 
                  type="button" 
                  // スマホでの誤作動防止のため、onMouseDown/onTouchStartではなくonClickを使用し、イベントを制御
                  onClick={(e) => handleSendAll(e, inputText)} 
                  style={{ 
                    background: '#000', 
                    color: '#D4AF37', 
                    padding: '10px 20px', 
                    borderRadius: '20px', 
                    fontWeight: 'bold', 
                    border: '1px solid #D4AF37', 
                    fontSize: '14px',
                    minWidth: '70px',
                    // タップ領域を確保
                    WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  SEND
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
