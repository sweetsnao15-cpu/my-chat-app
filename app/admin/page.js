// ...（前略：Avatarコンポーネント等はそのまま）

export default function AdminPage() {
  // ...（中略：StateやuseEffectはそのまま）

  return (
    <div style={{ 
      // 100dvh を使うことでスマホのツールバーを除いた「実際の表示領域」に合わせます
      width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column', 
      background: '#000', color: '#fff', overflow: 'hidden', fontFamily: 'serif',
      WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none'
    }}>
      <style jsx global>{`
        * { -webkit-tap-highlight-color: transparent !important; outline: none !important; }
        ::selection { background: transparent !important; color: inherit !important; }
        /* スクロールバーを非表示にする（任意） */
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ヘッダー：flex-shrink: 0 で高さを固定 */}
      <header style={{ 
        paddingTop: 'env(safe-area-inset-top)', // ノッチ対策
        background: '#800020', borderBottom: '1px solid #D4AF37', 
        textAlign: 'center', flexShrink: 0, z : 10, 
        minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' 
      }}>
        <h1 style={{ fontSize: '1.8rem', fontStyle: 'italic', fontWeight: 'bold', margin: 0, letterSpacing: '3px', color: '#fff' }}>
          for VAU <span style={{ fontSize: '1.1rem', verticalAlign: 'middle', color: '#D4AF37' }}>ｰHOSTｰ</span>
        </h1>
      </header>

      {/* メインエリア：flex: 1 で残りの高さをすべて使い切る */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {viewMode === 'DIRECT' && (
          <div className="hide-scrollbar" style={{ 
            width: '80px', borderRight: '1px solid #222', overflowY: 'auto', 
            display: 'flex', flexDirection: 'column', gap: '20px', padding: '15px 0', flexShrink: 0 
          }}>
            {sortedGuests.map(g => (
              <div key={g.id} onClick={() => setSelectedGuestId(g.id)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Avatar profile={g} size="45px" isSelected={selectedGuestId === g.id} />
                <div style={{ fontSize: '0.5rem', color: selectedGuestId === g.id ? '#D4AF37' : '#555', marginTop: '5px' }}>{g.username?.substring(0, 5)}</div>
              </div>
            ))}
          </div>
        )}
        {/* チャット表示エリア：ここがスクロール可能になる */}
        <div 
          className="hide-scrollbar"
          style={{ flex: 1, background: '#050505', overflowY: 'auto', padding: '15px' }} 
          ref={scrollRef}
        >
          {renderMessages()}
        </div>
      </div>

      {/* フッター：flex-shrink: 0 で高さを固定 */}
      <footer style={{ 
        background: '#800020', borderTop: '1px solid #D4AF37', 
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '40px', 
        paddingTop: '12px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', // 下部のバー対策
        flexShrink: 0, zIndex: 10 
      }}>
        {['GLOBAL', 'DIRECT'].map(mode => (
          <button key={mode} onClick={() => setViewMode(mode)} style={{ background: 'transparent', color: viewMode === mode ? '#D4AF37' : 'rgba(255,255,255,0.6)', border: 'none', fontSize: '0.85rem', fontWeight: 'bold', letterSpacing: '2px', padding: '5px 10px', borderBottom: viewMode === mode ? '1px solid #D4AF37' : '1px solid transparent', cursor: 'pointer' }}>{mode}</button>
        ))}
      </footer>
    </div>
  );
}
