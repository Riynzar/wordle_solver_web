// --- SOLVER LOGIC ---

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

// --- PLAY LOGIC (GENERATOR) ---

if (window.location.pathname.includes('/play')) {
    const gameBoard = document.getElementById('game-board');

    async function submitGuess() {
        const input = document.getElementById('guess-input');
        const guess = input.value;
        
        if (guess.length !== WORD_LENGTH) return alert(`Must be ${WORD_LENGTH} letters`);

        const res = await fetch('/api/play/guess', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ guess: guess })
        });
        
        const data = await res.json();
        
        if(data.error) return alert(data.error);

        renderRow(guess, data.feedback);
        input.value = '';
        input.focus();

        if (data.won) {
            document.getElementById('message').innerHTML = "<h2>🎉 YOU WON!</h2>";
            input.disabled = true;
        } else if (data.game_over) {
            document.getElementById('message').innerHTML = `<h2>Game Over! Answer: ${data.answer.toUpperCase()}</h2>`;
        }
    }

    function renderRow(word, feedback) {
        const row = document.createElement('div');
        row.className = 'row';
        
        feedback.forEach(item => {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.setAttribute('data-state', item.status);
            tile.textContent = item.letter;
            row.appendChild(tile);
        });
        
        gameBoard.appendChild(row);
    }
}