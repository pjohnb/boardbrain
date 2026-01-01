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

// Short character names for checkbox headers
const SHORT_NAMES = {
  'Colonel Mustard': 'Mustard',
  'Miss Scarlet': 'Scarlet',
  'Professor Plum': 'Plum',
  'Mr. Green': 'Green',
  'Mrs. White': 'White',
  'Mrs. Peacock': 'Peacock'
};

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
  
  // Host Mode Setup: Enable entering all players' cards
  const [hostSetupMode, setHostSetupMode] = useState(null); // null | false | true
  const [hostModeCards, setHostModeCards] = useState({});
  
  // Host Role: 'referee' (not playing) or 'player' (also playing)
  const [hostRole, setHostRole] = useState(null); // null | 'referee' | 'player'
  
  // Game state
  const [currentTurn, setCurrentTurn] = useState(1);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [moves, setMoves] = useState([]);
  const [knowledgeMatrix, setKnowledgeMatrix] = useState({});
  const [probabilities, setProbabilities] = useState({});
  const [previousProbabilities, setPreviousProbabilities] = useState({});
  
  // Constraint tracking
  const [constraints, setConstraints] = useState([]);
  const [suggestionFrequency, setSuggestionFrequency] = useState({});
  const [globalSuggestionCount, setGlobalSuggestionCount] = useState({});
  const [playerLocations, setPlayerLocations] = useState({});
  const [recentInsights, setRecentInsights] = useState([]);
  
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
  
  // Card reveal popup
  const [showCardRevealPopup, setShowCardRevealPopup] = useState(false);
  const [pendingMoveData, setPendingMoveData] = useState(null);
  
  // Report visibility
  const [showReport, setShowReport] = useState(false);
  
  // Host Mode view toggle
  const [hostMode, setHostMode] = useState(false);
  
  // Multi-player knowledge tracking
  const [playerKnowledge, setPlayerKnowledge] = useState({});

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
  
  // Auto-set myPlayerIndex for player mode
  useEffect(() => {
    if (hostRole === 'player' && myPlayerIndex === null && players.length > 0) {
      setMyPlayerIndex(players.length - 1);
    }
    if (hostRole === 'referee' && myPlayerIndex !== null) {
      setMyPlayerIndex(null);
    }
  }, [hostRole, myPlayerIndex, players.length]);

  const initializePlayerKnowledge = () => {
    const allPlayerKnowledge = {};
    
    players.forEach((player, playerIdx) => {
      const playerMatrix = {};
      const playerActualCards = allPlayersCards[player.name] || [];
      
      ALL_CARDS.forEach(card => {
        playerMatrix[card] = {
          solution: '?',
          ...Object.fromEntries(players.map(p => [p.name, '?']))
        };
        
        if (playerActualCards.includes(card)) {
          playerMatrix[card][player.name] = 'HAS';
          playerMatrix[card].solution = 'NO';
        }
        
        if (remainderCards.includes(card)) {
          players.forEach(p => playerMatrix[card][p.name] = 'NO');
          playerMatrix[card].solution = 'NO';
        }
        
        const solutionCardsList = [solutionCards.suspect, solutionCards.weapon, solutionCards.room];
        if (solutionCardsList.includes(card)) {
          players.forEach(p => playerMatrix[card][p.name] = 'NO');
        }
      });
      
      allPlayerKnowledge[player.name] = {
        myCards: playerActualCards,
        knowledgeMatrix: playerMatrix,
        constraints: []
      };
    });
    
    setPlayerKnowledge(allPlayerKnowledge);
    
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
      
      // Mark my cards - FIXED: Check both myCards AND allPlayersCards for host mode
      if (myPlayerIndex !== null && myPlayerIndex !== undefined && players[myPlayerIndex]) {
        const myPlayerName = players[myPlayerIndex].name;
        const myActualCards = hostSetupMode ? (allPlayersCards[myPlayerName] || myCards) : myCards;
        
        if (myActualCards.includes(card)) {
          matrix[card][myPlayerName] = 'HAS';
          matrix[card].solution = 'NO';
        }
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
    
    ['suspects', 'weapons', 'rooms'].forEach(category => {
      const cards = CLUE_DATA[category];
      const possibleCards = cards.filter(card => matrix[card]?.solution !== 'NO');
      
      const adjustedProbs = {};
      
      possibleCards.forEach(card => {
        let baseProb = possibleCards.length > 0 ? (1 / possibleCards.length) : 0;
        let adjustedProb = baseProb;
        
        const relevantConstraints = currentConstraints.filter(c => 
          c.cards.includes(card) && c.showedBy
        );
        
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
          let reductionFactor = 1 - (relevantConstraints.length * 0.05);
          
          if (maxConstraintCount >= 3) {
            reductionFactor = reductionFactor * 0.3;
          } else if (maxConstraintCount >= 2) {
            reductionFactor = reductionFactor * 0.6;
          }
          
          adjustedProb = baseProb * Math.max(reductionFactor, 0.1);
        }
        
        let maxFrequency = 0;
        let frequentPlayer = null;
        
        players.forEach(player => {
          const freq = suggestionFreq[player.name]?.[card] || 0;
          if (freq > maxFrequency) {
            maxFrequency = freq;
            frequentPlayer = player.name;
          }
        });
        
        if (maxFrequency >= 3) {
          adjustedProb = adjustedProb * 0.2;
          
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
    
    if (Object.keys(previousProbabilities).length > 0) {
      ['suspects', 'weapons', 'rooms'].forEach(category => {
        Object.keys(probs[category] || {}).forEach(card => {
          const oldProb = parseFloat(previousProbabilities[category]?.[card] || 0);
          const newProb = parseFloat(probs[category][card]);
          const change = newProb - oldProb;
          
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
    
    if (insights.length > 0) {
      setRecentInsights(prev => [...insights, ...prev].slice(0, 5));
    }
  };

  // UPDATE ALL PLAYER KNOWLEDGE when a move is logged
  const updateAllPlayerKnowledge = (move, responses, globalMatrix, globalConstraints, revealedCard) => {
    const newPlayerKnowledge = { ...playerKnowledge };
    const suggestedCards = [move.suggestion.suspect, move.suggestion.weapon, move.suggestion.room];
    
    let showedPlayer = null;
    Object.entries(responses).forEach(([playerName, response]) => {
      if (response === 'showed') {
        showedPlayer = playerName;
      }
    });
    
    players.forEach((player) => {
      if (!newPlayerKnowledge[player.name]) {
        return;
      }
      
      const playerMatrix = { ...newPlayerKnowledge[player.name].knowledgeMatrix };
      const playerConstraints = [...newPlayerKnowledge[player.name].constraints];
      
      const isObserver = (player.name === move.suggestion.player);
      
      // PUBLIC KNOWLEDGE: Process passes (everyone learns these)
      Object.entries(responses).forEach(([responderName, response]) => {
        if (response === 'passed') {
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
          if (!playerMatrix[revealedCard]) {
            playerMatrix[revealedCard] = {
              solution: '?',
              ...Object.fromEntries(players.map(p => [p.name, '?']))
            };
          }
          playerMatrix[revealedCard][showedPlayer] = 'HAS';
          playerMatrix[revealedCard].solution = 'NO';
        } else {
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
      } else if (showedPlayer && !revealedCard) {
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
      
      // IMMEDIATE RESOLUTION CHECK
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
      
      // Simple constraint propagation
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
      
      newPlayerKnowledge[player.name].knowledgeMatrix = playerMatrix;
      newPlayerKnowledge[player.name].constraints = playerConstraints;
    });
    
    setPlayerKnowledge(newPlayerKnowledge);
  };

  const logMove = () => {
    const { suggester, suspect, weapon, room, responses } = moveInput;
    
    if (!suggester || !suspect || !weapon || !room) return;
    
    const showedPlayer = Object.entries(responses).find(([name, resp]) => resp === 'showed')?.[0];
    
    if (showedPlayer && hostMode) {
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
      return;
    }
    
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
    
    // UPDATE SUGGESTION FREQUENCY
    const newFrequency = { ...suggestionFrequency };
    if (!newFrequency[suggester]) {
      newFrequency[suggester] = {};
    }
    suggestedCards.forEach(card => {
      newFrequency[suggester][card] = (newFrequency[suggester][card] || 0) + 1;
    });
    setSuggestionFrequency(newFrequency);
    
    // UPDATE GLOBAL SUGGESTION COUNT
    const newGlobalCount = { ...globalSuggestionCount };
    suggestedCards.forEach(card => {
      newGlobalCount[card] = (newGlobalCount[card] || 0) + 1;
    });
    setGlobalSuggestionCount(newGlobalCount);
    
    // UPDATE PLAYER LOCATION
    const newLocations = { ...playerLocations };
    newLocations[suggester] = room;
    setPlayerLocations(newLocations);
    
    // Process responses and update knowledge matrix
    const newMatrix = { ...knowledgeMatrix };
    const newConstraints = [...constraints];
    
    const suggesterIndex = players.findIndex(p => p.name === suggester);
    
    const responseOrder = [
      ...players.slice(suggesterIndex + 1),
      ...players.slice(0, suggesterIndex)
    ];
    
    let constraintCreated = false;
    
    responseOrder.forEach(player => {
      const response = responses[player.name];
      
      if (response === 'passed') {
        // Player doesn't have any of the three cards - this is PUBLIC knowledge
        suggestedCards.forEach(card => {
          newMatrix[card][player.name] = 'NO';
        });
      } else if (response === 'showed' && !constraintCreated) {
        newConstraints.push({
          turn: currentTurn,
          suggester: suggester,
          cards: suggestedCards,
          showedBy: player.name,
          observedBy: suggester,
          revealedCard: null,
          timestamp: new Date().toISOString()
        });
        constraintCreated = true;
        
        const possibleCards = suggestedCards.filter(card => 
          newMatrix[card][player.name] !== 'NO'
        );
        
        if (possibleCards.length === 1) {
          const deducedCard = possibleCards[0];
          newMatrix[deducedCard][player.name] = 'HAS';
          newMatrix[deducedCard].solution = 'NO';
          
          suggestedCards.forEach(card => {
            if (card !== deducedCard && newMatrix[card][player.name] !== 'NO') {
              newMatrix[card][player.name] = 'NO';
            }
          });
          
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
    
    // CONSTRAINT PROPAGATION ENGINE
    const propagatedInsights = [];
    let changesOccurred = true;
    let iterationCount = 0;
    const maxIterations = 10;
    
    while (changesOccurred && iterationCount < maxIterations) {
      changesOccurred = false;
      iterationCount++;
      
      // STEP 1: BASIC CONSTRAINT RESOLUTION
      newConstraints.forEach((constraint, idx) => {
        const player = constraint.showedBy;
        const possibleCards = constraint.cards.filter(card => 
          newMatrix[card][player] !== 'NO'
        );
        
        if (possibleCards.length === 1 && newMatrix[possibleCards[0]][player] !== 'HAS') {
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
        
        const confirmedCards = possibleCards.filter(card => 
          newMatrix[card][player] === 'HAS'
        );
        
        if (confirmedCards.length === 1) {
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
      
      // STEP 2: INTERSECTION DETECTION
      players.forEach(p => {
        const playerConstraints = newConstraints.filter(c => c.showedBy === p.name);
        
        if (playerConstraints.length >= 2) {
          const possibleSets = playerConstraints.map(c => 
            c.cards.filter(card => newMatrix[card][p.name] !== 'NO')
          );
          
          const intersection = possibleSets.reduce((acc, set) => 
            acc.filter(card => set.includes(card))
          );
          
          if (intersection.length === 1 && newMatrix[intersection[0]][p.name] !== 'HAS') {
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
      
      // STEP 3: PROBABILISTIC CONSTRAINT SCORING
      players.forEach(p => {
        const playerConstraints = newConstraints.filter(c => c.showedBy === p.name);
        const cardFrequency = {};
        
        playerConstraints.forEach(constraint => {
          const possibleCards = constraint.cards.filter(card => 
            newMatrix[card][p.name] !== 'NO'
          );
          possibleCards.forEach(card => {
            cardFrequency[card] = (cardFrequency[card] || 0) + 1;
          });
        });
        
        Object.entries(cardFrequency).forEach(([card, count]) => {
          if (count >= 3 && playerConstraints.length >= 3) {
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
      
      // STEP 4: SOLUTION ELIMINATION PROPAGATION
      newConstraints.forEach(constraint => {
        const player = constraint.showedBy;
        
        const inSolutionCards = constraint.cards.filter(card =>
          newMatrix[card].solution === 'YES'
        );
        
        inSolutionCards.forEach(card => {
          if (newMatrix[card][player] !== 'NO') {
            newMatrix[card][player] = 'NO';
            changesOccurred = true;
          }
        });
      });
    }
    
    if (propagatedInsights.length > 0) {
      setRecentInsights(prev => [...propagatedInsights, ...prev].slice(0, 8));
    }
    
    const newMove = {
      turn: currentTurn,
      suggester,
      suggestion: { player: suggester, suspect, weapon, room },
      responses,
      location: room,
      revealedCard: revealedCard,
      timestamp: new Date().toISOString(),
      constraintsCreated: newConstraints.filter(c => c.turn === currentTurn),
      insightsGenerated: propagatedInsights,
      gridChanges: []
    };
    
    setMoves([...moves, newMove]);
    setConstraints(newConstraints);
    setKnowledgeMatrix(newMatrix);
    calculateProbabilities(newMatrix, newConstraints, newFrequency);
    
    updateAllPlayerKnowledge(newMove, responses, newMatrix, newConstraints, revealedCard);
    
    setCurrentTurn(currentTurn + 1);
    
    const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
    setCurrentPlayerIndex(nextPlayerIndex);
    
    const nextPlayer = players[nextPlayerIndex].name;
    const nextPlayerRoom = newLocations[nextPlayer] || '';
    
    setMoveInput({
      suggester: nextPlayer,
      suspect: '',
      weapon: '',
      room: nextPlayerRoom,
      responses: {}
    });
    
    setPendingMoveData(null);
    setShowCardRevealPopup(false);
  };

  const logCardReveal = () => {
    const { card, player } = revealInput;
    
    if (!card || !player) return;
    
    const newMatrix = { ...knowledgeMatrix };
    const newConstraints = [...constraints];
    
    newMatrix[card][player] = 'HAS';
    newMatrix[card].solution = 'NO';
    
    const myPlayerName = players[myPlayerIndex]?.name;
    const matchingConstraint = newConstraints.find(c => 
      c.showedBy === player && 
      c.observedBy === myPlayerName &&
      c.cards.includes(card) &&
      c.revealedCard === null
    );
    
    if (matchingConstraint) {
      matchingConstraint.revealedCard = card;
      
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
  
  // VISUAL GRID: Get cell display state - UPDATED to show TURN NUMBERS
  const getCellState = (card, playerName) => {
    const myPlayerName = players[myPlayerIndex]?.name;
    
    // PUBLIC/REMAINDER CARD
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
    
    // MY CARD - FIXED: Check both myCards and allPlayersCards
    const myActualCards = hostSetupMode ? (allPlayersCards[myPlayerName] || myCards) : myCards;
    if (myActualCards.includes(card) && playerName === myPlayerName) {
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
    
    // CONFIRMED HAS
    if (matrixValue === 'HAS') {
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
    
    // CONFIRMED NO (from passes)
    if (matrixValue === 'NO') {
      return {
        type: 'NO',
        color: '#22c55e',
        intensity: 0.5,
        overlay: '✗',
        border: '#22c55e',
        borderWidth: 2,
        tooltip: 'Doesn\'t have this card (passed)'
      };
    }
    
    // Check for CONSTRAINTS - UPDATED to show TURN NUMBERS
    const playerConstraints = constraints.filter(c => 
      c.showedBy === playerName && 
      c.cards.includes(card) &&
      !c.revealedCard
    );
    
    if (playerConstraints.length > 0) {
      // Get the turn numbers
      const turnNumbers = playerConstraints.map(c => c.turn).sort((a, b) => a - b);
      
      const totalPossible = playerConstraints.reduce((sum, c) => {
        const possible = c.cards.filter(card => 
          knowledgeMatrix[card]?.[playerName] !== 'NO'
        );
        return sum + possible.length;
      }, 0);
      
      const avgPossible = totalPossible / playerConstraints.length;
      
      let intensity = 0.4;
      if (avgPossible <= 1.5) intensity = 0.8;
      else if (avgPossible <= 2.5) intensity = 0.6;
      
      // Show turn number(s) - T1, T2, etc.
      let overlayText;
      if (turnNumbers.length === 1) {
        overlayText = `T${turnNumbers[0]}`;
      } else if (turnNumbers.length === 2) {
        overlayText = `${turnNumbers[0]},${turnNumbers[1]}`;
      } else {
        overlayText = `${turnNumbers[0]}+`;
      }
      
      return {
        type: 'CONSTRAINT',
        color: '#f97316',
        intensity: intensity,
        overlay: overlayText,
        border: '#f97316',
        borderWidth: 2,
        tooltip: `Turn ${turnNumbers.join(', ')}: ${playerName} showed one of ${playerConstraints[0].cards.join(', ')}`
      };
    }
    
    // UNKNOWN
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
  
  // HOST MODE: Get cell state from a SPECIFIC player's perspective - UPDATED for turn numbers
  const getCellStateForPlayer = (card, columnPlayerName, viewingPlayerIndex) => {
    const viewingPlayerName = players[viewingPlayerIndex]?.name;
    const viewingPlayerData = playerKnowledge[viewingPlayerName];
    
    if (!viewingPlayerData) {
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
    
    // PUBLIC/REMAINDER CARD
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
    
    // VIEWING PLAYER'S CARD
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
    
    // CONFIRMED HAS
    if (matrixValue === 'HAS') {
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
    
    // CONFIRMED NO (from passes)
    if (matrixValue === 'NO') {
      return {
        type: 'NO',
        color: '#22c55e',
        intensity: 0.5,
        overlay: '✗',
        border: '#22c55e',
        borderWidth: 1.5,
        tooltip: 'Passed (doesn\'t have)'
      };
    }
    
    // Check for CONSTRAINTS - UPDATED to show TURN NUMBERS
    const playerConstraints = viewingPlayerConstraints.filter(c => 
      c.showedBy === columnPlayerName && 
      c.cards.includes(card) &&
      !c.revealedCard
    );
    
    if (playerConstraints.length > 0) {
      const turnNumbers = playerConstraints.map(c => c.turn).sort((a, b) => a - b);
      
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
      
      // Show turn number(s)
      let overlayText;
      if (turnNumbers.length === 1) {
        overlayText = `T${turnNumbers[0]}`;
      } else if (turnNumbers.length === 2) {
        overlayText = `${turnNumbers[0]},${turnNumbers[1]}`;
      } else {
        overlayText = `${turnNumbers[0]}+`;
      }
      
      return {
        type: 'CONSTRAINT',
        color: '#f97316',
        intensity: intensity,
        overlay: overlayText,
        border: '#f97316',
        borderWidth: 1.5,
        tooltip: `Turn ${turnNumbers.join(', ')} constraint`
      };
    }
    
    // UNKNOWN
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
      
      const passed = [];
      const showed = [];
      
      Object.entries(move.responses).forEach(([playerName, response]) => {
        if (response === 'passed') {
          passed.push(playerName);
        } else if (response === 'showed') {
          showed.push(playerName);
        }
      });
      
      const turnConstraints = move.constraintsCreated || [];
      const turnInsights = move.insightsGenerated || [];
      
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
        text += `│ → ${player}: PASSED (doesn't have any of the 3 cards)${' '.repeat(18 - player.length)}│\n`;
      });
      turn.showed.forEach(player => {
        text += `│ → ${player}: SHOWED (has one of the 3 cards)${' '.repeat(23 - player.length)}│\n`;
      });
      text += `│${' '.repeat(60)}│\n`;
      
      text += `└${'─'.repeat(59)}┘\n\n`;
    });
    
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
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '0.5rem',
      marginBottom: '1rem'
    }
  };

  // ============================================================================
  // SETUP SCREEN - UPDATED text
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
            <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem' }}>Choose Your Mode</h2>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
              How do you want to use BoardBrain?
            </p>
            
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
              {/* Single Player Mode - UPDATED bullets */}
              <button
                onClick={() => {
                  setHostSetupMode(false);
                  setHostRole(null);
                }}
                style={{
                  ...styles.card,
                  padding: '1.5rem',
                  cursor: 'pointer',
                  border: hostSetupMode === false ? '3px solid #3b82f6' : '2px solid #475569',
                  backgroundColor: hostSetupMode === false ? '#1e3a8a' : '#0f172a',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ fontSize: '2rem' }}>🎲</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontSize: '1.125rem', 
                      fontWeight: '600', 
                      color: hostSetupMode === false ? '#60a5fa' : '#cbd5e1',
                      marginBottom: '0.5rem' 
                    }}>
                      Single Player Mode
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                      I'm joining the other players as a regular player.
                    </div>
                    <ul style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.5rem 0 0 1.25rem', lineHeight: '1.6' }}>
                      <li>I'll enter only my own cards</li>
                      <li>I will be able to see only my own cards</li>
                      <li>I'll manually log all moves as they happen</li>
                    </ul>
                  </div>
                </div>
              </button>
              
              {/* Host/Facilitate Mode - UPDATED bullets (removed last one) */}
              <button
                onClick={() => {
                  setHostSetupMode(true);
                }}
                style={{
                  ...styles.card,
                  padding: '1.5rem',
                  cursor: 'pointer',
                  border: hostSetupMode === true ? '3px solid #10b981' : '2px solid #475569',
                  backgroundColor: hostSetupMode === true ? '#064e3b' : '#0f172a',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ fontSize: '2rem' }}>🖥️</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontSize: '1.125rem', 
                      fontWeight: '600', 
                      color: hostSetupMode === true ? '#10b981' : '#cbd5e1',
                      marginBottom: '0.5rem' 
                    }}>
                      Host/Facilitate Mode
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                      I'm facilitating a physical game at the table as referee.
                    </div>
                    <ul style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.5rem 0 0 1.25rem', lineHeight: '1.6' }}>
                      <li>Enter ALL players' cards (full visibility)</li>
                      <li>As host, do not play - just facilitate</li>
                    </ul>
                  </div>
                </div>
              </button>
            </div>
            
            {hostSetupMode !== null && (
              <div style={{
                padding: '1rem',
                backgroundColor: '#0f172a',
                borderRadius: '0.375rem',
                border: '2px solid ' + (hostSetupMode === true ? '#10b981' : '#3b82f6'),
                marginBottom: '1.5rem'
              }}>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: hostSetupMode === true ? '#10b981' : '#60a5fa' }}>
                  ✅ {hostSetupMode === true ? 'Host/Facilitate Mode' : 'Single Player Mode'} Selected
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {hostSetupMode === true ? 
                    'Next: Enter player names (you are referee, not playing)' :
                    'Next: Enter player names and setup your game'
                  }
                </div>
              </div>
            )}
            
            {/* Number of Players */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={styles.label}>Number of Players</label>
              <select
                style={styles.select}
                value={numPlayers || ''}
                onChange={(e) => {
                  const num = parseInt(e.target.value);
                  setNumPlayers(num);
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

            <button
              onClick={() => {
                if (hostSetupMode === true) {
                  setHostRole('referee');
                  setGamePhase('playerSetup');
                } else {
                  setHostRole(null);
                  setGamePhase('playerSetup');
                }
              }}
              disabled={!numPlayers || hostSetupMode === null}
              style={{
                ...styles.button,
                ...( (!numPlayers || hostSetupMode === null) && styles.buttonDisabled)
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
  // PLAYER SETUP SCREEN - REDESIGNED WITH CHECKBOX GRID
  // ============================================================================
  if (gamePhase === 'playerSetup') {
    const allPlayersNamed = players.every(p => p.name.trim() !== '');
    const allCharactersAssigned = players.every(p => p.character !== '');
    
    return (
      <div style={styles.container}>
        <div style={{ maxWidth: '70rem', margin: '0 auto' }}>
          <div style={styles.header}>
            <h1 style={styles.title}>BoardBrain™</h1>
            <p style={styles.subtitle}>More Brain. Better Game.</p>
          </div>

          <div style={styles.card}>
            <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem' }}>
              Game Setup - Step 2: Players & Characters
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
              {hostRole === 'referee' ? 
                'Enter player names and assign characters. As referee, you are NOT playing.' :
                'Enter each player\'s name and assign their character by checking the box.'
              }
            </p>
            
            {/* Player Names + Character Checkbox Grid */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '160px repeat(6, 1fr)',
              gap: '0.5rem',
              marginBottom: '1.5rem',
              overflowX: 'auto'
            }}>
              {/* Header Row */}
              <div style={{ fontWeight: '600', color: '#94a3b8', padding: '0.5rem', fontSize: '0.8rem' }}>
                Player Name
              </div>
              {CLUE_DATA.suspects.map(char => (
                <div key={char} style={{ 
                  fontWeight: '600', 
                  color: '#94a3b8', 
                  padding: '0.5rem',
                  fontSize: '0.7rem',
                  textAlign: 'center'
                }}>
                  {SHORT_NAMES[char]}
                </div>
              ))}
              
              {/* Player Rows */}
              {players.map((player, idx) => {
                const isLastPlayer = idx === players.length - 1;
                
                return (
                  <React.Fragment key={idx}>
                    {/* Player Name Input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        color: '#64748b',
                        minWidth: '24px'
                      }}>
                        P{idx + 1}
                      </span>
                      <input
                        type="text"
                        style={{
                          ...styles.select,
                          fontSize: '0.875rem',
                          padding: '0.5rem',
                          flex: 1,
                          minWidth: '80px'
                        }}
                        value={player.name}
                        onChange={(e) => {
                          const newPlayers = [...players];
                          newPlayers[idx].name = e.target.value;
                          setPlayers(newPlayers);
                        }}
                        placeholder={`Player ${idx + 1}`}
                      />
                      {/* YOU indicator */}
                      {hostRole === null && isLastPlayer && (
                        <span style={{ 
                          fontSize: '0.6rem', 
                          color: '#60a5fa',
                          backgroundColor: '#1e3a8a',
                          padding: '0.2rem 0.4rem',
                          borderRadius: '0.25rem',
                          whiteSpace: 'nowrap'
                        }}>
                          YOU
                        </span>
                      )}
                    </div>
                    
                    {/* Character Checkboxes */}
                    {CLUE_DATA.suspects.map(char => {
                      const isSelected = player.character === char;
                      const isUsedByOther = players.some((p, i) => i !== idx && p.character === char);
                      
                      return (
                        <div key={char} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          padding: '0.5rem',
                          backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.3)' : 'transparent',
                          borderRadius: '0.25rem'
                        }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isUsedByOther}
                            onChange={() => {
                              const newPlayers = [...players];
                              if (isSelected) {
                                newPlayers[idx].character = '';
                              } else {
                                newPlayers[idx].character = char;
                              }
                              setPlayers(newPlayers);
                            }}
                            style={{
                              width: '1.25rem',
                              height: '1.25rem',
                              cursor: isUsedByOther ? 'not-allowed' : 'pointer',
                              opacity: isUsedByOther ? 0.3 : 1,
                              accentColor: '#8b5cf6'
                            }}
                          />
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
            
            {/* Status Summary */}
            <div style={{
              padding: '1rem',
              backgroundColor: '#0f172a',
              borderRadius: '0.375rem',
              marginBottom: '1.5rem',
              fontSize: '0.875rem'
            }}>
              <div style={{ color: '#94a3b8', marginBottom: '0.5rem' }}>
                <strong>Assigned Characters:</strong>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {players.map((p, idx) => (
                  <span key={idx} style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: p.character ? '#8b5cf6' : '#374151',
                    color: p.character ? 'white' : '#64748b',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem'
                  }}>
                    P{idx + 1} {p.name}: {p.character ? SHORT_NAMES[p.character] : '(none)'}
                  </span>
                ))}
              </div>
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
                  if (hostRole === 'player') {
                    if (myPlayerIndex === null) {
                      setMyPlayerIndex(players.length - 1);
                    }
                    if (myPlayerIndex !== null) {
                      setMyCharacter(players[myPlayerIndex].character);
                    } else {
                      setMyCharacter(players[players.length - 1].character);
                    }
                  }
                  if (hostSetupMode) {
                    setGamePhase('solutionSetup');
                  } else {
                    // Single player mode - set myPlayerIndex to last player
                    setMyPlayerIndex(players.length - 1);
                    setMyCharacter(players[players.length - 1].character);
                    setGamePhase('cardSetup');
                  }
                }}
                disabled={!allPlayersNamed || !allCharactersAssigned}
                style={{
                  ...styles.button,
                  flex: 2,
                  ...((!allPlayersNamed || !allCharactersAssigned) && styles.buttonDisabled)
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
            
            <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '1.5rem' }}>
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
                  These 3 cards will NOT be distributed to players.
                </div>
              </div>
            )}

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
            <div style={{ marginBottom: '1rem' }}>
              <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem' }}>Game Setup - Card Distribution</h2>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                {hostSetupMode === true ? 
                  'Host Mode: Enter all players\' cards to see complete GLOBAL view' :
                  myPlayerIndex !== null && players[myPlayerIndex] ?
                  `Playing as: ${players[myPlayerIndex].name} (${myCharacter || players[myPlayerIndex].character})` :
                  'Select your cards to begin playing'
                }
              </p>
            </div>
            
            {hostSetupMode !== true ? (
              /* SINGLE PLAYER MODE */
              <div>
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
              /* HOST MODE */
              <div style={{ marginBottom: '1.5rem' }}>
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
                  const availableCards = 18;
                  const playerCardCount = Math.floor(availableCards / players.length);
                  
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
                          const isDisabled = (usedByOther || (!isSelected && playerCards.length >= playerCardCount));
                          
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
                
                {remainderCount > 0 && (() => {
                  const allAssignedCards = Object.values(hostModeCards).flat();
                  const solutionCardsList = [solutionCards.suspect, solutionCards.weapon, solutionCards.room];
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
                  let finalPlayerIndex = myPlayerIndex;
                  if (hostRole === 'player' && (myPlayerIndex === null || myPlayerIndex === undefined)) {
                    finalPlayerIndex = players.length - 1;
                    setMyPlayerIndex(finalPlayerIndex);
                    setMyCharacter(players[finalPlayerIndex].character);
                  }
                  
                  if (hostSetupMode) {
                    const allAssignedCards = Object.values(hostModeCards).flat();
                    const solutionCardsList = [solutionCards.suspect, solutionCards.weapon, solutionCards.room];
                    const remainder = ALL_CARDS.filter(c => 
                      !allAssignedCards.includes(c) && !solutionCardsList.includes(c)
                    );
                    
                    setAllPlayersCards(hostModeCards);
                    if (hostRole === 'player' && finalPlayerIndex !== null && players[finalPlayerIndex]) {
                      setMyCards(hostModeCards[players[finalPlayerIndex].name] || []);
                    } else if (hostRole === 'referee') {
                      setMyCards([]);
                    }
                    setRemainderCards(remainder);
                    setHostMode(true);
                  }
                  
                  setGamePhase('playing');
                }}
                disabled={
                  hostSetupMode ? 
                    (() => {
                      const availableCards = 18;
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
                        const availableCards = 18;
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
  // PLAYING SCREEN - Abbreviated for space, full implementation continues...
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
                Turn {currentTurn} • {moveInput.suggester ? `${moveInput.suggester}'s Turn` : `${players[currentPlayerIndex]?.name}'s Turn`}
                {hostRole === 'referee' ? ' • You are Referee' : ''}
              </p>
            </div>
            
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

          {/* MY CARDS & PUBLIC CARDS DISPLAY - FIXED for host mode */}
          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            marginBottom: '1.5rem',
            flexWrap: 'wrap'
          }}>
            {/* Show cards for the viewing player */}
            {myPlayerIndex !== null && (
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
                  marginBottom: '0.75rem'
                }}>
                  🎴 {hostRole === 'referee' ? `${players[myPlayerIndex]?.name}'s Cards` : 'My Cards'} ({(hostSetupMode ? (allPlayersCards[players[myPlayerIndex]?.name] || myCards) : myCards).length})
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {(hostSetupMode ? (allPlayersCards[players[myPlayerIndex]?.name] || myCards) : myCards).map(card => (
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
            )}

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
                  marginBottom: '0.75rem'
                }}>
                  👁️ Public Cards ({remainderCards.length})
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
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

          {hostMode ? (
            // HOST MODE VIEW
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
                        ({SHORT_NAMES[player.character] || player.character})
                      </div>
                    </div>

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
                              
                              {players.map(p => {
                                const cellState = getCellStateForPlayer(card, p.name, playerIdx);
                                const rgbaColor = `rgba(${parseInt(cellState.color.slice(1,3), 16)}, ${parseInt(cellState.color.slice(3,5), 16)}, ${parseInt(cellState.color.slice(5,7), 16)}, ${cellState.intensity})`;
                                
                                return (
                                  <div
                                    key={p.name}
                                    title={cellState.tooltip}
                                    style={{
                                      width: '26px',
                                      height: '18px',
                                      backgroundColor: rgbaColor,
                                      border: `${cellState.borderWidth}px solid ${cellState.border}`,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.5rem',
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

              {/* LEGEND - Updated for turn numbers */}
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
                    <div style={{ width: '16px', height: '16px', backgroundColor: '#8b5cf6', border: '1.5px solid #8b5cf6' }}></div>
                    <span>Purple = Their card</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <div style={{ width: '16px', height: '16px', backgroundColor: '#3b82f6', border: '1.5px solid #3b82f6' }}></div>
                    <span>Blue = Has</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <div style={{ width: '16px', height: '16px', backgroundColor: 'rgba(249, 115, 22, 0.6)', border: '1.5px solid #f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', color: 'white' }}>T1</div>
                    <span>Orange = Showed on Turn N</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <div style={{ width: '16px', height: '16px', backgroundColor: 'rgba(34, 197, 94, 0.5)', border: '1.5px solid #22c55e' }}></div>
                    <span>Green = Passed (NO)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <div style={{ width: '16px', height: '16px', backgroundColor: 'rgba(100, 116, 139, 0.2)', border: '1px solid #64748b' }}></div>
                    <span>Gray = Unknown</span>
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
                              (No cards set)
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
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
              
              {/* Move Input Panel */}
              <div style={{
                ...styles.card,
                padding: '1rem',
                backgroundColor: '#1e293b'
              }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', color: '#e2e8f0' }}>
                  🎮 Log Move
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={styles.label}>Suggester</label>
                    <select
                      style={styles.select}
                      value={moveInput.suggester}
                      onChange={(e) => setMoveInput({...moveInput, suggester: e.target.value})}
                    >
                      <option value="">Select</option>
                      {players.map(p => (
                        <option key={p.name} value={p.name}>{p.name}</option>
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
                      <option value="">Select</option>
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
                      <option value="">Select</option>
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
                      <option value="">Select</option>
                      {CLUE_DATA.rooms.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {moveInput.suggester && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={styles.label}>Responses (in turn order)</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {(() => {
                        const suggesterIndex = players.findIndex(p => p.name === moveInput.suggester);
                        const responseOrder = [
                          ...players.slice(suggesterIndex + 1),
                          ...players.slice(0, suggesterIndex)
                        ];
                        
                        let canRespond = true;
                        
                        return responseOrder.map(p => {
                          const playerCanRespond = canRespond;
                          const playerResponse = moveInput.responses[p.name];
                          
                          if (playerResponse === 'showed') {
                            canRespond = false;
                          }
                          
                          return (
                            <div key={p.name} style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '0.5rem',
                              padding: '0.5rem',
                              backgroundColor: '#0f172a',
                              borderRadius: '0.375rem',
                              opacity: playerCanRespond ? 1 : 0.5
                            }}>
                              <span style={{ fontSize: '0.75rem', color: '#cbd5e1', minWidth: '60px' }}>
                                {p.name}
                              </span>
                              <select
                                style={{ ...styles.select, width: '100px', fontSize: '0.75rem' }}
                                value={moveInput.responses[p.name] || ''}
                                disabled={!playerCanRespond}
                                onChange={(e) => setMoveInput({
                                  ...moveInput,
                                  responses: {...moveInput.responses, [p.name]: e.target.value}
                                })}
                              >
                                <option value="">--</option>
                                <option value="passed">Passed</option>
                                <option value="showed">Showed</option>
                              </select>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={logMove}
                    style={{
                      ...styles.button,
                      flex: 2,
                      background: '#2563eb'
                    }}
                  >
                    Log Move
                  </button>
                  
                  <button
                    onClick={() => {
                      const nextPlayer = players[currentPlayerIndex]?.name;
                      setMoveInput({
                        suggester: nextPlayer,
                        suspect: '',
                        weapon: '',
                        room: '',
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

              {/* Move History */}
              <div style={{
                ...styles.card,
                padding: '1rem',
                backgroundColor: '#1e293b',
                maxHeight: '300px',
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
                    {[...moves].reverse().map((move, idx) => (
                      <div key={idx} style={{
                        marginBottom: '0.75rem',
                        padding: '0.5rem',
                        backgroundColor: '#0f172a',
                        borderRadius: '0.25rem',
                        borderLeft: '3px solid #6366f1'
                      }}>
                        <div style={{ color: '#cbd5e1', fontWeight: '600', marginBottom: '0.25rem' }}>
                          Turn {move.turn}: {move.suggestion?.player || move.suggester}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                          {move.suggestion?.suspect}, {move.suggestion?.weapon}, {move.suggestion?.room}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.65rem', marginTop: '0.25rem' }}>
                          {Object.entries(move.responses || {}).map(([p, r]) => 
                            `${p}: ${r}`
                          ).join(' • ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // PLAYER VIEW
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: '#94a3b8' }}>
                Player view - Click "HOST MODE" to see all perspectives
              </p>
            </div>
          )}
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
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {pendingMoveData.suggestedCards.map(card => (
                  <button
                    key={card}
                    onClick={() => processMove(card)}
                    style={{
                      ...styles.button,
                      background: '#8b5cf6',
                      padding: '1rem',
                      fontSize: '1rem',
                      textAlign: 'left'
                    }}
                  >
                    {card}
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

  // GAME OVER
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
              setAllPlayersCards({});
              setHostModeCards({});
              setPlayerKnowledge({});
              setSolutionCards({ suspect: '', weapon: '', room: '' });
              setHostSetupMode(null);
              setHostRole(null);
              setHostMode(false);
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
