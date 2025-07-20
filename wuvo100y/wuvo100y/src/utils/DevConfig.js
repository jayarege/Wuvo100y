// src/utils/DevConfig.js
// Development configuration to skip auth and onboarding with pre-selected movies

const DEV_CONFIG = {
  // Set to true to skip auth and onboarding during development
  ENABLE_DEV_MODE: true, // Enabled for Snack demo
  
  // Pre-selected movies that will be automatically added to seen list
  DEV_MOVIES: [
    {
      id: 414906,
      title: "Sicario",
      userRating: 9.8,
      eloRating: 980,
      score: 7.6,
      voteCount: 790000,
      poster_path: "/ceszCkKF6V3wEqPZaWdYpKQTObs.jpg",
      poster: "/ceszCkKF6V3wEqPZaWdYpKQTObs.jpg",
      release_date: "2015-09-11",
      release_year: 2015,
      genre_ids: [28, 80, 18, 53], // Action, Crime, Drama, Thriller
      overview: "An idealistic FBI agent is enlisted by a government task force to aid in the escalating war against drugs at the border area between the U.S. and Mexico.",
      comparisonHistory: [],
      comparisonWins: 12,
      gamesPlayed: 12,
      adult: false,
      isOnboarded: true,
      mediaType: 'movie'
    },
    {
      id: 155,
      title: "The Dark Knight",
      userRating: 9.7,
      eloRating: 970,
      score: 9.0,
      voteCount: 2500000,
      poster_path: "/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
      poster: "/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
      release_date: "2008-07-18",
      release_year: 2008,
      genre_ids: [28, 80, 18, 53], // Action, Crime, Drama, Thriller
      overview: "Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations that plague the streets.",
      comparisonHistory: [],
      comparisonWins: 11,
      gamesPlayed: 12,
      adult: false,
      isOnboarded: true,
      mediaType: 'movie'
    },
    {
      id: 10497,
      title: "There Will Be Blood",
      userRating: 9.5,
      eloRating: 950,
      score: 8.2,
      voteCount: 560000,
      poster_path: "/fa0RDkAlCec0STeMNAhPaF89q6U.jpg",
      poster: "/fa0RDkAlCec0STeMNAhPaF89q6U.jpg",
      release_date: "2007-12-26",
      release_year: 2007,
      genre_ids: [18, 37], // Drama, Western
      overview: "Ruthless silver miner, turned oil prospector, Daniel Plainview moves to oil-rich California. Using his son to project a trustworthy, family-man image, Plainview cons local landowners into selling him their valuable properties for a pittance.",
      comparisonHistory: [],
      comparisonWins: 10,
      gamesPlayed: 11,
      adult: false,
      isOnboarded: true,
      mediaType: 'movie'
    },
    {
      id: 37165,
      title: "The Social Network",
      userRating: 9.3,
      eloRating: 930,
      score: 7.7,
      voteCount: 1400000,
      poster_path: "/n0ybibhJtQ5icDqTp8eRytcIHJx.jpg",
      poster: "/n0ybibhJtQ5icDqTp8eRytcIHJx.jpg",
      release_date: "2010-10-01",
      release_year: 2010,
      genre_ids: [18], // Drama
      overview: "On a fall night in 2003, Harvard undergrad and computer programming genius Mark Zuckerberg sits down at his computer and heatedly begins working on a new idea.",
      comparisonHistory: [],
      comparisonWins: 9,
      gamesPlayed: 10,
      adult: false,
      isOnboarded: true,
      mediaType: 'movie'
    },
    {
      id: 807,
      title: "Se7en",
      userRating: 9.2,
      eloRating: 920,
      score: 8.3,
      voteCount: 1500000,
      poster_path: "/6yoghtyTpznpBik8EngEmJskVUO.jpg",
      poster: "/6yoghtyTpznpBik8EngEmJskVUO.jpg",
      release_date: "1995-09-22",
      release_year: 1995,
      genre_ids: [80, 18, 9648, 53], // Crime, Drama, Mystery, Thriller
      overview: "Two homicide detectives are on a desperate hunt for a serial killer whose crimes are based on the 'seven deadly sins' in this dark and haunting film that takes viewers from the tortured remains of one victim to the next.",
      comparisonHistory: [],
      comparisonWins: 8,
      gamesPlayed: 9,
      adult: false,
      isOnboarded: true,
      mediaType: 'movie'
    },
    {
      id: 244786,
      title: "Whiplash",
      userRating: 9.1,
      eloRating: 910,
      score: 8.5,
      voteCount: 960000,
      poster_path: "/7fn624j5lj3xTme2SgiLCeuedmO.jpg",
      poster: "/7fn624j5lj3xTme2SgiLCeuedmO.jpg",
      release_date: "2014-10-10",
      release_year: 2014,
      genre_ids: [18, 10402], // Drama, Music
      overview: "Under the direction of a ruthless instructor, a talented young drummer begins to pursue perfection at any cost, even his humanity.",
      comparisonHistory: [],
      comparisonWins: 7,
      gamesPlayed: 8,
      adult: false,
      isOnboarded: true,
      mediaType: 'movie'
    },
    {
      id: 242582,
      title: "Nightcrawler",
      userRating: 8.9,
      eloRating: 890,
      score: 7.8,
      voteCount: 540000,
      poster_path: "/j9HrX8f7GbZQm1BrBiR40uFQZSb.jpg",
      poster: "/j9HrX8f7GbZQm1BrBiR40uFQZSb.jpg",
      release_date: "2014-10-31",
      release_year: 2014,
      genre_ids: [80, 18, 53], // Crime, Drama, Thriller
      overview: "When Lou Bloom, desperate for work, muscles into the world of L.A. crime journalism, he blurs the line between observer and participant to become the star of his own story.",
      comparisonHistory: [],
      comparisonWins: 6,
      gamesPlayed: 7,
      adult: false,
      isOnboarded: true,
      mediaType: 'movie'
    },
    {
      id: 10090,
      title: "No Country for Old Men",
      userRating: 8.8,
      eloRating: 880,
      score: 8.1,
      voteCount: 980000,
      poster_path: "/bj1v6YKF8yHqA489VFfnQvpRYG0.jpg",
      poster: "/bj1v6YKF8yHqA489VFfnQvpRYG0.jpg",
      release_date: "2007-11-21",
      release_year: 2007,
      genre_ids: [80, 18, 53], // Crime, Drama, Thriller
      overview: "Llewelyn Moss stumbles upon dead bodies, $2 million and a hoard of heroin in a Texas desert, but methodical killer Anton Chigurh comes looking for it, with local sheriff Ed Tom Bell hot on his trail.",
      comparisonHistory: [],
      comparisonWins: 5,
      gamesPlayed: 6,
      adult: false,
      isOnboarded: true,
      mediaType: 'movie'
    },
    {
      id: 77,
      title: "Memento",
      userRating: 6.8,
      eloRating: 680,
      score: 8.2,
      voteCount: 1200000,
      poster_path: "/yuNs09hvpHVU1cBTCAk9zxsL2oW.jpg",
      poster: "/yuNs09hvpHVU1cBTCAk9zxsL2oW.jpg",
      release_date: "2000-10-11",
      release_year: 2000,
      genre_ids: [9648, 53, 18], // Mystery, Thriller, Drama
      overview: "Leonard Shelby is tracking down the man who raped and murdered his wife. The difficulty of locating his wife's killer, however, is compounded by the fact that he suffers from a rare, untreatable form of short-term memory loss.",
      comparisonHistory: [],
      comparisonWins: 2,
      gamesPlayed: 5,
      adult: false,
      isOnboarded: true,
      mediaType: 'movie'
    },
    {
      id: 115,
      title: "The Big Lebowski",
      userRating: 6.2,
      eloRating: 620,
      score: 8.1,
      voteCount: 780000,
      poster_path: "/d4ftZuZ4UZeAyRe1iK5uxBK5P14.jpg",
      poster: "/d4ftZuZ4UZeAyRe1iK5uxBK5P14.jpg",
      release_date: "1998-03-06",
      release_year: 1998,
      genre_ids: [80, 35, 18], // Crime, Comedy, Drama
      overview: "Jeffrey 'The Dude' Lebowski, a Los Angeles slacker who enjoys bowling and White Russians, is mistaken for another Jeffrey Lebowski, a wheelchair-bound millionaire, and finds himself dragged into a strange series of events involving nihilists, adult film producers, ferrets, errant toes, and large sums of money.",
      comparisonHistory: [],
      comparisonWins: 1,
      gamesPlayed: 4,
      adult: false,
      isOnboarded: true,
      mediaType: 'movie'
    }
  ],

  // Pre-selected TV shows that will be automatically added to seen list
  DEV_TV_SHOWS: [
    {
      id: 1398,
      title: "The Sopranos",
      name: "The Sopranos",
      userRating: 9.4,
      eloRating: 940,
      score: 9.2,
      voteCount: 180000,
      poster_path: "/rTc7ZXdroqjkKivFPvCPX0Ru7uw.jpg",
      poster: "/rTc7ZXdroqjkKivFPvCPX0Ru7uw.jpg",
      first_air_date: "1999-01-10",
      release_year: 1999,
      genre_ids: [80, 18], // Crime, Drama
      overview: "The story of New Jersey-based Italian-American mobster Tony Soprano and the difficulties he faces as he tries to balance the conflicting requirements of his home life and the criminal organization he heads.",
      comparisonHistory: [],
      comparisonWins: 8,
      gamesPlayed: 10,
      adult: false,
      isOnboarded: true,
      mediaType: 'tv'
    },
    {
      id: 1396,
      title: "Breaking Bad",
      name: "Breaking Bad",
      userRating: 9.6,
      eloRating: 960,
      score: 9.5,
      voteCount: 220000,
      poster_path: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
      poster: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
      first_air_date: "2008-01-20",
      release_year: 2008,
      genre_ids: [80, 18, 53], // Crime, Drama, Thriller
      overview: "When Walter White, a New Mexico chemistry teacher, is diagnosed with Stage III cancer and given a prognosis of only two years left to live, he becomes filled with a sense of fearlessness and an unrelenting desire to secure his family's financial future at any cost.",
      comparisonHistory: [],
      comparisonWins: 12,
      gamesPlayed: 15,
      adult: false,
      isOnboarded: true,
      mediaType: 'tv'
    },
    {
      id: 87108,
      title: "Chernobyl",
      name: "Chernobyl",
      userRating: 9.3,
      eloRating: 930,
      score: 9.4,
      voteCount: 95000,
      poster_path: "/hlLXt2tOPT6RRnjiUmoxyG1LTFi.jpg",
      poster: "/hlLXt2tOPT6RRnjiUmoxyG1LTFi.jpg",
      first_air_date: "2019-05-06",
      release_year: 2019,
      genre_ids: [18, 36, 10764], // Drama, History, War & Politics
      overview: "The true story of one of the worst man-made catastrophes in history: the catastrophic nuclear accident at Chernobyl. A tale of the brave men and women who sacrificed to save Europe from unimaginable disaster.",
      comparisonHistory: [],
      comparisonWins: 6,
      gamesPlayed: 7,
      adult: false,
      isOnboarded: true,
      mediaType: 'tv'
    },
    {
      id: 1399,
      title: "Game of Thrones",
      name: "Game of Thrones",
      userRating: 8.9,
      eloRating: 890,
      score: 9.3,
      voteCount: 350000,
      poster_path: "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
      poster: "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
      first_air_date: "2011-04-17",
      release_year: 2011,
      genre_ids: [10759, 18, 10765], // Action & Adventure, Drama, Sci-Fi & Fantasy
      overview: "Seven noble families fight for control of the mythical land of Westeros. Friction between the houses leads to full-scale war. All while a very ancient evil awakens in the farthest north.",
      comparisonHistory: [],
      comparisonWins: 7,
      gamesPlayed: 9,
      adult: false,
      isOnboarded: true,
      mediaType: 'tv'
    },
    {
      id: 60625,
      title: "Rick and Morty",
      name: "Rick and Morty",
      userRating: 8.7,
      eloRating: 870,
      score: 8.7,
      voteCount: 89000,
      poster_path: "/gdIrmf2DdY5mgN6ycVP0XlzKzbE.jpg",
      poster: "/gdIrmf2DdY5mgN6ycVP0XlzKzbE.jpg",
      first_air_date: "2013-12-02",
      release_year: 2013,
      genre_ids: [16, 35, 10765], // Animation, Comedy, Sci-Fi & Fantasy
      overview: "A sociopathic scientist drags his unintelligent grandson on insanely dangerous adventures across the universe.",
      comparisonHistory: [],
      comparisonWins: 6,
      gamesPlayed: 8,
      adult: false,
      isOnboarded: true,
      mediaType: 'tv'
    },
    {
      id: 1418,
      title: "The Big Bang Theory",
      name: "The Big Bang Theory",
      userRating: 8.2,
      eloRating: 820,
      score: 8.1,
      voteCount: 89000,
      poster_path: "/ooBGRQBdbGzBxAVfExiO8r7kloA.jpg",
      poster: "/ooBGRQBdbGzBxAVfExiO8r7kloA.jpg",
      first_air_date: "2007-09-24",
      release_year: 2007,
      genre_ids: [35], // Comedy
      overview: "The lives of four socially awkward friends Leonard, Sheldon, Howard and Raj take a wild turn when a beautiful aspiring actress Penny moves into the apartment next door.",
      comparisonHistory: [],
      comparisonWins: 5,
      gamesPlayed: 7,
      adult: false,
      isOnboarded: true,
      mediaType: 'tv'
    },
    {
      id: 1402,
      title: "The Walking Dead",
      name: "The Walking Dead",
      userRating: 7.8,
      eloRating: 780,
      score: 8.2,
      voteCount: 75000,
      poster_path: "/rqeYMLryjcawh2JeRpCVUDXYM5b.jpg",
      poster: "/rqeYMLryjcawh2JeRpCVUDXYM5b.jpg",
      first_air_date: "2010-10-31",
      release_year: 2010,
      genre_ids: [18, 27, 10759], // Drama, Horror, Action & Adventure
      overview: "Sheriff's deputy Rick Grimes awakens from a coma to find a post-apocalyptic world dominated by flesh-eating zombies. He sets out to find his family and encounters many other survivors along the way.",
      comparisonHistory: [],
      comparisonWins: 4,
      gamesPlayed: 6,
      adult: false,
      isOnboarded: true,
      mediaType: 'tv'
    },
    {
      id: 1408,
      title: "House",
      name: "House",
      userRating: 7.5,
      eloRating: 750,
      score: 8.7,
      voteCount: 43000,
      poster_path: "/3Cz7ySOQJmqiuTdrc6CY0r65yDI.jpg",
      poster: "/3Cz7ySOQJmqiuTdrc6CY0r65yDI.jpg",
      first_air_date: "2004-11-16",
      release_year: 2004,
      genre_ids: [18, 9648], // Drama, Mystery
      overview: "Dr. Gregory House, a drug-addicted, unconventional, misanthropic medical genius, leads a team of diagnosticians at the fictional Princeton–Plainsboro Teaching Hospital in New Jersey.",
      comparisonHistory: [],
      comparisonWins: 3,
      gamesPlayed: 5,
      adult: false,
      isOnboarded: true,
      mediaType: 'tv'
    },
    {
      id: 1390,
      title: "Friends",
      name: "Friends",
      userRating: 7.2,
      eloRating: 720,
      score: 8.9,
      voteCount: 87000,
      poster_path: "/2koX1xLkpTQM4IZebYvKysFW1Nh.jpg",
      poster: "/2koX1xLkpTQM4IZebYvKysFW1Nh.jpg",
      first_air_date: "1994-09-22",
      release_year: 1994,
      genre_ids: [35], // Comedy
      overview: "The misadventures of a group of friends as they navigate the pitfalls of work, life and love in Manhattan.",
      comparisonHistory: [],
      comparisonWins: 2,
      gamesPlayed: 4,
      adult: false,
      isOnboarded: true,
      mediaType: 'tv'
    },
    {
      id: 1403,
      title: "Marvel's Daredevil",
      name: "Marvel's Daredevil",
      userRating: 6.8,
      eloRating: 680,
      score: 8.6,
      voteCount: 23000,
      poster_path: "/QWbPaDxiB6LW2LjASknzYBvjMj.jpg",
      poster: "/QWbPaDxiB6LW2LjASknzYBvjMj.jpg",
      first_air_date: "2015-04-10",
      release_year: 2015,
      genre_ids: [80, 18, 10759], // Crime, Drama, Action & Adventure
      overview: "Lawyer-by-day Matt Murdock uses his heightened senses from being blinded as a young boy to fight crime at night on the streets of Hell's Kitchen as Daredevil.",
      comparisonHistory: [],
      comparisonWins: 1,
      gamesPlayed: 3,
      adult: false,
      isOnboarded: true,
      mediaType: 'tv'
    },
    {
      id: 1425,
      title: "Sherlock",
      name: "Sherlock",
      userRating: 6.5,
      eloRating: 650,
      score: 9.1,
      voteCount: 67000,
      poster_path: "/7WTsnHkbA0FaG5jcbMakfKoOLWP.jpg",
      poster: "/7WTsnHkbA0FaG5jcbMakfKoOLWP.jpg",
      first_air_date: "2010-07-25",
      release_year: 2010,
      genre_ids: [80, 18, 9648], // Crime, Drama, Mystery
      overview: "A modern update finds the famous sleuth and his doctor partner solving crime in 21st century London.",
      comparisonHistory: [],
      comparisonWins: 0,
      gamesPlayed: 2,
      adult: false,
      isOnboarded: true,
      mediaType: 'tv'
    },
    {
      id: 1429,
      title: "The Office",
      name: "The Office",
      userRating: 6.2,
      eloRating: 620,
      score: 8.8,
      voteCount: 78000,
      poster_path: "/7DJKHzAi83BmQrWLrYYOqcoKfhR.jpg",
      poster: "/7DJKHzAi83BmQrWLrYYOqcoKfhR.jpg",
      first_air_date: "2005-03-24",
      release_year: 2005,
      genre_ids: [35], // Comedy
      overview: "The everyday lives of office employees in the Scranton, Pennsylvania branch of the fictional Dunder Mifflin Paper Company.",
      comparisonHistory: [],
      comparisonWins: 0,
      gamesPlayed: 1,
      adult: false,
      isOnboarded: true,
      mediaType: 'tv'
    }
  ],
  
  // Mock user data for development
  DEV_USER: {
    id: 'dev_user_123',
    name: 'Dev User',
    email: 'dev@wuvo.app',
    provider: 'dev'
  }
};

// Helper functions
export const isDevModeEnabled = () => {
  return DEV_CONFIG.ENABLE_DEV_MODE;
};

export const getDevMovies = () => {
  return DEV_CONFIG.DEV_MOVIES;
};

export const getDevTVShows = () => {
  return DEV_CONFIG.DEV_TV_SHOWS;
};

export const getDevUser = () => {
  return DEV_CONFIG.DEV_USER;
};

export default DEV_CONFIG;