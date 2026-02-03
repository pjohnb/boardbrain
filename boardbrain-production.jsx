import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, push, update, get } from 'firebase/database';

/**
 * BoardBrain™ - Multi-Device Clue Deduction Assistant
 * Copyright © 2024 Pat Boulay. All Rights Reserved.
 * 
 * More Brain. Better Game.
 * Your AI Strategy Partner for Board Games
 * 
 * ARCHITECTURE:
 * - Each player uses their own device (phone/tablet/laptop)
 * - Real-time sync via Firebase Realtime Database
 * - Each player sees personalized view based on their knowledge
 * - Host creates room, players join with room code
 */

// ============================================================================
// FIREBASE CONFIGURATION
// ============================================================================
// Firebase configuration for BoardBrain
const firebaseConfig = {
  apiKey: "AIzaSyBW2PAhPLH0BxCkVNy_cn8W5yvj5_8NWh4",
  authDomain: "boardbrain-7580e.firebaseapp.com",
  databaseURL: "https://boardbrain-7580e-default-rtdb.firebaseio.com",
  projectId: "boardbrain-7580e",
  storageBucket: "boardbrain-7580e.firebasestorage.app",
  messagingSenderId: "563848678256",
  appId: "1:563848678256:web:b48bcc5a6740788c5a9db5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// ============================================================================
// GAME DATA
// ============================================================================
const CLUE_DATA = {
  suspects: ['Colonel Mustard', 'Miss Scarlet', 'Professor Plum', 'Mr. Green', 'Mrs. White', 'Mrs. Peacock'],
  weapons: ['Candlestick', 'Knife', 'Lead Pipe', 'Revolver', 'Rope', 'Wrench'],
  rooms: ['Kitchen', 'Ballroom', 'Conservatory', 'Dining Room', 'Billiard Room', 'Library', 'Lounge', 'Hall', 'Study']
};

const ALL_CARDS = [...CLUE_DATA.suspects, ...CLUE_DATA.weapons, ...CLUE_DATA.rooms];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// ============================================================================
// STYLES - Mobile-First, Dark Theme
// ============================================================================
const styles = {
  // Base container - full viewport, dark theme
  container: {
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    color: '#f1f5f9',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    padding: '1rem',
    boxSizing: 'border-box',
  },
  
  // Card container
  card: {
    backgroundColor: '#1e293b',
    borderRadius: '0.75rem',
    padding: '1.25rem',
    marginBottom: '1rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
  },
  
  // Header styling
  header: {
    textAlign: 'center',
    marginBottom: '1.5rem',
  },
  
  title: {
    fontSize: '2rem',
    fontWeight: '800',
    background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    marginBottom: '0.25rem',
  },
  
  subtitle: {
    color: '#94a3b8',
    fontSize: '0.875rem',
  },
  
  // Room code display
  roomCode: {
    fontSize: '2.5rem',
    fontWeight: '800',
    letterSpacing: '0.25em',
    color: '#fbbf24',
    textAlign: 'center',
    fontFamily: "'Courier New', monospace",
    padding: '1rem',
    backgroundColor: '#0f172a',
    borderRadius: '0.5rem',
    marginBottom: '1rem',
  },
  
  // Buttons
  button: {
    width: '100%',
    padding: '1rem 1.5rem',
    borderRadius: '0.5rem',
    border: 'none',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
    color: 'white',
    marginBottom: '0.75rem',
  },
  
  buttonSecondary: {
    background: 'transparent',
    border: '2px solid #475569',
    color: '#cbd5e1',
  },
  
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  
  // Input fields
  input: {
    width: '100%',
    padding: '0.875rem 1rem',
    borderRadius: '0.5rem',
    border: '2px solid #334155',
    backgroundColor: '#0f172a',
    color: '#f1f5f9',
    fontSize: '1rem',
    marginBottom: '0.75rem',
    boxSizing: 'border-box',
    outline: 'none',
  },
  
  // Player list
  playerChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.5rem 1rem',
    borderRadius: '2rem',
    backgroundColor: '#334155',
    color: '#e2e8f0',
    fontSize: '0.875rem',
    marginRight: '0.5rem',
    marginBottom: '0.5rem',
  },
  
  // Turn indicator
  turnIndicator: {
    padding: '0.75rem 1rem',
    borderRadius: '0.5rem',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: '1rem',
  },
  
  myTurn: {
    backgroundColor: '#166534',
    border: '2px solid #22c55e',
    color: '#bbf7d0',
  },
  
  notMyTurn: {
    backgroundColor: '#1e293b',
    border: '2px solid #475569',
    color: '#94a3b8',
  },
  
  // Matrix table - optimized for mobile
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.75rem',
  },
  
  th: {
    padding: '0.5rem 0.25rem',
    textAlign: 'center',
    color: '#94a3b8',
    fontWeight: '600',
    borderBottom: '2px solid #334155',
    whiteSpace: 'nowrap',
  },
  
  td: {
    padding: '0.375rem 0.25rem',
    textAlign: 'center',
    borderBottom: '1px solid #1e293b',
  },
  
  // Card selection chips
  cardChip: {
    display: 'inline-block',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    margin: '0.25rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    border: '2px solid transparent',
  },
  
  cardChipSelected: {
    backgroundColor: '#8b5cf6',
    color: 'white',
    border: '2px solid #a78bfa',
  },
  
  cardChipUnselected: {
    backgroundColor: '#334155',
    color: '#cbd5e1',
    border: '2px solid #475569',
  },
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================
export default function BoardBrain() {
  // -------------------------------------------------------------------------
  // APP STATE
  // -------------------------------------------------------------------------
  const [appPhase, setAppPhase] = useState('welcome'); // welcome, createRoom, joinRoom, lobby, playing
  const [roomCode, setRoomCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isHost, setIsHost] = useState(false);
  
  // -------------------------------------------------------------------------
  // GAME STATE (synced from Firebase)
  // -------------------------------------------------------------------------
  const [gameState, setGameState] = useState(null);
  const [myPrivateData, setMyPrivateData] = useState(null);
  
  // -------------------------------------------------------------------------
  // LOCAL UI STATE
  // -------------------------------------------------------------------------
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [selectedCharacter, setSelectedCharacter] = useState('');
  const [selectedCards, setSelectedCards] = useState([]);
  const [error, setError] = useState('');
  
  // -------------------------------------------------------------------------
  // FIREBASE LISTENERS
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!roomCode) return;
    
    // Listen to shared game state
    const gameRef = ref(database, `rooms/${roomCode}/game`);
    const unsubGame = onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState(data);
      }
    });
    
    // Listen to my private data
    if (playerId) {
      const privateRef = ref(database, `rooms/${roomCode}/private/${playerId}`);
      const unsubPrivate = onValue(privateRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setMyPrivateData(data);
        }
      });
      
      return () => {
        unsubGame();
        unsubPrivate();
      };
    }
    
    return () => unsubGame();
  }, [roomCode, playerId]);
  
  // -------------------------------------------------------------------------
  // ROOM MANAGEMENT
  // -------------------------------------------------------------------------
  const createRoom = async () => {
    if (!nameInput.trim()) {
      setError('Please enter your name');
      return;
    }
    
    const code = generateRoomCode();
    const newPlayerId = `player_${Date.now()}`;
    
    // Initialize room in Firebase
    const roomRef = ref(database, `rooms/${code}`);
    await set(roomRef, {
      game: {
        phase: 'lobby',
        hostId: newPlayerId,
        players: {
          [newPlayerId]: {
            id: newPlayerId,
            name: nameInput.trim(),
            character: null,
            isReady: false,
            joinedAt: Date.now(),
          }
        },
        settings: {
          numPlayers: null,
        },
        currentTurn: 0,
        currentPlayerIndex: 0,
        moves: [],
        publicCards: [],
        createdAt: Date.now(),
      },
      private: {
        [newPlayerId]: {
          cards: [],
          shownToMe: [], // Cards other players have shown me privately
          knowledgeMatrix: {},
        }
      }
    });
    
    setRoomCode(code);
    setPlayerId(newPlayerId);
    setPlayerName(nameInput.trim());
    setIsHost(true);
    setAppPhase('lobby');
    setError('');
  };
  
  const joinRoom = async () => {
    if (!nameInput.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!joinCodeInput.trim() || joinCodeInput.length !== 6) {
      setError('Please enter a valid 6-character room code');
      return;
    }
    
    const code = joinCodeInput.toUpperCase().trim();
    
    // Check if room exists
    const roomRef = ref(database, `rooms/${code}/game`);
    const snapshot = await get(roomRef);
    
    if (!snapshot.exists()) {
      setError('Room not found. Check the code and try again.');
      return;
    }
    
    const roomData = snapshot.val();
    
    if (roomData.phase !== 'lobby') {
      setError('Game has already started. Cannot join.');
      return;
    }
    
    // Add player to room
    const newPlayerId = `player_${Date.now()}`;
    
    await update(ref(database, `rooms/${code}/game/players`), {
      [newPlayerId]: {
        id: newPlayerId,
        name: nameInput.trim(),
        character: null,
        isReady: false,
        joinedAt: Date.now(),
      }
    });
    
    // Initialize private data for this player
    await set(ref(database, `rooms/${code}/private/${newPlayerId}`), {
      cards: [],
      shownToMe: [],
      knowledgeMatrix: {},
    });
    
    setRoomCode(code);
    setPlayerId(newPlayerId);
    setPlayerName(nameInput.trim());
    setIsHost(false);
    setAppPhase('lobby');
    setError('');
  };
  
  // -------------------------------------------------------------------------
  // CHARACTER & CARD SELECTION
  // -------------------------------------------------------------------------
  const selectCharacter = async (character) => {
    if (!roomCode || !playerId) return;
    
    // Check if character is taken
    const players = gameState?.players || {};
    const taken = Object.values(players).some(p => p.character === character && p.id !== playerId);
    if (taken) {
      setError(`${character} is already taken`);
      return;
    }
    
    await update(ref(database, `rooms/${roomCode}/game/players/${playerId}`), {
      character: character,
    });
    
    setSelectedCharacter(character);
    setError('');
  };
  
  const toggleCard = (card) => {
    const numPlayers = Object.keys(gameState?.players || {}).length;
    const cardsPerPlayer = Math.floor(18 / numPlayers);
    
    setSelectedCards(prev => {
      if (prev.includes(card)) {
        return prev.filter(c => c !== card);
      } else if (prev.length < cardsPerPlayer) {
        return [...prev, card];
      }
      return prev;
    });
  };
  
  const confirmCards = async () => {
    if (!roomCode || !playerId) return;
    
    // Save my cards privately
    await update(ref(database, `rooms/${roomCode}/private/${playerId}`), {
      cards: selectedCards,
    });
    
    // Mark myself as ready
    await update(ref(database, `rooms/${roomCode}/game/players/${playerId}`), {
      isReady: true,
    });
  };
  
  // -------------------------------------------------------------------------
  // GAME ACTIONS
  // -------------------------------------------------------------------------
  const startGame = async () => {
    if (!isHost || !roomCode) return;
    
    const players = gameState?.players || {};
    const allReady = Object.values(players).every(p => p.isReady);
    
    if (!allReady) {
      setError('All players must select their cards first');
      return;
    }
    
    // Determine turn order (by character or join order)
    const playerList = Object.values(players).sort((a, b) => a.joinedAt - b.joinedAt);
    
    await update(ref(database, `rooms/${roomCode}/game`), {
      phase: 'playing',
      currentTurn: 1,
      currentPlayerIndex: 0,
      turnOrder: playerList.map(p => p.id),
    });
  };
  
  const submitSuggestion = async (suspect, weapon, room) => {
    if (!roomCode || !playerId) return;
    
    const newMove = {
      id: `move_${Date.now()}`,
      turn: gameState.currentTurn,
      suggesterId: playerId,
      suggesterName: playerName,
      suspect,
      weapon,
      room,
      responses: {},
      resolved: false,
      timestamp: Date.now(),
    };
    
    // Add move to game state
    await update(ref(database, `rooms/${roomCode}/game`), {
      currentMove: newMove,
      awaitingResponse: true,
    });
  };
  
  const respondToSuggestion = async (response, cardShown = null) => {
    if (!roomCode || !playerId || !gameState?.currentMove) return;
    
    const currentMove = gameState.currentMove;
    
    // Update response
    const updates = {
      [`rooms/${roomCode}/game/currentMove/responses/${playerId}`]: {
        response, // 'passed' or 'showed'
        cardShown: cardShown, // Only stored privately for suggester
      }
    };
    
    // If showing a card, update suggester's private knowledge
    if (response === 'showed' && cardShown) {
      updates[`rooms/${roomCode}/private/${currentMove.suggesterId}/shownToMe`] = 
        [...(myPrivateData?.shownToMe || []), {
          card: cardShown,
          shownBy: playerId,
          turn: gameState.currentTurn,
        }];
    }
    
    await update(ref(database), updates);
  };
  
  const advanceTurn = async () => {
    if (!isHost || !roomCode) return;
    
    const turnOrder = gameState.turnOrder || [];
    const nextIndex = (gameState.currentPlayerIndex + 1) % turnOrder.length;
    
    // Archive current move to moves array
    const currentMove = gameState.currentMove;
    const moves = gameState.moves || [];
    
    await update(ref(database, `rooms/${roomCode}/game`), {
      currentTurn: gameState.currentTurn + 1,
      currentPlayerIndex: nextIndex,
      currentMove: null,
      awaitingResponse: false,
      moves: currentMove ? [...moves, currentMove] : moves,
    });
  };
  
  // -------------------------------------------------------------------------
  // RENDER: WELCOME SCREEN
  // -------------------------------------------------------------------------
  if (appPhase === 'welcome') {
    return (
      <div style={styles.container}>
        <div style={{ maxWidth: '28rem', margin: '0 auto', paddingTop: '2rem' }}>
          <div style={styles.header}>
            <h1 style={styles.title}>BoardBrain™</h1>
            <p style={styles.subtitle}>More Brain. Better Game.</p>
          </div>
          
          <div style={styles.card}>
            <p style={{ color: '#cbd5e1', marginBottom: '1.5rem', textAlign: 'center', lineHeight: '1.6' }}>
              Your personal AI strategy companion for board games. 
              Each player uses their own device for a personalized experience.
            </p>
            
            <button 
              style={styles.button}
              onClick={() => setAppPhase('createRoom')}
            >
              🎮 Create New Game
            </button>
            
            <button 
              style={{ ...styles.button, ...styles.buttonSecondary }}
              onClick={() => setAppPhase('joinRoom')}
            >
              🚪 Join Existing Game
            </button>
          </div>
          
          <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.75rem', marginTop: '2rem' }}>
            © 2024 Pat Boulay. All Rights Reserved.
          </p>
        </div>
      </div>
    );
  }
  
  // -------------------------------------------------------------------------
  // RENDER: CREATE ROOM SCREEN
  // -------------------------------------------------------------------------
  if (appPhase === 'createRoom') {
    return (
      <div style={styles.container}>
        <div style={{ maxWidth: '28rem', margin: '0 auto', paddingTop: '2rem' }}>
          <div style={styles.header}>
            <h1 style={styles.title}>BoardBrain™</h1>
            <p style={styles.subtitle}>Create a New Game</p>
          </div>
          
          <div style={styles.card}>
            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              Your Name
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Enter your name"
              style={styles.input}
              maxLength={20}
            />
            
            {error && (
              <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>
            )}
            
            <button 
              style={styles.button}
              onClick={createRoom}
              disabled={!nameInput.trim()}
            >
              Create Room
            </button>
            
            <button 
              style={{ ...styles.button, ...styles.buttonSecondary }}
              onClick={() => { setAppPhase('welcome'); setError(''); }}
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // -------------------------------------------------------------------------
  // RENDER: JOIN ROOM SCREEN
  // -------------------------------------------------------------------------
  if (appPhase === 'joinRoom') {
    return (
      <div style={styles.container}>
        <div style={{ maxWidth: '28rem', margin: '0 auto', paddingTop: '2rem' }}>
          <div style={styles.header}>
            <h1 style={styles.title}>BoardBrain™</h1>
            <p style={styles.subtitle}>Join a Game</p>
          </div>
          
          <div style={styles.card}>
            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              Your Name
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Enter your name"
              style={styles.input}
              maxLength={20}
            />
            
            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              Room Code
            </label>
            <input
              type="text"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g., ABC123"
              style={{ ...styles.input, textAlign: 'center', letterSpacing: '0.2em', fontSize: '1.25rem' }}
              maxLength={6}
            />
            
            {error && (
              <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>
            )}
            
            <button 
              style={styles.button}
              onClick={joinRoom}
              disabled={!nameInput.trim() || joinCodeInput.length !== 6}
            >
              Join Room
            </button>
            
            <button 
              style={{ ...styles.button, ...styles.buttonSecondary }}
              onClick={() => { setAppPhase('welcome'); setError(''); }}
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // -------------------------------------------------------------------------
  // RENDER: LOBBY SCREEN
  // -------------------------------------------------------------------------
  if (appPhase === 'lobby' && gameState) {
    const players = gameState.players || {};
    const playerList = Object.values(players);
    const numPlayers = playerList.length;
    const cardsPerPlayer = Math.floor(18 / numPlayers);
    const myPlayer = players[playerId];
    const allReady = playerList.every(p => p.isReady);
    
    // Find taken characters
    const takenCharacters = playerList.map(p => p.character).filter(Boolean);
    
    return (
      <div style={styles.container}>
        <div style={{ maxWidth: '32rem', margin: '0 auto', paddingTop: '1rem' }}>
          <div style={styles.header}>
            <h1 style={{ ...styles.title, fontSize: '1.5rem' }}>BoardBrain™</h1>
            <p style={styles.subtitle}>Game Lobby</p>
          </div>
          
          {/* Room Code Display */}
          <div style={styles.card}>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', marginBottom: '0.5rem' }}>
              Share this code with other players:
            </p>
            <div style={styles.roomCode}>{roomCode}</div>
            <p style={{ color: '#64748b', fontSize: '0.75rem', textAlign: 'center' }}>
              {numPlayers} player{numPlayers !== 1 ? 's' : ''} in lobby
            </p>
          </div>
          
          {/* Players List */}
          <div style={styles.card}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Players</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {playerList.map(p => (
                <div 
                  key={p.id}
                  style={{
                    ...styles.playerChip,
                    backgroundColor: p.isReady ? '#166534' : '#334155',
                    border: p.id === playerId ? '2px solid #8b5cf6' : '2px solid transparent',
                  }}
                >
                  {p.isReady && <span style={{ marginRight: '0.5rem' }}>✓</span>}
                  {p.name}
                  {p.character && <span style={{ marginLeft: '0.5rem', color: '#94a3b8' }}>({p.character.split(' ')[1] || p.character})</span>}
                  {p.id === gameState.hostId && <span style={{ marginLeft: '0.5rem' }}>👑</span>}
                </div>
              ))}
            </div>
          </div>
          
          {/* Character Selection */}
          {!myPlayer?.character && (
            <div style={styles.card}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Select Your Character</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {CLUE_DATA.suspects.map(character => {
                  const taken = takenCharacters.includes(character);
                  return (
                    <button
                      key={character}
                      onClick={() => !taken && selectCharacter(character)}
                      disabled={taken}
                      style={{
                        ...styles.cardChip,
                        ...(taken ? { opacity: 0.4, cursor: 'not-allowed' } : styles.cardChipUnselected),
                      }}
                    >
                      {character}
                    </button>
                  );
                })}
              </div>
              {error && <p style={{ color: '#f87171', fontSize: '0.875rem', marginTop: '0.75rem' }}>{error}</p>}
            </div>
          )}
          
          {/* Card Selection */}
          {myPlayer?.character && !myPlayer?.isReady && (
            <div style={styles.card}>
              <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Select Your Cards</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1rem' }}>
                You have {cardsPerPlayer} cards. Selected: {selectedCards.length}/{cardsPerPlayer}
              </p>
              
              {['suspects', 'weapons', 'rooms'].map(category => (
                <div key={category} style={{ marginBottom: '1rem' }}>
                  <p style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    {category}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {CLUE_DATA[category].map(card => (
                      <button
                        key={card}
                        onClick={() => toggleCard(card)}
                        style={{
                          ...styles.cardChip,
                          ...(selectedCards.includes(card) ? styles.cardChipSelected : styles.cardChipUnselected),
                          fontSize: '0.75rem',
                          padding: '0.375rem 0.5rem',
                        }}
                      >
                        {card}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              
              <button
                onClick={confirmCards}
                disabled={selectedCards.length !== cardsPerPlayer}
                style={{
                  ...styles.button,
                  ...(selectedCards.length !== cardsPerPlayer ? styles.buttonDisabled : {}),
                }}
              >
                Confirm Cards ✓
              </button>
            </div>
          )}
          
          {/* Ready Status */}
          {myPlayer?.isReady && (
            <div style={{ ...styles.card, backgroundColor: '#166534', border: '2px solid #22c55e' }}>
              <p style={{ textAlign: 'center', color: '#bbf7d0', fontWeight: '600' }}>
                ✓ You're ready! Waiting for other players...
              </p>
            </div>
          )}
          
          {/* Start Game Button (Host Only) */}
          {isHost && allReady && playerList.length >= 2 && (
            <button
              onClick={startGame}
              style={{ ...styles.button, background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
            >
              🚀 Start Game
            </button>
          )}
          
          {isHost && !allReady && (
            <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
              Waiting for all players to select their cards...
            </p>
          )}
        </div>
      </div>
    );
  }
  
  // -------------------------------------------------------------------------
  // RENDER: PLAYING SCREEN (Main Game)
  // -------------------------------------------------------------------------
  if (gameState?.phase === 'playing') {
    const players = gameState.players || {};
    const playerList = Object.values(players);
    const turnOrder = gameState.turnOrder || [];
    const currentPlayerId = turnOrder[gameState.currentPlayerIndex];
    const isMyTurn = currentPlayerId === playerId;
    const currentPlayerName = players[currentPlayerId]?.name || 'Unknown';
    
    // My knowledge
    const myCards = myPrivateData?.cards || [];
    const shownToMe = myPrivateData?.shownToMe || [];
    
    return (
      <div style={styles.container}>
        <div style={{ maxWidth: '100%', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ ...styles.header, marginBottom: '1rem' }}>
            <h1 style={{ ...styles.title, fontSize: '1.5rem' }}>BoardBrain™</h1>
            <p style={styles.subtitle}>
              Turn {gameState.currentTurn} • You are {playerName}
            </p>
          </div>
          
          {/* Turn Indicator */}
          <div style={{
            ...styles.turnIndicator,
            ...(isMyTurn ? styles.myTurn : styles.notMyTurn),
          }}>
            {isMyTurn ? "🎯 Your Turn - Make a Suggestion!" : `⏳ ${currentPlayerName}'s Turn`}
          </div>
          
          {/* My Cards */}
          <div style={{ ...styles.card, padding: '0.75rem' }}>
            <h4 style={{ fontSize: '0.75rem', color: '#8b5cf6', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              🎴 My Cards
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {myCards.map(card => (
                <span key={card} style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                }}>
                  {card}
                </span>
              ))}
            </div>
          </div>
          
          {/* Knowledge Matrix - Personalized View */}
          <div style={styles.card}>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>📊 Your Knowledge Matrix</h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, textAlign: 'left', minWidth: '80px' }}>Card</th>
                    {playerList.map((p, idx) => (
                      <th key={p.id} style={styles.th}>
                        <div style={{ fontSize: '0.625rem', color: p.id === playerId ? '#8b5cf6' : '#64748b' }}>
                          {p.id === playerId ? 'ME' : `P${idx + 1}`}
                        </div>
                      </th>
                    ))}
                    <th style={styles.th}>Sol?</th>
                  </tr>
                </thead>
                <tbody>
                  {['suspects', 'weapons', 'rooms'].map(category => (
                    <React.Fragment key={category}>
                      <tr style={{ backgroundColor: '#1e293b' }}>
                        <td colSpan={playerList.length + 2} style={{ 
                          ...styles.td, 
                          color: '#64748b', 
                          fontWeight: '600', 
                          textAlign: 'left',
                          fontSize: '0.625rem',
                          textTransform: 'uppercase',
                        }}>
                          {category}
                        </td>
                      </tr>
                      {CLUE_DATA[category].map(card => {
                        const iHaveIt = myCards.includes(card);
                        const shownToMeEntry = shownToMe.find(s => s.card === card);
                        
                        return (
                          <tr key={card}>
                            <td style={{ ...styles.td, textAlign: 'left', fontSize: '0.7rem' }}>{card}</td>
                            {playerList.map(p => {
                              let symbol = '?';
                              let color = '#64748b';
                              
                              if (p.id === playerId && iHaveIt) {
                                symbol = '✓';
                                color = '#4ade80';
                              } else if (shownToMeEntry && shownToMeEntry.shownBy === p.id) {
                                symbol = '✓';
                                color = '#4ade80';
                              }
                              
                              return (
                                <td key={p.id} style={styles.td}>
                                  <span style={{ color }}>{symbol}</span>
                                </td>
                              );
                            })}
                            <td style={styles.td}>
                              <span style={{ color: iHaveIt || shownToMeEntry ? '#f87171' : '#64748b' }}>
                                {iHaveIt || shownToMeEntry ? '✗' : '?'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Suggestion Interface (when it's my turn) */}
          {isMyTurn && !gameState.awaitingResponse && (
            <SuggestionInterface 
              onSubmit={submitSuggestion}
              styles={styles}
            />
          )}
          
          {/* Response Interface (when waiting for responses) */}
          {gameState.awaitingResponse && gameState.currentMove && (
            <ResponseInterface
              currentMove={gameState.currentMove}
              playerId={playerId}
              myCards={myCards}
              onRespond={respondToSuggestion}
              onAdvance={isHost ? advanceTurn : null}
              styles={styles}
            />
          )}
        </div>
      </div>
    );
  }
  
  // -------------------------------------------------------------------------
  // RENDER: LOADING / DEFAULT
  // -------------------------------------------------------------------------
  return (
    <div style={styles.container}>
      <div style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <h1 style={styles.title}>BoardBrain™</h1>
        <p style={styles.subtitle}>Loading...</p>
      </div>
    </div>
  );
}

// ============================================================================
// SUGGESTION INTERFACE COMPONENT
// ============================================================================
function SuggestionInterface({ onSubmit, styles }) {
  const [suspect, setSuspect] = useState('');
  const [weapon, setWeapon] = useState('');
  const [room, setRoom] = useState('');
  
  const canSubmit = suspect && weapon && room;
  
  return (
    <div style={styles.card}>
      <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>🔍 Make a Suggestion</h3>
      
      {/* Suspect */}
      <div style={{ marginBottom: '1rem' }}>
        <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.5rem' }}>SUSPECT</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
          {CLUE_DATA.suspects.map(s => (
            <button
              key={s}
              onClick={() => setSuspect(s)}
              style={{
                ...styles.cardChip,
                ...(suspect === s ? styles.cardChipSelected : styles.cardChipUnselected),
                fontSize: '0.75rem',
                padding: '0.375rem 0.5rem',
              }}
            >
              {s.split(' ')[1] || s}
            </button>
          ))}
        </div>
      </div>
      
      {/* Weapon */}
      <div style={{ marginBottom: '1rem' }}>
        <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.5rem' }}>WEAPON</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
          {CLUE_DATA.weapons.map(w => (
            <button
              key={w}
              onClick={() => setWeapon(w)}
              style={{
                ...styles.cardChip,
                ...(weapon === w ? styles.cardChipSelected : styles.cardChipUnselected),
                fontSize: '0.75rem',
                padding: '0.375rem 0.5rem',
              }}
            >
              {w}
            </button>
          ))}
        </div>
      </div>
      
      {/* Room */}
      <div style={{ marginBottom: '1rem' }}>
        <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.5rem' }}>ROOM</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
          {CLUE_DATA.rooms.map(r => (
            <button
              key={r}
              onClick={() => setRoom(r)}
              style={{
                ...styles.cardChip,
                ...(room === r ? styles.cardChipSelected : styles.cardChipUnselected),
                fontSize: '0.75rem',
                padding: '0.375rem 0.5rem',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      
      <button
        onClick={() => canSubmit && onSubmit(suspect, weapon, room)}
        disabled={!canSubmit}
        style={{
          ...styles.button,
          ...(canSubmit ? {} : styles.buttonDisabled),
        }}
      >
        Submit Suggestion
      </button>
    </div>
  );
}

// ============================================================================
// RESPONSE INTERFACE COMPONENT
// ============================================================================
function ResponseInterface({ currentMove, playerId, myCards, onRespond, onAdvance, styles }) {
  const [selectedCard, setSelectedCard] = useState('');
  
  const suggestedCards = [currentMove.suspect, currentMove.weapon, currentMove.room];
  const myMatchingCards = myCards.filter(c => suggestedCards.includes(c));
  const canShow = myMatchingCards.length > 0;
  const isSuggester = currentMove.suggesterId === playerId;
  const hasResponded = currentMove.responses?.[playerId];
  
  // Check if it's my turn to respond (in clockwise order after suggester)
  // For simplicity, show response options to all non-suggester players who haven't responded
  
  if (isSuggester) {
    return (
      <div style={styles.card}>
        <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>🔍 Your Suggestion</h3>
        <p style={{ color: '#cbd5e1', marginBottom: '0.5rem' }}>
          {currentMove.suspect} with the {currentMove.weapon} in the {currentMove.room}
        </p>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
          Waiting for other players to respond...
        </p>
        
        {/* Show responses so far */}
        {Object.keys(currentMove.responses || {}).length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.5rem' }}>RESPONSES:</p>
            {Object.entries(currentMove.responses).map(([pid, resp]) => (
              <div key={pid} style={{ 
                padding: '0.5rem', 
                backgroundColor: resp.response === 'showed' ? '#166534' : '#1e293b',
                borderRadius: '0.25rem',
                marginBottom: '0.25rem',
                fontSize: '0.875rem',
              }}>
                {resp.response === 'showed' ? `✓ Showed: ${resp.cardShown}` : '✗ Passed'}
              </div>
            ))}
          </div>
        )}
        
        {onAdvance && (
          <button
            onClick={onAdvance}
            style={{ ...styles.button, marginTop: '1rem', background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
          >
            Next Turn →
          </button>
        )}
      </div>
    );
  }
  
  if (hasResponded) {
    return (
      <div style={styles.card}>
        <p style={{ color: '#94a3b8', textAlign: 'center' }}>
          ✓ You've responded. Waiting for turn to continue...
        </p>
      </div>
    );
  }
  
  return (
    <div style={styles.card}>
      <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>🎴 Respond to Suggestion</h3>
      <p style={{ color: '#cbd5e1', marginBottom: '1rem' }}>
        <strong>{currentMove.suggesterName}</strong> suggests: {currentMove.suspect} with the {currentMove.weapon} in the {currentMove.room}
      </p>
      
      {canShow ? (
        <>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            You can show one of these cards:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            {myMatchingCards.map(card => (
              <button
                key={card}
                onClick={() => setSelectedCard(card)}
                style={{
                  ...styles.cardChip,
                  ...(selectedCard === card ? styles.cardChipSelected : styles.cardChipUnselected),
                }}
              >
                {card}
              </button>
            ))}
          </div>
          <button
            onClick={() => selectedCard && onRespond('showed', selectedCard)}
            disabled={!selectedCard}
            style={{
              ...styles.button,
              ...(selectedCard ? {} : styles.buttonDisabled),
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            }}
          >
            Show Card
          </button>
        </>
      ) : (
        <button
          onClick={() => onRespond('passed')}
          style={{ ...styles.button, ...styles.buttonSecondary }}
        >
          Pass (I don't have any of these cards)
        </button>
      )}
    </div>
  );
}
