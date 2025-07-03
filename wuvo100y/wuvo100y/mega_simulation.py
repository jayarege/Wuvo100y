# MEGA SIMULATION: 10 Movies - Wildcard vs Home Screen Rating Systems
# Comprehensive test with diverse emotions and battle scenarios

import math
import random

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

# Generate 10 diverse test scenarios
def generate_test_scenarios():
    """Generate 10 diverse movie scenarios with different emotions and battle patterns"""
    
    scenarios = []
    emotions = ['LOVED', 'LIKED', 'AVERAGE', 'DISLIKED']
    
    # Scenario 1: LOVED movie dominates (all wins)
    scenarios.append({
        'name': 'Movie 1: LOVED Blockbuster',
        'emotion': 'LOVED',
        'opponents': [4.0, 5.5, 6.0],
        'results': [True, True, True],
        'description': 'LOVED movie wins all battles vs weaker opponents'
    })
    
    # Scenario 2: DISLIKED movie major upsets (all wins vs strong)
    scenarios.append({
        'name': 'Movie 2: DISLIKED Underdog',
        'emotion': 'DISLIKED',
        'opponents': [8.5, 9.0, 9.5],
        'results': [True, True, True],
        'description': 'DISLIKED movie causes multiple major upsets'
    })
    
    # Scenario 3: LIKED movie mixed results
    scenarios.append({
        'name': 'Movie 3: LIKED Drama',
        'emotion': 'LIKED',
        'opponents': [6.5, 8.0, 7.5],
        'results': [True, False, True],
        'description': 'LIKED movie with mixed win/loss pattern'
    })
    
    # Scenario 4: AVERAGE movie loses all
    scenarios.append({
        'name': 'Movie 4: AVERAGE Disappointment',
        'emotion': 'AVERAGE',
        'opponents': [8.0, 8.5, 9.0],
        'results': [False, False, False],
        'description': 'AVERAGE movie loses to superior opponents'
    })
    
    # Scenario 5: LOVED movie faces tough competition
    scenarios.append({
        'name': 'Movie 5: LOVED vs Titans',
        'emotion': 'LOVED',
        'opponents': [9.0, 9.5, 10.0],
        'results': [False, True, False],
        'description': 'LOVED movie struggles against top-tier opponents'
    })
    
    # Scenario 6: DISLIKED movie barely wins
    scenarios.append({
        'name': 'Movie 6: DISLIKED Surprise',
        'emotion': 'DISLIKED',
        'opponents': [4.0, 3.5, 4.5],
        'results': [True, True, False],
        'description': 'DISLIKED movie wins some battles vs similar quality'
    })
    
    # Scenario 7: LIKED movie perfect storm (major upset chain)
    scenarios.append({
        'name': 'Movie 7: LIKED Phenomenon',
        'emotion': 'LIKED',
        'opponents': [10.0, 9.8, 9.9],
        'results': [True, True, True],
        'description': 'LIKED movie achieves impossible upset victories'
    })
    
    # Scenario 8: AVERAGE movie mediocre performance
    scenarios.append({
        'name': 'Movie 8: AVERAGE Mediocrity',
        'emotion': 'AVERAGE',
        'opponents': [5.0, 6.0, 5.5],
        'results': [True, False, True],
        'description': 'AVERAGE movie performs as expected vs similar ratings'
    })
    
    # Scenario 9: LOVED movie catastrophic losses
    scenarios.append({
        'name': 'Movie 9: LOVED Flop',
        'emotion': 'LOVED',
        'opponents': [2.0, 1.5, 3.0],
        'results': [False, False, False],
        'description': 'LOVED movie unexpectedly loses to terrible opponents'
    })
    
    # Scenario 10: DISLIKED movie extreme rollercoaster
    scenarios.append({
        'name': 'Movie 10: DISLIKED Wildcard',
        'emotion': 'DISLIKED',
        'opponents': [9.5, 2.0, 8.0],
        'results': [True, False, True],
        'description': 'DISLIKED movie with extreme rating variance in opponents'
    })
    
    return scenarios

