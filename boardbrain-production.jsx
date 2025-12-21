import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

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

  // Payment tracking
  const [paymentStatus, setPaymentStatus] = useState({
    hasPaid: false,
    amount: 0,
    playerId: null
  });

  // Game state
  const [gameState, setGameState] = useState({
    maxPlayers: 6,
    players: [],
    turns: [],
    currentTurnIndex: 0,
    avgTimerSeconds: 45,
    awaitingResponses: false,
    currentTurnData: null,
    gameConfig: null
  });

  // Player registration
  const [regForm, setRegForm] = useState({
    name: '',
    character: '',
    timerPref: 45,
    cardsSuspects: '',
    cardsWeapons: '',
    cardsRooms: ''
  });

  // Move entry
  const [moveForm, setMoveForm] = useState({
    room: '',
    suspect: '',
    weapon: '',
    roomGuessed: ''
  });

  // Response tracking
  const [myResponse, setMyResponse] = useState(null);
  const [cardShown, setCardShown] = useState('');
  
  // Timer
  const [countdown, setCountdown] = useState(null);
  const timerRef = useRef(null);

  // Claude chat
  const [chatMessages, setChatMessages] = useState([]);
  const [userMessage, setUserMessage] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  // Generate random game ID
  const generateGameId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // Initialize config form arrays
  useEffect(() => {
    if (configForm.numSuspects > 0) {
      setConfigForm(prev => ({
        ...prev,
        suspects: Array(prev.numSuspects).fill('').map((_, i) => prev.suspects[i] || ''),
        weapons: Array(prev.numWeapons).fill('').map((_, i) => prev.weapons[i] || ''),
        rooms: Array(prev.numRooms).fill('').map((_, i) => prev.rooms[i] || '')
      }));
    }
  }, [configForm.numSuspects, configForm.numWeapons, configForm.numRooms]);

  // Save game configuration
  const saveGameConfig = () => {
    // Validate all fields filled
    const allSuspectsFilled = configForm.suspects.every(s => s.trim());
    const allWeaponsFilled = configForm.weapons.every(w => w.trim());
    const allRoomsFilled = configForm.rooms.every(r => r.trim());

    if (!configForm.gameName || !allSuspectsFilled || !allWeaponsFilled || !allRoomsFilled) {
      alert('Please fill in all fields before saving!');
      return;
    }

    if (!attestation.ownsGame || !attestation.hasPhysicalCopy || !attestation.ageVerified) {
      alert('Please confirm all attestations to continue.');
      return;
    }

    const config = {
      gameName: configForm.gameName,
      suspects: configForm.suspects,
      weapons: configForm.weapons,
      rooms: configForm.rooms,
      createdAt: Date.now()
    };

    setGameConfig(config);
    
    // Save to localStorage for reuse
    const savedConfigs = JSON.parse(localStorage.getItem('boardBrainConfigs') || '[]');
    savedConfigs.push(config);
    localStorage.setItem('boardBrainConfigs', JSON.stringify(savedConfigs));

    setAppPhase('pricing');
  };

  // Load existing config
  const loadConfig = (config) => {
    setGameConfig(config);
    setAppPhase('pricing');
  };

  // Handle payment (mock for now - would integrate Stripe)
  const processPayment = async (amount) => {
    // In production: Stripe checkout
    // For now: mock payment
    
    alert(`Payment processing: $${amount}\n\nIn production, this would use Stripe.\nFor demo: Payment approved!`);
    
    setPaymentStatus({
      hasPaid: true,
      amount: amount,
      playerId: Date.now()
    });

    setAppPhase('lobby');
  };

  // Create new game
  const createNewGame = () => {
    const newGameId = generateGameId();
    setGameId(newGameId);
    setGameState(prev => ({ ...prev, gameConfig }));
    // In production: save to Firebase with gameConfig
  };

  // Join existing game
  const joinGame = (id) => {
    setGameId(id);
    // In production: fetch game config from Firebase
    setGameState(prev => ({ ...prev, gameConfig }));
  };

  // Register as player
  const registerPlayer = () => {
    if (!regForm.name || !regForm.character) {
      alert('Please enter your name and select a character!');
      return;
    }

    const newPlayer = {
      id: Date.now(),
      name: regForm.name,
      character: regForm.character,
      timerPref: regForm.timerPref,
      cards: {
        suspects: regForm.cardsSuspects,
        weapons: regForm.cardsWeapons,
        rooms: regForm.cardsRooms
      },
      cardsShown: [],
      hasResponded: false,
      paymentId: paymentStatus.playerId
    };

    setMyPlayerId(newPlayer.id);
    setGameState(prev => ({
      ...prev,
      players: [...prev.players, newPlayer]
    }));

    const allTimerPrefs = [...gameState.players.map(p => p.timerPref), regForm.timerPref];
    const avgTimer = Math.round(allTimerPrefs.reduce((a, b) => a + b, 0) / allTimerPrefs.length);
    setGameState(prev => ({ ...prev, avgTimerSeconds: avgTimer }));

    setChatMessages([{
      role: 'assistant',
      content: `Hello ${regForm.name}! I'm Claude, your AI detective partner. I'll help you deduce the solution by analyzing all the clues. Ready to play as ${regForm.character}?`
    }]);
  };

  // Start game
  const startGame = () => {
    if (gameState.players.length < 3) {
      alert('Need at least 3 players to start!');
      return;
    }
    setAppPhase('playing');
    updateClaudeWithGameStart();
  };

  // Get current player
  const getCurrentPlayer = () => {
    return gameState.players[gameState.currentTurnIndex % gameState.players.length];
  };

  // Check if it's my turn
  const isMyTurn = () => {
    const currentPlayer = getCurrentPlayer();
    return currentPlayer?.id === myPlayerId;
  };

  // Get my player data
  const getMyPlayer = () => {
    return gameState.players.find(p => p.id === myPlayerId);
  };

  // Submit move
  const submitMove = () => {
    if (!moveForm.room || !moveForm.suspect || !moveForm.weapon || !moveForm.roomGuessed) {
      alert('Please fill in all move details!');
      return;
    }

    const currentPlayer = getCurrentPlayer();
    const newTurn = {
      turnNum: gameState.turns.length + 1,
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      character: currentPlayer.character,
      room: moveForm.room,
      suspect: moveForm.suspect,
      weapon: moveForm.weapon,
      roomGuessed: moveForm.roomGuessed,
      responses: [],
      timestamp: Date.now()
    };

    setGameState(prev => ({
      ...prev,
      turns: [...prev.turns, newTurn],
      awaitingResponses: true,
      currentTurnData: newTurn,
      players: prev.players.map(p => ({ ...p, hasResponded: false }))
    }));

    setMoveForm({ room: '', suspect: '', weapon: '', roomGuessed: '' });
    startCountdown();
  };

  // Submit response
  const submitResponse = (passed) => {
    const myPlayer = getMyPlayer();
    if (!myPlayer) return;

    const response = {
      playerId: myPlayer.id,
      playerName: myPlayer.name,
      action: passed ? 'PASSED' : 'SHOWED',
      cardShown: passed ? null : cardShown
    };

    setGameState(prev => {
      const updatedTurn = { ...prev.currentTurnData };
      updatedTurn.responses.push(response);

      const updatedPlayers = prev.players.map(p => 
        p.id === myPlayer.id ? { ...p, hasResponded: true } : p
      );

      const allResponded = updatedPlayers
        .filter(p => p.id !== updatedTurn.playerId)
        .every(p => p.hasResponded);

      if (allResponded) {
        return {
          ...prev,
          turns: prev.turns.map(t => 
            t.turnNum === updatedTurn.turnNum ? updatedTurn : t
          ),
          awaitingResponses: false,
          currentTurnData: null,
          currentTurnIndex: prev.currentTurnIndex + 1,
          players: updatedPlayers
        };
      }

      return {
        ...prev,
        currentTurnData: updatedTurn,
        players: updatedPlayers
      };
    });

    if (!passed && cardShown) {
      setGameState(prev => ({
        ...prev,
        players: prev.players.map(p => 
          p.id === myPlayer.id 
            ? { ...p, cardsShown: [...p.cardsShown, { turn: gameState.currentTurnData.turnNum, card: cardShown }] }
            : p
        )
      }));
    }

    setMyResponse(passed ? 'passed' : 'showed');
    setCardShown('');
    updateClaudeWithTurn();
  };

  // Timer countdown
  const startCountdown = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    let timeLeft = gameState.avgTimerSeconds;
    setCountdown(timeLeft);

    timerRef.current = setInterval(() => {
      timeLeft--;
      setCountdown(timeLeft);
      if (timeLeft <= 0) clearInterval(timerRef.current);
    }, 1000);
  };

  // Claude integration
  const updateClaudeWithGameStart = () => {
    const myPlayer = getMyPlayer();
    if (!myPlayer) return;

    const startMessage = `The game has begun! You are playing as ${myPlayer.character}.

Your starting cards:
- Suspects: ${myPlayer.cards.suspects || 'none'}
- Weapons: ${myPlayer.cards.weapons || 'none'}
- Rooms: ${myPlayer.cards.rooms || 'none'}

Remember: The solution is one suspect, one weapon, and one room that NO ONE has. I'll track all guesses and responses to help you deduce the answer. Good luck!`;

    setChatMessages(prev => [...prev, { role: 'assistant', content: startMessage }]);
  };

  const updateClaudeWithTurn = async () => {
    const myPlayer = getMyPlayer();
    if (!myPlayer || gameState.turns.length === 0) return;

    const latestTurn = gameState.turns[gameState.turns.length - 1];
    
    let turnSummary = `Turn ${latestTurn.turnNum}: ${latestTurn.playerName} (${latestTurn.character}) moved to ${latestTurn.room}.\n`;
    turnSummary += `Guessed: ${latestTurn.suspect}, ${latestTurn.weapon}, ${latestTurn.roomGuessed}\n`;
    turnSummary += `Responses: `;
    
    if (latestTurn.responses.length > 0) {
      turnSummary += latestTurn.responses.map(r => `${r.playerName} ${r.action}`).join(', ');
    } else {
      turnSummary += 'Waiting...';
    }

    setIsThinking(true);
    
    try {
      const prompt = buildClaudePrompt(myPlayer) + `\n\n${turnSummary}\n\nWhat should I deduce from this turn?`;
      const analysis = await askClaude(prompt);
      
      setChatMessages(prev => [...prev, { role: 'assistant', content: analysis }]);
    } catch (error) {
      console.error('Claude error:', error);
    }
    
    setIsThinking(false);
  };

  const buildClaudePrompt = (player) => {
    let prompt = `You are helping ${player.name} play a mystery deduction game as ${player.character}.\n\n`;
    prompt += `MY STARTING CARDS:\n`;
    if (player.cards.suspects) prompt += `Suspects: ${player.cards.suspects}\n`;
    if (player.cards.weapons) prompt += `Weapons: ${player.cards.weapons}\n`;
    if (player.cards.rooms) prompt += `Rooms: ${player.cards.rooms}\n`;
    
    if (player.cardsShown.length > 0) {
      prompt += `\nCARDS SHOWN TO ME:\n`;
      player.cardsShown.forEach(cs => {
        prompt += `Turn ${cs.turn}: ${cs.card}\n`;
      });
    }

    prompt += `\n=== GAME LOG ===\n`;
    gameState.turns.forEach(t => {
      prompt += `\nTurn ${t.turnNum}: ${t.character} → ${t.room}\n`;
      prompt += `Suggested: ${t.suspect}, ${t.weapon}, ${t.roomGuessed}\n`;
      if (t.responses.length > 0) {
        prompt += `Responses: ${t.responses.map(r => `${r.playerName}-${r.action}`).join(', ')}\n`;
      }
    });

    return prompt;
  };

  const askClaude = async (prompt) => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    return data.content.map(item => item.type === 'text' ? item.text : '').join('\n');
  };

  const sendChatMessage = async () => {
    if (!userMessage.trim()) return;

    const myPlayer = getMyPlayer();
    
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    const fullPrompt = buildClaudePrompt(myPlayer) + `\n\nPlayer question: ${userMessage}`;
    
    setIsThinking(true);
    setUserMessage('');

    try {
      const response = await askClaude(fullPrompt);
      setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      console.error('Claude error:', error);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
    }

    setIsThinking(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ========== RENDER ==========

  // Welcome screen
  if (appPhase === 'welcome') {
    const savedConfigs = JSON.parse(localStorage.getItem('boardBrainConfigs') || '[]');

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <div className="text-6xl mb-4">🧠</div>
            <CardTitle className="text-4xl font-bold mb-2">BoardBrain™</CardTitle>
            <p className="text-2xl text-purple-600 font-semibold mb-3">More Brain. Better Game.</p>
            <p className="text-lg text-gray-600">Your AI Strategy Partner for Board Games</p>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-sm">
                <strong>Welcome!</strong> BoardBrain provides AI-powered strategic assistance for physical board games.
                You must own the physical game to play. This app is a companion tool, not a replacement.
              </AlertDescription>
            </Alert>

            {savedConfigs.length > 0 && (
              <Card className="bg-green-50">
                <CardHeader>
                  <CardTitle className="text-lg">Your Saved Games</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {savedConfigs.map((config, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-white rounded border">
                      <div>
                        <p className="font-semibold">{config.gameName}</p>
                        <p className="text-xs text-gray-500">
                          {config.suspects.length} suspects, {config.weapons.length} weapons, {config.rooms.length} rooms
                        </p>
                      </div>
                      <Button onClick={() => loadConfig(config)} size="sm">
                        Use This
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Button 
              onClick={() => setAppPhase('configure')} 
              className="w-full h-16 text-xl bg-purple-600 hover:bg-purple-700"
            >
              🎮 Configure New Game
            </Button>

            <div className="border-t pt-6 mt-6 space-y-3">
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700">BoardBrain™ | More Brain. Better Game.</p>
                <p className="text-xs text-gray-600">© 2024 Xformative AI LLC. All Rights Reserved.</p>
              </div>
              
              <div className="text-center text-xs text-gray-500 space-y-1">
                <p>BoardBrain™ is not affiliated with or endorsed by any game publisher.</p>
                <p>All game names and trademarks belong to their respective owners.</p>
                <p>Physical game required. Must be 13+ years old.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Game configuration screen
  if (appPhase === 'configure') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4 overflow-y-auto">
        <Card className="max-w-4xl mx-auto mb-8">
          <CardHeader>
            <div className="text-center mb-4">
              <div className="text-5xl mb-2">🧠</div>
              <p className="text-sm text-purple-600 font-semibold">BoardBrain™ | More Brain. Better Game.</p>
            </div>
            <CardTitle className="text-2xl">Configure Your Mystery Deduction Game</CardTitle>
            <p className="text-sm text-gray-500">Enter the suspects, weapons, and rooms from YOUR physical game</p>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <Alert className="bg-yellow-50 border-yellow-300">
              <AlertDescription className="text-sm">
                <strong>⚠️ IMPORTANT:</strong> Enter names from YOUR physical game. BoardBrain does not provide 
                or distribute game content. You must own the physical game and enter your own components.
              </AlertDescription>
            </Alert>

            <div>
              <Label className="text-lg font-semibold">Game Name</Label>
              <Input 
                value={configForm.gameName}
                onChange={(e) => setConfigForm(prev => ({ ...prev, gameName: e.target.value }))}
                placeholder="e.g., Classic Mystery, Master Detective Edition"
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Number of Suspects</Label>
                <Select 
                  value={configForm.numSuspects.toString()} 
                  onValueChange={(v) => setConfigForm(prev => ({ ...prev, numSuspects: parseInt(v) }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[4, 5, 6, 7, 8].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Number of Weapons</Label>
                <Select 
                  value={configForm.numWeapons.toString()} 
                  onValueChange={(v) => setConfigForm(prev => ({ ...prev, numWeapons: parseInt(v) }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[4, 5, 6, 7, 8].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Number of Rooms</Label>
                <Select 
                  value={configForm.numRooms.toString()} 
                  onValueChange={(v) => setConfigForm(prev => ({ ...prev, numRooms: parseInt(v) }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[6, 7, 8, 9, 10, 11, 12].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-red-50">
                <CardHeader>
                  <CardTitle className="text-sm">Suspects (from your game)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {configForm.suspects.map((_, idx) => (
                    <Input 
                      key={idx}
                      value={configForm.suspects[idx]}
                      onChange={(e) => {
                        const newSuspects = [...configForm.suspects];
                        newSuspects[idx] = e.target.value;
                        setConfigForm(prev => ({ ...prev, suspects: newSuspects }));
                      }}
                      placeholder={`Suspect ${idx + 1}`}
                      className="text-sm"
                    />
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-sm">Weapons (from your game)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {configForm.weapons.map((_, idx) => (
                    <Input 
                      key={idx}
                      value={configForm.weapons[idx]}
                      onChange={(e) => {
                        const newWeapons = [...configForm.weapons];
                        newWeapons[idx] = e.target.value;
                        setConfigForm(prev => ({ ...prev, weapons: newWeapons }));
                      }}
                      placeholder={`Weapon ${idx + 1}`}
                      className="text-sm"
                    />
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-green-50">
                <CardHeader>
                  <CardTitle className="text-sm">Rooms (from your game)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {configForm.rooms.map((_, idx) => (
                    <Input 
                      key={idx}
                      value={configForm.rooms[idx]}
                      onChange={(e) => {
                        const newRooms = [...configForm.rooms];
                        newRooms[idx] = e.target.value;
                        setConfigForm(prev => ({ ...prev, rooms: newRooms }));
                      }}
                      placeholder={`Room ${idx + 1}`}
                      className="text-sm"
                    />
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-gray-50 border-2 border-gray-300">
              <CardHeader>
                <CardTitle className="text-sm">Required Attestations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="owns" 
                    checked={attestation.ownsGame}
                    onCheckedChange={(checked) => setAttestation(prev => ({ ...prev, ownsGame: checked }))}
                  />
                  <label htmlFor="owns" className="text-sm">
                    I own a physical copy of this mystery deduction game
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="physical" 
                    checked={attestation.hasPhysicalCopy}
                    onCheckedChange={(checked) => setAttestation(prev => ({ ...prev, hasPhysicalCopy: checked }))}
                  />
                  <label htmlFor="physical" className="text-sm">
                    I am playing with the physical board and components
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="age" 
                    checked={attestation.ageVerified}
                    onCheckedChange={(checked) => setAttestation(prev => ({ ...prev, ageVerified: checked }))}
                  />
                  <label htmlFor="age" className="text-sm">
                    I am 13 years of age or older
                  </label>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button onClick={() => setAppPhase('welcome')} variant="outline" className="flex-1">
                Back
              </Button>
              <Button onClick={saveGameConfig} className="flex-1 bg-green-600 hover:bg-green-700 h-12">
                Save Configuration & Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pricing screen
  if (appPhase === 'pricing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-8 flex items-center justify-center">
        <Card className="max-w-3xl w-full">
          <CardHeader className="text-center">
            <div className="text-5xl mb-3">🧠</div>
            <CardTitle className="text-3xl mb-2">BoardBrain™</CardTitle>
            <p className="text-xl text-purple-600 font-semibold mb-2">More Brain. Better Game.</p>
            <p className="text-gray-500">Pay per player, per game session</p>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-2 hover:border-blue-500 cursor-pointer transition-all">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="text-4xl font-bold text-blue-600">$1</div>
                  <div className="text-sm text-gray-600">per player</div>
                  <div className="text-xs text-gray-500">Basic AI assistance</div>
                  <Button 
                    onClick={() => processPayment(1)}
                    className="w-full bg-blue-600"
                  >
                    Select
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-4 border-green-500 shadow-lg transform scale-105">
                <div className="bg-green-500 text-white text-xs font-bold text-center py-1">
                  RECOMMENDED
                </div>
                <CardContent className="p-6 text-center space-y-4">
                  <div className="text-4xl font-bold text-green-600">$2</div>
                  <div className="text-sm text-gray-600">per player</div>
                  <div className="text-xs text-gray-500">Full AI analysis + chat</div>
                  <Button 
                    onClick={() => processPayment(2)}
                    className="w-full bg-green-600"
                  >
                    Select
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-purple-500 cursor-pointer transition-all">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="text-4xl font-bold text-purple-600">$3</div>
                  <div className="text-sm text-gray-600">per player</div>
                  <div className="text-xs text-gray-500">Premium support</div>
                  <Button 
                    onClick={() => processPayment(3)}
                    className="w-full bg-purple-600"
                  >
                    Select
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Alert className="bg-blue-50">
              <AlertDescription className="text-sm">
                <strong>What you get:</strong> One game session with AI strategy partner. 
                No recurring charges. Pay once, play once.
              </AlertDescription>
            </Alert>

            <div className="text-center text-xs text-gray-500">
              <p>Secure payment powered by Stripe</p>
              <p>Questions? Email support@boardbrain.app</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Lobby
  if (appPhase === 'lobby') {
    const myPlayer = getMyPlayer();
    const canStart = gameState.players.length >= 3 && gameState.players.length <= gameState.maxPlayers;

    if (!gameId) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-8 flex items-center justify-center">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-2xl text-center">Start or Join Game</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={createNewGame} className="w-full h-16 text-xl bg-green-600 hover:bg-green-700">
                🎮 Create New Game
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Join Existing Game</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Enter Game ID"
                    value={gameId}
                    onChange={(e) => setGameId(e.target.value.toUpperCase())}
                    maxLength={6}
                  />
                  <Button onClick={() => joinGame(gameId)} disabled={gameId.length !== 6}>
                    Join
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl">Game Lobby - ID: {gameId}</CardTitle>
                <p className="text-sm text-gray-500">Share this ID with other players to join</p>
                <p className="text-xs text-gray-400 mt-1">Game: {gameConfig?.gameName}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl">🧠</div>
                <p className="text-xs text-purple-600 font-semibold">BoardBrain™</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <Card className="bg-slate-50">
              <CardHeader>
                <CardTitle className="text-lg">Players ({gameState.players.length}/{gameState.maxPlayers})</CardTitle>
              </CardHeader>
              <CardContent>
                {gameState.players.length === 0 ? (
                  <p className="text-gray-500">No players yet</p>
                ) : (
                  <div className="space-y-2">
                    {gameState.players.map((p, idx) => (
                      <div key={p.id} className="p-3 bg-white rounded border flex justify-between items-center">
                        <div>
                          <span className="font-semibold">{idx + 1}. {p.name}</span>
                          <span className="text-gray-500 ml-2">({p.character})</span>
                        </div>
                        <span className="text-xs text-gray-400">Timer pref: {p.timerPref}s</span>
                      </div>
                    ))}
                  </div>
                )}
                {gameState.players.length > 0 && (
                  <div className="mt-4 p-3 bg-blue-50 rounded">
                    <p className="text-sm font-semibold">Average Turn Timer: {gameState.avgTimerSeconds} seconds</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {!myPlayer && (
              <Card className="bg-yellow-50 border-2 border-yellow-400">
                <CardHeader>
                  <CardTitle className="text-lg">Join as Player {gameState.players.length + 1}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Your Name</Label>
                      <Input 
                        value={regForm.name}
                        onChange={(e) => setRegForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter name"
                      />
                    </div>
                    <div>
                      <Label>Character</Label>
                      <Select value={regForm.character} onValueChange={(v) => setRegForm(prev => ({ ...prev, character: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {gameConfig?.suspects.filter(c => !gameState.players.find(p => p.character === c)).map(char => (
                            <SelectItem key={char} value={char}>{char}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Your Preferred Response Timer</Label>
                    <Select value={regForm.timerPref.toString()} onValueChange={(v) => setRegForm(prev => ({ ...prev, timerPref: parseInt(v) }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIMER_OPTIONS.map(t => (
                          <SelectItem key={t} value={t.toString()}>{t} seconds</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="font-semibold text-red-600">🔒 Your Private Cards (comma-separated)</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div>
                        <Label className="text-xs">Suspects</Label>
                        <Input 
                          value={regForm.cardsSuspects}
                          onChange={(e) => setRegForm(prev => ({ ...prev, cardsSuspects: e.target.value }))}
                          placeholder="e.g., Suspect 1"
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Weapons</Label>
                        <Input 
                          value={regForm.cardsWeapons}
                          onChange={(e) => setRegForm(prev => ({ ...prev, cardsWeapons: e.target.value }))}
                          placeholder="e.g., Weapon 1"
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Rooms</Label>
                        <Input 
                          value={regForm.cardsRooms}
                          onChange={(e) => setRegForm(prev => ({ ...prev, cardsRooms: e.target.value }))}
                          placeholder="e.g., Room 1"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <Button onClick={registerPlayer} className="w-full bg-blue-600 hover:bg-blue-700">
                    Register & Join Game
                  </Button>
                </CardContent>
              </Card>
            )}

            {myPlayer && (
              <Button 
                onClick={startGame} 
                disabled={!canStart}
                className="w-full h-16 text-xl bg-green-600 hover:bg-green-700"
              >
                {canStart ? '🎯 Start Game!' : `Waiting for players (need 3-${gameState.maxPlayers})...`}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Playing phase - same as before but uses gameConfig instead of hardcoded values
  if (appPhase === 'playing') {
    const myPlayer = getMyPlayer();
    const currentPlayer = getCurrentPlayer();
    const myTurn = isMyTurn();
    const needsMyResponse = gameState.awaitingResponses && !myTurn && !myPlayer?.hasResponded;

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
        <div className="max-w-6xl mx-auto space-y-4">
          
          <Card className="bg-slate-900 text-white">
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold">Game ID: {gameId}</h2>
                  <p className="text-sm text-gray-300">Turn {gameState.turns.length + 1}</p>
                </div>
                <div className="text-right">
                  {countdown !== null ? (
                    <div className="text-3xl font-bold text-yellow-400">⏱️ {countdown}s</div>
                  ) : (
                    <div>
                      <div className="text-2xl">🧠</div>
                      <p className="text-xs text-purple-400">BoardBrain™</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 space-y-1">
                <p className="text-sm font-semibold text-gray-300">PLAYERS:</p>
                {gameState.players.map((p, idx) => (
                  <div key={p.id} className="flex items-center gap-2">
                    {currentPlayer?.id === p.id && <span className="text-yellow-400">▶</span>}
                    <span className={p.id === myPlayerId ? 'font-bold text-yellow-400' : ''}>
                      {idx + 1}. {p.name} ({p.character})
                    </span>
                    {gameState.awaitingResponses && p.id !== currentPlayer?.id && (
                      <span className="text-xs">{p.hasResponded ? '✓' : '⏳'}</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            <div className="space-y-4">
              
              {myTurn && !gameState.awaitingResponses && (
                <Card className="border-4 border-green-500">
                  <CardHeader className="bg-green-50">
                    <CardTitle className="text-xl">🎯 YOUR TURN, {myPlayer?.name.toUpperCase()}!</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div>
                      <Label>Move To (Room)</Label>
                      <Select value={moveForm.room} onValueChange={(v) => setMoveForm(prev => ({ ...prev, room: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {gameConfig?.rooms.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="border-t pt-4">
                      <Label className="font-semibold">Your Suggestion</Label>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <div>
                          <Label className="text-xs">Suspect</Label>
                          <Select value={moveForm.suspect} onValueChange={(v) => setMoveForm(prev => ({ ...prev, suspect: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {gameConfig?.suspects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Weapon</Label>
                          <Select value={moveForm.weapon} onValueChange={(v) => setMoveForm(prev => ({ ...prev, weapon: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {gameConfig?.weapons.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Room</Label>
                          <Select value={moveForm.roomGuessed} onValueChange={(v) => setMoveForm(prev => ({ ...prev, roomGuessed: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {gameConfig?.rooms.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <Button onClick={submitMove} className="w-full h-12 bg-green-600 hover:bg-green-700">
                      Submit Move
                    </Button>
                  </CardContent>
                </Card>
              )}

              {needsMyResponse && (
                <Card className="border-4 border-yellow-500">
                  <CardHeader className="bg-yellow-50">
                    <CardTitle className="text-xl">📢 {currentPlayer?.name} made a suggestion!</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <Alert>
                      <AlertDescription className="text-lg">
                        <strong>{gameState.currentTurnData?.character}</strong> moved to <strong>{gameState.currentTurnData?.room}</strong>
                        <br />
                        Guessed: <strong>{gameState.currentTurnData?.suspect}, {gameState.currentTurnData?.weapon}, {gameState.currentTurnData?.roomGuessed}</strong>
                      </AlertDescription>
                    </Alert>

                    <div>
                      <Label className="font-semibold">Your Response</Label>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <Button 
                          onClick={() => submitResponse(true)}
                          variant="outline"
                          className="h-16 text-lg"
                        >
                          ❌ I Passed<br />
                          <span className="text-xs">(Don't have any)</span>
                        </Button>
                        <div className="space-y-2">
                          <Input 
                            placeholder="Card name"
                            value={cardShown}
                            onChange={(e) => setCardShown(e.target.value)}
                          />
                          <Button 
                            onClick={() => submitResponse(false)}
                            disabled={!cardShown}
                            className="w-full h-12 bg-blue-600"
                          >
                            ✓ I Showed a Card
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!myTurn && !needsMyResponse && (
                <Card className="bg-slate-50">
                  <CardContent className="p-8 text-center">
                    <p className="text-2xl mb-2">⏸️ Waiting for {currentPlayer?.name}...</p>
                    <p className="text-gray-500">Check your Claude chat for latest analysis</p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Turn History</CardTitle>
                </CardHeader>
                <CardContent className="max-h-96 overflow-y-auto">
                  {gameState.turns.length === 0 ? (
                    <p className="text-gray-500">No turns yet</p>
                  ) : (
                    <div className="space-y-2">
                      {gameState.turns.slice().reverse().map((t) => (
                        <div key={t.turnNum} className="p-3 bg-slate-50 rounded border text-sm">
                          <div className="font-semibold">Turn {t.turnNum}: {t.character} → {t.room}</div>
                          <div>Guessed: {t.suspect}, {t.weapon}, {t.roomGuessed}</div>
                          <div className="text-xs text-gray-600">
                            {t.responses.map(r => `${r.playerName}: ${r.action}`).join(' | ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-slate-900 text-white h-[600px] flex flex-col">
              <CardHeader className="border-b border-gray-700">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    🤖 Claude - Your AI Partner
                    {isThinking && <span className="text-sm text-yellow-400">Thinking...</span>}
                  </div>
                  <div className="text-right text-xs text-purple-400">
                    BoardBrain™
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-lg ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-gray-100'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
              <div className="border-t border-gray-700 p-4">
                <div className="flex gap-2">
                  <Input 
                    value={userMessage}
                    onChange={(e) => setUserMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Ask Claude anything..."
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                  <Button onClick={sendChatMessage} disabled={isThinking}>Send</Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
