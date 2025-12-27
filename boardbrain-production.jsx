import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Brain, Users, Trophy, Shield, Zap } from 'lucide-react';

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
  const [gamePhase, setGamePhase] = useState('setup'); // 'setup', 'playing', 'gameOver'
  
  // Setup state
  const [numPlayers, setNumPlayers] = useState(null);
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
    const playerNames = Array.from({ length: numPlayers }, (_, i) => `Player ${i + 1}`);
    
    ALL_CARDS.forEach(card => {
      matrix[card] = {
        solution: '?',
        ...Object.fromEntries(playerNames.map(p => [p, '?']))
      };
      
      // Mark my cards
      if (myCards.includes(card)) {
        matrix[card][myCharacter] = 'HAS';
        matrix[card].solution = 'NO';
      }
      
      // Mark remainder cards
      if (remainderCards.includes(card)) {
        playerNames.forEach(p => matrix[card][p] = 'NO');
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
    const playerNames = Array.from({ length: numPlayers }, (_, i) => `Player ${i + 1}`);
    
    // Start with player after suggester
    const suggesterIndex = parseInt(suggester.split(' ')[1]) - 1;
    const responseOrder = [
      ...playerNames.slice(suggesterIndex + 1),
      ...playerNames.slice(0, suggesterIndex)
    ];
    
    responseOrder.forEach(player => {
      const response = responses[player];
      
      if (response === 'passed') {
        // Player doesn't have any of the three cards
        [suspect, weapon, room].forEach(card => {
          newMatrix[card][player] = 'NO';
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

  // ============================================================================
  // SETUP SCREEN
  // ============================================================================
  if (gamePhase === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
              BoardBrain™
            </h1>
            <p className="text-xl text-slate-300">More Brain. Better Game.</p>
          </div>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Game Setup - Clue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Number of Players */}
              <div>
                <Label className="text-slate-200 mb-2 block">Number of Players</Label>
                <select
                  className="w-full bg-slate-700 text-white border-slate-600 rounded-md p-2"
                  value={numPlayers || ''}
                  onChange={(e) => setNumPlayers(parseInt(e.target.value))}
                >
                  <option value="">Select number of players</option>
                  <option value="3">3 Players</option>
                  <option value="4">4 Players</option>
                  <option value="5">5 Players</option>
                  <option value="6">6 Players</option>
                </select>
              </div>

              {/* My Character */}
              {numPlayers && (
                <div>
                  <Label className="text-slate-200 mb-2 block">Your Character</Label>
                  <select
                    className="w-full bg-slate-700 text-white border-slate-600 rounded-md p-2"
                    value={myCharacter}
                    onChange={(e) => setMyCharacter(e.target.value)}
                  >
                    <option value="">Select your character</option>
                    {CLUE_DATA.suspects.map(suspect => (
                      <option key={suspect} value={suspect}>{suspect}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* My Cards */}
              {numPlayers && myCharacter && (
                <div>
                  <Label className="text-slate-200 mb-3 block">
                    Your Cards (Select {cardsPerPlayer})
                  </Label>
                  
                  {/* SUSPECTS - WITH FIX */}
                  <div className="mb-4">
                    <p className="text-xs text-slate-400 mb-2">SUSPECTS</p>
                    <div className="grid grid-cols-2 gap-2">
                      {CLUE_DATA.suspects.map(card => {
                        const isSelected = myCards.includes(card);
                        const isDisabled = !isSelected && myCards.length >= cardsPerPlayer;
                        
                        return (
                          <label key={card} className="flex items-center space-x-2 text-sm">
                            <Checkbox
                              checked={isSelected}
                              disabled={isDisabled}
                              onCheckedChange={() => {
                                if (isSelected) {
                                  // Currently selected, so remove it
                                  setMyCards(myCards.filter(c => c !== card));
                                } else {
                                  // Currently not selected, so add it
                                  setMyCards([...myCards, card]);
                                }
                              }}
                            />
                            <span className={isDisabled ? 'text-slate-500' : 'text-slate-200'}>
                              {card}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* WEAPONS - WITH FIX */}
                  <div className="mb-4">
                    <p className="text-xs text-slate-400 mb-2">WEAPONS</p>
                    <div className="grid grid-cols-2 gap-2">
                      {CLUE_DATA.weapons.map(card => {
                        const isSelected = myCards.includes(card);
                        const isDisabled = !isSelected && myCards.length >= cardsPerPlayer;
                        
                        return (
                          <label key={card} className="flex items-center space-x-2 text-sm">
                            <Checkbox
                              checked={isSelected}
                              disabled={isDisabled}
                              onCheckedChange={() => {
                                if (isSelected) {
                                  setMyCards(myCards.filter(c => c !== card));
                                } else {
                                  setMyCards([...myCards, card]);
                                }
                              }}
                            />
                            <span className={isDisabled ? 'text-slate-500' : 'text-slate-200'}>
                              {card}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* ROOMS - WITH FIX */}
                  <div className="mb-4">
                    <p className="text-xs text-slate-400 mb-2">ROOMS</p>
                    <div className="grid grid-cols-2 gap-2">
                      {CLUE_DATA.rooms.map(card => {
                        const isSelected = myCards.includes(card);
                        const isDisabled = !isSelected && myCards.length >= cardsPerPlayer;
                        
                        return (
                          <label key={card} className="flex items-center space-x-2 text-sm">
                            <Checkbox
                              checked={isSelected}
                              disabled={isDisabled}
                              onCheckedChange={() => {
                                if (isSelected) {
                                  setMyCards(myCards.filter(c => c !== card));
                                } else {
                                  setMyCards([...myCards, card]);
                                }
                              }}
                            />
                            <span className={isDisabled ? 'text-slate-500' : 'text-slate-200'}>
                              {card}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-sm text-slate-400">
                    Selected: {myCards.length}/{cardsPerPlayer}
                  </p>
                </div>
              )}

              {/* Public/Remainder Cards */}
              {numPlayers && myCharacter && myCards.length === cardsPerPlayer && remainderCount > 0 && (
                <div>
                  <Label className="text-slate-200 mb-3 block">
                    Public/Remainder Cards (Select {remainderCount})
                  </Label>
                  <div className="space-y-2">
                    {ALL_CARDS.filter(card => !myCards.includes(card)).map(card => {
                      const isSelected = remainderCards.includes(card);
                      const isDisabled = !isSelected && remainderCards.length >= remainderCount;
                      
                      return (
                        <label key={card} className="flex items-center space-x-2 text-sm">
                          <Checkbox
                            checked={isSelected}
                            disabled={isDisabled}
                            onCheckedChange={() => {
                              if (isSelected) {
                                setRemainderCards(remainderCards.filter(c => c !== card));
                              } else {
                                setRemainderCards([...remainderCards, card]);
                              }
                            }}
                          />
                          <span className={isDisabled ? 'text-slate-500' : 'text-slate-200'}>
                            {card}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-sm text-slate-400 mt-2">
                    Selected: {remainderCards.length}/{remainderCount}
                  </p>
                </div>
              )}

              {/* Start Button */}
              <Button
                onClick={startPlaying}
                disabled={
                  !numPlayers ||
                  !myCharacter ||
                  myCards.length !== cardsPerPlayer ||
                  (remainderCount > 0 && remainderCards.length !== remainderCount)
                }
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                Start Playing →
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PLAYING SCREEN
  // ============================================================================
  if (gamePhase === 'playing') {
    const playerNames = Array.from({ length: numPlayers }, (_, i) => `Player ${i + 1}`);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-1 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
              BoardBrain™
            </h1>
            <p className="text-slate-400">Turn {currentTurn} • Playing as {myCharacter}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Deduction Grid */}
            <div className="lg:col-span-2">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Deduction Grid</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left p-2 text-slate-300">Card</th>
                          {playerNames.map(p => (
                            <th key={p} className="p-2 text-slate-300">{p.split(' ')[1]}</th>
                          ))}
                          <th className="p-2 text-slate-300">Sol</th>
                          <th className="p-2 text-slate-300">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {['suspects', 'weapons', 'rooms'].map(category => (
                          <React.Fragment key={category}>
                            <tr className="bg-slate-700/50">
                              <td colSpan={numPlayers + 3} className="p-2 text-slate-400 font-semibold uppercase text-xs">
                                {category}
                              </td>
                            </tr>
                            {CLUE_DATA[category].map(card => (
                              <tr key={card} className="border-b border-slate-700/50">
                                <td className="p-2 text-slate-200">{card}</td>
                                {playerNames.map(p => (
                                  <td key={p} className="p-2 text-center">
                                    <span className={
                                      knowledgeMatrix[card]?.[p] === 'HAS' ? 'text-green-400 font-bold' :
                                      knowledgeMatrix[card]?.[p] === 'NO' ? 'text-red-400' :
                                      'text-slate-500'
                                    }>
                                      {knowledgeMatrix[card]?.[p] === 'HAS' ? '✓' :
                                       knowledgeMatrix[card]?.[p] === 'NO' ? '✗' : '?'}
                                    </span>
                                  </td>
                                ))}
                                <td className="p-2 text-center">
                                  <span className={
                                    knowledgeMatrix[card]?.solution === 'YES' ? 'text-yellow-400 font-bold' :
                                    knowledgeMatrix[card]?.solution === 'NO' ? 'text-red-400' :
                                    'text-slate-500'
                                  }>
                                    {knowledgeMatrix[card]?.solution === 'YES' ? '★' :
                                     knowledgeMatrix[card]?.solution === 'NO' ? '✗' : '?'}
                                  </span>
                                </td>
                                <td className="p-2 text-center text-slate-300">
                                  {probabilities[category]?.[card] || '0.0'}
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Input Forms */}
            <div className="space-y-6">
              {/* Log Move */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Log Move</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-slate-200 text-xs">Who Made Suggestion?</Label>
                    <select
                      className="w-full bg-slate-700 text-white text-sm p-2 rounded"
                      value={moveInput.suggester}
                      onChange={(e) => setMoveInput({...moveInput, suggester: e.target.value})}
                    >
                      <option value="">Select player</option>
                      {playerNames.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="text-slate-200 text-xs">Suspect</Label>
                    <select
                      className="w-full bg-slate-700 text-white text-sm p-2 rounded"
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
                    <Label className="text-slate-200 text-xs">Weapon</Label>
                    <select
                      className="w-full bg-slate-700 text-white text-sm p-2 rounded"
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
                    <Label className="text-slate-200 text-xs">Room</Label>
                    <select
                      className="w-full bg-slate-700 text-white text-sm p-2 rounded"
                      value={moveInput.room}
                      onChange={(e) => setMoveInput({...moveInput, room: e.target.value})}
                    >
                      <option value="">Select room</option>
                      {CLUE_DATA.rooms.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  {/* Player Responses */}
                  {moveInput.suggester && (
                    <div className="space-y-2">
                      <Label className="text-slate-200 text-xs">Player Responses</Label>
                      {playerNames.filter(p => p !== moveInput.suggester).map(p => (
                        <div key={p} className="flex items-center justify-between">
                          <span className="text-slate-300 text-xs">{p}</span>
                          <select
                            className="bg-slate-700 text-white text-xs p-1 rounded"
                            value={moveInput.responses[p] || ''}
                            onChange={(e) => setMoveInput({
                              ...moveInput,
                              responses: {...moveInput.responses, [p]: e.target.value}
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

                  <Button
                    onClick={logMove}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={!moveInput.suggester || !moveInput.suspect || !moveInput.weapon || !moveInput.room}
                  >
                    Log Move
                  </Button>
                </CardContent>
              </Card>

              {/* Card Reveal Event */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">🎴 Card Reveal Event</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-slate-400">
                    Special card forces a player to reveal a card publicly
                  </p>
                  
                  <div>
                    <Label className="text-slate-200 text-xs">Card Revealed</Label>
                    <select
                      className="w-full bg-slate-700 text-white text-sm p-2 rounded"
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
                    <Label className="text-slate-200 text-xs">Player Has It</Label>
                    <select
                      className="w-full bg-slate-700 text-white text-sm p-2 rounded"
                      value={revealInput.player}
                      onChange={(e) => setRevealInput({...revealInput, player: e.target.value})}
                    >
                      <option value="">Select player</option>
                      {playerNames.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <Button
                    onClick={logCardReveal}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                    disabled={!revealInput.card || !revealInput.player}
                  >
                    Log Card Reveal
                  </Button>
                </CardContent>
              </Card>

              {/* Move History */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Move History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {moves.length === 0 ? (
                      <p className="text-slate-400 text-sm">No moves yet</p>
                    ) : (
                      moves.slice().reverse().map((move, idx) => (
                        <div key={idx} className={`p-2 rounded text-xs ${move.type === 'reveal' ? 'bg-purple-900/30' : 'bg-slate-700/50'}`}>
                          <div className="font-semibold text-slate-200">
                            Turn {move.turn}
                            {move.type === 'reveal' && ' 🎴'}
                          </div>
                          {move.type === 'reveal' ? (
                            <div className="text-slate-300">
                              {move.player} has: {move.card}
                            </div>
                          ) : (
                            <>
                              <div className="text-slate-300">
                                {move.suggester}: {move.suggestion.suspect}, {move.suggestion.weapon}, {move.suggestion.room}
                              </div>
                              <div className="text-slate-400 text-xs">
                                {Object.entries(move.responses).map(([p, r]) => `${p}: ${r}`).join(', ')}
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* End Game Button */}
              <Button
                onClick={() => setGamePhase('gameOver')}
                variant="outline"
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                End Game
              </Button>
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8 flex items-center justify-center">
        <Card className="bg-slate-800 border-slate-700 max-w-md">
          <CardHeader>
            <CardTitle className="text-white text-center text-2xl">Game Over</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-slate-300">Thanks for playing with BoardBrain™!</p>
            <Button
              onClick={() => {
                setGamePhase('setup');
                setNumPlayers(null);
                setMyCharacter('');
                setMyCards([]);
                setRemainderCards([]);
                setCurrentTurn(1);
                setMoves([]);
                setKnowledgeMatrix({});
                setProbabilities({});
              }}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              New Game
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}
