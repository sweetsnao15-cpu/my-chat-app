"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const ADMIN_ID = "bed1d346-5186-49cb-a371-1aad719c2a56";

const CameraIcon = () => (
  <svg width="22" height="20" viewBox="0 0 24 22" fill="none" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

const InitialAvatar = ({ name, size = '48px', fontSize = '1.4rem' }) => {
  const initial = name && name.trim() ? Array.from(name.trim())[0].toUpperCase() : "V";
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #D4AF37 0%, #B69121 100%)',
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 'bold', fontSize: fontSize, border: '2px solid #D4AF37'
    }}>{initial}</div>
  );
};

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ username: '', avatar_url: '' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const scrollRef = useRef(null);
  const textareaRef = useRef(null); // 入力欄高さ調整用

  // --- 入力欄の高さを自動調整する処理 ---
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "42px"; // 一旦リセット
      const scrollHeight = textareaRef.current.scrollHeight;
      // 最大150pxまで伸びるように設定
      textareaRef.current.style.height = Math.min(scrollHeight, 150) + "px";
    }
  }, [inputText]);

  const loadProfile = useCallback(async (id) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (data) setProfile({ username: data.username || '', avatar_url: data.avatar_url || '' });
  }, []);

  const fetchMessages = useCallback(async (uid) => {
    if (!uid) return;
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) {
      setMessages(data.filter(m => m.user_id === uid || (m.user_id === ADMIN_ID && m.receiver_id === uid)));
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadProfile(session.user.id);
      }
      setLoading(false);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
    });
    return () => authListener.subscription.unsubscribe();
  }, [loadProfile]);

  useEffect(() => {
    if (!user) return;
    fetchMessages(user.id);
    const channel = supabase.channel(`room_${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchMessages(user.id)).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchMessages]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (imgUrl = null) => {
    if ((!inputText.trim() && !imgUrl) || !user) return;
    const contentBody = imgUrl || inputText;
    setInputText('');
    const { error } = await supabase.from('messages').insert([{
      content: contentBody,
      user_id: user.id,
      is_image: !!imgUrl,
      receiver_id: ADMIN_ID
    }]);
    if (error) { alert("送信失敗"); setInputText(contentBody); }
  };

  const handleFileUpload = async (e) => {
    const f = e.target.files[0];
    if (!f || !user) return;
    const path = `chats/${user.id}/${Date.now()}`;
    await supabase.storage.from('chat-images').upload(path, f);
    const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(path);
    handleSend(publicUrl);
  };

  if (loading) return <div style={{ background: '#000', height: '100dvh' }} />;

  if (!user) return (
    <div style={{ minHeight: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '40px 30px', background: '#0a0a0a', color: '#fff', borderRadius: '30px', border: '2px solid #800000', textAlign: 'center' }}>
        <h2 style={{ color: '#800
