// --- renderMessages関数の中身を以下のように差し替えてください ---

  const renderMessages = () => {
    const filtered = (viewMode === 'DIRECT' 
      ? messages.filter(m => (m.user_id === selectedGuestId && m.receiver_id === ADMIN_ID) || (m.user_id === ADMIN_ID && m.receiver_id === selectedGuestId))
      : messages
    );

    return (
      /* チャット欄の横幅を狭くし、中央寄せにする設定 */
      <div style={{ 
        maxWidth: '340px', // ここでチャット欄の最大幅を制限
        margin: '0 auto',   // 中央に寄せる
        width: '100%', 
        paddingBottom: '20px' 
      }}>
        {filtered.map((m, index) => {
          const isMe = m.user_id === ADMIN_ID;
          const senderProfile = guests.find(g => g.id === m.user_id);
          const date = new Date(m.created_at);
          const dateStr = `-${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}-`;
          const prevMsg = index > 0 ? filtered[index - 1] : null;
          const isNewDay = !prevMsg || new Date(prevMsg.created_at).toDateString() !== date.toDateString();

          return (
            <div key={m.id}>
              {isNewDay && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
                  <div style={{ color: '#D4AF37', fontSize: '0.6rem', letterSpacing: '2px', fontWeight: 'bold' }}>
                    {dateStr}
                  </div>
                </div>
              )}
              <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexDirection: isMe ? 'row-reverse' : 'row', width: '100%' }}>
                  {!isMe && viewMode !== 'DIRECT' && <div style={{ marginTop: '2px' }}><Avatar profile={senderProfile} size="32px" /></div>}
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
                    {!isMe && viewMode === 'GLOBAL' && (
                      <span style={{ fontSize: '0.75rem', color: '#D4AF37', fontWeight: 'bold', marginBottom: '4px', marginLeft: '2px' }}>
                        {senderProfile?.username || 'Guest'}
                      </span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                      <div 
                        onContextMenu={(e) => handleContextMenu(e, m)}
                        style={{ 
                          padding: m.is_image ? '4px' : '10px 14px', 
                          background: isMe ? 'rgba(80, 0, 0, 0.8)' : 'rgba(30, 30, 30, 0.9)', 
                          borderRadius: isMe ? '16px 2px 16px 16px' : '2px 16px 16px 16px', 
                          border: isMe ? '1px solid rgba(150, 0, 0, 0.5)' : '1px solid #D4AF37', 
                          fontSize: '0.85rem', color: '#fff', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          position: 'relative',
                          boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                        }}>
                        {m.is_image ? (
                          <img src={m.content} onLoad={scrollToBottomInstant} style={{ maxWidth: '100%', borderRadius: '10px', display: 'block' }} />
                        ) : m.content}

                        {/* メニューの表示位置調整 */}
                        {activeMenuId === m.id && (
                          <div style={{
                            position: 'absolute', top: '100%', [isMe ? 'right' : 'left']: 0, zIndex: 100,
                            background: '#1a1a1a', border: '1px solid #D4AF37', borderRadius: '8px',
                            marginTop: '5px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', width: 'max-content'
                          }}>
                            <button style={{ padding: '12px 16px', background: 'none', border: 'none', color: '#fff', borderBottom: '1px solid #333', textAlign: 'left', fontSize: '0.8rem' }}>編集</button>
                            <button style={{ padding: '12px 16px', background: 'none', border: 'none', color: '#ff4444', textAlign: 'left', fontSize: '0.8rem' }}>削除</button>
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '0.5rem', color: '#D4AF37', opacity: 0.7, marginBottom: '2px' }}>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
