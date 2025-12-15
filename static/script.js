// --- SOLVER LOGIC ---

if (window.location.pathname.includes('/solve')) {
    let rowCount = 0;

    function createRow() {
        const container = document.getElementById('board-container');
        const row = document.createElement('div');
        row.className = 'row';
        row.id = `row-${rowCount}`;

        for (let i = 0; i < WORD_LENGTH; i++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.setAttribute('data-state', 'grey'); // Default grey
            
            const input = document.createElement('input');
            input.type = 'text';
            input.maxLength = 1;
            input.className = 'tile-input';
            
            // --- PERBAIKAN DI SINI ---
            tile.addEventListener('click', (e) => {
                if (input.value) {
                    toggleColor(tile);
                    
                }
            });

            // Auto-focus logic
            input.addEventListener('keyup', (e) => {
                // Pindah ke kotak sebelah kalau sudah ketik 1 huruf
                if (input.value.length === 1) {
                    const next = tile.nextElementSibling?.querySelector('input');
                    if (next) next.focus();
                }
                // Backspace: pindah ke kotak sebelumnya
                if (e.key === 'Backspace' && input.value.length === 0) {
                     const prev = tile.previousElementSibling?.querySelector('input');
                     if (prev) prev.focus();
                }
            });
            // -------------------------

            tile.appendChild(input);
            row.appendChild(tile);
        }
        container.appendChild(row);
        rowCount++;
    }

    function toggleColor(tile) {
        const states = ['grey', 'yellow', 'green'];
        const current = tile.getAttribute('data-state');
        const next = states[(states.indexOf(current) + 1) % states.length];
        
        tile.setAttribute('data-state', next);
    }

    async function analyzeSolver() {
        const history = [];
        const rows = document.querySelectorAll('.row');
        
        rows.forEach(row => {
            let word = "";
            let feedback = "";
            let complete = true;

            row.querySelectorAll('.tile').forEach(tile => {
                const letter = tile.querySelector('input').value.toUpperCase();
                const state = tile.getAttribute('data-state');
                
                if (!letter) complete = false;
                
                word += letter;
                if (state === 'green') feedback += 'G';
                else if (state === 'yellow') feedback += 'Y';
                else feedback += 'X';
            });

            if (complete && word.length === WORD_LENGTH) {
                history.push({ word: word, feedback: feedback });
            }
        });

        if (history.length === 0) {
            alert("Isi kata dan atur warnanya terlebih dahulu.");
            return;
        }

        const response = await fetch('/api/solve/analyze', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ length: WORD_LENGTH, history: history })
        });
        
        const data = await response.json();
        renderSuggestions(data);
    }

    function renderSuggestions(data) {
        const list = document.getElementById('suggestion-list');
        const count = document.getElementById('result-count');
        
        count.textContent = `${data.count} Words Found`;
        list.innerHTML = '';

        data.suggestions.forEach(item => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `
                <span class="word-badge">${item.word}</span>
                <span class="score-badge">${item.score}% Prob</span>
            `;
            list.appendChild(div);
        });
    }

    document.addEventListener('DOMContentLoaded', createRow);
    window.addSolverRow = createRow;
    window.analyzeSolver = analyzeSolver;
}

