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
  
  // Report visibility
  const [showReport, setShowReport] = useState(false);

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

  const logMove = () => {
    const { suggester, suspect, weapon, room, responses } = moveInput;
    
    if (!suggester || !suspect || !weapon || !room) return;
    
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
      suggestion: { suspect, weapon, room },
      responses,
      location: room,
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
        if (turn.isIObserver) {
          text += `│ → You (${turn.observer}) saw which card was shown${' '.repeat(30 - turn.observer.length)}│\n`;
          text += `│   [Use "Reveal Card" to specify]${' '.repeat(27)}│\n`;
        } else {
          text += `│ → ${turn.observer} (observer) saw which card${' '.repeat(31 - turn.observer.length)}│\n`;
          text += `│   [You don't know which card]${' '.repeat(30)}│\n`;
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
              Turn {currentTurn} • {moveInput.suggester ? `${moveInput.suggester}'s Turn` : `${players[currentPlayerIndex]?.name}'s Turn`} • You are Playing as {players[myPlayerIndex]?.name} ({myCharacter})
            </p>
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
                    <div key={`${moveInput.suspect}-${moveInput.weapon}-${moveInput.room}`}>
                      <label style={styles.label}>Player Responses</label>
                      {players.filter(p => p.name !== moveInput.suggester).map(p => {
                        // Check if this player is YOU and if you have any of the suggested cards
                        const isHost = p.name === players[myPlayerIndex]?.name;
                        const suggestedCards = [moveInput.suspect, moveInput.weapon, moveInput.room].filter(c => c);
                        const hostHasCard = isHost && suggestedCards.length === 3 && suggestedCards.some(card => myCards.includes(card));
                        
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
                          {turn.showed.length > 0 && (
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
                                  <div style={{ color: '#8b5cf6' }}>
                                    → You ({turn.observer}) saw which card was shown
                                    <div style={{ marginLeft: '1rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                                      [Use "Reveal Card" to specify]
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ color: '#cbd5e1' }}>
                                    → <span style={{ color: '#10b981' }}>{turn.observer}</span> (observer) saw which card
                                    <div style={{ marginLeft: '1rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                                      [You don't know which card]
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

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
