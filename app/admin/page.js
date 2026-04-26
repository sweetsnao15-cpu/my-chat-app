"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

// アバターコンポーネント（ゲストのアイコンを反映）
const GuestAvatar = ({ profile, size = '40px', fontSize = '1rem' }) => {
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '1px solid #D4AF37' }} alt="" />;
  }
  const initial = profile?.username ? Array.from(profile.username)[0].toUpperCase() : "G";
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #D4AF37 0%, #B69121 100%)',
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 'bold', fontSize: fontSize, border: '1px solid #D4AF37', flexShrink: 0
    }}>{initial}</div>
  );
};

export default function AdminPage() {
  const [viewMode, setViewMode] = useState('GLOBAL'); // 'GLOBAL' or 'DIRECT'
  const [guests, setGuests] = useState([]);
  const [selectedGuestId, setSelectedGuestId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState(null);
  const scrollRef = useRef(null);

  // ゲスト一覧とプロフィールの取得
  const fetchGuests = useCallback(async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    if (profiles) setGuests(profiles.filter(p => p.id !== ADMIN_ID));
  }, []);

  // メッセージの取得
  const fetchMessages = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) setMessages(data);
  }, []);

  // 既読処理：選択中のゲストからのメッセージを既読にする
  const markAsRead = useCallback(async (guestId) => {
    if (!guestId) return;
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('user_id', guestId)
      .eq('receiver_id', ADMIN_ID)
      .eq('is_read', false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    fetchGuests();
    fetchMessages();

    const channel = supabase.channel('admin_room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchMessages();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchGuests, fetchMessages]);

  // メッセージが更新されたら既読処理を実行
  useEffect(() => {
    if (viewMode === 'DIRECT' && selectedGuestId) {
      markAsRead(selectedGuestId);
    }
  }, [messages, viewMode, selectedGuestId, markAsRead]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, viewMode, selectedGuestId]);

  // 送信処理
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !user) return;
    setInputText('');

    if (viewMode === 'GLOBAL') {
      // 一斉送信：全ゲストに対して個別にインサート
      const bulkMessages = guests.map(g => ({
        content: text,
        user_id: ADMIN_ID,
        receiver_id: g.id,
        is_image: false,
        is_read: false
      }));
      await supabase.from('messages').insert(bulkMessages);
    } else if (selectedGuestId) {
      // 個別送信
      await supabase.from('messages').insert([{
        content: text,
        user_id: ADMIN_ID,
        receiver_id: selectedGuestId,
        is_image: false,
        is_read: false
      }]);
    }
  };

  const selectedGuestProfile = guests.find(g => g.id === selectedGuestId);

  return (
    <div style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff' }}>
      
      {/* ヘッダー */}
      <header style={{ padding: '20px', background: '#800000', borderBottom: '2px solid #D4AF37', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.8rem', fontFamily: 'serif', fontStyle: 'italic', margin: 0 }}>for VAU - HOST</h1>
        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
          <button onClick={() => setViewMode('GLOBAL')} style={{ background: viewMode === 'GLOBAL' ? '#D4AF37' : 'transparent', color: viewMode === 'GLOBAL' ? '#000' : '#fff', border: '1px solid #D4AF37', padding: '5px 15px', borderRadius: '15px', fontSize: '0.8rem' }}>GLOBAL</button>
          <button onClick={() => setViewMode('DIRECT')} style={{ background: viewMode === 'DIRECT' ? '#D4AF37' : 'transparent', color: viewMode === 'DIRECT' ? '#000' : '#fff', border: '1px solid #D4AF37', padding: '5px 15px', borderRadius: '15px', fontSize: '0.8rem' }}>DIRECT</button>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* サイドバー（DIRECTモード時のみ表示） */}
        {viewMode === 'DIRECT' && (
          <div style={{ width: '80px', borderRight: '1px solid #333', overflowY: 'auto', padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
            {guests.map(g => (
              <div key={g.id} onClick={() => setSelectedGuestId(g.id)} style={{ cursor: 'pointer', opacity: selectedGuestId === g.id ? 1 : 0.5, transition: '0.3s' }}>
                <GuestAvatar profile={g} />
              </div>
            ))}
          </div>
        )}

        {/* チャットエリア */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {viewMode === 'GLOBAL' ? (
              // GLOBALモード：全メッセージを表示
              messages.map(m => {
                const guest = guests.find(g => g.id === m.user_id || g.id === m.receiver_id);
                const isFromAdmin = m.user_id === ADMIN_ID;
                return (
                  <div key={m.id} style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexDirection: isFromAdmin ? 'row-reverse' : 'row' }}>
                    {!isFromAdmin && <GuestAvatar profile={guest} size="30px" />}
                    <div>
                      {!isFromAdmin && <div style={{ fontSize: '0.7rem', color: '#D4AF37', marginBottom: '2px' }}>{guest?.username || 'Guest'}</div>}
                      <div style={{ padding: '8px 12px', background: isFromAdmin ? '#500000' : '#1a1a1a', borderRadius: '10px', fontSize: '0.9rem', border: isFromAdmin ? 'none' : '1px solid #333' }}>
                        {m.is_image ? '[Image]' : m.content}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              // DIRECTモード：特定のゲストとの履歴のみ
              selectedGuestId ? (
                messages.filter(m => (m.user_id === selectedGuestId && m.receiver_id === ADMIN_ID) || (m.user_id === ADMIN_ID && m.receiver_id === selectedGuestId))
                .map(m => {
                  const isMe = m.user_id === ADMIN_ID;
                  return (
                    <div key={m.id} style={{ marginBottom: '15px', textAlign: isMe ? 'right' : 'left' }}>
                      <div style={{ display: 'inline-block', padding: '10px 15px', background: isMe ? '#800000' : '#1a1a1a', borderRadius: '15px', border: isMe ? 'none' : '1px solid #D4AF37' }}>
                        {m.is_image ? <img src={m.content} style={{ maxWidth: '200px', borderRadius: '10px' }} /> : m.content}
                      </div>
                      <div style={{ fontSize: '0.6rem', color: '#666', marginTop: '3px' }}>
                        {isMe && m.is_read && <span style={{ color: '#D4AF37', marginRight: '5px' }}>既読</span>}
                        {new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>ゲストを選択してください</div>
              )
            )}
            <div ref={scrollRef} />
          </div>

          {/* 入力エリア */}
          <div style={{ padding: '15px', background: '#800000', display: 'flex', gap: '10px', borderTop: '2px solid #D4AF37' }}>
            <textarea 
              value={inputText} 
              onChange={e => setInputText(e.target.value)} 
              placeholder={viewMode === 'GLOBAL' ? "全ゲストへ送信..." : `${selectedGuestProfile?.username || 'ゲスト'}へ送信...`}
              style={{ flex: 1, background: '#800000', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '20px', padding: '10px 15px', outline: 'none', resize: 'none', height: '42px' }}
            />
            <button 
              onClick={handleSend}
              style={{ background: '#000', color: '#D4AF37', padding: '0 20px', borderRadius: '20px', fontWeight: 'bold', fontFamily: 'serif', fontStyle: 'italic', fontSize: '1.1rem', border: 'none', cursor: 'pointer' }}
            >SEND</button>
          </div>
        </div>
      </div>
    </div>
  );
}
