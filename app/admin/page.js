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

  // テキスト送信
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
  };

  // 画像アップロード・送信
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(filePath);

      const newMessage = {
        content: publicUrl,
        user_id: user.id,
        receiver_id: ADMIN_ID,
        is_image: true,
        is_read: false
      };

      await supabase.from('messages').insert([newMessage]);
    } catch (error) {
      console.error('Error uploading image:', error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ 
      width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', 
      background: '#000', color: '#fff', overflow: 'hidden', fontFamily: 'serif' 
    }}>
      {/* ヘッダー：パディングを増やして高さをアップ */}
      <header style={{ 
        padding: '25px 15px', background: '#600000', borderBottom: '1px solid #D4AF37', 
        textAlign: 'center', flexShrink: 0, zIndex: 10
      }}>
        <h1 style={{ 
          fontSize: '1.4rem', fontStyle: 'italic', fontWeight: 'bold', 
          margin: 0, letterSpacing: '3px', color: '#fff' 
        }}>
          for VAU
        </h1>
      </header>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 15px', background: '#050505' }}>
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
                    <div style={{ color: '#D4AF37', fontSize: '0.65rem', letterSpacing: '2px', fontWeight: 'bold', fontStyle: 'italic' }}>
                      {dateStr}
                    </div>
                  </div>
                )}
                <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                    <div style={{ 
                      padding: m.is_image ? '5px' : '10px 14px', 
                      background: isMe ? 'rgba(80, 0, 0, 0.75)' : 'rgba(26, 26, 26, 0.75)', 
                      borderRadius: isMe ? '18px 2px 18px 18px' : '2px 18px 18px 18px', 
                      border: '1px solid #D4AF37', 
                      fontSize: '0.9rem', maxWidth: '240px', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                    }}>
                      {m.is_image ? (
                        <img src={m.content} style={{ maxWidth: '100%', borderRadius: '10px', display: 'block' }} alt="" onLoad={() => scrollToBottom()} />
                      ) : m.content}
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

      <footer style={{ 
        padding: '12px 15px', background: '#600000', borderTop: '1px solid #D4AF37',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))'
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          {/* 写真送信ボタン */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ 
              background: 'transparent', border: '1px solid rgba(212,175,55,0.5)', 
              borderRadius: '50%', width: '40px', height: '40px', display: 'flex', 
              alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0
            }}
          >
            <span style={{ color: '#D4AF37', fontSize: '1.2rem' }}>{uploading ? '...' : '📷'}</span>
          </button>
          <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />

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
              borderRadius: '20px', padding: '10px 18px', fontWeight: 'bold', fontSize: '0.8rem' 
            }}
          >
            SEND
          </button>
        </div>
      </footer>
    </div>
  );
}
