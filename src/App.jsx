import React, { useState, useEffect } from 'react';

/**
 * BoardBrain™ 4.0 - Pass-Around Mode
 * Copyright © 2025 Pat Boulay. All Rights Reserved.
 * 
 * Multi-player game with privacy protection
 * Players pass laptop around, each with their own PIN
 * Card-centric display showing face-down cards with emerging certainties
 */

// Standard Clue game data
const CLUE_DATA = {
  suspects: ['Colonel Mustard', 'Miss Scarlet', 'Professor Plum', 'Mr. Green', 'Mrs. White', 'Mrs. Peacock'],
  weapons: ['Candlestick', 'Knife', 'Lead Pipe', 'Revolver', 'Rope', 'Wrench'],
  rooms: ['Kitchen', 'Ballroom', 'Conservatory', 'Dining Room', 'Billiard Room', 'Library', 'Lounge', 'Hall', 'Study']
};

const ALL_CARDS = [...CLUE_DATA.suspects, ...CLUE_DATA.weapons, ...CLUE_DATA.rooms];

export default function BoardBrainPassAround() {
  // Game phase
  const [gamePhase, setGamePhase] = useState('intro'); // 'intro', 'playerNames', 'setupCards', 'playing', 'pinEntry'
  const [setupStep, setSetupStep] = useState(0); // Which player is setting up (0 = first player)
  const [trainingMode, setTrainingMode] = useState(false); // Show all hands for training
  
  // Players
  const [numPlayers, setNumPlayers] = useState(null);
  const [players, setPlayers] = useState([]); // [{ name, pin, cards: [], hasSetup: false }]
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [pinInput, setPinInput] = useState('');
  const [cardsHidden, setCardsHidden] = useState(true);
  
  // Game state
  const [publicCards, setPublicCards] = useState([]);
  const [solutionCards, setSolutionCards] = useState([]); // Calculated automatically
  const [turnNumber, setTurnNumber] = useState(1);
  const [constraints, setConstraints] = useState([]); // Array of constraint objects
  const [cardStates, setCardStates] = useState({}); // { cardName: { holder, probability, shownTo: [], status } }
  const [eliminatedPlayers, setEliminatedPlayers] = useState([]); // Players who made wrong accusations
  const [gameWon, setGameWon] = useState(false);
  const [winner, setWinner] = useState(null);
  
  // UI state
  const [selectedCard, setSelectedCard] = useState(null); // For card story modal
  const [showAccusationModal, setShowAccusationModal] = useState(false);
  const [showDeductionMatrix, setShowDeductionMatrix] = useState(false); // For matrix modal
  const [accusation, setAccusation] = useState({ suspect: '', weapon: '', room: '' });
  const [moveInput, setMoveInput] = useState({
    suspect: '',
    weapon: '',
    room: '',
    responses: [] // [{ player, action: 'pass'|'show', shownCard: null|cardName }]
  });

  // Calculate solution cards automatically
  useEffect(() => {
    if (gamePhase === 'playing') {
      const allDistributed = [...publicCards];
      players.forEach(p => allDistributed.push(...p.cards));
      const remaining = ALL_CARDS.filter(c => !allDistributed.includes(c));
      
      // DEBUG: Log solution calculation
      console.log('=== SOLUTION CALCULATION ===');
      console.log('All Cards (21):', ALL_CARDS.length, ALL_CARDS);
      console.log('Public Cards:', publicCards);
      console.log('Player Cards:', players.map(p => ({ name: p.name, cards: p.cards })));
      console.log('All Distributed:', allDistributed.length, allDistributed);
      console.log('Remaining (Solution):', remaining.length, remaining);
      console.log('=== END ===');
      
      setSolutionCards(remaining);
    }
  }, [gamePhase, players, publicCards]);

  // AUTO-SAVE: Save game state to localStorage whenever key state changes
  useEffect(() => {
    if (gamePhase === 'playing' || gamePhase === 'pinEntry') {
      const gameState = {
        gamePhase,
        setupStep,
        trainingMode,
        numPlayers,
        players,
        currentPlayerIndex,
        publicCards,
        solutionCards,
        turnNumber,
        constraints,
        cardStates,
        eliminatedPlayers,
        gameWon,
        winner,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem('boardbrain_saved_game', JSON.stringify(gameState));
      console.log('Game auto-saved');
    }
  }, [gamePhase, turnNumber, currentPlayerIndex, constraints.length]);

  // Check for saved game on mount
  useEffect(() => {
    const saved = localStorage.getItem('boardbrain_saved_game');
    if (saved) {
      console.log('Saved game found in localStorage');
    }
  }, []);

  // Initialize card states when game starts
  useEffect(() => {
    if (gamePhase === 'playing' && Object.keys(cardStates).length === 0) {
      initializeCardStates();
    }
  }, [gamePhase]);

  const initializeCardStates = () => {
    const states = {};
    const currentPlayer = players[currentPlayerIndex];
    
    ALL_CARDS.forEach(card => {
      if (currentPlayer.cards.includes(card)) {
        // My card
        states[card] = {
          holder: 'me',
          probability: 0,
          shownTo: [],
          status: 'mine',
          certainty: 100
        };
      } else if (publicCards.includes(card)) {
        // Public card
        states[card] = {
          holder: 'public',
          probability: 0,
          shownTo: [],
          status: 'public',
          certainty: 100
        };
      } else {
        // Unknown card - could be solution or other player's hand
        const unknownCount = ALL_CARDS.length - currentPlayer.cards.length - publicCards.length;
        states[card] = {
          holder: null,
          probability: (3 / unknownCount) * 100, // 3 cards in solution
          shownTo: [],
          status: 'unknown',
          certainty: 0
        };
      }
    });
    
    setCardStates(states);
  };

  const resetGame = () => {
    setGamePhase('intro');
    setSetupStep(0);
    setNumPlayers(null);
    setPlayers([]);
    setCurrentPlayerIndex(0);
    setPinInput('');
    setCardsHidden(true);
    setPublicCards([]);
    setSolutionCards([]);
    setTurnNumber(1);
    setConstraints([]);
    setCardStates({});
    setEliminatedPlayers([]);
    setGameWon(false);
    setWinner(null);
    setSelectedCard(null);
    setMoveInput({
      suspect: '',
      weapon: '',
      room: '',
      responses: []
    });
    // Clear saved game
    localStorage.removeItem('boardbrain_saved_game');
  };

  const resumeGame = () => {
    const saved = localStorage.getItem('boardbrain_saved_game');
    if (!saved) {
      alert('No saved game found!');
      return;
    }
    
    try {
      const gameState = JSON.parse(saved);
      
      // Restore all state
      setGamePhase(gameState.gamePhase);
      setSetupStep(gameState.setupStep || 0);
      setTrainingMode(gameState.trainingMode || false);
      setNumPlayers(gameState.numPlayers);
      setPlayers(gameState.players);
      setCurrentPlayerIndex(gameState.currentPlayerIndex);
      setPublicCards(gameState.publicCards);
      setSolutionCards(gameState.solutionCards);
      setTurnNumber(gameState.turnNumber);
      setConstraints(gameState.constraints);
      setCardStates(gameState.cardStates);
      setEliminatedPlayers(gameState.eliminatedPlayers || []);
      setGameWon(gameState.gameWon || false);
      setWinner(gameState.winner || null);
      setCardsHidden(true); // Always start with cards hidden for privacy
      
      alert(`Game resumed from Turn ${gameState.turnNumber}\nLast saved: ${new Date(gameState.savedAt).toLocaleString()}`);
    } catch (error) {
      console.error('Error loading saved game:', error);
      alert('Error loading saved game. Starting fresh.');
      localStorage.removeItem('boardbrain_saved_game');
    }
  };

  // Styles
  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      color: '#e2e8f0',
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    },
    header: {
      textAlign: 'center',
      marginBottom: '2rem'
    },
    title: {
      fontSize: '2.5rem',
      fontWeight: 'bold',
      color: '#60a5fa',
      marginBottom: '0.5rem'
    },
    subtitle: {
      fontSize: '1rem',
      color: '#94a3b8'
    },
    card: {
      backgroundColor: '#1e293b',
      borderRadius: '0.5rem',
      padding: '1.5rem',
      marginBottom: '1rem',
      border: '1px solid #334155'
    },
    button: {
      padding: '0.75rem 1.5rem',
      borderRadius: '0.375rem',
      border: 'none',
      fontSize: '1rem',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s',
      color: '#fff'
    },
    buttonPrimary: {
      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
    },
    input: {
      width: '100%',
      padding: '0.75rem',
      borderRadius: '0.375rem',
      border: '1px solid #334155',
      backgroundColor: '#0f172a',
      color: '#e2e8f0',
      fontSize: '1rem'
    },
    select: {
      width: '100%',
      padding: '0.75rem',
      borderRadius: '0.375rem',
      border: '1px solid #334155',
      backgroundColor: '#0f172a',
      color: '#e2e8f0',
      fontSize: '1rem'
    },
    label: {
      display: 'block',
      marginBottom: '0.5rem',
      color: '#cbd5e1',
      fontSize: '0.875rem',
      fontWeight: '500'
    }
  };

  // ============================================================================
  // INTRO SCREEN
  // ============================================================================
  if (gamePhase === 'intro') {
    const hasSavedGame = localStorage.getItem('boardbrain_saved_game') !== null;
    
    return (
      <div style={styles.container}>
        <div style={{ maxWidth: '50rem', margin: '0 auto' }}>
          <div style={styles.header}>
            <h1 style={styles.title}>BoardBrain™ 4.0</h1>
            <p style={{ fontSize: '1.25rem', color: '#60a5fa', fontStyle: 'italic', marginTop: '0.5rem' }}>
              Pass-Around Mode
            </p>
            <p style={styles.subtitle}>Multi-player with privacy protection</p>
          </div>

          {hasSavedGame && (
            <div style={{
              ...styles.card,
              backgroundColor: '#1e3a5f',
              border: '2px solid #60a5fa',
              marginBottom: '1rem'
            }}>
              <h3 style={{ fontSize: '1.25rem', color: '#60a5fa', marginBottom: '0.5rem' }}>
                🔄 Saved Game Found!
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '1rem' }}>
                You have a game in progress. Resume where you left off.
              </p>
              <button
                onClick={resumeGame}
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  width: '100%',
                  fontSize: '1.125rem',
                  padding: '1rem'
                }}
              >
                🔄 Resume Last Game
              </button>
            </div>
          )}

          <div style={styles.card}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>How It Works</h2>
            
            <div style={{ marginBottom: '2rem', lineHeight: '1.8' }}>
              <p style={{ marginBottom: '1rem' }}>
                🎮 <strong>Everyone is a player</strong> - No host needed
              </p>
              <p style={{ marginBottom: '1rem' }}>
                💻 <strong>Pass the laptop</strong> - Each player takes their turn
              </p>
              <p style={{ marginBottom: '1rem' }}>
                🔒 <strong>Privacy protected</strong> - Enter your PIN to see your cards
              </p>
              <p style={{ marginBottom: '1rem' }}>
                🎴 <strong>Card-centric view</strong> - See all cards with emerging certainties
              </p>
              <p style={{ marginBottom: '1rem' }}>
                🎯 <strong>Auto-deduction</strong> - System tracks probabilities and constraints
              </p>
            </div>

            <div style={{ 
              padding: '1rem',
              backgroundColor: '#0f172a',
              borderRadius: '0.375rem',
              marginBottom: '2rem',
              border: '1px solid #334155'
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', color: '#fbbf24' }}>
                Setup Flow
              </h3>
              <ol style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }}>
                <li><strong>Player 1:</strong> Enters all names, selects their cards + public cards, creates PIN</li>
                <li><strong>Players 2-N:</strong> Each enters their cards + creates PIN</li>
                <li><strong>Play begins:</strong> Enter PIN → Make move → Hide cards → Pass laptop</li>
              </ol>
            </div>

            {/* Training Mode Toggle */}
            <div style={{ 
              padding: '1rem',
              backgroundColor: '#0f172a',
              borderRadius: '0.375rem',
              marginBottom: '2rem',
              border: '1px solid #334155'
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', color: '#60a5fa' }}>
                Game Mode
              </h3>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => setTrainingMode(false)}
                  style={{
                    ...styles.button,
                    flex: 1,
                    background: !trainingMode ? '#1e40af' : '#374151',
                    border: !trainingMode ? '2px solid #3b82f6' : 'none'
                  }}
                >
                  🔒 Pass-Around Version
                  <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.8 }}>
                    One player at a time, others hidden
                  </div>
                </button>
                <button
                  onClick={() => setTrainingMode(true)}
                  style={{
                    ...styles.button,
                    flex: 1,
                    background: trainingMode ? '#1e40af' : '#374151',
                    border: trainingMode ? '2px solid #3b82f6' : 'none'
                  }}
                >
                  🎓 Training Mode
                  <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.8 }}>
                    See all hands (for learning/testing)
                  </div>
                </button>
              </div>
            </div>

            <button
              onClick={() => setGamePhase('playerNames')}
              style={{
                ...styles.button,
                ...styles.buttonPrimary,
                width: '100%',
                fontSize: '1.25rem',
                padding: '1rem'
              }}
            >
              Start New Game →
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.875rem', color: '#64748b' }}>
            © 2025 Pat Boulay · BoardBrain™ · More Brain. Better Game.
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PLAYER NAMES SETUP
  // ============================================================================
  if (gamePhase === 'playerNames') {
    const handleNumPlayersSelect = (n) => {
      setNumPlayers(n);
      const newPlayers = [];
      for (let i = 0; i < n; i++) {
        newPlayers.push({
          name: '',
          pin: '',
          cards: [],
          hasSetup: false
        });
      }
      setPlayers(newPlayers);
    };

    const handleNameChange = (index, name) => {
      const updated = [...players];
      updated[index].name = name;
      setPlayers(updated);
    };

    const allNamesEntered = players.length > 0 && players.every(p => p.name.trim() !== '');

    return (
      <div style={styles.container}>
        <div style={{ maxWidth: '50rem', margin: '0 auto' }}>
          <div style={styles.header}>
            <h1 style={styles.title}>BoardBrain™ 4.0</h1>
            <p style={styles.subtitle}>Player Setup</p>
          </div>

          <div style={styles.card}>
            <h2 style={{ marginBottom: '1.5rem' }}>How many players?</h2>
            
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
              {[3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  onClick={() => handleNumPlayersSelect(n)}
                  style={{
                    ...styles.button,
                    flex: 1,
                    background: numPlayers === n ? '#1e40af' : '#374151',
                    border: numPlayers === n ? '2px solid #3b82f6' : 'none'
                  }}
                >
                  {n} Players
                </button>
              ))}
            </div>

            {numPlayers && (
              <>
                <h2 style={{ marginBottom: '1rem' }}>Enter player names</h2>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
                  Names will be used for turn order (Player 1 goes first)
                </p>

                {players.map((player, idx) => (
                  <div key={idx} style={{ marginBottom: '1rem' }}>
                    <label style={styles.label}>Player {idx + 1}</label>
                    <input
                      type="text"
                      style={styles.input}
                      placeholder={`Enter name for Player ${idx + 1}`}
                      value={player.name}
                      onChange={(e) => handleNameChange(idx, e.target.value)}
                    />
                  </div>
                ))}

                <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                  <button
                    onClick={() => setGamePhase('intro')}
                    style={{
                      ...styles.button,
                      flex: 1,
                      background: '#374151'
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => {
                      setGamePhase('setupCards');
                      setSetupStep(0);
                    }}
                    disabled={!allNamesEntered}
                    style={{
                      ...styles.button,
                      ...styles.buttonPrimary,
                      flex: 1,
                      opacity: !allNamesEntered ? 0.5 : 1,
                      cursor: !allNamesEntered ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Next: Card Setup →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // CARD SETUP - EACH PLAYER ENTERS THEIR CARDS
  // ============================================================================
  if (gamePhase === 'setupCards') {
    const currentSetupPlayer = players[setupStep];
    const isFirstPlayer = setupStep === 0;
    
    const handleCardToggle = (card) => {
      const updated = [...players];
      if (updated[setupStep].cards.includes(card)) {
        updated[setupStep].cards = updated[setupStep].cards.filter(c => c !== card);
      } else {
        updated[setupStep].cards.push(card);
      }
      setPlayers(updated);
    };

    const handlePublicCardToggle = (card) => {
      if (publicCards.includes(card)) {
        setPublicCards(publicCards.filter(c => c !== card));
      } else {
        setPublicCards([...publicCards, card]);
      }
    };

    const isCardUsed = (card) => {
      // Check if card is in public cards
      if (publicCards.includes(card)) return true;
      
      // Check if card is in any previous player's hand
      for (let i = 0; i < setupStep; i++) {
        if (players[i].cards.includes(card)) return true;
      }
      
      // Check if card is in current player's hand
      if (currentSetupPlayer.cards.includes(card)) return true;
      
      return false;
    };

    // Calculate requirements
    const totalCards = 21;
    const solutionCardCount = 3;
    const toDistribute = totalCards - solutionCardCount; // 18
    const cardsPerPlayer = Math.floor((toDistribute - publicCards.length) / numPlayers);
    const extraCards = (toDistribute - publicCards.length) % numPlayers;
    const expectedForThisPlayer = setupStep < extraCards ? cardsPerPlayer + 1 : cardsPerPlayer;
    
    const currentPlayerCardCount = currentSetupPlayer.cards.length;
    const remaining = expectedForThisPlayer - currentPlayerCardCount;

    const handleComplete = () => {
      if (!currentSetupPlayer.pin || currentSetupPlayer.pin.length < 2) {
        alert('Please create a PIN (at least 2 digits)');
        return;
      }

      const updated = [...players];
      updated[setupStep].hasSetup = true;
      setPlayers(updated);

      if (setupStep < players.length - 1) {
        // More players need to setup
        setSetupStep(setupStep + 1);
      } else {
        // All players done - start game
        setGamePhase('playing');
        setCurrentPlayerIndex(0);
        setCardsHidden(true);
      }
    };

    return (
      <div style={styles.container}>
        <div style={{ maxWidth: '60rem', margin: '0 auto' }}>
          <div style={styles.header}>
            <h1 style={styles.title}>BoardBrain™ 4.0 - Card Setup</h1>
            <p style={styles.subtitle}>
              Player {setupStep + 1} of {players.length}: <strong>{currentSetupPlayer.name}</strong>
            </p>
          </div>

          <div style={styles.card}>
            {/* Card count status */}
            <div style={{
              padding: '1rem',
              marginBottom: '1.5rem',
              backgroundColor: remaining === 0 ? '#065f46' : '#7c2d12',
              borderRadius: '0.5rem',
              border: `2px solid ${remaining === 0 ? '#22c55e' : '#f97316'}`
            }}>
              <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                📊 Card Selection Status
              </div>
              <div style={{ fontSize: '0.875rem', color: '#e2e8f0' }}>
                {isFirstPlayer && (
                  <>
                    • Public cards: {publicCards.length}
                    <br />
                  </>
                )}
                • Your cards: {currentPlayerCardCount} / {expectedForThisPlayer} selected
                {remaining === 0 ? 
                  <span style={{ color: '#86efac', fontWeight: '600' }}> ✓ Complete!</span> : 
                  <span style={{ color: '#fdba74' }}> ⚠️ Need {remaining} more</span>
                }
              </div>
            </div>

            {/* Public Cards - Only for first player */}
            {isFirstPlayer && (
              <>
                {(() => {
                  const publicNeeded = (toDistribute - publicCards.length) % numPlayers;
                  const remaining = publicNeeded - publicCards.length;
                  return (
                    <>
                      <h2 style={{ marginBottom: '0.5rem', marginTop: '2rem' }}>
                        👁️ Public Cards - {publicCards.length} / {publicNeeded} selected
                        <span style={{ 
                          marginLeft: '1rem', 
                          fontSize: '1rem',
                          color: remaining === 0 ? '#86efac' : '#fdba74'
                        }}>
                          ({Math.max(0, remaining)} remaining)
                        </span>
                      </h2>
                      <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1rem' }}>
                        Remainder cards visible to all players (cannot be in solution)
                      </p>
                    </>
                  );
                })()}
                
                {['suspects', 'weapons', 'rooms'].map(category => (
                  <div key={category} style={{ marginBottom: '1rem' }}>
                    <h3 style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: '600',
                      color: '#94a3b8',
                      textTransform: 'uppercase',
                      marginBottom: '0.5rem'
                    }}>
                      {category}
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {CLUE_DATA[category].map(card => {
                        const isPublic = publicCards.includes(card);
                        return (
                          <button
                            key={card}
                            onClick={() => handlePublicCardToggle(card)}
                            style={{
                              padding: '0.5rem 1rem',
                              borderRadius: '0.375rem',
                              border: isPublic ? '2px solid #fbbf24' : '1px solid #334155',
                              backgroundColor: isPublic ? '#92400e' : '#0f172a',
                              color: '#e2e8f0',
                              cursor: 'pointer',
                              fontSize: '0.875rem'
                            }}
                          >
                            {isPublic && '✓ '}{card}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Player's Cards */}
            <h2 style={{ marginBottom: '0.5rem', marginTop: '2rem' }}>
              🎴 {currentSetupPlayer.name}'s Cards - {currentPlayerCardCount} / {expectedForThisPlayer} selected
              <span style={{ 
                marginLeft: '1rem', 
                fontSize: '1rem',
                color: remaining === 0 ? '#86efac' : '#fdba74'
              }}>
                ({Math.max(0, remaining)} remaining)
              </span>
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1rem' }}>
              Select the cards in your hand
            </p>
            
            {['suspects', 'weapons', 'rooms'].map(category => (
              <div key={category} style={{ marginBottom: '1rem' }}>
                <h3 style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: '600',
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  marginBottom: '0.5rem'
                }}>
                  {category}
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {CLUE_DATA[category].map(card => {
                    const used = isCardUsed(card);
                    const inMyHand = currentSetupPlayer.cards.includes(card);
                    const canSelect = !used || inMyHand;
                    
                    return (
                      <button
                        key={card}
                        onClick={() => canSelect ? handleCardToggle(card) : null}
                        disabled={!canSelect}
                        style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '0.375rem',
                          border: inMyHand ? '2px solid #3b82f6' : '1px solid #334155',
                          backgroundColor: inMyHand ? '#1e40af' : used ? '#1e293b' : '#0f172a',
                          color: used && !inMyHand ? '#64748b' : '#e2e8f0',
                          cursor: canSelect ? 'pointer' : 'not-allowed',
                          opacity: used && !inMyHand ? 0.4 : 1,
                          fontSize: '0.875rem'
                        }}
                      >
                        {inMyHand && '✓ '}{card}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* PIN Creation */}
            <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#0f172a', borderRadius: '0.375rem' }}>
              <label style={styles.label}>Create Your PIN (2+ digits)</label>
              <input
                type="password"
                style={styles.input}
                placeholder="Enter a PIN you'll remember"
                value={currentSetupPlayer.pin}
                onChange={(e) => {
                  const updated = [...players];
                  updated[setupStep].pin = e.target.value;
                  setPlayers(updated);
                }}
              />
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                💡 Use something easy to remember - you'll need it each turn
              </p>
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button
                onClick={() => {
                  if (setupStep > 0) {
                    setSetupStep(setupStep - 1);
                  } else {
                    setGamePhase('playerNames');
                  }
                }}
                style={{
                  ...styles.button,
                  flex: 1,
                  background: '#374151'
                }}
              >
                ← Back
              </button>
              <button
                onClick={handleComplete}
                disabled={remaining !== 0 || !currentSetupPlayer.pin || currentSetupPlayer.pin.length < 2}
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  flex: 1,
                  opacity: (remaining !== 0 || !currentSetupPlayer.pin || currentSetupPlayer.pin.length < 2) ? 0.5 : 1,
                  cursor: (remaining !== 0 || !currentSetupPlayer.pin || currentSetupPlayer.pin.length < 2) ? 'not-allowed' : 'pointer'
                }}
              >
                {setupStep < players.length - 1 ? 'Next Player →' : 'Start Game! →'}
              </button>
            </div>

            {setupStep < players.length - 1 && (
              <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#fbbf24', textAlign: 'center' }}>
                ⚠️ Pass laptop to <strong>{players[setupStep + 1].name}</strong> after clicking Next
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PLAYING - Main game view
  // ============================================================================
  if (gamePhase === 'playing') {
    const currentPlayer = players[currentPlayerIndex];
    const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
    const nextPlayer = players[nextPlayerIndex];

    // PIN Entry Screen
    if (cardsHidden) {
      return (
        <div style={styles.container}>
          <div style={{ maxWidth: '50rem', margin: '0 auto' }}>
            <div style={styles.header}>
              <h1 style={styles.title}>BoardBrain™ 4.0</h1>
              <p style={{ fontSize: '1.5rem', color: '#60a5fa', marginTop: '1rem' }}>
                Turn {turnNumber}
              </p>
            </div>

            <div style={styles.card}>
              <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem', textAlign: 'center', color: '#fbbf24' }}>
                {currentPlayer.name}'s Turn
              </h2>
              
              <p style={{ fontSize: '1.125rem', color: '#94a3b8', marginBottom: '2rem', textAlign: 'center' }}>
                Enter your PIN to see your cards
              </p>

              <div style={{ maxWidth: '20rem', margin: '0 auto' }}>
                <input
                  type="password"
                  style={{
                    ...styles.input,
                    fontSize: '1.5rem',
                    textAlign: 'center',
                    padding: '1rem'
                  }}
                  placeholder="Enter PIN"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      if (pinInput === currentPlayer.pin) {
                        setCardsHidden(false);
                        setPinInput('');
                        initializeCardStates();
                      } else {
                        alert('Incorrect PIN. Try again.');
                        setPinInput('');
                      }
                    }
                  }}
                  autoFocus
                />

                <button
                  onClick={() => {
                    if (pinInput === currentPlayer.pin) {
                      setCardsHidden(false);
                      setPinInput('');
                      initializeCardStates();
                    } else {
                      alert('Incorrect PIN. Try again.');
                      setPinInput('');
                    }
                  }}
                  style={{
                    ...styles.button,
                    ...styles.buttonPrimary,
                    width: '100%',
                    marginTop: '1rem',
                    fontSize: '1.125rem',
                    padding: '1rem'
                  }}
                >
                  Unlock & Show My Cards
                </button>
              </div>

              <div style={{ 
                marginTop: '3rem',
                padding: '1rem',
                backgroundColor: '#0f172a',
                borderRadius: '0.375rem',
                border: '1px solid #334155'
              }}>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', textAlign: 'center' }}>
                  Up next: <strong style={{ color: '#60a5fa' }}>{nextPlayer.name}</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Helper function to get card style based on state
    const getCardStyle = (card, isMyCard, isPublic) => {
      const state = cardStates[card] || {};
      
      if (isMyCard) {
        // My cards - blue
        return {
          backgroundColor: '#1e40af',
          border: '2px solid #3b82f6',
          color: '#e2e8f0',
          opacity: 1
        };
      }
      
      if (isPublic) {
        // Public cards - yellow/amber
        return {
          backgroundColor: '#92400e',
          border: '2px solid #fbbf24',
          color: '#e2e8f0',
          opacity: 1
        };
      }
      
      if (state.status === 'eliminated') {
        // Eliminated - red
        return {
          backgroundColor: '#450a0a',
          border: '1px solid #dc2626',
          color: '#fca5a5',
          opacity: 0.7
        };
      }
      
      if (state.shownTo && state.shownTo.includes(currentPlayer.name)) {
        // Shown to me - green border
        return {
          backgroundColor: '#0f172a',
          border: '2px solid #22c55e',
          color: '#86efac',
          opacity: 1
        };
      }
      
      if (state.probability >= 70) {
        // Likely solution - gold glow
        return {
          backgroundColor: '#422006',
          border: '2px solid #fbbf24',
          color: '#fde047',
          opacity: 1,
          boxShadow: '0 0 10px rgba(251, 191, 36, 0.3)'
        };
      }
      
      // Unknown - gray face-down
      return {
        backgroundColor: '#1e293b',
        border: '1px solid #475569',
        color: '#94a3b8',
        opacity: 0.8
      };
    };

    // Helper to render a card
    const renderCard = (card) => {
      const isMyCard = currentPlayer.cards.includes(card);
      const isPublic = publicCards.includes(card);
      const state = cardStates[card] || {};
      const cardStyle = getCardStyle(card, isMyCard, isPublic);
      
      return (
        <div
          key={card}
          onClick={() => setSelectedCard(card)}
          style={{
            ...cardStyle,
            padding: '0.75rem',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            minHeight: '4rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = cardStyle.boxShadow || 'none';
          }}
        >
          <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>
            {isMyCard && '🎴 '}
            {isPublic && '👁️ '}
            {!isMyCard && !isPublic && '🂠 '}
            {card}
          </div>
          
          {!isMyCard && !isPublic && state.probability > 0 && (
            <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.8 }}>
              {state.probability.toFixed(0)}% solution
            </div>
          )}
          
          {isMyCard && (
            <div style={{ fontSize: '0.65rem', marginTop: '0.25rem', opacity: 0.7 }}>
              (yours)
            </div>
          )}
          
          {state.shownTo && state.shownTo.includes(currentPlayer.name) && (
            <div style={{ fontSize: '0.65rem', marginTop: '0.25rem', color: '#86efac' }}>
              ✓ shown to you
            </div>
          )}
        </div>
      );
    };

    // Process move and update deductions with FULL BAYESIAN CALCULATOR
    const processMove = () => {
      const { suspect, weapon, room, responses } = moveInput;
      
      if (!suspect || !weapon || !room) {
        alert('Please select Suspect, Weapon, and Room');
        return;
      }
      
      // Filter out undefined responses
      const validResponses = (responses || []).filter(r => r && r.action);
      
      if (validResponses.length === 0) {
        alert('Please record at least one player response');
        return;
      }
      
      // Create constraint
      const suggestedCards = [suspect, weapon, room];
      const constraint = {
        turn: turnNumber,
        suggester: currentPlayer.name,
        cards: suggestedCards,
        responses: validResponses,
        type: 'suggestion'
      };
      
      // DETECT DEDUCTION CHAINS
      const detectedChains = detectDeductionChains(constraint);
      
      // Add constraint with detected chains
      setConstraints(prev => [...prev, { ...constraint, deductionChains: detectedChains }]);
      
      // Update card states with Bayesian calculator
      updateCardProbabilities(constraint, detectedChains);
      
      // Clear move input
      setMoveInput({
        suspect: '',
        weapon: '',
        room: '',
        responses: []
      });
      
      // Increment turn number
      setTurnNumber(prev => prev + 1);
      
      // Advance to next player and hide cards
      const nextIdx = (currentPlayerIndex + 1) % players.length;
      setCurrentPlayerIndex(nextIdx);
      setCardsHidden(true);
      
      // Show alert in Pass-Around mode (not Training mode)
      if (!trainingMode) {
        alert(`Pass laptop to ${players[nextIdx].name}`);
      }
    };

    // DEDUCTION CHAIN DETECTOR
    const detectDeductionChains = (currentConstraint) => {
      const chains = [];
      const currentCards = currentConstraint.cards;
      
      // Check each player's response in current turn
      currentConstraint.responses.forEach(resp => {
        if (resp.action === 'pass') {
          // Check for ELIMINATION CHAIN (player showed before, now passes)
          constraints.forEach(pastConstraint => {
            const pastResp = pastConstraint.responses.find(r => r.player === resp.player);
            if (pastResp && pastResp.action === 'show') {
              // Find overlap between past shown cards and current passed cards
              const overlap = pastConstraint.cards.filter(c => currentCards.includes(c));
              if (overlap.length > 0) {
                // ELIMINATION CHAIN: Player showed set A, now passes on cards from A
                const uniqueInPast = pastConstraint.cards.filter(c => !currentCards.includes(c));
                if (uniqueInPast.length > 0) {
                  chains.push({
                    type: 'Elimination Chain',
                    player: resp.player,
                    turns: [pastConstraint.turn, currentConstraint.turn],
                    conclusion: `${resp.player} has one of: ${uniqueInPast.join(' OR ')}`,
                    eliminatedCards: overlap,
                    possibleCards: uniqueInPast
                  });
                }
              }
            }
          });
        } else if (resp.action === 'show') {
          // Check for COMMON CARD CHAIN (player showed multiple times with overlap, then passes)
          const playerShowHistory = constraints.filter(c => 
            c.responses.some(r => r.player === resp.player && r.action === 'show')
          );
          
          if (playerShowHistory.length > 0) {
            // Find common cards across shows
            const allShownSets = playerShowHistory.map(c => c.cards);
            allShownSets.push(currentCards);
            
            const commonCards = allShownSets[0].filter(card =>
              allShownSets.every(set => set.includes(card))
            );
            
            if (commonCards.length > 0) {
              const chainTurns = playerShowHistory.map(c => c.responses.some(r => r.player === resp.player && r.action === 'show') ? c.turn : null).filter(Boolean);
              chainTurns.push(currentConstraint.turn);
              
              chains.push({
                type: 'Common Card Chain',
                player: resp.player,
                turns: chainTurns,
                conclusion: `${resp.player} likely has: ${commonCards.join(' OR ')}`,
                commonCards: commonCards
              });
            }
          }
        }
      });
      
      // Check for SINGLE HOLDER CHAIN (only one player shows, all others pass)
      const showCount = currentConstraint.responses.filter(r => r.action === 'show').length;
      const passCount = currentConstraint.responses.filter(r => r.action === 'pass').length;
      
      if (showCount === 1 && passCount === otherPlayers.length - 1) {
        const shower = currentConstraint.responses.find(r => r.action === 'show');
        chains.push({
          type: 'Single Holder Chain',
          player: shower.player,
          turns: [currentConstraint.turn],
          conclusion: `Only ${shower.player} or Solution has: ${currentCards.join(', ')}`,
          cards: currentCards
        });
      }
      
      // Check for COMPLETE ELIMINATION CHAIN (everyone passes!)
      if (passCount === otherPlayers.length) {
        chains.push({
          type: 'Complete Elimination Chain ⭐',
          turns: [currentConstraint.turn],
          conclusion: `SOLUTION FOUND: ${currentCards.join(', ')}!`,
          solutionCards: currentCards
        });
      }
      
      return chains;
    };

    // BAYESIAN PROBABILITY CALCULATOR (Per-Player Perspective)
    const updateCardProbabilities = (constraint, detectedChains) => {
      const newStates = { ...cardStates };
      const currentPlayerName = currentPlayer.name;
      
      // Process each response
      constraint.responses.forEach(response => {
        if (response.action === 'pass') {
          // Player passed - they don't have ANY of these cards
          constraint.cards.forEach(card => {
            if (newStates[card] && newStates[card].status === 'unknown') {
              // Mark that this player doesn't have this card
              if (!newStates[card].playersWithout) {
                newStates[card].playersWithout = [];
              }
              if (!newStates[card].playersWithout.includes(response.player)) {
                newStates[card].playersWithout.push(response.player);
              }
            }
          });
        } else if (response.action === 'show' && response.shownCard) {
          // Current player saw specific card shown
          const card = response.shownCard;
          newStates[card] = {
            ...newStates[card],
            holder: response.player,
            probability: 0,
            status: 'eliminated',
            certainty: 100,
            shownTo: [...(newStates[card].shownTo || []), currentPlayerName]
          };
        } else if (response.action === 'show' && !response.shownCard) {
          // Someone else saw the card, we don't know which
          constraint.cards.forEach(card => {
            if (!newStates[card].possibleHolders) {
              newStates[card].possibleHolders = {};
            }
            if (!newStates[card].possibleHolders[response.player]) {
              newStates[card].possibleHolders[response.player] = 0;
            }
            newStates[card].possibleHolders[response.player] += 1/constraint.cards.length;
          });
        }
      });
      
      // Apply deduction chain conclusions
      detectedChains.forEach(chain => {
        if (chain.type === 'Elimination Chain') {
          // Mark eliminated cards as 0% for this player
          chain.eliminatedCards.forEach(card => {
            if (newStates[card]?.possibleHolders?.[chain.player]) {
              delete newStates[card].possibleHolders[chain.player];
            }
          });
        } else if (chain.type === 'Complete Elimination Chain ⭐') {
          // Mark all three cards as IN SOLUTION!
          chain.solutionCards.forEach(card => {
            newStates[card] = {
              ...newStates[card],
              probability: 100,
              status: 'solution',
              certainty: 100
            };
          });
        }
      });
      
      // RECALCULATE BAYESIAN PROBABILITIES for all unknown cards
      ALL_CARDS.forEach(card => {
        const state = newStates[card];
        
        // Skip if already eliminated or confirmed
        if (state.status === 'eliminated' || state.status === 'mine' || state.status === 'public' || state.status === 'solution') {
          return;
        }
        
        // Calculate how many players could have this card
        const totalOtherPlayers = players.length - 1; // Excluding current player
        const playersWhoPassedOnIt = state.playersWithout ? state.playersWithout.length : 0;
        const playersWhoMightHaveIt = totalOtherPlayers - playersWhoPassedOnIt;
        
        // Get card category info
        const cardCategory = CLUE_DATA.suspects.includes(card) ? 'suspects' : 
                            CLUE_DATA.weapons.includes(card) ? 'weapons' : 'rooms';
        const cardsInCategory = CLUE_DATA[cardCategory];
        
        // Count how many cards in this category are still unknown (could be in solution)
        const unknownInCategory = cardsInCategory.filter(c => {
          const cState = newStates[c];
          return cState.status !== 'eliminated' && cState.status !== 'mine' && cState.status !== 'public';
        }).length;
        
        // Base probability: 1 card per category in solution
        let baseProbability = unknownInCategory > 0 ? (1 / unknownInCategory) : 0;
        
        // Adjust based on player constraints
        if (playersWhoMightHaveIt === 0) {
          // No players can have it -> must be in solution!
          newStates[card].probability = 100;
          newStates[card].status = 'likely';
        } else {
          // Bayesian update: reduce probability based on possible holders
          const adjustmentFactor = playersWhoMightHaveIt / (playersWhoMightHaveIt + 1);
          newStates[card].probability = baseProbability * 100 * (1 - adjustmentFactor * 0.5);
        }
      });
      
      setCardStates(newStates);
    };

    // Get other players for response logging - IN TURN ORDER starting with next player
    const otherPlayers = [];
    for (let i = 1; i < players.length; i++) {
      const idx = (currentPlayerIndex + i) % players.length;
      otherPlayers.push(players[idx]);
    }

    // Main Playing Screen - Cards Visible
    return (
      <div style={styles.container}>
        <div style={{ maxWidth: '95rem', margin: '0 auto' }}>
          {/* DEBUG PANEL - Training Mode Only */}
          {trainingMode && (
            <div style={{
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              backgroundColor: '#7c2d12',
              borderRadius: '0.5rem',
              border: '2px dashed #f97316',
              fontSize: '0.875rem'
            }}>
              <strong style={{ color: '#fdba74' }}>🔧 DEBUG (Training Mode):</strong>{' '}
              <span style={{ color: '#fed7aa' }}>
                Solution = [{solutionCards.join(', ')}] 
                ({solutionCards.length} cards)
              </span>
            </div>
          )}
          
          {/* Game Won Banner */}
          {gameWon && (
            <div style={{
              padding: '1.5rem',
              marginBottom: '1.5rem',
              backgroundColor: '#065f46',
              borderRadius: '0.5rem',
              border: '3px solid #10b981',
              textAlign: 'center',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.5)'
            }}>
              <h2 style={{ fontSize: '2rem', color: '#6ee7b7', marginBottom: '0.5rem' }}>
                🎉 GAME OVER - {winner} WINS! 🎉
              </h2>
              <p style={{ fontSize: '1.25rem', color: '#d1fae5' }}>
                Solution: {solutionCards.join(', ')}
              </p>
            </div>
          )}
          
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '1.5rem',
            padding: '1rem 1.5rem',
            backgroundColor: '#1e293b',
            borderRadius: '0.5rem',
            border: '1px solid #334155'
          }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', color: '#60a5fa', marginBottom: '0.25rem' }}>
                BoardBrain™ 4.0 - Turn {turnNumber}
              </h1>
              <p style={{ fontSize: '1rem', color: '#94a3b8' }}>
                <strong style={{ color: '#fbbf24' }}>{currentPlayer.name}</strong> - Your Turn
                <span style={{ marginLeft: '1.5rem', fontSize: '0.875rem' }}>
                  Up next: {nextPlayer.name}
                </span>
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => {
                  if (window.confirm('Pause game? (Game state will be lost when you close the browser)')) {
                    setCardsHidden(true);
                    alert('Game paused. Press "Unlock & Show My Cards" to resume.');
                  }
                }}
                style={{
                  ...styles.button,
                  background: '#f59e0b',
                  fontSize: '0.875rem',
                  padding: '0.5rem 1rem'
                }}
              >
                ⏸️ Pause
              </button>
              
              <button
                onClick={() => {
                  if (window.confirm('End game? All progress will be lost.')) {
                    resetGame();
                  }
                }}
                style={{
                  ...styles.button,
                  background: '#dc2626',
                  fontSize: '0.875rem',
                  padding: '0.5rem 1rem'
                }}
              >
                🛑 End Game
              </button>
              
              <button
                onClick={() => setShowDeductionMatrix(true)}
                style={{
                  ...styles.button,
                  background: '#8b5cf6',
                  fontSize: '0.875rem',
                  padding: '0.5rem 1rem'
                }}
              >
                📊 Deduction Matrix
              </button>
            </div>
          </div>

          {/* Card Display Area */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            {/* Other Players' Hands - Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {players.map((player, idx) => {
                if (idx === currentPlayerIndex) return null; // Skip current player
                
                return (
                  <div
                    key={player.name}
                    style={{
                      backgroundColor: '#1e293b',
                      borderRadius: '0.5rem',
                      padding: '1rem',
                      border: '1px solid #334155'
                    }}
                  >
                    <h3 style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: '600',
                      color: '#94a3b8',
                      marginBottom: '0.75rem',
                      textTransform: 'uppercase'
                    }}>
                      Player {idx + 1}: {player.name} ({player.cards.length} cards)
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      {trainingMode ? (
                        // Training Mode: Show actual cards
                        player.cards.map(card => renderCard(card))
                      ) : (
                        // Pass-Around Mode: Show face-down placeholders
                        player.cards.map((_, cardIdx) => (
                          <div
                            key={cardIdx}
                            style={{
                              backgroundColor: '#1e293b',
                              border: '1px solid #475569',
                              padding: '0.75rem',
                              borderRadius: '0.5rem',
                              minHeight: '4rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#64748b',
                              fontSize: '1.5rem'
                            }}
                          >
                            🂠
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Center Column - Public Cards + Your Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Public Cards */}
              {publicCards.length > 0 && (
                <div
                  style={{
                    backgroundColor: '#1e293b',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    border: '2px solid #fbbf24'
                  }}
                >
                  <h3 style={{ 
                    fontSize: '0.875rem', 
                    fontWeight: '600',
                    color: '#fbbf24',
                    marginBottom: '0.75rem',
                    textTransform: 'uppercase'
                  }}>
                    👁️ Public Cards ({publicCards.length})
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem' }}>
                    {publicCards.map(card => renderCard(card))}
                  </div>
                </div>
              )}

              {/* Your Cards - Organized by Type */}
              <div
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  border: '2px solid #3b82f6'
                }}
              >
                <h3 style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: '600',
                  color: '#3b82f6',
                  marginBottom: '1rem',
                  textTransform: 'uppercase'
                }}>
                  🎴 Player {currentPlayerIndex + 1}: {currentPlayer.name} - YOUR CARDS ({currentPlayer.cards.length})
                </h3>
                
                {/* Organize by category */}
                {['suspects', 'weapons', 'rooms'].map(category => {
                  const categoryCards = currentPlayer.cards.filter(card => CLUE_DATA[category].includes(card));
                  if (categoryCards.length === 0) return null;
                  
                  return (
                    <div key={category} style={{ marginBottom: '1rem' }}>
                      <div style={{ 
                        fontSize: '0.65rem',
                        fontWeight: '600',
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                        marginBottom: '0.5rem',
                        letterSpacing: '0.05em'
                      }}>
                        {category}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem' }}>
                        {categoryCards.map(card => renderCard(card))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column - Turn Logging */}
            <div
              style={{
                backgroundColor: '#1e293b',
                borderRadius: '0.5rem',
                padding: '1rem',
                border: '1px solid #334155'
              }}
            >
              <h3 style={{ 
                fontSize: '1rem', 
                fontWeight: '600',
                color: '#60a5fa',
                marginBottom: '1rem'
              }}>
                📝 Log Move
              </h3>

              {/* Suggestion Selection */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={styles.label}>Suspect</label>
                <select
                  style={styles.select}
                  value={moveInput.suspect}
                  onChange={(e) => setMoveInput(prev => ({ ...prev, suspect: e.target.value }))}
                >
                  <option value="">Select suspect...</option>
                  {CLUE_DATA.suspects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={styles.label}>Weapon</label>
                <select
                  style={styles.select}
                  value={moveInput.weapon}
                  onChange={(e) => setMoveInput(prev => ({ ...prev, weapon: e.target.value }))}
                >
                  <option value="">Select weapon...</option>
                  {CLUE_DATA.weapons.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={styles.label}>Room</label>
                <select
                  style={styles.select}
                  value={moveInput.room}
                  onChange={(e) => setMoveInput(prev => ({ ...prev, room: e.target.value }))}
                >
                  <option value="">Select room...</option>
                  {CLUE_DATA.rooms.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Player Responses */}
              <div style={{ 
                borderTop: '1px solid #334155',
                paddingTop: '1rem',
                marginBottom: '1rem'
              }}>
                <h4 style={{ 
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#cbd5e1',
                  marginBottom: '0.75rem'
                }}>
                  Player Responses
                </h4>

                {otherPlayers.map((player, idx) => {
                  const response = moveInput.responses[idx] || null;
                  
                  // Determine if this player should be highlighted (their turn to respond)
                  const isCurrentResponder = (() => {
                    // No one highlighted if no cards selected yet
                    if (!moveInput.suspect || !moveInput.weapon || !moveInput.room) return false;
                    
                    // Find first player without a response
                    for (let i = 0; i <= idx; i++) {
                      if (!moveInput.responses[i] || !moveInput.responses[i].action) {
                        return i === idx;
                      }
                    }
                    return false;
                  })();
                  
                  return (
                    <div
                      key={player.name}
                      style={{
                        marginBottom: '1rem',
                        padding: '0.75rem',
                        backgroundColor: isCurrentResponder ? '#1e3a5f' : '#0f172a',
                        borderRadius: '0.375rem',
                        border: isCurrentResponder ? '2px solid #60a5fa' : '1px solid #334155',
                        boxShadow: isCurrentResponder ? '0 0 10px rgba(96, 165, 250, 0.3)' : 'none'
                      }}
                    >
                      <div style={{ 
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        marginBottom: '0.5rem',
                        color: isCurrentResponder ? '#60a5fa' : '#cbd5e1'
                      }}>
                        Player {players.findIndex(p => p.name === player.name) + 1}: {player.name}
                        {isCurrentResponder && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>👉 Your response?</span>}
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <button
                          onClick={() => {
                            const newResponses = [...moveInput.responses];
                            
                            // MASTER BOARD VALIDATION: Check if player actually has a card
                            const suggestedCards = [moveInput.suspect, moveInput.weapon, moveInput.room].filter(Boolean);
                            const playerHand = player.cards;
                            const hasCard = suggestedCards.some(card => playerHand.includes(card));
                            
                            if (hasCard && response?.action !== 'pass') {
                              // Player has a card - cannot pass!
                              alert(`${player.name} has at least one of these cards and must Show!`);
                              return;
                            }
                            
                            // Toggle: if already Pass, clear it; otherwise set to Pass
                            if (newResponses[idx]?.action === 'pass') {
                              newResponses[idx] = null; // Clear response
                            } else {
                              newResponses[idx] = { player: player.name, action: 'pass', shownCard: null };
                            }
                            setMoveInput(prev => ({ ...prev, responses: newResponses }));
                          }}
                          style={{
                            ...styles.button,
                            flex: 1,
                            background: response?.action === 'pass' ? '#dc2626' : '#374151',
                            fontSize: '0.75rem',
                            padding: '0.5rem'
                          }}
                        >
                          {response?.action === 'pass' ? '✓ ' : ''}Pass
                        </button>
                        <button
                          onClick={() => {
                            const newResponses = [...moveInput.responses];
                            // Toggle: if already Show, clear it; otherwise set to Show
                            if (newResponses[idx]?.action === 'show') {
                              newResponses[idx] = null; // Clear response
                            } else {
                              newResponses[idx] = { player: player.name, action: 'show', shownCard: null };
                            }
                            setMoveInput(prev => ({ ...prev, responses: newResponses }));
                          }}
                          style={{
                            ...styles.button,
                            flex: 1,
                            background: response?.action === 'show' ? '#16a34a' : '#374151',
                            fontSize: '0.75rem',
                            padding: '0.5rem'
                          }}
                        >
                          {response?.action === 'show' ? '✓ ' : ''}Show
                        </button>
                      </div>

                      {response?.action === 'show' && (
                        <select
                          style={{ ...styles.select, fontSize: '0.75rem', padding: '0.5rem' }}
                          value={response.shownCard || ''}
                          onChange={(e) => {
                            const newResponses = [...moveInput.responses];
                            newResponses[idx].shownCard = e.target.value;
                            setMoveInput(prev => ({ ...prev, responses: newResponses }));
                          }}
                        >
                          <option value="">Which card?</option>
                          {[moveInput.suspect, moveInput.weapon, moveInput.room]
                            .filter(Boolean)
                            .filter(card => player.cards.includes(card))
                            .map(card => (
                              <option key={card} value={card}>{card}</option>
                            ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Show different buttons based on elimination status */}
              {eliminatedPlayers.includes(currentPlayer.name) ? (
                <>
                  {/* ELIMINATED PLAYER: Can only skip turn */}
                  <div style={{
                    padding: '1rem',
                    marginBottom: '1rem',
                    backgroundColor: '#7f1d1d',
                    borderRadius: '0.5rem',
                    border: '2px solid #ef4444',
                    textAlign: 'center'
                  }}>
                    <p style={{ 
                      fontSize: '0.875rem', 
                      color: '#fecaca', 
                      fontWeight: '600',
                      marginBottom: '0.5rem'
                    }}>
                      ❌ You made a wrong accusation and are out of the game
                    </p>
                    <p style={{ 
                      fontSize: '0.75rem', 
                      color: '#fca5a5'
                    }}>
                      You can still respond when others make suggestions, but cannot make your own moves.
                    </p>
                  </div>
                  
                  <button
                    onClick={() => {
                      // Skip turn - just advance to next player
                      setCardsHidden(true);
                      setMoveInput({
                        suspect: '',
                        weapon: '',
                        room: '',
                        responses: []
                      });
                      // Move to next non-eliminated player
                      let nextIdx = (currentPlayerIndex + 1) % players.length;
                      // Skip eliminated players (but don't infinite loop if all eliminated)
                      let attempts = 0;
                      while (eliminatedPlayers.includes(players[nextIdx].name) && attempts < players.length) {
                        nextIdx = (nextIdx + 1) % players.length;
                        attempts++;
                      }
                      setCurrentPlayerIndex(nextIdx);
                      // Don't increment turn number for skipped turns
                    }}
                    style={{
                      ...styles.button,
                      background: '#f97316',
                      width: '100%',
                      fontSize: '1rem',
                      padding: '0.75rem'
                    }}
                  >
                    ⏭️ Skip Turn & Pass Laptop to {nextPlayer.name}
                  </button>
                </>
              ) : (
                <>
                  {/* ACTIVE PLAYER: Can log moves */}
                  <button
                    onClick={processMove}
                    style={{
                      ...styles.button,
                      ...styles.buttonPrimary,
                      width: '100%',
                      fontSize: '1rem',
                      padding: '0.75rem'
                    }}
                  >
                    🎯 Log Move & Pass Laptop
                  </button>
                  
                  <button
                    onClick={() => setShowAccusationModal(true)}
                    style={{
                      ...styles.button,
                      background: '#dc2626',
                      width: '100%',
                      fontSize: '0.875rem',
                      padding: '0.5rem',
                      marginTop: '1rem'
                    }}
                  >
                    🎲 Make Accusation
                  </button>
                  
                  <p style={{ 
                    marginTop: '0.75rem', 
                    fontSize: '0.75rem', 
                    color: '#94a3b8', 
                    textAlign: 'center' 
                  }}>
                    {!trainingMode && `This will pass to ${nextPlayer.name}`}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Constraint Timeline - Enhanced with Deductions */}
          {constraints.length > 0 && (
            <div style={styles.card}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#60a5fa' }}>
                📜 Turn History
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '20rem', overflow: 'auto' }}>
                {[...constraints].reverse().map((constraint, idx) => {
                  // Calculate what was learned from this turn
                  const deductions = [];
                  
                  constraint.responses.forEach(resp => {
                    if (resp.action === 'pass') {
                      // Player passed - they don't have ANY of the 3 cards
                      deductions.push(`${resp.player} doesn't have: ${constraint.cards.join(' OR ')}`);
                    } else if (resp.action === 'show' && resp.shownCard) {
                      // Player showed specific card
                      deductions.push(`${resp.player} has: ${resp.shownCard} ✓`);
                    } else if (resp.action === 'show' && !resp.shownCard) {
                      // Player showed but card unknown
                      deductions.push(`${resp.player} has one of: ${constraint.cards.join(' OR ')}`);
                    }
                  });
                  
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '0.75rem',
                        backgroundColor: '#0f172a',
                        borderRadius: '0.375rem',
                        borderLeft: '3px solid #3b82f6',
                        fontSize: '0.875rem'
                      }}
                    >
                      <div style={{ fontWeight: '600', color: '#60a5fa', marginBottom: '0.25rem' }}>
                        Turn {constraint.turn} - {constraint.suggester}
                      </div>
                      <div style={{ color: '#fbbf24', marginBottom: '0.5rem' }}>
                        Suggested: {constraint.cards.join(', ')}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                        {constraint.responses.map((resp, ridx) => (
                          <span
                            key={ridx}
                            style={{
                              marginRight: '0.75rem',
                              color: resp.action === 'pass' ? '#fca5a5' : '#86efac'
                            }}
                          >
                            {resp.player}: {resp.action === 'pass' ? 'Pass' : `Show${resp.shownCard ? ` (${resp.shownCard})` : ''}`}
                          </span>
                        ))}
                      </div>
                      {deductions.length > 0 && (
                        <div style={{ 
                          marginTop: '0.5rem',
                          paddingTop: '0.5rem',
                          borderTop: '1px solid #334155'
                        }}>
                          <div style={{ fontSize: '0.7rem', color: '#cbd5e1', fontWeight: '600', marginBottom: '0.25rem' }}>
                            What We Learned:
                          </div>
                          {deductions.map((ded, didx) => (
                            <div key={didx} style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '0.5rem' }}>
                              • {ded}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Display Deduction Chains */}
                      {constraint.deductionChains && constraint.deductionChains.length > 0 && (
                        <div style={{
                          marginTop: '0.75rem',
                          padding: '0.75rem',
                          backgroundColor: '#1e3a5f',
                          borderRadius: '0.375rem',
                          border: '2px solid #60a5fa',
                          boxShadow: '0 0 10px rgba(96, 165, 250, 0.3)'
                        }}>
                          <div style={{ 
                            fontSize: '0.75rem', 
                            color: '#fbbf24', 
                            fontWeight: '700', 
                            marginBottom: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            ⛓️ DEDUCTION CHAIN TRIGGERED!
                          </div>
                          {constraint.deductionChains.map((chain, cidx) => (
                            <div key={cidx} style={{ 
                              fontSize: '0.7rem', 
                              marginTop: '0.5rem',
                              padding: '0.5rem',
                              backgroundColor: '#0f172a',
                              borderRadius: '0.25rem'
                            }}>
                              <div style={{ color: '#86efac', fontWeight: '600', marginBottom: '0.25rem' }}>
                                {chain.type}
                                {chain.turns && chain.turns.length > 1 && (
                                  <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>
                                    {' '}(Turns {chain.turns.join(' → ')})
                                  </span>
                                )}
                              </div>
                              <div style={{ color: '#e2e8f0' }}>
                                {chain.conclusion}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Accusation Modal */}
          {showAccusationModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
            onClick={() => setShowAccusationModal(false)}
            >
              <div
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: '0.5rem',
                  padding: '2rem',
                  maxWidth: '40rem',
                  border: '2px solid #dc2626',
                  boxShadow: '0 0 20px rgba(220, 38, 38, 0.5)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h2 style={{ fontSize: '1.5rem', color: '#dc2626', marginBottom: '1rem' }}>
                  🎲 Make Your Accusation
                </h2>
                
                <p style={{ color: '#fbbf24', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                  ⚠️ WARNING: If you're wrong, you're OUT of the game!
                </p>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={styles.label}>Suspect</label>
                  <select
                    style={styles.select}
                    value={accusation.suspect}
                    onChange={(e) => setAccusation(prev => ({ ...prev, suspect: e.target.value }))}
                  >
                    <option value="">Select suspect...</option>
                    {CLUE_DATA.suspects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={styles.label}>Weapon</label>
                  <select
                    style={styles.select}
                    value={accusation.weapon}
                    onChange={(e) => setAccusation(prev => ({ ...prev, weapon: e.target.value }))}
                  >
                    <option value="">Select weapon...</option>
                    {CLUE_DATA.weapons.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  <label style={styles.label}>Room</label>
                  <select
                    style={styles.select}
                    value={accusation.room}
                    onChange={(e) => setAccusation(prev => ({ ...prev, room: e.target.value }))}
                  >
                    <option value="">Select room...</option>
                    {CLUE_DATA.rooms.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                {/* ROOM ACCUSATION REMINDER */}
                <div style={{
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  backgroundColor: '#1e3a5f',
                  borderRadius: '0.375rem',
                  border: '1px solid #60a5fa',
                  fontSize: '0.875rem'
                }}>
                  <span style={{ color: '#fbbf24' }}>📍 REMINDER:</span>{' '}
                  <span style={{ color: '#cbd5e1' }}>
                    In Clue, you must be in the room you're accusing (on the real board). 
                    Make sure you're physically there before proceeding!
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={() => {
                      setShowAccusationModal(false);
                      setAccusation({ suspect: '', weapon: '', room: '' });
                    }}
                    style={{
                      ...styles.button,
                      flex: 1,
                      background: '#374151'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!accusation.suspect || !accusation.weapon || !accusation.room) {
                        alert('Please select all three cards!');
                        return;
                      }
                      
                      // DEBUG: Log what we're comparing
                      console.log('=== ACCUSATION VALIDATION DEBUG ===');
                      console.log('Accusation:', accusation);
                      console.log('Solution Cards:', solutionCards);
                      console.log('Suspect match:', solutionCards.includes(accusation.suspect));
                      console.log('Weapon match:', solutionCards.includes(accusation.weapon));
                      console.log('Room match:', solutionCards.includes(accusation.room));
                      
                      // Recalculate solution cards fresh to ensure accuracy
                      const allDistributed = [...publicCards];
                      players.forEach(p => allDistributed.push(...p.cards));
                      const freshSolutionCards = ALL_CARDS.filter(c => !allDistributed.includes(c));
                      
                      console.log('Fresh Solution Cards:', freshSolutionCards);
                      console.log('Public Cards:', publicCards);
                      console.log('All Player Cards:', players.map(p => ({ name: p.name, cards: p.cards })));
                      
                      // MASTER BOARD VALIDATION - Use fresh calculation
                      const isCorrect = 
                        freshSolutionCards.includes(accusation.suspect) &&
                        freshSolutionCards.includes(accusation.weapon) &&
                        freshSolutionCards.includes(accusation.room);
                      
                      console.log('isCorrect:', isCorrect);
                      console.log('=== END DEBUG ===');
                      
                      if (isCorrect) {
                        // WINNER!
                        setGameWon(true);
                        setWinner(currentPlayer.name);
                        setShowAccusationModal(false);
                        alert(`🎉 CORRECT! ${currentPlayer.name} wins!\n\nSolution was:\n${accusation.suspect}\n${accusation.weapon}\n${accusation.room}`);
                      } else {
                        // WRONG - Player is eliminated
                        setEliminatedPlayers(prev => [...prev, currentPlayer.name]);
                        setShowAccusationModal(false);
                        alert(`❌ WRONG! ${currentPlayer.name} is eliminated from the game.\n\nYou guessed:\n${accusation.suspect}, ${accusation.weapon}, ${accusation.room}\n\nActual solution:\n${freshSolutionCards.join(', ')}`);
                      }
                      
                      setAccusation({ suspect: '', weapon: '', room: '' });
                    }}
                    disabled={!accusation.suspect || !accusation.weapon || !accusation.room}
                    style={{
                      ...styles.button,
                      flex: 1,
                      background: '#dc2626',
                      opacity: (!accusation.suspect || !accusation.weapon || !accusation.room) ? 0.5 : 1,
                      cursor: (!accusation.suspect || !accusation.weapon || !accusation.room) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Make Accusation
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Deduction Matrix Modal */}
          {showDeductionMatrix && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1rem'
            }}
            onClick={() => setShowDeductionMatrix(false)}
            >
              <div
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: '0.5rem',
                  padding: '1.5rem',
                  maxWidth: '95vw',
                  maxHeight: '90vh',
                  overflow: 'auto',
                  border: '2px solid #8b5cf6'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.5rem', color: '#a78bfa', marginBottom: '0.25rem' }}>
                      📊 Deduction Matrix - {currentPlayer.name}'s View
                    </h2>
                    {trainingMode && (
                      <span style={{ 
                        fontSize: '0.8rem', 
                        color: '#fbbf24', 
                        backgroundColor: '#78350f',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem'
                      }}>
                        🎓 TRAINING MODE - All cards visible
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowDeductionMatrix(false)}
                    style={{
                      ...styles.button,
                      background: '#374151',
                      padding: '0.5rem 1rem'
                    }}
                  >
                    ✕ Close
                  </button>
                </div>

                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1rem' }}>
                  This shows what YOU know based on your hand and observed gameplay. Other players have different views.
                </p>

                {/* Matrix Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse',
                    fontSize: '1rem'
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: '#334155' }}>
                        <th style={{ padding: '0.75rem', border: '1px solid #475569', textAlign: 'left', color: '#cbd5e1', fontSize: '0.9rem' }}>Type</th>
                        <th style={{ padding: '0.75rem', border: '1px solid #475569', textAlign: 'left', color: '#cbd5e1', fontSize: '0.9rem' }}>Card</th>
                        <th style={{ padding: '0.75rem', border: '1px solid #475569', textAlign: 'center', color: '#fbbf24', fontSize: '0.9rem' }}>Public</th>
                        {players.map((p, idx) => (
                          <th key={p.name} style={{ 
                            padding: '0.75rem', 
                            border: '1px solid #475569', 
                            textAlign: 'center',
                            color: idx === currentPlayerIndex ? '#60a5fa' : '#cbd5e1',
                            backgroundColor: idx === currentPlayerIndex ? '#1e3a5f' : 'transparent',
                            fontSize: '0.9rem'
                          }}>
                            {p.name}
                            {idx === currentPlayerIndex && ' (You)'}
                          </th>
                        ))}
                        <th style={{ padding: '0.75rem', border: '1px solid #475569', textAlign: 'center', color: '#a78bfa', fontSize: '0.9rem' }}>
                          P(Solution)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {['suspects', 'weapons', 'rooms'].map(category => (
                        CLUE_DATA[category].map((card, cardIdx) => {
                          const cardState = cardStates[card] || {};
                          const isPublic = publicCards.includes(card);
                          const isYours = currentPlayer.cards.includes(card);
                          
                          // Determine what each player knows about this card
                          const getPlayerCell = (player, playerIdx) => {
                            // YOUR cards - always show D
                            if (playerIdx === currentPlayerIndex && player.cards.includes(card)) {
                              return { text: 'D', color: '#60a5fa', bg: '#1e3a5f' };
                            }
                            
                            // OTHER players' cards
                            if (playerIdx !== currentPlayerIndex && player.cards.includes(card)) {
                              // TRAINING MODE: Show all D's
                              if (trainingMode) {
                                return { text: 'D', color: '#94a3b8', bg: '#374151' };
                              }
                              
                              // Check if this player showed THIS SPECIFIC card to current player
                              const shownToYou = constraints.some(constraint => {
                                const resp = constraint.responses.find(r => r.player === player.name);
                                return resp && resp.action === 'show' && resp.shownCard === card;
                              });
                              
                              if (shownToYou) {
                                return { text: 'SHOWN ✓', color: '#22c55e', bg: '#14532d' };
                              }
                              
                              // Not shown to you - don't reveal
                              // But still check constraints below
                            }
                            
                            // Check constraints for this card and player
                            let cellContent = { text: '', color: '#64748b', bg: 'transparent' };
                            
                            constraints.forEach(constraint => {
                              if (constraint.cards.includes(card)) {
                                // Card was in this suggestion
                                if (constraint.suggester === player.name) {
                                  cellContent = { text: 'GUESS', color: '#fbbf24', bg: '#78350f' };
                                } else {
                                  const resp = constraint.responses.find(r => r.player === player.name);
                                  if (resp) {
                                    if (resp.action === 'pass') {
                                      cellContent = { text: '—', color: '#ef4444', bg: '#7f1d1d' }; // Larger dash, red bg
                                    } else if (resp.action === 'show') {
                                      if (!resp.shownCard) {
                                        // They showed but we don't know which card
                                        cellContent = { text: 'SHOWN?', color: '#94a3b8', bg: '#374151' };
                                      }
                                      // If shownCard matches, it's already handled above
                                    }
                                  }
                                }
                              }
                            });
                            
                            return cellContent;
                          };
                          
                          // Calculate probability display
                          const getProbabilityCell = () => {
                            if (isPublic || isYours) {
                              return { text: 'X', color: '#000', bg: '#1f2937' };
                            }
                            
                            // Check if another player definitely has it
                            for (let p of players) {
                              if (p.cards.includes(card) && (trainingMode || cardState.holder === p.name)) {
                                return { text: 'X', color: '#000', bg: '#1f2937' };
                              }
                            }
                            
                            // Calculate probability
                            const prob = cardState.probability || 0;
                            if (prob === 0) {
                              return { text: 'X', color: '#000', bg: '#1f2937' };
                            } else if (prob >= 100) {
                              return { text: '100%', color: '#22c55e', bg: '#14532d' };
                            } else {
                              return { text: `${prob.toFixed(0)}%`, color: '#a78bfa', bg: 'transparent' };
                            }
                          };
                          
                          const probCell = getProbabilityCell();
                          
                          return (
                            <tr key={card} style={{ 
                              backgroundColor: cardIdx % 2 === 0 ? '#0f172a' : '#1e293b'
                            }}>
                              <td style={{ 
                                padding: '0.6rem 0.75rem', 
                                border: '1px solid #475569',
                                color: '#94a3b8',
                                fontSize: '0.85rem'
                              }}>
                                {category.charAt(0).toUpperCase() + category.slice(1, -1)}
                              </td>
                              <td style={{ 
                                padding: '0.6rem 0.75rem', 
                                border: '1px solid #475569',
                                color: '#e2e8f0',
                                fontWeight: '500',
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s'
                              }}
                              onClick={() => {
                                setShowDeductionMatrix(false);
                                setSelectedCard(card);
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = '#334155'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                              title="Click for card story"
                              >
                                {card} 🔍
                              </td>
                              <td style={{ 
                                padding: '0.6rem 0.75rem', 
                                border: '1px solid #475569',
                                textAlign: 'center',
                                color: isPublic ? '#fbbf24' : '#64748b',
                                fontWeight: isPublic ? '700' : 'normal',
                                fontSize: '1rem'
                              }}>
                                {isPublic ? 'D' : ''}
                              </td>
                              {players.map((p, playerIdx) => {
                                const cell = getPlayerCell(p, playerIdx);
                                return (
                                  <td key={p.name} style={{ 
                                    padding: '0.6rem 0.75rem', 
                                    border: '1px solid #475569',
                                    textAlign: 'center',
                                    color: cell.color,
                                    backgroundColor: cell.bg,
                                    fontWeight: '700',
                                    fontSize: cell.text === '—' ? '1.5rem' : '0.85rem'
                                  }}>
                                    {cell.text}
                                  </td>
                                );
                              })}
                              <td style={{ 
                                padding: '0.6rem 0.75rem', 
                                border: '1px solid #475569',
                                textAlign: 'center',
                                color: probCell.color,
                                backgroundColor: probCell.bg,
                                fontWeight: '700',
                                fontSize: '1rem'
                              }}>
                                {probCell.text}
                              </td>
                            </tr>
                          );
                        })
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Legend */}
                <div style={{ 
                  marginTop: '1.5rem', 
                  padding: '1rem',
                  backgroundColor: '#0f172a',
                  borderRadius: '0.5rem',
                  fontSize: '0.9rem'
                }}>
                  <h4 style={{ color: '#cbd5e1', marginBottom: '0.75rem', fontSize: '1rem' }}>Legend:</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
                    <span><strong style={{ color: '#60a5fa', fontSize: '1.1rem' }}>D</strong> = Dealt (your card)</span>
                    <span><strong style={{ color: '#fbbf24', fontSize: '1.1rem' }}>GUESS</strong> = Player suggested this card</span>
                    <span><strong style={{ color: '#ef4444', fontSize: '1.5rem' }}>—</strong> = Passed (doesn't have it)</span>
                    <span><strong style={{ color: '#22c55e', fontSize: '1.1rem' }}>SHOWN ✓</strong> = Player showed you this card</span>
                    <span><strong style={{ color: '#94a3b8', fontSize: '1.1rem' }}>SHOWN?</strong> = Player showed (unknown which)</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <strong style={{ color: '#000', backgroundColor: '#374151', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', fontSize: '1.1rem' }}>X</strong> 
                      <span>= 0% (not in solution - you have it or it's public)</span>
                    </span>
                    <span><strong style={{ color: '#a78bfa', fontSize: '1.1rem' }}>nn%</strong> = Probability card is in solution</span>
                  </div>
                  <p style={{ marginTop: '0.75rem', color: '#60a5fa', fontSize: '0.85rem' }}>
                    💡 <strong>Tip:</strong> Click any card name (🔍) to see its full story and constraint history
                  </p>
                </div>

                {/* Deduction Chains Triggered */}
                {constraints.some(c => c.deductionChains && c.deductionChains.length > 0) && (
                  <div style={{ 
                    marginTop: '1rem', 
                    padding: '0.75rem',
                    backgroundColor: '#1e3a5f',
                    borderRadius: '0.375rem',
                    border: '1px solid #60a5fa'
                  }}>
                    <h3 style={{ fontSize: '0.875rem', color: '#60a5fa', marginBottom: '0.5rem' }}>
                      ⛓️ Deduction Chains Triggered
                    </h3>
                    {constraints.filter(c => c.deductionChains && c.deductionChains.length > 0).map((c, idx) => (
                      c.deductionChains.map((chain, chainIdx) => (
                        <div key={`${idx}-${chainIdx}`} style={{ 
                          fontSize: '0.75rem', 
                          color: '#cbd5e1',
                          marginBottom: '0.25rem',
                          paddingLeft: '0.5rem',
                          borderLeft: '2px solid #8b5cf6'
                        }}>
                          <strong style={{ color: '#a78bfa' }}>{chain.type}</strong>
                          {chain.turns && ` (Turns ${chain.turns.join(' → ')})`}: {chain.conclusion}
                        </div>
                      ))
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Card Story Modal */}
          {selectedCard && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
            onClick={() => setSelectedCard(null)}
            >
              <div
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: '0.5rem',
                  padding: '2rem',
                  maxWidth: '60rem',
                  maxHeight: '90vh',
                  overflow: 'auto',
                  border: '2px solid #3b82f6'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.5rem', color: '#60a5fa' }}>
                    📖 {selectedCard} - Complete Story
                  </h2>
                  <button
                    onClick={() => setSelectedCard(null)}
                    style={{
                      ...styles.button,
                      background: '#374151',
                      padding: '0.5rem 1rem'
                    }}
                  >
                    ✕ Close
                  </button>
                </div>

                {/* Card Category */}
                <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#94a3b8' }}>
                  Category: <strong style={{ color: '#cbd5e1' }}>
                    {CLUE_DATA.suspects.includes(selectedCard) ? 'Suspect' : 
                     CLUE_DATA.weapons.includes(selectedCard) ? 'Weapon' : 'Room'}
                  </strong>
                </div>

                {/* Current Status - Enhanced */}
                <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#0f172a', borderRadius: '0.5rem', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.75rem', color: '#60a5fa' }}>
                    📌 Current Status
                  </div>
                  <div style={{ fontSize: '1.1rem' }}>
                    {publicCards.includes(selectedCard) ? (
                      <span style={{ color: '#fbbf24' }}>
                        👁️ <strong>Public Card</strong> - Everyone knows this is NOT in the solution
                      </span>
                    ) : currentPlayer.cards.includes(selectedCard) ? (
                      <span style={{ color: '#60a5fa' }}>
                        🎴 <strong>Your Card</strong> - You have this, so it's NOT in the solution
                      </span>
                    ) : cardStates[selectedCard]?.status === 'eliminated' ? (
                      <span style={{ color: '#ef4444' }}>
                        ❌ <strong>Eliminated</strong> - Held by {cardStates[selectedCard]?.holder}
                      </span>
                    ) : cardStates[selectedCard]?.probability >= 100 ? (
                      <span style={{ color: '#22c55e' }}>
                        🎯 <strong>IN SOLUTION!</strong> - 100% certain this is in the solution
                      </span>
                    ) : (
                      <span style={{ color: '#a78bfa' }}>
                        🔮 <strong>{cardStates[selectedCard]?.probability?.toFixed(0) || '??'}% likely in solution</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Who DOESN'T Have It */}
                {(() => {
                  const playersWithout = [];
                  const playersMightHave = [];
                  
                  players.forEach(p => {
                    if (p.name === currentPlayer.name) return; // Skip yourself
                    if (publicCards.includes(selectedCard)) return; // Public card
                    if (currentPlayer.cards.includes(selectedCard)) return; // Your card
                    
                    // Check if player passed on this card in any constraint
                    const passedOnIt = constraints.some(c => 
                      c.cards.includes(selectedCard) && 
                      c.responses.some(r => r.player === p.name && r.action === 'pass')
                    );
                    
                    // Check if player showed this specific card
                    const showedIt = constraints.some(c =>
                      c.responses.some(r => r.player === p.name && r.action === 'show' && r.shownCard === selectedCard)
                    );
                    
                    if (showedIt) {
                      // They definitely have it
                    } else if (passedOnIt) {
                      playersWithout.push(p.name);
                    } else {
                      playersMightHave.push(p.name);
                    }
                  });
                  
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                      {/* Players who DON'T have it */}
                      <div style={{ padding: '1rem', backgroundColor: '#0f172a', borderRadius: '0.5rem', border: '1px solid #334155' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#ef4444' }}>
                          ❌ Definitely DON'T Have It:
                        </div>
                        {playersWithout.length === 0 ? (
                          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>No one eliminated yet</span>
                        ) : (
                          playersWithout.map(name => (
                            <div key={name} style={{ color: '#fca5a5', fontSize: '0.9rem' }}>• {name}</div>
                          ))
                        )}
                      </div>
                      
                      {/* Players who MIGHT have it */}
                      <div style={{ padding: '1rem', backgroundColor: '#0f172a', borderRadius: '0.5rem', border: '1px solid #334155' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#fbbf24' }}>
                          ❓ Might Have It:
                        </div>
                        {playersMightHave.length === 0 ? (
                          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>All players eliminated - check solution!</span>
                        ) : (
                          playersMightHave.map(name => (
                            <div key={name} style={{ color: '#fde68a', fontSize: '0.9rem' }}>• {name}</div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Probability Explanation */}
                {!publicCards.includes(selectedCard) && !currentPlayer.cards.includes(selectedCard) && (
                  <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#1e3a5f', borderRadius: '0.5rem', border: '1px solid #3b82f6' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#60a5fa' }}>
                      🧮 Probability Calculation
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                      {(() => {
                        const category = CLUE_DATA.suspects.includes(selectedCard) ? 'suspects' : 
                                        CLUE_DATA.weapons.includes(selectedCard) ? 'weapons' : 'rooms';
                        const cardsInCategory = CLUE_DATA[category];
                        const unknownInCategory = cardsInCategory.filter(c => 
                          !publicCards.includes(c) && 
                          !currentPlayer.cards.includes(c) &&
                          cardStates[c]?.status !== 'eliminated'
                        ).length;
                        
                        return (
                          <>
                            <p>• Category: {category} ({cardsInCategory.length} total)</p>
                            <p>• Unknown cards in category: {unknownInCategory}</p>
                            <p>• Base probability: 1/{unknownInCategory} = {(100/unknownInCategory).toFixed(0)}%</p>
                            <p>• Adjusted for constraints: {cardStates[selectedCard]?.probability?.toFixed(0) || '??'}%</p>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Deduction Chains Involving This Card */}
                {(() => {
                  const relevantChains = constraints
                    .filter(c => c.deductionChains && c.deductionChains.length > 0)
                    .flatMap(c => c.deductionChains)
                    .filter(chain => 
                      chain.confirmedCard === selectedCard ||
                      chain.eliminatedCards?.includes(selectedCard) ||
                      chain.possibleCards?.includes(selectedCard) ||
                      chain.commonCards?.includes(selectedCard) ||
                      chain.solutionCards?.includes(selectedCard) ||
                      chain.cards?.includes(selectedCard)
                    );
                  
                  if (relevantChains.length === 0) return null;
                  
                  return (
                    <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#3b1f5e', borderRadius: '0.5rem', border: '1px solid #8b5cf6' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.75rem', color: '#a78bfa' }}>
                        ⛓️ Deduction Chains Involving This Card
                      </div>
                      {relevantChains.map((chain, idx) => (
                        <div key={idx} style={{ 
                          fontSize: '0.85rem', 
                          color: '#e9d5ff',
                          marginBottom: '0.5rem',
                          paddingLeft: '0.5rem',
                          borderLeft: '2px solid #8b5cf6'
                        }}>
                          <strong>{chain.type}</strong>
                          {chain.turns && ` (Turns ${chain.turns.join(' → ')})`}
                          <br />
                          <span style={{ color: '#c4b5fd' }}>{chain.conclusion}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Constraint History - Enhanced */}
                <div style={{ padding: '1rem', backgroundColor: '#0f172a', borderRadius: '0.5rem', border: '1px solid #334155' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#cbd5e1' }}>
                    📜 Turn-by-Turn History
                  </h3>
                  {constraints.filter(c => c.cards.includes(selectedCard)).length === 0 ? (
                    <p style={{ color: '#64748b' }}>This card hasn't been mentioned in any suggestion yet.</p>
                  ) : (
                    constraints
                      .filter(c => c.cards.includes(selectedCard))
                      .map((constraint, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '1rem',
                            marginBottom: '0.75rem',
                            backgroundColor: '#1e293b',
                            borderRadius: '0.375rem',
                            borderLeft: '3px solid #8b5cf6'
                          }}
                        >
                          <div style={{ fontWeight: '600', color: '#a78bfa', marginBottom: '0.5rem' }}>
                            Turn {constraint.turn} - {constraint.suggester} suggested:
                          </div>
                          <div style={{ fontSize: '0.9rem', color: '#fbbf24', marginBottom: '0.75rem' }}>
                            {constraint.cards.map((card, cidx) => (
                              <span key={card} style={{ 
                                fontWeight: card === selectedCard ? '700' : 'normal',
                                textDecoration: card === selectedCard ? 'underline' : 'none',
                                color: card === selectedCard ? '#60a5fa' : '#fbbf24'
                              }}>
                                {card}{cidx < 2 ? ', ' : ''}
                              </span>
                            ))}
                          </div>
                          <div style={{ fontSize: '0.9rem' }}>
                            {constraint.responses.map((resp, ridx) => (
                              <div
                                key={ridx}
                                style={{
                                  color: resp.action === 'pass' ? '#fca5a5' : '#86efac',
                                  marginBottom: '0.25rem'
                                }}
                              >
                                • <strong>{resp.player}</strong>: {resp.action === 'pass' ? (
                                  <span>Passed <span style={{ color: '#94a3b8' }}>(doesn't have {selectedCard})</span></span>
                                ) : (
                                  resp.shownCard === selectedCard ? (
                                    <span style={{ color: '#22c55e', fontWeight: '700' }}>SHOWED THIS CARD ✓</span>
                                  ) : resp.shownCard ? (
                                    <span>Showed {resp.shownCard} <span style={{ color: '#94a3b8' }}>(not {selectedCard})</span></span>
                                  ) : (
                                    <span>Showed one of the trio <span style={{ color: '#94a3b8' }}>(might be {selectedCard})</span></span>
                                  )
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
