import os
import random
from typing import List, Dict, Optional
from enum import Enum

# config
WORD_LENGTH = 5 
MAX_ATTEMPTS = 6

class Status(Enum):
    GREEN = "green"    # pos true
    YELLOW = "yellow"  # pos false
    GREY = "grey"      # exist false

class OutputMode(Enum):
    TERMINAL = "terminal"
    WEB = "web"

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
        """Load words from the appropriate dataset based on word length."""
        script_dir = os.path.dirname(os.path.abspath(__file__))
        word_file = os.path.join(script_dir, f"../../library/english/{self.word_length}.txt")
        
        try:
            with open(word_file, 'r', encoding='utf-8') as f:
                words = [line.strip().lower() for line in f if line.strip()]
            return [w for w in words if len(w) == self.word_length]
        except FileNotFoundError:
            raise FileNotFoundError(f"Word list not found: {word_file}")
    
    def new_game(self) -> str:
        """Start a new game with a random word."""
        self.answer = random.choice(self.word_list)
        self.attempts = []
        self.game_over = False
        self.won = False
        return self.answer
    
    def make_guess(self, guess: str) -> List[Dict]:
        guess = guess.lower().strip()
        
        # validation
        if len(guess) != self.word_length:
            raise ValueError(f"Guess must be {self.word_length} letters")
        if not guess.isalpha():
            raise ValueError("Guess must contain only letters")
        if self.game_over:
            raise ValueError("Game is already over")
        # if guess not in self.word_list:
        #     raise ValueError("Word not in dictionary")
        
        # feedback ans
        feedback = self._calculate_feedback(guess)
        self.attempts.append(feedback)
        if all(f["status"] == Status.GREEN.value for f in feedback):
            self.won = True
            self.game_over = True
        elif len(self.attempts) >= self.max_attempts:
            self.game_over = True
        
        return feedback
    
    def _calculate_feedback(self, guess: str) -> List[Dict]:
        feedback = []
        answer_chars = list(self.answer)
        
        for i, letter in enumerate(guess):
            feedback.append({
                "letter": letter.upper(),
                "status": Status.GREY.value,
                "position": i
            })
        
        for i, letter in enumerate(guess):
            if letter == self.answer[i]:
                feedback[i]["status"] = Status.GREEN.value
                answer_chars[i] = None
        
        for i, letter in enumerate(guess):
            if feedback[i]["status"] == Status.GREY.value:
                if letter in answer_chars:
                    feedback[i]["status"] = Status.YELLOW.value
                    answer_chars[answer_chars.index(letter)] = None
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
