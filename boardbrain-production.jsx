import React, { useState } from 'react';

/**
 * BoardBrain™ - Mobile Matrix Prototype
 * Color-filled cells with tap-to-reveal details
 * Copyright © 2024 Pat Boulay. All Rights Reserved.
 */

// Sample game state for prototype
const PLAYERS = ['Ann', 'Pat', 'Lisa'];
const YOU = 'Lisa';

const CARDS = {
  suspects: ['Mustard', 'Scarlet', 'Plum', 'Green', 'White', 'Peacock'],
  weapons: ['Candle', 'Knife', 'Pipe', 'Gun', 'Rope', 'Wrench'],
  rooms: ['Kitchen', 'Ballroom', 'Conserv', 'Dining', 'Billiard', 'Library', 'Lounge', 'Hall', 'Study']
};

// Simulated knowledge - what YOU (Lisa) know
const KNOWLEDGE = {
  // Your cards
  'Mustard': { Ann: null, Pat: null, Lisa: 'HAS', solution: 'NO', reason: 'You have this card' },
  'Peacock': { Ann: null, Pat: null, Lisa: 'HAS', solution: 'NO', reason: 'You have this card' },
  'Pipe': { Ann: null, Pat: null, Lisa: 'HAS', solution: 'NO', reason: 'You have this card' },
  'Rope': { Ann: null, Pat: null, Lisa: 'HAS', solution: 'NO', reason: 'You have this card' },
  'Conserv': { Ann: null, Pat: null, Lisa: 'HAS', solution: 'NO', reason: 'You have this card' },
  'Billiard': { Ann: null, Pat: null, Lisa: 'HAS', solution: 'NO', reason: 'You have this card' },
  
  // Cards shown to you
  'Scarlet': { Ann: 'HAS', Pat: null, Lisa: 'NO', solution: 'NO', reason: 'Ann showed you this card on Turn 2' },
  'Knife': { Ann: null, Pat: 'HAS', Lisa: 'NO', solution: 'NO', reason: 'Pat showed you this card on Turn 3' },
  
  // Deduced - likely solution
  'Plum': { Ann: 'NO', Pat: 'NO', Lisa: 'NO', solution: 'LIKELY', reason: 'No one has this card - likely in solution (75%)' },
  
  // Constraint set A - Ann has ONE of these
  'Kitchen': { Ann: 'MAYBE', Pat: null, Lisa: 'NO', solution: null, constraint: 'A', reason: 'Constraint A: Ann has ONE OF Kitchen, Lounge, or Wrench (from Turn 4)' },
  'Lounge': { Ann: 'MAYBE', Pat: null, Lisa: 'NO', solution: null, constraint: 'A', reason: 'Constraint A: Ann has ONE OF Kitchen, Lounge, or Wrench (from Turn 4)' },
  'Wrench': { Ann: 'MAYBE', Pat: null, Lisa: 'NO', solution: null, constraint: 'A', reason: 'Constraint A: Ann has ONE OF Kitchen, Lounge, or Wrench (from Turn 4)' },
};

// Color mapping
const COLORS = {
  HAS: '#22c55e',      // Green - confirmed has
  NO: '#ef4444',       // Red - confirmed doesn't have
  MAYBE: '#facc15',    // Bright Yellow - constraint/possible
  LIKELY: '#f97316',   // Orange - likely in solution
  UNKNOWN: '#334155',  // Dark gray - unknown
  YOUR_CARD: '#8b5cf6' // Purple - your own cards
};

// Constraint sets - which cards are linked
const CONSTRAINTS = {
  'A': { player: 'Ann', cards: ['Kitchen', 'Lounge', 'Wrench'], turn: 4 },
};

