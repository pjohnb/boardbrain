import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Textarea, Alert, AlertDescription, Checkbox } from './ui-components';

/**
 * BoardBrain™ - More Brain. Better Game.
 * © 2024 Xformative AI LLC. All Rights Reserved.
 */

// ============================================================================
// CLUE CSP (Constraint Satisfaction Problem) SOLVER
// ============================================================================

/**
 * This solver calculates EXACT probabilities by enumerating all possible
 * vault combinations and eliminating those inconsistent with constraints.
 */
class ClueCSPSolver {
  constructor(gameData) {
    this.suspects = gameData.suspects;
    this.weapons = gameData.weapons;
    this.rooms = gameData.rooms;
    this.eliminatedCards = new Set();
    this.constraints = [];
    this.validVaultCombos = null;
    this.needsRecalculation = true;
  }
  
  eliminateCard(card) {
    this.eliminatedCards.add(card);
    this.needsRecalculation = true;
  }
  
  addPassConstraint(player, suggestedCards) {
    this.constraints.push({
      type: 'PASS',
      player,
      cards: suggestedCards
    });
    this.needsRecalculation = true;
  }
  
  addShowConstraint(player, suggestedCards, cardShown = null) {
    if (cardShown) {
      this.eliminateCard(cardShown);
    } else {
      this.constraints.push({
        type: 'SHOW',
        player,
        cards: suggestedCards
      });
    }
    this.needsRecalculation = true;
  }
  
  generateAllVaultCombinations() {
    const combos = [];
    for (const suspect of this.suspects) {
      for (const weapon of this.weapons) {
        for (const room of this.rooms) {
          combos.push({ suspect, weapon, room });
        }
      }
    }
    return combos;
  }
  
