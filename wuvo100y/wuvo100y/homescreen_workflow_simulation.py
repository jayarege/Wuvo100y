# HOME SCREEN WORKFLOW SIMULATION
# Detailed step-by-step demonstration of the baseline-free Unknown vs Known system

import math
import random

# Wildcard's exact adjustRating function for Known vs Known comparisons
def wildcard_adjust_rating(winner_rating, loser_rating, winner_won, winner_games_played=0, loser_games_played=0):
    """Wildcard's exact ELO logic for rounds 2 and 3"""
    
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
    """Simulate how opponents are selected based on emotion percentiles"""
    
    print(f"🎯 OPPONENT SELECTION PROCESS:")
    print(f"   Emotion selected: {emotion}")
    print(f"   User's rated movies: {len(user_rated_movies)} total")
    
    # Define percentile ranges for each emotion
    percentile_ranges = {
        'LOVED': [0.0, 0.25],      # Top 25% (highest rated)
        'LIKED': [0.25, 0.50],     # Upper-middle 25-50%
        'AVERAGE': [0.50, 0.75],   # Lower-middle 50-75%
        'DISLIKED': [0.75, 1.0]    # Bottom 25% (lowest rated)
    }
    
    range_desc = {
        'LOVED': 'top 25% (8.0-10.0)',
        'LIKED': 'upper-middle 25-50% (6.0-8.0)',
        'AVERAGE': 'lower-middle 50-75% (4.0-6.0)', 
        'DISLIKED': 'bottom 25% (1.0-4.0)'
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
    
    # Select second and third opponents randomly from remaining movies
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

def simulate_home_screen_workflow(movie_title, emotion, opponents, battle_results):
    """Complete Home Screen workflow simulation"""
    
    print(f"🎬 HOME SCREEN WORKFLOW SIMULATION")\n    print(f\"=\"*60)\n    print(f\"🎭 Movie: {movie_title}\")\n    print(f\"😀 User Emotion: {emotion}\")\n    print(f\"⚔️  Battle Results: {['WIN' if r else 'LOSS' for r in battle_results]}\")\n    print()\n    \n    # Step 1: Opponent Selection (already done above)\n    print(f\"📋 STEP 1: OPPONENT SELECTION COMPLETE\")\n    for i, opp in enumerate(opponents, 1):\n        print(f\"   Opponent {i}: {opp['title']} ({opp['rating']})\")\n    print()\n    \n    # Step 2: Unknown vs Known (Round 1)\n    print(f\"⚡ STEP 2: ROUND 1 - UNKNOWN vs KNOWN\")\n    print(f\"   📍 This is the KEY difference from Wildcard!\")\n    print(f\"   🔍 No emotion baseline - rating derived purely from comparison\")\n    print()\n    \n    opponent_1 = opponents[0]\n    round_1_result = battle_results[0]\n    \n    print(f\"   🥊 {movie_title} (UNKNOWN) vs {opponent_1['title']} ({opponent_1['rating']})\")\n    print(f\"   📊 Battle result: {'WIN' if round_1_result else 'LOSS'}\")\n    \n    if round_1_result:\n        # Movie won - should be rated higher than opponent\n        initial_rating = min(10.0, opponent_1['rating'] + 0.5)\n        print(f\"   ✅ Movie WON → Initial rating: {initial_rating}\")\n        print(f\"      Logic: Opponent rating ({opponent_1['rating']}) + 0.5 bonus = {initial_rating}\")\n    else:\n        # Movie lost - should be rated lower than opponent\n        initial_rating = max(1.0, opponent_1['rating'] - 0.5)\n        print(f\"   ❌ Movie LOST → Initial rating: {initial_rating}\")\n        print(f\"      Logic: Opponent rating ({opponent_1['rating']}) - 0.5 penalty = {initial_rating}\")\n    \n    current_rating = round(initial_rating * 10) / 10\n    print(f\"   🎯 Round 1 Final: {current_rating}\")\n    print()\n    \n    # Step 3: Known vs Known (Round 2)\n    print(f\"⚡ STEP 3: ROUND 2 - KNOWN vs KNOWN\")\n    print(f\"   📍 Now using Wildcard ELO logic\")\n    print()\n    \n    opponent_2 = opponents[1]\n    round_2_result = battle_results[1]\n    \n    print(f\"   🥊 {movie_title} ({current_rating}) vs {opponent_2['title']} ({opponent_2['rating']})\")\n    print(f\"   📊 Battle result: {'WIN' if round_2_result else 'LOSS'}\")\n    \n    if round_2_result:\n        new_winner_rating, new_loser_rating = wildcard_adjust_rating(\n            current_rating, opponent_2['rating'], True, 1, 5\n        )\n        current_rating = new_winner_rating\n        print(f\"   ✅ Movie WON → New rating: {current_rating}\")\n    else:\n        new_winner_rating, new_loser_rating = wildcard_adjust_rating(\n            opponent_2['rating'], current_rating, True, 5, 1\n        )\n        current_rating = new_loser_rating\n        print(f\"   ❌ Movie LOST → New rating: {current_rating}\")\n    \n    print(f\"   🎯 Round 2 Final: {current_rating}\")\n    print()\n    \n    # Step 4: Known vs Known (Round 3 - Final)\n    print(f\"⚡ STEP 4: ROUND 3 - KNOWN vs KNOWN (FINAL)\")\n    print(f\"   📍 Final rating determination\")\n    print()\n    \n    opponent_3 = opponents[2]\n    round_3_result = battle_results[2]\n    \n    print(f\"   🥊 {movie_title} ({current_rating}) vs {opponent_3['title']} ({opponent_3['rating']})\")\n    print(f\"   📊 Battle result: {'WIN' if round_3_result else 'LOSS'}\")\n    \n    if round_3_result:\n        new_winner_rating, new_loser_rating = wildcard_adjust_rating(\n            current_rating, opponent_3['rating'], True, 2, 5\n        )\n        final_rating = new_winner_rating\n        print(f\"   ✅ Movie WON → Final rating: {final_rating}\")\n    else:\n        new_winner_rating, new_loser_rating = wildcard_adjust_rating(\n            opponent_3['rating'], current_rating, True, 5, 2\n        )\n        final_rating = new_loser_rating\n        print(f\"   ❌ Movie LOST → Final rating: {final_rating}\")\n    \n    print(f\"   🎯 FINAL RATING: {final_rating}\")\n    print()\n    \n    # Step 5: Summary\n    print(f\"📋 WORKFLOW SUMMARY:\")\n    print(f\"   🎬 Movie: {movie_title}\")\n    print(f\"   😀 Emotion: {emotion} (no baseline used!)\")\n    print(f\"   📊 Rating progression: {initial_rating} → {current_rating} → {final_rating}\")\n    print(f\"   🏆 Final Rating: {final_rating}/10\")\n    print()\n    \n    return final_rating\n\n# Create sample user movie database\nsample_user_movies = [\n    {'id': 1, 'title': 'The Godfather', 'rating': 9.2},\n    {'id': 2, 'title': 'Citizen Kane', 'rating': 8.8},\n    {'id': 3, 'title': 'Pulp Fiction', 'rating': 8.5},\n    {'id': 4, 'title': 'The Dark Knight', 'rating': 8.2},\n    {'id': 5, 'title': 'Inception', 'rating': 7.8},\n    {'id': 6, 'title': 'Forrest Gump', 'rating': 7.5},\n    {'id': 7, 'title': 'Titanic', 'rating': 7.0},\n    {'id': 8, 'title': 'Avatar', 'rating': 6.5},\n    {'id': 9, 'title': 'Transformers', 'rating': 6.0},\n    {'id': 10, 'title': 'Fast & Furious', 'rating': 5.5},\n    {'id': 11, 'title': 'The Room', 'rating': 5.0},\n    {'id': 12, 'title': 'Battlefield Earth', 'rating': 4.5},\n    {'id': 13, 'title': 'Movie 43', 'rating': 4.0},\n    {'id': 14, 'title': 'Cats (2019)', 'rating': 3.5},\n    {'id': 15, 'title': 'The Emoji Movie', 'rating': 3.0},\n    {'id': 16, 'title': 'Jack and Jill', 'rating': 2.5}\n]\n\n# Demo scenarios\nworkflow_demos = [\n    {\n        'movie': 'Dune: Part Two',\n        'emotion': 'LOVED',\n        'results': [True, False, True],\n        'description': 'LOVED movie with mixed results vs top-tier opponents'\n    },\n    {\n        'movie': 'The Marvels',\n        'emotion': 'DISLIKED', \n        'results': [True, True, False],\n        'description': 'DISLIKED movie surprises vs bottom-tier opponents'\n    },\n    {\n        'movie': 'Spider-Man 4',\n        'emotion': 'LIKED',\n        'results': [False, True, True],\n        'description': 'LIKED movie starts weak but finishes strong'\n    }\n]\n\nprint(\"🏠🎬 HOME SCREEN WORKFLOW DEMONSTRATIONS\")\nprint(\"=\"*80)\nprint(\"Showing the complete baseline-free Unknown vs Known rating process\")\nprint(\"=\"*80)\nprint()\n\nfor i, demo in enumerate(workflow_demos, 1):\n    print(f\"📺 DEMO {i}: {demo['description']}\")\n    print(\"=\"*60)\n    \n    # Select opponents based on emotion\n    opponents = simulate_opponent_selection(demo['emotion'], sample_user_movies)\n    print()\n    \n    # Run the complete workflow\n    final_rating = simulate_home_screen_workflow(\n        demo['movie'], \n        demo['emotion'], \n        opponents, \n        demo['results']\n    )\n    \n    print(f\"💡 KEY INSIGHT: The {demo['emotion']} emotion determined opponent quality,\")\n    print(f\"   but the final rating ({final_rating}) came purely from battle performance!\")\n    print()\n    print(\"=\"*80)\n    print()\n\nprint(\"🎯 HOME SCREEN WORKFLOW PHILOSOPHY:\")\nprint(\"🔹 Emotion selects opponent difficulty (percentiles)\")\nprint(\"🔹 First battle outcome determines initial rating (no baseline bias)\")\nprint(\"🔹 Subsequent battles use proven ELO calculations\")\nprint(\"🔹 Final rating reflects actual performance vs opponent quality\")\nprint(\"🔹 More 'fair' than emotion-biased baselines!\")