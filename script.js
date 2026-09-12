/* =========================================================
   Rock Paper Scissors — script.js  (Complete)
   ========================================================= */

(() => {
  'use strict';

  /* ---------------------------------------------------------
     1. CONSTANTS & DOM REFERENCES
     --------------------------------------------------------- */
  const MOVES = ['rock', 'paper', 'scissors'];
  const EMOJI = { rock: '🪨', paper: '📄', scissors: '✂️' };
  const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

  const SHAKE_DURATION = 500; // ms

  const STORAGE_KEYS = {
    theme: 'rps.theme',
    sound: 'rps.sound',
    bestOf: 'rps.bestOf',
  };

  const dom = {
    winsScore:   document.getElementById('winsScore'),
    lossesScore: document.getElementById('lossesScore'),
    tiesScore:   document.getElementById('tiesScore'),

    resetBtn:     document.getElementById('resetBtn'),
    bestOfSelect: document.getElementById('bestOfSelect'),

    matchProgress:     document.getElementById('matchProgress'),
    matchProgressFill: document.getElementById('matchProgressFill'),
    matchProgressText: document.getElementById('matchProgressText'),

    playerDisplay:   document.getElementById('playerDisplay'),
    computerDisplay: document.getElementById('computerDisplay'),
    resultMessage:   document.getElementById('resultMessage'),

    rockBtn:     document.getElementById('rockBtn'),
    paperBtn:    document.getElementById('paperBtn'),
    scissorsBtn: document.getElementById('scissorsBtn'),

    themeToggle: document.getElementById('themeToggle'),
    themeIcon:   document.getElementById('themeIcon'),
    soundToggle: document.getElementById('soundToggle'),
    soundIcon:   document.getElementById('soundIcon'),

    historyList:     document.getElementById('historyList'),
    historyEmpty:    document.getElementById('historyEmpty'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),

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
    isPlaying: false,
    matchOver: false,
    bestOf: 5,
    targetWins: 3,
    history: [],
    soundEnabled: true,
    theme: 'dark',
  };

  /* ---------------------------------------------------------
     3. HELPERS
     --------------------------------------------------------- */
  function determineWinner(playerMove, computerMove) {
    if (playerMove === computerMove) return 'tie';
    return BEATS[playerMove] === computerMove ? 'player' : 'computer';
  }

  function getComputerMove() {
    return MOVES[Math.floor(Math.random() * MOVES.length)];
  }

  function storageGet(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch { return fallback; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }

  /* -------- Sound (Web Audio) -------- */
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    return audioCtx;
  }

  function playSound(type) {
    if (!state.soundEnabled) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const configs = {
      click: [{ f: 440, t: 0.06, d: 0.05 }],
      win:   [{ f: 660, t: 0.10, d: 0.10 }, { f: 880, t: 0.20, d: 0.15 }],
      loss:  [{ f: 320, t: 0.10, d: 0.12 }, { f: 220, t: 0.24, d: 0.18 }],
      tie:   [{ f: 500, t: 0.10, d: 0.12 }, { f: 500, t: 0.22, d: 0.12 }],
    };
    const notes = configs[type] || configs.click;
    const now = ctx.currentTime;
    notes.forEach(({ f, t, d }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, now + t);
      gain.gain.exponentialRampToValueAtTime(0.18, now + t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + d);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + d + 0.02);
    });
  }

  /* ---------------------------------------------------------
     4. UI UPDATERS
     --------------------------------------------------------- */
  function updateScoreUI() {
    dom.winsScore.textContent = state.wins;
    dom.lossesScore.textContent = state.losses;
    dom.tiesScore.textContent = state.ties;
  }

  function updateMatchProgress() {
    const total = state.targetWins;
    const leading = Math.max(state.wins, state.losses);
    const pct = total > 0 ? Math.min(100, (leading / total) * 100) : 0;
    dom.matchProgressFill.style.width = pct + '%';
    dom.matchProgress.setAttribute('aria-valuenow', Math.round(pct));

    if (state.bestOf <= 1) {
      dom.matchProgressText.textContent = 'Single round mode';
    } else {
      dom.matchProgressText.textContent =
        `First to ${state.targetWins} wins · Round ${state.round}`;
    }
  }

  function setButtonsDisabled(disabled) {
    choiceButtons.forEach(btn => { btn.disabled = disabled; });
  }

  function clearArenaHighlights() {
    dom.playerDisplay.classList.remove('winner', 'loser', 'shake', 'pop');
    dom.computerDisplay.classList.remove('winner', 'loser', 'shake', 'pop');
  }

  function setResultMessage(text, outcome) {
    dom.resultMessage.textContent = text;
    dom.resultMessage.classList.remove('result--win', 'result--loss', 'result--tie');
    if (outcome === 'win')  dom.resultMessage.classList.add('result--win');
    if (outcome === 'loss') dom.resultMessage.classList.add('result--loss');
    if (outcome === 'tie')  dom.resultMessage.classList.add('result--tie');
  }

  /* ---------------------------------------------------------
     5. HISTORY LOG
     --------------------------------------------------------- */
  function renderHistory() {
    // Remove all children except the "empty" placeholder
    const children = Array.from(dom.historyList.children);
    children.forEach(child => {
      if (child !== dom.historyEmpty) child.remove();
    });

    if (state.history.length === 0) {
      dom.historyEmpty.style.display = '';
      return;
    }
    dom.historyEmpty.style.display = 'none';

    // Newest first
    const frag = document.createDocumentFragment();
    for (let i = state.history.length - 1; i >= 0; i--) {
      const entry = state.history[i];
      const li = document.createElement('li');
      li.className = `history__item history__item--${entry.outcome}`;

      const roundSpan = document.createElement('span');
      roundSpan.className = 'history__round';
      roundSpan.textContent = `#${entry.round}`;

      const movesSpan = document.createElement('span');
      movesSpan.className = 'history__moves';
      movesSpan.textContent = `${EMOJI[entry.player]} vs ${EMOJI[entry.computer]}`;

      const outcomeSpan = document.createElement('span');
      outcomeSpan.className = 'history__outcome';
      outcomeSpan.textContent =
        entry.outcome === 'win'  ? 'Win'  :
        entry.outcome === 'loss' ? 'Loss' : 'Tie';

      li.append(roundSpan, movesSpan, outcomeSpan);
      frag.appendChild(li);
    }
    dom.historyList.appendChild(frag);
  }

  function addHistoryEntry(playerMove, computerMove, outcome) {
    state.history.push({
      round: state.round,
      player: playerMove,
      computer: computerMove,
      outcome,
    });
    renderHistory();
  }

  function clearHistory() {
    state.history = [];
    renderHistory();
  }

  /* ---------------------------------------------------------
     6. MATCH FLOW
     --------------------------------------------------------- */
  function recomputeTargetWins() {
    state.targetWins = Math.max(1, Math.ceil(state.bestOf / 2));
  }

  function checkMatchOver() {
    if (state.bestOf <= 1) return false;
    return state.wins >= state.targetWins || state.losses >= state.targetWins;
  }

  function showMatchModal(playerWon) {
    dom.matchModalTitle.textContent = playerWon ? '🏆 Victory!' : '💻 Defeat';
    dom.matchModalMessage.textContent = playerWon
      ? 'You won the match!'
      : 'Computer won the match.';
    dom.matchModalSub.textContent =
      `Final score: You ${state.wins} – ${state.losses} Computer · Ties: ${state.ties}`;
    dom.matchModal.hidden = false;
  }

  function hideMatchModal() {
    dom.matchModal.hidden = true;
  }

  function resetScoresOnly() {
    state.wins = 0;
    state.losses = 0;
    state.ties = 0;
    state.round = 0;
    state.matchOver = false;
    updateScoreUI();
    updateMatchProgress();
  }

  function resetFullGame() {
    state.isPlaying = false;
    resetScoresOnly();
    clearArenaHighlights();
    dom.playerDisplay.textContent = '❔';
    dom.computerDisplay.textContent = '❔';
    setResultMessage('Make your move!', null);
    setButtonsDisabled(false);
    hideMatchModal();
  }

  function resetMatchAndHistory() {
    resetFullGame();
    clearHistory();
  }

  /* ---------------------------------------------------------
     7. CORE ROUND LOGIC
     --------------------------------------------------------- */
  function playRound(playerMove) {
    if (state.isPlaying || state.matchOver) return;

    state.isPlaying = true;
    state.round += 1;
    setButtonsDisabled(true);

    clearArenaHighlights();
    playSound('click');

    // Show player's choice immediately
    dom.playerDisplay.textContent = EMOJI[playerMove];

    // Computer's choice is decided now (revealed after shake)
    const computerMove = getComputerMove();
    const winner = determineWinner(playerMove, computerMove);

    // Show "thinking" question mark on computer side
    dom.computerDisplay.textContent = '❔';

    // Apply shake animation to both
    dom.playerDisplay.classList.add('shake');
    dom.computerDisplay.classList.add('shake');

    setResultMessage('Revealing…', null);

    // Reveal after animation
    setTimeout(() => {
      dom.playerDisplay.classList.remove('shake');
      dom.computerDisplay.classList.remove('shake');

      // Reveal computer emoji
      dom.computerDisplay.textContent = EMOJI[computerMove];
      dom.computerDisplay.classList.add('pop');

      // Update score
      let outcomeKey;
      if (winner === 'player') {
        state.wins += 1;
        outcomeKey = 'win';
        setResultMessage('✨ You win this round! ✨', 'win');
        dom.playerDisplay.classList.add('winner');
        dom.computerDisplay.classList.add('loser');
        playSound('win');
      } else if (winner === 'computer') {
        state.losses += 1;
        outcomeKey = 'loss';
        setResultMessage('💻 Computer wins this round', 'loss');
        dom.computerDisplay.classList.add('winner');
        dom.playerDisplay.classList.add('loser');
        playSound('loss');
      } else {
        state.ties += 1;
        outcomeKey = 'tie';
        setResultMessage("🤝 It's a tie!", 'tie');
        dom.playerDisplay.classList.add('winner');
        dom.computerDisplay.classList.add('winner');
        playSound('tie');
      }

      updateScoreUI();
      updateMatchProgress();
      addHistoryEntry(playerMove, computerMove, outcomeKey);

      state.isPlaying = false;

      // Check for match end
      if (checkMatchOver()) {
        state.matchOver = true;
        setButtonsDisabled(true);
        setTimeout(() => showMatchModal(state.wins > state.losses), 400);
      } else {
        setButtonsDisabled(false);
      }
    }, SHAKE_DURATION);
  }

  /* ---------------------------------------------------------
     8. THEME & SOUND TOGGLES
     --------------------------------------------------------- */
  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    const isDark = theme === 'dark';
    dom.themeIcon.textContent = isDark ? '🌙' : '☀️';
    dom.themeToggle.setAttribute('aria-pressed', String(!isDark));
    storageSet(STORAGE_KEYS.theme, theme);
  }

  function applySound(enabled) {
    state.soundEnabled = enabled;
    dom.soundIcon.textContent = enabled ? '🔊' : '🔇';
    dom.soundToggle.setAttribute('aria-pressed', String(enabled));
    storageSet(STORAGE_KEYS.sound, enabled ? 'on' : 'off');
  }

  /* ---------------------------------------------------------
     9. EVENT WIRING
     --------------------------------------------------------- */
  function wireEvents() {
    // Choice buttons
    dom.rockBtn.addEventListener('click',     () => playRound('rock'));
    dom.paperBtn.addEventListener('click',    () => playRound('paper'));
    dom.scissorsBtn.addEventListener('click', () => playRound('scissors'));

    // Keyboard shortcuts (R / P / S)
    document.addEventListener('keydown', (e) => {
      if (dom.matchModal.hidden === false) return;
      if (state.isPlaying || state.matchOver) return;
      const key = e.key.toLowerCase();
      if (key === 'r') playRound('rock');
      else if (key === 'p') playRound('paper');
      else if (key === 's') playRound('scissors');
    });

    // Reset button
    dom.resetBtn.addEventListener('click', () => {
      resetMatchAndHistory();
    });

    // Best-of select
    dom.bestOfSelect.addEventListener('change', (e) => {
      const v = parseInt(e.target.value, 10) || 1;
      state.bestOf = v;
      recomputeTargetWins();
      storageSet(STORAGE_KEYS.bestOf, String(v));
      resetMatchAndHistory();
    });

    // Theme toggle
    dom.themeToggle.addEventListener('click', () => {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    });

    // Sound toggle
    dom.soundToggle.addEventListener('click', () => {
      applySound(!state.soundEnabled);
      if (state.soundEnabled) playSound('click');
    });

    // Clear history
    dom.clearHistoryBtn.addEventListener('click', () => {
      clearHistory();
    });

    // Match modal
    dom.matchModalBtn.addEventListener('click', () => {
      hideMatchModal();
      resetMatchAndHistory();
    });
    dom.matchModalBackdrop.addEventListener('click', () => {
      hideMatchModal();
      resetMatchAndHistory();
    });

    // ESC closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !dom.matchModal.hidden) {
        hideMatchModal();
        resetMatchAndHistory();
      }
    });
  }

  /* ---------------------------------------------------------
     10. INITIALIZATION
     --------------------------------------------------------- */
  function init() {
    // Load saved preferences
    const savedTheme = storageGet(STORAGE_KEYS.theme, 'dark');
    applyTheme(savedTheme === 'light' ? 'light' : 'dark');

    const savedSound = storageGet(STORAGE_KEYS.sound, 'on');
    applySound(savedSound !== 'off');

    const savedBestOf = parseInt(storageGet(STORAGE_KEYS.bestOf, '5'), 10);
    state.bestOf = [1, 3, 5, 7].includes(savedBestOf) ? savedBestOf : 5;
    dom.bestOfSelect.value = String(state.bestOf);
    recomputeTargetWins();

    // Initial UI
    updateScoreUI();
    updateMatchProgress();
    renderHistory();
    setButtonsDisabled(false);
    hideMatchModal();

    // Wire everything up
    wireEvents();
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
