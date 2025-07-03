# HOME SCREEN WORKFLOW DEMONSTRATION
# Step-by-step walkthrough of the baseline-free Unknown vs Known rating system

import math
import random

def wildcard_adjust_rating(winner_rating, loser_rating, winner_won, winner_games_played=0, loser_games_played=0):
    """Wildcard ELO logic for rounds 2 and 3"""
    
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
        print(f"      🔥 Underdog bonus applied! +20% increase")
    
    # Major upset bonus
    is_major_upset = winner_rating < loser_rating and rating_difference > 3.0
    if is_major_upset:
        winner_increase += 3.0
        print(f"      🚨 MAJOR UPSET BONUS! +3.0 additional points")
    
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
    
    print(f"      📊 Rating change: +{winner_increase:.2f} for winner, -{loser_decrease:.2f} for loser")
    
    return new_winner_rating, new_loser_rating

def simulate_opponent_selection(emotion, user_rated_movies):
    """Show how opponents are selected based on emotion percentiles"""
    
    print(f"🎯 OPPONENT SELECTION:")
    print(f"   Emotion: {emotion}")
    print(f"   User has {len(user_rated_movies)} rated movies")
    
    # Define percentile ranges
    percentile_ranges = {
        'LOVED': [0.0, 0.25],      # Top 25%
        'LIKED': [0.25, 0.50],     # Upper-middle 25-50%
        'AVERAGE': [0.50, 0.75],   # Lower-middle 50-75%
        'DISLIKED': [0.75, 1.0]    # Bottom 25%
    }
    
    range_desc = {
        'LOVED': 'top 25% (highest rated)',
        'LIKED': 'upper-middle 25-50%',
        'AVERAGE': 'lower-middle 50-75%', 
        'DISLIKED': 'bottom 25% (lowest rated)'
    }
    
    print(f"   First opponent from: {range_desc[emotion]}")
    
    # Sort movies by rating (descending)
    sorted_movies = sorted(user_rated_movies, key=lambda x: x['rating'], reverse=True)
    
    # Select from percentile range
    range_bounds = percentile_ranges[emotion]
    start_idx = int(range_bounds[0] * len(sorted_movies))
    end_idx = int(range_bounds[1] * len(sorted_movies))
    
    # Select first opponent from emotion percentile
    percentile_candidates = sorted_movies[start_idx:max(end_idx, start_idx + 1)]
    first_opponent = random.choice(percentile_candidates)
    
    # Select second and third opponents randomly
    remaining_movies = [m for m in user_rated_movies if m['id'] != first_opponent['id']]
    random.shuffle(remaining_movies)
    second_opponent = remaining_movies[0]
    third_opponent = remaining_movies[1]
    
    opponents = [first_opponent, second_opponent, third_opponent]
    
    print(f"   Selected opponents:")
    for i, opp in enumerate(opponents, 1):
        source = f"{emotion} percentile" if i == 1 else "random"
        print(f"     {i}. {opp['title']} ({opp['rating']}) - {source}")
    
    return opponents

def demonstrate_home_screen_workflow(movie_title, emotion, opponents, battle_results):
    """Complete Home Screen workflow demonstration"""
    
    print(f"🎬 HOME SCREEN WORKFLOW SIMULATION")
    print(f"=" * 60)
    print(f"🎭 Movie: {movie_title}")
    print(f"😀 User Emotion: {emotion}")
    print(f"⚔️  Battle Results: {['WIN' if r else 'LOSS' for r in battle_results]}")
    print()
    
    # Step 1: Opponent Selection (already done)
    print(f"📋 STEP 1: OPPONENT SELECTION COMPLETE")
    for i, opp in enumerate(opponents, 1):
        print(f"   Opponent {i}: {opp['title']} ({opp['rating']})")
    print()
    
    # Step 2: Unknown vs Known (Round 1)
    print(f"⚡ STEP 2: ROUND 1 - UNKNOWN vs KNOWN")
    print(f"   📍 KEY: No emotion baseline - rating from comparison only")
    print()
    
    opponent_1 = opponents[0]
    round_1_result = battle_results[0]
    
    print(f"   🥊 {movie_title} (UNKNOWN) vs {opponent_1['title']} ({opponent_1['rating']})")
    print(f"   📊 Result: {'WIN' if round_1_result else 'LOSS'}")
    
    if round_1_result:
        initial_rating = min(10.0, opponent_1['rating'] + 0.5)
        print(f"   ✅ WIN → Initial rating: {initial_rating}")
        print(f"      Logic: Opponent ({opponent_1['rating']}) + 0.5 bonus")
    else:
        initial_rating = max(1.0, opponent_1['rating'] - 0.5)
        print(f"   ❌ LOSS → Initial rating: {initial_rating}")
        print(f"      Logic: Opponent ({opponent_1['rating']}) - 0.5 penalty")
    
    current_rating = round(initial_rating * 10) / 10
    print(f"   🎯 Round 1 Final: {current_rating}")
    print()
    
    # Step 3: Known vs Known (Round 2)
    print(f"⚡ STEP 3: ROUND 2 - KNOWN vs KNOWN")
    print(f"   📍 Now using Wildcard ELO logic")
    print()
    
    opponent_2 = opponents[1]
    round_2_result = battle_results[1]
    
    print(f"   🥊 {movie_title} ({current_rating}) vs {opponent_2['title']} ({opponent_2['rating']})")
    print(f"   📊 Result: {'WIN' if round_2_result else 'LOSS'}")
    
    if round_2_result:
        new_winner_rating, _ = wildcard_adjust_rating(current_rating, opponent_2['rating'], True, 1, 5)
        current_rating = new_winner_rating
        print(f"   ✅ WIN → New rating: {current_rating}")
    else:
        _, new_loser_rating = wildcard_adjust_rating(opponent_2['rating'], current_rating, True, 5, 1)
        current_rating = new_loser_rating
        print(f"   ❌ LOSS → New rating: {current_rating}")
    
    print(f"   🎯 Round 2 Final: {current_rating}")
    print()
    
    # Step 4: Known vs Known (Round 3 - Final)
    print(f"⚡ STEP 4: ROUND 3 - KNOWN vs KNOWN (FINAL)")
    print()
    
    opponent_3 = opponents[2]
    round_3_result = battle_results[2]
    
    print(f"   🥊 {movie_title} ({current_rating}) vs {opponent_3['title']} ({opponent_3['rating']})")
    print(f"   📊 Result: {'WIN' if round_3_result else 'LOSS'}")
    
    if round_3_result:
        final_rating, _ = wildcard_adjust_rating(current_rating, opponent_3['rating'], True, 2, 5)
        print(f"   ✅ WIN → Final rating: {final_rating}")
    else:
        _, final_rating = wildcard_adjust_rating(opponent_3['rating'], current_rating, True, 5, 2)
        print(f"   ❌ LOSS → Final rating: {final_rating}")
    
    print(f"   🎯 FINAL RATING: {final_rating}")
    print()
    
    # Summary
    print(f"📋 WORKFLOW SUMMARY:")
    print(f"   🎬 Movie: {movie_title}")
    print(f"   😀 Emotion: {emotion} (no baseline used!)")
    print(f"   📊 Progression: {initial_rating} → {current_rating} → {final_rating}")
    print(f"   🏆 Final: {final_rating}/10")
    print()
    
    return final_rating

