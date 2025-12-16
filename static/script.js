// ==========================================
// KONFIGURASI GLOBAL
// ==========================================
const WORD_LENGTH = typeof window.WORD_LENGTH !== 'undefined' ? window.WORD_LENGTH : 5;


// ==========================================
// LOGIKA SOLVER (/solve)
// ==========================================
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
            
            // Klik kotak untuk ganti warna (hanya jika ada huruf)
            tile.addEventListener('click', (e) => {
                if (input.value) {
                    toggleColor(tile);
                }
            });

            // Auto-focus logic
            input.addEventListener('keyup', (e) => {
                if (input.value.length === 1) {
                    const next = tile.nextElementSibling?.querySelector('input');
                    if (next) next.focus();
                }
                if (e.key === 'Backspace' && input.value.length === 0) {
                     const prev = tile.previousElementSibling?.querySelector('input');
                     if (prev) prev.focus();
                }
            });

            tile.appendChild(input);
            row.appendChild(tile);
        }
        container.appendChild(row);
        rowCount++;
    }

    function toggleColor(tile) {
        // Mencegah klik spam saat animasi berjalan
        if (tile.classList.contains('flip')) return;

        const states = ['grey', 'yellow', 'green'];
        const current = tile.getAttribute('data-state');
        const next = states[(states.indexOf(current) + 1) % states.length];
        
        // 1. Tambahkan class animasi
        tile.classList.add('flip');

        // 2. Tunggu setengah animasi (saat kartu gepeng/tegak lurus), baru ganti warna
        setTimeout(() => {
            tile.setAttribute('data-state', next);
            
            // Logika Border:
            // Kalau berwarna (Green/Yellow/Grey), border biasanya hilang (flat color).
            // Tapi karena default solver startnya grey, kita biarkan logic CSS yang handle.
            // CSS kita diatas sudah set border-color sama dengan background.
            
        }, 150); // 150ms adalah setengah dari durasi animasi flip umum

        // 3. Hapus class animasi setelah selesai agar bisa di-flip lagi nanti
        setTimeout(() => {
            tile.classList.remove('flip');
        }, 400);
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
                <span class="score-badge">${item.score} Score</span>
            `;
            list.appendChild(div);
        });
    }

    // Init Solver
    document.addEventListener('DOMContentLoaded', createRow);
    window.addSolverRow = createRow;
    window.analyzeSolver = analyzeSolver;
}


// ==========================================
// LOGIKA GAME / PLAY (/play)
// ==========================================
if (window.location.pathname.includes('/play')) {
  const gameBoard = document.getElementById('game-board');
  const msgDiv = document.getElementById('message');
  const resetBtn = document.getElementById('resetBtn');
  const hintBtn = document.getElementById('hintBtn');
  const keyboardContainer = document.getElementById('keyboard');
  
  // Modals
  const modal = document.getElementById('endModal');
  const endTitle = document.getElementById('endTitle');
  const endDesc = document.getElementById('endDesc');
  const playAgainBtn = document.getElementById('playAgainBtn');

  // Hint Elements
  const hintModal = document.getElementById('hintModal');
  const hintContainer = document.getElementById('hintCardsContainer');

  // Game State
  let currentAttempt = 0;
  let currentGuess = "";
  let isGameOver = false;
  const MAX_ATTEMPTS = 6;

  // Hint State
  let hintUsedThisTurn = false;
  let revealedIndices = [];

  // --- FUNGSI UTAMA ---

  function resetGame() {
    window.location.href = `/play?len=${window.WORD_LENGTH}`;
  }
  if(resetBtn) resetBtn.addEventListener('click', resetGame);

  // 1. Inisialisasi Grid Game
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
    
    // Matikan tombol hint di awal game
    if(hintBtn) hintBtn.disabled = true;
  }

  // 2. Update Tampilan Kotak saat Ngetik
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

  // 3. Efek Getar jika Salah
  function shakeRow() {
    const row = document.getElementById(`row-${currentAttempt}`);
    row.classList.add("shake");
    setTimeout(() => row.classList.remove("shake"), 300);
  }

  // 4. Submit Tebakan
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
        shakeRow();
        return;
      }

      // A. Warnai Grid (Animasi Flip)
      colorRow(currentAttempt, data.feedback);

      // B. Warnai Keyboard (Delay sedikit biar sinkron sama flip)
      setTimeout(() => updateKeyboardColors(data.feedback), 1500);

      // C. Cek Menang
      if (data.won) {
        isGameOver = true;
        createConfetti();
        setTimeout(() => openModal("🎉 Menang!", "Kamu hebat banget!", "Main lagi"), 2000);
        return;
      }

      // D. Cek Kalah
      if (data.game_over) {
        isGameOver = true;
        setTimeout(() => openModal("Game Over", `Jawabannya: ${data.answer.toUpperCase()}`, "Coba lagi"), 2000);
        return;
      }

      // E. Lanjut Turn Berikutnya
      currentAttempt++;
      currentGuess = "";
      updateGrid();

      // Reset Hint Button Logic
      // Tombol Hint nyala mulai dari input ke-2 (index 1)
      if(currentAttempt >= 1 && hintBtn) {
          hintBtn.disabled = false; 
          // Text tidak diubah agar layout stabil
          hintUsedThisTurn = false; 
      }

    } catch (e) {
      console.error(e);
      showMessage("Error koneksi", "red");
    }
  }

  // --- VIRTUAL KEYBOARD ---
  const KEYBOARD_LAYOUT = [
      "QWERTYUIOP",
      "ASDFGHJKL",
      "ZXCVBNM"
  ];

  function initVirtualKeyboard() {
      if(!keyboardContainer) return;
      keyboardContainer.innerHTML = '';
      
      KEYBOARD_LAYOUT.forEach((rowStr, index) => {
          const rowDiv = document.createElement('div');
          rowDiv.className = 'keyboard-row';
          
          let keys = rowStr.split('');
          if (index === 2) { keys.unshift('ENTER'); keys.push('⌫'); }

          keys.forEach(keyChar => {
              const btn = document.createElement('button');
              btn.className = 'key';
              btn.textContent = keyChar;
              btn.setAttribute('data-key', keyChar === '⌫' ? 'BACKSPACE' : keyChar);
              
              if (keyChar === 'ENTER' || keyChar === '⌫') btn.classList.add('key-wide');

              btn.addEventListener('click', () => handleVirtualKey(keyChar));
              rowDiv.appendChild(btn);
          });
          keyboardContainer.appendChild(rowDiv);
      });
  }

  function handleVirtualKey(key) {
      if (isGameOver) return;
      if (key === 'ENTER') submitGuess();
      else if (key === '⌫') { currentGuess = currentGuess.slice(0, -1); updateGrid(); }
      else { if (currentGuess.length < WORD_LENGTH) { currentGuess += key; updateGrid(); } }
  }

  function updateKeyboardColors(feedback) {
      feedback.forEach(item => {
          const keyBtn = document.querySelector(`.key[data-key="${item.letter}"]`);
          if (!keyBtn) return;
          const currentState = keyBtn.getAttribute('data-state');
          const newState = item.status;
          
          // Prioritas warna: Green > Yellow > Grey
          if (currentState === 'green') return;
          if (currentState === 'yellow' && newState !== 'green') return;
          
          keyBtn.setAttribute('data-state', newState);
      });
  }

  // --- HINT SYSTEM ---
  function initHintCards() {
    if(!hintContainer) return;
    hintContainer.innerHTML = '';
    hintContainer.style.gridTemplateColumns = `repeat(${WORD_LENGTH}, 1fr)`;

    for(let i=0; i<WORD_LENGTH; i++) {
        const card = document.createElement('div');
        card.className = 'hint-card';
        card.dataset.index = i;
        card.innerHTML = `
            <div class="hint-inner">
                <div class="hint-front">?</div>
                <div class="hint-back"></div>
            </div>
        `;
        card.addEventListener('click', () => onHintCardClick(card, i));
        hintContainer.appendChild(card);
    }
  }

  if(hintBtn) {
      hintBtn.addEventListener('click', () => {
          if(currentAttempt < 1) { showMessage("Mainkan minimal 1 kata dulu!", "red"); return; }
          hintModal.classList.add('show');
      });
  }

  window.closeHintModal = function() {
      hintModal.classList.remove('show');
  }

  async function onHintCardClick(cardElement, index) {
      if(revealedIndices.includes(index)) return; 
      if(hintUsedThisTurn) { alert("Hanya boleh 1 hint per jalan!"); return; }

      try {
          const res = await fetch('/api/play/hint', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ index: index })
          });
          const data = await res.json();

          if(data.error) { alert(data.error); return; }

          // Buka Kartu
          cardElement.querySelector('.hint-back').textContent = data.letter;
          cardElement.classList.add('flipped');

          // Update State
          revealedIndices.push(index);
          hintUsedThisTurn = true; 

          // Matikan tombol hint (tanpa ubah teks)
          hintBtn.disabled = true; 
          
      } catch(e) { console.error(e); }
  }


  // --- HELPERS ---
  function colorRow(rowIndex, feedback) {
    for (let i = 0; i < WORD_LENGTH; i++) {
      const tile = document.getElementById(`row-${rowIndex}-tile-${i}`);
      setTimeout(() => {
        tile.classList.add('flip');
        tile.setAttribute('data-state', feedback[i].status);
        tile.style.border = "none";
      }, i * 120);
    }
  }

  function showMessage(text, color) {
    msgDiv.textContent = text;
    msgDiv.style.color = color || "black";
    if (!isGameOver) setTimeout(() => { msgDiv.textContent = ""; }, 2500);
  }

  function openModal(title, desc, primaryText) {
    endTitle.textContent = title;
    endDesc.textContent = desc;
    playAgainBtn.textContent = primaryText;
    modal.classList.add('show');
  }

  function closeModal() { modal.classList.remove('show'); }
  playAgainBtn.addEventListener('click', resetGame);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  // Event Listener Keyboard Fisik
  document.addEventListener('keydown', (e) => {
    if (isGameOver) return;
    const key = e.key.toUpperCase();
    if (key === 'ENTER') submitGuess();
    else if (key === 'BACKSPACE') { currentGuess = currentGuess.slice(0, -1); updateGrid(); }
    else if (/^[A-Z]$/.test(key)) { if (currentGuess.length < WORD_LENGTH) { currentGuess += key; updateGrid(); } }
  });

  // CONFETTI ANIMATION
  function createConfetti() {
    const canvas = document.getElementById("confettiCanvas");
    if(!canvas) return;
    const ctx = canvas.getContext("2d");
    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize(); window.addEventListener("resize", resize);
    canvas.classList.add("show");
    
    const pieces = [];
    for (let i = 0; i < 150; i++) {
      pieces.push({
        x: Math.random() * canvas.width, y: -20 - Math.random() * canvas.height,
        w: 6 + Math.random()*6, h: 8 + Math.random()*10,
        vx: -2+Math.random()*4, vy: 2+Math.random()*5,
        rot: Math.random()*Math.PI, vr: -0.1+Math.random()*0.2, a: 1
      });
    }
    let t = 0;
    function tick() {
      t++; ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        p.x+=p.vx; p.y+=p.vy; p.rot+=p.vr; p.vy+=0.02;
        if(t>200) p.a-=0.01;
        ctx.save(); ctx.globalAlpha=Math.max(0,p.a); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
        ctx.fillStyle = `hsl(${Math.random()*360}, 70%, 50%)`;
        ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h); ctx.restore();
      });
      if(t<300) requestAnimationFrame(tick); else { canvas.classList.remove("show"); }
    }
    tick();
  }

  // JALANKAN INIT
  initGrid();
  initVirtualKeyboard();
  initHintCards();
}