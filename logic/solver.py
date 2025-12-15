import math
from collections import Counter

class WordleCSP:
    def __init__(self, word_list):
        self.domain = [w.lower() for w in word_list]
        self.guesses_made = []

    def add_constraint(self, guess, feedback):
        """
        'G' = Green (Correct pos)
        'Y' = Yellow (Wrong pos)
        'X' = Gray (Not in word)
        """
        guess = guess.lower()
        self.guesses_made.append((guess, feedback))
        
        new_domain = []
        for word in self.domain:
            if self.is_consistent(word, guess, feedback):
                new_domain.append(word)
        
        self.domain = new_domain
        print(f"Domain reduced to {len(self.domain)} words.")

    def is_consistent(self, candidate, guess, feedback):

        for i, (g_char, f_char) in enumerate(zip(guess, feedback)):
            if f_char == 'G':
                if candidate[i] != g_char:
                    return False

        for i, (g_char, f_char) in enumerate(zip(guess, feedback)):
            
            if f_char == 'Y':
                if g_char not in candidate:
                    return False
                if candidate[i] == g_char:
                    return False
            
            elif f_char == 'X':
                needed_count = 0
                for j, (g2, f2) in enumerate(zip(guess, feedback)):
                    if g2 == g_char and f2 in ('G', 'Y'):
                        needed_count += 1
                
                if candidate.count(g_char) > needed_count:
                    return False
                
                if needed_count == 0 and g_char in candidate:
                    return False

        return True

    def get_feedback_pattern(self, guess, answer):
        # Simulates wordle feedback
        length = len(guess)
        feedback = ['X'] * length
        answer_chars = list(answer)
        
        # Green pass
        for i in range(length):
            if guess[i] == answer[i]:
                feedback[i] = 'G'
                answer_chars[i] = None
        
        # Yellow pass
        for i in range(length):
            if feedback[i] == 'X' and guess[i] in answer_chars:
                feedback[i] = 'Y'
                answer_chars[answer_chars.index(guess[i])] = None
        
        return ''.join(feedback)

    def calc_entropy(self, guess):
        # Count feedback pattern distribution
        pattern_counts = Counter()
        
        for possible_answer in self.domain:
            pattern = self.get_feedback_pattern(guess, possible_answer)
            pattern_counts[pattern] += 1
        
        # Shannon entropy: H = -Σ p(x) * log2(p(x))
        total = len(self.domain)
        entropy = 0.0
        
        for count in pattern_counts.values():
            prob = count / total
            entropy -= prob * math.log2(prob)
        
        return entropy

    def get_next_guess(self):
        if not self.domain:
            return None
        
        if len(self.domain) <= 2:
            return self.domain[0]
        
        # Find word with max entropy
        best_word = None
        best_entropy = -1
        
        # Limit candidates for performance
        candidates = self.domain[:100] if len(self.domain) > 100 else self.domain
        
        for word in candidates:
            entropy = self.calc_entropy(word)
            if entropy > best_entropy:
                best_entropy = entropy
                best_word = word
        
        print(f"Best entropy: {best_entropy:.3f} bits")
        return best_word
