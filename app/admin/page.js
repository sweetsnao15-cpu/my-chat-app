"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56"; // あなたのID

export default function AdminPage() {
  const [viewMode, setViewMode] = useState('dm'); // 'dm' or 'list'
  const [ms, setMs] = useState([]);
  const scRef = useRef(null);

  useEffect(() => {
    loadM();
    // リアルタイム更新の購読
    const ch = supabase.channel('admin_room').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, loadM).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const loadM = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles:user_id(username, avatar_url)')
      .order('created_at', { ascending: true });
    if (data) setMs(data);
    // 自動スクロール
    setTimeout(() => scRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', height: '100dvh', background: '#000', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      
      {/* --- ヘッダー：切り替えスイッチ --- */}
      <header style={{ padding: '15px 20px', background: '#800000', borderBottom: '2px solid #D4AF37', zIndex: 10 }}>
        <div style={{ display: 'flex', background: '#000', borderRadius: '25px', padding: '4px', border: '1px solid #D4AF37' }}>
          <button 
            onClick={() => setViewMode('dm')}
            style={{ 
              flex: 1, padding: '10px', borderRadius: '20px', border: 'none',
              background: viewMode === 'dm' ? '#D4AF37' : 'transparent',
              color: viewMode === 'dm' ? '#000' : '#fff', fontWeight: 'bold', transition: '0.3s'
            }}>DM型</button>
          <button 
            onClick={() => setViewMode('list')}
            style={{ 
              flex: 1, padding: '10px', borderRadius: '20px', border: 'none',
              background: viewMode === 'list' ? '#D4AF37' : 'transparent',
              color: viewMode === 'list' ? '#000' : '#fff', fontWeight: 'bold', transition: '0.3s'
            }}>コメント型</button>
        </div>
      </header>

      {/* --- メイン：メッセージ表示 --- */}
      <div style={{ flex: 1, overflowY: 'auto', padding: viewMode === 'dm' ? '20px' : '0' }}>
        {ms.map(m => (
          viewMode === 'dm' ? (
            /* DM形式：吹き出しが左に並ぶ */
            <div key={m.id} style={{ marginBottom: '20px', textAlign: 'left' }}>
              <div style={{ fontSize: '0.7rem', color: '#D4AF37', marginBottom: '4px', marginLeft: '8px' }}>{m.profiles?.username}</div>
              <div style={{ display: 'inline-block', maxWidth: '85%', padding: '10px 16px', background: '#800000', borderRadius: '0 18px 18px 18px', border: '1px solid #D4AF37' }}>
                {m.is_image ? <img src={m.content} style={{ width: '100%', borderRadius: '10px' }} /> : m.content}
              </div>
            </div>
          ) : (
            /* コメント形式：SNS（X）のタイムライン風 */
            <div key={m.id} style={{ padding: '12px 15px', borderBottom: '1px solid #1a1a1a', display: 'flex', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#333', flexShrink: 0, border: '1px solid #D4AF37', overflow: 'hidden' }}>
                {m.profiles?.avatar_url && <img src={m.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', color: '#D4AF37', fontSize: '0.9rem' }}>{m.profiles?.username}</span>
                  <span style={{ color: '#444', fontSize: '0.65rem' }}>{new Date(m.created_at).toLocaleString()}</span>
                </div>
                <div style={{ color: '#eee', fontSize: '0.95rem', marginTop: '4px' }}>
                  {m.is_image ? <img src={m.content} style={{ maxWidth: '200px', borderRadius: '8px', marginTop: '5px' }} /> : m.content}
                </div>
              </div>
            </div>
          )
        ))}
        <div ref={scRef} />
      </div>

      <footer style={{ padding: '10px', background: '#000', textAlign: 'center', fontSize: '0.7rem', color: '#444' }}>
        ADMIN MONITORING MODE
      </footer>
    </div>
  );
}