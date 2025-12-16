import os
from flask import Flask, render_template, request, jsonify, session
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
    
    # LOGIKA BARU: Ambil lang dari URL, jika tidak ada ambil dari Session, default english
    lang = request.args.get('lang', session.get('language', 'english'))
    
    # Simpan ke session agar persisten
    session['language'] = lang
    session['mode'] = 'play'
    session['word_length'] = length
    
    words = get_popular_list(length, language=lang)
    if not words:
        words = get_word_list(length, language=lang)
        if not words:
            return f"Database kata {length} huruf ({lang}) tidak ditemukan!", 404
        
    target = random.choice(words)
    session['target_word'] = target
    session['attempts'] = [] 
    session['game_over'] = False
    session['hints_revealed'] = [] 
    
    return render_template('play.html', length=length, lang=lang)

@app.route('/solve')
def solve_page():
    length = int(request.args.get('len', 5))
    
    # LOGIKA BARU: Ambil lang dari URL, jika tidak ada ambil dari Session, default english
    lang = request.args.get('lang', session.get('language', 'english'))
    
    # Simpan ke session
    session['language'] = lang
    
    return render_template('solve.html', length=length, lang=lang)

# --- API (Backend Logic) ---

@app.route('/api/play/guess', methods=['POST'])
def play_guess():
    data = request.json
    guess = data.get('guess', '').lower()
    
    target = session.get('target_word')
    length = session.get('word_length')
    lang = session.get('language', 'english') # Ambil dari session
    attempts = session.get('attempts', [])
    
    if not target: return jsonify({'error': 'Session expired.'}), 400
    if len(guess) != length: return jsonify({'error': f'Panjang kata harus {length} huruf'}), 400

    valid_words = get_word_list(length, language=lang)
    if guess not in valid_words:
        msg = 'Kata tidak ditemukan!' if lang == 'indonesia' else 'Word not found!'
        return jsonify({'error': msg}), 400

    feedback = WordleGame.calculate_feedback(guess, target)
    attempts.append(feedback)
    session['attempts'] = attempts 
    won = (guess == target)
    game_over = won or len(attempts) >= 6
    
    return jsonify({
        'feedback': feedback, 'won': won, 'game_over': game_over,
        'answer': target if game_over else None
    })

@app.route('/api/play/hint', methods=['POST'])
def play_hint():
    data = request.json
    index = data.get('index')
    target = session.get('target_word')
    if not target: return jsonify({'error': 'Game over'}), 400
    try:
        letter = target[int(index)].upper()
        return jsonify({'letter': letter})
    except: return jsonify({'error': 'Index invalid'}), 400

@app.route('/api/solve/analyze', methods=['POST'])
def solve_analyze():
    data = request.json
    length = data.get('length', 5)
    history = data.get('history', [])
    
    # Ambil lang dari JSON yang dikirim JS, atau fallback ke english
    lang = data.get('lang', 'english') 
    
    word_list = get_word_list(length, language=lang)
    popular_list = get_popular_list(length, language=lang)
    
    if not word_list:
        return jsonify({'error': f'Kamus {lang} {length} huruf tidak ditemukan.'}), 400

    solver = WordleCSP(word_list, popular_list)
    
    try:
        for entry in history:
            solver.add_constraint(entry['word'], entry['feedback'])
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    candidates = solver.domain
    suggestions = []
    
    process_limit = min(len(candidates), 200) 
    for word in candidates[:process_limit]:
        score = int(solver.calculate_score(word) * 18) 
        if score > 99: score = 99
        if score < 1: score = 1
        suggestions.append({'word': word.upper(), 'score': score})
        
    suggestions.sort(key=lambda x: x['score'], reverse=True)
    return jsonify({'count': len(candidates), 'suggestions': suggestions[:50]})

if __name__ == '__main__':
    app.run(debug=True, port=5000)