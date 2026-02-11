import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, update, get, remove } from 'firebase/database';

/**
 * BoardBrain™ - Multi-Device Clue Deduction Assistant
 * Copyright © 2024 Pat Boulay. All Rights Reserved.
 * More Brain. Better Game.
 */

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBW2PAhPLH0BxCkVNy_cn8W5yvj5_8NWh4",
  authDomain: "boardbrain-7580e.firebaseapp.com",
  databaseURL: "https://boardbrain-7580e-default-rtdb.firebaseio.com",
  projectId: "boardbrain-7580e",
  storageBucket: "boardbrain-7580e.firebasestorage.app",
  messagingSenderId: "563848678256",
  appId: "1:563848678256:web:b48bcc5a6740788c5a9db5"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const CLUE_DATA = {
  suspects: ['Colonel Mustard', 'Miss Scarlet', 'Professor Plum', 'Mr. Green', 'Mrs. White', 'Mrs. Peacock'],
  weapons: ['Candlestick', 'Knife', 'Lead Pipe', 'Revolver', 'Rope', 'Wrench'],
  rooms: ['Kitchen', 'Ballroom', 'Conservatory', 'Dining Room', 'Billiard Room', 'Library', 'Lounge', 'Hall', 'Study']
};

// Session Helpers
const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const saveSession = (roomCode, playerId, playerName, isHost) => {
  localStorage.setItem('boardbrain_session', JSON.stringify({ roomCode, playerId, playerName, isHost, timestamp: Date.now() }));
};

const loadSession = () => {
  try {
    const data = localStorage.getItem('boardbrain_session');
    if (!data) return null;
    const session = JSON.parse(data);
    if (Date.now() - session.timestamp > 4 * 60 * 60 * 1000) { clearSession(); return null; }
    return session;
  } catch { return null; }
};

const clearSession = () => localStorage.removeItem('boardbrain_session');

