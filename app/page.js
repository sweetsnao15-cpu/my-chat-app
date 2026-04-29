"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

export default function GuestPage() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState(null);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const prevMsgCountRef = useRef(0);

  const scrollToBottom = useCallback((behavior = 'auto') => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`user_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  }, [user]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchMessages();
      const channel = supabase.channel(`chat_${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchMessages())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [user, fetchMessages]);

  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      scrollToBottom('auto');
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !user) return;
    const newMessage = { content: text, user_id: user.id, receiver_id: ADMIN_ID, is_image: false, is_read: false };
    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await supabase.from('messages').insert([newMessage]);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${Math.random()}.${fileExt}`;
    try {
      await supabase.storage.from('chat-images').upload(filePath, file);
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(filePath);
      await supabase.from('messages').insert([{ content: publicUrl, user_id: user.id, receiver_id: ADMIN_ID, is_image: true, is_read: false }]);
    } catch (error) {
      console.error(error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', background: '#000', color: '#fff', overflow: 'hidden', fontFamily: 'serif' }}>
      
      {/* ヘッダー：タイトルを大きく修正 */}
      <header style={{ padding: '25px 15px', background: '#600000', borderBottom: '1px solid #D4AF37', textAlign: 'center', flexShrink: 0, zIndex: 10 }}>
        <h1 style={{ fontSize: '1.6rem', fontStyle: 'italic', fontWeight: 'bold', margin: 0, letterSpacing: '4px', color: '#fff' }}>
          for VAU
        </h1>
      </header>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 15px', background: '#050505' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {messages.map((m, index) => {
            const isMe = m.user_id === user?.id;
            const date = new Date(m.created_at);
            const isNewDay = index === 0 || new Date(messages[index-1].created_at).toDateString() !== date.toDateString();

            return (
              <div key={m.id}>
                {isNewDay && (
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0 20px' }}>
                    <div style={{ color: '#D4AF37', fontSize: '0.65rem', letterSpacing: '2px', fontWeight: 'bold', fontStyle: 'italic' }}>
                      -{date.getFullYear()}/{String(date.getMonth() + 1).padStart(2, '0')}/{String(date.getDate()).padStart(2, '0')}-
                    </div>
                  </div>
                )}
                <div style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', flexDirection: isMe ? 'row-reverse' : 'row', width: '100%' }}>
                    <div style={{ 
                      padding: m.is_image ? '5px' : '12px 16px', 
                      background: isMe ? 'rgba(80, 0, 0, 0.75)' : 'rgba(26, 26, 26, 0.75)', 
                      borderRadius: isMe ? '18px 2px 18px 18px' : '2px 18px 18px 18px', 
                      border: '1px solid #D4AF37', 
                      fontSize: '0.95rem', 
                      maxWidth: '85%', // ホスト側のグローバルと同じ幅
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#fff'
                    }}>
                      {m.is_image ? (
                        <img src={m.content} style={{ maxWidth: '100%', borderRadius: '10px', display: 'block' }} alt="" onLoad={() => scrollToBottom()} />
                      ) : m.content}
                    </div>
                    <div style={{ fontSize: '0.55rem', color: '#D4AF37', opacity: 0.8, paddingBottom: '4px', whiteSpace: 'nowrap' }}>
                      {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <footer style={{ padding: '12px 15px', background: '#600000', borderTop: '1px solid #D4AF37', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', flexShrink: 0 }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          
          {/* おしゃれなカメラアイコンボタン */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ 
              background: 'transparent', border: '1px solid #D4AF37', borderRadius: '50%', 
              width: '42px', height: '42px', display: 'flex', alignItems: 'center', 
              justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: '0.2s',
              opacity: uploading ? 0.5 : 1
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
          <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />

          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
            placeholder="メッセージを入力..."
            rows={1}
            style={{ 
              flex: 1, background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(212,175,55,0.3)', 
              borderRadius: '22px', padding: '10px 18px', fontSize: '16px', resize: 'none', outline: 'none', maxHeight: '150px'
            }}
          />
          
          <button
            onClick={handleSend}
            style={{ 
              background: '#000', color: '#D4AF37', border: '1px solid #D4AF37', 
              borderRadius: '22px', padding: '10px 20px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer'
            }}
          >
            SEND
          </button>
        </div>
      </footer>
    </div>
  );
}