export default function MatrixPrototype() {
  const [popup, setPopup] = useState(null);

  const getCellColor = (card, player) => {
    const k = KNOWLEDGE[card];
    if (!k) return COLORS.UNKNOWN;
    
    const status = k[player];
    
    // Special case: your own cards get purple
    if (player === YOU && status === 'HAS') return COLORS.YOUR_CARD;
    
    if (status === 'HAS') return COLORS.HAS;
    if (status === 'NO') return COLORS.NO;
    if (status === 'MAYBE') return COLORS.MAYBE;
    return COLORS.UNKNOWN;
  };

  const getSolColor = (card) => {
    const k = KNOWLEDGE[card];
    if (!k) return COLORS.UNKNOWN;
    
    if (k.solution === 'NO') return COLORS.NO;
    if (k.solution === 'LIKELY') return COLORS.LIKELY;
    return COLORS.UNKNOWN;
  };

  const handleTap = (card, player = null) => {
    const k = KNOWLEDGE[card];
    let title = card;
    let detail = 'No information yet';
    
    if (k?.reason) {
      detail = k.reason;
    } else if (player) {
      detail = `No information about whether ${player} has ${card}`;
    }
    
    if (player) {
      title = `${card} / ${player}`;
    }
    
    setPopup({ title, detail });
  };

  const closePopup = () => setPopup(null);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.title}>BoardBrain™</div>
        <div style={styles.subtitle}>You are Lisa (Mrs. White)</div>
      </div>

      {/* Legend - compact */}
      <div style={styles.legend}>
        <span><span style={{...styles.legendDot, background: COLORS.YOUR_CARD}}></span>Mine</span>
        <span><span style={{...styles.legendDot, background: COLORS.HAS}}></span>Has</span>
        <span><span style={{...styles.legendDot, background: COLORS.NO}}></span>No</span>
        <span><span style={{...styles.legendDot, background: COLORS.MAYBE}}></span>Maybe</span>
        <span><span style={{...styles.legendDot, background: COLORS.LIKELY}}></span>Solution</span>
      </div>

      {/* Matrix */}
      <div style={styles.matrixContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.headerCell}>Card</th>
              {PLAYERS.map(p => (
                <th key={p} style={styles.headerCell}>
                  {p === YOU ? <strong>You</strong> : p.substring(0, 3)}
                </th>
              ))}
              <th style={styles.headerCell}>Sol</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(CARDS).map(([category, cards]) => (
              <React.Fragment key={category}>
                {/* Category header row */}
                <tr>
                  <td colSpan={PLAYERS.length + 2} style={styles.categoryRow}>
                    {category.toUpperCase()}
                  </td>
                </tr>
                {/* Card rows */}
                {cards.map(card => (
                  <tr key={card}>
                    <td style={styles.cardName}>{card}</td>
                    {PLAYERS.map(player => {
                      const k = KNOWLEDGE[card];
                      const constraintLetter = k?.constraint && k[player] === 'MAYBE' ? k.constraint : null;
                      
                      return (
                        <td
                          key={player}
                          style={{
                            ...styles.cell,
                            backgroundColor: getCellColor(card, player),
                          }}
                          onClick={() => handleTap(card, player)}
                        >
                          {constraintLetter && (
                            <span style={styles.constraintLetter}>{constraintLetter}</span>
                          )}
                        </td>
                      );
                    })}
                    <td
                      style={{
                        ...styles.cell,
                        backgroundColor: getSolColor(card),
                      }}
                      onClick={() => handleTap(card)}
                    />
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tap instruction */}
      <div style={styles.hint}>Tap any cell for details</div>

      {/* Popup Modal */}
      {popup && (
        <div style={styles.overlay} onClick={closePopup}>
          <div style={styles.popup} onClick={e => e.stopPropagation()}>
            <div style={styles.popupTitle}>{popup.title}</div>
            <div style={styles.popupDetail}>{popup.detail}</div>
            <button style={styles.popupClose} onClick={closePopup}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    color: '#f1f5f9',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: '8px',
    boxSizing: 'border-box',
    maxWidth: '400px',
    margin: '0 auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: '8px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '800',
    background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  legend: {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
    fontSize: '10px',
    color: '#94a3b8',
    marginBottom: '8px',
    flexWrap: 'wrap',
  },
  legendDot: {
    display: 'inline-block',
    width: '10px',
    height: '10px',
    borderRadius: '2px',
    marginRight: '3px',
    verticalAlign: 'middle',
  },
  constraintLetter: {
    fontSize: '9px',
    fontWeight: '700',
    color: '#000',
    position: 'absolute',
    top: '1px',
    right: '3px',
  },
  cellWrapper: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  matrixContainer: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    tableLayout: 'fixed',
  },
  headerCell: {
    padding: '6px 2px',
    textAlign: 'center',
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: '11px',
    borderBottom: '2px solid #475569',
  },
  categoryRow: {
    padding: '4px 6px',
    backgroundColor: '#1e293b',
    color: '#64748b',
    fontWeight: '700',
    fontSize: '10px',
    letterSpacing: '0.5px',
    borderBottom: '1px solid #334155',
  },
  cardName: {
    padding: '0 4px',
    textAlign: 'left',
    color: '#e2e8f0',
    fontSize: '12px',
    fontWeight: '500',
    borderRight: '1px solid #334155',
    borderBottom: '1px solid #334155',
    height: '28px',
    verticalAlign: 'middle',
  },
  cell: {
    padding: 0,
    margin: 0,
    height: '28px',
    width: '50px',
    borderRight: '1px solid #1e293b',
    borderBottom: '1px solid #1e293b',
    cursor: 'pointer',
    transition: 'opacity 0.1s',
    position: 'relative',
  },
  hint: {
    textAlign: 'center',
    fontSize: '11px',
    color: '#64748b',
    marginTop: '8px',
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '20px',
  },
  popup: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '20px',
    maxWidth: '300px',
    width: '100%',
    textAlign: 'center',
    border: '1px solid #475569',
  },
  popupTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: '12px',
  },
  popupDetail: {
    fontSize: '14px',
    color: '#cbd5e1',
    marginBottom: '16px',
    lineHeight: '1.5',
  },
  popupClose: {
    backgroundColor: '#8b5cf6',
    color: 'white',
    border: 'none',
    padding: '10px 24px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};