// === MODE PLAY (GENERATOR) ===
// === MODE PLAY (GAME) ===
// === MODE PLAY (GAME) ===
if (window.location.pathname.includes('/play')) {
  const gameBoard = document.getElementById('game-board');
  const msgDiv = document.getElementById('message');

  const resetBtn = document.getElementById('resetBtn');
  const modal = document.getElementById('endModal');
  const endTitle = document.getElementById('endTitle');
  const endDesc = document.getElementById('endDesc');
  const playAgainBtn = document.getElementById('playAgainBtn');

  let currentAttempt = 0;
  let currentGuess = "";
  let isGameOver = false;
  const MAX_ATTEMPTS = 6;

  // --- Reset game (refresh /play?len=...) ---
  function resetGame() {
    const params = new URLSearchParams(window.location.search);
    const len = params.get('len') || window.WORD_LENGTH || 5;
    // pertahankan bundle
    const bundle = params.get('bundle');
    let url = `/play?len=${len}`;
    if (bundle) url += `&bundle=${bundle}`;
    window.location.href = url;
  }
  if (resetBtn) resetBtn.addEventListener('click', resetGame);

  // --- Modal helpers ---
  function openModal(title, desc, primaryText) {
    endTitle.textContent = title;
    endDesc.textContent = desc;
    playAgainBtn.textContent = primaryText;

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }
  function closeModal() {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }
  playAgainBtn.addEventListener('click', () => {
    closeModal();
    resetGame();
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // 1) Init empty grid
  function initGrid() {
    gameBoard.innerHTML = '';
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const row = document.createElement('div');
      row.className = 'game-row';
      row.style.setProperty('--letters', WORD_LENGTH);
      row.id = `row-${i}`;

      for (let j = 0; j < WORD_LENGTH; j++) {
        const tile = document.createElement('div');
        tile.className = 'game-tile';
        tile.id = `row-${i}-tile-${j}`;
        row.appendChild(tile);
      }
      gameBoard.appendChild(row);
    }
  }

  // 2) Update tiles while typing
  function updateGrid() {
    for (let i = 0; i < WORD_LENGTH; i++) {
      const tile = document.getElementById(`row-${currentAttempt}-tile-${i}`);
      const letter = currentGuess[i] || "";
      tile.textContent = letter;

      if (letter) {
        tile.setAttribute('data-status', 'active');
        tile.style.borderColor = "#878a8c";
      } else {
        tile.removeAttribute('data-status');
        tile.style.borderColor = "#d3d6da";
      }
    }
  }

  function showMessage(text, color) {
    msgDiv.textContent = text;
    msgDiv.style.color = color || "black";
    // kalau game over, jangan auto-clear
    if (!isGameOver) {
      setTimeout(() => { msgDiv.textContent = ""; }, 2500);
    }
  }

  function shakeRow() {
    const row = document.getElementById(`row-${currentAttempt}`);
    row.classList.add("shake");
    setTimeout(() => row.classList.remove("shake"), 300);
  }

  // 3) Color row based on feedback (flip animation)
  function colorRow(rowIndex, feedback) {
    for (let i = 0; i < WORD_LENGTH; i++) {
      const tile = document.getElementById(`row-${rowIndex}-tile-${i}`);
      const status = feedback[i].status; // green/yellow/grey

      setTimeout(() => {
        tile.classList.add('flip');
        tile.setAttribute('data-state', status);
        tile.style.border = "none";
      }, i * 120);
    }
  }

  // --- Confetti (canvas overlay) ---
  function createConfetti() {
    const canvas = document.getElementById("confettiCanvas");
    const ctx = canvas.getContext("2d");

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    canvas.classList.add("show");

    const pieces = [];
    const N = 160;
    for (let i = 0; i < N; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.2,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 10,
        vx: -2 + Math.random() * 4,
        vy: 2 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        vr: -0.15 + Math.random() * 0.3,
        a: 1
      });
    }

    let t = 0;
    function tick() {
      t++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      pieces.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.vy += 0.02; // gravity
        if (t > 200) p.a -= 0.01;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.a);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      if (t < 320) requestAnimationFrame(tick);
      else {
        canvas.classList.remove("show");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    tick();
  }

  // 4) Submit guess
  async function submitGuess() {
    if (currentGuess.length !== WORD_LENGTH) {
      showMessage("Huruf kurang!", "red");
      shakeRow();
      return;
    }

    try {
      const res = await fetch('/api/play/guess', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ guess: currentGuess })
      });
      const data = await res.json();

      if (data.error) {
        showMessage(data.error, "red");
        return;
      }

      colorRow(currentAttempt, data.feedback);

      if (data.won) {
        isGameOver = true;
        showMessage("🎉 SELAMAT! KAMU MENANG!", "green");
        createConfetti();
        openModal("Kamu Menang! 🎉", "Mau main lagi atau balik ke beranda?", "Main lagi");
        return;
      }

      if (data.game_over) {
        isGameOver = true;
        showMessage(`Game Over! Jawabannya: ${data.answer.toUpperCase()}`, "red");
        openModal("Kamu Kalah 😭", `Jawabannya: ${data.answer.toUpperCase()}`, "Coba lagi");
        return;
      }

      currentAttempt++;
      currentGuess = "";
      updateGrid();

    } catch (e) {
      console.error(e);
      showMessage("Error koneksi", "red");
    }
  }

  // Keyboard listener
  document.addEventListener('keydown', (e) => {
    if (isGameOver) return;

    const key = e.key.toUpperCase();

    if (key === 'ENTER') {
      submitGuess();
    } else if (key === 'BACKSPACE') {
      currentGuess = currentGuess.slice(0, -1);
      updateGrid();
    } else if (/^[A-Z]$/.test(key)) {
      if (currentGuess.length < WORD_LENGTH) {
        currentGuess += key;
        updateGrid();
      }
    }
  });

  initGrid();
}
