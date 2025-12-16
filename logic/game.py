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
    # PERBAIKAN 1: Tambahkan parameter language='english' di sini
    def __init__(self, word_length: int = WORD_LENGTH, max_attempts: int = MAX_ATTEMPTS, language: str = 'english'):
        self.word_length = word_length
        self.max_attempts = max_attempts
        
        # PERBAIKAN 2: Set language DULUAN sebelum load_words
        self.language = language 
        
        self.word_list = self._load_words()
        self.answer: str = ""
        self.attempts: List[List[Dict]] = []
        self.game_over: bool = False
        self.won: bool = False
        self.new_game()
    
    def _load_words(self) -> List[str]:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        # --- UBAH DI SINI ---
        # Mengarahkan ke file _clean_popular.txt
        word_file = os.path.join(base_dir, "library", self.language, f"{self.word_length}_clean_popular.txt")
        # --------------------

        # Fallback logic jika popular tidak ada (opsional, tapi disarankan)
        if not os.path.exists(word_file):
             print(f"[WARN] File populer tidak ada, menggunakan full dictionary.")
             word_file = os.path.join(base_dir, "library", self.language, f"{self.word_length}.txt")

        try:
            with open(word_file, 'r', encoding='utf-8') as f:
                words = [line.strip().lower() for line in f if line.strip()]
            return [w for w in words if len(w) == self.word_length]
        except FileNotFoundError:
            print(f"[ERROR] File tidak ditemukan di: {word_file}")
            return []

    def new_game(self) -> str:
        if not self.word_list:
            self.answer = "error" 
        else:
            self.answer = random.choice(self.word_list)
        
        self.attempts = []
        self.game_over = False
        self.won = False
        return self.answer
    
    def make_guess(self, guess: str) -> List[Dict]:
        guess = guess.lower().strip()
    
        if len(guess) != self.word_length:
            raise ValueError(f"Word must be {self.word_length} letters long")

        if guess not in self.word_list:
            raise ValueError("Not in word list")
        
        feedback = self.calculate_feedback(guess, self.answer)
    
        self.attempts.append(feedback)
        if all(f["status"] == Status.GREEN.value for f in feedback):
            self.won = True
            self.game_over = True
        elif len(self.attempts) >= self.max_attempts:
            self.game_over = True
        return feedback
    
    @staticmethod
    def calculate_feedback(guess: str, answer: str) -> List[Dict]:
        feedback = []
        answer_chars = list(answer)
        
        for i, letter in enumerate(guess):
            feedback.append({
                "letter": letter.upper(),
                "status": Status.GREY.value,
                "position": i
            })
        
        for i, letter in enumerate(guess):
            if letter == answer[i]:
                feedback[i]["status"] = Status.GREEN.value
                answer_chars[i] = "*" 
        
        for i, letter in enumerate(guess):
            if feedback[i]["status"] == Status.GREY.value:
                if letter in answer_chars:
                    feedback[i]["status"] = Status.YELLOW.value
                    answer_chars[answer_chars.index(letter)] = "*" 
                    
        return feedback
    
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
                if letter not in keyboard or priority[status] > priority.get(keyboard[letter], 0):
                    keyboard[letter] = status
        return keyboard

# Fungsi terminal juga perlu diupdate sedikit jika ingin support bahasa
def play_terminal(word_length: int = WORD_LENGTH):
    print("=" * 50)
    print(f"       WORDLE TERMINAL ({word_length}-letter words)")
    print("=" * 50)
    
    # Default ke english untuk terminal play
    game = WordleGame(word_length=word_length, language='english')
    
    print(f"Loaded {len(game.word_list)} words from English dictionary.")
    
    while not game.game_over:
        print(f"\nAttempt {len(game.attempts) + 1}/{game.max_attempts}")
        guess = input("Enter your guess: ").strip()
        
        try:
            feedback = game.make_guess(guess)
            # Helper output_terminal dipindah atau dicopy jika perlu
            # Disini saya singkat biar fokus ke perbaikan Class
            for f in feedback: print(f"{f['letter']}({f['status']})", end=" ")
            print()
        except ValueError as e:
            print(f"Error: {e}")
            continue

if __name__ == "__main__":
    play_terminal(word_length=WORD_LENGTH)