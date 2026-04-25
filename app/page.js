"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const H = "bed1d346-5186-49cb-a371-1aad719c2a56", S = "vau2026";

const CameraIcon = () => (
  <svg width="22" height="20" viewBox="0 0 24 22" fill="none" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

const InitialAvatar = ({ name, size = '48px', fontSize = '1.4rem' }) => {
  const defaultChar = "V";
  const initial = name && name.trim() ? Array.from(name.trim())[0].toUpperCase() : defaultChar;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #D4AF37 0%, #B69121 100%)',
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 'bold', fontSize: fontSize, textShadow: '0 1px 2px rgba(0,0,0,0.2)',
      letterSpacing: '-1px', userSelect: 'none',
      border: '2px solid #D4AF37',
      WebkitUserSelect: 'none'
    }}>{initial}</div>
  );
};

export default function ChatPage() {
  const [ms, setMs] = useState([]), [ct, setCt] = useState(''), [user, setUser] = useState(null);
  const [pr, setPr] = useState({ username: '', avatar_url: '' }), [em, setEm] = useState(''), [pw, setPw] = useState('');
  const [isA, setA] = useState(false), [setOk, setSetOk] = useState(false), [isUp, setIsUp] = useState(false);
  const [ld, setLd] = useState(true), scRef = useRef(null), txRef = useRef(null);
  
  const [menu, setMenu] = useState(null);
  const longPressTimer = useRef(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search), ad = p.get('admin') === S;
    if (ad) setA(true);
    const init = async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s?.user) { setUser(s.user); await loadP(s.user.id); await loadM(s.user, ad, true); }
      setLd(false);
    };
    init();
    const { data: auth } = supabase.auth.onAuthStateChange((ev, s) => {
      const u = s?.user; setUser(u);
      if (ev === 'SIGNED_IN' && u) { loadP(u.id); loadM(u, ad, true); }
    });
    const ch = supabase.channel('db').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
      supabase.auth.getUser().then(({data:{user:u}}) => u && loadM(u, ad, false));
    }).subscribe();
    return () => { auth.subscription.unsubscribe(); supabase.removeChannel(ch); };
  }, []);

  useEffect(() => { 
    if (txRef.current) { 
      txRef.current.style.height = '38px';
      if (ct) txRef.current.style.height = Math.min(txRef.current.scrollHeight, 150) + 'px'; 
    } 
  }, [ct]);

  const loadP = async (id) => {
    const { data: d } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (d) setPr({ username: d.username || '', avatar_url: d.avatar_url || '' });
  };

  const loadM = async (u, ad, sc) => {
    if (!u) return;
    const { data: d } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (!d) return;
    const isAdm = u.id === H || ad;
    setMs(d.filter(m => isAdm || m.user_id === u.id || (m.user_id === H && m.recipient_id === u.id)));
    if (sc) setTimeout(() => scRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
  };

  const deleteMsg = async (id, all = false) => {
    if (all && !confirm("相手の画面からも消去しますか？")) return;
    const { error } = await supabase.from('messages').delete().eq('id', id);
    if (error) alert(error.message); else loadM(user, isA, false);
    setMenu(null);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setMenu(null);
    }).catch(err => alert("コピーに失敗しました"));
  };

  const handleTouchStart = (m) => {
    longPressTimer.current = setTimeout(() => {
      setMenu(m);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const authAction = async () => {
    const { error: e } = isUp ? await supabase.auth.signUp({ email:em, password:pw }) : await supabase.auth.signInWithPassword({ email:em, password:pw });
    if (e) alert(e.message);
  };

  const savePr = async () => {
    if(!pr.username.trim()) return alert("名前を入力してください");
    await supabase.from('profiles').upsert({ id: user.id, username: pr.username, avatar_url: pr.avatar_url });
    setSetOk(false);
  };

  // ★ 修正ポイント: 管理画面に名前とアイコンを送るように
