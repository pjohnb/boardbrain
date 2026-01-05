import React, { useState, useEffect, useMemo, useRef } from 'react';

/**
 * BoardBrain™ Control Room v3 - Mission Control for Clue Players
 * Copyright © 2024-2026 Pat Boulay / Xformative AI. All Rights Reserved.
 * 
 * "Everyone has an AI-aided secret!"
 */

// Demo game state - simulates mid-game scenario with rich evidence trails
const DEMO_STATE = {
  turn: 7,
  myCards: ['Colonel Mustard', 'Knife', 'Library', 'Mrs. White'],
  publicCards: ['Hall', 'Revolver'],  // Remainder cards everyone can see
  players: ['You', 'Lisa', 'Matthew', 'Ann'],
  
  // Probability distributions with detailed evidence trails
  suspects: {
    'Col. Mustard': { 
      prob: 0, 
      status: 'mine', 
      evidence: [
        { type: 'hand', text: 'In my hand at game start' }
      ]
    },
    'Miss Scarlet': { 
      prob: 42, 
      status: 'possible', 
      evidence: [
        { type: 'constraint', text: 'T2: Ann showed one of [Lead Pipe, Kitchen, Miss Scarlet]' },
        { type: 'constraint', text: 'T5: Matthew showed one of [Rope, Ballroom, Miss Scarlet]' },
        { type: 'analysis', text: 'Appears in 2 constraints but never directly eliminated' },
        { type: 'calc', text: '→ 42% probability in envelope' }
      ]
    },
    'Prof. Plum': { 
      prob: 8, 
      status: 'unlikely', 
      evidence: [
        { type: 'constraint', text: 'T1: Lisa showed one of [Wrench, Study, Prof. Plum]' },
        { type: 'constraint', text: 'T6: Matthew showed one of [Lounge, Prof. Plum, Revolver]' },
        { type: 'analysis', text: 'In 2 constraints with different players → likely one of them has it' },
        { type: 'calc', text: '→ 8% probability in envelope' }
      ]
    },
    'Mr. Green': { 
      prob: 38, 
      status: 'possible', 
      evidence: [
        { type: 'constraint', text: 'T4: Ann showed one of [Dining Room, Mr. Green, Candlestick]' },
        { type: 'analysis', text: 'Only 1 constraint. Other cards: Dining Room (later eliminated), Candlestick (still possible)' },
        { type: 'calc', text: '→ 38% probability in envelope' }
      ]
    },
    'Mrs. White': { 
      prob: 0, 
      status: 'mine', 
      evidence: [
        { type: 'hand', text: 'In my hand at game start' }
      ]
    },
    'Mrs. Peacock': { 
      prob: 0, 
      status: 'eliminated', 
      evidence: [
        { type: 'shown', text: 'T3: Lisa showed Mrs. Peacock directly to me' },
        { type: 'result', text: '→ ELIMINATED: Lisa has this card' }
      ]
    },
  },
  weapons: {
    'Candlestick': { 
      prob: 67, 
      status: 'likely', 
      evidence: [
        { type: 'constraint', text: 'T4: Ann showed one of [Dining Room, Mr. Green, Candlestick]' },
        { type: 'analysis', text: 'Only 1 weak constraint in 7 turns' },
        { type: 'analysis', text: 'Other weapons tested: Knife(mine), Lead Pipe(T2-elim), Revolver(T6), Rope(T3,T5-elim), Wrench(T1-elim)' },
        { type: 'calc', text: '→ 67% probability in envelope (highest weapon)' }
      ]
    },
    'Knife': { 
      prob: 0, 
      status: 'mine', 
      evidence: [
        { type: 'hand', text: 'In my hand at game start' }
      ]
    },
    'Lead Pipe': { 
      prob: 0, 
      status: 'eliminated', 
      evidence: [
        { type: 'shown', text: 'T2: Ann showed Lead Pipe directly to me' },
        { type: 'context', text: 'Suggestion was [Lead Pipe, Kitchen, Miss Scarlet]' },
        { type: 'result', text: '→ ELIMINATED: Ann has this card' }
      ]
    },
    'Revolver': { 
      prob: 18, 
      status: 'possible', 
      evidence: [
        { type: 'constraint', text: 'T6: Matthew showed one of [Lounge, Prof. Plum, Revolver]' },
        { type: 'analysis', text: 'Lounge was later deduced as Matthew\'s card' },
        { type: 'analysis', text: 'Remaining possibilities: Prof. Plum or Revolver from this constraint' },
        { type: 'calc', text: '→ 18% probability in envelope' }
      ]
    },
    'Rope': { 
      prob: 0, 
      status: 'eliminated', 
      evidence: [
        { type: 'constraint', text: 'T3: Lisa showed one of [Mrs. Peacock, Study, Rope]' },
        { type: 'shown', text: 'T5: Matthew showed Rope directly to me' },
        { type: 'context', text: 'T5 suggestion was [Rope, Ballroom, Miss Scarlet]' },
        { type: 'result', text: '→ ELIMINATED: Matthew has this card' }
      ]
    },
    'Wrench': { 
      prob: 0, 
      status: 'eliminated', 
      evidence: [
        { type: 'constraint', text: 'T1: Lisa showed one of [Wrench, Study, Prof. Plum]' },
        { type: 'constraint', text: 'T3: Lisa showed one of [Mrs. Peacock, Study, Rope] — Study appears again!' },
        { type: 'deduction', text: 'CROSS-REFERENCE: Study is the only card in both T1 and T3 constraints' },
        { type: 'deduction', text: '→ Lisa must have Study (common card in both showings)' },
        { type: 'deduction', text: '→ T1 constraint now: Lisa showed one of [Wrench, Prof. Plum]' },
        { type: 'shown', text: 'Later confirmed: Lisa showed Wrench on T1' },
        { type: 'result', text: '→ ELIMINATED: Lisa has this card' }
      ]
    },
  },
  rooms: {
    'Kitchen': { 
      prob: 31, 
      status: 'possible', 
      evidence: [
        { type: 'constraint', text: 'T2: Ann showed one of [Lead Pipe, Kitchen, Miss Scarlet]' },
        { type: 'analysis', text: 'Lead Pipe was directly shown (eliminated from constraint)' },
        { type: 'analysis', text: 'Remaining: Ann showed Kitchen OR Miss Scarlet on T2' },
        { type: 'calc', text: '→ 31% probability in envelope' }
      ]
    },
    'Ballroom': { 
      prob: 8, 
      status: 'unlikely', 
      evidence: [
        { type: 'constraint', text: 'T5: Matthew showed one of [Rope, Ballroom, Miss Scarlet]' },
        { type: 'analysis', text: 'Rope was directly shown to me (eliminated from constraint)' },
        { type: 'analysis', text: 'Remaining: Matthew showed Ballroom OR Miss Scarlet on T5' },
        { type: 'calc', text: '→ 8% probability in envelope' }
      ]
    },
    'Conservatory': { 
      prob: 45, 
      status: 'likely', 
      evidence: [
        { type: 'analysis', text: 'NEVER SUGGESTED in 7 turns' },
        { type: 'context', text: 'Rooms tested so far: Kitchen(T2), Ballroom(T5), Dining Room(T4), Lounge(T6), Study(T1,T3)' },
        { type: 'context', text: 'Rooms never tested: Conservatory, Billiard Room, Hall' },
        { type: 'analysis', text: 'No constraints = no evidence against it' },
        { type: 'calc', text: '→ 45% probability in envelope (highest untested room)' }
      ]
    },
    'Dining Room': { 
      prob: 0, 
      status: 'eliminated', 
      evidence: [
        { type: 'constraint', text: 'T4: Ann showed one of [Dining Room, Mr. Green, Candlestick]' },
        { type: 'deduction', text: 'DEDUCTION: Ann already showed on T2 from [Lead Pipe, Kitchen, Scarlet]' },
        { type: 'deduction', text: 'Ann has shown 3 times (T2, T4, and one more) — tracking card overlap...' },
        { type: 'deduction', text: 'Cross-referencing Ann\'s constraints reveals Dining Room as only unique card' },
        { type: 'result', text: '→ ELIMINATED: Ann has this card' }
      ]
    },
    'Billiard Room': { 
      prob: 12, 
      status: 'possible', 
      evidence: [
        { type: 'analysis', text: 'NEVER SUGGESTED in 7 turns' },
        { type: 'context', text: 'Lower probability than Conservatory due to player position analysis' },
        { type: 'calc', text: '→ 12% probability in envelope' }
      ]
    },
    'Library': { 
      prob: 0, 
      status: 'mine', 
      evidence: [
        { type: 'hand', text: 'In my hand at game start' }
      ]
    },
    'Lounge': { 
      prob: 0, 
      status: 'eliminated', 
      evidence: [
        { type: 'constraint', text: 'T6: Matthew showed one of [Lounge, Prof. Plum, Revolver]' },
        { type: 'deduction', text: 'DEDUCTION: Matthew showed Rope on T5' },
        { type: 'deduction', text: 'Matthew\'s T5 constraint was [Rope, Ballroom, Miss Scarlet]' },
        { type: 'deduction', text: 'No overlap between T5 and T6 constraints except through elimination' },
        { type: 'deduction', text: 'Process of elimination from Matthew\'s known cards → Lounge confirmed' },
        { type: 'result', text: '→ ELIMINATED: Matthew has this card' }
      ]
    },
    'Hall': { 
      prob: 4, 
      status: 'unlikely', 
      evidence: [
        { type: 'analysis', text: 'NEVER SUGGESTED in 7 turns' },
        { type: 'context', text: 'Lowest probability among untested rooms' },
        { type: 'context', text: 'Statistical baseline only — no direct evidence for or against' },
        { type: 'calc', text: '→ 4% probability in envelope' }
      ]
    },
    'Study': { 
      prob: 0, 
      status: 'eliminated', 
      evidence: [
        { type: 'constraint', text: 'T1: Lisa showed one of [Wrench, Study, Prof. Plum]' },
        { type: 'constraint', text: 'T3: Lisa showed one of [Mrs. Peacock, Study, Rope]' },
        { type: 'deduction', text: 'CROSS-REFERENCE: Study appears in BOTH of Lisa\'s showings' },
        { type: 'deduction', text: 'T1 cards: Wrench, Study, Prof. Plum' },
        { type: 'deduction', text: 'T3 cards: Mrs. Peacock, Study, Rope' },
        { type: 'deduction', text: 'Only common card = Study → Lisa MUST have Study' },
        { type: 'result', text: '→ ELIMINATED: Lisa has this card (confirmed by cross-reference)' }
      ]
    },
  },
  
  constraints: [
    { turn: 1, player: 'Lisa', cards: ['Wrench', 'Study', 'Prof. Plum'], action: 'showed' },
    { turn: 2, player: 'Ann', cards: ['Lead Pipe', 'Kitchen', 'Miss Scarlet'], action: 'showed' },
    { turn: 3, player: 'Lisa', cards: ['Mrs. Peacock', 'Study', 'Rope'], action: 'showed' },
    { turn: 4, player: 'Ann', cards: ['Dining Room', 'Mr. Green', 'Candlestick'], action: 'showed' },
    { turn: 5, player: 'Matthew', cards: ['Rope', 'Ballroom', 'Miss Scarlet'], action: 'showed' },
    { turn: 6, player: 'Matthew', cards: ['Lounge', 'Prof. Plum', 'Revolver'], action: 'showed' },
  ],
  
  insights: [
    { type: 'deduction', text: 'Lisa has Study (cross-reference T1 & T3 constraints)', confidence: 100 },
    { type: 'deduction', text: 'Lisa has Wrench (T1 constraint after Study eliminated)', confidence: 100 },
    { type: 'inference', text: 'Candlestick likely in envelope — only 1 weak constraint in 7 turns', confidence: 67 },
    { type: 'pattern', text: 'Conservatory never tested — highest probability untested room', confidence: 45 },
  ]
};

