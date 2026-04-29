"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

// ... (Avatarコンポーネントは変更なし)

export default function AdminPage() {
  const [viewMode, setViewMode] = useState('GLOBAL');
  const [guests, setGuests] = useState([]);
  const [selectedGuestId, setSelectedGuestId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const longPressTimer = useRef(null);
  const prevMsgCountRef = useRef(0);

  // --- 各種データ取得・スクロール処理 ---
  const scrollToBottom = useCallback((behavior = 'auto') => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
    }
  }, []);

  const fetchGuests = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) setGuests(data);
  }, []);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) setMessages(data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    fetchGuests();
    fetchMessages();
    
    const channel = supabase.channel('admin_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchGuests, fetchMessages]);

  useEffect(() => { 
    if (messages.length > prevMsgCountRef.current) {
      scrollToBottom('auto');
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  // --- メッセージ操作機能 ---

  // 送信取消・削除 (DBから削除)
  const executeDelete = async (msg) => {
    if (!confirm("このメッセージを削除（送信取消）しますか？\nゲスト側の画面からも消去されます。")) return;

    const { error } = await supabase.from('messages')
      .delete()
      .eq('user_id', ADMIN_ID)
      .eq('content', msg.content)
      .eq('created_at', msg.created_at); // 一斉送信された同時刻のものを特定

    if (!error) {
      setContextMenu(null);
      fetchMessages(); // 状態を更新
    } else {
      alert("削除に失敗しました");
    }
  };

  // メニュー表示
  const openMenu = (e, msg) => {
    e.preventDefault();
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);
    setContextMenu({ x, y, msg });
  };

  // 一斉送信
  const handleSendAll = async (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const text = inputText.trim();
    if (!text || isUploading || !user) return;

    const targetIds = guests.filter(g => g.id !== ADMIN_ID).map(g => g.id);
    if (targetIds.length === 0) return;

    const inserts = targetIds.map(id => ({
      content: text, user_id: ADMIN_ID, receiver_id: id, is_image: false, is_read: false
    }));

    setInputText('');
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.blur(); }

    const { error } = await supabase.from('messages').insert(inserts);
    if (!error) fetchMessages();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user || viewMode === 'DIRECT') return;
    setIsUploading(true);
    const filePath = `admin/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('chat-images').upload(filePath, file);
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(filePath);
      const targetIds = guests.filter(g => g.id !== ADMIN_ID).map(g => g.id);
      const inserts = targetIds.map(id => ({
        content: publicUrl, user_id: ADMIN_ID, receiver_id: id, is_image: true, is_read: false
      }));
      await supabase.from('messages').insert(inserts);
      fetchMessages();
    }
    setIsUploading(false);
  };

  // --- レンダリング関数 ---
  const renderMessages = () => {
    const filtered = (viewMode === 'DIRECT' 
      ? messages.filter(m => (m.user_id === selectedGuestId && m.receiver_id === ADMIN_ID) || (m.user_id === ADMIN_ID && m.receiver_id === selectedGuestId))
      : (() => {
          const displayed = [];
          const seenAdminMsgs = new Set();
          messages.forEach(m => {
            if (m.user_id === ADMIN_ID) {
              const key = `${m.content}_${m.created_at.substring(0,16)}`; 
              if (!seenAdminMsgs.has(key)) { displayed.push(m); seenAdminMsgs.add(key); }
            } else { displayed.push(m); }
          });
          return displayed;
        })()
    );

    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%', paddingBottom: '20px' }}>
        {filtered.map((m, index) => {
          const isMe = m.user_id === ADMIN_ID;
          const senderProfile = guests.find(g => g.id === m.user_id);
          const date = new Date(m.created_at);
          
          return (
            <div key={m.id} style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexDirection: isMe ? 'row-reverse' : 'row', width: '100%' }}>
                {!isMe && <Avatar profile={senderProfile} size="28px" />}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                    <div 
                      onContextMenu={(e) => isMe && openMenu(e, m)}
                      onTouchStart={(e) => { if(isMe) longPressTimer.current = setTimeout(() => openMenu(e, m), 600); }} 
                      onTouchEnd={() => clearTimeout(longPressTimer.current)}
                      style={{ 
                        padding: m.is_image ? '5px' : '10px 14px', 
                        background: isMe ? 'rgba(80, 0, 0, 0.75)' : 'rgba(26, 26, 26, 0.75)', 
                        borderRadius: isMe ? '18px 2px 18px 18px' : '2px 18px 18px 18px', 
                        border: isMe ? '1px solid rgba(128, 0, 0, 0.3)' : '1px solid #D4AF37', 
                        fontSize: '0.9rem', color: '#fff', whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: isMe ? 'pointer' : 'default'
                      }}>
                      {m.is_image ? <img src={m.content} style={{ maxWidth: '100%', borderRadius: '10px', display: 'block' }} /> : m.content}
                    </div>
                    <div style={{ fontSize: '0.5rem', color: '#D4AF37', opacity: 0.8 }}>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div onClick={() => setContextMenu(null)} style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', overflow: 'hidden', position: 'relative' }}>
      
      {/* 操作メニュー (ポップアップ) */}
      {contextMenu && (
        <div style={{ 
          position: 'fixed', top: contextMenu.y - 100, left: contextMenu.x - 50, 
          background: '#1a1a1a', border: '1px solid #D4AF37', borderRadius: '12px', zIndex: 10000, 
          display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.8)' 
        }}>
          <button style={{ background: 'none', border: 'none', color: '#fff', padding: '12px 20px', fontSize: '0.9rem', borderBottom: '1px solid #333' }} 
            onClick={() => { navigator.clipboard.writeText(contextMenu.msg.content); setContextMenu(null); }}>
            コピー
          </button>
          <button style={{ background: 'none', border: 'none', color: '#ff4d4d', padding: '12px 20px', fontSize: '0.9rem' }} 
            onClick={() => executeDelete(contextMenu.msg)}>
            送信取消（削除）
          </button>
        </div>
      )}

      {/* ヘッダー・メインエリア・入力欄は前述のスマホ対応版と同じ */}
      <header style={{ padding: '15px', background: '#800000', borderBottom: '1px solid #D4AF37', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0 }}>for VAU - HOST</h1>
        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
          {['GLOBAL', 'DIRECT'].map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{ background: viewMode === mode ? '#D4AF37' : 'transparent', color: viewMode === mode ? '#000' : '#fff', border: '1px solid #D4AF37', padding: '4px 15px', borderRadius: '15px', fontSize: '0.7rem' }}>{mode}</button>
          ))}
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }} ref={scrollRef}>
        {renderMessages()}
      </div>

      {viewMode === 'GLOBAL' && (
        <div style={{ padding: '10px', background: '#800000', paddingBottom: 'calc(15px + env(safe-area-inset-bottom))' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <textarea 
              ref={textareaRef} value={inputText} onChange={e => setInputText(e.target.value)} 
              placeholder="全員へ送信..." rows={1} 
              style={{ flex: 1, background: '#000', color: '#fff', border: '1px solid #D4AF37', borderRadius: '20px', padding: '10px 15px', fontSize: '16px', resize: 'none' }} 
            />
            <button onClick={handleSendAll} style={{ background: '#D4AF37', color: '#000', padding: '10px 15px', borderRadius: '20px', fontWeight: 'bold' }}>SEND</button>
          </div>
        </div>
      )}
    </div>
  );
}
