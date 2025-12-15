import os
import random
from typing import List, Dict
from enum import Enum

# config
WORD_LENGTH = 5 
MAX_ATTEMPTS = 6

class Status(Enum):
    GREEN = "green"
    YELLOW = "yellow"
    GREY = "grey"

class WordleGame:
    def __init__(self, word_length: int = WORD_LENGTH, max_attempts: int = MAX_ATTEMPTS):
        self.word_length = word_length
        self.max_attempts = max_attempts
        self.word_list = self._load_words()
        self.answer: str = ""
        self.attempts: List[List[Dict]] = []
        self.game_over: bool = False
        self.won: bool = False
        self.new_game()
    
    def _load_words(self) -> List[str]:
        # Menggunakan path absolute agar tidak error path
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        word_file = os.path.join(base_dir, "library", "english", f"{self.word_length}.txt")
        
        try:
            with open(word_file, 'r', encoding='utf-8') as f:
                words = [line.strip().lower() for line in f if line.strip()]
            return [w for w in words if len(w) == self.word_length]
        except FileNotFoundError:
            print(f"[ERROR] File tidak ditemukan di: {word_file}")
            return [] # Return list kosong biar gak crash

    def new_game(self) -> str:
        if not self.word_list:
            self.answer = "error" # Fallback jika file gagal load
        else:
            self.answer = random.choice(self.word_list)
        
        self.attempts = []
        self.game_over = False
        self.won = False
        return self.answer
    
    def make_guess(self, guess: str) -> List[Dict]:
        # Ini logika untuk terminal, tapi kita bisa pakai logic hitung warnanya saja
        guess = guess.lower().strip()
        feedback = self.calculate_feedback(guess, self.answer)
        
        self.attempts.append(feedback)
        if all(f["status"] == Status.GREEN.value for f in feedback):
            self.won = True
            self.game_over = True
        elif len(self.attempts) >= self.max_attempts:
            self.game_over = True
        return feedback
    
    # KITA JADIKAN STATIC METHOD AGAR BISA DIPAKAI APP.PY TANPA BIKIN OBJECT
    @staticmethod
    def calculate_feedback(guess: str, answer: str) -> List[Dict]:
        feedback = []
        # Gunakan list karakter agar bisa dimodifikasi
        answer_chars = list(answer)
        
        # 1. Inisialisasi (Semua Grey)
        for i, letter in enumerate(guess):
            feedback.append({
                "letter": letter.upper(),
                "status": Status.GREY.value,
                "position": i
            })
        
        # 2. Cek GREEN (Posisi Benar)
        for i, letter in enumerate(guess):
            if letter == answer[i]:
                feedback[i]["status"] = Status.GREEN.value
                answer_chars[i] = "*" # Ganti None jadi String "*"
        
        # 3. Cek YELLOW (Ada tapi salah posisi)
        for i, letter in enumerate(guess):
            if feedback[i]["status"] == Status.GREY.value:
                if letter in answer_chars:
                    feedback[i]["status"] = Status.YELLOW.value
                    # Tandai huruf ini sudah terpakai
                    answer_chars[answer_chars.index(letter)] = "*" 
                    
        return feedback

# ... (Bagian output_terminal dan main biarkan saja untuk test terminal)
    
    def get_state(self) -> Dict:
        return {
            "word_length": self.word_length,
            "max_attempts": self.max_attempts,
            "attempts_made": len(self.attempts),
            "attempts_left": self.max_attempts - len(self.attempts),
            "attempts": self.attempts,
            "game_over": self.game_over,
            "won": self.won,
            "answer": self.answer if self.game_over else None
        }
    
    def get_keyboard_state(self) -> Dict[str, str]:
        keyboard = {}
        priority = {Status.GREEN.value: 3, Status.YELLOW.value: 2, Status.GREY.value: 1}
        
        for attempt in self.attempts:
            for cell in attempt:
                letter = cell["letter"]
                status = cell["status"]
                
                # priority stat
                if letter not in keyboard or priority[status] > priority.get(keyboard[letter], 0):
                    keyboard[letter] = status
        
        return keyboard

def output_terminal(feedback: List[Dict], game: WordleGame) -> None:
    # background
    COLORS = {
        Status.GREEN.value: "\033[42m\033[30m",
        Status.YELLOW.value: "\033[43m\033[30m",
        Status.GREY.value: "\033[47m\033[30m",
    }
    RESET = "\033[0m"
    output = ""
    for cell in feedback:
        color = COLORS[cell["status"]]
        output += f"{color} {cell['letter']} {RESET}"
    
    print(output)
    print(f"Attempts: {len(game.attempts)}/{game.max_attempts}")
    
    if game.game_over:
        if game.won:
            print(f"\nCongratulations! You won in {len(game.attempts)} attempts!")
        else:
            print(f"\n:( Game Over! The word was: {game.answer.upper()}")

def output_web(game: WordleGame) -> Dict:
    return game.get_state()

def play_terminal(word_length: int = WORD_LENGTH):
    """Play Wordle in terminal mode."""
    print("=" * 50)
    print(f"       WORDLE GENERATOR ({word_length}-letter words)")
    print("=" * 50)
    
    game = WordleGame(word_length=word_length)
    print(f"Loaded {len(game.word_list)} words.")
    print(f"Guess the {word_length}-letter word in {game.max_attempts} attempts!\n")
    # print(f"[DEBUG] Answer: {game.answer}")
    
    while not game.game_over:
        attempt_num = len(game.attempts) + 1
        print(f"\nAttempt {attempt_num}/{game.max_attempts}")
        
        guess = input("Enter your guess: ").strip()
        
        try:
            feedback = game.make_guess(guess)
            output_terminal(feedback, game)
        except ValueError as e:
            print(f"Error: {e}")
            continue
    
    print("\nKeyboard State:")
    kb = game.get_keyboard_state()
    for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        status = kb.get(letter, "unused")
        symbol = {"green": "🟩", "yellow": "🟨", "grey": "⬜"}.get(status, "⬛")
        print(f"{symbol}{letter}", end=" ")
        if letter in "GJQZ":
            print()

if __name__ == "__main__":
    play_terminal(word_length=WORD_LENGTH)
