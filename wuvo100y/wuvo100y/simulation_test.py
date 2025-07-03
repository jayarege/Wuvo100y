# SIMULATION: Wildcard vs Home Screen Logic
# Let's simulate the exact same scenario in both systems

# Wildcard's adjustRating function (simplified for testing)
def wildcard_adjust_rating(winner_rating, loser_rating, winner_won, winner_games_played=0, loser_games_played=0):
    """Wildcard's exact ELO logic"""
    import math
    
    # Calculate K-factor (Wildcard's logic)
    def calculate_k_factor(games_played):
        if games_played < 5:
            return 0.5
        elif games_played < 10:
            return 0.25
        elif games_played < 20:
            return 0.125
        return 0.1
    
    rating_difference = abs(winner_rating - loser_rating)
    expected_win_probability = 1 / (1 + math.pow(10, (loser_rating - winner_rating) / 4))
    
    winner_k = calculate_k_factor(winner_games_played)
    loser_k = calculate_k_factor(loser_games_played)
    
    winner_increase = max(0.1, winner_k * (1 - expected_win_probability))
    loser_decrease = max(0.1, loser_k * (1 - expected_win_probability))
    
    # Underdog bonus
    if winner_rating < loser_rating:
        winner_increase *= 1.2
    
    # Major upset bonus
    is_major_upset = winner_rating < loser_rating and rating_difference > 3.0
    if is_major_upset:
        winner_increase += 3.0
        print(f"🚨 MAJOR UPSET! Winner ({winner_rating}) defeated Loser ({loser_rating}). +3.0 bonus!")
    
    # Apply limits
    MAX_RATING_CHANGE = 0.7
    if not is_major_upset:
        winner_increase = min(MAX_RATING_CHANGE, winner_increase)
        loser_decrease = min(MAX_RATING_CHANGE, loser_decrease)
    
    new_winner_rating = winner_rating + winner_increase
    new_loser_rating = loser_rating - loser_decrease
    
    # Bounds enforcement
    new_winner_rating = round(min(10, max(1, new_winner_rating)) * 10) / 10
    new_loser_rating = round(min(10, max(1, new_loser_rating)) * 10) / 10
    
    return new_winner_rating, new_loser_rating

# Home Screen's logic - Unknown vs Known approach
def home_screen_unknown_vs_known(emotion, opponents, results):
    """Home Screen's Unknown vs Known then Known vs Known approach"""
    import math
    
    # FIRST COMPARISON: Unknown vs Known
    # For unknown movie, we need to establish initial rating through comparison
    opponent_rating = opponents[0]
    new_movie_won = results[0]
    
    # Use emotion as a baseline for the unknown movie in the comparison
    emotion_baselines = {
        'LOVED': 8.5,
        'LIKED': 7.0,
        'AVERAGE': 5.5,
        'DISLIKED': 3.0
    }
    emotion_baseline = emotion_baselines.get(emotion, 7.0)
    
    # For unknown vs known, we estimate what the rating should be after comparison
    # This is like reverse-engineering from the comparison result
    if new_movie_won:
        # If unknown movie won, it should be rated higher than opponent
        # Use Wildcard logic to determine the new rating
        new_winner_rating, new_loser_rating = wildcard_adjust_rating(
            emotion_baseline,  # Unknown movie starts with emotion baseline
            opponent_rating,   # Known opponent rating
            True,             # Unknown movie won
            0,                # Unknown movie has 0 games
            5                 # Known opponent has experience
        )
        current_rating = new_winner_rating
    else:
        # If unknown movie lost, it should be rated lower than opponent
        new_winner_rating, new_loser_rating = wildcard_adjust_rating(
            opponent_rating,   # Known opponent won
            emotion_baseline,  # Unknown movie starts with emotion baseline
            True,             # Known opponent won
            5,                # Known opponent has experience
            0                 # Unknown movie has 0 games
        )
        current_rating = new_loser_rating
    
    print(f"Home Screen Round 1 (Unknown vs Known): {current_rating}")
    
    # SUBSEQUENT COMPARISONS: Known vs Known
    for i in range(1, len(opponents)):
        opponent_rating = opponents[i]
        new_movie_won = results[i]
        
        # Now it's known vs known comparison
        new_winner_rating, new_loser_rating = wildcard_adjust_rating(
            current_rating if new_movie_won else opponent_rating,
            opponent_rating if new_movie_won else current_rating,
            True,
            i,  # New movie now has i games played
            5   # Opponent has experience
        )
        
        current_rating = new_winner_rating if new_movie_won else new_loser_rating
        print(f"Home Screen Round {i+1} (Known vs Known): {current_rating}")
    
    return current_rating

