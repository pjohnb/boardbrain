import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, Alert, AlertDescription, Checkbox } from './ui-components';

const TIMER_OPTIONS = [15, 30, 45, 60, 90, 120];

/**
 * BoardBrain™
 * © 2024 Xformative AI LLC. All Rights Reserved.
 * 
 * More Brain. Better Game.
 * Your AI Strategy Partner for Board Games
 * 
 * This software and its documentation are proprietary to
 * Xformative AI LLC and protected by copyright law.
 * 
 * BoardBrain is not affiliated with any game publisher.
 * All game names and trademarks are property of their
 * respective owners.
 */

export default function BoardBrain() {
  // App phases: welcome, configure, pricing, lobby, playing
  const [appPhase, setAppPhase] = useState('welcome');
  const [gameId, setGameId] = useState('');
  const [myPlayerId, setMyPlayerId] = useState(null);

  // Game configuration (user-provided)
  const [gameConfig, setGameConfig] = useState(null);
  const [configForm, setConfigForm] = useState({
    gameName: '',
    numSuspects: 6,
    numWeapons: 6,
    numRooms: 9,
    suspects: [],
    weapons: [],
    rooms: []
  });

  // Legal attestation
  const [attestation, setAttestation] = useState({
    ownsGame: false,
    hasPhysicalCopy: false,
    ageVerified: false
  });

  // Game state
  const [players, setPlayers] = useState([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [moves, setMoves] = useState([]);

  // My player data
  const [myPlayerData, setMyPlayerData] = useState({
    name: '',
    character: '',
    timerPreference: 30,
    privateCards: {
      suspects: [],
      weapons: [],
      rooms: []
    }
  });

  // Current move input
  const [currentMove, setCurrentMove] = useState({
    room: '',
    suspectGuess: '',
    weaponGuess: '',
    roomGuess: ''
  });

  // Response to suggestions
  const [responseInput, setResponseInput] = useState({
    passed: false,
    cardShown: ''
  });

  // AI Chat
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  // ============================================================================
  // WELCOME SCREEN
  // ============================================================================
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
                    <div className="text-center p-2 bg-slate-800 rounded">
                      <div className="text-lg mb-1">♟️</div>
                      <div className="text-white font-medium">Chess</div>
                    </div>
                    <div className="text-center p-2 bg-slate-800 rounded">
                      <div className="text-lg mb-1">🏠</div>
                      <div className="text-white font-medium">Catan</div>
                    </div>
                    <div className="text-center p-2 bg-slate-800 rounded">
                      <div className="text-lg mb-1">🚂</div>
                      <div className="text-white font-medium">Ticket to Ride</div>
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
                  onClick={() => setAppPhase('configure')}
                >
                  Start New Game
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                  onClick={() => {
                    const id = prompt('Enter Game ID:');
                    if (id) {
                      setGameId(id);
                      setAppPhase('lobby');
                    }
                  }}
                >
                  Join Friends
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

  // ============================================================================
  // CONFIGURATION SCREEN
  // ============================================================================
  if (appPhase === 'configure') {
    const handleConfigSubmit = (e) => {
      e.preventDefault();
      if (!attestation.ownsGame || !attestation.hasPhysicalCopy || !attestation.ageVerified) {
        alert('Please confirm all attestations to continue.');
        return;
      }
      setGameConfig(configForm);
      setAppPhase('pricing');
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">Configure Your Game</h1>
            <p className="text-slate-400">BoardBrain™ - More Brain. Better Game.</p>
          </div>

          <form onSubmit={handleConfigSubmit}>
            <Card className="bg-slate-800 border-slate-700 mb-6">
              <CardHeader>
                <CardTitle className="text-white">Game Setup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-white">Game Name</Label>
                  <Input
                    className="bg-slate-900 border-slate-700 text-white"
                    placeholder="e.g., Classic Mystery Game"
                    value={configForm.gameName}
                    onChange={(e) => setConfigForm({...configForm, gameName: e.target.value})}
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-white">Suspects</Label>
                    <Input
                      type="number"
                      min="4"
                      max="8"
                      className="bg-slate-900 border-slate-700 text-white"
                      value={configForm.numSuspects}
                      onChange={(e) => {
                        const num = parseInt(e.target.value);
                        setConfigForm({
                          ...configForm,
                          numSuspects: num,
                          suspects: Array(num).fill('')
                        });
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-white">Weapons</Label>
                    <Input
                      type="number"
                      min="4"
                      max="8"
                      className="bg-slate-900 border-slate-700 text-white"
                      value={configForm.numWeapons}
                      onChange={(e) => {
                        const num = parseInt(e.target.value);
                        setConfigForm({
                          ...configForm,
                          numWeapons: num,
                          weapons: Array(num).fill('')
                        });
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-white">Rooms</Label>
                    <Input
                      type="number"
                      min="6"
                      max="12"
                      className="bg-slate-900 border-slate-700 text-white"
                      value={configForm.numRooms}
                      onChange={(e) => {
                        const num = parseInt(e.target.value);
                        setConfigForm({
                          ...configForm,
                          numRooms: num,
                          rooms: Array(num).fill('')
                        });
                      }}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-white mb-2 block">Enter Suspect Names</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Array(configForm.numSuspects).fill(0).map((_, i) => (
                      <Input
                        key={i}
                        className="bg-slate-900 border-slate-700 text-white text-sm"
                        placeholder={`Suspect ${i + 1}`}
                        value={configForm.suspects[i] || ''}
                        onChange={(e) => {
                          const newSuspects = [...configForm.suspects];
                          newSuspects[i] = e.target.value;
                          setConfigForm({...configForm, suspects: newSuspects});
                        }}
                        required
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-white mb-2 block">Enter Weapon Names</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Array(configForm.numWeapons).fill(0).map((_, i) => (
                      <Input
                        key={i}
                        className="bg-slate-900 border-slate-700 text-white text-sm"
                        placeholder={`Weapon ${i + 1}`}
                        value={configForm.weapons[i] || ''}
                        onChange={(e) => {
                          const newWeapons = [...configForm.weapons];
                          newWeapons[i] = e.target.value;
                          setConfigForm({...configForm, weapons: newWeapons});
                        }}
                        required
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-white mb-2 block">Enter Room Names</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Array(configForm.numRooms).fill(0).map((_, i) => (
                      <Input
                        key={i}
                        className="bg-slate-900 border-slate-700 text-white text-sm"
                        placeholder={`Room ${i + 1}`}
                        value={configForm.rooms[i] || ''}
                        onChange={(e) => {
                          const newRooms = [...configForm.rooms];
                          newRooms[i] = e.target.value;
                          setConfigForm({...configForm, rooms: newRooms});
                        }}
                        required
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700 mb-6">
              <CardHeader>
                <CardTitle className="text-white">Legal Attestation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    checked={attestation.ownsGame}
                    onCheckedChange={(checked) => setAttestation({...attestation, ownsGame: checked})}
                  />
                  <Label className="text-sm text-slate-300">
                    I own a physical copy of this board game
                  </Label>
                </div>
                <div className="flex items-start space-x-2">
                  <Checkbox
                    checked={attestation.hasPhysicalCopy}
                    onCheckedChange={(checked) => setAttestation({...attestation, hasPhysicalCopy: checked})}
                  />
                  <Label className="text-sm text-slate-300">
                    I am playing with the physical board and components
                  </Label>
                </div>
                <div className="flex items-start space-x-2">
                  <Checkbox
                    checked={attestation.ageVerified}
                    onCheckedChange={(checked) => setAttestation({...attestation, ageVerified: checked})}
                  />
                  <Label className="text-sm text-slate-300">
                    I am 13 years of age or older
                  </Label>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                className="border-slate-600 text-slate-300"
                onClick={() => setAppPhase('welcome')}
              >
                Back
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Save Configuration & Continue
              </Button>
            </div>
          </form>

          <div className="text-center mt-8 text-xs text-slate-500">
            <p>© 2024 Xformative AI LLC. All Rights Reserved. | BoardBrain™</p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PRICING SCREEN
  // ============================================================================
  if (appPhase === 'pricing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">Choose Your Plan</h1>
            <p className="text-slate-400">BoardBrain™ - More Brain. Better Game.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-slate-800 border-slate-700 hover:border-blue-500 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="text-white text-center">Basic</CardTitle>
                <p className="text-center text-3xl font-bold text-blue-400">$1<span className="text-sm text-slate-400">/player</span></p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li>✓ AI Strategy Partner</li>
                  <li>✓ Real-time Analysis</li>
                  <li>✓ Basic Deduction</li>
                </ul>
                <Button className="w-full mt-4 bg-slate-700 hover:bg-slate-600" onClick={() => setAppPhase('lobby')}>
                  Select Basic
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-blue-500 border-2 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                RECOMMENDED
              </div>
              <CardHeader>
                <CardTitle className="text-white text-center">Standard</CardTitle>
                <p className="text-center text-3xl font-bold text-blue-400">$2<span className="text-sm text-slate-400">/player</span></p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li>✓ Everything in Basic</li>
                  <li>✓ Advanced Pattern Recognition</li>
                  <li>✓ Strategic Recommendations</li>
                </ul>
                <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700" onClick={() => setAppPhase('lobby')}>
                  Select Standard
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700 hover:border-purple-500 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="text-white text-center">Premium</CardTitle>
                <p className="text-center text-3xl font-bold text-purple-400">$3<span className="text-sm text-slate-400">/player</span></p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li>✓ Everything in Standard</li>
                  <li>✓ Priority Processing</li>
                  <li>✓ Game History & Analysis</li>
                </ul>
                <Button className="w-full mt-4 bg-slate-700 hover:bg-slate-600" onClick={() => setAppPhase('lobby')}>
                  Select Premium
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <Button
              variant="outline"
              className="border-slate-600 text-slate-300"
              onClick={() => setAppPhase('configure')}
            >
              Back to Configuration
            </Button>
          </div>

          <div className="text-center mt-8 text-xs text-slate-500">
            <p>© 2024 Xformative AI LLC. All Rights Reserved. | BoardBrain™</p>
            <p className="mt-1">More Brain. Better Game.</p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // LOBBY SCREEN
  // ============================================================================
  if (appPhase === 'lobby') {
    const handleJoinGame = (e) => {
      e.preventDefault();
      const newPlayer = {
        id: Math.random().toString(36).substr(2, 9),
        ...myPlayerData
      };
      setMyPlayerId(newPlayer.id);
      setPlayers([...players, newPlayer]);
    };

    const handleStartGame = () => {
      if (players.length >= 3) {
        setGameStarted(true);
        setAppPhase('playing');
      } else {
        alert('Need at least 3 players to start!');
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">Game Lobby</h1>
            <p className="text-slate-400">BoardBrain™ - More Brain. Better Game.</p>
            {gameId && (
              <div className="mt-4 p-4 bg-slate-800 rounded-lg inline-block">
                <p className="text-sm text-slate-400">Game ID:</p>
                <p className="text-2xl font-mono font-bold text-blue-400">{gameId || 'XK4P9'}</p>
              </div>
            )}
          </div>

          {!myPlayerId ? (
            <form onSubmit={handleJoinGame}>
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Join Game</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-white">Your Name</Label>
                    <Input
                      className="bg-slate-900 border-slate-700 text-white"
                      value={myPlayerData.name}
                      onChange={(e) => setMyPlayerData({...myPlayerData, name: e.target.value})}
                      required
                    />
                  </div>

                  <div>
                    <Label className="text-white">Choose Character</Label>
                    <Select value={myPlayerData.character} onValueChange={(val) => setMyPlayerData({...myPlayerData, character: val})}>
                      <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                        <SelectValue placeholder="Select character" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        {(gameConfig?.suspects || ['Miss Scarlet', 'Professor Plum', 'Mrs. Peacock']).map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-white">Timer Preference (seconds)</Label>
                    <Select value={myPlayerData.timerPreference.toString()} onValueChange={(val) => setMyPlayerData({...myPlayerData, timerPreference: parseInt(val)})}>
                      <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        {TIMER_OPTIONS.map(t => (
                          <SelectItem key={t} value={t.toString()}>{t}s</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-white mb-2 block">Your Cards (Private)</Label>
                    <div className="space-y-2">
                      <Input
                        className="bg-slate-900 border-slate-700 text-white text-sm"
                        placeholder="Suspects (comma-separated)"
                        value={myPlayerData.privateCards.suspects.join(', ')}
                        onChange={(e) => setMyPlayerData({
                          ...myPlayerData,
                          privateCards: {
                            ...myPlayerData.privateCards,
                            suspects: e.target.value.split(',').map(s => s.trim())
                          }
                        })}
                      />
                      <Input
                        className="bg-slate-900 border-slate-700 text-white text-sm"
                        placeholder="Weapons (comma-separated)"
                        value={myPlayerData.privateCards.weapons.join(', ')}
                        onChange={(e) => setMyPlayerData({
                          ...myPlayerData,
                          privateCards: {
                            ...myPlayerData.privateCards,
                            weapons: e.target.value.split(',').map(s => s.trim())
                          }
                        })}
                      />
                      <Input
                        className="bg-slate-900 border-slate-700 text-white text-sm"
                        placeholder="Rooms (comma-separated)"
                        value={myPlayerData.privateCards.rooms.join(', ')}
                        onChange={(e) => setMyPlayerData({
                          ...myPlayerData,
                          privateCards: {
                            ...myPlayerData.privateCards,
                            rooms: e.target.value.split(',').map(s => s.trim())
                          }
                        })}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                    Join Game
                  </Button>
                </CardContent>
              </Card>
            </form>
          ) : (
            <div className="space-y-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Players ({players.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {players.map(p => (
                      <div key={p.id} className="flex justify-between items-center p-3 bg-slate-900 rounded">
                        <div>
                          <p className="font-semibold text-white">{p.name}</p>
                          <p className="text-sm text-slate-400">{p.character}</p>
                        </div>
                        <p className="text-sm text-slate-500">⏱️ {p.timerPreference}s</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
                onClick={handleStartGame}
                disabled={players.length < 3}
              >
                {players.length < 3 ? `Waiting for players (${players.length}/3)` : 'Start Game'}
              </Button>
            </div>
          )}

          <div className="text-center mt-8 text-xs text-slate-500">
            <p>© 2024 Xformative AI LLC. All Rights Reserved. | BoardBrain™</p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PLAYING SCREEN
  // ============================================================================
  if (appPhase === 'playing') {
    const isMyTurn = players[currentTurn]?.id === myPlayerId;
    const currentPlayer = players[currentTurn];

    const handleSubmitMove = () => {
      const newMove = {
        playerId: myPlayerId,
        playerName: myPlayerData.name,
        ...currentMove,
        timestamp: new Date().toISOString()
      };
      setMoves([...moves, newMove]);
      setCurrentMove({ room: '', suspectGuess: '', weaponGuess: '', roomGuess: '' });
      setCurrentTurn((currentTurn + 1) % players.length);

      // Auto-add AI analysis
      setChatMessages([...chatMessages, {
        role: 'assistant',
        content: `Interesting move to ${currentMove.room}. Based on the suggestion (${currentMove.suspectGuess}, ${currentMove.weaponGuess}, ${currentMove.roomGuess}), I'm tracking the responses. Let me analyze the patterns...`
      }]);
    };

    const handleSendChat = () => {
      if (!chatInput.trim()) return;
      setChatMessages([...chatMessages, 
        { role: 'user', content: chatInput },
        { role: 'assistant', content: `Based on the game state, here's my analysis: [AI response would go here based on moves and cards]` }
      ]);
      setChatInput('');
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-1">BoardBrain™</h1>
            <p className="text-slate-400 text-sm">More Brain. Better Game.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Game State */}
            <div className="space-y-4">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">
                    {isMyTurn ? '🎯 YOUR TURN!' : `⏸️ Waiting for ${currentPlayer?.name}...`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isMyTurn ? (
                    <div className="space-y-3">
                      <Select value={currentMove.room} onValueChange={(val) => setCurrentMove({...currentMove, room: val, roomGuess: val})}>
                        <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                          <SelectValue placeholder="Room you moved to" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700">
                          {(gameConfig?.rooms || ['Kitchen', 'Library']).map(r => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={currentMove.suspectGuess} onValueChange={(val) => setCurrentMove({...currentMove, suspectGuess: val})}>
                        <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                          <SelectValue placeholder="Suspect guess" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700">
                          {(gameConfig?.suspects || []).map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={currentMove.weaponGuess} onValueChange={(val) => setCurrentMove({...currentMove, weaponGuess: val})}>
                        <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                          <SelectValue placeholder="Weapon guess" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700">
                          {(gameConfig?.weapons || []).map(w => (
                            <SelectItem key={w} value={w}>{w}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleSubmitMove}>
                        Submit Move
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <p>Waiting for other players...</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Recent Moves</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {moves.slice(-5).reverse().map((move, i) => (
                      <div key={i} className="p-2 bg-slate-900 rounded text-sm">
                        <p className="font-semibold text-white">{move.playerName}</p>
                        <p className="text-slate-400">{move.suspectGuess}, {move.weaponGuess}, {move.roomGuess}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: AI Chat */}
            <div>
              <Card className="bg-slate-800 border-slate-700 h-full flex flex-col">
                <CardHeader>
                  <CardTitle className="text-white">🧠 Your AI Partner</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`p-3 rounded ${msg.role === 'user' ? 'bg-blue-900' : 'bg-slate-900'}`}>
                        <p className="text-sm text-white">{msg.content}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      className="bg-slate-900 border-slate-700 text-white"
                      placeholder="Ask your AI partner..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                    />
                    <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSendChat}>
                      Send
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="text-center mt-6 text-xs text-slate-500">
            <p>© 2024 Xformative AI LLC. All Rights Reserved. | BoardBrain™ - More Brain. Better Game.</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
