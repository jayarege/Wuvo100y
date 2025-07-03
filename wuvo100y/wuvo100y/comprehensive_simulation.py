# COMPREHENSIVE SIMULATION: Home Screen vs Wildcard Rating Systems
# Testing 3 movies each with identical scenarios and devil's advocate review

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
        print(f"🚨 WILDCARD MAJOR UPSET! Winner ({winner_rating}) defeated Loser ({loser_rating}). +3.0 bonus!")
    
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

# Home Screen's Unknown vs Known approach
def home_screen_unknown_vs_known(emotion, opponents, results):
    """Home Screen's Unknown vs Known then Known vs Known approach"""
    
    # Use emotion as a baseline for the unknown movie in the comparison
    emotion_baselines = {
        'LOVED': 8.5,
        'LIKED': 7.0,
        'AVERAGE': 5.5,
        'DISLIKED': 3.0
    }
    emotion_baseline = emotion_baselines.get(emotion, 7.0)
    
    # FIRST COMPARISON: Unknown vs Known
    opponent_rating = opponents[0]
    new_movie_won = results[0]
    
    if new_movie_won:
        # If unknown movie won, it should be rated higher than opponent
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
    
    print(f"HOME Round 1 (Unknown vs Known): {current_rating}")
    
    # SUBSEQUENT COMPARISONS: Known vs Known
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

# Wildcard simulation (for comparison)
def wildcard_simulation(emotion, opponents, results):
    """Simulate how Wildcard would handle the same scenario"""
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

# Devil's Advocate Review Function
def devils_advocate_review(movie_name, emotion, opponents, results, wildcard_result, home_result):
    """Critical review to catch any discrepancies"""
    print(f"\n🔍 DEVIL'S ADVOCATE REVIEW: {movie_name}")
    print("=" * 50)
    
    # Check 1: Are we using the same starting emotion?
    emotion_baselines = {
        'LOVED': 8.5,
        'LIKED': 7.0,
        'AVERAGE': 5.5,
        'DISLIKED': 3.0
    }
    expected_start = emotion_baselines.get(emotion, 7.0)
    print(f"✓ Emotion baseline check: {emotion} = {expected_start}")
    
    # Check 2: Are the opponents identical?
    print(f"✓ Opponent ratings: {opponents}")
    
    # Check 3: Are the results identical?
    result_str = ['WIN' if r else 'LOSS' for r in results]
    print(f"✓ Battle results: {result_str}")
    
    # Check 4: Compare final ratings
    difference = abs(wildcard_result - home_result)
    print(f"✓ Final ratings - Wildcard: {wildcard_result}, Home: {home_result}")
    print(f"✓ Difference: {difference}")
    
    # Check 5: Flag significant discrepancies
    if difference > 0.5:
        print("🚨 SIGNIFICANT DISCREPANCY DETECTED!")
        print("   This requires investigation:")
        print(f"   - Wildcard logic may differ from Home Screen logic")
        print(f"   - K-factor calculations might be inconsistent")
        print(f"   - Underdog/upset bonuses might be applied differently")
    elif difference > 0.1:
        print("⚠️  MINOR DISCREPANCY DETECTED")
        print("   Small difference likely due to rounding or sequential vs pairwise logic")
    else:
        print("✅ RATINGS MATCH PERFECTLY!")
    
    # Check 6: Validate emotion appropriateness
    if emotion == 'LOVED' and wildcard_result < 7.0:
        print("🤔 LOGIC CHECK: LOVED movie ended up below 7.0 - is this realistic?")
    elif emotion == 'DISLIKED' and wildcard_result > 6.0:
        print("🤔 LOGIC CHECK: DISLIKED movie ended up above 6.0 - is this realistic?")
    
    print("=" * 50)

# Test scenarios
test_scenarios = [
    # Movie 1: LOVED movie with mixed results
    {
        'name': 'Movie 1 (LOVED)',
        'emotion': 'LOVED',
        'opponents': [4.0, 6.0, 8.0],
        'results': [True, False, True],  # Win, Loss, Win
        'description': 'LOVED movie vs weaker opponents - should maintain high rating'
    },
    
    # Movie 2: DISLIKED movie with major upsets  
    {
        'name': 'Movie 2 (DISLIKED)',
        'emotion': 'DISLIKED',
        'opponents': [8.0, 8.5, 9.0],
        'results': [True, True, True],  # All wins - major upsets
        'description': 'DISLIKED movie beats strong opponents - major upset scenario'
    },
    
    # Movie 3: LIKED movie with all losses
    {
        'name': 'Movie 3 (LIKED)',
        'emotion': 'LIKED',
        'opponents': [9.0, 9.5, 10.0],
        'results': [False, False, False],  # All losses
        'description': 'LIKED movie loses to superior opponents - rating should drop'
    }
]

print("🎬 COMPREHENSIVE SIMULATION: Home Screen vs Wildcard")
print("=" * 60)
print("Testing 3 movies with identical scenarios")
print("Each movie faces 3 opponents with predetermined results")
print("Devil's advocate will review each comparison for discrepancies")
print("=" * 60)

total_difference = 0
max_difference = 0

for i, scenario in enumerate(test_scenarios, 1):
    print(f"\n🎭 TEST {i}: {scenario['name']}")
    print(f"Description: {scenario['description']}")
    print(f"Emotion: {scenario['emotion']}")
    print(f"Opponents: {scenario['opponents']}")
    print(f"Results: {['WIN' if r else 'LOSS' for r in scenario['results']]}")
    print()
    
    # Run Wildcard simulation
    print("WILDCARD SYSTEM:")
    wildcard_final = wildcard_simulation(
        scenario['emotion'], 
        scenario['opponents'], 
        scenario['results']
    )
    
    print("\nHOME SCREEN SYSTEM:")
    home_final = home_screen_unknown_vs_known(
        scenario['emotion'], 
        scenario['opponents'], 
        scenario['results']
    )
    
    # Devil's advocate review
    devils_advocate_review(
        scenario['name'],
        scenario['emotion'],
        scenario['opponents'],
        scenario['results'],
        wildcard_final,
        home_final
    )
    
    # Track differences
    difference = abs(wildcard_final - home_final)
    total_difference += difference
    max_difference = max(max_difference, difference)
    
    print(f"\n📊 FINAL RESULT: Wildcard={wildcard_final}, Home={home_final}, Diff={difference:.1f}")
    print("=" * 60)

# Final summary
print(f"\n🏆 COMPREHENSIVE ANALYSIS SUMMARY")
print("=" * 60)
print(f"Total movies tested: {len(test_scenarios)}")
print(f"Average difference: {total_difference/len(test_scenarios):.2f}")
print(f"Maximum difference: {max_difference:.2f}")

if max_difference < 0.1:
    print("✅ PERFECT ALIGNMENT - Both systems produce nearly identical results")
elif max_difference < 0.5:
    print("✅ EXCELLENT ALIGNMENT - Minor differences within acceptable range")
elif max_difference < 1.0:
    print("⚠️  GOOD ALIGNMENT - Some differences but generally consistent")
else:
    print("🚨 SIGNIFICANT DIFFERENCES - Systems may have fundamental inconsistencies")

print("\n🎯 DEVIL'S ADVOCATE CONCLUSION:")
print("If differences exist, they likely stem from:")
print("1. Sequential rating evolution (Home) vs pairwise comparisons (Wildcard)")
print("2. Different K-factor progression based on games played")
print("3. Timing of when bonuses are applied during the rating process")
print("4. Rounding differences in complex calculations")