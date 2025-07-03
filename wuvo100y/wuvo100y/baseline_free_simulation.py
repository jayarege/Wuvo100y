# BASELINE-FREE SIMULATION: Home Screen vs Wildcard (No Emotion Baselines)
# Testing the new approach where first comparison is truly unknown vs known

import math

# Wildcard's exact adjustRating function
def wildcard_adjust_rating(winner_rating, loser_rating, winner_won, winner_games_played=0, loser_games_played=0):
    """Wildcard's exact ELO logic"""
    
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

# Home Screen's NEW Baseline-Free Unknown vs Known approach
def home_screen_baseline_free(opponents, results):
    """Home Screen's Unknown vs Known with NO emotion baselines"""
    
    # FIRST COMPARISON: Unknown vs Known (derive rating from comparison outcome)
    opponent_rating = opponents[0]
    new_movie_won = results[0]
    
    if new_movie_won:
        # If unknown movie won, it should be rated higher than opponent
        # Use simple heuristic: winner gets opponent rating + small bonus
        derived_rating = min(10, opponent_rating + 0.5)
    else:
        # If unknown movie lost, it should be rated lower than opponent  
        # Use simple heuristic: loser gets opponent rating - small penalty
        derived_rating = max(1, opponent_rating - 0.5)
    
    # Round to nearest 0.1
    current_rating = round(derived_rating * 10) / 10
    
    print(f"HOME Round 1 (Unknown vs Known): {current_rating}")
    
    # SUBSEQUENT COMPARISONS: Known vs Known using Wildcard logic
    for i in range(1, len(opponents)):
        opponent_rating = opponents[i]
        new_movie_won = results[i]
        
        if new_movie_won:
            new_winner_rating, new_loser_rating = wildcard_adjust_rating(
                current_rating,    # New movie rating
                opponent_rating,   # Opponent rating
                True,             # New movie won
                i,                # New movie now has i games played
                5                 # Opponent has experience
            )
            current_rating = new_winner_rating
        else:
            new_winner_rating, new_loser_rating = wildcard_adjust_rating(
                opponent_rating,   # Opponent won
                current_rating,    # New movie rating
                True,             # Opponent won
                5,                # Opponent has experience
                i                 # New movie now has i games played
            )
            current_rating = new_loser_rating
        
        print(f"HOME Round {i+1} (Known vs Known): {current_rating}")
    
    return current_rating

# Original Wildcard simulation (still uses emotion baselines for comparison)
def wildcard_simulation_with_baseline(emotion, opponents, results):
    """Simulate how Wildcard would handle with emotion baselines (for comparison)"""
    emotion_baselines = {
        'LOVED': 8.5,
        'LIKED': 7.0,
        'AVERAGE': 5.5,
        'DISLIKED': 3.0
    }
    current_rating = emotion_baselines.get(emotion, 7.0)
    
    for i, (opponent_rating, new_movie_won) in enumerate(zip(opponents, results)):
        if new_movie_won:
            new_winner_rating, new_loser_rating = wildcard_adjust_rating(
                current_rating,    # New movie rating
                opponent_rating,   # Opponent rating
                True,             # New movie won
                i,                # New movie games played
                5                 # Opponent has experience
            )
            current_rating = new_winner_rating
        else:
            new_winner_rating, new_loser_rating = wildcard_adjust_rating(
                opponent_rating,   # Opponent won
                current_rating,    # New movie rating
                True,             # Opponent won
                5,                # Opponent has experience
                i                 # New movie games played
            )
            current_rating = new_loser_rating
        
        print(f"WILDCARD Round {i+1}: {current_rating}")
    
    return current_rating

# Test scenarios comparing baseline vs baseline-free approaches
test_scenarios = [
    {
        'name': 'LOVED Movie (High Expectations)',
        'emotion': 'LOVED',
        'opponents': [8.0, 7.5, 9.0],  # High-quality opponents
        'results': [True, False, True],
        'description': 'LOVED movie vs high-quality opponents'
    },
    {
        'name': 'DISLIKED Movie (Low Expectations)', 
        'emotion': 'DISLIKED',
        'opponents': [3.0, 4.0, 2.5],  # Low-quality opponents
        'results': [True, False, True],
        'description': 'DISLIKED movie vs low-quality opponents'
    },
    {
        'name': 'LIKED Movie (Medium Expectations)',
        'emotion': 'LIKED', 
        'opponents': [6.0, 7.0, 6.5],  # Medium-quality opponents
        'results': [False, True, False],
        'description': 'LIKED movie vs medium-quality opponents'
    },
    {
        'name': 'AVERAGE Movie (Mixed Expectations)',
        'emotion': 'AVERAGE',
        'opponents': [5.0, 6.0, 4.5],  # Mixed-quality opponents  
        'results': [True, True, False],
        'description': 'AVERAGE movie vs mixed-quality opponents'
    }
]

print("🎬 BASELINE-FREE SIMULATION")
print("=" * 60)
print("Comparing emotion baseline approach vs baseline-free approach")
print("=" * 60)

for i, scenario in enumerate(test_scenarios, 1):
    print(f"\n🎭 TEST {i}: {scenario['name']}")
    print(f"Description: {scenario['description']}")
    print(f"Emotion: {scenario['emotion']}")
    print(f"Opponents: {scenario['opponents']}")
    print(f"Results: {['WIN' if r else 'LOSS' for r in scenario['results']]}")
    print()
    
    # Run Wildcard with emotion baseline (old approach)
    print("WILDCARD (WITH emotion baseline):")
    wildcard_baseline = wildcard_simulation_with_baseline(
        scenario['emotion'], 
        scenario['opponents'], 
        scenario['results']
    )
    
    print("\nHOME SCREEN (NO emotion baseline):")
    home_baseline_free = home_screen_baseline_free(
        scenario['opponents'], 
        scenario['results']
    )
    
    difference = abs(wildcard_baseline - home_baseline_free)
    print(f"\n📊 COMPARISON:")
    print(f"   Wildcard (with baseline): {wildcard_baseline}")
    print(f"   Home Screen (baseline-free): {home_baseline_free}")
    print(f"   Difference: {difference:.1f}")
    
    # Analysis
    if difference < 1.0:
        print("   ✅ Results are reasonably close")
    elif difference < 2.0:
        print("   ⚠️  Moderate difference - expected due to baseline removal")
    else:
        print("   🚨 Large difference - may need adjustment")
    
    print("-" * 60)

print("\n🎯 ANALYSIS:")
print("The baseline-free approach will naturally produce different results")
print("because it derives ratings purely from comparison outcomes,")
print("while the baseline approach starts with predetermined emotion ratings.")
print("\nThis is the intended behavior - no more emotion bias!")
print("The first comparison outcome now determines the initial rating.")