# Enhanced analysis function
def analyze_results(wildcard_results, home_results, scenarios):
    """Comprehensive analysis of all results"""
    
    differences = []
    perfect_matches = 0
    minor_differences = 0
    major_differences = 0
    
    print("=" * 80)
    print("📊 DETAILED RESULTS ANALYSIS")
    print("=" * 80)
    
    for i, (w_result, h_result, scenario) in enumerate(zip(wildcard_results, home_results, scenarios)):
        diff = abs(w_result - h_result)
        differences.append(diff)
        
        print(f"\n🎬 {scenario['name']}")
        print(f"   Emotion: {scenario['emotion']}")
        print(f"   Opponents: {scenario['opponents']}")
        print(f"   Results: {['WIN' if r else 'LOSS' for r in scenario['results']]}")
        print(f"   Wildcard: {w_result:.1f} | Home: {h_result:.1f} | Diff: {diff:.2f}")
        
        if diff == 0.0:
            print("   ✅ PERFECT MATCH")
            perfect_matches += 1
        elif diff <= 0.1:
            print("   ✅ EXCELLENT (minor rounding)")
            minor_differences += 1
        elif diff <= 0.5:
            print("   ⚠️  ACCEPTABLE (small variance)")
            minor_differences += 1
        else:
            print("   🚨 SIGNIFICANT DIFFERENCE")
            major_differences += 1
    
    # Summary statistics
    avg_diff = sum(differences) / len(differences)
    max_diff = max(differences)
    min_diff = min(differences)
    
    print("\n" + "=" * 80)
    print("🏆 MEGA SIMULATION SUMMARY")
    print("=" * 80)
    print(f"Total movies tested: {len(scenarios)}")
    print(f"Perfect matches: {perfect_matches}")
    print(f"Minor differences: {minor_differences}")
    print(f"Major differences: {major_differences}")
    print(f"Average difference: {avg_diff:.3f}")
    print(f"Maximum difference: {max_diff:.3f}")
    print(f"Minimum difference: {min_diff:.3f}")
    
    # Overall assessment
    if perfect_matches >= 8:
        print("\n🎯 VERDICT: EXCELLENT ALIGNMENT")
        print("Both systems are virtually identical in their rating calculations.")
    elif perfect_matches >= 6:
        print("\n✅ VERDICT: GOOD ALIGNMENT")
        print("Systems are well-aligned with minor acceptable differences.")
    elif major_differences == 0:
        print("\n👍 VERDICT: ACCEPTABLE ALIGNMENT")
        print("No major differences detected, minor variances within tolerance.")
    else:
        print("\n⚠️ VERDICT: NEEDS INVESTIGATION")
        print("Significant differences detected that may require analysis.")
    
    # Emotion-based analysis
    emotion_stats = {}
    for i, scenario in enumerate(scenarios):
        emotion = scenario['emotion']
        if emotion not in emotion_stats:
            emotion_stats[emotion] = {'count': 0, 'total_diff': 0, 'max_diff': 0}
        
        emotion_stats[emotion]['count'] += 1
        emotion_stats[emotion]['total_diff'] += differences[i]
        emotion_stats[emotion]['max_diff'] = max(emotion_stats[emotion]['max_diff'], differences[i])
    
    print("\n📈 EMOTION-BASED ANALYSIS:")
    for emotion, stats in emotion_stats.items():
        avg_emotion_diff = stats['total_diff'] / stats['count']
        print(f"   {emotion}: {stats['count']} movies, avg diff: {avg_emotion_diff:.3f}, max diff: {stats['max_diff']:.3f}")
    
    return {
        'perfect_matches': perfect_matches,
        'minor_differences': minor_differences,
        'major_differences': major_differences,
        'average_difference': avg_diff,
        'maximum_difference': max_diff,
        'differences': differences
    }

# Main simulation execution
def run_mega_simulation():
    """Execute the mega simulation"""
    
    print("🎬🎬🎬 MEGA SIMULATION: 10 MOVIES 🎬🎬🎬")
    print("Testing Wildcard vs Home Screen Rating Systems")
    print("=" * 80)
    
    scenarios = generate_test_scenarios()
    wildcard_results = []
    home_results = []
    
    for i, scenario in enumerate(scenarios, 1):
        print(f"\n🎭 TEST {i}: {scenario['name']}")
        print(f"Description: {scenario['description']}")
        print(f"Emotion: {scenario['emotion']}")
        print(f"Opponents: {scenario['opponents']}")
        print(f"Battle results: {['WIN' if r else 'LOSS' for r in scenario['results']]}")
        print()
        
        # Run Wildcard simulation
        print("WILDCARD SYSTEM:")
        wildcard_final = wildcard_simulation(
            scenario['emotion'], 
            scenario['opponents'], 
            scenario['results']
        )
        wildcard_results.append(wildcard_final)
        
        print("\nHOME SCREEN SYSTEM:")
        home_final = home_screen_unknown_vs_known(
            scenario['emotion'], 
            scenario['opponents'], 
            scenario['results']
        )
        home_results.append(home_final)
        
        difference = abs(wildcard_final - home_final)
        print(f"\n📊 RESULT: Wildcard={wildcard_final}, Home={home_final}, Diff={difference:.2f}")
        print("-" * 80)
    
    # Comprehensive analysis
    analysis = analyze_results(wildcard_results, home_results, scenarios)
    
    return analysis

if __name__ == "__main__":
    run_mega_simulation()