  isValidVaultCombo(combo) {
    if (this.eliminatedCards.has(combo.suspect) ||
        this.eliminatedCards.has(combo.weapon) ||
        this.eliminatedCards.has(combo.room)) {
      return false;
    }
    
    for (const constraint of this.constraints) {
      if (constraint.type === 'SHOW') {
        const allInVault = constraint.cards.every(card =>
          card === combo.suspect || card === combo.weapon || card === combo.room
        );
        if (allInVault) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  calculateValidCombinations() {
    if (!this.needsRecalculation && this.validVaultCombos) {
      return this.validVaultCombos;
    }
    
    const allCombos = this.generateAllVaultCombinations();
    this.validVaultCombos = allCombos.filter(combo => this.isValidVaultCombo(combo));
    this.needsRecalculation = false;
    
    return this.validVaultCombos;
  }
  
  calculateProbabilities() {
    const validCombos = this.calculateValidCombinations();
    
    if (validCombos.length === 0) {
      return { suspects: {}, weapons: {}, rooms: {}, totalCombinations: 0 };
    }
    
    const total = validCombos.length;
    const cardCounts = {};
    
    validCombos.forEach(combo => {
      cardCounts[combo.suspect] = (cardCounts[combo.suspect] || 0) + 1;
      cardCounts[combo.weapon] = (cardCounts[combo.weapon] || 0) + 1;
      cardCounts[combo.room] = (cardCounts[combo.room] || 0) + 1;
    });
    
    const probabilities = {
      suspects: {},
      weapons: {},
      rooms: {}
    };
    
    this.suspects.forEach(card => {
      probabilities.suspects[card] = this.eliminatedCards.has(card) ? 0 : Math.round(((cardCounts[card] || 0) / total) * 100);
    });
    this.weapons.forEach(card => {
      probabilities.weapons[card] = this.eliminatedCards.has(card) ? 0 : Math.round(((cardCounts[card] || 0) / total) * 100);
    });
    this.rooms.forEach(card => {
      probabilities.rooms[card] = this.eliminatedCards.has(card) ? 0 : Math.round(((cardCounts[card] || 0) / total) * 100);
    });
    
    probabilities.totalCombinations = total;
    
    return probabilities;
  }
  
  getMostLikelySolution() {
    const probs = this.calculateProbabilities();
    
    const findMax = (cards, category) => {
      let maxCard = null;
      let maxProb = 0;
      cards.forEach(card => {
        const prob = probs[category][card] || 0;
        if (prob > maxProb) {
          maxProb = prob;
          maxCard = card;
        }
      });
      return { card: maxCard, prob: maxProb };
    };
    
    return {
      suspect: findMax(this.suspects, 'suspects'),
      weapon: findMax(this.weapons, 'weapons'),
      room: findMax(this.rooms, 'rooms'),
      totalCombinations: probs.totalCombinations
    };
  }
}

// ============================================================================
// CLUE GAME DATA
// ============================================================================

const CLUE_DATA = {
  suspects: ['Miss Scarlet', 'Colonel Mustard', 'Mrs. White', 'Mr. Green', 'Mrs. Peacock', 'Professor Plum'],
  weapons: ['Candlestick', 'Knife', 'Lead Pipe', 'Revolver', 'Rope', 'Wrench'],
  rooms: ['Kitchen', 'Ballroom', 'Conservatory', 'Billiard Room', 'Library', 'Study', 'Hall', 'Lounge', 'Dining Room']
};

const ALL_CARDS = [...CLUE_DATA.suspects, ...CLUE_DATA.weapons, ...CLUE_DATA.rooms];

export default function BoardBrain() {
  // App state
  const [appPhase, setAppPhase] = useState('welcome'); // welcome, setup, playing
  const [gameType, setGameType] = useState('CLUE');
  
  // Game setup
  const [numPlayers, setNumPlayers] = useState(4);
  const [playerNames, setPlayerNames] = useState(['You', 'Player 2', 'Player 3', 'Player 4']);
  const [playerCharacters, setPlayerCharacters] = useState({}); // Maps player name to character
  const [myCharacter, setMyCharacter] = useState('');
  const [myCards, setMyCards] = useState([]);
  const [remainderCards, setRemainderCards] = useState([]);
  
  // Game state
  const [currentTurn, setCurrentTurn] = useState(0);
  const [moves, setMoves] = useState([]);
  const [knowledgeMatrix, setKnowledgeMatrix] = useState({});
  const [constraints, setConstraints] = useState([]); // Track when player shows unknown card
  const [cspSolver, setCspSolver] = useState(null); // CSP solver instance
  
  // Current move input
  const [moveForm, setMoveForm] = useState({
    player: '',
    movedTo: '',
    suspect: '',
    weapon: '',
    room: '',
    responses: []
  });
  
  // AI panel
  const [showAI, setShowAI] = useState(false);
  
  // Calculate cards per player and remainder
  const cardsPerPlayer = Math.floor(18 / numPlayers);
  const remainderCount = 18 % numPlayers;
  
  // Initialize knowledge matrix and CSP solver
  useEffect(() => {
    if (appPhase === 'playing' && Object.keys(knowledgeMatrix).length === 0) {
      // Initialize knowledge matrix
      const matrix = {};
      ALL_CARDS.forEach(card => {
        matrix[card] = {
          me: myCards.includes(card) ? 'HAS' : 'UNKNOWN',
          solution: remainderCards.includes(card) ? 'NO' : 'UNKNOWN',
          constraints: [] // Track which constraints involve this card
        };
        playerNames.slice(1).forEach(player => {
          matrix[card][player] = remainderCards.includes(card) ? 'NO' : 'UNKNOWN';
        });
      });
      setKnowledgeMatrix(matrix);
      
      // Initialize CSP solver
      const solver = new ClueCSPSolver(CLUE_DATA);
      
      // Eliminate cards we know (our cards + public cards)
      [...myCards, ...remainderCards].forEach(card => {
        solver.eliminateCard(card);
      });
      
      setCspSolver(solver);
    }
  }, [appPhase, myCards, remainderCards, playerNames]);
  
  // Process moves to update knowledge and CSP solver
  useEffect(() => {
    if (moves.length === 0 || !cspSolver) return;
    
    const newMatrix = { ...knowledgeMatrix };
    const newConstraints = [];
    
    // Get the most recent move
    const move = moves[moves.length - 1];
    
    if (move.type === 'SUGGESTION') {
      const suggestedCards = [move.suspect, move.weapon, move.room];
      
      move.responses.forEach(response => {
        if (response.action === 'PASS') {
          // Player doesn't have ANY of the suggested cards
          suggestedCards.forEach(card => {
            if (newMatrix[card]) {
              newMatrix[card][response.player] = 'NO';
            }
          });
          
          // Add PASS constraint to CSP solver
          cspSolver.addPassConstraint(response.player, suggestedCards);
          
        } else if (response.action === 'SHOW' && response.cardShown) {
          // Player definitely has this card (we know which one)
          if (newMatrix[response.cardShown]) {
            newMatrix[response.cardShown][response.player] = 'HAS';
            newMatrix[response.cardShown].solution = 'NO';
          }
          
          // Tell CSP solver this card is NOT in vault
          cspSolver.addShowConstraint(response.player, suggestedCards, response.cardShown);
          
        } else if (response.action === 'SHOW' && !response.cardShown) {
          // Player showed but we don't know which card - CREATE CONSTRAINT
          const constraintId = `C${constraints.length + newConstraints.length + 1}`;
          newConstraints.push({
            id: constraintId,
            turn: move.turn,
            player: response.player,
            cards: suggestedCards,
            resolved: false
          });
          
          // Mark each card as having a constraint for this player
          suggestedCards.forEach(card => {
            if (newMatrix[card] && newMatrix[card][response.player] === 'UNKNOWN') {
              newMatrix[card][response.player] = 'CONSTRAINT';
              if (!newMatrix[card].constraints) {
                newMatrix[card].constraints = [];
              }
              newMatrix[card].constraints.push(constraintId);
            }
          });
          
          // Add SHOW constraint to CSP solver (unknown card)
          cspSolver.addShowConstraint(response.player, suggestedCards, null);
        }
      });
    }
    
    setKnowledgeMatrix(newMatrix);
    setConstraints([...constraints, ...newConstraints]);
  }, [moves, cspSolver]);
  
  // Calculate probabilities using CSP solver
  const probabilities = cspSolver ? cspSolver.calculateProbabilities() : {
    suspects: {},
    weapons: {},
    rooms: {},
    totalCombinations: 324 // Initial total
  };
  
  // Get most likely solution from CSP solver
  const solution = cspSolver ? cspSolver.getMostLikelySolution() : {
    suspect: { card: null, prob: 0 },
    weapon: { card: null, prob: 0 },
    room: { card: null, prob: 0 },
    totalCombinations: 324
  };
  
  const overallConfidence = solution.suspect.prob && solution.weapon.prob && solution.room.prob
    ? Math.round((solution.suspect.prob + solution.weapon.prob + solution.room.prob) / 3)
    : 0;
  
  // Handle move submission
  const handleAddMove = (e) => {
    e.preventDefault();
    
    const newMove = {
      turn: moves.length + 1,
      type: 'SUGGESTION',
      player: moveForm.player,
      movedTo: moveForm.movedTo,
      suspect: moveForm.suspect,
      weapon: moveForm.weapon,
      room: moveForm.room || moveForm.movedTo,
      responses: moveForm.responses,
      timestamp: new Date().toISOString()
    };
    
    setMoves([...moves, newMove]);
    
    // Reset form
    setMoveForm({
      player: '',
      movedTo: '',
      suspect: '',
      weapon: '',
      room: '',
      responses: []
    });
    
    // Advance turn
    setCurrentTurn((currentTurn + 1) % numPlayers);
  };
  
  // WELCOME SCREEN
  if (appPhase === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
              BoardBrain™
            </h1>
            <p className="text-3xl text-slate-300 font-light mb-2">More Brain. Better Game.</p>
            <p className="text-xl text-slate-400">Your AI Strategy Partner for Board Games</p>
          </div>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-2xl text-white">Welcome to BoardBrain</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-slate-300 space-y-4">
                <p>
                  BoardBrain is your personal AI strategy partner. Get real-time deduction help, 
                  probability analysis, and tactical recommendations while you play. It's like having 
                  a grandmaster whispering advice in your ear.
                </p>
                
                <div className="bg-slate-900 p-5 rounded-lg border border-slate-700">
                  <h3 className="font-semibold text-white mb-3 text-center">Games We Love to Dominate</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="text-center p-2 bg-slate-800 rounded">
                      <div className="text-lg mb-1">🔍</div>
                      <div className="text-white font-medium">Clue</div>
                    </div>
                    <div className="text-center p-2 bg-slate-800 rounded opacity-50">
                      <div className="text-lg mb-1">♟️</div>
                      <div className="text-white font-medium">Chess</div>
                      <div className="text-xs text-slate-500">Coming Soon</div>
                    </div>
                    <div className="text-center p-2 bg-slate-800 rounded opacity-50">
                      <div className="text-lg mb-1">🏠</div>
                      <div className="text-white font-medium">Catan</div>
                      <div className="text-xs text-slate-500">Coming Soon</div>
                    </div>
                    <div className="text-center p-2 bg-slate-800 rounded opacity-50">
                      <div className="text-lg mb-1">🚂</div>
                      <div className="text-white font-medium">Ticket to Ride</div>
                      <div className="text-xs text-slate-500">Coming Soon</div>
                    </div>
                  </div>
                  <p className="text-center text-sm text-slate-400 mt-4">
                    Everyone's using their brain. You're using AI. 🧠
                  </p>
                </div>

                <p className="text-sm text-slate-400 text-center">
                  Grab your physical game, gather your friends, and let's play smarter.
                </p>
              </div>

              <div className="flex gap-4">
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  onClick={() => setAppPhase('setup')}
                >
                  Start New Game
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="text-center mt-8 text-sm text-slate-500">
            <p>© 2024 Xformative AI LLC. All Rights Reserved.</p>
            <p className="mt-2">BoardBrain™ is not affiliated with any game publisher.</p>
          </div>
        </div>
      </div>
    );
  }
  
  // SETUP SCREEN
  if (appPhase === 'setup') {
    const canStart = myCharacter && myCards.length === cardsPerPlayer && 
                     remainderCards.length === remainderCount;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">Setup: Clue</h1>
            <p className="text-slate-400">BoardBrain™ - More Brain. Better Game.</p>
          </div>

          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white">Game Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-white mb-2 block">Number of Players</Label>
                <select 
                  className="w-full bg-slate-900 border-slate-700 text-white p-2 rounded border"
                  value={numPlayers}
                  onChange={(e) => {
                    const num = parseInt(e.target.value);
                    setNumPlayers(num);
                    setPlayerNames(['You', ...Array(num-1).fill(0).map((_, i) => `Player ${i+2}`)]);
                    setMyCards([]);
                    setRemainderCards([]);
                  }}
                >
                  <option value="3">3 Players</option>
                  <option value="4">4 Players</option>
                  <option value="5">5 Players</option>
                  <option value="6">6 Players</option>
                </select>
                <p className="text-sm text-slate-400 mt-1">
                  You'll get {cardsPerPlayer} cards each{remainderCount > 0 && `, plus ${remainderCount} public card${remainderCount > 1 ? 's' : ''}`}
                </p>
              </div>

              <div>
                <Label className="text-white mb-2 block">Your Character</Label>
                <select
                  className="w-full bg-slate-900 border-slate-700 text-white p-2 rounded border"
                  value={myCharacter}
                  onChange={(e) => {
                    setMyCharacter(e.target.value);
                    setPlayerCharacters({...playerCharacters, 'You': e.target.value});
                  }}
                >
                  <option value="">Select your character</option>
                  {CLUE_DATA.suspects.map(suspect => (
                    <option key={suspect} value={suspect}>{suspect}</option>
                  ))}
                </select>
              </div>
              
              {/* Other Players' Characters */}
              {numPlayers > 1 && (
                <div>
                  <Label className="text-white mb-2 block">Other Players</Label>
                  <div className="space-y-2">
                    {playerNames.slice(1).map((player, idx) => {
                      const playerKey = `player_${idx + 2}`; // Use stable key instead of player name
                      return (
                        <div key={playerKey} className="flex gap-2">
                          <input
                            type="text"
                            placeholder={`Player ${idx + 2} name (e.g., Lisa)`}
                            className="flex-1 bg-slate-900 border-slate-700 text-white p-2 rounded border text-sm"
                            defaultValue={player.startsWith('Player') ? '' : player}
                            onBlur={(e) => {
                              const newName = e.target.value || `Player ${idx + 2}`;
                              const newNames = [...playerNames];
                              const oldName = newNames[idx + 1];
                              newNames[idx + 1] = newName;
                              
                              // Preserve character when name changes
                              if (oldName !== newName && playerCharacters[oldName]) {
                                const newChars = {...playerCharacters};
                                newChars[newName] = newChars[oldName];
                                delete newChars[oldName];
                                setPlayerCharacters(newChars);
                              }
                              
                              setPlayerNames(newNames);
                            }}
                          />
                          <select
                            className="flex-1 bg-slate-900 border-slate-700 text-white p-2 rounded border text-sm"
                            value={playerCharacters[player] || ''}
                            onChange={(e) => {
                              setPlayerCharacters({...playerCharacters, [player]: e.target.value});
                            }}
                          >
                            <option value="">Character (optional)</option>
                            {CLUE_DATA.suspects.filter(s => s !== myCharacter).map(suspect => (
                              <option key={suspect} value={suspect}>{suspect}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Names and characters help track players during the game
                  </p>
                </div>
              )}

              <div>
                <Label className="text-white mb-2 block">Your Cards (Select {cardsPerPlayer})</Label>
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 max-h-64 overflow-y-auto">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-slate-400 mb-2">SUSPECTS</p>
                      <div className="grid grid-cols-2 gap-2">
                        {CLUE_DATA.suspects.map(card => (
                          <label key={card} className="flex items-center space-x-2 text-sm">
                            <Checkbox
                              checked={myCards.includes(card)}
                              onCheckedChange={(checked) => {
                                if (checked && myCards.length < cardsPerPlayer) {
                                  setMyCards([...myCards, card]);
                                } else if (!checked) {
                                  setMyCards(myCards.filter(c => c !== card));
                                }
                              }}
                            />
                            <span>{card}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-xs text-slate-400 mb-2">WEAPONS</p>
                      <div className="grid grid-cols-2 gap-2">
                        {CLUE_DATA.weapons.map(card => (
                          <label key={card} className="flex items-center space-x-2 text-sm">
                            <Checkbox
                              checked={myCards.includes(card)}
                              onCheckedChange={(checked) => {
                                if (checked && myCards.length < cardsPerPlayer) {
                                  setMyCards([...myCards, card]);
                                } else if (!checked) {
                                  setMyCards(myCards.filter(c => c !== card));
                                }
                              }}
                            />
                            <span>{card}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-xs text-slate-400 mb-2">ROOMS</p>
                      <div className="grid grid-cols-2 gap-2">
                        {CLUE_DATA.rooms.map(card => (
                          <label key={card} className="flex items-center space-x-2 text-sm">
                            <Checkbox
                              checked={myCards.includes(card)}
                              onCheckedChange={(checked) => {
                                if (checked && myCards.length < cardsPerPlayer) {
                                  setMyCards([...myCards, card]);
                                } else if (!checked) {
                                  setMyCards(myCards.filter(c => c !== card));
                                }
                              }}
                            />
                            <span>{card}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  Selected: {myCards.length}/{cardsPerPlayer}
                </p>
              </div>

              {remainderCount > 0 && (
                <div>
                  <Label className="text-white mb-2 block">
                    Public/Remainder Cards (Select {remainderCount}) 
                    <span className="text-slate-400 text-sm ml-2">- Visible to all players</span>
                  </Label>
                  <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                    <div className="grid grid-cols-3 gap-2">
                      {ALL_CARDS.filter(card => !myCards.includes(card)).map(card => (
                        <label key={card} className="flex items-center space-x-2 text-sm">
                          <Checkbox
                            checked={remainderCards.includes(card)}
                            onCheckedChange={(checked) => {
                              if (checked && remainderCards.length < remainderCount) {
                                setRemainderCards([...remainderCards, card]);
                              } else if (!checked) {
                                setRemainderCards(remainderCards.filter(c => c !== card));
                              }
                            }}
                          />
                          <span>{card}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    Selected: {remainderCards.length}/{remainderCount}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button
              variant="outline"
              className="border-slate-600 text-slate-300"
              onClick={() => setAppPhase('welcome')}
            >
              Back
            </Button>
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              disabled={!canStart}
              onClick={() => setAppPhase('playing')}
            >
              {canStart ? 'Start Playing →' : 'Complete Setup First'}
            </Button>
          </div>

          <div className="text-center mt-8 text-xs text-slate-500">
            <p>© 2024 Xformative AI LLC. All Rights Reserved. | BoardBrain™</p>
          </div>
        </div>
      </div>
    );
  }
  
  // PLAYING SCREEN
  if (appPhase === 'playing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-4">
            <h1 className="text-3xl font-bold mb-1">BoardBrain™</h1>
            <p className="text-sm text-slate-400">Clue - Turn {moves.length + 1}</p>
            <div className="mt-2 flex justify-center items-center gap-2 text-sm">
              <span className="text-slate-400">Current Turn:</span>
              <span className="text-white font-semibold bg-blue-900 px-3 py-1 rounded">
                → {playerNames[currentTurn % numPlayers]}
              </span>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Left Column - Game Info */}
            <div className="space-y-4">
              {/* My Cards */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-white">My Cards</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {myCards.map(card => (
                      <span key={card} className="px-3 py-1 bg-blue-900 text-blue-200 rounded-full text-sm">
                        {card}
                      </span>
                    ))}
                  </div>
                  {remainderCards.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <p className="text-xs text-slate-400 mb-2">PUBLIC CARDS (Everyone knows):</p>
                      <div className="flex flex-wrap gap-2">
                        {remainderCards.map(card => (
                          <span key={card} className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm">
                            {card}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Log Move */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-white">Log Move</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddMove} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-white text-sm">Who's turn?</Label>
                        <select 
                          className="w-full bg-slate-900 border-slate-700 text-white h-9 p-1 rounded border"
                          value={moveForm.player}
                          onChange={(e) => setMoveForm({...moveForm, player: e.target.value})}
                        >
                          <option value="">Select player</option>
                          {playerNames.map((name, idx) => {
                            const isCurrentPlayer = idx === currentTurn % numPlayers;
                            const characterName = playerCharacters[name] || '';
                            const displayName = characterName ? `${name} (${characterName.split(' ').pop()})` : name;
                            return (
                              <option 
                                key={name} 
                                value={name}
                                disabled={!isCurrentPlayer}
                              >
                                {isCurrentPlayer ? `→ ${displayName}` : displayName}
                              </option>
                            );
                          })}
                        </select>
                        <p className="text-xs text-slate-500 mt-1">
                          Current turn: {playerNames[currentTurn % numPlayers]}
                        </p>
                      </div>
                      
                      <div>
                        <Label className="text-white text-sm">Moved to</Label>
                        <select
                          className="w-full bg-slate-900 border-slate-700 text-white h-9 p-1 rounded border"
                          value={moveForm.movedTo}
                          onChange={(e) => setMoveForm({...moveForm, movedTo: e.target.value, room: e.target.value})}
                        >
                          <option value="">Room</option>
                          {CLUE_DATA.rooms.map(room => (
                            <option key={room} value={room}>{room}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                      <p className="text-sm text-slate-400 mb-2">Suggestion:</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <select
                            className="w-full bg-slate-800 border-slate-600 text-white h-9 p-1 rounded border text-xs"
                            value={moveForm.suspect}
                            onChange={(e) => setMoveForm({...moveForm, suspect: e.target.value})}
                          >
                            <option value="">Suspect</option>
                            {CLUE_DATA.suspects.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <select
                            className="w-full bg-slate-800 border-slate-600 text-white h-9 p-1 rounded border text-xs"
                            value={moveForm.weapon}
                            onChange={(e) => setMoveForm({...moveForm, weapon: e.target.value})}
                          >
                            <option value="">Weapon</option>
                            {CLUE_DATA.weapons.map(w => (
                              <option key={w} value={w}>{w}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Input
                            className="bg-slate-800 border-slate-600 text-white h-9 text-xs"
                            value={moveForm.room || moveForm.movedTo}
                            readOnly
                            placeholder="Room"
                          />
                        </div>
                      </div>
                    </div>

                   <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                      <p className="text-sm text-slate-400 mb-2">Responses:</p>
                      {playerNames.filter(p => p !== moveForm.player).map(player => (
                        <div key={player} className="flex items-center gap-2 mb-2">
                          <span className="text-sm text-white w-32">
                            {playerCharacters[player] ? `${player}: ${playerCharacters[player].split(' ').pop()}` : player}:
                          </span>
                          <select
                            className="flex-1 bg-slate-800 border-slate-600 text-white h-8 p-1 rounded border text-xs"
                            value={moveForm.responses.find(r => r.player === player)?.action || ''}
                            onChange={(e) => {
                              const action = e.target.value;
                              const newResponses = moveForm.responses.filter(r => r.player !== player);
                              if (action) {
                                newResponses.push({ player, action, cardShown: null });
                              }
                              setMoveForm({...moveForm, responses: newResponses});
                            }}
                          >
                            <option value="">Response</option>
                            <option value="PASS">Passed</option>
                            <option value="SHOW">Showed Card</option>
                          </select>
                          
                          {moveForm.responses.find(r => r.player === player)?.action === 'SHOW' && player === 'You' && (
                            <select
                              className="w-32 bg-slate-800 border-slate-600 text-white h-8 p-1 rounded border text-xs"
                              value={moveForm.responses.find(r => r.player === player)?.cardShown || ''}
                              onChange={(e) => {
                                const newResponses = moveForm.responses.map(r => 
                                  r.player === player ? {...r, cardShown: e.target.value} : r
                                );
                                setMoveForm({...moveForm, responses: newResponses});
                              }}
                            >
                              <option value="">Which?</option>
                              {[moveForm.suspect, moveForm.weapon, moveForm.room]
                                .filter(c => myCards.includes(c))
                                .map(card => (
                                  <option key={card} value={card}>{card}</option>
                                ))
                              }
                            </select>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button 
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 h-9"
                      disabled={!moveForm.player || !moveForm.suspect || !moveForm.weapon}
                    >
                      Log This Move
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Move History */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-white">Move History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {moves.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-4">No moves yet</p>
                    ) : (
                      moves.slice().reverse().map((move, idx) => (
                        <div key={moves.length - idx} className="p-2 bg-slate-900 rounded text-sm">
                          <p className="font-semibold text-white">Turn {move.turn}: {move.player}</p>
                          <p className="text-slate-400 text-xs">
                            Suggested: {move.suspect}, {move.weapon}, {move.room}
                          </p>
                          <div className="text-xs text-slate-500 mt-1">
                            {move.responses.map(r => (
                              <span key={r.player} className="mr-2">
                                {r.player}: {r.action === 'PASS' ? 'Pass' : 'Show'}
                                {r.cardShown && ` (${r.cardShown})`}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - AI Analysis */}
            <div className="space-y-4">
              {/* Solution Prediction */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    🧠 AI Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-slate-400">Overall Confidence</span>
                        <span className="text-2xl font-bold text-white">{overallConfidence}%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{width: `${overallConfidence}%`}}
                        />
                      </div>
                    </div>

                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                      <p className="text-sm text-slate-400 mb-2">Most Likely Solution:</p>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-white text-sm">Suspect:</span>
                          <span className="text-blue-400 font-semibold text-sm">
                            {solution.suspect.card || 'Unknown'} ({solution.suspect.prob}%)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white text-sm">Weapon:</span>
                          <span className="text-blue-400 font-semibold text-sm">
                            {solution.weapon.card || 'Unknown'} ({solution.weapon.prob}%)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white text-sm">Room:</span>
                          <span className="text-blue-400 font-semibold text-sm">
                            {solution.room.card || 'Unknown'} ({solution.room.prob}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {overallConfidence >= 85 ? (
                      <Alert className="bg-green-900 border-green-700">
                        <AlertDescription className="text-green-200 text-sm">
                          <strong>HIGH CONFIDENCE!</strong> You should consider making your accusation.
                        </AlertDescription>
                      </Alert>
                    ) : overallConfidence >= 70 ? (
                      <Alert className="bg-yellow-900 border-yellow-700">
                        <AlertDescription className="text-yellow-200 text-sm">
                          <strong>GETTING CLOSE.</strong> Gather a bit more information before accusing.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert className="bg-slate-900 border-slate-700">
                        <AlertDescription className="text-slate-400 text-sm">
                          Keep gathering information. Make strategic suggestions to narrow down possibilities.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Strategic Advice Panel */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    💡 Strategic Advice
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                      <p className="text-xs text-slate-400 mb-2">Next Suggestion:</p>
                      {overallConfidence < 50 ? (
                        <div className="text-sm text-white">
                          <p className="mb-2">Test your <strong>highest probability cards</strong> together:</p>
                          <div className="bg-slate-800 p-2 rounded">
                            <span className="text-blue-400">{solution.suspect.card || 'Unknown Suspect'}</span>
                            {' + '}
                            <span className="text-blue-400">{solution.weapon.card || 'Unknown Weapon'}</span>
                            {' + '}
                            <span className="text-blue-400">{solution.room.card || 'Unknown Room'}</span>
                          </div>
                        </div>
                      ) : overallConfidence < 85 ? (
                        <div className="text-sm text-white">
                          <p>Focus on <strong>uncertain cards</strong> to eliminate possibilities quickly.</p>
                        </div>
                      ) : (
                        <div className="text-sm text-green-300">
                          <p><strong>Ready to accuse!</strong> Confidence is high enough.</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                      <p className="text-xs text-slate-400 mb-1">Remaining Possibilities:</p>
                      <p className="text-2xl font-bold text-white">{probabilities.totalCombinations || 0}</p>
                      <p className="text-xs text-slate-500">valid vault combinations</p>
                    </div>
                    
                    {moves.length >= 3 && (
                      <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                        <p className="text-xs text-slate-400 mb-1">Pro Tip:</p>
                        <p className="text-xs text-slate-300">
                          Watch for cards that appear in multiple constraints - they're more likely to be held by that player!
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Deduction Grid */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-white">Deduction Grid</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Legend */}
                  <div className="mb-4 p-3 bg-slate-900 rounded-lg border border-slate-700">
                    <p className="text-xs text-slate-400 mb-2 font-semibold">LEGEND:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-6 h-6 bg-green-900 border border-green-700 rounded flex items-center justify-center text-green-300">✓</span>
                        <span className="text-slate-300">Has card</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-6 h-6 bg-red-900 border border-red-700 rounded flex items-center justify-center text-red-300">X</span>
                        <span className="text-slate-300">Eliminated</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-6 h-6 bg-yellow-900 border border-yellow-700 rounded flex items-center justify-center text-yellow-300">⚠️</span>
                        <span className="text-slate-300">Constraint (might have)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-6 h-6 bg-slate-800 border border-slate-600 rounded flex items-center justify-center text-slate-500">?</span>
                        <span className="text-slate-300">Unknown</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b-2 border-slate-600">
                          <th className="text-left py-2 px-2 text-slate-400 font-semibold">Card</th>
                          <th className="text-center py-2 px-2 text-slate-400 font-semibold">
                            Me
                            {currentTurn % numPlayers === 0 && <span className="ml-1">→</span>}
                          </th>
                          {playerNames.slice(1).map((name, idx) => (
                            <th key={name} className="text-center py-2 px-2 text-slate-400 font-semibold">
                              {idx + 1}
                              {currentTurn % numPlayers === idx + 1 && <span className="ml-1">→</span>}
                            </th>
                          ))}
                          <th className="text-center py-2 px-2 text-slate-400 font-semibold">Sol</th>
                          <th className="text-center py-2 px-2 text-slate-400 font-semibold">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {['suspects', 'weapons', 'rooms'].map(category => (
                          <React.Fragment key={category}>
                            <tr>
                              <td colSpan={5 + playerNames.length} className="py-1 px-2 text-slate-500 text-xs uppercase bg-slate-900 font-semibold">
                                {category}
                              </td>
                            </tr>
                            {CLUE_DATA[category].map(card => {
                              const cardData = knowledgeMatrix[card] || {};
                              const prob = probabilities[category]?.[card] || 0;
                              
                              // Helper function to get cell class and content
                              const getCellDisplay = (status) => {
                                if (status === 'HAS') {
                                  return { bg: 'bg-green-900 border border-green-700', text: 'text-green-300', symbol: '✓' };
                                } else if (status === 'NO') {
                                  return { bg: 'bg-red-900 border border-red-700', text: 'text-red-300', symbol: 'X' };
                                } else if (status === 'CONSTRAINT') {
                                  return { bg: 'bg-yellow-900 border border-yellow-700', text: 'text-yellow-300', symbol: '⚠️' };
                                } else {
                                  return { bg: 'bg-slate-800 border border-slate-600', text: 'text-slate-500', symbol: '?' };
                                }
                              };
                              
                              // Check if card is eliminated from solution
                              const isEliminated = cardData.me === 'HAS' || cardData.solution === 'NO' || 
                                                   playerNames.slice(1).some(p => cardData[p] === 'HAS');
                              
                              return (
                                <tr key={card} className="border-b border-slate-700/30">
                                  <td className={`py-1 px-2 ${isEliminated ? 'text-slate-600 line-through' : 'text-white'}`}>
                                    {card}
                                  </td>
                                  <td className="text-center py-1 px-1">
                                    <span className={`inline-block w-full py-1 rounded ${getCellDisplay(cardData.me).bg} ${getCellDisplay(cardData.me).text}`}>
                                      {getCellDisplay(cardData.me).symbol}
                                    </span>
                                  </td>
                                  {playerNames.slice(1).map(player => {
                                    const display = getCellDisplay(cardData[player]);
                                    return (
                                      <td key={player} className="text-center py-1 px-1">
                                        <span className={`inline-block w-full py-1 rounded ${display.bg} ${display.text}`}>
                                          {display.symbol}
                                        </span>
                                      </td>
                                    );
                                  })}
                                  <td className="text-center py-1 px-1">
                                    <span className={`inline-block w-full py-1 rounded ${getCellDisplay(cardData.solution === 'NO' ? 'NO' : 'UNKNOWN').bg} ${getCellDisplay(cardData.solution === 'NO' ? 'NO' : 'UNKNOWN').text}`}>
                                      {cardData.solution === 'NO' ? 'X' : '?'}
                                    </span>
                                  </td>
                                  <td className={`text-center py-1 px-2 font-semibold ${
                                    prob >= 80 ? 'text-green-400' : 
                                    prob >= 50 ? 'text-yellow-400' : 
                                    prob > 0 ? 'text-slate-400' : 'text-slate-600'
                                  }`}>
                                    {prob > 0 ? `${prob}%` : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="text-center mt-4 text-xs text-slate-500">
            <p>© 2024 Xformative AI LLC. All Rights Reserved. | BoardBrain™ - More Brain. Better Game.</p>
          </div>
        </div>
      </div>
    );
  }
  
  return null;
}