print("=== SIMULATION TEST CASES ===")
print()

# TEST CASE 1: "LIKED" movie vs [10.0, 10.0, 10.0], loses all
print("TEST 1: 'LIKED' movie vs [10.0, 10.0, 10.0], loses all")
print("WILDCARD APPROACH:")
wildcard_rating = 7.0  # LIKED emotion baseline
for i, opponent in enumerate([10.0, 10.0, 10.0]):
    new_winner_rating, new_loser_rating = wildcard_adjust_rating(opponent, wildcard_rating, True, 5, i)
    wildcard_rating = new_loser_rating  # New movie lost
    print(f"Wildcard Round {i+1}: {wildcard_rating}")

print("\nHOME SCREEN APPROACH (Unknown vs Known):")
home_rating = home_screen_unknown_vs_known('LIKED', [10.0, 10.0, 10.0], [False, False, False])

print(f"\nRESULT: Wildcard={wildcard_rating}, Home={home_rating}, Difference={abs(wildcard_rating - home_rating):.1f}")
print()

# TEST CASE 2: "DISLIKED" movie vs [8.0, 8.5, 9.0], wins all (major upsets)
print("TEST 2: 'DISLIKED' movie vs [8.0, 8.5, 9.0], wins all (major upsets)")
print("WILDCARD APPROACH:")
wildcard_rating = 3.0  # DISLIKED emotion baseline
for i, opponent in enumerate([8.0, 8.5, 9.0]):
    new_winner_rating, new_loser_rating = wildcard_adjust_rating(wildcard_rating, opponent, True, i, 5)
    wildcard_rating = new_winner_rating  # New movie won
    print(f"Wildcard Round {i+1}: {wildcard_rating}")

print("\nHOME SCREEN APPROACH (Unknown vs Known):")
home_rating = home_screen_unknown_vs_known('DISLIKED', [8.0, 8.5, 9.0], [True, True, True])

print(f"\nRESULT: Wildcard={wildcard_rating}, Home={home_rating}, Difference={abs(wildcard_rating - home_rating):.1f}")
print()

# TEST CASE 3: "LOVED" movie vs [3.0, 4.0, 5.0], mixed results
print("TEST 3: 'LOVED' movie vs [3.0, 4.0, 5.0], mixed results (Win, Lose, Win)")
print("WILDCARD APPROACH:")
wildcard_rating = 8.5  # LOVED emotion baseline
results = [True, False, True]  # Win, Lose, Win
for i, (opponent, result) in enumerate(zip([3.0, 4.0, 5.0], results)):
    if result:  # New movie won
        new_winner_rating, new_loser_rating = wildcard_adjust_rating(wildcard_rating, opponent, True, i, 5)
        wildcard_rating = new_winner_rating
    else:  # New movie lost
        new_winner_rating, new_loser_rating = wildcard_adjust_rating(opponent, wildcard_rating, True, 5, i)
        wildcard_rating = new_loser_rating
    print(f"Wildcard Round {i+1}: {wildcard_rating}")

print("\nHOME SCREEN APPROACH (Unknown vs Known):")
home_rating = home_screen_unknown_vs_known('LOVED', [3.0, 4.0, 5.0], [True, False, True])

print(f"\nRESULT: Wildcard={wildcard_rating}, Home={home_rating}, Difference={abs(wildcard_rating - home_rating):.1f}")
print()

print("=== ANALYSIS ===")
print("The systems are fundamentally different:")
print("1. Wildcard: Pairwise comparisons with existing ratings")
print("2. Home: Sequential evolution starting from 7.0")
print("3. Different K-factor calculations")
print("4. Different starting points for new movies")