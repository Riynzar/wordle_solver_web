import os
from flask import Flask, render_template, request, jsonify, session
from logic.game import WordleGame, Status
from logic.solver import WordleCSP
import random

app = Flask(__name__)
app.secret_key = 'super_secret_key_wordle_indo'

# --- HELPER FUNCTIONS ---
def get_word_list(length):
    try:
        path = os.path.join(os.path.dirname(__file__), f'library/english/{length}.txt')
        with open(path, 'r', encoding='utf-8') as f:
            return [line.strip().lower() for line in f if len(line.strip()) == int(length)]
    except FileNotFoundError:
        return []

# --- ROUTES HALAMAN ---

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/play')
def play_page():
    length = int(request.args.get('len', 5))
    session['mode'] = 'play'
    session['word_length'] = length
    
    words = get_word_list(length)
    if not words:
        return "Database kata tidak ditemukan!", 404
        
    target = random.choice(words)
    session['target_word'] = target
    session['attempts'] = []
    session['game_over'] = False
    
    return render_template('play.html', length=length)

@app.route('/solve')
def solve_page():
    length = int(request.args.get('len', 5))
    return render_template('solve.html', length=length)

# --- API ENDPOINTS ---

@app.route('/api/play/guess', methods=['POST'])
def play_guess():
    data = request.json
    guess = data.get('guess', '').lower()
    target = session.get('target_word')
    length = session.get('word_length')
    
    if not target or len(guess) != length:
        return jsonify({'error': 'Invalid guess'}), 400

    feedback = []
    ans_chars = list(target)
    temp_feedback = [{'letter': l.upper(), 'status': 'grey'} for l in guess]
    
    # Pass 1: Green
    for i, char in enumerate(guess):
        if char == target[i]:
            temp_feedback[i]['status'] = 'green'
            ans_chars[i] = None
            
    # Pass 2: Yellow
    for i, char in enumerate(guess):
        if temp_feedback[i]['status'] == 'grey':
            if char in ans_chars:
                temp_feedback[i]['status'] = 'yellow'
                ans_chars[ans_chars.index(char)] = None
    
    attempts = session.get('attempts', [])
    attempts.append(temp_feedback)
    session['attempts'] = attempts
    
    won = (guess == target)
    game_over = won or len(attempts) >= 6
    
    return jsonify({
        'feedback': temp_feedback,
        'won': won,
        'game_over': game_over,
        'answer': target if game_over else None
    })

@app.route('/api/solve/analyze', methods=['POST'])
def solve_analyze():
    data = request.json
    length = data.get('length', 5)
    history = data.get('history', [])
    
    word_list = get_word_list(length)
    solver = WordleCSP(word_list)
    
    # Terapkan constraint
    try:
        for entry in history:
            solver.add_constraint(entry['word'], entry['feedback'])
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    candidates = solver.domain
    count = len(candidates)
    
    suggestions = []
    
    # ### PERBAIKAN 1: Jangan limit 10, tapi ambil lebih banyak (misal 200) untuk dianalisa
    # Kalau cuma ambil 10 teratas dari list, itu cuma ambil kata berawalan A-B secara acak
    process_limit = min(len(candidates), 200) 
    
    for word in candidates[:process_limit]:
        # Hitung Entropy Score
        entropy = solver.calc_entropy(word)
        
        # Konversi entropy ke 0-99 (Skala disesuaikan)
        score = int(entropy * 18) 
        if score > 99: score = 99
        if score < 1: score = 1
        
        suggestions.append({'word': word.upper(), 'score': score})
        
    # ### PERBAIKAN 2: SORTING (PENTING!)
    # Urutkan list berdasarkan 'score' dari terbesar ke terkecil
    suggestions.sort(key=lambda x: x['score'], reverse=True)
    
    # Kembalikan 50 kata terbaik setelah disortir
    return jsonify({
        'count': count,
        'suggestions': suggestions[:50] 
    })

if __name__ == '__main__':
    app.run(debug=True)