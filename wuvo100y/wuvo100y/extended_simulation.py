# EXTENDED SIMULATION: Home Screen vs Wildcard Round 2
# Testing edge cases and extreme scenarios

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
def home_screen_system(opponents, results, show_details=True):
    """Current Home Screen implementation (baseline-free)"""
    
    if show_details:
        print("  🏠 HOME SCREEN:")
    
    # FIRST COMPARISON: Unknown vs Known
    opponent_rating = opponents[0]
    new_movie_won = results[0]
    
    if new_movie_won:
        derived_rating = min(10, opponent_rating + 0.5)
    else:
        derived_rating = max(1, opponent_rating - 0.5)
    
    current_rating = round(derived_rating * 10) / 10
    
    if show_details:
        print(f"    R1: {'WIN' if new_movie_won else 'LOSS'} vs {opponent_rating} → {current_rating}")
    
    # SUBSEQUENT COMPARISONS: Known vs Known
    for i in range(1, len(opponents)):
        opponent_rating = opponents[i]
        new_movie_won = results[i]
        
        if new_movie_won:
            new_winner_rating, _ = wildcard_adjust_rating(
                current_rating, opponent_rating, True, i, 5
            )
            current_rating = new_winner_rating
        else:
            _, new_loser_rating = wildcard_adjust_rating(
                opponent_rating, current_rating, True, 5, i
            )
            current_rating = new_loser_rating
        
        if show_details:
            print(f"    R{i+1}: {'WIN' if new_movie_won else 'LOSS'} vs {opponent_rating} → {current_rating}")
    
    return current_rating

# WILDCARD SYSTEM: With emotion baselines
def wildcard_system(emotion, opponents, results, show_details=True):
    """Original Wildcard system with emotion baselines"""
    
    if show_details:
        print("  🃏 WILDCARD:")
    
    emotion_baselines = {
        'LOVED': 8.5,
        'LIKED': 7.0,
        'AVERAGE': 5.5,
        'DISLIKED': 3.0
    }
    current_rating = emotion_baselines.get(emotion, 7.0)
    
    if show_details:
        print(f"    Start: {emotion} baseline → {current_rating}")
    
    for i, (opponent_rating, new_movie_won) in enumerate(zip(opponents, results)):
        if new_movie_won:
            new_winner_rating, _ = wildcard_adjust_rating(
                current_rating, opponent_rating, True, i, 5
            )
            current_rating = new_winner_rating
        else:
            _, new_loser_rating = wildcard_adjust_rating(
                opponent_rating, current_rating, True, 5, i
            )
            current_rating = new_loser_rating
        
        if show_details:
            print(f"    R{i+1}: {'WIN' if new_movie_won else 'LOSS'} vs {opponent_rating} → {current_rating}")
    
    return current_rating

# Extended test scenarios
extended_scenarios = [
    {
        'name': 'The Perfect Storm',
        'emotion': 'DISLIKED',
        'opponents': [10.0, 9.8, 9.9],
        'results': [True, True, True],
        'description': 'DISLIKED movie destroys all perfect movies'
    },
    {
        'name': 'The Terrible Masterpiece',
        'emotion': 'LOVED',
        'opponents': [1.0, 1.5, 2.0],
        'results': [False, False, False],
        'description': 'LOVED movie loses to all terrible movies'
    },
    {
        'name': 'The Mediocre Miracle',
        'emotion': 'AVERAGE',
        'opponents': [5.5, 5.5, 5.5],
        'results': [True, False, True],
        'description': 'AVERAGE movie vs identical ratings'
    },
    {
        'name': 'The Rating Ladder',
        'emotion': 'LIKED',
        'opponents': [3.0, 6.0, 9.0],
        'results': [True, True, True],
        'description': 'Climbing from bottom to top tier'
    },
    {
        'name': 'The Falling Star',
        'emotion': 'LOVED',
        'opponents': [9.0, 6.0, 3.0],
        'results': [False, False, False],
        'description': 'Losing to progressively worse movies'
    },
    {
        'name': 'The Underdog Story',
        'emotion': 'DISLIKED',
        'opponents': [4.0, 5.0, 6.0],
        'results': [True, True, True],
        'description': 'Gradually improving against modest competition'
    },
    {
        'name': 'The Coin Flip',
        'emotion': 'AVERAGE',
        'opponents': [7.0, 3.0, 8.0],
        'results': [False, True, False],
        'description': 'Random quality opponents with mixed results'
    },
    {
        'name': 'The Extremes',
        'emotion': 'LIKED',
        'opponents': [1.0, 10.0, 5.5],
        'results': [True, False, True],
        'description': 'Facing the worst, best, and average movies'
    }
]

