import os
from flask import Flask, render_template, request, jsonify, session
from logic.game import WordleGame  # Import class yang sudah diperbaiki
from logic.solver import WordleCSP
import random

app = Flask(__name__)
app.secret_key = 'kunci_rahasia_bebas_ganti_aja'

# --- HELPER: Load Kata ---
def get_word_list(length):
    # Path yang aman
    base_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base_dir, 'library', 'english', f'{length}.txt')
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return [line.strip().lower() for line in f if len(line.strip()) == int(length)]
    except FileNotFoundError:
        return []

# --- ROUTES ---

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/play')
def play_page():
    # Ambil parameter panjang kata, default 5
    length = int(request.args.get('len', 5))
    
    # Validasi input agar user tidak iseng ngetik ?len=100
    if length not in [4, 5, 6]:
        length = 5
        
    session['mode'] = 'play'
    session['word_length'] = length
    
    words = get_word_list(length)
    if not words:
        return f"Database kata {length} huruf tidak ditemukan!", 404
        
    target = random.choice(words)
    session['target_word'] = target
    session['attempts'] = [] 
    session['game_over'] = False
    
    # Kirim variabel 'length' ke HTML agar dropdown bisa menyesuaikan diri
    return render_template('play.html', length=length)

@app.route('/solve')
def solve_page():
    length = int(request.args.get('len', 5))
    return render_template('solve.html', length=length)

# --- API (Backend Logic) ---

@app.route('/api/play/guess', methods=['POST'])
def play_guess():
    data = request.json
    guess = data.get('guess', '').lower()
    
    # Ambil state dari session
    target = session.get('target_word')
    length = session.get('word_length')
    attempts = session.get('attempts', [])
    
    if not target:
        return jsonify({'error': 'Sesi habis. Refresh halaman.'}), 400
    if len(guess) != length:
        return jsonify({'error': f'Kata harus {length} huruf!'}), 400

    # --- PAKAI LOGIKA DARI GAME.PY ---
    # Kita panggil fungsi static yang sudah kita siapkan
    feedback = WordleGame.calculate_feedback(guess, target)
    
    # Simpan hasil ke session history
    attempts.append(feedback)
    session['attempts'] = attempts # Simpan balik ke session
    
    # Cek Menang/Kalah
    won = (guess == target)
    game_over = won or len(attempts) >= 6
    
    return jsonify({
        'feedback': feedback,
        'won': won,
        'game_over': game_over,
        'answer': target if game_over else None
    })

@app.route('/api/solve/analyze', methods=['POST'])
def solve_analyze():
    # ... (Bagian solver tetap sama seperti sebelumnya yang sudah working)
    data = request.json
    length = data.get('length', 5)
    history = data.get('history', [])
    
    word_list = get_word_list(length)
    solver = WordleCSP(word_list)
    
    try:
        for entry in history:
            solver.add_constraint(entry['word'], entry['feedback'])
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    candidates = solver.domain
    count = len(candidates)
    suggestions = []
    
    process_limit = min(len(candidates), 200) 
    for word in candidates[:process_limit]:
        entropy = solver.calc_entropy(word)
        score = int(entropy * 18) 
        if score > 99: score = 99
        if score < 1: score = 1
        suggestions.append({'word': word.upper(), 'score': score})
        
    suggestions.sort(key=lambda x: x['score'], reverse=True)
    
    return jsonify({
        'count': count,
        'suggestions': suggestions[:50] 
    })

if __name__ == '__main__':
    app.run(debug=True)