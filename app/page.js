"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase'; // @エイリアスを使用してパスエラーを防止

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

export default function GuestPage() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState(null);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const prevMsgCountRef = useRef(0);

  // 最下部へスクロール
  const scrollToBottom = useCallback((behavior = 'auto') => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
    }
  }, []);

  // メッセージ取得
  const fetchMessages = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`user_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  }, [user]);

  // 初期化：セッション取得
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // リアルタイム購読
  useEffect(() => {
    if (user) {
      fetchMessages();
      const channel = supabase.channel(`chat_${user.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'messages',
          filter: `user_id=eq.${user.id}`
        }, () => fetchMessages())
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        }, () => fetchMessages())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [user, fetchMessages]);

  // メッセージ増分時にスクロール
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      scrollToBottom('auto');
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  // 送信処理
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !user) return;

    const newMessage = {
      content: text,
      user_id: user.id,
      receiver_id: ADMIN_ID,
      is_image: false,
      is_read: false
    };

    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const { error } = await supabase.from('messages').insert([newMessage]);
    if (error) console.error(error);
    else fetchMessages();
  };

  return (
    <div style={{ 
      width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', 
      background: '#000', color: '#fff', overflow: 'hidden', fontFamily: 'serif' 
    }}>
      {/* ヘッダー：ホストより濃い赤 #600000 */}
      <header style={{ 
        padding: '15px', background: '#600000', borderBottom: '1px solid #D4AF37', 
        textAlign: 'center', flexShrink: 0, zIndex: 10
      }}>
        <h1 style={{ 
          fontSize: '1.2rem', fontStyle: 'italic', fontWeight: 'bold', 
          margin: 0, letterSpacing: '2px', color: '#fff' 
        }}>
          for VAU
        </h1>
      </header>

      {/* メッセージ表示エリア */}
      <div 
        ref={scrollRef} 
        style={{ flex: 1, overflowY: 'auto', padding: '20px 15px', background: '#050505' }}
      >
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {messages.map((m, index) => {
            const isMe = m.user_id === user?.id;
            const date = new Date(m.created_at);
            const dateStr = `-${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}-`;
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const isNewDay = !prevMsg || new Date(prevMsg.created_at).toDateString() !== date.toDateString();

            return (
              <div key={m.id}>
                {isNewDay && (
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0 20px' }}>
                    {/* 年月日の透過なし・くっきりした金色 */}
                    <div style={{ color: '#D4AF37', fontSize: '0.65rem', letterSpacing: '2px', fontWeight: 'bold', fontStyle: 'italic' }}>
                      {dateStr}
                    </div>
                  </div>
                )}
                <div style={{ 
                  marginBottom: '20px', display: 'flex', 
                  flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                    <div style={{ 
                      padding: m.is_image ? '5px' : '10px 14px', 
                      // 自分の吹き出し色をホスト（rgba(80,0,0,0.75)）と統一
                      background: isMe ? 'rgba(80, 0, 0, 0.75)' : 'rgba(26, 26, 26, 0.75)', 
                      borderRadius: isMe ? '18px 2px 18px 18px' : '2px 18px 18px 18px', 
                      border: '1px solid #D4AF37', 
                      fontSize: '0.9rem', maxWidth: '240px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      color: '#fff'
                    }}>
                      {m.is_image ? <img src={m.content} style={{ maxWidth: '100%', borderRadius: '10px' }} alt="" /> : m.content}
                    </div>
                    <div style={{ fontSize: '0.5rem', color: '#D4AF37', opacity: 0.8, paddingBottom: '2px' }}>
                      {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* フッター：赤を濃く #600000 */}
      <footer style={{ 
        padding: '12px 15px', background: '#600000', borderTop: '1px solid #D4AF37',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
        flexShrink: 0
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            placeholder="メッセージを入力..."
            rows={1}
            style={{ 
              flex: 1, background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(212,175,55,0.4)', 
              borderRadius: '20px', padding: '10px 15px', fontSize: '16px', resize: 'none', outline: 'none', maxHeight: '120px'
            }}
          />
          <button
            onClick={handleSend}
            style={{ 
              background: '#000', color: '#D4AF37', border: '1px solid #D4AF37', 
              borderRadius: '20px', padding: '10px 18px', fontWeight: 'bold', fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            SEND
          </button>
        </div>
      </footer>
    </div>
  );
}
