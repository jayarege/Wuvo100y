# HOME SCREEN vs WILDCARD COMPARISON
# Detailed side-by-side comparison of both rating systems

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
        print(f"  🚨 MAJOR UPSET! Winner ({winner_rating}) defeated Loser ({loser_rating}). +3.0 bonus!")
    
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

# HOME SCREEN: Baseline-Free Unknown vs Known approach
def home_screen_system(opponents, results):
    """Current Home Screen implementation (baseline-free)"""
    
    print("  🏠 HOME SCREEN SYSTEM:")
    
    # FIRST COMPARISON: Unknown vs Known (derive rating from comparison outcome)
    opponent_rating = opponents[0]
    new_movie_won = results[0]
    
    if new_movie_won:
        # If unknown movie won, it should be rated higher than opponent
        derived_rating = min(10, opponent_rating + 0.5)
        print(f"    Round 1: Unknown movie WON vs {opponent_rating} → Initial rating: {derived_rating}")
    else:
        # If unknown movie lost, it should be rated lower than opponent  
        derived_rating = max(1, opponent_rating - 0.5)
        print(f"    Round 1: Unknown movie LOST vs {opponent_rating} → Initial rating: {derived_rating}")
    
    # Round to nearest 0.1
    current_rating = round(derived_rating * 10) / 10
    
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
            print(f"    Round {i+1}: Movie ({current_rating - (new_winner_rating - current_rating):.1f}) WON vs {opponent_rating} → {current_rating}")
        else:
            new_winner_rating, new_loser_rating = wildcard_adjust_rating(
                opponent_rating,   # Opponent won
                current_rating,    # New movie rating
                True,             # Opponent won
                5,                # Opponent has experience
                i                 # New movie now has i games played
            )
            old_rating = current_rating
            current_rating = new_loser_rating
            print(f"    Round {i+1}: Movie ({old_rating}) LOST vs {opponent_rating} → {current_rating}")
    
    print(f"  🏠 HOME FINAL RATING: {current_rating}")
    return current_rating

# WILDCARD SYSTEM: With emotion baselines (original Wildcard behavior)
def wildcard_system(emotion, opponents, results):
    """Original Wildcard system with emotion baselines"""
    
    print("  🃏 WILDCARD SYSTEM:")
    
    emotion_baselines = {
        'LOVED': 8.5,
        'LIKED': 7.0,
        'AVERAGE': 5.5,
        'DISLIKED': 3.0
    }
    current_rating = emotion_baselines.get(emotion, 7.0)
    print(f"    Starting with {emotion} baseline: {current_rating}")
    
    for i, (opponent_rating, new_movie_won) in enumerate(zip(opponents, results)):
        if new_movie_won:
            new_winner_rating, new_loser_rating = wildcard_adjust_rating(
                current_rating,    # New movie rating
                opponent_rating,   # Opponent rating
                True,             # New movie won
                i,                # New movie games played
                5                 # Opponent has experience
            )
            old_rating = current_rating
            current_rating = new_winner_rating
            print(f"    Round {i+1}: Movie ({old_rating}) WON vs {opponent_rating} → {current_rating}")
        else:
            new_winner_rating, new_loser_rating = wildcard_adjust_rating(
                opponent_rating,   # Opponent won
                current_rating,    # New movie rating
                True,             # Opponent won
                5,                # Opponent has experience
                i                 # New movie games played
            )
            old_rating = current_rating
            current_rating = new_loser_rating
            print(f"    Round {i+1}: Movie ({old_rating}) LOST vs {opponent_rating} → {current_rating}")
    
    print(f"  🃏 WILDCARD FINAL RATING: {current_rating}")
    return current_rating

# Test scenarios
test_scenarios = [
    {
        'name': 'Movie A: The Great Victory',
        'emotion': 'LOVED',
        'opponents': [6.0, 7.0, 8.0],
        'results': [True, True, True],
        'description': 'Wins all battles vs progressively stronger opponents'
    },
    {
        'name': 'Movie B: The Upset Champion',
        'emotion': 'DISLIKED',
        'opponents': [8.5, 9.0, 9.5],
        'results': [True, True, True],
        'description': 'Massive upsets - terrible movie beats great ones'
    },
    {
        'name': 'Movie C: The Roller Coaster',
        'emotion': 'LIKED',
        'opponents': [5.0, 8.5, 6.0],
        'results': [True, False, True],
        'description': 'Mixed results with varying opponent strength'
    },
    {
        'name': 'Movie D: The Disappointment',
        'emotion': 'AVERAGE',
        'opponents': [8.0, 8.5, 9.0],
        'results': [False, False, False],
        'description': 'Loses all battles vs superior opponents'
    },
    {
        'name': 'Movie E: The Close Call',
        'emotion': 'LIKED',
        'opponents': [7.2, 6.8, 7.1],
        'results': [False, True, False],
        'description': 'Very close ratings with narrow wins/losses'
    }
]

print("🎬🆚🃏 HOME SCREEN vs WILDCARD SYSTEM COMPARISON")
print("=" * 80)
print("Detailed side-by-side rating calculations")
print("=" * 80)

for i, scenario in enumerate(test_scenarios, 1):
    print(f"\n🎭 TEST {i}: {scenario['name']}")
    print(f"📝 Description: {scenario['description']}")
    print(f"😀 Emotion: {scenario['emotion']}")
    print(f"🥊 Opponents: {scenario['opponents']}")
    print(f"⚔️  Battle Results: {['WIN' if r else 'LOSS' for r in scenario['results']]}")
    print()
    
    # Run both systems
    home_result = home_screen_system(scenario['opponents'], scenario['results'])
    print()
    wildcard_result = wildcard_system(scenario['emotion'], scenario['opponents'], scenario['results'])
    
    # Comparison
    difference = abs(home_result - wildcard_result)
    print(f"\n📊 COMPARISON:")
    print(f"   🏠 Home Screen (baseline-free): {home_result:.1f}")
    print(f"   🃏 Wildcard (with baseline):    {wildcard_result:.1f}")
    print(f"   📏 Difference:                  {difference:.1f}")
    
    if difference == 0.0:
        print("   ✅ IDENTICAL RESULTS!")
    elif difference <= 0.5:
        print("   ✅ VERY CLOSE - Minor difference")
    elif difference <= 1.0:
        print("   ⚠️  MODERATE - Expected due to different starting approaches")
    elif difference <= 2.0:
        print("   ⚠️  NOTICEABLE - Different philosophies showing")
    else:
        print("   🚨 LARGE DIFFERENCE - Significantly different outcomes")
    
    # Determine which system rated higher
    if home_result > wildcard_result:
        print(f"   📈 Home Screen rated {difference:.1f} points HIGHER")
    elif wildcard_result > home_result:
        print(f"   📈 Wildcard rated {difference:.1f} points HIGHER") 
    
    print("=" * 80)

print("\n🎯 SYSTEM ANALYSIS:")
print("🏠 HOME SCREEN (Baseline-Free):")
print("   • First rating derived purely from comparison outcome")
print("   • No emotion bias in starting rating")
print("   • Subsequent rounds use Wildcard ELO logic")
print("   • More 'fair' as rating based on actual performance")

print("\n🃏 WILDCARD (With Baselines):")
print("   • Starts with predetermined emotion rating")
print("   • LOVED movies start at 8.5, DISLIKED at 3.0")
print("   • All rounds use same ELO logic")
print("   • Emotion influences final rating significantly")

print("\n💡 KEY INSIGHT:")
print("Home Screen removes emotion bias - ratings are now purely performance-based!")
print("The difference in results shows how much emotion baselines influenced ratings.")