// Styles
const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0f172a', color: '#f1f5f9', fontFamily: "'Inter', -apple-system, sans-serif", padding: '1rem', boxSizing: 'border-box' },
  card: { backgroundColor: '#1e293b', borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3)' },
  header: { textAlign: 'center', marginBottom: '1.5rem' },
  title: { fontSize: '2rem', fontWeight: '800', background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.25rem' },
  subtitle: { color: '#94a3b8', fontSize: '0.875rem' },
  roomCode: { fontSize: '2.5rem', fontWeight: '800', letterSpacing: '0.25em', color: '#fbbf24', textAlign: 'center', fontFamily: "'Courier New', monospace", padding: '1rem', backgroundColor: '#0f172a', borderRadius: '0.5rem', marginBottom: '1rem' },
  button: { width: '100%', padding: '1rem 1.5rem', borderRadius: '0.5rem', border: 'none', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', color: 'white', marginBottom: '0.75rem' },
  buttonSecondary: { background: 'transparent', border: '2px solid #475569', color: '#cbd5e1' },
  buttonDanger: { background: 'transparent', border: '2px solid #dc2626', color: '#f87171' },
  buttonDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  input: { width: '100%', padding: '0.875rem 1rem', borderRadius: '0.5rem', border: '2px solid #334155', backgroundColor: '#0f172a', color: '#f1f5f9', fontSize: '1rem', marginBottom: '0.75rem', boxSizing: 'border-box' },
  select: { width: '100%', padding: '0.875rem 1rem', borderRadius: '0.5rem', border: '2px solid #334155', backgroundColor: '#0f172a', color: '#f1f5f9', fontSize: '1rem', marginBottom: '0.75rem', boxSizing: 'border-box', cursor: 'pointer' },
  playerChip: { display: 'inline-flex', alignItems: 'center', padding: '0.5rem 1rem', borderRadius: '2rem', backgroundColor: '#334155', color: '#e2e8f0', fontSize: '0.875rem', marginRight: '0.5rem', marginBottom: '0.5rem' },
  progressBar: { width: '100%', height: '8px', backgroundColor: '#334155', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.5rem' },
  progressFill: { height: '100%', backgroundColor: '#22c55e', transition: 'width 0.3s ease' },
  turnIndicator: { padding: '0.75rem 1rem', borderRadius: '0.5rem', textAlign: 'center', fontWeight: '600', marginBottom: '1rem' },
  myTurn: { backgroundColor: '#166534', border: '2px solid #22c55e', color: '#bbf7d0' },
  notMyTurn: { backgroundColor: '#1e293b', border: '2px solid #475569', color: '#94a3b8' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' },
  th: { padding: '0.5rem 0.25rem', textAlign: 'center', color: '#94a3b8', fontWeight: '600', borderBottom: '2px solid #334155' },
  td: { padding: '0.375rem 0.25rem', textAlign: 'center', borderBottom: '1px solid #1e293b' },
  cardChip: { display: 'inline-block', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.875rem', margin: '0.25rem', cursor: 'pointer', border: '2px solid transparent' },
  cardChipSelected: { backgroundColor: '#8b5cf6', color: 'white', border: '2px solid #a78bfa' },
  cardChipUnselected: { backgroundColor: '#334155', color: '#cbd5e1', border: '2px solid #475569' },
};

export default function BoardBrain() {
  const [appPhase, setAppPhase] = useState('loading');
  const [roomCode, setRoomCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [myPrivateData, setMyPrivateData] = useState(null);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [expectedPlayers, setExpectedPlayers] = useState(4);
  const [selectedCards, setSelectedCards] = useState([]);
  const [error, setError] = useState('');

  // Session restoration
  useEffect(() => {
    const restore = async () => {
      const session = loadSession();
      if (session) {
        const snapshot = await get(ref(database, `rooms/${session.roomCode}/game`));
        if (snapshot.exists()) {
          const data = snapshot.val();
          if (data.players?.[session.playerId]) {
            setRoomCode(session.roomCode);
            setPlayerId(session.playerId);
            setPlayerName(session.playerName);
            setIsHost(session.isHost);
            setAppPhase(data.phase === 'playing' ? 'playing' : 'lobby');
            return;
          }
        }
        clearSession();
      }
      setAppPhase('welcome');
    };
    restore();
  }, []);

  // Firebase listeners
  useEffect(() => {
    if (!roomCode) return;
    const unsub1 = onValue(ref(database, `rooms/${roomCode}/game`), (snap) => {
      const data = snap.val();
      if (data) {
        setGameState(data);
        if (data.phase === 'playing' && appPhase === 'lobby') setAppPhase('playing');
      }
    });
    let unsub2 = () => {};
    if (playerId) {
      unsub2 = onValue(ref(database, `rooms/${roomCode}/private/${playerId}`), (snap) => {
        if (snap.val()) setMyPrivateData(snap.val());
      });
    }
    return () => { unsub1(); unsub2(); };
  }, [roomCode, playerId, appPhase]);

  const createRoom = async () => {
    if (!nameInput.trim()) { setError('Please enter your name'); return; }
    const code = generateRoomCode();
    const pid = `player_${Date.now()}`;
    const cardsPerPlayer = Math.floor(18 / expectedPlayers);
    const remainderCards = 18 % expectedPlayers;
    
    await set(ref(database, `rooms/${code}`), {
      game: {
        phase: 'lobby', hostId: pid,
        players: { [pid]: { id: pid, name: nameInput.trim(), character: null, isReady: false, joinedAt: Date.now() } },
        settings: { expectedPlayers, cardsPerPlayer, remainderCards },
        currentTurn: 0, currentPlayerIndex: 0, moves: [], createdAt: Date.now()
      },
      private: { [pid]: { cards: [], shownToMe: [] } }
    });
    
    saveSession(code, pid, nameInput.trim(), true);
    setRoomCode(code); setPlayerId(pid); setPlayerName(nameInput.trim()); setIsHost(true); setAppPhase('lobby'); setError('');
  };

  const joinRoom = async () => {
    if (!nameInput.trim()) { setError('Please enter your name'); return; }
    if (joinCodeInput.length !== 6) { setError('Enter 6-character code'); return; }
    
    const code = joinCodeInput.toUpperCase();
    const snapshot = await get(ref(database, `rooms/${code}/game`));
    if (!snapshot.exists()) { setError('Room not found'); return; }
    
    const data = snapshot.val();
    if (data.phase !== 'lobby') { setError('Game already started'); return; }
    
    const currentCount = Object.keys(data.players || {}).length;
    const expected = data.settings?.expectedPlayers || 6;
    if (currentCount >= expected) { setError('Room is full'); return; }
    
    const pid = `player_${Date.now()}`;
    await update(ref(database, `rooms/${code}/game/players`), {
      [pid]: { id: pid, name: nameInput.trim(), character: null, isReady: false, joinedAt: Date.now() }
    });
    await set(ref(database, `rooms/${code}/private/${pid}`), { cards: [], shownToMe: [] });
    
    saveSession(code, pid, nameInput.trim(), false);
    setRoomCode(code); setPlayerId(pid); setPlayerName(nameInput.trim()); setIsHost(false); setAppPhase('lobby'); setError('');
  };

  const leaveGame = async () => {
    if (roomCode && playerId) {
      try {
        await remove(ref(database, `rooms/${roomCode}/game/players/${playerId}`));
        await remove(ref(database, `rooms/${roomCode}/private/${playerId}`));
      } catch {}
    }
    clearSession();
    setRoomCode(''); setPlayerId(''); setPlayerName(''); setIsHost(false);
    setGameState(null); setMyPrivateData(null); setSelectedCards([]); setAppPhase('welcome');
  };

  const selectCharacter = async (char) => {
    const players = gameState?.players || {};
    if (Object.values(players).some(p => p.character === char && p.id !== playerId)) {
      setError(`${char} is taken`); return;
    }
    await update(ref(database, `rooms/${roomCode}/game/players/${playerId}`), { character: char });
    setError('');
  };

  const toggleCard = (card) => {
    const max = gameState?.settings?.cardsPerPlayer || 3;
    setSelectedCards(prev => prev.includes(card) ? prev.filter(c => c !== card) : prev.length < max ? [...prev, card] : prev);
  };

  const confirmCards = async () => {
    await update(ref(database, `rooms/${roomCode}/private/${playerId}`), { cards: selectedCards });
    await update(ref(database, `rooms/${roomCode}/game/players/${playerId}`), { isReady: true });
  };

  const startGame = async () => {
    const players = Object.values(gameState?.players || {});
    if (!players.every(p => p.isReady)) { setError('All must be ready'); return; }
    const sorted = players.sort((a, b) => a.joinedAt - b.joinedAt);
    await update(ref(database, `rooms/${roomCode}/game`), {
      phase: 'playing', currentTurn: 1, currentPlayerIndex: 0, turnOrder: sorted.map(p => p.id)
    });
  };

  const submitSuggestion = async (suspect, weapon, room) => {
    await update(ref(database, `rooms/${roomCode}/game`), {
      currentMove: { id: `move_${Date.now()}`, turn: gameState.currentTurn, suggesterId: playerId, suggesterName: playerName, suspect, weapon, room, responses: {}, timestamp: Date.now() },
      awaitingResponse: true
    });
  };

  const respondToSuggestion = async (response, cardShown = null) => {
    const move = gameState.currentMove;
    await update(ref(database, `rooms/${roomCode}/game/currentMove/responses/${playerId}`), { response, cardShown });
    if (response === 'showed' && cardShown) {
      const snap = await get(ref(database, `rooms/${roomCode}/private/${move.suggesterId}/shownToMe`));
      const current = snap.val() || [];
      await set(ref(database, `rooms/${roomCode}/private/${move.suggesterId}/shownToMe`), 
        [...current, { card: cardShown, shownBy: playerId, shownByName: playerName, turn: gameState.currentTurn }]);
    }
  };

  const advanceTurn = async () => {
    const order = gameState.turnOrder || [];
    const next = (gameState.currentPlayerIndex + 1) % order.length;
    const moves = gameState.moves || [];
    await update(ref(database, `rooms/${roomCode}/game`), {
      currentTurn: gameState.currentTurn + 1, currentPlayerIndex: next,
      currentMove: null, awaitingResponse: false,
      moves: gameState.currentMove ? [...moves, gameState.currentMove] : moves
    });
  };

  // RENDER
  if (appPhase === 'loading') return <div style={styles.container}><div style={{textAlign:'center',paddingTop:'4rem'}}><h1 style={styles.title}>BoardBrain™</h1><p style={styles.subtitle}>Loading...</p></div></div>;

  if (appPhase === 'welcome') return (
    <div style={styles.container}>
      <div style={{maxWidth:'28rem',margin:'0 auto',paddingTop:'2rem'}}>
        <div style={styles.header}><h1 style={styles.title}>BoardBrain™</h1><p style={styles.subtitle}>More Brain. Better Game.</p></div>
        <div style={styles.card}>
          <p style={{color:'#cbd5e1',marginBottom:'1.5rem',textAlign:'center'}}>Your personal AI strategy companion. Each player uses their own device.</p>
          <button style={styles.button} onClick={() => setAppPhase('createRoom')}>🎮 Create New Game</button>
          <button style={{...styles.button,...styles.buttonSecondary}} onClick={() => setAppPhase('joinRoom')}>🚪 Join Existing Game</button>
        </div>
        <p style={{textAlign:'center',color:'#64748b',fontSize:'0.75rem',marginTop:'2rem'}}>© 2024 Pat Boulay. All Rights Reserved.</p>
      </div>
    </div>
  );

  if (appPhase === 'createRoom') return (
    <div style={styles.container}>
      <div style={{maxWidth:'28rem',margin:'0 auto',paddingTop:'2rem'}}>
        <div style={styles.header}><h1 style={styles.title}>BoardBrain™</h1><p style={styles.subtitle}>Create a New Game</p></div>
        <div style={styles.card}>
          <label style={{display:'block',color:'#94a3b8',marginBottom:'0.5rem',fontSize:'0.875rem'}}>Your Name</label>
          <input type="text" value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Enter your name" style={styles.input} maxLength={20} />
          <label style={{display:'block',color:'#94a3b8',marginBottom:'0.5rem',fontSize:'0.875rem'}}>How many players?</label>
          <select value={expectedPlayers} onChange={e => setExpectedPlayers(parseInt(e.target.value))} style={styles.select}>
            <option value={3}>3 players (6 cards each)</option>
            <option value={4}>4 players (4 cards each, 2 public)</option>
            <option value={5}>5 players (3 cards each, 3 public)</option>
            <option value={6}>6 players (3 cards each)</option>
          </select>
          {error && <p style={{color:'#f87171',fontSize:'0.875rem',marginBottom:'1rem'}}>{error}</p>}
          <button style={styles.button} onClick={createRoom}>Create Room</button>
          <button style={{...styles.button,...styles.buttonSecondary}} onClick={() => {setAppPhase('welcome');setError('');}}>← Back</button>
        </div>
      </div>
    </div>
  );

  if (appPhase === 'joinRoom') return (
    <div style={styles.container}>
      <div style={{maxWidth:'28rem',margin:'0 auto',paddingTop:'2rem'}}>
        <div style={styles.header}><h1 style={styles.title}>BoardBrain™</h1><p style={styles.subtitle}>Join a Game</p></div>
        <div style={styles.card}>
          <label style={{display:'block',color:'#94a3b8',marginBottom:'0.5rem',fontSize:'0.875rem'}}>Your Name</label>
          <input type="text" value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Enter your name" style={styles.input} maxLength={20} />
          <label style={{display:'block',color:'#94a3b8',marginBottom:'0.5rem',fontSize:'0.875rem'}}>Room Code</label>
          <input type="text" value={joinCodeInput} onChange={e => setJoinCodeInput(e.target.value.toUpperCase())} placeholder="ABC123" style={{...styles.input,textAlign:'center',letterSpacing:'0.2em',fontSize:'1.25rem'}} maxLength={6} />
          {error && <p style={{color:'#f87171',fontSize:'0.875rem',marginBottom:'1rem'}}>{error}</p>}
          <button style={styles.button} onClick={joinRoom} disabled={joinCodeInput.length !== 6}>Join Room</button>
          <button style={{...styles.button,...styles.buttonSecondary}} onClick={() => {setAppPhase('welcome');setError('');}}>← Back</button>
        </div>
      </div>
    </div>
  );

  if (appPhase === 'lobby' && gameState) {
    const players = gameState.players || {};
    const playerList = Object.values(players);
    const numPlayers = playerList.length;
    const expectedNum = gameState.settings?.expectedPlayers || 4;
    const cardsPerPlayer = gameState.settings?.cardsPerPlayer || 3;
    const remainderCards = gameState.settings?.remainderCards || 0;
    const myPlayer = players[playerId];
    const allReady = playerList.every(p => p.isReady);
    const allJoined = numPlayers >= expectedNum;
    const takenChars = playerList.map(p => p.character).filter(Boolean);

    return (
      <div style={styles.container}>
        <div style={{maxWidth:'32rem',margin:'0 auto',paddingTop:'1rem'}}>
          <div style={styles.header}><h1 style={{...styles.title,fontSize:'1.5rem'}}>BoardBrain™</h1><p style={styles.subtitle}>Game Lobby</p></div>
          
          <div style={styles.card}>
            <p style={{color:'#94a3b8',fontSize:'0.875rem',textAlign:'center',marginBottom:'0.5rem'}}>Share this code:</p>
            <div style={styles.roomCode}>{roomCode}</div>
            <div style={styles.progressBar}><div style={{...styles.progressFill,width:`${(numPlayers/expectedNum)*100}%`}}/></div>
            <p style={{color:'#64748b',fontSize:'0.875rem',textAlign:'center'}}>{numPlayers} of {expectedNum} players joined</p>
            <div style={{marginTop:'1rem',padding:'0.75rem',backgroundColor:'#0f172a',borderRadius:'0.5rem'}}>
              <p style={{color:'#94a3b8',fontSize:'0.75rem',textAlign:'center'}}>📋 {cardsPerPlayer} cards per player{remainderCards > 0 && ` • ${remainderCards} public`}</p>
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={{marginBottom:'1rem',fontSize:'1rem'}}>Players</h3>
            <div style={{display:'flex',flexWrap:'wrap',gap:'0.5rem'}}>
              {playerList.map(p => (
                <div key={p.id} style={{...styles.playerChip,backgroundColor:p.isReady?'#166534':'#334155',border:p.id===playerId?'2px solid #8b5cf6':'2px solid transparent'}}>
                  {p.isReady && <span style={{marginRight:'0.5rem'}}>✓</span>}
                  {p.name}
                  {p.character && <span style={{marginLeft:'0.5rem',color:'#94a3b8'}}>({p.character.split(' ')[1]})</span>}
                  {p.id === gameState.hostId && <span style={{marginLeft:'0.5rem'}}>👑</span>}
                </div>
              ))}
              {Array.from({length:expectedNum-numPlayers}).map((_,i) => (
                <div key={`e${i}`} style={{...styles.playerChip,backgroundColor:'transparent',border:'2px dashed #475569',color:'#64748b'}}>Waiting...</div>
              ))}
            </div>
          </div>

          {!myPlayer?.character && (
            <div style={styles.card}>
              <h3 style={{marginBottom:'1rem',fontSize:'1rem'}}>Select Your Character</h3>
              <div style={{display:'flex',flexWrap:'wrap',gap:'0.5rem'}}>
                {CLUE_DATA.suspects.map(c => (
                  <button key={c} onClick={() => selectCharacter(c)} disabled={takenChars.includes(c)}
                    style={{...styles.cardChip,...(takenChars.includes(c)?{opacity:0.4,cursor:'not-allowed'}:styles.cardChipUnselected)}}>
                    {c}
                  </button>
                ))}
              </div>
              {error && <p style={{color:'#f87171',fontSize:'0.875rem',marginTop:'0.75rem'}}>{error}</p>}
            </div>
          )}

          {myPlayer?.character && !myPlayer?.isReady && (
            <div style={styles.card}>
              <h3 style={{marginBottom:'0.5rem',fontSize:'1rem'}}>Select Your Cards</h3>
              <p style={{color:'#94a3b8',fontSize:'0.875rem',marginBottom:'1rem'}}>Select {cardsPerPlayer} cards: {selectedCards.length}/{cardsPerPlayer}</p>
              {['suspects','weapons','rooms'].map(cat => (
                <div key={cat} style={{marginBottom:'1rem'}}>
                  <p style={{color:'#64748b',fontSize:'0.75rem',textTransform:'uppercase',marginBottom:'0.5rem'}}>{cat}</p>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'0.25rem'}}>
                    {CLUE_DATA[cat].map(card => (
                      <button key={card} onClick={() => toggleCard(card)}
                        style={{...styles.cardChip,...(selectedCards.includes(card)?styles.cardChipSelected:styles.cardChipUnselected),fontSize:'0.75rem',padding:'0.375rem 0.5rem'}}>
                        {card}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={confirmCards} disabled={selectedCards.length !== cardsPerPlayer}
                style={{...styles.button,...(selectedCards.length !== cardsPerPlayer?styles.buttonDisabled:{})}}>
                Confirm Cards ✓
              </button>
            </div>
          )}

          {myPlayer?.isReady && (
            <div style={{...styles.card,backgroundColor:'#166534',border:'2px solid #22c55e'}}>
              <p style={{textAlign:'center',color:'#bbf7d0',fontWeight:'600'}}>
                ✓ Ready! {!allJoined ? `Waiting for ${expectedNum-numPlayers} more...` : !allReady ? 'Waiting for others...' : ''}
              </p>
            </div>
          )}

          {isHost && allReady && allJoined && (
            <button onClick={startGame} style={{...styles.button,background:'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'}}>
              🚀 Start Game ({numPlayers} players)
            </button>
          )}

          <button style={{...styles.button,...styles.buttonDanger,marginTop:'1rem'}} onClick={leaveGame}>🚪 Leave Game</button>
        </div>
      </div>
    );
  }

  if (gameState?.phase === 'playing') {
    const players = gameState.players || {};
    const playerList = Object.values(players);
    const turnOrder = gameState.turnOrder || [];
    const currentPid = turnOrder[gameState.currentPlayerIndex];
    const isMyTurn = currentPid === playerId;
    const currentName = players[currentPid]?.name || 'Unknown';
    const myCards = myPrivateData?.cards || [];
    const shownToMe = myPrivateData?.shownToMe || [];

    return (
      <div style={styles.container}>
        <div style={{maxWidth:'100%',margin:'0 auto'}}>
          <div style={{...styles.header,marginBottom:'1rem'}}>
            <h1 style={{...styles.title,fontSize:'1.5rem'}}>BoardBrain™</h1>
            <p style={styles.subtitle}>Turn {gameState.currentTurn} • You are {playerName}</p>
          </div>

          <div style={{...styles.turnIndicator,...(isMyTurn?styles.myTurn:styles.notMyTurn)}}>
            {isMyTurn ? "🎯 Your Turn!" : `⏳ ${currentName}'s Turn`}
          </div>

          <div style={{...styles.card,padding:'0.75rem'}}>
            <h4 style={{fontSize:'0.75rem',color:'#8b5cf6',marginBottom:'0.5rem'}}>🎴 MY CARDS</h4>
            <div style={{display:'flex',flexWrap:'wrap',gap:'0.25rem'}}>
              {myCards.map(c => <span key={c} style={{padding:'0.25rem 0.5rem',backgroundColor:'#8b5cf6',color:'white',borderRadius:'0.25rem',fontSize:'0.75rem'}}>{c}</span>)}
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={{marginBottom:'0.75rem',fontSize:'1rem'}}>📊 Knowledge Matrix</h3>
            <div style={{overflowX:'auto'}}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{...styles.th,textAlign:'left',minWidth:'80px'}}>Card</th>
                    {playerList.map((p,i) => <th key={p.id} style={styles.th}><div style={{fontSize:'0.625rem',color:p.id===playerId?'#8b5cf6':'#64748b'}}>{p.id===playerId?'ME':`P${i+1}`}</div></th>)}
                    <th style={styles.th}>Sol?</th>
                  </tr>
                </thead>
                <tbody>
                  {['suspects','weapons','rooms'].map(cat => (
                    <React.Fragment key={cat}>
                      <tr style={{backgroundColor:'#1e293b'}}><td colSpan={playerList.length+2} style={{...styles.td,color:'#64748b',fontWeight:'600',textAlign:'left',fontSize:'0.625rem',textTransform:'uppercase'}}>{cat}</td></tr>
                      {CLUE_DATA[cat].map(card => {
                        const iHave = myCards.includes(card);
                        const shown = shownToMe.find(s => s.card === card);
                        return (
                          <tr key={card}>
                            <td style={{...styles.td,textAlign:'left',fontSize:'0.7rem'}}>{card}</td>
                            {playerList.map(p => {
                              let sym = '?', col = '#64748b';
                              if (p.id === playerId && iHave) { sym = '✓'; col = '#4ade80'; }
                              else if (shown?.shownBy === p.id) { sym = '✓'; col = '#4ade80'; }
                              return <td key={p.id} style={styles.td}><span style={{color:col}}>{sym}</span></td>;
                            })}
                            <td style={styles.td}><span style={{color:iHave||shown?'#f87171':'#64748b'}}>{iHave||shown?'✗':'?'}</span></td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {isMyTurn && !gameState.awaitingResponse && <SuggestionUI onSubmit={submitSuggestion} styles={styles} />}
          {gameState.awaitingResponse && gameState.currentMove && (
            <ResponseUI move={gameState.currentMove} playerId={playerId} playerName={playerName} myCards={myCards} onRespond={respondToSuggestion} onAdvance={isHost?advanceTurn:null} isHost={isHost} styles={styles} />
          )}

          <button style={{...styles.button,...styles.buttonDanger,marginTop:'1rem'}} onClick={leaveGame}>🚪 Leave Game</button>
        </div>
      </div>
    );
  }

  return <div style={styles.container}><div style={{textAlign:'center',paddingTop:'4rem'}}><h1 style={styles.title}>BoardBrain™</h1><p style={styles.subtitle}>Loading...</p></div></div>;
}

function SuggestionUI({ onSubmit, styles }) {
  const [suspect, setSuspect] = useState('');
  const [weapon, setWeapon] = useState('');
  const [room, setRoom] = useState('');
  const canSubmit = suspect && weapon && room;

  return (
    <div style={styles.card}>
      <h3 style={{marginBottom:'1rem',fontSize:'1rem'}}>🔍 Make a Suggestion</h3>
      {[['SUSPECT',CLUE_DATA.suspects,suspect,setSuspect],['WEAPON',CLUE_DATA.weapons,weapon,setWeapon],['ROOM',CLUE_DATA.rooms,room,setRoom]].map(([label,items,val,setVal]) => (
        <div key={label} style={{marginBottom:'1rem'}}>
          <p style={{color:'#94a3b8',fontSize:'0.75rem',marginBottom:'0.5rem'}}>{label}</p>
          <div style={{display:'flex',flexWrap:'wrap',gap:'0.25rem'}}>
            {items.map(item => (
              <button key={item} onClick={() => setVal(item)}
                style={{...styles.cardChip,...(val===item?styles.cardChipSelected:styles.cardChipUnselected),fontSize:'0.75rem',padding:'0.375rem 0.5rem'}}>
                {label==='SUSPECT'?item.split(' ')[1]:item}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button onClick={() => canSubmit && onSubmit(suspect,weapon,room)} disabled={!canSubmit}
        style={{...styles.button,...(canSubmit?{}:styles.buttonDisabled)}}>Submit Suggestion</button>
    </div>
  );
}

function ResponseUI({ move, playerId, playerName, myCards, onRespond, onAdvance, isHost, styles }) {
  const [selected, setSelected] = useState('');
  const suggested = [move.suspect, move.weapon, move.room];
  const matching = myCards.filter(c => suggested.includes(c));
  const isSuggester = move.suggesterId === playerId;
  const responded = move.responses?.[playerId];

  if (isSuggester) {
    return (
      <div style={styles.card}>
        <h3 style={{marginBottom:'0.75rem',fontSize:'1rem'}}>🔍 Your Suggestion</h3>
        <p style={{color:'#cbd5e1',marginBottom:'0.5rem'}}>{move.suspect} • {move.weapon} • {move.room}</p>
        <p style={{color:'#94a3b8',fontSize:'0.875rem'}}>Waiting for responses...</p>
        {Object.entries(move.responses||{}).map(([pid,r]) => (
          <div key={pid} style={{padding:'0.5rem',backgroundColor:r.response==='showed'?'#166534':'#1e293b',borderRadius:'0.25rem',marginTop:'0.5rem',fontSize:'0.875rem'}}>
            {r.response==='showed'?`✓ Shown: ${r.cardShown}`:'✗ Passed'}
          </div>
        ))}
        {isHost && <button onClick={onAdvance} style={{...styles.button,marginTop:'1rem',background:'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'}}>Next Turn →</button>}
      </div>
    );
  }

  if (responded) return <div style={styles.card}><p style={{color:'#94a3b8',textAlign:'center'}}>✓ Responded. Waiting...</p></div>;

  return (
    <div style={styles.card}>
      <h3 style={{marginBottom:'0.75rem',fontSize:'1rem'}}>🎴 Respond</h3>
      <p style={{color:'#cbd5e1',marginBottom:'1rem'}}><strong>{move.suggesterName}</strong>: {move.suspect} • {move.weapon} • {move.room}</p>
      {matching.length > 0 ? (
        <>
          <p style={{color:'#94a3b8',fontSize:'0.875rem',marginBottom:'0.75rem'}}>Show one card:</p>
          <div style={{display:'flex',flexWrap:'wrap',gap:'0.5rem',marginBottom:'1rem'}}>
            {matching.map(c => <button key={c} onClick={() => setSelected(c)} style={{...styles.cardChip,...(selected===c?styles.cardChipSelected:styles.cardChipUnselected)}}>{c}</button>)}
          </div>
          <button onClick={() => selected && onRespond('showed',selected)} disabled={!selected}
            style={{...styles.button,...(selected?{}:styles.buttonDisabled),background:'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'}}>Show Card</button>
        </>
      ) : (
        <button onClick={() => onRespond('passed')} style={{...styles.button,...styles.buttonSecondary}}>Pass (none of these)</button>
      )}
    </div>
  );
}
