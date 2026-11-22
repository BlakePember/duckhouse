import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowRight, ChevronLeft, ChevronRight, Pause, Play, Shield, Sparkles } from 'lucide-react';
import { assetUrl } from '../utils/routes';

interface HeroExplainerCardProps {
  onStartTutorial: () => void;
}

interface MiniSquareSpec {
  alg: string;
  row: number; // real chess row 0..7 (0 = rank 8, 7 = rank 1)
  col: number; // real chess col 0..7 (0 = file a, 7 = file h)
  rankLabel: string;
  fileLabel: string;
}

// Board A zoomed 4x4: White's perspective (ranks 8-5, files c-f)
const BOARD_A_ROWS = [
  { row: 0, rank: '8' },
  { row: 1, rank: '7' },
  { row: 2, rank: '6' },
  { row: 3, rank: '5' },
];
const BOARD_A_COLS = [
  { col: 2, file: 'c' },
  { col: 3, file: 'd' },
  { col: 4, file: 'e' },
  { col: 5, file: 'f' },
];

// Board B zoomed 4x4: Partner's (Black) perspective (ranks 1-4 top-to-bottom, files g-d left-to-right)
const BOARD_B_ROWS = [
  { row: 7, rank: '1' },
  { row: 6, rank: '2' },
  { row: 5, rank: '3' },
  { row: 4, rank: '4' },
];
const BOARD_B_COLS = [
  { col: 6, file: 'g' },
  { col: 5, file: 'f' },
  { col: 4, file: 'e' },
  { col: 3, file: 'd' },
];

function buildGrid(
  rows: { row: number; rank: string }[],
  cols: { col: number; file: string }[]
): MiniSquareSpec[] {
  const out: MiniSquareSpec[] = [];
  for (const r of rows) {
    for (const c of cols) {
      out.push({
        alg: `${c.file}${r.rank}`,
        row: r.row,
        col: c.col,
        rankLabel: r.rank,
        fileLabel: c.file,
      });
    }
  }
  return out;
}

const BOARD_A_SQUARES = buildGrid(BOARD_A_ROWS, BOARD_A_COLS);
const BOARD_B_SQUARES = buildGrid(BOARD_B_ROWS, BOARD_B_COLS);

interface StepMeta {
  tab: string;
  title: string;
  body: string;
  boardAFoot: string;
  boardBFoot: string;
  activeBoard: 'A' | 'B';
}

const STEPS: StepMeta[] = [
  {
    tab: '1. Capture & Feed',
    title: 'Capture on your board to arm your teammate',
    body: 'On Board A, your White Queen captures Black’s Knight on e6. In Duckhouse, captured pieces don’t vanish — that Knight flips color and drops straight into your Partner’s Pocket on Board B!',
    boardAFoot: 'Queen takes Knight on e6',
    boardBFoot: 'Partner receives a Black Knight!',
    activeBoard: 'A',
  },
  {
    tab: '2. Block w/ Duck',
    title: 'Move the Duck after every turn to block threats',
    body: 'Black’s Rook on c6 would normally take your Queen right back. Moving the Duck onto d6 ends your turn and blocks the Rook’s lane — sliding pieces cannot pass through the Duck!',
    boardAFoot: 'Duck moves to d6 — Rook blocked!',
    boardBFoot: 'Black Knight waiting in pocket',
    activeBoard: 'A',
  },
  {
    tab: '3. Drop & Jump',
    title: 'Partner drops the gifted piece — Knights jump the Duck!',
    body: 'On Board B, your Partner drops that Black Knight from their pocket onto f3, leaping right over Board B’s Duck to threaten White’s King. First team to capture an enemy King wins!',
    boardAFoot: 'Queen stays safe behind the Duck',
    boardBFoot: 'Knight dropped on f3 → attacks King!',
    activeBoard: 'B',
  },
];

