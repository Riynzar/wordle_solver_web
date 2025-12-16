import os
from flask import Flask, render_template, request, jsonify, session
# Pastikan folder logic ada dan ada file game.py serta solver.py di dalamnya
from logic.game import WordleGame  
from logic.solver import WordleCSP
import random

app = Flask(__name__)
app.secret_key = 'kunci_rahasia_bebas_ganti_aja'

# --- HELPER: Load Kata ---
def get_word_list(length, language='english'):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base_dir, 'library', language, f'{length}.txt')
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return [line.strip().lower() for line in f if len(line.strip()) == int(length)]
    except FileNotFoundError:
        print(f"[ERROR] File kamus tidak ditemukan: {path}")
        return []
    
def get_popular_list(length, language='english'):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    filename = f'{length}_clean_popular.txt'
    path = os.path.join(base_dir, 'library', language, filename)

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
    length = int(request.args.get('len', 5))
    lang = request.args.get('lang', 'english') 
    
    if length not in [4, 5, 6]:
        length = 5
        
    session['mode'] = 'play'
    session['word_length'] = length
    session['language'] = lang
    
    # Gunakan Popular List untuk menentukan Jawaban
    words = get_popular_list(length, language=lang)
    
    if not words:
        # Fallback jika file popular belum ada, pakai full list
        words = get_word_list(length, language=lang)
        if not words:
            return f"Database kata {length} huruf untuk bahasa {lang} tidak ditemukan! Cek folder library.", 404
        
    target = random.choice(words) # Target akan dipilih dari kata populer
    session['target_word'] = target
    session['attempts'] = [] 
    session['game_over'] = False
    
    # Reset tracking hint di session agar aman
    session['hints_revealed'] = [] 
    
    return render_template('play.html', length=length, lang=lang)

@app.route('/solve')
def solve_page():
    length = int(request.args.get('len', 5))
    lang = request.args.get('lang', 'english')
    return render_template('solve.html', length=length, lang=lang)

# --- API (Backend Logic) ---

@app.route('/api/play/guess', methods=['POST'])
def play_guess():
    data = request.json
    guess = data.get('guess', '').lower()
    
    target = session.get('target_word')
    length = session.get('word_length')
    lang = session.get('language', 'english') 
    attempts = session.get('attempts', [])
    
    if not target:
        return jsonify({'error': 'Session expired, please refresh.'}), 400

    if len(guess) != length:
        return jsonify({'error': f'Panjang kata harus {length} huruf'}), 400

    valid_words = get_word_list(length, language=lang)
    
    if guess not in valid_words:
        msg = 'Kata tidak ditemukan di kamus!' if lang == 'indonesia' else 'Word not found in dictionary!'
        return jsonify({'error': msg}), 400

    feedback = WordleGame.calculate_feedback(guess, target)
    
    attempts.append(feedback)
    session['attempts'] = attempts 
    
    won = (guess == target)
    game_over = won or len(attempts) >= 6
    
    return jsonify({
        'feedback': feedback,
        'won': won,
        'game_over': game_over,
        'answer': target if game_over else None
    })

# === FITUR TAMBAHAN: HINT (Dari app.py lain) ===
@app.route('/api/play/hint', methods=['POST'])
def play_hint():
    data = request.json
    index = data.get('index') # Index huruf yang mau dibuka (0-5)
    
    target = session.get('target_word')
    if not target: 
        return jsonify({'error': 'Game over or session expired'}), 400
    
    try:
        # Ambil huruf yang benar pada posisi index tersebut
        letter = target[int(index)].upper()
        
        # Simpan state hint agar server tau user sudah buka hint apa saja (opsional)
        revealed = session.get('hints_revealed', [])
        if int(index) not in revealed:
            revealed.append(int(index))
            session['hints_revealed'] = revealed
            
        return jsonify({'letter': letter})
    except (ValueError, IndexError, TypeError):
        return jsonify({'error': 'Index invalid'}), 400
# =================================================

@app.route('/api/solve/analyze', methods=['POST'])
def solve_analyze():
    data = request.json
    length = data.get('length', 5)
    history = data.get('history', [])
    lang = data.get('lang', 'english') 
    
    word_list = get_word_list(length, language=lang)
    popular_list = get_popular_list(length, language=lang)
    
    if not word_list:
        return jsonify({'error': f'Dictionary not found for {lang} length {length}'}), 400

    solver = WordleCSP(word_list, popular_list)
    
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
        final_entropy_score = solver.calculate_score(word)
        
        score = int(final_entropy_score * 18) 
        if score > 99: score = 99
        if score < 1: score = 1
        
        is_pop = word in solver.popular_set
        
        suggestions.append({
            'word': word.upper(), 
            'score': score,
            'is_popular': is_pop
        })
        
    suggestions.sort(key=lambda x: x['score'], reverse=True)
    
    return jsonify({
        'count': count,
        'suggestions': suggestions[:50] 
    })

if __name__ == '__main__':
    print("Starting Flask Server...")
    app.run(debug=True, port=5000)