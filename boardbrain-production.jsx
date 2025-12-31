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
  
  // Solution cards (secret envelope) - 3 cards
  const [solutionCards, setSolutionCards] = useState({
    suspect: '',
    weapon: '',
    room: ''
  });
  
  // Host Mode: Track ALL players' actual cards for GLOBAL view
  const [allPlayersCards, setAllPlayersCards] = useState({});
  // Structure: { "Ann": [...cards], "Lisa": [...cards], etc }
  
  // Host Mode Setup: Enable entering all players' cards
  const [hostSetupMode, setHostSetupMode] = useState(false);
  const [hostModeCards, setHostModeCards] = useState({});
  // Structure during setup: { "Ann": [...cards], "Lisa": [...cards], etc }
  
  // Game state
  const [currentTurn, setCurrentTurn] = useState(1);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0); // Whose turn is it
  const [moves, setMoves] = useState([]);
  const [knowledgeMatrix, setKnowledgeMatrix] = useState({});
  const [probabilities, setProbabilities] = useState({});
  const [previousProbabilities, setPreviousProbabilities] = useState({}); // Track changes
  
  // Constraint tracking
  const [constraints, setConstraints] = useState([]); // {turn, suggester, cards, showedBy, observedBy, revealedCard}
  const [suggestionFrequency, setSuggestionFrequency] = useState({}); // Per-player: {playerName: {card: count}}
  const [globalSuggestionCount, setGlobalSuggestionCount] = useState({}); // Global: {card: count} - how many times ANY player suggested
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
  
  // Card reveal popup during move logging
  const [showCardRevealPopup, setShowCardRevealPopup] = useState(false);
  const [pendingMoveData, setPendingMoveData] = useState(null);
  
  // Report visibility
  const [showReport, setShowReport] = useState(false);
  
  // Host Mode (shows all player perspectives + GLOBAL view)
  const [hostMode, setHostMode] = useState(false);
  
  // Multi-player knowledge tracking - each player has their own perspective
  const [playerKnowledge, setPlayerKnowledge] = useState({});
  // Structure: { playerName: { myCards: [], knowledgeMatrix: {}, constraints: [] } }

  // Calculate cards per player and remainder
  const cardsPerPlayer = numPlayers ? Math.floor(18 / numPlayers) : 0;
  const remainderCount = numPlayers ? 18 % numPlayers : 0;

  // Initialize knowledge matrix
  useEffect(() => {
    if (gamePhase === 'playing' && Object.keys(knowledgeMatrix).length === 0) {
      initializeKnowledgeMatrix();
    }
  }, [gamePhase]);
  
  // Initialize player knowledge when allPlayersCards is set (for Host Mode)
  useEffect(() => {
    if (gamePhase === 'playing' && Object.keys(allPlayersCards).length > 0 && Object.keys(playerKnowledge).length === 0) {
      console.log('🔄 Initializing player knowledge from allPlayersCards:', allPlayersCards);
      initializePlayerKnowledge();
    }
  }, [allPlayersCards, gamePhase]);
  
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

  const initializePlayerKnowledge = () => {
    console.log('🔧 Initializing player knowledge...');
    console.log('All Players Cards (HOST VIEW ONLY):', allPlayersCards);
    
    const allPlayerKnowledge = {};
    
    players.forEach((player, playerIdx) => {
      // Initialize each player's knowledge matrix
      const playerMatrix = {};
      
      // CRITICAL: Each player knows ONLY their own cards
      // Do NOT leak allPlayersCards info into their knowledge!
      // Only host sees allPlayersCards in GLOBAL view
      const playerActualCards = allPlayersCards[player.name] || [];
      
      console.log(`  Player ${playerIdx + 1} ${player.name}: ${playerActualCards.length} cards`, playerActualCards);
      
      ALL_CARDS.forEach(card => {
        playerMatrix[card] = {
          solution: '?',
          ...Object.fromEntries(players.map(p => [p.name, '?']))
        };
        
        // Player knows ONLY their own cards
        // Everything else starts as '?'
        if (playerActualCards.includes(card)) {
          playerMatrix[card][player.name] = 'HAS';
          playerMatrix[card].solution = 'NO';
        }
        
        // Everyone knows remainder/public cards
        if (remainderCards.includes(card)) {
          players.forEach(p => playerMatrix[card][p.name] = 'NO');
          playerMatrix[card].solution = 'NO';
        }
        
        // Everyone knows solution cards are in envelope (not with any player)
        const solutionCardsList = [solutionCards.suspect, solutionCards.weapon, solutionCards.room];
        if (solutionCardsList.includes(card)) {
          players.forEach(p => playerMatrix[card][p.name] = 'NO');
          // Solution cards are in envelope - players must deduce them
        }
      });
      
      allPlayerKnowledge[player.name] = {
        myCards: playerActualCards,  // This player's actual cards
        knowledgeMatrix: playerMatrix,  // What they know (starts with only their cards)
        constraints: []  // Constraints they're tracking
      };
    });
    
    console.log('✅ Player knowledge initialized:', allPlayerKnowledge);
    setPlayerKnowledge(allPlayerKnowledge);
    
    // If allPlayersCards wasn't set, set it now with what we know
    if (Object.keys(allPlayersCards).length === 0) {
      const allCards = {};
      players.forEach((player, playerIdx) => {
        allCards[player.name] = playerIdx === myPlayerIndex ? [...myCards] : [];
      });
      setAllPlayersCards(allCards);
    }
  };

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
      
      // First pass: calculate adjusted probabilities
      const adjustedProbs = {};
      
      possibleCards.forEach(card => {
        let baseProb = possibleCards.length > 0 ? (1 / possibleCards.length) : 0;
        
        // CONSTRAINT SATISFACTION: Adjust based on "showed card" constraints
        let adjustedProb = baseProb;
        
        // Count how many constraints involve this card
        const relevantConstraints = currentConstraints.filter(c => 
          c.cards.includes(card) && c.showedBy
        );
        
        // ENHANCED: Check if any player has this card in multiple constraints
        let maxConstraintCount = 0;
        let likelyHolder = null;
        
        players.forEach(player => {
          const playerConstraintsWithCard = relevantConstraints.filter(c => 
            c.showedBy === player.name
          );
          if (playerConstraintsWithCard.length > maxConstraintCount) {
            maxConstraintCount = playerConstraintsWithCard.length;
            likelyHolder = player.name;
          }
        });
        
        if (relevantConstraints.length > 0) {
          // Base reduction: card in constraints = less likely in solution
          let reductionFactor = 1 - (relevantConstraints.length * 0.05);
          
          // ADDITIONAL: If one player has this card in 3+ constraints, very unlikely in solution
          if (maxConstraintCount >= 3) {
            reductionFactor = reductionFactor * 0.3; // Heavy reduction
          } else if (maxConstraintCount >= 2) {
            reductionFactor = reductionFactor * 0.6; // Moderate reduction
          }
          
          adjustedProb = baseProb * Math.max(reductionFactor, 0.1);
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
        
        adjustedProbs[card] = adjustedProb;
      });
      
      // NORMALIZE: Ensure probabilities sum to exactly 100%
      const totalProb = Object.values(adjustedProbs).reduce((sum, p) => sum + p, 0);
      
      if (totalProb > 0) {
        possibleCards.forEach(card => {
          const normalizedProb = (adjustedProbs[card] / totalProb) * 100;
          probs[category][card] = normalizedProb.toFixed(1);
        });
      } else {
        possibleCards.forEach(card => {
          probs[category][card] = '0.0';
        });
      }
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

  // UPDATE ALL PLAYER KNOWLEDGE when a move is logged
  const updateAllPlayerKnowledge = (move, responses, globalMatrix, globalConstraints, revealedCard) => {
    console.log('🔄 UPDATE ALL PLAYER KNOWLEDGE');
    console.log('  Current playerKnowledge:', playerKnowledge);
    console.log('  Move:', move);
    console.log('  Responses:', responses);
    console.log('  Revealed card:', revealedCard);
    
    const newPlayerKnowledge = { ...playerKnowledge };
    const suggestedCards = [move.suggestion.suspect, move.suggestion.weapon, move.suggestion.room];
    
    // Find who showed (if anyone)
    let showedPlayer = null;
    Object.entries(responses).forEach(([playerName, response]) => {
      if (response === 'showed') {
        showedPlayer = playerName;
      }
    });
    
    console.log('  Showed player:', showedPlayer);
    console.log('  Observer (suggester):', move.suggestion.player);
    
    // Update each player's knowledge
    players.forEach((player) => {
      if (!newPlayerKnowledge[player.name]) {
        console.log(`  ⚠️ WARNING: No knowledge for ${player.name}!`);
        return;
      }
      
      console.log(`  Processing ${player.name}...`);
      
      const playerMatrix = { ...newPlayerKnowledge[player.name].knowledgeMatrix };
      const playerConstraints = [...newPlayerKnowledge[player.name].constraints];
      
      const isObserver = (player.name === move.suggestion.player);
      
      // PUBLIC KNOWLEDGE: Process passes (everyone learns these)
      Object.entries(responses).forEach(([responderName, response]) => {
        if (response === 'passed') {
          // This player passed - doesn't have any of the 3 cards
          suggestedCards.forEach(card => {
            if (!playerMatrix[card]) {
              playerMatrix[card] = {
                solution: '?',
                ...Object.fromEntries(players.map(p => [p.name, '?']))
              };
            }
            playerMatrix[card][responderName] = 'NO';
          });
        }
      });
      
      // KNOWLEDGE ABOUT SHOWN CARD
      if (showedPlayer && revealedCard) {
        if (isObserver) {
          // OBSERVER (suggester) saw the actual card
          // No constraint - they know exactly which card
          console.log(`    ${player.name} is OBSERVER - knows ${showedPlayer} showed ${revealedCard}`);
          if (!playerMatrix[revealedCard]) {
            playerMatrix[revealedCard] = {
              solution: '?',
              ...Object.fromEntries(players.map(p => [p.name, '?']))
            };
          }
          playerMatrix[revealedCard][showedPlayer] = 'HAS';
          playerMatrix[revealedCard].solution = 'NO';
          
          // Observer also knows the OTHER cards were NOT shown
          suggestedCards.forEach(card => {
            if (card !== revealedCard) {
              if (!playerMatrix[card]) {
                playerMatrix[card] = {
                  solution: '?',
                  ...Object.fromEntries(players.map(p => [p.name, '?']))
                };
              }
              // Can't deduce NO from this alone - shower might have multiple cards
            }
          });
        } else {
          // THIRD PARTY - doesn't know which card
          // Create constraint (one of the 3 cards)
          console.log(`    ${player.name} is THIRD PARTY - gets constraint`);
          const existingConstraint = playerConstraints.find(c =>
            c.turn === move.turn &&
            c.showedBy === showedPlayer
          );
          
          if (!existingConstraint) {
            playerConstraints.push({
              turn: move.turn,
              suggester: move.suggestion.player,
              cards: suggestedCards,
              showedBy: showedPlayer,
              observedBy: move.suggestion.player, // Observer is the suggester
              revealedCard: null, // Third parties don't know
              timestamp: new Date().toISOString()
            });
          }
        }
      } else if (showedPlayer && !revealedCard) {
        // Everyone knows a constraint was created (old behavior for non-host mode)
        const existingConstraint = playerConstraints.find(c =>
          c.turn === move.turn &&
          c.showedBy === showedPlayer
        );
        
        if (!existingConstraint) {
          playerConstraints.push({
            turn: move.turn,
            suggester: move.suggestion.player,
            cards: suggestedCards,
            showedBy: showedPlayer,
            observedBy: move.suggestion.player,
            revealedCard: null,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // IMMEDIATE RESOLUTION CHECK (for third parties with constraints)
      if (!isObserver && showedPlayer) {
        const possibleCards = suggestedCards.filter(card =>
          playerMatrix[card] && playerMatrix[card][showedPlayer] !== 'NO'
        );
        
        if (possibleCards.length === 1) {
          const deducedCard = possibleCards[0];
          if (!playerMatrix[deducedCard]) {
            playerMatrix[deducedCard] = {
              solution: '?',
              ...Object.fromEntries(players.map(p => [p.name, '?']))
            };
          }
          playerMatrix[deducedCard][showedPlayer] = 'HAS';
          playerMatrix[deducedCard].solution = 'NO';
          
          // Backward eliminate
          suggestedCards.forEach(card => {
            if (card !== deducedCard) {
              if (!playerMatrix[card]) {
                playerMatrix[card] = {
                  solution: '?',
                  ...Object.fromEntries(players.map(p => [p.name, '?']))
                };
              }
              if (playerMatrix[card][showedPlayer] !== 'NO') {
                playerMatrix[card][showedPlayer] = 'NO';
              }
            }
          });
        }
      }
      
      // Apply SIMPLE constraint propagation (one pass)
      playerConstraints.forEach((constraint) => {
        const constraintPlayer = constraint.showedBy;
        const possibleCards = constraint.cards.filter(card =>
          playerMatrix[card] && playerMatrix[card][constraintPlayer] !== 'NO'
        );
        
        if (possibleCards.length === 1) {
          const deducedCard = possibleCards[0];
          if (!playerMatrix[deducedCard]) {
            playerMatrix[deducedCard] = {
              solution: '?',
              ...Object.fromEntries(players.map(p => [p.name, '?']))
            };
          }
          if (playerMatrix[deducedCard][constraintPlayer] !== 'HAS') {
            playerMatrix[deducedCard][constraintPlayer] = 'HAS';
            playerMatrix[deducedCard].solution = 'NO';
            
            // Backward eliminate
            constraint.cards.forEach(card => {
              if (card !== deducedCard) {
                if (!playerMatrix[card]) {
                  playerMatrix[card] = {
                    solution: '?',
                    ...Object.fromEntries(players.map(p => [p.name, '?']))
                  };
                }
                if (playerMatrix[card][constraintPlayer] !== 'NO') {
                  playerMatrix[card][constraintPlayer] = 'NO';
                }
              }
            });
          }
        }
      });
      
      // Update this player's knowledge
      newPlayerKnowledge[player.name].knowledgeMatrix = playerMatrix;
      newPlayerKnowledge[player.name].constraints = playerConstraints;
      
      console.log(`  ${player.name} now has ${playerConstraints.length} constraints`);
    });
    
    console.log('✅ Updated player knowledge:', newPlayerKnowledge);
    setPlayerKnowledge(newPlayerKnowledge);
  };

  const logMove = () => {
    const { suggester, suspect, weapon, room, responses } = moveInput;
    
    if (!suggester || !suspect || !weapon || !room) return;
    
    // Check if someone showed a card
    const showedPlayer = Object.entries(responses).find(([name, resp]) => resp === 'showed')?.[0];
    
    if (showedPlayer && hostMode) {
      // In host mode, ask which card was shown
      setPendingMoveData({
        suggester,
        suspect,
        weapon,
        room,
        responses,
        showedPlayer,
        suggestedCards: [suspect, weapon, room]
      });
      setShowCardRevealPopup(true);
      return; // Don't process move yet - wait for card selection
    }
    
    // No card shown or not in host mode - process normally
    processMove(null);
  };
  
  const processMove = (revealedCard) => {
    const moveData = pendingMoveData || {
      suggester: moveInput.suggester,
      suspect: moveInput.suspect,
      weapon: moveInput.weapon,
      room: moveInput.room,
      responses: moveInput.responses
    };
    
    const { suggester, suspect, weapon, room, responses } = moveData;
    const suggestedCards = [suspect, weapon, room];
    
    // UPDATE SUGGESTION FREQUENCY - PER PLAYER (for detecting when players hold cards)
    const newFrequency = { ...suggestionFrequency };
    if (!newFrequency[suggester]) {
      newFrequency[suggester] = {};
    }
    suggestedCards.forEach(card => {
      newFrequency[suggester][card] = (newFrequency[suggester][card] || 0) + 1;
    });
    setSuggestionFrequency(newFrequency);
    
    // UPDATE GLOBAL SUGGESTION COUNT (how many times ANY player suggested this card)
    const newGlobalCount = { ...globalSuggestionCount };
    suggestedCards.forEach(card => {
      newGlobalCount[card] = (newGlobalCount[card] || 0) + 1;
    });
    setGlobalSuggestionCount(newGlobalCount);
    
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
        // CREATE CONSTRAINT: Player showed one of these 3 cards
        // This is a PUBLIC constraint - everyone knows someone showed
        // But only the suggester knows which specific card (private knowledge)
        newConstraints.push({
          turn: currentTurn,
          suggester: suggester,
          cards: suggestedCards,
          showedBy: player.name,
          observedBy: suggester,  // Who saw the card privately
          revealedCard: null,     // Set when observer uses "Reveal Card"
          timestamp: new Date().toISOString()
        });
        constraintCreated = true;
        
        // IMMEDIATE RESOLUTION CHECK
        // If player is already eliminated from 2 of the 3 cards, they MUST have the 3rd
        const possibleCards = suggestedCards.filter(card => 
          newMatrix[card][player.name] !== 'NO'
        );
        
        if (possibleCards.length === 1) {
          // IMMEDIATE DEDUCTION! Player must have this specific card
          const deducedCard = possibleCards[0];
          newMatrix[deducedCard][player.name] = 'HAS';
          newMatrix[deducedCard].solution = 'NO';
          
          // Also eliminate the other cards from this constraint immediately
          suggestedCards.forEach(card => {
            if (card !== deducedCard && newMatrix[card][player.name] !== 'NO') {
              newMatrix[card][player.name] = 'NO';
            }
          });
          
          // Generate insight
          setRecentInsights(prev => [{
            type: 'immediate_resolution',
            card: deducedCard,
            player: player.name,
            turn: currentTurn,
            message: `${player.name} MUST have ${deducedCard} (only option from Turn ${currentTurn})`
          }, ...prev].slice(0, 8));
        }
      }
    });
    
    // ============================================================================
    // COMPREHENSIVE CONSTRAINT PROPAGATION ENGINE
    // 
    // KEY INSIGHT: PUBLIC vs PRIVATE knowledge
    // - PUBLIC: Everyone knows when someone shows a card (creates constraint)
    // - PRIVATE: Only observer knows WHICH card was shown
    // 
    // INTERSECTION WORKS ON PUBLIC CONSTRAINTS:
    // - Everyone can intersect Player X's constraints
    // - Even if different people observed each constraint
    // - Math works on public information (eliminations + constraints)
    // 
    // Example:
    //   Turn 3: Alice suggests, David shows to Alice (public constraint)
    //   Turn 7: Bob suggests, David shows to Bob (public constraint)
    //   Turn 12: David passes on Rope (public elimination)
    //   Turn 15: David passes on Study (public elimination)
    //   → EVERYONE can deduce David must have Mustard!
    //   → Even though Alice/Bob saw different cards privately
    // ============================================================================
    const propagatedInsights = [];
    let changesOccurred = true;
    let iterationCount = 0;
    const maxIterations = 10; // Prevent infinite loops
    
    // Keep propagating until no more changes (or max iterations)
    while (changesOccurred && iterationCount < maxIterations) {
      changesOccurred = false;
      iterationCount++;
      
      // ========================================================================
      // STEP 1: BASIC CONSTRAINT RESOLUTION
      // Check each constraint - if narrowed to 1 card, resolve it
      // ========================================================================
      newConstraints.forEach((constraint, idx) => {
        const player = constraint.showedBy;
        const possibleCards = constraint.cards.filter(card => 
          newMatrix[card][player] !== 'NO'
        );
        
        if (possibleCards.length === 1 && newMatrix[possibleCards[0]][player] !== 'HAS') {
          // RESOLUTION! Player must have this card
          const deducedCard = possibleCards[0];
          newMatrix[deducedCard][player] = 'HAS';
          newMatrix[deducedCard].solution = 'NO';
          changesOccurred = true;
          
          propagatedInsights.push({
            type: 'constraint_resolution',
            card: deducedCard,
            player: player,
            turn: constraint.turn,
            message: `${player} MUST have ${deducedCard} (resolved from Turn ${constraint.turn})`
          });
          
          // ====================================================================
          // BACKWARD ELIMINATION: Eliminate other cards from this constraint
          // If Bob has Mustard and constraint was {Mustard, Knife, Kitchen}
          // Then Bob doesn't have Knife or Kitchen
          // ====================================================================
          constraint.cards.forEach(card => {
            if (card !== deducedCard && newMatrix[card][player] !== 'NO') {
              newMatrix[card][player] = 'NO';
              changesOccurred = true;
              
              propagatedInsights.push({
                type: 'backward_elimination',
                card: card,
                player: player,
                turn: constraint.turn,
                message: `${player} doesn't have ${card} (showed ${deducedCard} in Turn ${constraint.turn})`
              });
            }
          });
        }
        
        // Also check if player has been confirmed to have one of the constraint cards elsewhere
        const confirmedCards = possibleCards.filter(card => 
          newMatrix[card][player] === 'HAS'
        );
        
        if (confirmedCards.length === 1) {
          // We know player has this card - eliminate others from constraint
          const confirmedCard = confirmedCards[0];
          constraint.cards.forEach(card => {
            if (card !== confirmedCard && newMatrix[card][player] !== 'NO') {
              newMatrix[card][player] = 'NO';
              changesOccurred = true;
              
              propagatedInsights.push({
                type: 'backward_elimination',
                card: card,
                player: player,
                turn: constraint.turn,
                message: `${player} doesn't have ${card} (has ${confirmedCard} from Turn ${constraint.turn})`
              });
            }
          });
        }
      });
      
      // ========================================================================
      // STEP 2: INTERSECTION DETECTION
      // Find cards that appear in ALL constraints for a player
      // ========================================================================
      players.forEach(p => {
        const playerConstraints = newConstraints.filter(c => c.showedBy === p.name);
        
        if (playerConstraints.length >= 2) {
          // Get possible cards for each constraint
          const possibleSets = playerConstraints.map(c => 
            c.cards.filter(card => newMatrix[card][p.name] !== 'NO')
          );
          
          // Find intersection (cards in ALL constraints)
          const intersection = possibleSets.reduce((acc, set) => 
            acc.filter(card => set.includes(card))
          );
          
          if (intersection.length === 1 && newMatrix[intersection[0]][p.name] !== 'HAS') {
            // This player MUST have this card (only one in all constraints)
            const deducedCard = intersection[0];
            newMatrix[deducedCard][p.name] = 'HAS';
            newMatrix[deducedCard].solution = 'NO';
            changesOccurred = true;
            
            propagatedInsights.push({
              type: 'intersection_deduction',
              card: deducedCard,
              player: p.name,
              constraintCount: playerConstraints.length,
              message: `${p.name} MUST have ${deducedCard} (only card in all ${playerConstraints.length} constraints)`
            });
            
            // Eliminate this card from all other constraints for this player
            playerConstraints.forEach(constraint => {
              constraint.cards.forEach(card => {
                if (card !== deducedCard && newMatrix[card][p.name] !== 'NO') {
                  newMatrix[card][p.name] = 'NO';
                  changesOccurred = true;
                }
              });
            });
          }
        }
      });
      
      // ========================================================================
      // STEP 3: PROBABILISTIC CONSTRAINT SCORING
      // If a card appears in 3+ constraints for same player, high probability
      // ========================================================================
      players.forEach(p => {
        const playerConstraints = newConstraints.filter(c => c.showedBy === p.name);
        const cardFrequency = {};
        
        // Count how many constraints each card appears in
        playerConstraints.forEach(constraint => {
          const possibleCards = constraint.cards.filter(card => 
            newMatrix[card][p.name] !== 'NO'
          );
          possibleCards.forEach(card => {
            cardFrequency[card] = (cardFrequency[card] || 0) + 1;
          });
        });
        
        // If card appears in 3+ constraints AND we have 3+ total constraints
        Object.entries(cardFrequency).forEach(([card, count]) => {
          if (count >= 3 && playerConstraints.length >= 3) {
            // Very high probability this player has this card
            // This will be used in probability calculations
            // Note: Not marking as HAS yet (not 100% certain), but flag for high probability
            if (newMatrix[card][p.name] !== 'HAS') {
              propagatedInsights.push({
                type: 'high_probability_pattern',
                card: card,
                player: p.name,
                constraintCount: count,
                totalConstraints: playerConstraints.length,
                message: `${p.name} very likely has ${card} (appears in ${count}/${playerConstraints.length} constraints)`
              });
            }
          }
        });
      });
      
      // ========================================================================
      // STEP 4: SOLUTION ELIMINATION PROPAGATION
      // If card is confirmed NOT in solution, and player has constraint with it
      // Check if that narrows other cards in constraint
      // ========================================================================
      newConstraints.forEach(constraint => {
        const player = constraint.showedBy;
        const possibleCards = constraint.cards.filter(card => 
          newMatrix[card][player] !== 'NO' && 
          newMatrix[card].solution !== 'YES' // Don't include cards confirmed in solution
        );
        
        // Check if any cards in this constraint are in solution
        const inSolutionCards = constraint.cards.filter(card =>
          newMatrix[card].solution === 'YES'
        );
        
        // If a card in the constraint is confirmed in solution, player can't have it
        inSolutionCards.forEach(card => {
          if (newMatrix[card][player] !== 'NO') {
            newMatrix[card][player] = 'NO';
            changesOccurred = true;
          }
        });
      });
    }
    
    // Add all propagated insights to recent insights
    if (propagatedInsights.length > 0) {
      setRecentInsights(prev => [...propagatedInsights, ...prev].slice(0, 8));
    }
    
    const newMove = {
      turn: currentTurn,
      suggester,
      suggestion: { player: suggester, suspect, weapon, room },
      responses,
      location: room,
      revealedCard: revealedCard, // Which card was actually shown (if host specified)
      timestamp: new Date().toISOString(),
      // ENHANCED TRACKING FOR REPORT
      constraintsCreated: newConstraints.filter(c => c.turn === currentTurn),
      insightsGenerated: propagatedInsights,
      gridChanges: [] // Will be populated by comparing matrices
    };
    
    setMoves([...moves, newMove]);
    setConstraints(newConstraints);
    setKnowledgeMatrix(newMatrix);
    calculateProbabilities(newMatrix, newConstraints, newFrequency);
    
    // UPDATE PER-PLAYER KNOWLEDGE (for Host Mode multi-perspective view)
    updateAllPlayerKnowledge(newMove, responses, newMatrix, newConstraints, revealedCard);
    
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
    
    // Clean up popup state
    setPendingMoveData(null);
    setShowCardRevealPopup(false);
  };

  const logCardReveal = () => {
    const { card, player } = revealInput;
    
    if (!card || !player) return;
    
    const newMatrix = { ...knowledgeMatrix };
    const newConstraints = [...constraints];
    
    // Mark the card as HAS
    newMatrix[card][player] = 'HAS';
    newMatrix[card].solution = 'NO';
    
    // LINK TO CONSTRAINT: Find constraint where I observed this player showing
    const myPlayerName = players[myPlayerIndex]?.name;
    const matchingConstraint = newConstraints.find(c => 
      c.showedBy === player && 
      c.observedBy === myPlayerName &&
      c.cards.includes(card) &&
      c.revealedCard === null
    );
    
    if (matchingConstraint) {
      matchingConstraint.revealedCard = card;
      
      // BACKWARD ELIMINATE: Other cards in this constraint
      matchingConstraint.cards.forEach(c => {
        if (c !== card && newMatrix[c][player] !== 'NO') {
          newMatrix[c][player] = 'NO';
        }
      });
    }
    
    const newMove = {
      turn: currentTurn,
      type: 'reveal',
      card,
      player,
      timestamp: new Date().toISOString()
    };
    
    setMoves([...moves, newMove]);
    setConstraints(newConstraints);
    setKnowledgeMatrix(newMatrix);
    calculateProbabilities(newMatrix, newConstraints, suggestionFrequency);
    
    setRevealInput({ card: '', player: '' });
  };
  
  // HELPER: What does current player know about this card-player combo?
  // Returns: 'PUBLIC_HAS' | 'PUBLIC_NO' | 'PRIVATE_HAS' | 'PRIVATE_NO' | 'UNKNOWN'
  const getKnowledgeLevel = (card, player) => {
    const myPlayerName = players[myPlayerIndex]?.name;
    
    // Do I hold this card?
    if (myCards.includes(card)) {
      return 'PRIVATE_HAS';
    }
    
    // Public knowledge from matrix
    const matrixValue = knowledgeMatrix[card]?.[player];
    if (matrixValue === 'HAS') {
      // Check if I observed this privately or it's public
      const privateConstraint = constraints.find(c => 
        c.showedBy === player && 
        c.observedBy === myPlayerName && 
        c.revealedCard === card
      );
      return privateConstraint ? 'PRIVATE_HAS' : 'PUBLIC_HAS';
    }
    if (matrixValue === 'NO') {
      return 'PUBLIC_NO';  // Passes are always public
    }
    
    return 'UNKNOWN';
  };
  
  // HELPER: Get constraint info for card-player combo (for visual display)
  // Returns count of constraints and whether they're getting narrower
  const getConstraintInfo = (card, playerName) => {
    // Find all constraints where this player showed and this card is involved
    const playerConstraints = constraints.filter(c => 
      c.showedBy === playerName && c.cards.includes(card)
    );
    
    if (playerConstraints.length === 0) return null;
    
    // Count how many of these constraints are still unresolved
    const unresolvedCount = playerConstraints.filter(c => !c.revealedCard).length;
    
    // Calculate total possible cards across all constraints
    const totalPossible = playerConstraints.reduce((sum, c) => {
      const possible = c.cards.filter(card => 
        knowledgeMatrix[card]?.[playerName] !== 'NO'
      );
      return sum + possible.length;
    }, 0);
    
    return {
      constraintCount: playerConstraints.length,
      unresolvedCount: unresolvedCount,
      totalPossibleCards: totalPossible,
      averagePossible: totalPossible / playerConstraints.length
    };
  };
  
  // VISUAL GRID: Get cell display state for card-player combination
  const getCellState = (card, playerName) => {
    const myPlayerName = players[myPlayerIndex]?.name;
    
    // PUBLIC/REMAINDER CARD (Green X for all players)
    if (remainderCards.includes(card)) {
      return {
        type: 'PUBLIC',
        color: '#22c55e',
        intensity: 0.5,
        overlay: '✗',
        border: '#22c55e',
        borderWidth: 2,
        tooltip: 'Public card (set aside)'
      };
    }
    
    // MY CARD (Purple) - ONLY in MY column!
    if (myCards.includes(card) && playerName === myPlayerName) {
      return {
        type: 'MY_CARD',
        color: '#8b5cf6',
        intensity: 1.0,
        overlay: '✓',
        border: '#8b5cf6',
        borderWidth: 2,
        tooltip: 'You hold this card'
      };
    }
    
    const matrixValue = knowledgeMatrix[card]?.[playerName];
    
    // CONFIRMED HAS (Blue)
    if (matrixValue === 'HAS') {
      // Check if private knowledge (you observed this)
      const privateConstraint = constraints.find(c => 
        c.showedBy === playerName && 
        c.observedBy === myPlayerName && 
        c.revealedCard === card
      );
      
      return {
        type: 'HAS',
        color: '#3b82f6',
        intensity: 1.0,
        overlay: '✓',
        border: privateConstraint ? '#fbbf24' : '#3b82f6',
        borderWidth: privateConstraint ? 3 : 2,
        tooltip: privateConstraint ? 'You saw this card' : 'Has this card'
      };
    }
    
    // CONFIRMED NO (Green)
    if (matrixValue === 'NO') {
      return {
        type: 'NO',
        color: '#22c55e',
        intensity: 0.5,
        overlay: '✗',
        border: '#22c55e',
        borderWidth: 2,
        tooltip: 'Public card (eliminated)'
      };
    }
    
    // Check for CONSTRAINTS (Orange/Red)
    const playerConstraints = constraints.filter(c => 
      c.showedBy === playerName && 
      c.cards.includes(card) &&
      !c.revealedCard
    );
    
    if (playerConstraints.length > 0) {
      // Calculate how narrow the constraints are
      const totalPossible = playerConstraints.reduce((sum, c) => {
        const possible = c.cards.filter(card => 
          knowledgeMatrix[card]?.[playerName] !== 'NO'
        );
        return sum + possible.length;
      }, 0);
      
      const avgPossible = totalPossible / playerConstraints.length;
      
      // Intensity based on constraint narrowness
      let intensity = 0.4; // Wide (3+ options avg)
      if (avgPossible <= 1.5) intensity = 0.8; // Very narrow (1-2 options)
      else if (avgPossible <= 2.5) intensity = 0.6; // Medium (2-3 options)
      
      return {
        type: 'CONSTRAINT',
        color: '#f97316',
        intensity: intensity,
        overlay: playerConstraints.length === 1 ? '¹' : 
                 playerConstraints.length === 2 ? '²' : 
                 playerConstraints.length >= 3 ? '³⁺' : '?',
        border: '#f97316',
        borderWidth: 2,
        tooltip: `${playerConstraints.length} constraint(s), ~${avgPossible.toFixed(1)} options avg`
      };
    }
    
    // UNKNOWN (Gray)
    return {
      type: 'UNKNOWN',
      color: '#64748b',
      intensity: 0.2,
      overlay: '?',
      border: '#64748b',
      borderWidth: 1,
      tooltip: 'No information'
    };
  };
  
  // HOST MODE: Get cell state from a SPECIFIC player's perspective
  const getCellStateForPlayer = (card, columnPlayerName, viewingPlayerIndex) => {
    const viewingPlayerName = players[viewingPlayerIndex]?.name;
    
    // Get this player's knowledge from playerKnowledge state
    const viewingPlayerData = playerKnowledge[viewingPlayerName];
    
    // DEBUG: Log first card for first player only
    if (card === CLUE_DATA.suspects[0] && viewingPlayerIndex === 0) {
      console.log(`🔍 getCellStateForPlayer(${card}, ${columnPlayerName}, P${viewingPlayerIndex + 1} ${viewingPlayerName})`);
      console.log('  viewingPlayerData:', viewingPlayerData);
      console.log('  All playerKnowledge:', playerKnowledge);
    }
    
    if (!viewingPlayerData) {
      // Fallback to unknown if no data
      if (card === CLUE_DATA.suspects[0] && viewingPlayerIndex === 0) {
        console.log('  ⚠️ NO DATA for this player!');
      }
      return {
        type: 'UNKNOWN',
        color: '#64748b',
        intensity: 0.2,
        overlay: '?',
        border: '#64748b',
        borderWidth: 1,
        tooltip: 'No data'
      };
    }
    
    const viewingPlayerCards = viewingPlayerData.myCards || [];
    const viewingPlayerMatrix = viewingPlayerData.knowledgeMatrix || {};
    const viewingPlayerConstraints = viewingPlayerData.constraints || [];
    
    // PUBLIC/REMAINDER CARD (Green X for all players)
    if (remainderCards.includes(card)) {
      return {
        type: 'PUBLIC',
        color: '#22c55e',
        intensity: 0.5,
        overlay: '✗',
        border: '#22c55e',
        borderWidth: 1.5,
        tooltip: 'Public card'
      };
    }
    
    // VIEWING PLAYER'S CARD (Purple) - ONLY in their column!
    if (viewingPlayerCards.includes(card) && columnPlayerName === viewingPlayerName) {
      return {
        type: 'MY_CARD',
        color: '#8b5cf6',
        intensity: 1.0,
        overlay: '✓',
        border: '#8b5cf6',
        borderWidth: 1.5,
        tooltip: 'They hold this'
      };
    }
    
    const matrixValue = viewingPlayerMatrix[card]?.[columnPlayerName];
    
    // CONFIRMED HAS (Blue)
    if (matrixValue === 'HAS') {
      // Check if viewing player observed this
      const privateConstraint = viewingPlayerConstraints.find(c => 
        c.showedBy === columnPlayerName && 
        c.observedBy === viewingPlayerName && 
        c.revealedCard === card
      );
      
      return {
        type: 'HAS',
        color: '#3b82f6',
        intensity: 1.0,
        overlay: '✓',
        border: privateConstraint ? '#fbbf24' : '#3b82f6',
        borderWidth: privateConstraint ? 2 : 1.5,
        tooltip: privateConstraint ? 'They saw this' : 'Has'
      };
    }
    
    // CONFIRMED NO (Green)
    if (matrixValue === 'NO') {
      return {
        type: 'NO',
        color: '#22c55e',
        intensity: 0.5,
        overlay: '✗',
        border: '#22c55e',
        borderWidth: 1.5,
        tooltip: 'Public'
      };
    }
    
    // Check for CONSTRAINTS (from this player's perspective)
    const playerConstraints = viewingPlayerConstraints.filter(c => 
      c.showedBy === columnPlayerName && 
      c.cards.includes(card) &&
      !c.revealedCard
    );
    
    if (playerConstraints.length > 0) {
      const totalPossible = playerConstraints.reduce((sum, c) => {
        const possible = c.cards.filter(card => 
          viewingPlayerMatrix[card]?.[columnPlayerName] !== 'NO'
        );
        return sum + possible.length;
      }, 0);
      
      const avgPossible = totalPossible / playerConstraints.length;
      
      let intensity = 0.4;
      if (avgPossible <= 1.5) intensity = 0.8;
      else if (avgPossible <= 2.5) intensity = 0.6;
      
      return {
        type: 'CONSTRAINT',
        color: '#f97316',
        intensity: intensity,
        overlay: playerConstraints.length === 1 ? '¹' : 
                 playerConstraints.length === 2 ? '²' : 
                 playerConstraints.length >= 3 ? '³⁺' : '?',
        border: '#f97316',
        borderWidth: 1.5,
        tooltip: `${playerConstraints.length} constraint(s)`
      };
    }
    
    // UNKNOWN (Gray)
    return {
      type: 'UNKNOWN',
      color: '#64748b',
      intensity: 0.2,
      overlay: '?',
      border: '#64748b',
      borderWidth: 1,
      tooltip: 'Unknown'
    };
  };
  
  // GENERATE TURN-BY-TURN ANALYSIS REPORT
  const generateReport = () => {
    const myPlayerName = players[myPlayerIndex]?.name;
    
    return moves.map((move, idx) => {
      const suggestedCards = [move.suggestion.suspect, move.suggestion.weapon, move.suggestion.room];
      
      // Analyze responses
      const passed = [];
      const showed = [];
      
      Object.entries(move.responses).forEach(([playerName, response]) => {
        if (response === 'passed') {
          passed.push(playerName);
        } else if (response === 'showed') {
          showed.push(playerName);
        }
      });
      
      // Find constraints created this turn
      const turnConstraints = move.constraintsCreated || [];
      
      // Find insights generated this turn
      const turnInsights = move.insightsGenerated || [];
      
      // Determine observer (who saw the card)
      const observer = move.suggester;
      const isIObserver = observer === myPlayerName;
      
      return {
        turn: move.turn,
        suggester: move.suggester,
        cards: suggestedCards,
        passed: passed,
        showed: showed,
        observer: observer,
        isIObserver: isIObserver,
        constraints: turnConstraints,
        insights: turnInsights,
        timestamp: move.timestamp
      };
    });
  };
  
  // EXPORT REPORT AS TEXT
  const exportReport = () => {
    const report = generateReport();
    const myPlayerName = players[myPlayerIndex]?.name;
    
    let text = '╔═══════════════════════════════════════════════════════════╗\n';
    text += '║  BOARDBRAIN - TURN-BY-TURN ANALYSIS REPORT               ║\n';
    text += '╚═══════════════════════════════════════════════════════════╝\n\n';
    text += `Game Date: ${new Date().toLocaleDateString()}\n`;
    text += `Playing as: ${myPlayerName} (${myCharacter})\n`;
    text += `Players: ${players.map(p => p.name).join(', ')}\n\n`;
    text += `My Cards: ${myCards.join(', ')}\n`;
    text += `Public Cards: ${remainderCards.join(', ')}\n\n`;
    text += '═══════════════════════════════════════════════════════════\n\n';
    
    report.forEach((turn, idx) => {
      text += `┌${'─'.repeat(59)}┐\n`;
      text += `│ TURN ${turn.turn}${' '.repeat(54 - turn.turn.toString().length)}│\n`;
      text += `├${'─'.repeat(59)}┤\n`;
      text += `│ MOVE:${' '.repeat(54)}│\n`;
      text += `│ → ${turn.suggester} suggests:${' '.repeat(36 - turn.suggester.length)}│\n`;
      text += `│   ${turn.cards.join(', ')}${' '.repeat(56 - turn.cards.join(', ').length)}│\n`;
      text += `│${' '.repeat(60)}│\n`;
      
      text += `│ RESPONSES:${' '.repeat(49)}│\n`;
      turn.passed.forEach(player => {
        text += `│ → ${player}: PASSED${' '.repeat(47 - player.length)}│\n`;
      });
      turn.showed.forEach(player => {
        text += `│ → ${player}: SHOWED${' '.repeat(47 - player.length)}│\n`;
      });
      text += `│${' '.repeat(60)}│\n`;
      
      text += `│ PUBLIC KNOWLEDGE (Everyone Learns):${' '.repeat(24)}│\n`;
      turn.passed.forEach(player => {
        text += `│ ✗ ${player} doesn't have: ${turn.cards.join(', ')}${' '.repeat(34 - player.length - turn.cards.join(', ').length)}│\n`;
      });
      turn.showed.forEach(player => {
        text += `│ ⊕ ${player} has ONE OF: {${turn.cards.join(', ')}}${' '.repeat(29 - player.length - turn.cards.join(', ').length)}│\n`;
      });
      text += `│${' '.repeat(60)}│\n`;
      
      if (turn.showed.length > 0) {
        text += `│ PRIVATE KNOWLEDGE:${' '.repeat(41)}│\n`;
        
        const iShowedCard = turn.showed.includes(myPlayerName);
        
        if (turn.isIObserver) {
          // I was the observer
          text += `│ → You (${turn.observer}) saw which card was shown${' '.repeat(30 - turn.observer.length)}│\n`;
          text += `│   [Use "Reveal Card" to specify]${' '.repeat(27)}│\n`;
        } else if (iShowedCard) {
          // I showed the card
          const showedTo = turn.observer;
          text += `│ → You showed a card to ${showedTo}${' '.repeat(35 - showedTo.length)}│\n`;
          text += `│   [You know which card you showed]${' '.repeat(25)}│\n`;
        } else {
          // Someone else involved
          text += `│ → ${turn.observer} (observer) saw which card${' '.repeat(31 - turn.observer.length)}│\n`;
          text += `│   [Only ${turn.observer} and the player who showed know]${' '.repeat(36 - turn.observer.length)}│\n`;
        }
        text += `│${' '.repeat(60)}│\n`;
      }
      
      if (turn.constraints.length > 0) {
        text += `│ CONSTRAINTS:${' '.repeat(47)}│\n`;
        turn.constraints.forEach((constraint, cIdx) => {
          text += `│ [NEW] Constraint #${constraints.indexOf(constraint) + 1}:${' '.repeat(36 - constraints.indexOf(constraint).toString().length)}│\n`;
          text += `│   ${constraint.showedBy} has ONE OF {${constraint.cards.join(', ')}}${' '.repeat(36 - constraint.showedBy.length - constraint.cards.join(', ').length)}│\n`;
          text += `│   Observed by: ${constraint.observedBy}${' '.repeat(43 - constraint.observedBy.length)}│\n`;
          
          const possibleCards = constraint.cards.filter(card => 
            knowledgeMatrix[card]?.[constraint.showedBy] !== 'NO'
          );
          const status = constraint.revealedCard 
            ? `RESOLVED → ${constraint.showedBy} has ${constraint.revealedCard}` 
            : `UNRESOLVED (${possibleCards.length} options)`;
          text += `│   Status: ${status}${' '.repeat(47 - status.length)}│\n`;
        });
        text += `│${' '.repeat(60)}│\n`;
      }
      
      if (turn.insights.length > 0) {
        text += `│ DEDUCTIONS:${' '.repeat(48)}│\n`;
        turn.insights.forEach(insight => {
          const msg = insight.message || '';
          const lines = msg.match(/.{1,56}/g) || [msg];
          lines.forEach((line, lineIdx) => {
            if (lineIdx === 0) {
              text += `│ → ${line}${' '.repeat(57 - line.length)}│\n`;
            } else {
              text += `│   ${line}${' '.repeat(57 - line.length)}│\n`;
            }
          });
        });
      } else {
        text += `│ DEDUCTIONS:${' '.repeat(48)}│\n`;
        text += `│ → None this turn${' '.repeat(43)}│\n`;
      }
      
      text += `└${'─'.repeat(59)}┘\n\n`;
    });
    
    // Create download
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boardbrain-report-turn${currentTurn - 1}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // HELPER: Get constraint info for card-player combo (for visual display)
  // Returns count of constraints and whether they're getting narrower
  const getConstraintInfo_OLD = (card, playerName) => {
    // Find all constraints where this player showed and this card is involved
    const playerConstraints = constraints.filter(c => 
      c.showedBy === playerName && c.cards.includes(card)
    );
    
    if (playerConstraints.length === 0) return null;
    
    // Count how many of these constraints are still unresolved
    const unresolvedCount = playerConstraints.filter(c => !c.revealedCard).length;
    
    // Calculate total possible cards across all constraints
    const totalPossible = playerConstraints.reduce((sum, c) => {
      const possible = c.cards.filter(card => 
        knowledgeMatrix[card]?.[playerName] !== 'NO'
      );
      return sum + possible.length;
    }, 0);
    
    return {
      constraintCount: playerConstraints.length,
      unresolvedCount: unresolvedCount,
      totalPossibleCards: totalPossible,
      averagePossible: totalPossible / playerConstraints.length
    };
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
                  // Host mode: Go to solution setup first
                  // Single player: Go directly to card setup
                  if (hostSetupMode) {
                    setGamePhase('solutionSetup');
                  } else {
                    setGamePhase('cardSetup');
                  }
                }}
                disabled={!allPlayersNamed || !allCharactersAssigned || myPlayerIndex === null}
                style={{
                  ...styles.button,
                  flex: 2,
                  ...(!allPlayersNamed || !allCharactersAssigned || myPlayerIndex === null ? styles.buttonDisabled : {})
                }}
              >
                Next: {hostSetupMode ? 'Solution Setup' : 'Card Setup'} →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // SOLUTION SETUP SCREEN (Host Mode Only)
  // ============================================================================
  if (gamePhase === 'solutionSetup') {
    const solutionComplete = solutionCards.suspect && solutionCards.weapon && solutionCards.room;
    
    return (
      <div style={styles.container}>
        <div style={{ maxWidth: '60rem', margin: '0 auto' }}>
          <div style={styles.header}>
            <h1 style={styles.title}>BoardBrain™</h1>
            <p style={styles.subtitle}>More Brain. Better Game.</p>
          </div>

          <div style={styles.card}>
            <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem' }}>Host Mode - Step 3: Secret Envelope</h2>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
              Select the 3 cards that will be in the secret envelope (the solution players must deduce).
            </p>
            
            {/* Solution Cards Selection */}
            <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '1.5rem' }}>
              {/* Suspect */}
              <div>
                <label style={styles.label}>Secret Suspect</label>
                <select
                  style={styles.select}
                  value={solutionCards.suspect}
                  onChange={(e) => setSolutionCards({...solutionCards, suspect: e.target.value})}
                >
                  <option value="">Select suspect...</option>
                  {CLUE_DATA.suspects.map(card => (
                    <option key={card} value={card}>{card}</option>
                  ))}
                </select>
              </div>
              
              {/* Weapon */}
              <div>
                <label style={styles.label}>Secret Weapon</label>
                <select
                  style={styles.select}
                  value={solutionCards.weapon}
                  onChange={(e) => setSolutionCards({...solutionCards, weapon: e.target.value})}
                >
                  <option value="">Select weapon...</option>
                  {CLUE_DATA.weapons.map(card => (
                    <option key={card} value={card}>{card}</option>
                  ))}
                </select>
              </div>
              
              {/* Room */}
              <div>
                <label style={styles.label}>Secret Room</label>
                <select
                  style={styles.select}
                  value={solutionCards.room}
                  onChange={(e) => setSolutionCards({...solutionCards, room: e.target.value})}
                >
                  <option value="">Select room...</option>
                  {CLUE_DATA.rooms.map(card => (
                    <option key={card} value={card}>{card}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Summary */}
            {solutionComplete && (
              <div style={{
                padding: '1rem',
                backgroundColor: '#0f172a',
                borderRadius: '0.375rem',
                border: '2px solid #10b981',
                marginBottom: '1.5rem'
              }}>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#10b981', marginBottom: '0.5rem' }}>
                  ✅ Secret Envelope Contains:
                </div>
                <div style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
                  {solutionCards.suspect} • {solutionCards.weapon} • {solutionCards.room}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                  These 3 cards will NOT be distributed to players. Players must deduce them.
                </div>
              </div>
            )}

            {/* Navigation */}
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
                onClick={() => setGamePhase('cardSetup')}
                disabled={!solutionComplete}
                style={{
                  ...styles.button,
                  flex: 2,
                  ...(!solutionComplete && styles.buttonDisabled)
                }}
              >
                Next: Distribute Remaining 18 Cards →
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem' }}>Game Setup - Step 3: Cards</h2>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                  {hostSetupMode ? 
                    'Host Mode: Enter all players\' cards to see complete GLOBAL view' :
                    `Playing as: ${players[myPlayerIndex]?.name} (${myCharacter})`
                  }
                </p>
              </div>
              
              <button
                onClick={() => {
                  setHostSetupMode(!hostSetupMode);
                  if (!hostSetupMode) {
                    // Initialize host mode cards
                    const initCards = {};
                    players.forEach(p => initCards[p.name] = []);
                    setHostModeCards(initCards);
                  }
                }}
                style={{
                  ...styles.button,
                  background: hostSetupMode ? '#10b981' : '#6366f1',
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem'
                }}
              >
                {hostSetupMode ? '🖥️ HOST MODE' : '👤 Single Player'}
              </button>
            </div>
            
            {/* CONDITIONAL: Host Mode vs Single Player Card Selection */}
            {!hostSetupMode ? (
              /* SINGLE PLAYER MODE: Select only your cards */
              <div>
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
            </div>
            ) : (
              /* HOST MODE: Enter ALL players' cards */
              <div style={{ marginBottom: '1.5rem' }}>
                {/* Show solution cards */}
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#0f172a',
                  borderRadius: '0.375rem',
                  border: '2px solid #10b981',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#10b981', marginBottom: '0.5rem' }}>
                    🔒 Secret Envelope (Not Distributed):
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
                    {solutionCards.suspect} • {solutionCards.weapon} • {solutionCards.room}
                  </div>
                </div>
                
                {players.map((player, playerIdx) => {
                  const playerCards = hostModeCards[player.name] || [];
                  // Calculate cards per player from REMAINING 18 cards (21 - 3 solution)
                  const availableCards = 18;
                  const baseCards = Math.floor(availableCards / players.length);
                  const playerCardCount = baseCards;
                  
                  // Get cards excluding solution
                  const solutionCardsList = [solutionCards.suspect, solutionCards.weapon, solutionCards.room];
                  const availableCardsList = ALL_CARDS.filter(c => !solutionCardsList.includes(c));
                  
                  return (
                    <div key={player.name} style={{
                      marginBottom: '1.5rem',
                      padding: '1rem',
                      backgroundColor: '#0f172a',
                      borderRadius: '0.375rem',
                      border: '2px solid #8b5cf6'
                    }}>
                      <h3 style={{ 
                        fontSize: '1rem', 
                        fontWeight: '600',
                        color: '#8b5cf6',
                        marginBottom: '0.75rem'
                      }}>
                        P{playerIdx + 1} {player.name} - Select {playerCardCount} cards
                        {playerCards.length === playerCardCount && ' ✅'}
                      </h3>
                      
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                        Selected: {playerCards.length}/{playerCardCount}
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
                        {availableCardsList.map(card => {
                          const isSelected = playerCards.includes(card);
                          const usedByOther = Object.entries(hostModeCards).some(([name, cards]) => 
                            name !== player.name && cards.includes(card)
                          );
                          const isSolutionCard = solutionCardsList.includes(card);
                          const isDisabled = (isSolutionCard || usedByOther || (!isSelected && playerCards.length >= playerCardCount));
                          
                          return (
                            <label
                              key={card}
                              style={{
                                ...styles.checkboxLabel,
                                color: usedByOther ? '#64748b' : (isDisabled ? '#94a3b8' : '#e2e8f0'),
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                opacity: usedByOther ? 0.5 : 1
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
                                  const newCards = { ...hostModeCards };
                                  if (isSelected) {
                                    newCards[player.name] = playerCards.filter(c => c !== card);
                                  } else {
                                    newCards[player.name] = [...playerCards, card];
                                  }
                                  setHostModeCards(newCards);
                                }}
                              />
                              <span>{card}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                
                {/* Remainder Cards in Host Mode */}
                {remainderCount > 0 && (() => {
                  const allAssignedCards = Object.values(hostModeCards).flat();
                  const solutionCardsList = [solutionCards.suspect, solutionCards.weapon, solutionCards.room];
                  // Remainder = cards not assigned and not in solution
                  const remainderCardsHost = ALL_CARDS.filter(c => 
                    !allAssignedCards.includes(c) && !solutionCardsList.includes(c)
                  );
                  
                  return (
                    <div style={{
                      padding: '1rem',
                      backgroundColor: '#0f172a',
                      borderRadius: '0.375rem',
                      border: '2px solid #fbbf24'
                    }}>
                      <h3 style={{ 
                        fontSize: '1rem', 
                        fontWeight: '600',
                        color: '#fbbf24',
                        marginBottom: '0.75rem'
                      }}>
                        Public/Remainder Cards ({remainderCardsHost.length}/{remainderCount})
                        {remainderCardsHost.length === remainderCount && ' ✅'}
                      </h3>
                      
                      <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                        {remainderCardsHost.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {remainderCardsHost.map(card => (
                              <span key={card} style={{
                                padding: '0.25rem 0.5rem',
                                backgroundColor: '#fbbf24',
                                color: '#0f172a',
                                borderRadius: '0.25rem',
                                fontSize: '0.75rem'
                              }}>
                                {card}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#64748b', fontStyle: 'italic' }}>
                            All cards assigned to players
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
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
                onClick={() => {
                  if (hostSetupMode) {
                    // Host mode: Set all players' cards and remainder
                    const allAssignedCards = Object.values(hostModeCards).flat();
                    const solutionCardsList = [solutionCards.suspect, solutionCards.weapon, solutionCards.room];
                    // Remainder = cards not assigned and not in solution
                    const remainder = ALL_CARDS.filter(c => 
                      !allAssignedCards.includes(c) && !solutionCardsList.includes(c)
                    );
                    
                    setAllPlayersCards(hostModeCards);
                    setMyCards(hostModeCards[players[myPlayerIndex].name] || []);
                    setRemainderCards(remainder);
                    setHostMode(true); // Auto-enable host mode for viewing
                  }
                  setGamePhase('playing');
                }}
                disabled={
                  hostSetupMode ? 
                    (() => {
                      const availableCards = 18; // 21 - 3 solution
                      const allPlayersFilled = players.every((p, idx) => {
                        const expected = Math.floor(availableCards / players.length);
                        return (hostModeCards[p.name] || []).length === expected;
                      });
                      const totalAssigned = Object.values(hostModeCards).flat().length;
                      const expectedTotal = availableCards - remainderCount;
                      return !allPlayersFilled || totalAssigned !== expectedTotal;
                    })() :
                    (myCards.length !== cardsPerPlayer ||
                     (remainderCount > 0 && remainderCards.length !== remainderCount))
                }
                style={{
                  ...styles.button,
                  flex: 2,
                  ...(hostSetupMode ? 
                      (() => {
                        const availableCards = 18; // 21 - 3 solution
                        const allPlayersFilled = players.every((p, idx) => {
                          const expected = Math.floor(availableCards / players.length);
                          return (hostModeCards[p.name] || []).length === expected;
                        });
                        const totalAssigned = Object.values(hostModeCards).flat().length;
                        const expectedTotal = availableCards - remainderCount;
                        return (!allPlayersFilled || totalAssigned !== expectedTotal) && styles.buttonDisabled;
                      })() :
                      ((myCards.length !== cardsPerPlayer ||
                        (remainderCount > 0 && remainderCards.length !== remainderCount)) && styles.buttonDisabled))
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
        <div style={{ maxWidth: hostMode ? '100%' : '90rem', margin: '0 auto', padding: hostMode ? '0.5rem' : '0' }}>
          <div style={{ 
            marginBottom: '1.5rem', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            textAlign: 'left',
            gap: '1rem'
          }}>
            <div style={{ flex: '1' }}>
              <h1 style={{ ...styles.title, fontSize: '2.5rem', textAlign: 'center' }}>BoardBrain™</h1>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center' }}>
                Turn {currentTurn} • {moveInput.suggester ? `${moveInput.suggester}'s Turn` : `${players[currentPlayerIndex]?.name}'s Turn`} • You are Playing as {players[myPlayerIndex]?.name} ({myCharacter})
              </p>
            </div>
            
            {/* Host Mode Toggle */}
            <button
              onClick={() => setHostMode(!hostMode)}
              style={{
                ...styles.button,
                background: hostMode ? '#10b981' : '#6366f1',
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              {hostMode ? '🖥️ HOST MODE' : '👤 Player View'}
            </button>
          </div>

          {/* MY CARDS & PUBLIC CARDS DISPLAY */}
          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            marginBottom: '1.5rem',
            flexWrap: 'wrap'
          }}>
            {/* My Cards */}
            <div style={{
              ...styles.card,
              flex: '1 1 300px',
              padding: '1rem',
              backgroundColor: '#1e293b',
              border: '2px solid #8b5cf6'
            }}>
              <h4 style={{ 
                fontSize: '0.875rem', 
                fontWeight: '600',
                color: '#8b5cf6',
                marginBottom: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                🎴 My Cards ({myCards.length})
              </h4>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '0.5rem' 
              }}>
                {myCards.map(card => (
                  <span key={card} style={{
                    padding: '0.375rem 0.75rem',
                    backgroundColor: '#8b5cf6',
                    color: 'white',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}>
                    {card}
                  </span>
                ))}
              </div>
            </div>

            {/* Public/Remainder Cards */}
            {remainderCards.length > 0 && (
              <div style={{
                ...styles.card,
                flex: '1 1 300px',
                padding: '1rem',
                backgroundColor: '#1e293b',
                border: '2px solid #fbbf24'
              }}>
                <h4 style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: '600',
                  color: '#fbbf24',
                  marginBottom: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  👁️ Public/Remainder Cards ({remainderCards.length})
                </h4>
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '0.5rem' 
                }}>
                  {remainderCards.map(card => (
                    <span key={card} style={{
                      padding: '0.375rem 0.75rem',
                      backgroundColor: '#fbbf24',
                      color: '#0f172a',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      fontWeight: '500'
                    }}>
                      {card}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* CONDITIONAL: HOST MODE vs PLAYER VIEW */}
          {hostMode ? (
            // HOST MODE: Show all player perspectives + GLOBAL view
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* All Player Grids */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: `repeat(${Math.min(players.length, 3)}, 1fr)`,
                gap: '1rem'
              }}>
                {players.map((player, playerIdx) => (
                  <div key={player.name} style={{
                    ...styles.card,
                    padding: '0.75rem',
                    backgroundColor: '#1e293b'
                  }}>
                    {/* Mini Grid Header */}
                    <div style={{
                      textAlign: 'center',
                      marginBottom: '0.5rem',
                      paddingBottom: '0.5rem',
                      borderBottom: '1px solid #334155'
                    }}>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                        Player {playerIdx + 1}
                      </div>
                      <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#e2e8f0' }}>
                        {player.name}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                        ({player.character})
                      </div>
                    </div>

                    {/* Mini Grid */}
                    <div style={{ overflowX: 'auto', fontSize: '0.65rem' }}>
                      {['suspects', 'weapons', 'rooms'].map(category => (
                        <div key={category} style={{ marginBottom: '0.5rem' }}>
                          <div style={{ 
                            color: '#94a3b8', 
                            fontSize: '0.6rem',
                            fontWeight: 'bold',
                            marginBottom: '0.25rem',
                            textTransform: 'uppercase'
                          }}>
                            {category}
                          </div>
                          {CLUE_DATA[category].map(card => (
                            <div key={card} style={{ display: 'flex', marginBottom: '1px' }}>
                              {/* Card name */}
                              <div style={{
                                width: '70px',
                                fontSize: '0.6rem',
                                color: '#cbd5e1',
                                padding: '2px 3px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {card}
                              </div>
                              
                              {/* Cells for each player from THIS player's perspective */}
                              {players.map(p => {
                                const cellState = getCellStateForPlayer(card, p.name, playerIdx);
                                const rgbaColor = `rgba(${parseInt(cellState.color.slice(1,3), 16)}, ${parseInt(cellState.color.slice(3,5), 16)}, ${parseInt(cellState.color.slice(5,7), 16)}, ${cellState.intensity})`;
                                
                                return (
                                  <div
                                    key={p.name}
                                    title={cellState.tooltip}
                                    style={{
                                      width: '22px',
                                      height: '18px',
                                      backgroundColor: rgbaColor,
                                      border: `${cellState.borderWidth}px solid ${cellState.border}`,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.65rem',
                                      fontWeight: '600',
                                      color: '#ffffff',
                                      boxSizing: 'border-box'
                                    }}
                                  >
                                    {cellState.overlay}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* LEGEND - Compact for Host Mode */}
              <div style={{
                ...styles.card,
                padding: '0.75rem',
                backgroundColor: '#1e293b',
                marginBottom: '0.5rem'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-around',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  fontSize: '0.7rem',
                  color: '#cbd5e1'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <div style={{ 
                      width: '16px', 
                      height: '16px', 
                      backgroundColor: '#8b5cf6',
                      border: '1.5px solid #8b5cf6'
                    }}></div>
                    <span>Purple = Their card</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <div style={{ 
                      width: '16px', 
                      height: '16px', 
                      backgroundColor: '#3b82f6',
                      border: '1.5px solid #3b82f6'
                    }}></div>
                    <span>Blue = Has</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <div style={{ 
                      width: '16px', 
                      height: '16px', 
                      backgroundColor: 'rgba(249, 115, 22, 0.6)',
                      border: '1.5px solid #f97316'
                    }}></div>
                    <span>Orange = Constraint</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <div style={{ 
                      width: '16px', 
                      height: '16px', 
                      backgroundColor: 'rgba(34, 197, 94, 0.5)',
                      border: '1.5px solid #22c55e'
                    }}></div>
                    <span>Green = Public</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <div style={{ 
                      width: '16px', 
                      height: '16px', 
                      backgroundColor: 'rgba(100, 116, 139, 0.2)',
                      border: '1px solid #64748b'
                    }}></div>
                    <span>Gray = Unknown</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <div style={{ 
                      width: '16px', 
                      height: '16px', 
                      border: '2px solid #fbbf24'
                    }}></div>
                    <span>Gold = Saw</span>
                  </div>
                </div>
              </div>

              {/* GLOBAL VIEW */}
              <div style={{
                ...styles.card,
                padding: '1rem',
                backgroundColor: '#0f172a',
                border: '3px solid #fbbf24'
              }}>
                <h3 style={{ 
                  fontSize: '1.1rem', 
                  fontWeight: '600',
                  color: '#fbbf24',
                  marginBottom: '1rem',
                  textAlign: 'center'
                }}>
                  🌐 GLOBAL VIEW (Complete Truth)
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  {players.map((player, playerIdx) => {
                    // Get actual cards for this player from allPlayersCards
                    const playerCards = allPlayersCards[player.name] || [];
                    
                    return (
                      <div key={player.name} style={{
                        padding: '0.75rem',
                        backgroundColor: '#1e293b',
                        borderRadius: '0.375rem',
                        border: '2px solid #8b5cf6'
                      }}>
                        <div style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: '600',
                          color: '#8b5cf6',
                          marginBottom: '0.5rem'
                        }}>
                          P{playerIdx + 1} {player.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>
                          {playerCards.length > 0 ? (
                            playerCards.map(card => (
                              <div key={card} style={{ marginBottom: '0.25rem' }}>
                                ✓ {card}
                              </div>
                            ))
                          ) : (
                            <div style={{ color: '#64748b', fontStyle: 'italic' }}>
                              (Set cards in Host Mode setup)
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Public Cards */}
                  {remainderCards.length > 0 && (
                    <div style={{
                      padding: '0.75rem',
                      backgroundColor: '#1e293b',
                      borderRadius: '0.375rem',
                      border: '2px solid #fbbf24'
                    }}>
                      <div style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: '600',
                        color: '#fbbf24',
                        marginBottom: '0.5rem'
                      }}>
                        Public/Set Aside
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>
                        {remainderCards.map(card => (
                          <div key={card} style={{ marginBottom: '0.25rem' }}>
                            ✗ {card}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* HOST MODE: Move History & Card Reveal Panels */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                {/* Move History */}
                <div style={{
                  ...styles.card,
                  padding: '1rem',
                  backgroundColor: '#1e293b',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}>
                  <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: '#e2e8f0' }}>
                    📜 Move History ({moves.length} moves)
                  </h3>
                  {moves.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: '0.75rem', fontStyle: 'italic' }}>
                      No moves yet
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.75rem' }}>
                      {[...moves].reverse().map((move, idx) => {
                        const actualIdx = moves.length - 1 - idx;
                        return (
                          <div key={actualIdx} style={{
                            marginBottom: '0.75rem',
                            padding: '0.5rem',
                            backgroundColor: '#0f172a',
                            borderRadius: '0.25rem',
                            borderLeft: '3px solid #6366f1'
                          }}>
                            <div style={{ color: '#cbd5e1', fontWeight: '600', marginBottom: '0.25rem' }}>
                              Turn {move.turn}: {move.suggestion.player}
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                              {move.suggestion.suspect}, {move.suggestion.weapon}, {move.suggestion.room}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '0.65rem', marginTop: '0.25rem' }}>
                              {Object.entries(move.responses).map(([p, r]) => 
                                `${p}: ${r}`
                              ).join(' • ')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                {/* Card Reveal Event */}
                <div style={{
                  ...styles.card,
                  padding: '1rem',
                  backgroundColor: '#1e293b'
                }}>
                  <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: '#e2e8f0' }}>
                    🎴 Card Reveal Event
                  </h3>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: '#94a3b8', 
                    marginBottom: '1rem',
                    padding: '0.5rem',
                    backgroundColor: '#0f172a',
                    borderRadius: '0.375rem'
                  }}>
                    ℹ️ When a player privately reveals a card to another, record it here to update their knowledge.
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <label style={styles.label}>Card Revealed</label>
                      <select
                        style={styles.select}
                        value={revealInput.card}
                        onChange={(e) => setRevealInput({...revealInput, card: e.target.value})}
                      >
                        <option value="">Select card</option>
                        {ALL_CARDS.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
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
                          <option key={p.name} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <button
                      onClick={logCardReveal}
                      disabled={!revealInput.card || !revealInput.player}
                      style={{
                        ...styles.button,
                        background: '#8b5cf6',
                        ...((!revealInput.card || !revealInput.player) && styles.buttonDisabled)
                      }}
                    >
                      Log Card Reveal
                    </button>
                  </div>
                </div>
              </div>
              
              {/* HOST MODE: Move Input Panel */}
              <div style={{
                ...styles.card,
                padding: '1rem',
                backgroundColor: '#1e293b'
              }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', color: '#e2e8f0' }}>
                  🎮 Queue Move (Updates All Views)
                </h3>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: '#94a3b8', 
                  marginBottom: '1rem',
                  padding: '0.5rem',
                  backgroundColor: '#0f172a',
                  borderRadius: '0.375rem'
                }}>
                  ℹ️ Use this panel to log moves. All player grids above will update to show their individual perspectives.
                </div>
                
                {/* Complete Move Input Form */}
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
                    <div key={`${moveInput.suspect}-${moveInput.weapon}-${moveInput.room}`}>
                      <label style={styles.label}>Player Responses</label>
                      {(() => {
                        const suggesterIndex = players.findIndex(p => p.name === moveInput.suggester);
                        const responseOrder = [
                          ...players.slice(suggesterIndex + 1),
                          ...players.slice(0, suggesterIndex)
                        ];
                        
                        let canRespond = true;
                        
                        return responseOrder.map(p => {
                          const isHost = p.name === players[myPlayerIndex]?.name;
                          const suggestedCards = [moveInput.suspect, moveInput.weapon, moveInput.room].filter(c => c);
                          const hostHasCard = isHost && suggestedCards.length === 3 && suggestedCards.some(card => myCards.includes(card));
                          
                          const playerCanRespond = canRespond;
                          const playerResponse = moveInput.responses[p.name];
                          
                          if (playerResponse === 'showed') {
                            canRespond = false;
                          } else if (playerResponse === 'passed') {
                            canRespond = true;
                          } else if (playerCanRespond) {
                            canRespond = false;
                          }
                          
                          return (
                            <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ 
                                fontSize: '0.75rem', 
                                color: playerCanRespond ? '#cbd5e1' : '#64748b' 
                              }}>
                                {p.name}{isHost ? ' (YOU)' : ''}
                              </span>
                              <select
                                style={{ 
                                  ...styles.select, 
                                  width: 'auto', 
                                  fontSize: '0.75rem', 
                                  padding: '0.25rem',
                                  opacity: playerCanRespond ? 1 : 0.5,
                                  cursor: playerCanRespond ? 'pointer' : 'not-allowed'
                                }}
                                value={moveInput.responses[p.name] || ''}
                                disabled={!playerCanRespond}
                                onChange={(e) => setMoveInput({
                                  ...moveInput,
                                  responses: {...moveInput.responses, [p.name]: e.target.value}
                                })}
                              >
                                <option value="">Select</option>
                                {!hostHasCard && <option value="passed">Passed</option>}
                                <option value="showed">Showed Card</option>
                              </select>
                              {hostHasCard && playerCanRespond && (
                                <span style={{ fontSize: '0.65rem', color: '#fbbf24', marginLeft: '0.5rem' }}>
                                  Must show!
                                </span>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={logMove}
                      disabled={(() => {
                        if (!moveInput.suggester || !moveInput.suspect || !moveInput.weapon || !moveInput.room) {
                          return true;
                        }
                        
                        const suggesterIndex = players.findIndex(p => p.name === moveInput.suggester);
                        const responseOrder = [
                          ...players.slice(suggesterIndex + 1),
                          ...players.slice(0, suggesterIndex)
                        ];
                        
                        let allValid = true;
                        for (const player of responseOrder) {
                          const response = moveInput.responses[player.name];
                          
                          if (response === 'showed') {
                            break;
                          } else if (response === 'passed') {
                            continue;
                          } else {
                            allValid = false;
                            break;
                          }
                        }
                        
                        return !allValid;
                      })()}
                      style={{
                        ...styles.button,
                        flex: 2,
                        background: '#2563eb',
                        opacity: 0.9
                      }}
                    >
                      Log Move
                    </button>
                    
                    <button
                      onClick={() => {
                        const nextPlayer = players[currentPlayerIndex]?.name;
                        const nextPlayerRoom = playerLocations[nextPlayer] || '';
                        setMoveInput({
                          suggester: nextPlayer,
                          suspect: '',
                          weapon: '',
                          room: nextPlayerRoom,
                          responses: {}
                        });
                      }}
                      style={{
                        ...styles.button,
                        flex: 1,
                        background: '#dc2626'
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // PLAYER VIEW: Normal single-player grid
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
                  <div><span style={{ 
                    display: 'inline-block', 
                    width: '16px', 
                    height: '16px', 
                    backgroundColor: '#8b5cf6', 
                    border: '2px solid #8b5cf6',
                    marginRight: '4px',
                    verticalAlign: 'middle'
                  }}></span> Purple = Your cards</div>
                  <div><span style={{ 
                    display: 'inline-block', 
                    width: '16px', 
                    height: '16px', 
                    backgroundColor: '#3b82f6', 
                    border: '2px solid #3b82f6',
                    marginRight: '4px',
                    verticalAlign: 'middle'
                  }}></span> Blue = Has card</div>
                  <div><span style={{ 
                    display: 'inline-block', 
                    width: '16px', 
                    height: '16px', 
                    backgroundColor: 'rgba(249, 115, 22, 0.6)', 
                    border: '2px solid #f97316',
                    marginRight: '4px',
                    verticalAlign: 'middle'
                  }}></span> Orange = Constrained</div>
                  <div><span style={{ 
                    display: 'inline-block', 
                    width: '16px', 
                    height: '16px', 
                    backgroundColor: 'rgba(34, 197, 94, 0.5)', 
                    border: '2px solid #22c55e',
                    marginRight: '4px',
                    verticalAlign: 'middle'
                  }}></span> Green = Public Cards</div>
                  <div><span style={{ 
                    display: 'inline-block', 
                    width: '16px', 
                    height: '16px', 
                    backgroundColor: 'rgba(100, 116, 139, 0.2)', 
                    border: '1px solid #64748b',
                    marginRight: '4px',
                    verticalAlign: 'middle'
                  }}></span> Gray = Unknown</div>
                  <div><span style={{ 
                    display: 'inline-block', 
                    width: '16px', 
                    height: '16px', 
                    border: '3px solid #fbbf24',
                    marginRight: '4px',
                    verticalAlign: 'middle'
                  }}></span> Gold border = You saw</div>
                  <div style={{ gridColumn: '1 / -1', marginTop: '0.25rem', fontSize: '0.75rem' }}>
                    ✓ = Has  •  ✗ = No  •  ? = Unknown  •  ¹²³ = Constraint count
                  </div>
                </div>
              </div>
              
              <div style={{ overflowX: 'auto' }}>
                {/* Visual Grid */}
                <div style={{ 
                  display: 'inline-block',
                  minWidth: '100%'
                }}>
                  {/* Header Row */}
                  <div style={{ display: 'flex', marginBottom: '0px' }}>
                    {/* Card column header */}
                    <div style={{ 
                      width: '120px', 
                      minWidth: '120px',
                      padding: '0.5rem',
                      fontWeight: '600',
                      color: '#cbd5e1'
                    }}>
                      Card
                    </div>
                    
                    {/* Player columns */}
                    {players.map((p, idx) => (
                      <div key={p.name} style={{ 
                        width: '65px',
                        minWidth: '65px',
                        padding: '0.25rem',
                        textAlign: 'center',
                        fontWeight: '600',
                        color: '#cbd5e1'
                      }}>
                        <div style={{ fontSize: '0.9rem' }}>
                          P{idx + 1}
                        </div>
                      </div>
                    ))}
                    
                    {/* Solution column */}
                    <div style={{ 
                      width: '65px',
                      minWidth: '65px',
                      padding: '0.5rem',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#cbd5e1'
                    }}>
                      Solution
                    </div>
                  </div>
                  
                  {/* Card Rows */}
                  {['suspects', 'weapons', 'rooms'].map(category => (
                    <div key={category}>
                      {/* Category Header */}
                      <div style={{ 
                        display: 'flex',
                        backgroundColor: '#1e293b',
                        padding: '0.375rem 0.5rem',
                        marginTop: '0.5rem'
                      }}>
                        <div style={{ 
                          width: '100%',
                          color: '#94a3b8',
                          fontWeight: 'bold',
                          fontSize: '0.8rem',
                          letterSpacing: '0.05em'
                        }}>
                          {category.toUpperCase()}
                        </div>
                      </div>
                      
                      {/* Cards in this category */}
                      {CLUE_DATA[category].map(card => (
                        <div key={card} style={{ display: 'flex' }}>
                          {/* Card name */}
                          <div style={{ 
                            width: '120px',
                            minWidth: '120px',
                            padding: '0.5rem',
                            color: '#e2e8f0',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: '#0f172a'
                          }}>
                            {card}
                          </div>
                          
                          {/* Player cells - ADJACENT with colored borders */}
                          {players.map(p => {
                            const cellState = getCellState(card, p.name);
                            const rgbaColor = `rgba(${parseInt(cellState.color.slice(1,3), 16)}, ${parseInt(cellState.color.slice(3,5), 16)}, ${parseInt(cellState.color.slice(5,7), 16)}, ${cellState.intensity})`;
                            
                            return (
                              <div
                                key={p.name}
                                title={cellState.tooltip}
                                style={{
                                  width: '65px',
                                  minWidth: '65px',
                                  height: '40px',
                                  backgroundColor: rgbaColor,
                                  border: `${cellState.borderWidth}px solid ${cellState.border}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '1.1rem',
                                  fontWeight: '600',
                                  color: '#ffffff',
                                  cursor: 'default',
                                  transition: 'filter 0.2s',
                                  boxSizing: 'border-box'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.2)'}
                                onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                              >
                                {cellState.overlay}
                              </div>
                            );
                          })}
                          
                          {/* Solution cell */}
                          {(() => {
                            const solValue = knowledgeMatrix[card]?.solution;
                            let cellColor, cellOverlay, cellBorder;
                            
                            if (solValue === 'YES') {
                              cellColor = 'rgba(251, 191, 36, 1.0)';
                              cellOverlay = '★';
                              cellBorder = '#fbbf24';
                            } else if (solValue === 'NO') {
                              cellColor = 'rgba(34, 197, 94, 0.5)';
                              cellOverlay = '✗';
                              cellBorder = '#22c55e';
                            } else {
                              cellColor = 'rgba(100, 116, 139, 0.2)';
                              cellOverlay = '?';
                              cellBorder = '#64748b';
                            }
                            
                            return (
                              <div
                                style={{
                                  width: '65px',
                                  minWidth: '65px',
                                  height: '40px',
                                  backgroundColor: cellColor,
                                  border: `2px solid ${cellBorder}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '1.1rem',
                                  fontWeight: '600',
                                  color: '#ffffff',
                                  cursor: 'default',
                                  boxSizing: 'border-box'
                                }}
                              >
                                {cellOverlay}
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
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
                    <div key={`${moveInput.suspect}-${moveInput.weapon}-${moveInput.room}`}>
                      <label style={styles.label}>Player Responses</label>
                      {(() => {
                        // Calculate response order
                        const suggesterIndex = players.findIndex(p => p.name === moveInput.suggester);
                        const responseOrder = [
                          ...players.slice(suggesterIndex + 1),
                          ...players.slice(0, suggesterIndex)
                        ];
                        
                        // Track which players can respond
                        let canRespond = true;
                        
                        return responseOrder.map(p => {
                          // Check if this player is YOU and if you have any of the suggested cards
                          const isHost = p.name === players[myPlayerIndex]?.name;
                          const suggestedCards = [moveInput.suspect, moveInput.weapon, moveInput.room].filter(c => c);
                          const hostHasCard = isHost && suggestedCards.length === 3 && suggestedCards.some(card => myCards.includes(card));
                          
                          // Determine if this player's dropdown should be enabled
                          const playerCanRespond = canRespond;
                          const playerResponse = moveInput.responses[p.name];
                          
                          // Update canRespond for next player
                          if (playerResponse === 'showed') {
                            canRespond = false; // Turn ends, no more responses needed
                          } else if (playerResponse === 'passed') {
                            canRespond = true; // Continue to next player
                          } else if (playerCanRespond) {
                            canRespond = false; // This player needs to respond before others
                          }
                          
                          return (
                            <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ 
                                fontSize: '0.75rem', 
                                color: playerCanRespond ? '#cbd5e1' : '#64748b' 
                              }}>
                                {p.name}{isHost ? ' (YOU)' : ''}
                              </span>
                              <select
                                style={{ 
                                  ...styles.select, 
                                  width: 'auto', 
                                  fontSize: '0.75rem', 
                                  padding: '0.25rem',
                                  opacity: playerCanRespond ? 1 : 0.5,
                                  cursor: playerCanRespond ? 'pointer' : 'not-allowed'
                                }}
                                value={moveInput.responses[p.name] || ''}
                                disabled={!playerCanRespond}
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
                              {hostHasCard && playerCanRespond && (
                                <span style={{ fontSize: '0.65rem', color: '#fbbf24', marginLeft: '0.5rem' }}>
                                  Must show!
                                </span>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={logMove}
                    disabled={(() => {
                      // Check basic fields
                      if (!moveInput.suggester || !moveInput.suspect || !moveInput.weapon || !moveInput.room) {
                        return true;
                      }
                      
                      // Check that players have responded IN ORDER until someone shows
                      const suggesterIndex = players.findIndex(p => p.name === moveInput.suggester);
                      const responseOrder = [
                        ...players.slice(suggesterIndex + 1),
                        ...players.slice(0, suggesterIndex)
                      ];
                      
                      // Go through players in order - stop at first "showed"
                      let allValid = true;
                      for (const player of responseOrder) {
                        const response = moveInput.responses[player.name];
                        
                        if (response === 'showed') {
                          // Someone showed - turn is complete!
                          break;
                        } else if (response === 'passed') {
                          // They passed, continue to next player
                          continue;
                        } else {
                          // No response yet - not valid
                          allValid = false;
                          break;
                        }
                      }
                      
                      return !allValid;
                    })()}
                    style={{
                      ...styles.button,
                      flex: 2,
                      background: (() => {
                        const basicValid = moveInput.suggester && moveInput.suspect && moveInput.weapon && moveInput.room;
                        if (!basicValid) return '#374151';
                        
                        const suggesterIndex = players.findIndex(p => p.name === moveInput.suggester);
                        const responseOrder = [
                          ...players.slice(suggesterIndex + 1),
                          ...players.slice(0, suggesterIndex)
                        ];
                        
                        let allValid = true;
                        for (const player of responseOrder) {
                          const response = moveInput.responses[player.name];
                          if (response === 'showed') break;
                          else if (response === 'passed') continue;
                          else {
                            allValid = false;
                            break;
                          }
                        }
                        
                        return allValid ? '#2563eb' : '#374151';
                      })(),
                      cursor: (() => {
                        const basicValid = moveInput.suggester && moveInput.suspect && moveInput.weapon && moveInput.room;
                        if (!basicValid) return 'not-allowed';
                        
                        const suggesterIndex = players.findIndex(p => p.name === moveInput.suggester);
                        const responseOrder = [
                          ...players.slice(suggesterIndex + 1),
                          ...players.slice(0, suggesterIndex)
                        ];
                        
                        let allValid = true;
                        for (const player of responseOrder) {
                          const response = moveInput.responses[player.name];
                          if (response === 'showed') break;
                          else if (response === 'passed') continue;
                          else {
                            allValid = false;
                            break;
                          }
                        }
                        
                        return allValid ? 'pointer' : 'not-allowed';
                      })(),
                      opacity: (() => {
                        const basicValid = moveInput.suggester && moveInput.suspect && moveInput.weapon && moveInput.room;
                        if (!basicValid) return 0.5;
                        
                        const suggesterIndex = players.findIndex(p => p.name === moveInput.suggester);
                        const responseOrder = [
                          ...players.slice(suggesterIndex + 1),
                          ...players.slice(0, suggesterIndex)
                        ];
                        
                        let allValid = true;
                        for (const player of responseOrder) {
                          const response = moveInput.responses[player.name];
                          if (response === 'showed') break;
                          else if (response === 'passed') continue;
                          else {
                            allValid = false;
                            break;
                          }
                        }
                        
                        return allValid ? 1 : 0.5;
                      })()
                    }}
                  >
                    Log Move
                  </button>
                  
                  <button
                    onClick={() => {
                      const nextPlayer = players[currentPlayerIndex]?.name;
                      const nextPlayerRoom = playerLocations[nextPlayer] || '';
                      setMoveInput({
                        suggester: nextPlayer,
                        suspect: '',
                        weapon: '',
                        room: nextPlayerRoom,
                        responses: {}
                      });
                    }}
                    style={{
                      ...styles.button,
                      flex: 1,
                      background: 'transparent',
                      border: '1px solid #ef4444',
                      color: '#ef4444'
                    }}
                  >
                    Clear
                  </button>
                  </div>
                  
                  {/* Validation Message */}
                  {(() => {
                    const basicValid = moveInput.suggester && moveInput.suspect && moveInput.weapon && moveInput.room;
                    if (!basicValid) {
                      return (
                        <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.5rem' }}>
                          ⚠️ Fill in all fields (suggester, suspect, weapon, room)
                        </p>
                      );
                    }
                    
                    const suggesterIndex = players.findIndex(p => p.name === moveInput.suggester);
                    const responseOrder = [
                      ...players.slice(suggesterIndex + 1),
                      ...players.slice(0, suggesterIndex)
                    ];
                    
                    // Find NEXT player who needs to respond (in order)
                    const unrespondedPlayers = [];
                    for (const player of responseOrder) {
                      const response = moveInput.responses[player.name];
                      
                      if (response === 'showed') {
                        // Someone showed - turn is complete!
                        break;
                      } else if (response === 'passed') {
                        // They passed, continue to next
                        continue;
                      } else {
                        // No response yet - THIS is who we're waiting for
                        unrespondedPlayers.push(player);
                        break;  // Don't check players after this one!
                      }
                    }
                    
                    if (unrespondedPlayers.length > 0) {
                      return (
                        <p style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '0.5rem' }}>
                          ⚠️ Waiting for response from: {unrespondedPlayers[0].name}
                        </p>
                      );
                    }
                    
                    return null;
                  })()}
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

              {/* TURN-BY-TURN ANALYSIS REPORT */}
              {showReport && (
                <div style={{
                  ...styles.card,
                  marginBottom: '1rem',
                  maxHeight: '600px',
                  overflowY: 'auto',
                  backgroundColor: '#0f172a',
                  border: '2px solid #6366f1'
                }}>
                  <div style={{ 
                    position: 'sticky', 
                    top: 0, 
                    backgroundColor: '#0f172a',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid #334155',
                    marginBottom: '1rem',
                    zIndex: 10
                  }}>
                    <h3 style={{ 
                      fontSize: '1.25rem', 
                      fontWeight: '600',
                      color: '#e2e8f0',
                      marginBottom: '0.5rem'
                    }}>
                      📊 Turn-by-Turn Analysis Report
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      Detailed breakdown of every move and deduction
                    </p>
                  </div>

                  {moves.length === 0 ? (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '2rem', 
                      color: '#64748b' 
                    }}>
                      No moves yet. Play some turns to see the analysis!
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {generateReport().map((turn, idx) => (
                        <div 
                          key={idx}
                          style={{
                            backgroundColor: '#1e293b',
                            borderRadius: '0.5rem',
                            padding: '1rem',
                            border: '1px solid #334155'
                          }}
                        >
                          {/* Turn Header */}
                          <div style={{
                            backgroundColor: '#6366f1',
                            color: 'white',
                            padding: '0.5rem 1rem',
                            borderRadius: '0.375rem',
                            marginBottom: '1rem',
                            fontWeight: '600',
                            fontSize: '1rem'
                          }}>
                            TURN {turn.turn}
                          </div>

                          {/* Move Summary */}
                          <div style={{ marginBottom: '1rem' }}>
                            <div style={{ 
                              fontSize: '0.75rem', 
                              color: '#94a3b8', 
                              textTransform: 'uppercase',
                              fontWeight: '600',
                              marginBottom: '0.5rem'
                            }}>
                              Move:
                            </div>
                            <div style={{ color: '#e2e8f0', marginLeft: '1rem' }}>
                              <div style={{ marginBottom: '0.25rem' }}>
                                → <span style={{ color: '#8b5cf6', fontWeight: '600' }}>{turn.suggester}</span> suggests:
                              </div>
                              <div style={{ marginLeft: '1rem', color: '#cbd5e1' }}>
                                {turn.cards.join(', ')}
                              </div>
                            </div>
                          </div>

                          {/* Responses */}
                          <div style={{ marginBottom: '1rem' }}>
                            <div style={{ 
                              fontSize: '0.75rem', 
                              color: '#94a3b8', 
                              textTransform: 'uppercase',
                              fontWeight: '600',
                              marginBottom: '0.5rem'
                            }}>
                              Responses:
                            </div>
                            <div style={{ color: '#e2e8f0', marginLeft: '1rem' }}>
                              {turn.passed.map(player => (
                                <div key={player} style={{ marginBottom: '0.25rem' }}>
                                  → <span style={{ color: '#10b981' }}>{player}</span>: <span style={{ color: '#ef4444' }}>PASSED</span>
                                </div>
                              ))}
                              {turn.showed.map(player => (
                                <div key={player} style={{ marginBottom: '0.25rem' }}>
                                  → <span style={{ color: '#10b981' }}>{player}</span>: <span style={{ color: '#fbbf24' }}>SHOWED</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Public Knowledge */}
                          <div style={{ marginBottom: '1rem' }}>
                            <div style={{ 
                              fontSize: '0.75rem', 
                              color: '#fbbf24', 
                              textTransform: 'uppercase',
                              fontWeight: '600',
                              marginBottom: '0.5rem'
                            }}>
                              👁️ Public Knowledge (Everyone Learns):
                            </div>
                            <div style={{ marginLeft: '1rem' }}>
                              {turn.passed.map(player => (
                                <div key={player} style={{ 
                                  marginBottom: '0.25rem',
                                  fontSize: '0.875rem',
                                  color: '#cbd5e1'
                                }}>
                                  ✗ <span style={{ color: '#10b981' }}>{player}</span> doesn't have: {turn.cards.join(', ')}
                                </div>
                              ))}
                              {turn.showed.map(player => (
                                <div key={player} style={{ 
                                  marginBottom: '0.25rem',
                                  fontSize: '0.875rem',
                                  color: '#cbd5e1'
                                }}>
                                  ⊕ <span style={{ color: '#10b981' }}>{player}</span> has ONE OF: {'{'}{turn.cards.join(', ')}{'}'}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Private Knowledge */}
                          {turn.showed.length > 0 && (() => {
                            const myPlayerName = players[myPlayerIndex]?.name;
                            const iShowedCard = turn.showed.includes(myPlayerName);
                            
                            return (
                              <div style={{ marginBottom: '1rem' }}>
                                <div style={{ 
                                  fontSize: '0.75rem', 
                                  color: '#8b5cf6', 
                                  textTransform: 'uppercase',
                                  fontWeight: '600',
                                  marginBottom: '0.5rem'
                                }}>
                                  🔒 Private Knowledge:
                                </div>
                                <div style={{ marginLeft: '1rem', fontSize: '0.875rem' }}>
                                  {turn.isIObserver ? (
                                    // I was the observer
                                    <div style={{ color: '#8b5cf6' }}>
                                      → You ({turn.observer}) saw which card was shown
                                      <div style={{ marginLeft: '1rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                                        [Use "Reveal Card" to specify]
                                      </div>
                                    </div>
                                  ) : iShowedCard ? (
                                    // I showed the card
                                    <div style={{ color: '#8b5cf6' }}>
                                      → You showed a card to <span style={{ color: '#10b981' }}>{turn.observer}</span>
                                      <div style={{ marginLeft: '1rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                                        [You know which card you showed]
                                      </div>
                                    </div>
                                  ) : (
                                    // Someone else involved
                                    <div style={{ color: '#cbd5e1' }}>
                                      → <span style={{ color: '#10b981' }}>{turn.observer}</span> (observer) saw which card
                                      <div style={{ marginLeft: '1rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                                        [Only {turn.observer} and the player who showed know]
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Constraints */}
                          {turn.constraints.length > 0 && (
                            <div style={{ marginBottom: '1rem' }}>
                              <div style={{ 
                                fontSize: '0.75rem', 
                                color: '#ef4444', 
                                textTransform: 'uppercase',
                                fontWeight: '600',
                                marginBottom: '0.5rem'
                              }}>
                                🔗 Constraints:
                              </div>
                              <div style={{ marginLeft: '1rem' }}>
                                {turn.constraints.map((constraint, cIdx) => {
                                  const possibleCards = constraint.cards.filter(card => 
                                    knowledgeMatrix[card]?.[constraint.showedBy] !== 'NO'
                                  );
                                  const status = constraint.revealedCard 
                                    ? `RESOLVED → ${constraint.showedBy} has ${constraint.revealedCard}` 
                                    : `UNRESOLVED (${possibleCards.length} options)`;
                                  
                                  return (
                                    <div 
                                      key={cIdx}
                                      style={{ 
                                        marginBottom: '0.75rem',
                                        backgroundColor: '#0f172a',
                                        padding: '0.75rem',
                                        borderRadius: '0.25rem',
                                        border: '1px solid #334155'
                                      }}
                                    >
                                      <div style={{ 
                                        color: '#fbbf24', 
                                        fontWeight: '600',
                                        marginBottom: '0.5rem',
                                        fontSize: '0.875rem'
                                      }}>
                                        [NEW] Constraint #{constraints.indexOf(constraint) + 1}
                                      </div>
                                      <div style={{ fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
                                        <span style={{ color: '#10b981' }}>{constraint.showedBy}</span> has ONE OF {'{'}{constraint.cards.join(', ')}{'}'}
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                                        Observed by: <span style={{ color: '#8b5cf6' }}>{constraint.observedBy}</span>
                                      </div>
                                      <div style={{ 
                                        fontSize: '0.75rem', 
                                        color: constraint.revealedCard ? '#10b981' : '#fbbf24',
                                        fontWeight: '600'
                                      }}>
                                        Status: {status}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Deductions */}
                          <div>
                            <div style={{ 
                              fontSize: '0.75rem', 
                              color: '#10b981', 
                              textTransform: 'uppercase',
                              fontWeight: '600',
                              marginBottom: '0.5rem'
                            }}>
                              🎯 Deductions:
                            </div>
                            <div style={{ marginLeft: '1rem' }}>
                              {turn.insights.length > 0 ? (
                                turn.insights.map((insight, iIdx) => (
                                  <div 
                                    key={iIdx}
                                    style={{ 
                                      marginBottom: '0.5rem',
                                      padding: '0.5rem',
                                      backgroundColor: insight.type === 'constraint_resolution' ? '#064e3b' :
                                                      insight.type === 'intersection_deduction' ? '#7c2d12' :
                                                      insight.type === 'backward_elimination' ? '#1e3a8a' :
                                                      '#0f172a',
                                      borderRadius: '0.25rem',
                                      fontSize: '0.875rem',
                                      color: '#e2e8f0',
                                      border: '1px solid #334155'
                                    }}
                                  >
                                    → {insight.message}
                                  </div>
                                ))
                              ) : (
                                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                                  → None this turn
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Report Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button
                  onClick={() => setShowReport(!showReport)}
                  style={{
                    ...styles.button,
                    flex: 1,
                    background: showReport ? '#8b5cf6' : '#6366f1',
                    border: 'none'
                  }}
                >
                  {showReport ? '📊 Hide Report' : '📊 View Report'}
                </button>
                <button
                  onClick={exportReport}
                  disabled={moves.length === 0}
                  style={{
                    ...styles.button,
                    flex: 1,
                    background: moves.length === 0 ? '#374151' : '#10b981',
                    border: 'none',
                    cursor: moves.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: moves.length === 0 ? 0.5 : 1
                  }}
                >
                  💾 Export Report
                </button>
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
          )}
          {/* END CONDITIONAL: HOST MODE vs PLAYER VIEW */}
        </div>
        
        {/* CARD REVEAL POPUP */}
        {showCardRevealPopup && pendingMoveData && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              ...styles.card,
              maxWidth: '32rem',
              padding: '2rem',
              margin: '1rem'
            }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#e2e8f0' }}>
                🎴 Which Card Was Shown?
              </h2>
              
              <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
                <strong>{pendingMoveData.showedPlayer}</strong> showed a card to <strong>{pendingMoveData.suggester}</strong>.
                <br />
                Which card did they show?
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {pendingMoveData.suggestedCards.map(card => (
                  <button
                    key={card}
                    onClick={() => {
                      processMove(card);
                    }}
                    style={{
                      ...styles.button,
                      background: '#8b5cf6',
                      padding: '1rem',
                      fontSize: '1rem',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>
                      {card.includes('Professor') || card.includes('Colonel') || card.includes('Miss') || card.includes('Mrs') ? '👤' :
                       card.includes('Knife') || card.includes('Rope') || card.includes('Lead') || card.includes('Wrench') || card.includes('Candlestick') || card.includes('Revolver') ? '🔪' : '🏠'}
                    </span>
                    <span>{card}</span>
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => {
                  setShowCardRevealPopup(false);
                  setPendingMoveData(null);
                }}
                style={{
                  ...styles.button,
                  background: 'transparent',
                  border: '1px solid #475569',
                  width: '100%'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
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
              setGlobalSuggestionCount({});
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
