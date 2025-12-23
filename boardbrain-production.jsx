import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, Alert, AlertDescription, Checkbox } from './ui-components';

/**
 * BoardBrain™ - More Brain. Better Game.
 * © 2024 Xformative AI LLC. All Rights Reserved.
 */

// Clue game data
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
  const [myCharacter, setMyCharacter] = useState('');
  const [myCards, setMyCards] = useState([]);
  const [remainderCards, setRemainderCards] = useState([]);
  
  // Game state
  const [currentTurn, setCurrentTurn] = useState(0);
  const [moves, setMoves] = useState([]);
  const [knowledgeMatrix, setKnowledgeMatrix] = useState({});
  
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
  
  // Initialize knowledge matrix
  useEffect(() => {
    if (appPhase === 'playing' && Object.keys(knowledgeMatrix).length === 0) {
      const matrix = {};
      ALL_CARDS.forEach(card => {
        matrix[card] = {
          me: myCards.includes(card) ? 'HAS' : 'UNKNOWN',
          solution: remainderCards.includes(card) ? 'NO' : 'UNKNOWN'
        };
        playerNames.slice(1).forEach(player => {
          matrix[card][player] = remainderCards.includes(card) ? 'NO' : 'UNKNOWN';
        });
      });
      setKnowledgeMatrix(matrix);
    }
  }, [appPhase, myCards, remainderCards, playerNames]);
  
  // Process moves to update knowledge
  useEffect(() => {
    if (moves.length === 0) return;
    
    const newMatrix = { ...knowledgeMatrix };
    
    moves.forEach(move => {
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
          } else if (response.action === 'SHOW' && response.cardShown) {
            // Player definitely has this card
            if (newMatrix[response.cardShown]) {
              newMatrix[response.cardShown][response.player] = 'HAS';
              newMatrix[response.cardShown].solution = 'NO';
            }
          }
        });
      }
    });
    
    setKnowledgeMatrix(newMatrix);
  }, [moves]);
  
  // Calculate probabilities
  const calculateProbabilities = () => {
    const probabilities = {
      suspects: {},
      weapons: {},
      rooms: {}
    };
    
    const categories = {
      suspects: CLUE_DATA.suspects,
      weapons: CLUE_DATA.weapons,
      rooms: CLUE_DATA.rooms
    };
    
    Object.entries(categories).forEach(([category, cards]) => {
      cards.forEach(card => {
        if (!knowledgeMatrix[card]) return;
        
        // If I have it or it's a remainder card, 0% in solution
        if (knowledgeMatrix[card].me === 'HAS' || knowledgeMatrix[card].solution === 'NO') {
          probabilities[category][card] = 0;
          return;
        }
        
        // Check if any player definitely has it
        const someoneHasIt = playerNames.slice(1).some(player => 
          knowledgeMatrix[card][player] === 'HAS'
        );
        
        if (someoneHasIt) {
          probabilities[category][card] = 0;
          return;
        }
        
        // Count how many cards in this category are still possible
        const possibleCards = cards.filter(c => {
          if (!knowledgeMatrix[c]) return true;
          if (knowledgeMatrix[c].me === 'HAS' || knowledgeMatrix[c].solution === 'NO') return false;
          return !playerNames.slice(1).some(p => knowledgeMatrix[c][p] === 'HAS');
        });
        
        probabilities[category][card] = possibleCards.length > 0 
          ? Math.round(100 / possibleCards.length) 
          : 0;
      });
    });
    
    return probabilities;
  };
  
  const probabilities = calculateProbabilities();
  
  // Get most likely solution
  const getMostLikelySolution = () => {
    const findMax = (obj) => {
      return Object.entries(obj).reduce((max, [card, prob]) => 
        prob > max.prob ? { card, prob } : max
      , { card: null, prob: 0 });
    };
    
    return {
      suspect: findMax(probabilities.suspects),
      weapon: findMax(probabilities.weapons),
      room: findMax(probabilities.rooms)
    };
  };
  
  const solution = getMostLikelySolution();
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
                <Select value={numPlayers.toString()} onValueChange={(val) => {
                  const num = parseInt(val);
                  setNumPlayers(num);
                  setPlayerNames(['You', ...Array(num-1).fill(0).map((_, i) => `Player ${i+2}`)]);
                  setMyCards([]);
                  setRemainderCards([]);
                }}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="3">3 Players</SelectItem>
                    <SelectItem value="4">4 Players</SelectItem>
                    <SelectItem value="5">5 Players</SelectItem>
                    <SelectItem value="6">6 Players</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-slate-400 mt-1">
                  You'll get {cardsPerPlayer} cards each{remainderCount > 0 && `, plus ${remainderCount} public card${remainderCount > 1 ? 's' : ''}`}
                </p>
              </div>

              <div>
                <Label className="text-white mb-2 block">Your Character</Label>
                <Select value={myCharacter} onValueChange={setMyCharacter}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                    <SelectValue placeholder="Select your character" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {CLUE_DATA.suspects.map(suspect => (
                      <SelectItem key={suspect} value={suspect}>{suspect}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                        <Select value={moveForm.player} onValueChange={(val) => setMoveForm({...moveForm, player: val})}>
                          <SelectTrigger className="bg-slate-900 border-slate-700 text-white h-9">
                            <SelectValue placeholder="Select player" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-700">
                            {playerNames.map(name => (
                              <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label className="text-white text-sm">Moved to</Label>
                        <Select value={moveForm.movedTo} onValueChange={(val) => setMoveForm({...moveForm, movedTo: val, room: val})}>
                          <SelectTrigger className="bg-slate-900 border-slate-700 text-white h-9">
                            <SelectValue placeholder="Room" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-700">
                            {CLUE_DATA.rooms.map(room => (
                              <SelectItem key={room} value={room}>{room}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                      <p className="text-sm text-slate-400 mb-2">Suggestion:</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Select value={moveForm.suspect} onValueChange={(val) => setMoveForm({...moveForm, suspect: val})}>
                            <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9 text-xs">
                              <SelectValue placeholder="Suspect" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700">
                              {CLUE_DATA.suspects.map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Select value={moveForm.weapon} onValueChange={(val) => setMoveForm({...moveForm, weapon: val})}>
                            <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9 text-xs">
                              <SelectValue placeholder="Weapon" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700">
                              {CLUE_DATA.weapons.map(w => (
                                <SelectItem key={w} value={w}>{w}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                          <span className="text-sm text-white w-24">{player}:</span>
                          <Select 
                            value={moveForm.responses.find(r => r.player === player)?.action || ''}
                            onValueChange={(action) => {
                              const newResponses = moveForm.responses.filter(r => r.player !== player);
                              if (action) {
                                newResponses.push({ player, action, cardShown: null });
                              }
                              setMoveForm({...moveForm, responses: newResponses});
                            }}
                          >
                            <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-8 text-xs flex-1">
                              <SelectValue placeholder="Response" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700">
                              <SelectItem value="PASS">Passed</SelectItem>
                              <SelectItem value="SHOW">Showed Card</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          {moveForm.responses.find(r => r.player === player)?.action === 'SHOW' && player === 'You' && (
                            <Select
                              value={moveForm.responses.find(r => r.player === player)?.cardShown || ''}
                              onValueChange={(card) => {
                                const newResponses = moveForm.responses.map(r => 
                                  r.player === player ? {...r, cardShown: card} : r
                                );
                                setMoveForm({...moveForm, responses: newResponses});
                              }}
                            >
                              <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-8 text-xs w-32">
                                <SelectValue placeholder="Which?" />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-900 border-slate-700">
                                {[moveForm.suspect, moveForm.weapon, moveForm.room]
                                  .filter(c => myCards.includes(c))
                                  .map(card => (
                                    <SelectItem key={card} value={card}>{card}</SelectItem>
                                  ))
                                }
                              </SelectContent>
                            </Select>
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

              {/* Deduction Grid */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-white">Deduction Grid</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-1 px-2 text-slate-400">Card</th>
                          <th className="text-center py-1 px-2 text-slate-400">Me</th>
                          {playerNames.slice(1).map(name => (
                            <th key={name} className="text-center py-1 px-2 text-slate-400">{name.slice(0,3)}</th>
                          ))}
                          <th className="text-center py-1 px-2 text-slate-400">Sol</th>
                          <th className="text-center py-1 px-2 text-slate-400">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {['suspects', 'weapons', 'rooms'].map(category => (
                          <React.Fragment key={category}>
                            <tr>
                              <td colSpan={5 + playerNames.length} className="py-1 px-2 text-slate-500 text-xs uppercase bg-slate-900">
                                {category}
                              </td>
                            </tr>
                            {CLUE_DATA[category].map(card => {
                              const cardData = knowledgeMatrix[card] || {};
                              const prob = probabilities[category]?.[card] || 0;
                              return (
                                <tr key={card} className="border-b border-slate-700/50">
                                  <td className="py-1 px-2 text-white">{card}</td>
                                  <td className="text-center py-1 px-2">
                                    {cardData.me === 'HAS' ? '✓' : cardData.me === 'NO' ? 'X' : '?'}
                                  </td>
                                  {playerNames.slice(1).map(player => (
                                    <td key={player} className="text-center py-1 px-2">
                                      {cardData[player] === 'HAS' ? '✓' : cardData[player] === 'NO' ? 'X' : '?'}
                                    </td>
                                  ))}
                                  <td className="text-center py-1 px-2">
                                    {cardData.solution === 'NO' ? 'X' : '?'}
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
