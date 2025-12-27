import React, { useState, useEffect } from 'react';

/**
 * BoardBrain™ - Clue Deduction Assistant
 * Copyright © 2024 Pat Boulay. All Rights Reserved.
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
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0); // Whose turn is it
  const [moves, setMoves] = useState([]);
  const [knowledgeMatrix, setKnowledgeMatrix] = useState({});
  const [probabilities, setProbabilities] = useState({});
  const [previousProbabilities, setPreviousProbabilities] = useState({}); // Track changes
  
  // Constraint tracking
  const [constraints, setConstraints] = useState([]); // {turn, player, cards: [3 cards], showedBy}
  const [suggestionFrequency, setSuggestionFrequency] = useState({}); // Track how often each player suggests each card
  const [playerLocations, setPlayerLocations] = useState({}); // {playerName: roomName}
  const [recentInsights, setRecentInsights] = useState([]); // Deduction explanations
  
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
  
  // Initialize first player when game starts
  useEffect(() => {
    if (gamePhase === 'playing' && moveInput.suggester === '' && players.length > 0) {
      setMoveInput({
        suggester: players[0].name,
        suspect: '',
        weapon: '',
        room: '',
        responses: {}
      });
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

  const calculateProbabilities = (matrix, currentConstraints = constraints, suggestionFreq = suggestionFrequency) => {
    const probs = {
      suspects: {},
      weapons: {},
      rooms: {}
    };
    
    const insights = [];
    
    // Calculate base probabilities for each category
    ['suspects', 'weapons', 'rooms'].forEach(category => {
      const cards = CLUE_DATA[category];
      const possibleCards = cards.filter(card => matrix[card]?.solution !== 'NO');
      
      possibleCards.forEach(card => {
        let baseProb = possibleCards.length > 0 ? (1 / possibleCards.length) : 0;
        
        // CONSTRAINT SATISFACTION: Adjust based on "showed card" constraints
        let adjustedProb = baseProb;
        
        // Count how many constraints involve this card
        const relevantConstraints = currentConstraints.filter(c => 
          c.cards.includes(card) && c.showedBy
        );
        
        if (relevantConstraints.length > 0) {
          // Card was in suggestions where someone showed a card
          // This slightly reduces probability it's in solution
          const reductionFactor = 1 - (relevantConstraints.length * 0.05);
          adjustedProb = baseProb * Math.max(reductionFactor, 0.3);
        }
        
        // FREQUENCY DETECTION: Check if players repeatedly suggest this card
        let maxFrequency = 0;
        let frequentPlayer = null;
        
        players.forEach(player => {
          const freq = suggestionFreq[player.name]?.[card] || 0;
          if (freq > maxFrequency) {
            maxFrequency = freq;
            frequentPlayer = player.name;
          }
        });
        
        // If a player suggests a card 3+ times, they likely have it
        if (maxFrequency >= 3) {
          // Reduce solution probability significantly
          adjustedProb = adjustedProb * 0.2;
          
          // Generate insight
          const confidence = Math.min(maxFrequency * 20, 95);
          if (maxFrequency >= 3) {
            insights.push({
              type: 'frequency',
              card: card,
              player: frequentPlayer,
              frequency: maxFrequency,
              confidence: confidence,
              message: `${frequentPlayer} likely holds ${card} (suggested ${maxFrequency}x, ${confidence}% confidence)`
            });
          }
        }
        
        probs[category][card] = (adjustedProb * 100).toFixed(1);
      });
    });
    
    // Detect probability changes and generate insights
    if (Object.keys(previousProbabilities).length > 0) {
      ['suspects', 'weapons', 'rooms'].forEach(category => {
        Object.keys(probs[category] || {}).forEach(card => {
          const oldProb = parseFloat(previousProbabilities[category]?.[card] || 0);
          const newProb = parseFloat(probs[category][card]);
          const change = newProb - oldProb;
          
          // Significant change (>15% shift)
          if (Math.abs(change) > 15) {
            insights.push({
              type: 'probability_shift',
              card: card,
              oldProb: oldProb.toFixed(1),
              newProb: newProb.toFixed(1),
              change: change.toFixed(1),
              message: `${card}: ${oldProb.toFixed(0)}% → ${newProb.toFixed(0)}% (${change > 0 ? '+' : ''}${change.toFixed(0)}%)`
            });
          }
        });
      });
    }
    
    setPreviousProbabilities(probs);
    setProbabilities(probs);
    
    // Keep only recent insights (last 5)
    if (insights.length > 0) {
      setRecentInsights(prev => [...insights, ...prev].slice(0, 5));
    }
  };

  const startPlaying = () => {
    if (myCards.length === cardsPerPlayer && remainderCards.length === remainderCount && myCharacter) {
      setGamePhase('playing');
    }
  };

  const logMove = () => {
    const { suggester, suspect, weapon, room, responses } = moveInput;
    
    if (!suggester || !suspect || !weapon || !room) return;
    
    const suggestedCards = [suspect, weapon, room];
    
    // UPDATE SUGGESTION FREQUENCY (for detecting when players hold cards)
    const newFrequency = { ...suggestionFrequency };
    if (!newFrequency[suggester]) {
      newFrequency[suggester] = {};
    }
    suggestedCards.forEach(card => {
      newFrequency[suggester][card] = (newFrequency[suggester][card] || 0) + 1;
    });
    setSuggestionFrequency(newFrequency);
    
    // UPDATE PLAYER LOCATION (suggester moved to this room)
    const newLocations = { ...playerLocations };
    newLocations[suggester] = room;
    setPlayerLocations(newLocations);
    
    // Process responses and update knowledge matrix
    const newMatrix = { ...knowledgeMatrix };
    const newConstraints = [...constraints];
    
    // Find suggester index for response order
    const suggesterIndex = players.findIndex(p => p.name === suggester);
    
    // Create response order (players clockwise from suggester)
    const responseOrder = [
      ...players.slice(suggesterIndex + 1),
      ...players.slice(0, suggesterIndex)
    ];
    
    let constraintCreated = false;
    
    responseOrder.forEach(player => {
      const response = responses[player.name];
      
      if (response === 'passed') {
        // Player doesn't have any of the three cards
        suggestedCards.forEach(card => {
          newMatrix[card][player.name] = 'NO';
        });
      } else if (response === 'showed' && !constraintCreated) {
        // CREATE CONSTRAINT: Player showed one of these 3 cards (but we don't know which)
        newConstraints.push({
          turn: currentTurn,
          suggester: suggester,
          cards: suggestedCards,
          showedBy: player.name,
          timestamp: new Date().toISOString()
        });
        constraintCreated = true;
        
        // CONSTRAINT PROPAGATION: Try to deduce which card was shown
        // If player is eliminated from 2 of the 3 cards, they MUST have the 3rd
        const possibleCards = suggestedCards.filter(card => 
          newMatrix[card][player.name] !== 'NO'
        );
        
        if (possibleCards.length === 1) {
          // DEDUCTION! Player must have this specific card
          const deducedCard = possibleCards[0];
          newMatrix[deducedCard][player.name] = 'HAS';
          newMatrix[deducedCard].solution = 'NO';
          
          // Generate insight
          setRecentInsights(prev => [{
            type: 'constraint_resolution',
            card: deducedCard,
            player: player.name,
            turn: currentTurn,
            message: `${player.name} MUST have ${deducedCard} (only option from Turn ${currentTurn} suggestion)`
          }, ...prev].slice(0, 5));
        }
      }
    });
    
    // PROPAGATE CONSTRAINTS: Re-check all previous constraints with new knowledge
    newConstraints.forEach(constraint => {
      const player = constraint.showedBy;
      const possibleCards = constraint.cards.filter(card => 
        newMatrix[card][player] !== 'NO'
      );
      
      if (possibleCards.length === 1 && newMatrix[possibleCards[0]][player] !== 'HAS') {
        // CASCADING DEDUCTION! 
        const deducedCard = possibleCards[0];
        newMatrix[deducedCard][player] = 'HAS';
        newMatrix[deducedCard].solution = 'NO';
        
        setRecentInsights(prev => [{
          type: 'cascading_deduction',
          card: deducedCard,
          player: player,
          originalTurn: constraint.turn,
          currentTurn: currentTurn,
          message: `${player} MUST have ${deducedCard} (constraint from Turn ${constraint.turn} now resolved)`
        }, ...prev].slice(0, 5));
      }
    });
    
    const newMove = {
      turn: currentTurn,
      suggester,
      suggestion: { suspect, weapon, room },
      responses,
      location: room,
      timestamp: new Date().toISOString()
    };
    
    setMoves([...moves, newMove]);
    setConstraints(newConstraints);
    setKnowledgeMatrix(newMatrix);
    calculateProbabilities(newMatrix, newConstraints, newFrequency);
    setCurrentTurn(currentTurn + 1);
    
    // ADVANCE TO NEXT PLAYER'S TURN
    const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
    setCurrentPlayerIndex(nextPlayerIndex);
    
    // Reset move input BUT pre-fill next player and their location
    const nextPlayer = players[nextPlayerIndex].name;
    const nextPlayerRoom = newLocations[nextPlayer] || '';
    
    setMoveInput({
      suggester: nextPlayer,
      suspect: '',
      weapon: '',
      room: nextPlayerRoom, // Auto-fill room from last known location
      responses: {}
    });
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
      fontSize: '1.5rem', // DOUBLED from 0.75rem
      borderCollapse: 'collapse'
    },
    th: {
      padding: '0.25rem', // TIGHTER from 0.5rem
      borderBottom: '1px solid #334155',
      color: '#cbd5e1',
      fontSize: '1.5rem', // DOUBLED
      fontWeight: 'bold'
    },
    td: {
      padding: '0.25rem', // TIGHTER from 0.5rem
      borderBottom: '1px solid #1e293b',
      textAlign: 'center',
      fontSize: '1.5rem' // DOUBLED
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
    
    // Auto-set host to last player if not yet set
    if (myPlayerIndex === null && players.length > 0) {
      setMyPlayerIndex(players.length - 1);
    }
    
    return (
      <div style={styles.container}>
        <div style={{ maxWidth: '60rem', margin: '0 auto' }}>
          <div style={styles.header}>
            <h1 style={styles.title}>BoardBrain™</h1>
            <p style={styles.subtitle}>More Brain. Better Game.</p>
          </div>

          <div style={styles.card}>
            <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem' }}>Game Setup - Step 2: Players</h2>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
              Enter each player's name and assign their character. You (host) are automatically the last player.
            </p>
            
            <div style={{ marginBottom: '1.5rem' }}>
              {players.map((player, idx) => {
                const isLastPlayer = idx === players.length - 1;
                const isHost = myPlayerIndex === idx;
                
                return (
                  <div key={idx} style={{ 
                    marginBottom: '1.5rem',
                    padding: '1rem',
                    backgroundColor: '#0f172a',
                    borderRadius: '0.375rem',
                    border: isHost ? '2px solid #3b82f6' : '1px solid #334155'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ 
                          fontSize: '1rem', 
                          fontWeight: 'bold', 
                          color: isHost ? '#60a5fa' : '#cbd5e1' 
                        }}>
                          Player {idx + 1}
                        </span>
                        {isLastPlayer && (
                          <span style={{ 
                            fontSize: '0.75rem', 
                            color: '#fbbf24',
                            backgroundColor: '#1e293b',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem'
                          }}>
                            YOU (Host)
                          </span>
                        )}
                      </div>
                      {!isLastPlayer && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="radio"
                            name="myPlayer"
                            checked={isHost}
                            onChange={() => setMyPlayerIndex(idx)}
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {isHost ? '← This is you' : 'Make this you'}
                          </span>
                        </div>
                      )}
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
              );
              })}
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
              Turn {currentTurn} • {players[currentPlayerIndex]?.name}'s Turn • Playing as {players[myPlayerIndex]?.name} ({myCharacter})
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
            {/* Deduction Grid */}
            <div style={styles.card}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Deduction Grid</h3>
              
              {/* Legend */}
              <div style={{ 
                marginBottom: '1rem', 
                padding: '0.75rem', 
                backgroundColor: '#0f172a', 
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#cbd5e1' }}>Legend:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', color: '#94a3b8' }}>
                  <div><span style={{ color: '#4ade80' }}>✓</span> = Has card</div>
                  <div><span style={{ color: '#f87171' }}>✗</span> = Doesn't have</div>
                  <div><span style={{ color: '#fbbf24' }}>⊕</span> = Likely holds (3+ suggestions)</div>
                  <div><span style={{ color: '#64748b' }}>?</span> = Unknown</div>
                  <div><span style={{ color: '#fbbf24' }}>★</span> = In solution</div>
                  <div><span style={{ fontSize: '0.75rem' }}>²</span> = Suggestion count</div>
                  <div><span style={{ color: '#4ade80' }}>80%+</span> = Very likely</div>
                  <div><span style={{ color: '#fbbf24' }}>50-79%</span> = Moderate</div>
                  <div><span style={{ color: '#fb923c' }}>20-49%</span> = Lower</div>
                  <div>↑↓ = Recent change</div>
                </div>
              </div>
              
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, textAlign: 'left' }}>Card</th>
                      {players.map((p, idx) => (
                        <th key={p.name} style={styles.th} title={`${p.name} (${p.character})`}>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.15rem' }}>
                            P{idx + 1}
                          </div>
                          <div>
                            {p.name.split(' ')[0]}
                          </div>
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
                            {players.map(p => {
                              const freq = suggestionFrequency[p.name]?.[card] || 0;
                              const likelyHolds = freq >= 3;
                              
                              return (
                                <td key={p.name} style={styles.td}>
                                  <span style={{
                                    color: knowledgeMatrix[card]?.[p.name] === 'HAS' ? '#4ade80' :
                                           knowledgeMatrix[card]?.[p.name] === 'NO' ? '#f87171' : 
                                           likelyHolds ? '#fbbf24' : '#64748b'
                                  }}>
                                    {knowledgeMatrix[card]?.[p.name] === 'HAS' ? '✓' :
                                     knowledgeMatrix[card]?.[p.name] === 'NO' ? '✗' :
                                     likelyHolds ? '⊕' : '?'}
                                  </span>
                                  {freq > 0 && (
                                    <span style={{ fontSize: '0.65rem', color: '#64748b', marginLeft: '2px' }}>
                                      {freq}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                            <td style={styles.td}>
                              <span style={{
                                color: knowledgeMatrix[card]?.solution === 'YES' ? '#fbbf24' :
                                       knowledgeMatrix[card]?.solution === 'NO' ? '#f87171' : '#64748b'
                              }}>
                                {knowledgeMatrix[card]?.solution === 'YES' ? '★' :
                                 knowledgeMatrix[card]?.solution === 'NO' ? '✗' : '?'}
                              </span>
                            </td>
                            <td style={styles.td}>
                              {(() => {
                                const prob = parseFloat(probabilities[category]?.[card] || 0);
                                const prevProb = parseFloat(previousProbabilities[category]?.[card] || prob);
                                const change = prob - prevProb;
                                
                                // Color based on probability (high = green, med = yellow, low = gray)
                                let color = '#64748b'; // Default gray
                                if (prob >= 80) color = '#4ade80'; // Bright green - very likely solution
                                else if (prob >= 50) color = '#fbbf24'; // Yellow - moderate
                                else if (prob >= 20) color = '#fb923c'; // Orange - lower
                                
                                // Arrow indicator for significant changes
                                let arrow = '';
                                if (Math.abs(change) > 10) {
                                  arrow = change > 0 ? ' ↑' : ' ↓';
                                }
                                
                                return (
                                  <span style={{ 
                                    color: color,
                                    fontWeight: prob >= 70 ? 'bold' : 'normal'
                                  }}>
                                    {prob.toFixed(0)}%{arrow}
                                  </span>
                                );
                              })()}
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
              {/* Recent Insights Panel */}
              {recentInsights.length > 0 && (
                <div style={styles.card}>
                  <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>💡 Recent Insights</h3>
                  <div style={{ 
                    maxHeight: '250px', 
                    overflowY: 'auto',
                    fontSize: '0.875rem'
                  }}>
                    {recentInsights.map((insight, idx) => (
                      <div 
                        key={idx}
                        style={{
                          padding: '0.75rem',
                          marginBottom: '0.5rem',
                          backgroundColor: '#0f172a',
                          borderRadius: '0.375rem',
                          borderLeft: insight.type === 'frequency' ? '3px solid #fbbf24' : 
                                     insight.type === 'probability_shift' ? '3px solid #60a5fa' :
                                     '3px solid #4ade80'
                        }}
                      >
                        <div style={{ color: '#cbd5e1', fontWeight: '500' }}>
                          {insight.message}
                        </div>
                        {insight.type === 'frequency' && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                            Strategy: {insight.player} likely using {insight.card} as "blocker" in suggestions
                          </div>
                        )}
                        {(insight.type === 'constraint_resolution' || insight.type === 'cascading_deduction') && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                            Deduced from constraint propagation
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
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
                      {players.filter(p => p.name !== moveInput.suggester).map(p => {
                        // Check if this player is YOU and if you have any of the suggested cards
                        const isHost = p.name === players[myPlayerIndex]?.name;
                        const suggestedCards = [moveInput.suspect, moveInput.weapon, moveInput.room].filter(c => c);
                        const hostHasCard = isHost && suggestedCards.some(card => myCards.includes(card));
                        
                        return (
                          <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                              {p.name}{isHost ? ' (YOU)' : ''}
                            </span>
                            <select
                              style={{ ...styles.select, width: 'auto', fontSize: '0.75rem', padding: '0.25rem' }}
                              value={moveInput.responses[p.name] || ''}
                              onChange={(e) => setMoveInput({
                                ...moveInput,
                                responses: {...moveInput.responses, [p.name]: e.target.value}
                              })}
                            >
                              <option value="">Select</option>
                              {/* Only show "Passed" if host doesn't have the card */}
                              {!hostHasCard && <option value="passed">Passed</option>}
                              <option value="showed">Showed Card</option>
                            </select>
                            {hostHasCard && (
                              <span style={{ fontSize: '0.65rem', color: '#fbbf24', marginLeft: '0.5rem' }}>
                                Must show!
                              </span>
                            )}
                          </div>
                        );
                      })}
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
              setCurrentPlayerIndex(0);
              setMoves([]);
              setKnowledgeMatrix({});
              setProbabilities({});
              setPreviousProbabilities({});
              setConstraints([]);
              setSuggestionFrequency({});
              setPlayerLocations({});
              setRecentInsights([]);
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
