/* =========================================================
   Rock Paper Scissors — script.js
   ---------------------------------------------------------
   Structure:
   1. Constants & DOM references
   2. State
   3. Utility helpers (theme, sound, storage)
   4. UI updaters (score, arena, history, progress)
   5. Core game logic
   6. Match flow (best-of-N, modal)
   7. Event wiring & initialization
   ========================================================= */

(() => {
  'use strict';

  /* ---------------------------------------------------------
     1. CONSTANTS & DOM REFERENCES
     --------------------------------------------------------- */
  const MOVES = ['rock', 'paper', 'scissors'];
  const EMOJI = { rock: '🪨', paper: '📄', scissors: '✂️' };
  const OUTCOME = { player: 'win', computer: 'loss', tie: 'tie' };

  // Animation timing (ms)
  const SHAKE_DURATION = 500;
  const REVEAL_DELAY   = 50;

  // Storage keys
  const STORAGE_KEYS = {
    theme: 'rps.theme',
    sound: 'rps.sound',
    bestOf: 'rps.bestOf',
  };

  // DOM references
  const dom = {
    // Scores
    winsScore:       document.getElementById('winsScore'),
    lossesScore:     document.getElementById('lossesScore'),
    tiesScore:       document.getElementById('tiesScore'),

    // Scoreboard controls
    resetBtn:        document.getElementById('resetBtn'),
    bestOfSelect:    document.getElementById('bestOfSelect'),

    // Progress
    matchProgress:     document.getElementById('matchProgress'),
    matchProgressFill: document.getElementById('matchProgressFill'),
    matchProgressText: document.getElementById('matchProgressText'),

    // Arena
    playerDisplay:   document.getElementById('playerDisplay'),
    computerDisplay: document.getElementById('computerDisplay'),
    resultMessage:   document.getElementById('resultMessage'),

    // Buttons
    rockBtn:     document.getElementById('rockBtn'),
    paperBtn:    document.getElementById('paperBtn'),
    scissorsBtn: document.getElementById('scissorsBtn'),

    // Header toggles
    themeToggle: document.getElementById('themeToggle'),
    themeIcon:   document.getElementById('themeIcon'),
    soundToggle: document.getElementById('soundToggle'),
    soundIcon:   document.getElementById('soundIcon'),

    // History
    historyList:    document.getElementById('historyList'),
    historyEmpty:   document.getElementById('historyEmpty'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),

    // Modal
    matchModal:         document.getElementById('matchModal'),
    matchModalBackdrop: document.getElementById('matchModalBackdrop'),
    matchModalTitle:    document.getElementById('matchModalTitle'),
    matchModalMessage:  document.getElementById('matchModalMessage'),
    matchModalSub:      document.getElementById('matchModalSub'),
    matchModalBtn:      document.getElementById('matchModalBtn'),
  };

  const choiceButtons = [dom.rockBtn, dom.paperBtn, dom.scissorsBtn];

  /* ---------------------------------------------------------
     2. STATE
     --------------------------------------------------------- */
  const state = {
    wins: 0,
    losses: 0,
    ties: 0,
    round: 0,
    isPlaying: false,       // blocks input during animation
    matchOver: false,       // blocks input after match ends
    bestOf: 5,              // 1, 3, 5, or 7
    targetWins: 3,          // computed: Math.ceil(bestOf / 2)
    history: [],            // array of { round, player, computer, outcome }
    soundEnabled: true,
    theme: 'dark',
  };

  /* ---------------------------------------------------------
     3. UTILITY HELPERS
     --------------------------------------------------------- */

  /** Return the winner given two moves: 'player' | 'computer' | 'tie' */
  function determineWinner(playerMove, computerMove) {
    if (playerMove === computerMove) return 'tie';
    const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    return beats[playerMove] === computerMove ? 'player' : 'computer';
  }

  /** Randomly pick the computer's move */
  function getComputerMove() {
    return MOVES[Math.floor(Math.random() * MOVES.length)];
  }

  /** Clamp a number between min and max */
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /** Safely read from localStorage */
  function storageGet(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch {
      return fallback;
    }
  }

  /** Safely write to localStorage */
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }

  /* -------- Sound (Web Audio API — no external assets) ------- */
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    return audioCtx;
  }

  /** Play a short tone. type: 'win' | 'loss' | 'tie' | 'click' */
  function playSound(type) {
    if (!state.soundEnabled) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    // Tone configurations per outcome
    const configs = {
      click: [{ f: 440, t: 