print("🎬🔥 EXTENDED SIMULATION: Round 2")
print("=" * 80)
print("Testing edge cases and extreme scenarios")
print("=" * 80)

total_differences = []
home_higher_count = 0
wildcard_higher_count = 0
identical_count = 0

for i, scenario in enumerate(extended_scenarios, 1):
    print(f"\n🎭 TEST {i}: {scenario['name']}")
    print(f"📝 {scenario['description']}")
    print(f"😀 Emotion: {scenario['emotion']} | 🥊 Opponents: {scenario['opponents']}")
    print(f"⚔️  Results: {['WIN' if r else 'LOSS' for r in scenario['results']]}")
    print()
    
    # Run both systems
    home_result = home_screen_system(scenario['opponents'], scenario['results'])
    wildcard_result = wildcard_system(scenario['emotion'], scenario['opponents'], scenario['results'])
    
    # Analysis
    difference = abs(home_result - wildcard_result)
    total_differences.append(difference)
    
    print(f"\n📊 RESULTS:")
    print(f"   🏠 Home Screen: {home_result:.1f}")
    print(f"   🃏 Wildcard:    {wildcard_result:.1f}")
    print(f"   📏 Difference:  {difference:.1f}")
    
    # Categorize results
    if difference == 0.0:
        print("   ✅ IDENTICAL!")
        identical_count += 1
    elif home_result > wildcard_result:
        print(f"   📈 Home Screen +{difference:.1f} higher")
        home_higher_count += 1
    else:
        print(f"   📈 Wildcard +{difference:.1f} higher")
        wildcard_higher_count += 1
    
    # Impact analysis
    if difference >= 3.0:
        print("   🚨 MASSIVE DIFFERENCE - Systems fundamentally disagree")
    elif difference >= 2.0:
        print("   ⚠️  LARGE DIFFERENCE - Significant philosophical gap")
    elif difference >= 1.0:
        print("   📊 MODERATE DIFFERENCE - Expected variance")
    elif difference >= 0.5:
        print("   👍 MINOR DIFFERENCE - Close alignment")
    else:
        print("   ✨ VERY CLOSE - Nearly identical")
    
    print("=" * 80)

# Summary statistics
avg_difference = sum(total_differences) / len(total_differences)
max_difference = max(total_differences)
min_difference = min(total_differences)

print(f"\n🏆 EXTENDED SIMULATION SUMMARY")
print("=" * 80)
print(f"📊 Total scenarios tested: {len(extended_scenarios)}")
print(f"📈 Home Screen rated higher: {home_higher_count}")
print(f"📈 Wildcard rated higher: {wildcard_higher_count}")
print(f"⚖️  Identical results: {identical_count}")
print(f"📏 Average difference: {avg_difference:.2f}")
print(f"📏 Maximum difference: {max_difference:.1f}")
print(f"📏 Minimum difference: {min_difference:.1f}")

# Pattern analysis
print(f"\n🔍 PATTERN ANALYSIS:")

# Analyze by emotion
emotions_analysis = {}
for i, scenario in enumerate(extended_scenarios):
    emotion = scenario['emotion']
    if emotion not in emotions_analysis:
        emotions_analysis[emotion] = {'count': 0, 'total_diff': 0, 'home_higher': 0, 'wildcard_higher': 0}
    
    emotions_analysis[emotion]['count'] += 1
    emotions_analysis[emotion]['total_diff'] += total_differences[i]
    
    home_result = home_screen_system(scenario['opponents'], scenario['results'], False)
    wildcard_result = wildcard_system(scenario['emotion'], scenario['opponents'], scenario['results'], False)
    
    if home_result > wildcard_result:
        emotions_analysis[emotion]['home_higher'] += 1
    elif wildcard_result > home_result:
        emotions_analysis[emotion]['wildcard_higher'] += 1

print("📈 By Emotion:")
for emotion, stats in emotions_analysis.items():
    avg_diff = stats['total_diff'] / stats['count']
    print(f"   {emotion}: Avg diff {avg_diff:.2f} | Home higher: {stats['home_higher']} | Wildcard higher: {stats['wildcard_higher']}")

print(f"\n💡 KEY INSIGHTS:")
if home_higher_count > wildcard_higher_count:
    print("🏠 Home Screen tends to rate movies HIGHER overall")
    print("   → Baseline-free system rewards actual performance vs opponent quality")
elif wildcard_higher_count > home_higher_count:
    print("🃏 Wildcard tends to rate movies HIGHER overall") 
    print("   → Emotion baselines create rating inflation/deflation")
else:
    print("⚖️  Both systems are balanced in their rating tendencies")

print(f"🎯 The average {avg_difference:.2f} point difference shows how much emotion baselines impact final ratings!")