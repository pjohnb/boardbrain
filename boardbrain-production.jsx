import React, { useState, useEffect } from 'react';

/**
 * BoardBrain™ - Clue Deduction Assistant
 * Copyright © 2024 Pat Bouldin. All Rights Reserved.
 * 
 * More Brain. Better Game.
 * Your AI Strategy Partner for Board Games
 */

// Standard Clue game data
const CLUE_DATA = {
  suspects: ['Colonel Mustard', 'Miss Scarlet', 'Professor Plum', 'Mr. Green', 'Mrs. White', 'Mrs. Peacock'],
  weapons: ['Candlestick', 'Knife', 'Lead Pipe', 'Revolver', 'Rope', 'Wrench'],
  rooms: ['Kitchen', 'Ballroom', 'Conservatory', 'Dining Room', 'Billiard Room', 'Library', 'Lounge', 'Hall', 'Study']
};

const ALL_CARDS = [...CLUE_DATA.suspects, ...CLUE_DATA.weapons, ...CLUE_DATA.rooms];

export default function BoardBrain() {
  // App state
  const [gamePhase, setGamePhase] = useState('setup'); // 'setup', 'playerSetup', 'playing', 'gameOver'
  
  // Setup state
  const [numPlayers, setNumPlayers] = useState(null);
  const [players, setPlayers] = useState([]); // Array of {name: string, character: string}
  const [myPlayerIndex, setMyPlayerIndex] = useState(null); // Which player am I?
  const [myCharacter, setMyCharacter] = useState('');
  const [myCards, setMyCards] = useState([]);
  const [remainderCards, setRemainderCards] = useState([]);
  
  // Game state
  const [currentTurn, setCurrentTurn] = useState(1);
  const [moves, setMoves] = useState([]);
  const [knowledgeMatrix, setKnowledgeMatrix] = useState({});
  const [probabilities, setProbabilities] = useState({});
  
  // Move input state
  const [moveInput, setMoveInput] = useState({
    suggester: '',
    suspect: '',
    weapon: '',
    room: '',
    responses: {}
  });
  
  // Card reveal state
  const [revealInput, setRevealInput] = useState({
    card: '',
    player: ''
  });

  // Calculate cards per player and remainder
  const cardsPerPlayer = numPlayers ? Math.floor(18 / numPlayers) : 0;
  const remainderCount = numPlayers ? 18 % numPlayers : 0;

  // Initialize knowledge matrix
  useEffect(() => {
    if (gamePhase === 'playing' && Object.keys(knowledgeMatrix).length === 0) {
      initializeKnowledgeMatrix();
    }
  }, [gamePhase]);

  const initializeKnowledgeMatrix = () => {
    const matrix = {};
    
    ALL_CARDS.forEach(card => {
      matrix[card] = {
        solution: '?',
        ...Object.fromEntries(players.map(p => [p.name, '?']))
      };
      
      // Mark my cards
      if (myCards.includes(card)) {
        matrix[card][players[myPlayerIndex].name] = 'HAS';
        matrix[card].solution = 'NO';
      }
      
      // Mark remainder cards
      if (remainderCards.includes(card)) {
        players.forEach(p => matrix[card][p.name] = 'NO');
        matrix[card].solution = 'NO';
      }
    });
    
    setKnowledgeMatrix(matrix);
    calculateProbabilities(matrix);
  };

  const calculateProbabilities = (matrix) => {
    const probs = {
      suspects: {},
      weapons: {},
      rooms: {}
    };
    
    // Calculate for each category
    ['suspects', 'weapons', 'rooms'].forEach(category => {
      const cards = CLUE_DATA[category];
      const possibleCards = cards.filter(card => matrix[card]?.solution !== 'NO');
      
      possibleCards.forEach(card => {
        probs[category][card] = possibleCards.length > 0 ? (1 / possibleCards.length * 100).toFixed(1) : 0;
      });
    });
    
    setProbabilities(probs);
  };

  const startPlaying = () => {
    if (myCards.length === cardsPerPlayer && remainderCards.length === remainderCount && myCharacter) {
      setGamePhase('playing');
    }
  };

  const logMove = () => {
    const { suggester, suspect, weapon, room, responses } = moveInput;
    
    if (!suggester || !suspect || !weapon || !room) return;
    
    // Process responses
    const newMatrix = { ...knowledgeMatrix };
    
    // Find suggester index
    const suggesterIndex = players.findIndex(p => p.name === suggester);
    
    // Create response order (players clockwise from suggester)
    const responseOrder = [
      ...players.slice(suggesterIndex + 1),
      ...players.slice(0, suggesterIndex)
    ];
    
    responseOrder.forEach(player => {
      const response = responses[player.name];
      
      if (response === 'passed') {
        // Player doesn't have any of the three cards
        [suspect, weapon, room].forEach(card => {
          newMatrix[card][player.name] = 'NO';
        });
      } else if (response === 'showed') {
        // Player showed a card (we know they have at least one)
        // This creates a constraint but we need more info about which card
      }
    });
    
    const newMove = {
      turn: currentTurn,
      suggester,
      suggestion: { suspect, weapon, room },
      responses,
      timestamp: new Date().toISOString()
    };
    
    setMoves([...moves, newMove]);
    setKnowledgeMatrix(newMatrix);
    calculateProbabilities(newMatrix);
    setCurrentTurn(currentTurn + 1);
    
    // Reset move input
    setMoveInput({
      suggester: '',
      suspect: '',
      weapon: '',
      room: '',
      responses: {}
    });
  };
  };

  const logCardReveal = () => {
    const { card, player } = revealInput;
    
    if (!card || !player) return;
    
    const newMatrix = { ...knowledgeMatrix };
    newMatrix[card][player] = 'HAS';
    newMatrix[card].solution = 'NO';
    
    const newMove = {
      turn: currentTurn,
      type: 'reveal',
      card,
      player,
      timestamp: new Date().toISOString()
    };
    
    setMoves([...moves, newMove]);
    setKnowledgeMatrix(newMatrix);
    calculateProbabilities(newMatrix);
    setCurrentTurn(currentTurn + 1);
    
    setRevealInput({ card: '', player: '' });
  };

  // Styles
  const styles = {
    container: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      color: 'white',
      padding: '1rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    card: {
      backgroundColor: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '0.5rem',
      padding: '1.5rem',
      marginBottom: '1.5rem'
    },
    header: {
      textAlign: 'center',
      marginBottom: '2rem'
    },
    title: {
      fontSize: '3rem',
      fontWeight: 'bold',
      background: 'linear-gradient(to right, #60a5fa, #a78bfa)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      marginBottom: '0.5rem'
    },
    subtitle: {
      fontSize: '1.25rem',
      color: '#cbd5e1'
    },
    label: {
      display: 'block',
      color: '#e2e8f0',
      marginBottom: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: '500'
    },
    select: {
      width: '100%',
      padding: '0.5rem',
      backgroundColor: '#334155',
      color: 'white',
      border: '1px solid #475569',
      borderRadius: '0.375rem',
      fontSize: '0.875rem'
    },
    button: {
      width: '100%',
      padding: '0.75rem',
      background: 'linear-gradient(to right, #2563eb, #7c3aed)',
      color: 'white',
      border: 'none',
      borderRadius: '0.375rem',
      fontSize: '1rem',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'opacity 0.2s'
    },
    buttonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed'
    },
    checkboxLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.875rem',
      marginBottom: '0.5rem',
      cursor: 'pointer'
    },
    checkbox: {
      width: '1rem',
      height: '1rem',
      cursor: 'pointer'
    },
    checkboxDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '0.5rem',
      marginBottom: '1rem'
    },
    table: {
      width: '100%',
      fontSize: '0.75rem',
      borderCollapse: 'collapse'
    },
    th: {
      padding: '0.5rem',
      borderBottom: '1px solid #334155',
      color: '#cbd5e1'
    },
    td: {
      padding: '0.5rem',
      borderBottom: '1px solid #1e293b',
      textAlign: 'center'
    }
  };

  // ============================================================================
  // SETUP SCREEN - Number of Players
  // ============================================================================
  if (gamePhase === 'setup') {
    return (
      <div style={styles.container}>
        <div style={{ maxWidth: '60rem', margin: '0 auto' }}>
          <div style={styles.header}>
            <h1 style={styles.title}>BoardBrain™</h1>
            <p style={styles.subtitle}>More Brain. Better Game.</p>
          </div>

          <div style={styles.card}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Game Setup - Step 1</h2>
            
            {/* Number of Players */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={styles.label}>Number of Players</label>
              <select
                style={styles.select}
                value={numPlayers || ''}
                onChange={(e) => {
                  const num = parseInt(e.target.value);
                  setNumPlayers(num);
                  // Initialize players array
                  setPlayers(Array.from({ length: num }, (_, i) => ({
                    name: `Player ${i + 1}`,
                    character: ''
                  })));
                }}
              >
                <option value="">Select number of players</option>
                <option value="3">3 Players</option>
                <option value="4">4 Players</option>
                <option value="5">5 Players</option>
                <option value="6">6 Players</option>
              </select>
            </div>

            {/* Continue Button */}
            <button
              onClick={() => setGamePhase('playerSetup')}
              disabled={!numPlayers}
              style={{
                ...styles.button,
                ...(!numPlayers && styles.buttonDisabled)
              }}
            >
              Next: Player Setup →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PLAYER SETUP SCREEN
  // ============================================================================
  if (gamePhase === 'playerSetup') {
    const usedCharacters = players.map(p => p.character).filter(c => c);
    const availableCharacters = CLUE_DATA.suspects.filter(c => !usedCharacters.includes(c));
    const allPlayersNamed = players.every(p => p.name.trim() !== '');
    const allCharactersAssigned = players.every(p => p.character !== '');
    
    return (
      <div style={styles.container}>
        <div style={{ maxWidth: '60rem', margin: '0 auto' }}>
          <div style={styles.header}>
            <h1 style={styles.title}>BoardBrain™</h1>
            <p style={styles.subtitle}>More Brain. Better Game.</p>
          </div>

          <div style={styles.card}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Game Setup - Step 2: Players</h2>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
              Enter each player's name and assign their character
            </p>
            
            <div style={{ marginBottom: '1.5rem' }}>
              {players.map((player, idx) => (
                <div key={idx} style={{ 
                  marginBottom: '1.5rem',
                  padding: '1rem',
                  backgroundColor: '#0f172a',
                  borderRadius: '0.375rem',
                  border: myPlayerIndex === idx ? '2px solid #3b82f6' : '1px solid #334155'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <input
                      type="radio"
                      name="myPlayer"
                      checked={myPlayerIndex === idx}
                      onChange={() => setMyPlayerIndex(idx)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {myPlayerIndex === idx ? '← This is you' : 'Click to mark as you'}
                    </span>
                  </div>
                  
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={styles.label}>Player Name</label>
                    <input
                      type="text"
                      style={{
                        ...styles.select,
                        fontSize: '1rem'
                      }}
                      value={player.name}
                      onChange={(e) => {
                        const newPlayers = [...players];
                        newPlayers[idx].name = e.target.value;
                        setPlayers(newPlayers);
                      }}
                      placeholder={`Enter name for Player ${idx + 1}`}
                    />
                  </div>
                  
                  <div>
                    <label style={styles.label}>Character</label>
                    <select
                      style={styles.select}
                      value={player.character}
                      onChange={(e) => {
                        const newPlayers = [...players];
                        newPlayers[idx].character = e.target.value;
                        setPlayers(newPlayers);
                      }}
                    >
                      <option value="">Select character</option>
                      {player.character && (
                        <option value={player.character}>{player.character}</option>
                      )}
                      {availableCharacters.map(char => (
                        <option key={char} value={char}>{char}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => {
                  setGamePhase('setup');
                  setPlayers([]);
                  setMyPlayerIndex(null);
                }}
                style={{
                  ...styles.button,
                  flex: 1,
                  background: 'transparent',
                  border: '1px solid #475569'
                }}
              >
                ← Back
              </button>
              <button
                onClick={() => {
                  setMyCharacter(players[myPlayerIndex].character);
                  setGamePhase('cardSetup');
                }}
                disabled={!allPlayersNamed || !allCharactersAssigned || myPlayerIndex === null}
                style={{
                  ...styles.button,
                  flex: 2,
                  ...(!allPlayersNamed || !allCharactersAssigned || myPlayerIndex === null ? styles.buttonDisabled : {})
                }}
              >
                Next: Card Setup →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // CARD SETUP SCREEN
  // ============================================================================
  if (gamePhase === 'cardSetup') {
    return (
      <div style={styles.container}>
        <div style={{ maxWidth: '60rem', margin: '0 auto' }}>
          <div style={styles.header}>
            <h1 style={styles.title}>BoardBrain™</h1>
            <p style={styles.subtitle}>More Brain. Better Game.</p>
          </div>

          <div style={styles.card}>
            <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem' }}>Game Setup - Step 3: Your Cards</h2>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
              Playing as: <strong style={{ color: '#60a5fa' }}>{players[myPlayerIndex]?.name}</strong> ({myCharacter})
            </p>
            
            {/* My Cards */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={styles.label}>
                Your Cards (Select {cardsPerPlayer})
              </label>
                
                {/* SUSPECTS */}
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>SUSPECTS</p>
                  <div style={styles.grid}>
                    {CLUE_DATA.suspects.map(card => {
                      const isSelected = myCards.includes(card);
                      const isDisabled = !isSelected && myCards.length >= cardsPerPlayer;
                      
                      return (
                        <label
                          key={card}
                          style={{
                            ...styles.checkboxLabel,
                            color: isDisabled ? '#64748b' : '#e2e8f0',
                            cursor: isDisabled ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <input
                            type="checkbox"
                            style={{
                              ...styles.checkbox,
                              cursor: isDisabled ? 'not-allowed' : 'pointer'
                            }}
                            checked={isSelected}
                            disabled={isDisabled}
                            onChange={() => {
                              if (isSelected) {
                                setMyCards(myCards.filter(c => c !== card));
                              } else {
                                setMyCards([...myCards, card]);
                              }
                            }}
                          />
                          <span>{card}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* WEAPONS */}
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>WEAPONS</p>
                  <div style={styles.grid}>
                    {CLUE_DATA.weapons.map(card => {
                      const isSelected = myCards.includes(card);
                      const isDisabled = !isSelected && myCards.length >= cardsPerPlayer;
                      
                      return (
                        <label
                          key={card}
                          style={{
                            ...styles.checkboxLabel,
                            color: isDisabled ? '#64748b' : '#e2e8f0',
                            cursor: isDisabled ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <input
                            type="checkbox"
                            style={{
                              ...styles.checkbox,
                              cursor: isDisabled ? 'not-allowed' : 'pointer'
                            }}
                            checked={isSelected}
                            disabled={isDisabled}
                            onChange={() => {
                              if (isSelected) {
                                setMyCards(myCards.filter(c => c !== card));
                              } else {
                                setMyCards([...myCards, card]);
                              }
                            }}
                          />
                          <span>{card}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* ROOMS */}
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>ROOMS</p>
                  <div style={styles.grid}>
                    {CLUE_DATA.rooms.map(card => {
                      const isSelected = myCards.includes(card);
                      const isDisabled = !isSelected && myCards.length >= cardsPerPlayer;
                      
                      return (
                        <label
                          key={card}
                          style={{
                            ...styles.checkboxLabel,
                            color: isDisabled ? '#64748b' : '#e2e8f0',
                            cursor: isDisabled ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <input
                            type="checkbox"
                            style={{
                              ...styles.checkbox,
                              cursor: isDisabled ? 'not-allowed' : 'pointer'
                            }}
                            checked={isSelected}
                            disabled={isDisabled}
                            onChange={() => {
                              if (isSelected) {
                                setMyCards(myCards.filter(c => c !== card));
                              } else {
                                setMyCards([...myCards, card]);
                              }
                            }}
                          />
                          <span>{card}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                  Selected: {myCards.length}/{cardsPerPlayer}
                </p>
              </div>

            {/* Public/Remainder Cards */}
            {myCards.length === cardsPerPlayer && remainderCount > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={styles.label}>
                  Public/Remainder Cards (Select {remainderCount})
                </label>
                <div>
                  {ALL_CARDS.filter(card => !myCards.includes(card)).map(card => {
                    const isSelected = remainderCards.includes(card);
                    const isDisabled = !isSelected && remainderCards.length >= remainderCount;
                    
                    return (
                      <label
                        key={card}
                        style={{
                          ...styles.checkboxLabel,
                          color: isDisabled ? '#64748b' : '#e2e8f0',
                          cursor: isDisabled ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <input
                          type="checkbox"
                          style={{
                            ...styles.checkbox,
                            cursor: isDisabled ? 'not-allowed' : 'pointer'
                          }}
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={() => {
                            if (isSelected) {
                              setRemainderCards(remainderCards.filter(c => c !== card));
                            } else {
                              setRemainderCards([...remainderCards, card]);
                            }
                          }}
                        />
                        <span>{card}</span>
                      </label>
                    );
                  })}
                </div>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                  Selected: {remainderCards.length}/{remainderCount}
                </p>
              </div>
            )}

            {/* Start/Back Buttons */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setGamePhase('playerSetup')}
                style={{
                  ...styles.button,
                  flex: 1,
                  background: 'transparent',
                  border: '1px solid #475569'
                }}
              >
                ← Back
              </button>
              <button
                onClick={() => setGamePhase('playing')}
                disabled={
                  myCards.length !== cardsPerPlayer ||
                  (remainderCount > 0 && remainderCards.length !== remainderCount)
                }
                style={{
                  ...styles.button,
                  flex: 2,
                  ...((myCards.length !== cardsPerPlayer ||
                      (remainderCount > 0 && remainderCards.length !== remainderCount)) && styles.buttonDisabled)
                }}
              >
                Start Playing →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PLAYING SCREEN
  // ============================================================================
  if (gamePhase === 'playing') {
    return (
      <div style={styles.container}>
        <div style={{ maxWidth: '90rem', margin: '0 auto' }}>
          <div style={{ ...styles.header, marginBottom: '1.5rem' }}>
            <h1 style={{ ...styles.title, fontSize: '2.5rem' }}>BoardBrain™</h1>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
              Turn {currentTurn} • Playing as {players[myPlayerIndex]?.name} ({myCharacter})
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
            {/* Deduction Grid */}
            <div style={styles.card}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Deduction Grid</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, textAlign: 'left' }}>Card</th>
                      {players.map(p => (
                        <th key={p.name} style={styles.th} title={`${p.name} (${p.character})`}>
                          {p.name.split(' ')[0]}
                        </th>
                      ))}
                      <th style={styles.th}>Sol</th>
                      <th style={styles.th}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['suspects', 'weapons', 'rooms'].map(category => (
                      <React.Fragment key={category}>
                        <tr style={{ backgroundColor: '#1e293b' }}>
                          <td colSpan={numPlayers + 3} style={{ ...styles.td, color: '#94a3b8', fontWeight: 'bold', textAlign: 'left' }}>
                            {category.toUpperCase()}
                          </td>
                        </tr>
                        {CLUE_DATA[category].map(card => (
                          <tr key={card}>
                            <td style={{ ...styles.td, textAlign: 'left', color: '#e2e8f0' }}>{card}</td>
                            {players.map(p => (
                              <td key={p.name} style={styles.td}>
                                <span style={{
                                  color: knowledgeMatrix[card]?.[p.name] === 'HAS' ? '#4ade80' :
                                         knowledgeMatrix[card]?.[p.name] === 'NO' ? '#f87171' : '#64748b'
                                }}>
                                  {knowledgeMatrix[card]?.[p.name] === 'HAS' ? '✓' :
                                   knowledgeMatrix[card]?.[p.name] === 'NO' ? '✗' : '?'}
                                </span>
                              </td>
                            ))}
                            <td style={styles.td}>
                              <span style={{
                                color: knowledgeMatrix[card]?.solution === 'YES' ? '#fbbf24' :
                                       knowledgeMatrix[card]?.solution === 'NO' ? '#f87171' : '#64748b'
                              }}>
                                {knowledgeMatrix[card]?.solution === 'YES' ? '★' :
                                 knowledgeMatrix[card]?.solution === 'NO' ? '✗' : '?'}
                              </span>
                            </td>
                            <td style={{ ...styles.td, color: '#cbd5e1' }}>
                              {probabilities[category]?.[card] || '0.0'}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column */}
            <div>
              {/* Log Move */}
              <div style={styles.card}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Log Move</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={styles.label}>Who Made Suggestion?</label>
                    <select
                      style={styles.select}
                      value={moveInput.suggester}
                      onChange={(e) => setMoveInput({...moveInput, suggester: e.target.value})}
                    >
                      <option value="">Select player</option>
                      {players.map(p => (
                        <option key={p.name} value={p.name}>{p.name} ({p.character})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={styles.label}>Suspect</label>
                    <select
                      style={styles.select}
                      value={moveInput.suspect}
                      onChange={(e) => setMoveInput({...moveInput, suspect: e.target.value})}
                    >
                      <option value="">Select suspect</option>
                      {CLUE_DATA.suspects.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={styles.label}>Weapon</label>
                    <select
                      style={styles.select}
                      value={moveInput.weapon}
                      onChange={(e) => setMoveInput({...moveInput, weapon: e.target.value})}
                    >
                      <option value="">Select weapon</option>
                      {CLUE_DATA.weapons.map(w => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={styles.label}>Room</label>
                    <select
                      style={styles.select}
                      value={moveInput.room}
                      onChange={(e) => setMoveInput({...moveInput, room: e.target.value})}
                    >
                      <option value="">Select room</option>
                      {CLUE_DATA.rooms.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  {moveInput.suggester && (
                    <div>
                      <label style={styles.label}>Player Responses</label>
                      {players.filter(p => p.name !== moveInput.suggester).map(p => (
                        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>{p.name}</span>
                          <select
                            style={{ ...styles.select, width: 'auto', fontSize: '0.75rem', padding: '0.25rem' }}
                            value={moveInput.responses[p.name] || ''}
                            onChange={(e) => setMoveInput({
                              ...moveInput,
                              responses: {...moveInput.responses, [p.name]: e.target.value}
                            })}
                          >
                            <option value="">Select</option>
                            <option value="passed">Passed</option>
                            <option value="showed">Showed Card</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={logMove}
                    disabled={!moveInput.suggester || !moveInput.suspect || !moveInput.weapon || !moveInput.room}
                    style={{
                      ...styles.button,
                      background: '#2563eb',
                      ...(!moveInput.suggester || !moveInput.suspect || !moveInput.weapon || !moveInput.room ? styles.buttonDisabled : {})
                    }}
                  >
                    Log Move
                  </button>
                </div>
              </div>

              {/* Card Reveal */}
              <div style={styles.card}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>🎴 Card Reveal Event</h3>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1rem' }}>
                  Special card forces a player to reveal a card publicly
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={styles.label}>Card Revealed</label>
                    <select
                      style={styles.select}
                      value={revealInput.card}
                      onChange={(e) => setRevealInput({...revealInput, card: e.target.value})}
                    >
                      <option value="">Select card</option>
                      <optgroup label="Suspects">
                        {CLUE_DATA.suspects.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Weapons">
                        {CLUE_DATA.weapons.map(w => (
                          <option key={w} value={w}>{w}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Rooms">
                        {CLUE_DATA.rooms.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <label style={styles.label}>Player Has It</label>
                    <select
                      style={styles.select}
                      value={revealInput.player}
                      onChange={(e) => setRevealInput({...revealInput, player: e.target.value})}
                    >
                      <option value="">Select player</option>
                      {players.map(p => (
                        <option key={p.name} value={p.name}>{p.name} ({p.character})</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={logCardReveal}
                    disabled={!revealInput.card || !revealInput.player}
                    style={{
                      ...styles.button,
                      background: '#7c3aed',
                      ...(!revealInput.card || !revealInput.player ? styles.buttonDisabled : {})
                    }}
                  >
                    Log Card Reveal
                  </button>
                </div>
              </div>

              {/* Move History */}
              <div style={styles.card}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Move History</h3>
                <div style={{ maxHeight: '24rem', overflowY: 'auto' }}>
                  {moves.length === 0 ? (
                    <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>No moves yet</p>
                  ) : (
                    moves.slice().reverse().map((move, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.5rem',
                          marginBottom: '0.5rem',
                          borderRadius: '0.25rem',
                          backgroundColor: move.type === 'reveal' ? '#581c87' : '#1e293b',
                          fontSize: '0.75rem'
                        }}
                      >
                        <div style={{ fontWeight: 'bold', color: '#e2e8f0', marginBottom: '0.25rem' }}>
                          Turn {move.turn}
                          {move.type === 'reveal' && ' 🎴'}
                        </div>
                        {move.type === 'reveal' ? (
                          <div style={{ color: '#cbd5e1' }}>
                            {move.player} has: {move.card}
                          </div>
                        ) : (
                          <>
                            <div style={{ color: '#cbd5e1' }}>
                              {move.suggester}: {move.suggestion.suspect}, {move.suggestion.weapon}, {move.suggestion.room}
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                              {Object.entries(move.responses).map(([p, r]) => `${p}: ${r}`).join(', ')}
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* End Game */}
              <button
                onClick={() => setGamePhase('gameOver')}
                style={{
                  ...styles.button,
                  background: 'transparent',
                  border: '1px solid #475569',
                  color: '#cbd5e1'
                }}
              >
                End Game
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // GAME OVER SCREEN
  // ============================================================================
  if (gamePhase === 'gameOver') {
    return (
      <div style={{ ...styles.container, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...styles.card, maxWidth: '28rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Game Over</h2>
          <p style={{ color: '#cbd5e1', marginBottom: '1.5rem' }}>Thanks for playing with BoardBrain™!</p>
          <button
            onClick={() => {
              setGamePhase('setup');
              setNumPlayers(null);
              setPlayers([]);
              setMyPlayerIndex(null);
              setMyCharacter('');
              setMyCards([]);
              setRemainderCards([]);
              setCurrentTurn(1);
              setMoves([]);
              setKnowledgeMatrix({});
              setProbabilities({});
            }}
            style={styles.button}
          >
            New Game
          </button>
        </div>
      </div>
    );
  }
}