// Utility functions
const getProbColor = (prob) => {
  if (prob >= 60) return 'text-emerald-400';
  if (prob >= 30) return 'text-amber-400';
  if (prob > 0) return 'text-slate-300';
  return 'text-slate-600';
};

const getBarColor = (prob) => {
  if (prob >= 60) return 'bg-emerald-500';
  if (prob >= 30) return 'bg-amber-500';
  return 'bg-slate-500';
};

const getEvidenceIcon = (type) => {
  switch(type) {
    case 'hand': return '🃏';
    case 'shown': return '👁';
    case 'constraint': return '🔗';
    case 'deduction': return '🧠';
    case 'analysis': return '📊';
    case 'context': return '📋';
    case 'calc': return '🎯';
    case 'result': return '✓';
    default: return '•';
  }
};

const getEvidenceStyle = (type) => {
  switch(type) {
    case 'result': return 'text-emerald-400 font-semibold';
    case 'deduction': return 'text-purple-300';
    case 'shown': return 'text-blue-300';
    case 'calc': return 'text-amber-300 font-medium';
    default: return 'text-slate-300';
  }
};

// Evidence Panel Component (replaces tooltip)
const EvidencePanel = ({ name, evidence, onClose }) => {
  const panelRef = useRef(null);
  
  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    };
    
    // Add listener after a small delay to avoid immediate close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);
  
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);
  
  return (
    <div 
      ref={panelRef}
      className="absolute z-50 right-0 top-full mt-2 w-80 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="bg-slate-700 px-4 py-2 flex items-center justify-between">
        <div className="font-semibold text-white text-sm">{name}</div>
        <button 
          onClick={onClose}
          className="text-slate-400 hover:text-white text-xl leading-none px-1"
        >
          ×
        </button>
      </div>
      
      {/* Evidence list */}
      <div className="p-3 max-h-64 overflow-y-auto space-y-2">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
          Evidence Trail
        </div>
        {evidence.map((e, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <span className="text-base flex-shrink-0 mt-0.5">{getEvidenceIcon(e.type)}</span>
            <span className={getEvidenceStyle(e.type)}>{e.text}</span>
          </div>
        ))}
      </div>
      
      {/* Footer hint */}
      <div className="bg-slate-900/50 px-3 py-2 text-[10px] text-slate-500 border-t border-slate-700">
        Click outside or press Esc to close
      </div>
    </div>
  );
};