# Sample user database
sample_movies = [
    {'id': 1, 'title': 'The Godfather', 'rating': 9.2},
    {'id': 2, 'title': 'Citizen Kane', 'rating': 8.8},
    {'id': 3, 'title': 'Pulp Fiction', 'rating': 8.5},
    {'id': 4, 'title': 'The Dark Knight', 'rating': 8.2},
    {'id': 5, 'title': 'Inception', 'rating': 7.8},
    {'id': 6, 'title': 'Forrest Gump', 'rating': 7.5},
    {'id': 7, 'title': 'Titanic', 'rating': 7.0},
    {'id': 8, 'title': 'Avatar', 'rating': 6.5},
    {'id': 9, 'title': 'Transformers', 'rating': 6.0},
    {'id': 10, 'title': 'Fast & Furious', 'rating': 5.5},
    {'id': 11, 'title': 'The Room', 'rating': 5.0},
    {'id': 12, 'title': 'Battlefield Earth', 'rating': 4.5},
    {'id': 13, 'title': 'Movie 43', 'rating': 4.0},
    {'id': 14, 'title': 'Cats (2019)', 'rating': 3.5},
    {'id': 15, 'title': 'The Emoji Movie', 'rating': 3.0},
    {'id': 16, 'title': 'Jack and Jill', 'rating': 2.5}
]

# Demo scenarios
demos = [
    {
        'movie': 'Dune: Part Two',
        'emotion': 'LOVED',
        'results': [True, False, True],
        'description': 'LOVED movie with mixed results vs top-tier opponents'
    },
    {
        'movie': 'The Marvels',
        'emotion': 'DISLIKED', 
        'results': [True, True, False],
        'description': 'DISLIKED movie surprises vs bottom-tier opponents'
    },
    {
        'movie': 'Spider-Man 4',
        'emotion': 'LIKED',
        'results': [False, True, True],
        'description': 'LIKED movie starts weak but finishes strong'
    }
]

print("🏠🎬 HOME SCREEN WORKFLOW DEMONSTRATIONS")
print("=" * 80)
print("Complete baseline-free Unknown vs Known rating process")
print("=" * 80)
print()

for i, demo in enumerate(demos, 1):
    print(f"📺 DEMO {i}: {demo['description']}")
    print("=" * 60)
    
    # Show opponent selection
    opponents = simulate_opponent_selection(demo['emotion'], sample_movies)
    print()
    
    # Run complete workflow
    final_rating = demonstrate_home_screen_workflow(
        demo['movie'], 
        demo['emotion'], 
        opponents, 
        demo['results']
    )
    
    print(f"💡 KEY INSIGHT: {demo['emotion']} emotion selected opponent difficulty,")
    print(f"   but final rating ({final_rating}) came purely from battle performance!")
    print()
    print("=" * 80)
    print()

print("🎯 HOME SCREEN WORKFLOW PHILOSOPHY:")
print("🔹 Emotion selects opponent difficulty (percentiles)")
print("🔹 First battle outcome determines initial rating (no baseline bias)")
print("🔹 Subsequent battles use proven ELO calculations")
print("🔹 Final rating reflects actual performance vs opponent quality")
print("🔹 More 'fair' than emotion-biased baselines!")