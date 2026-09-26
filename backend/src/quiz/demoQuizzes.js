// Hand-checked quizzes for the free demo. No AI call, no credits.
// Questions use stable, widely documented facts and avoid "trick" wording.
// Format mirrors AI output: the correct answer plus three wrong answers.
// Choices are shuffled per room.

const DEMO_QUIZZES = [
  {
    id: 'warm-up',
    title: 'Quick warm-up',
    description: 'General knowledge that most groups can have a go at.',
    language: 'English',
    questions: [
      ['Which planet is known as the Red Planet?', 'Mars', ['Venus', 'Jupiter', 'Mercury']],
      ['How many sides does a hexagon have?', '6', ['5', '7', '8']],
      ['Which is the largest ocean on Earth by area?', 'Pacific Ocean', ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean']],
      ['What is the chemical symbol for gold?', 'Au', ['Ag', 'Gd', 'Go']],
      ['A standard modern piano has how many keys?', '88', ['76', '92', '100']],
      ['In which city is the Colosseum?', 'Rome', ['Athens', 'Istanbul', 'Naples']],
      ['At sea level, water freezes at what temperature in degrees Celsius?', '0 °C', ['32 °C', '-10 °C', '4 °C']],
      ['What is the largest animal living today?', 'Blue whale', ['African elephant', 'Sperm whale', 'Whale shark']],
      ['Who painted the Mona Lisa?', 'Leonardo da Vinci', ['Michelangelo', 'Raphael', 'Rembrandt']],
      ['How many minutes are there in one day?', '1,440', ['1,240', '1,600', '2,400']],
    ],
  },
  {
    id: 'space',
    title: 'Space',
    description: 'Planets, stars and the people who went to look.',
    language: 'English',
    questions: [
      ['Which star is closest to Earth?', 'The Sun', ['Proxima Centauri', 'Sirius', 'Polaris']],
      ['Which planet has the most visible ring system?', 'Saturn', ['Jupiter', 'Uranus', 'Neptune']],
      ['Who was the first person to walk on the Moon?', 'Neil Armstrong', ['Buzz Aldrin', 'Yuri Gagarin', 'Michael Collins']],
      ['What is the name of the galaxy that contains our Solar System?', 'The Milky Way', ['Andromeda', 'Triangulum', 'Whirlpool']],
      ['Which is the smallest planet in our Solar System?', 'Mercury', ['Mars', 'Venus', 'Uranus']],
      ['Roughly how long does sunlight take to reach Earth?', 'About 8 minutes', ['About 8 seconds', 'About 8 hours', 'About 1 minute']],
      ['Which planet has the hottest average surface temperature?', 'Venus', ['Mercury', 'Mars', 'Jupiter']],
      ['What was the first artificial satellite put into orbit around Earth?', 'Sputnik 1', ['Explorer 1', 'Vostok 1', 'Apollo 1']],
      ['A space rock that survives its fall and lands on Earth is called a…', 'Meteorite', ['Comet', 'Nebula', 'Quasar']],
      ['How many planets are officially in our Solar System?', '8', ['7', '9', '10']],
    ],
  },
  {
    id: 'food',
    title: 'Food around the world',
    description: 'Dishes, ingredients and where they come from.',
    language: 'English',
    questions: [
      ['Guacamole is made mainly from which fruit?', 'Avocado', ['Lime', 'Mango', 'Tomato']],
      ['What is the main ingredient of hummus?', 'Chickpeas', ['Lentils', 'Peanuts', 'White beans']],
      ['Paella is a traditional dish from which country?', 'Spain', ['Italy', 'Portugal', 'Mexico']],
      ['Risotto is traditionally made with which grain?', 'Rice', ['Barley', 'Millet', 'Oats']],
      ['Which spice comes from the dried stigmas of a crocus flower?', 'Saffron', ['Turmeric', 'Cardamom', 'Paprika']],
      ['Traditional feta cheese is made mostly from which milk?', 'Sheep’s milk', ['Cow’s milk', 'Buffalo milk', 'Camel milk']],
      ['Pierogi are dumplings closely associated with which country?', 'Poland', ['Hungary', 'Greece', 'Portugal']],
      ['What is tofu made from?', 'Soybeans', ['Rice', 'Chickpeas', 'Peanuts']],
      ['Pho is a noodle soup from which country?', 'Vietnam', ['Thailand', 'Japan', 'Philippines']],
      ['Kimchi, made from fermented vegetables, is a staple of which cuisine?', 'Korean', ['Japanese', 'Chinese', 'Vietnamese']],
    ],
  },
  {
    id: 'eesti',
    title: 'Eesti ja maailm',
    description: 'Lühike üldteadmiste mäng eesti keeles.',
    language: 'Estonian',
    questions: [
      ['Mis on Eesti pealinn?', 'Tallinn', ['Tartu', 'Pärnu', 'Narva']],
      ['Mis värvid on Eesti lipul?', 'Sinine, must ja valge', ['Sinine, kollane ja valge', 'Punane, valge ja sinine', 'Roheline, must ja valge']],
      ['Mis on Eesti suurim saar?', 'Saaremaa', ['Hiiumaa', 'Muhu', 'Vormsi']],
      ['Mitu külge on kolmnurgal?', '3', ['4', '5', '6']],
      ['Milline planeet on Päikesele kõige lähemal?', 'Merkuur', ['Veenus', 'Maa', 'Marss']],
      ['Mitu päeva on liigaastas?', '366', ['365', '364', '360']],
      ['Mis on vee keemiline valem?', 'H2O', ['CO2', 'O2', 'NaCl']],
      ['Milline on maailma suurim ookean?', 'Vaikne ookean', ['Atlandi ookean', 'India ookean', 'Põhja-Jäämeri']],
      ['Kes maalis „Mona Lisa“?', 'Leonardo da Vinci', ['Michelangelo', 'Raffael', 'Rembrandt']],
      ['Milline loom on maailma suurim imetaja?', 'Sinivaal', ['Aafrika elevant', 'Kaelkirjak', 'Kašelott']],
    ],
  },
];

const DEMO_QUIZ_IDS = DEMO_QUIZZES.map((quiz) => quiz.id);

function listDemoQuizzes() {
  return DEMO_QUIZZES.map(({ id, title, description, language, questions }) => ({
    id,
    title,
    description,
    language,
    questionCount: questions.length,
  }));
}

function getDemoQuiz(id) {
  const quiz = DEMO_QUIZZES.find((item) => item.id === id);
  if (!quiz) {
    return null;
  }
  return {
    id: quiz.id,
    topic: quiz.title,
    language: quiz.language,
    questions: quiz.questions.map(([question, correctAnswer, wrongAnswers]) => ({ question, correctAnswer, wrongAnswers })),
  };
}

module.exports = { DEMO_QUIZ_IDS, listDemoQuizzes, getDemoQuiz };