// Horizontal Bar Chart Component with Evidence
const ProbabilityChart = ({ title, icon, data, accentColor }) => {
  const [openEvidence, setOpenEvidence] = useState(null);
  
  const sortedData = useMemo(() => {
    return Object.entries(data)
      .sort((a, b) => {
        // Sort: active cards by prob desc, then eliminated, then mine
        if (a[1].status === 'mine' && b[1].status !== 'mine') return 1;
        if (b[1].status === 'mine' && a[1].status !== 'mine') return -1;
        if (a[1].status === 'eliminated' && b[1].status !== 'eliminated') return 1;
        if (b[1].status === 'eliminated' && a[1].status !== 'eliminated') return -1;
        return b[1].prob - a[1].prob;
      });
  }, [data]);
  
  const topCandidate = sortedData.find(([_, v]) => v.status !== 'mine' && v.status !== 'eliminated');
  
  return (
    <div className="bg-slate-900/80 rounded-lg border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className={`px-4 py-2 border-b border-slate-700/50 flex items-center justify-between ${accentColor}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="font-semibold text-sm tracking-wide uppercase">{title}</span>
        </div>
        {topCandidate && (
          <span className="text-xs bg-black/30 px-2 py-0.5 rounded">
            TOP: {topCandidate[0]}
          </span>
        )}
      </div>
      
      {/* Bars */}
      <div className="p-3 space-y-1.5">
        {sortedData.map(([name, info]) => {
          const isEliminated = info.status === 'eliminated';
          const isMine = info.status === 'mine';
          const showBar = !isEliminated && !isMine;
          
          return (
            <div key={name} className="flex items-center gap-2 group relative">
              {/* Name */}
              <div className={`w-28 text-xs truncate font-medium
                ${isMine ? 'text-blue-400' : isEliminated ? 'text-red-400 line-through' : 'text-slate-200'}`}
              >
                {name}
              </div>
              
              {/* Bar container or status text */}
              <div className="flex-1 h-6 relative">
                {showBar ? (
                  <div className="h-full bg-slate-800/50 rounded overflow-hidden">
                    <div 
                      className={`h-full ${getBarColor(info.prob)} transition-all duration-500`}
                      style={{ width: `${Math.max(info.prob, 3)}%` }}
                    />
                  </div>
                ) : (
                  <div className={`h-full flex items-center text-xs font-medium
                    ${isMine ? 'text-blue-400/70' : 'text-red-400/70'}`}
                  >
                    {isMine ? '— MY CARD —' : '— ELIMINATED —'}
                  </div>
                )}
              </div>
              
              {/* Percentage */}
              <div className={`w-12 text-right text-sm font-mono font-bold ${getProbColor(info.prob)}`}>
                {info.prob > 0 ? `${info.prob}%` : '—'}
              </div>
              
              {/* Evidence info icon */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenEvidence(openEvidence === name ? null : name);
                }}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors text-sm
                  ${openEvidence === name 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-slate-700/50 hover:bg-slate-600 text-slate-400 hover:text-white'}`}
                title="View evidence"
              >
                ℹ
              </button>
              
              {/* Evidence panel */}
              {openEvidence === name && (
                <EvidencePanel 
                  name={name}
                  evidence={info.evidence} 
                  onClose={() => setOpenEvidence(null)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Solution Candidates Panel
const SolutionCandidates = ({ suspects, weapons, rooms }) => {
  const getTopCandidate = (data) => {
    const candidates = Object.entries(data)
      .filter(([_, v]) => v.status !== 'mine' && v.status !== 'eliminated')
      .sort((a, b) => b[1].prob - a[1].prob);
    return candidates[0] || null;
  };
  
  const topSuspect = getTopCandidate(suspects);
  const topWeapon = getTopCandidate(weapons);
  const topRoom = getTopCandidate(rooms);
  
  const overallConfidence = useMemo(() => {
    if (!topSuspect || !topWeapon || !topRoom) return 0;
    return Math.round((topSuspect[1].prob + topWeapon[1].prob + topRoom[1].prob) / 3);
  }, [topSuspect, topWeapon, topRoom]);
  
  const getConfidenceLevel = (conf) => {
    if (conf >= 70) return { label: 'HIGH', color: 'text-emerald-400', bg: 'bg-emerald-500', glow: 'shadow-emerald-500/30' };
    if (conf >= 45) return { label: 'MEDIUM', color: 'text-amber-400', bg: 'bg-amber-500', glow: 'shadow-amber-500/30' };
    return { label: 'LOW', color: 'text-slate-400', bg: 'bg-slate-500', glow: '' };
  };
  
  const confLevel = getConfidenceLevel(overallConfidence);
  
  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header with confidence meter */}
      <div className="px-5 py-4 border-b border-slate-700/50 bg-black/20">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            SOLUTION CANDIDATES
          </h2>
          <div className={`px-3 py-1 rounded-full text-xs font-bold ${confLevel.color} bg-black/40 border border-current/30`}>
            {confLevel.label} CONFIDENCE
          </div>
        </div>
        
        {/* Confidence bar */}
        <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={`h-full ${confLevel.bg} transition-all duration-700 ${confLevel.glow} shadow-lg`}
            style={{ width: `${overallConfidence}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white drop-shadow-lg">{overallConfidence}%</span>
          </div>
        </div>
      </div>
      
      {/* Three candidates */}
      <div className="grid grid-cols-3 divide-x divide-slate-700/50">
        {/* Suspect */}
        <div className="p-4 text-center">
          <div className="text-3xl mb-2">🕵️</div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">WHO</div>
          <div className="text-sm font-semibold text-white mb-1">
            {topSuspect ? topSuspect[0] : '???'}
          </div>
          <div className={`text-2xl font-bold font-mono ${topSuspect ? getProbColor(topSuspect[1].prob) : 'text-slate-600'}`}>
            {topSuspect ? `${topSuspect[1].prob}%` : '—'}
          </div>
        </div>
        
        {/* Weapon */}
        <div className="p-4 text-center">
          <div className="text-3xl mb-2">🔪</div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">WHAT</div>
          <div className="text-sm font-semibold text-white mb-1">
            {topWeapon ? topWeapon[0] : '???'}
          </div>
          <div className={`text-2xl font-bold font-mono ${topWeapon ? getProbColor(topWeapon[1].prob) : 'text-slate-600'}`}>
            {topWeapon ? `${topWeapon[1].prob}%` : '—'}
          </div>
        </div>
        
        {/* Room */}
        <div className="p-4 text-center">
          <div className="text-3xl mb-2">🚪</div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">WHERE</div>
          <div className="text-sm font-semibold text-white mb-1">
            {topRoom ? topRoom[0] : '???'}
          </div>
          <div className={`text-2xl font-bold font-mono ${topRoom ? getProbColor(topRoom[1].prob) : 'text-slate-600'}`}>
            {topRoom ? `${topRoom[1].prob}%` : '—'}
          </div>
        </div>
      </div>
      
      {/* Accusation readiness */}
      {overallConfidence >= 70 && (
        <div className="px-4 py-3 bg-emerald-900/30 border-t border-emerald-500/30">
          <div className="flex items-center gap-2 text-emerald-300 text-sm">
            <span className="animate-pulse">⚡</span>
            <span className="font-semibold">Ready to accuse!</span>
            <span className="text-emerald-400/70 text-xs">— High confidence in all three categories</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Recommendations & Alerts Panel
const RecommendationsAlerts = ({ turn, insights, constraints, suspects, weapons, rooms }) => {
  const recommendations = useMemo(() => {
    const recs = [];
    
    const suspectCandidates = Object.entries(suspects).filter(([_, v]) => v.status === 'possible' || v.status === 'likely');
    const weaponCandidates = Object.entries(weapons).filter(([_, v]) => v.status === 'possible' || v.status === 'likely');
    const roomCandidates = Object.entries(rooms).filter(([_, v]) => v.status === 'possible' || v.status === 'likely');
    
    if (suspectCandidates.length > 0 && weaponCandidates.length > 0 && roomCandidates.length > 0) {
      const topS = suspectCandidates.sort((a, b) => b[1].prob - a[1].prob)[0];
      const topW = weaponCandidates.sort((a, b) => b[1].prob - a[1].prob)[0];
      const topR = roomCandidates.sort((a, b) => b[1].prob - a[1].prob)[0];
      
      recs.push({
        type: 'suggest',
        priority: 'high',
        text: `Suggest: ${topS[0]}, ${topW[0]}, ${topR[0]}`,
        subtext: 'Tests your top candidates simultaneously',
        icon: '💡'
      });
    }
    
    const recentShowers = constraints.slice(-3).map(c => c.player);
    const players = ['Lisa', 'Matthew', 'Ann'];
    const quietPlayers = players.filter(p => !recentShowers.includes(p));
    
    if (quietPlayers.length > 0) {
      recs.push({
        type: 'strategy',
        priority: 'medium',
        text: `Target ${quietPlayers[0]} with your next suggestion`,
        subtext: `Haven't shown in 3 turns — may have limited cards`,
        icon: '🎯'
      });
    }
    
    const likelyRooms = Object.entries(rooms).filter(([_, v]) => v.status === 'likely');
    if (likelyRooms.length > 0) {
      recs.push({
        type: 'move',
        priority: 'medium',
        text: `Move toward ${likelyRooms[0][0]}`,
        subtext: 'High-probability room for final accusation',
        icon: '🚶'
      });
    }
    
    return recs;
  }, [suspects, weapons, rooms, constraints]);
  
  const alerts = useMemo(() => {
    const alertList = [];
    
    const topSuspect = Object.entries(suspects).find(([_, v]) => v.prob >= 60 && v.status !== 'mine');
    const topWeapon = Object.entries(weapons).find(([_, v]) => v.prob >= 60 && v.status !== 'mine');
    const topRoom = Object.entries(rooms).find(([_, v]) => v.prob >= 60 && v.status !== 'mine');
    
    if (topSuspect && topWeapon && topRoom) {
      alertList.push({
        type: 'success',
        text: 'Solution convergence detected',
        subtext: 'All three categories have clear leaders',
        icon: '✓'
      });
    }
    
    if (turn >= 6) {
      alertList.push({
        type: 'warning',
        text: 'Game entering late phase',
        subtext: 'Other players may be close to solving',
        icon: '⚠'
      });
    }
    
    const breakthroughs = insights.filter(i => i.confidence >= 90);
    if (breakthroughs.length > 0) {
      alertList.push({
        type: 'info',
        text: `${breakthroughs.length} confirmed deduction${breakthroughs.length > 1 ? 's' : ''}`,
        subtext: 'High-confidence eliminations made',
        icon: 'ℹ'
      });
    }
    
    return alertList;
  }, [suspects, weapons, rooms, turn, insights]);
  
  const getPriorityStyle = (priority) => {
    switch(priority) {
      case 'high': return 'border-l-emerald-400 bg-emerald-900/20';
      case 'medium': return 'border-l-amber-400 bg-amber-900/20';
      default: return 'border-l-slate-400 bg-slate-800/50';
    }
  };
  
  const getAlertStyle = (type) => {
    switch(type) {
      case 'success': return 'border-emerald-500/50 bg-emerald-900/30 text-emerald-300';
      case 'warning': return 'border-amber-500/50 bg-amber-900/30 text-amber-300';
      case 'info': return 'border-blue-500/50 bg-blue-900/30 text-blue-300';
      default: return 'border-slate-500/50 bg-slate-800/50 text-slate-300';
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Recommendations */}
      <div className="bg-slate-900/80 rounded-lg border border-slate-700/50 overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-700/50 bg-emerald-900/20">
          <h3 className="font-semibold text-sm text-emerald-300 flex items-center gap-2">
            <span>💡</span> RECOMMENDATIONS
          </h3>
        </div>
        <div className="p-3 space-y-2">
          {recommendations.map((rec, i) => (
            <div 
              key={i} 
              className={`border-l-2 pl-3 py-2 rounded-r ${getPriorityStyle(rec.priority)}`}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg">{rec.icon}</span>
                <div>
                  <div className="text-sm font-medium text-white">{rec.text}</div>
                  <div className="text-xs text-slate-400">{rec.subtext}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Alerts */}
      <div className="bg-slate-900/80 rounded-lg border border-slate-700/50 overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-700/50 bg-amber-900/20">
          <h3 className="font-semibold text-sm text-amber-300 flex items-center gap-2">
            <span>🔔</span> ALERTS
          </h3>
        </div>
        <div className="p-3 space-y-2">
          {alerts.map((alert, i) => (
            <div 
              key={i} 
              className={`flex items-center gap-3 px-3 py-2 rounded border ${getAlertStyle(alert.type)}`}
            >
              <span className="text-lg w-6 text-center">{alert.icon}</span>
              <div>
                <div className="text-sm font-medium">{alert.text}</div>
                <div className="text-xs opacity-70">{alert.subtext}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Recent Insights */}
      <div className="bg-slate-900/80 rounded-lg border border-slate-700/50 overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-700/50 bg-purple-900/20">
          <h3 className="font-semibold text-sm text-purple-300 flex items-center gap-2">
            <span>🧠</span> RECENT INSIGHTS
          </h3>
        </div>
        <div className="p-3 space-y-2">
          {insights.map((insight, i) => (
            <div 
              key={i} 
              className="flex items-start gap-3 px-3 py-2 rounded bg-slate-800/50 border border-slate-700/30"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                ${insight.confidence >= 90 ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-500/50' :
                  insight.confidence >= 60 ? 'bg-amber-900/50 text-amber-400 border border-amber-500/50' :
                  'bg-slate-700/50 text-slate-400 border border-slate-600/50'}`}
              >
                {insight.confidence}
              </div>
              <div className="flex-1">
                <div className="text-sm text-slate-200">{insight.text}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">{insight.type}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// My Cards & Public Cards Display
const MyCardsAndPublic = ({ myCards, publicCards }) => {
  return (
    <div className="bg-slate-900/80 rounded-lg border border-blue-500/30 overflow-hidden">
      <div className="px-4 py-2 border-b border-blue-500/30 bg-blue-900/30">
        <h3 className="font-semibold text-sm text-blue-300 flex items-center gap-2">
          <span>🃏</span> MY CARDS / PUBLIC CARDS
        </h3>
      </div>
      <div className="p-3">
        {/* My Cards */}
        <div className="flex flex-wrap gap-2 mb-3">
          {myCards.map(card => (
            <span 
              key={card}
              className="px-3 py-1.5 bg-blue-900/40 border border-blue-500/40 rounded-full text-xs text-blue-200 font-medium"
            >
              {card}
            </span>
          ))}
        </div>
        
        {/* Public Cards */}
        {publicCards && publicCards.length > 0 && (
          <>
            <div className="border-t border-slate-700/50 pt-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
                Public (Everyone Knows)
              </div>
              <div className="flex flex-wrap gap-2">
                {publicCards.map(card => (
                  <span 
                    key={card}
                    className="px-3 py-1.5 bg-slate-700/40 border border-slate-500/40 rounded-full text-xs text-slate-300 font-medium"
                  >
                    {card}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Main Control Room Component
export default function BoardBrainControlRoom() {
  const [gameState] = useState(DEMO_STATE);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-4 font-sans">
      {/* Scanline overlay effect */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.02] z-50"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)'
        }}
      />
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
              BOARDBRAIN™
            </h1>
            <p className="text-slate-500 text-sm tracking-widest uppercase">Control Room • Clue</p>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Turn indicator */}
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Turn</div>
              <div className="text-3xl font-black text-white font-mono">{gameState.turn}</div>
            </div>
            
            {/* Divider */}
            <div className="w-px h-12 bg-slate-700" />
            
            {/* Clock */}
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Time</div>
              <div className="text-lg font-mono text-slate-300">
                {currentTime.toLocaleTimeString()}
              </div>
            </div>
          </div>
        </header>
        
        {/* Main Grid */}
        <div className="grid grid-cols-12 gap-4">
          {/* Left Column - Solution Candidates + My Cards */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <SolutionCandidates 
              suspects={gameState.suspects}
              weapons={gameState.weapons}
              rooms={gameState.rooms}
            />
            <MyCardsAndPublic myCards={gameState.myCards} publicCards={gameState.publicCards} />
          </div>
          
          {/* Middle Column - Recommendations & Alerts */}
          <div className="col-span-12 lg:col-span-4">
            <RecommendationsAlerts 
              turn={gameState.turn}
              insights={gameState.insights}
              constraints={gameState.constraints}
              suspects={gameState.suspects}
              weapons={gameState.weapons}
              rooms={gameState.rooms}
            />
          </div>
          
          {/* Right Column - The Three Charts */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <ProbabilityChart 
              title="Suspects" 
              icon="🕵️"
              data={gameState.suspects}
              accentColor="bg-red-900/30"
            />
            <ProbabilityChart 
              title="Weapons" 
              icon="🔪"
              data={gameState.weapons}
              accentColor="bg-amber-900/30"
            />
            <ProbabilityChart 
              title="Rooms" 
              icon="🚪"
              data={gameState.rooms}
              accentColor="bg-emerald-900/30"
            />
          </div>
        </div>
        
        {/* Footer */}
        <footer className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-600">
          <div>© 2024-2026 Xformative AI LLC. All Rights Reserved.</div>
          <div className="flex items-center gap-4">
            <span>BoardBrain™</span>
            <span>•</span>
            <span>Universal Experience Grammar</span>
            <span>•</span>
            <span className="text-emerald-600">● LIVE</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
