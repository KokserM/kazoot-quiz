// Demo questions for testing without OpenAI API
const demoQuestions = {
  "90s Movies": {
    "topic": "90s Movies",
    "questions": [
      {
        "question": "Which movie features the famous line 'Life is like a box of chocolates'?",
        "choices": ["Forrest Gump", "Titanic", "The Lion King", "Jurassic Park"],
        "correctAnswerIndex": 0
      },
      {
        "question": "In which 1990s movie did Leonardo DiCaprio NOT appear?",
        "choices": ["Romeo + Juliet", "Titanic", "The Matrix", "What's Eating Gilbert Grape"],
        "correctAnswerIndex": 2
      },
      {
        "question": "What was the highest-grossing film of the 1990s?",
        "choices": ["Jurassic Park", "Titanic", "The Lion King", "Home Alone"],
        "correctAnswerIndex": 1
      },
      {
        "question": "Which Disney movie featured the song 'A Whole New World'?",
        "choices": ["The Lion King", "Aladdin", "Beauty and the Beast", "The Little Mermaid"],
        "correctAnswerIndex": 1
      },
      {
        "question": "Who directed the movie 'Pulp Fiction' (1994)?",
        "choices": ["Steven Spielberg", "Martin Scorsese", "Quentin Tarantino", "Tim Burton"],
        "correctAnswerIndex": 2
      },
      {
        "question": "In 'The Sixth Sense', what does the boy see?",
        "choices": ["Aliens", "Dead people", "The future", "Ghosts"],
        "correctAnswerIndex": 1
      },
      {
        "question": "Which movie popularized the phrase 'Show me the money!'?",
        "choices": ["Jerry Maguire", "Wall Street", "Boiler Room", "The Wolf of Wall Street"],
        "correctAnswerIndex": 0
      },
      {
        "question": "What was the name of the ship in Titanic?",
        "choices": ["RMS Titanic", "HMS Titanic", "SS Titanic", "USS Titanic"],
        "correctAnswerIndex": 0
      },
      {
        "question": "Which actor played the Terminator in Terminator 2: Judgment Day?",
        "choices": ["Sylvester Stallone", "Arnold Schwarzenegger", "Bruce Willis", "Jean-Claude Van Damme"],
        "correctAnswerIndex": 1
      },
      {
        "question": "In 'Home Alone', where is the family going on vacation?",
        "choices": ["Hawaii", "Florida", "Paris", "New York"],
        "correctAnswerIndex": 2
      }
    ]
  },
  "Space & Astronomy": {
    "topic": "Space & Astronomy",
    "questions": [
      {
        "question": "What is the largest planet in our solar system?",
        "choices": ["Saturn", "Jupiter", "Neptune", "Uranus"],
        "correctAnswerIndex": 1
      },
      {
        "question": "How many moons does Earth have?",
        "choices": ["0", "1", "2", "3"],
        "correctAnswerIndex": 1
      },
      {
        "question": "What is the closest star to Earth?",
        "choices": ["Alpha Centauri", "Sirius", "The Sun", "Proxima Centauri"],
        "correctAnswerIndex": 2
      },
      {
        "question": "Which planet is known as the 'Red Planet'?",
        "choices": ["Venus", "Mars", "Mercury", "Jupiter"],
        "correctAnswerIndex": 1
      },
      {
        "question": "What is the name of the galaxy we live in?",
        "choices": ["Andromeda", "Milky Way", "Whirlpool", "Sombrero"],
        "correctAnswerIndex": 1
      },
      {
        "question": "How long does it take for light from the Sun to reach Earth?",
        "choices": ["8 minutes", "1 hour", "1 day", "1 second"],
        "correctAnswerIndex": 0
      },
      {
        "question": "What is the hottest planet in our solar system?",
        "choices": ["Mercury", "Venus", "Mars", "Jupiter"],
        "correctAnswerIndex": 1
      },
      {
        "question": "Which planet has the most moons?",
        "choices": ["Jupiter", "Saturn", "Neptune", "Uranus"],
        "correctAnswerIndex": 1
      },
      {
        "question": "What is a group of stars called?",
        "choices": ["Galaxy", "Constellation", "Nebula", "Solar System"],
        "correctAnswerIndex": 1
      },
      {
        "question": "What was the first artificial satellite launched into space?",
        "choices": ["Explorer 1", "Sputnik 1", "Vanguard 1", "Luna 1"],
        "correctAnswerIndex": 1
      }
    ]
  },
  "Video Games": {
    "topic": "Video Games",
    "questions": [
      {
        "question": "Which company created the Super Mario series?",
        "choices": ["Sony", "Nintendo", "Microsoft", "Sega"],
        "correctAnswerIndex": 1
      },
      {
        "question": "In which year was the original Pac-Man released?",
        "choices": ["1978", "1980", "1982", "1984"],
        "correctAnswerIndex": 1
      },
      {
        "question": "What is the best-selling video game of all time?",
        "choices": ["Tetris", "Minecraft", "Grand Theft Auto V", "Super Mario Bros."],
        "correctAnswerIndex": 1
      },
      {
        "question": "Which character is the main protagonist in The Legend of Zelda series?",
        "choices": ["Zelda", "Link", "Ganondorf", "Epona"],
        "correctAnswerIndex": 1
      },
      {
        "question": "What does 'RPG' stand for in gaming?",
        "choices": ["Real Player Game", "Role Playing Game", "Random Player Generator", "Rapid Pace Gaming"],
        "correctAnswerIndex": 1
      },
      {
        "question": "Which gaming console was released first?",
        "choices": ["PlayStation", "Nintendo 64", "Sega Saturn", "Atari 2600"],
        "correctAnswerIndex": 3
      },
      {
        "question": "In Pokémon, what type is Pikachu?",
        "choices": ["Fire", "Water", "Electric", "Grass"],
        "correctAnswerIndex": 2
      },
      {
        "question": "Which game popularized the battle royale genre?",
        "choices": ["Fortnite", "PUBG", "Apex Legends", "Call of Duty: Warzone"],
        "correctAnswerIndex": 1
      },
      {
        "question": "What is the maximum level in the original Pac-Man?",
        "choices": ["Level 255", "Level 256", "Level 300", "There is no maximum"],
        "correctAnswerIndex": 1
      },
      {
        "question": "Which company developed Minecraft?",
        "choices": ["Microsoft", "Mojang", "Epic Games", "Valve"],
        "correctAnswerIndex": 1
      }
    ]
  }
};

module.exports = demoQuestions; 