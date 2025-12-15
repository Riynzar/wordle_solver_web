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
            // Event: Klik tile (atau input di dalamnya) untuk ganti warna
            // Syarat: Harus ada hurufnya dulu baru bisa ganti warna
            tile.addEventListener('click', (e) => {
                if (input.value) {
                    toggleColor(tile);
                    
                    // Opsional: Supaya kursor tidak 'nyangkut' saat cuma mau ganti warna
                    // input.blur(); 
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
if (window.location.pathname.includes('/play')) {
    const gameBoard = document.getElementById('game-board');
    const msgDiv = document.getElementById('message');
    
    let currentAttempt = 0; // Baris ke berapa (0-5)
    let currentGuess = "";  // Huruf yang sedang diketik
    let isGameOver = false;
    const MAX_ATTEMPTS = 6;

    // 1. Inisialisasi Grid Kosong
    function initGrid() {
        gameBoard.innerHTML = '';
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            const row = document.createElement('div');
            row.className = 'game-row';
            row.style.setProperty('--letters', WORD_LENGTH); // Set CSS Variable
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

    // 2. Update Tampilan Kotak saat Ngetik
    function updateGrid() {
        const row = document.getElementById(`row-${currentAttempt}`);
        if (!row) return;

        // Loop setiap kotak di baris aktif
        for (let i = 0; i < WORD_LENGTH; i++) {
            const tile = document.getElementById(`row-${currentAttempt}-tile-${i}`);
            const letter = currentGuess[i] || ""; // Ambil huruf atau kosong

            tile.textContent = letter;
            
            // Ubah border jika ada isi (Efek visual)
            if (letter) {
                tile.setAttribute('data-status', 'active');
                tile.style.borderColor = "#878a8c"; 
            } else {
                tile.removeAttribute('data-status');
                tile.style.borderColor = "#d3d6da";
            }
        }
    }

    // 3. Kirim Tebakan ke Server (Enter)
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

            // Warnai Kotak berdasarkan respon Server
            colorRow(currentAttempt, data.feedback);

            if (data.won) {
                showMessage("🎉 SELAMAT! KAMU MENANG!", "green");
                isGameOver = true;
                createConfetti(); // Opsional kalau mau tambah efek
            } else if (data.game_over) {
                showMessage(`Game Over! Jawabannya: ${data.answer.toUpperCase()}`, "red");
                isGameOver = true;
            } else {
                // Lanjut ke baris berikutnya
                currentAttempt++;
                currentGuess = "";
            }

        } catch (e) {
            console.error(e);
            showMessage("Error koneksi", "red");
        }
    }

    // Fungsi Mewarnai Kotak (Permanen setelah Enter)
   function colorRow(rowIndex, feedback) {
        for (let i = 0; i < WORD_LENGTH; i++) {
            const tile = document.getElementById(`row-${rowIndex}-tile-${i}`);
            const status = feedback[i].status; // green, yellow, grey
            
            setTimeout(() => {
                tile.setAttribute('data-state', status); 
                // tile.style.color = "white";  <-- HAPUS INI (Sudah diurus CSS)
                tile.style.border = "none";
                
                // Tambahkan animasi flip css class (opsional biar keren)
                tile.style.transition = "transform 0.5s, background-color 0.5s";
                tile.style.transform = "rotateX(360deg)";
            }, i * 200);
        }
    }

    function showMessage(text, color) {
        msgDiv.textContent = text;
        msgDiv.style.color = color || "black";
        setTimeout(() => { msgDiv.textContent = ""; }, 3000);
    }

    function shakeRow() {
        const row = document.getElementById(`row-${currentAttempt}`);
        row.style.transform = "translateX(5px)";
        setTimeout(() => row.style.transform = "translateX(-5px)", 50);
        setTimeout(() => row.style.transform = "translateX(5px)", 100);
        setTimeout(() => row.style.transform = "translateX(0)", 150);
    }

    // 4. Global Keyboard Listener
    document.addEventListener('keydown', (e) => {
        if (isGameOver) return;

        const key = e.key.toUpperCase();

        if (key === 'ENTER') {
            submitGuess();
        } else if (key === 'BACKSPACE') {
            currentGuess = currentGuess.slice(0, -1);
            updateGrid();
        } else if (/^[A-Z]$/.test(key)) { // Hanya huruf A-Z
            if (currentGuess.length < WORD_LENGTH) {
                currentGuess += key;
                updateGrid();
            }
        }
    });

    // Jalankan inisialisasi awal
    initGrid();
}