export const HeroExplainerCard: React.FC<HeroExplainerCardProps> = ({ onStartTutorial }) => {
  const [step, setStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (!autoPlay) return;
    const id = window.setInterval(() => {
      setStep((prev) => (prev + 1) % STEPS.length);
    }, 4600);
    return () => window.clearInterval(id);
  }, [autoPlay]);

  const selectStep = (next: number) => {
    setAutoPlay(false);
    setStep((next + STEPS.length) % STEPS.length);
  };

  const current = STEPS[step];

  // Board A pieces by step
  const boardAPieces: Record<string, { src: string; alt: string; isDuck?: boolean }> = {
    e8: { src: assetUrl('pieces/king-b.svg'), alt: 'Black King' },
    c6: { src: assetUrl('pieces/rook-b.svg'), alt: 'Black Rook' },
    e6: { src: assetUrl('pieces/queen-w.svg'), alt: 'White Queen' },
    ...(step === 0
      ? { f7: { src: assetUrl('duck.png'), alt: 'Board A Duck', isDuck: true } }
      : { d6: { src: assetUrl('duck.png'), alt: 'Board A Duck', isDuck: true } }),
  };

  // Board B pieces by step
  const boardBPieces: Record<string, { src: string; alt: string; isDuck?: boolean }> = {
    e1: { src: assetUrl('pieces/king-w.svg'), alt: 'White King' },
    e2: { src: assetUrl('duck.png'), alt: 'Board B Duck', isDuck: true },
    e4: { src: assetUrl('pieces/rook-b.svg'), alt: 'Black Rook' },
    ...(step === 2 ? { f3: { src: assetUrl('pieces/knight-b.svg'), alt: 'Dropped Black Knight' } } : {}),
  };

  const partnerPocketCount = step === 2 ? 0 : 1;

  return (
    <div className="dh-hero-card">
      <div className="dh-hero-card-top">
        <span className="dh-pill-badge emerald">TEAM EMERALD · You (A-White) + Partner (B-Black)</span>
        <span className="dh-pill-badge amber">TEAM AMBER · Opponents</span>
      </div>

      {/* Step selector tabs */}
      <div className="dh-hero-stepbar" role="tablist" aria-label="How Duckhouse works example steps">
        {STEPS.map((s, idx) => (
          <button
            key={s.tab}
            type="button"
            role="tab"
            aria-selected={step === idx}
            className={`dh-hero-step-tab ${step === idx ? 'active' : ''}`}
            onClick={() => selectStep(idx)}
          >
            {s.tab}
          </button>
        ))}
        <button
          type="button"
          className="dh-hero-play-btn"
          onClick={() => setAutoPlay((p) => !p)}
          aria-label={autoPlay ? 'Pause example animation' : 'Play example animation'}
          title={autoPlay ? 'Pause auto-play' : 'Resume auto-play'}
        >
          {autoPlay ? <Pause size={13} /> : <Play size={13} />}
        </button>
      </div>

      <div className="dh-mini-arena">
        {/* Board A */}
        <div
          className={`dh-mini-board-box ${
            current.activeBoard === 'A' ? (step === 1 ? 'active-duck' : 'active-turn') : 'calm'
          }`}
        >
          <div className="dh-mini-label-row">
            <span className="dh-mini-label">Board A</span>
            <span className="dh-mini-seat-tag emerald">You · White</span>
          </div>

          <div className="dh-mini-grid-wrap">
            <div className="dh-mini-grid" aria-label="Board A zoomed example">
              {BOARD_A_SQUARES.map((sq, idx) => {
                const light = (sq.row + sq.col) % 2 === 0;
                const item = boardAPieces[sq.alg];
                const showRank = idx % 4 === 0;
                const showFile = idx >= 12;

                const highlight =
                  (step === 0 && sq.alg === 'e5' && 'hl-from') ||
                  (step === 0 && sq.alg === 'e6' && 'hl-capture') ||
                  (step === 1 && sq.alg === 'f7' && 'hl-duck-from') ||
                  (step === 1 && sq.alg === 'd6' && 'hl-duck-to') ||
                  (step === 1 && sq.alg === 'c6' && 'hl-threat') ||
                  '';

                return (
                  <div key={sq.alg} className={`dh-mini-sq ${light ? 'light' : 'dark'} ${highlight}`}>
                    {showRank && <span className="dh-mini-coord rank">{sq.rankLabel}</span>}
                    {showFile && <span className="dh-mini-coord file">{sq.fileLabel}</span>}
                    {item && (
                      <img
                        src={item.src}
                        alt={item.alt}
                        className={item.isDuck ? 'dh-mini-duck' : 'dh-mini-piece'}
                      />
                    )}
                    {step === 0 && sq.alg === 'e6' && (
                      <span className="dh-mini-cap-badge" title="Captured Black Knight">
                        ×♞
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tactical SVG arrows for Board A */}
            <svg className="dh-mini-overlay" viewBox="0 0 400 400" aria-hidden="true">
              <defs>
                <marker id="dh-arr-emerald" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#52c480" />
                </marker>
                <marker id="dh-arr-gold" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#f5c842" />
                </marker>
              </defs>

              {step === 0 && (
                <>
                  {/* White Queen e5 (250,350) -> e6 (250,250) */}
                  <line
                    x1="250"
                    y1="342"
                    x2="250"
                    y2="278"
                    stroke="#52c480"
                    strokeWidth="12"
                    strokeLinecap="round"
                    markerEnd="url(#dh-arr-emerald)"
                    opacity="0.92"
                  />
                </>
              )}

              {step === 1 && (
                <>
                  {/* Duck moves f7 (350,150) -> d6 (150,250) */}
                  <line
                    x1="335"
                    y1="158"
                    x2="180"
                    y2="235"
                    stroke="#f5c842"
                    strokeWidth="11"
                    strokeLinecap="round"
                    markerEnd="url(#dh-arr-gold)"
                    opacity="0.95"
                  />
                  {/* Blocked Black Rook c6 (50,250) stopping at Duck d6 (150,250) */}
                  <line
                    x1="76"
                    y1="250"
                    x2="112"
                    y2="250"
                    stroke="#e25858"
                    strokeWidth="9"
                    strokeDasharray="10 8"
                    strokeLinecap="round"
                  />
                  <line x1="114" y1="226" x2="114" y2="274" stroke="#e25858" strokeWidth="10" strokeLinecap="round" />
                </>
              )}
            </svg>
          </div>

          <div className={`dh-mini-pocket ${step === 1 ? 'duck-phase' : step === 0 ? 'chess-phase' : ''}`}>
            <span className="dh-mini-pocket-lbl">Board A Turn</span>
            <span className={`dh-mini-pocket-tag ${step === 1 ? 'gold' : step === 0 ? 'new' : 'ready'}`}>
              {step === 0 ? '1. Capture' : step === 1 ? '2. Move Duck' : 'Safe ✓'}
            </span>
          </div>

          <div className="dh-mini-foot">{current.boardAFoot}</div>
        </div>

        {/* Center Transfer / Action Bridge */}
        <div className={`dh-transfer-badge step-${step}`}>
          {step === 0 && (
            <>
              <div className="dh-transfer-chip emerald">
                <img src={assetUrl('pieces/knight-b.svg')} alt="Captured Knight" className="dh-transfer-piece" />
                <ArrowRight size={15} className="dh-transfer-arrow" />
              </div>
              <span>Captured Knight → Partner’s Pocket</span>
            </>
          )}
          {step === 1 && (
            <>
              <div className="dh-transfer-chip gold">
                <img src={assetUrl('duck.png')} alt="Duck" className="dh-transfer-piece" />
              </div>
              <span>
                <Shield size={11} style={{ verticalAlign: '-1px', marginRight: 3 }} />
                Duck blocks sliding pieces
              </span>
            </>
          )}
          {step === 2 && (
            <>
              <div className="dh-transfer-chip gold">
                <Sparkles size={15} />
                <img src={assetUrl('pieces/knight-b.svg')} alt="Black Knight" className="dh-transfer-piece" />
              </div>
              <span>Partner drops Knight onto f3!</span>
            </>
          )}
        </div>

        {/* Board B */}
        <div className={`dh-mini-board-box ${current.activeBoard === 'B' ? 'active-turn' : 'calm'}`}>
          <div className="dh-mini-label-row">
            <span className="dh-mini-label">Board B</span>
            <span className="dh-mini-seat-tag emerald">Partner · Black</span>
          </div>

          <div className="dh-mini-grid-wrap">
            <div className="dh-mini-grid" aria-label="Board B zoomed example">
              {BOARD_B_SQUARES.map((sq, idx) => {
                const light = (sq.row + sq.col) % 2 === 0;
                const item = boardBPieces[sq.alg];
                const showRank = idx % 4 === 0;
                const showFile = idx >= 12;

                const highlight =
                  (step === 2 && sq.alg === 'f3' && 'hl-drop') ||
                  (step === 2 && sq.alg === 'e1' && 'hl-threat') ||
                  '';

                return (
                  <div key={sq.alg} className={`dh-mini-sq ${light ? 'light' : 'dark'} ${highlight}`}>
                    {showRank && <span className="dh-mini-coord rank">{sq.rankLabel}</span>}
                    {showFile && <span className="dh-mini-coord file">{sq.fileLabel}</span>}
                    {item && (
                      <img
                        src={item.src}
                        alt={item.alt}
                        className={item.isDuck ? 'dh-mini-duck' : 'dh-mini-piece'}
                      />
                    )}
                    {step === 0 && sq.alg === 'e6' && (
                      <span className="dh-mini-cap-badge" title="Captured Black Knight">
                        ×♞
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tactical SVG arrows for Board B */}
            <svg className="dh-mini-overlay" viewBox="0 0 400 400" aria-hidden="true">
              <defs>
                <marker id="dh-arr-jump" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#f5c842" />
                </marker>
              </defs>

              {step === 2 && (
                <>
                  {/* Knight on f3 (150,250) jumps past Duck on e2 (250,150) to attack White King on e1 (250,50) */}
                  <path
                    d="M 155 224 Q 145 102 224 62"
                    fill="none"
                    stroke="#f5c842"
                    strokeWidth="11"
                    strokeDasharray="16 10"
                    strokeLinecap="round"
                    markerEnd="url(#dh-arr-jump)"
                  />
                </>
              )}
            </svg>
          </div>

          {/* Partner's mini pocket right under Board B */}
          <div className={`dh-mini-pocket ${step === 0 ? 'received' : step === 2 ? 'used' : ''}`}>
            <span className="dh-mini-pocket-lbl">Partner Pocket</span>
            <div className="dh-mini-pocket-item">
              <img
                src={assetUrl('pieces/knight-b.svg')}
                alt="Black Knight in pocket"
                className={partnerPocketCount === 0 ? 'spent' : ''}
              />
              {step === 0 && <span className="dh-mini-pocket-tag new">+1 NEW</span>}
              {step === 1 && <span className="dh-mini-pocket-tag ready">×1</span>}
              {step === 2 && <span className="dh-mini-pocket-tag dropped">Dropped!</span>}
            </div>
          </div>

          <div className="dh-mini-foot">{current.boardBFoot}</div>
        </div>
      </div>

      {/* Plain-English step caption */}
      <div className="dh-hero-explainer">
        <div className="dh-hero-explainer-title">{current.title}</div>
        <p className="dh-hero-explainer-body">{current.body}</p>
      </div>

      {/* Footer navigation + Jump to Interactive Tutorial */}
      <div className="dh-hero-card-foot">
        <div className="dh-hero-stepper-btns">
          <button
            type="button"
            className="dh-mini-nav-btn"
            onClick={() => selectStep(step - 1)}
            aria-label="Previous step"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="dh-hero-step-counter">
            Step {step + 1} / {STEPS.length}
          </span>
          <button
            type="button"
            className="dh-mini-nav-btn"
            onClick={() => selectStep(step + 1)}
            aria-label="Next step"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        <button type="button" className="dh-hero-tutorial-cta" onClick={onStartTutorial}>
          <span>Try it yourself in the Interactive Tutorial</span>
          <ArrowDown size={14} />
        </button>
      </div>
    </div>
  );
};
