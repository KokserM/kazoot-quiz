import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const Container = styled(motion.div)`
  display: flex;
  flex-direction: column;
  padding: 30px;
  min-height: 600px;
`;

const Header = styled(motion.div)`
  text-align: center;
  margin-bottom: 30px;
`;

const Title = styled(motion.h1)`
  font-size: 2.5rem;
  color: #333;
  margin-bottom: 10px;
`;

const CorrectAnswer = styled(motion.div)`
  background: linear-gradient(135deg, #4ecdc4 0%, #26a69a 100%);
  color: white;
  padding: 20px;
  border-radius: 15px;
  font-size: 1.3rem;
  font-weight: bold;
  text-align: center;
  margin-bottom: 30px;
`;

const StatsContainer = styled(motion.div)`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
`;

const StatCard = styled(motion.div)`
  background: white;
  border: 3px solid ${props => {
    if (props.isPlayerChoice && props.isCorrect) return '#4ecdc4'; // Player chose correct answer
    if (props.isPlayerChoice && !props.isCorrect) return '#ff6b6b'; // Player chose wrong answer
    if (props.isCorrect) return '#26a69a'; // Correct answer (not chosen by player)
    return props.color || '#e0e0e0'; // Default
  }};
  border-radius: 15px;
  padding: 20px;
  text-align: center;
  box-shadow: ${props => props.isPlayerChoice ? '0 8px 25px rgba(0, 0, 0, 0.2)' : '0 5px 15px rgba(0, 0, 0, 0.1)'};
  transform: ${props => props.isPlayerChoice ? 'scale(1.05)' : 'scale(1)'};
  position: relative;
`;

const PlayerChoiceIndicator = styled.div`
  position: absolute;
  top: -12px;
  right: -12px;
  background: ${props => props.isCorrect ? '#4ecdc4' : '#ff6b6b'};
  color: white;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  font-weight: bold;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
  border: 2px solid white;
`;

const StatLabel = styled.div`
  font-size: 1rem;
  color: ${props => {
    if (props.isPlayerChoice && props.isCorrect) return '#4ecdc4';
    if (props.isPlayerChoice && !props.isCorrect) return '#ff6b6b';
    if (props.isCorrect) return '#26a69a';
    return '#666';
  }};
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: ${props => props.isPlayerChoice ? 'bold' : 'normal'};
`;

const AnswerText = styled.div`
  font-size: 0.95rem;
  color: ${props => {
    if (props.isPlayerChoice && props.isCorrect) return '#4ecdc4';
    if (props.isPlayerChoice && !props.isCorrect) return '#ff6b6b';
    if (props.isCorrect) return '#26a69a';
    return '#333';
  }};
  margin-bottom: 10px;
  line-height: 1.3;
  font-weight: ${props => props.isPlayerChoice ? 'bold' : 'normal'};
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StatValue = styled.div`
  font-size: 2rem;
  font-weight: bold;
  color: ${props => props.color || '#333'};
`;

const LeaderboardContainer = styled(motion.div)`
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
  border-radius: 20px;
  padding: 30px;
  margin-bottom: 30px;
`;

const LeaderboardTitle = styled.h3`
  font-size: 1.5rem;
  color: #333;
  margin-bottom: 20px;
  text-align: center;
`;

const LeaderboardItem = styled(motion.div)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 20px;
  margin: 10px 0;
  background: white;
  border-radius: 15px;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
  border-left: 5px solid ${props => {
    if (props.rank === 1) return '#FFD700';
    if (props.rank === 2) return '#C0C0C0';
    if (props.rank === 3) return '#CD7F32';
    return '#667eea';
  }};
`;

const PlayerInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
`;

const RankBadge = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  color: white;
  background: ${props => {
    if (props.rank === 1) return 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)';
    if (props.rank === 2) return 'linear-gradient(135deg, #C0C0C0 0%, #A9A9A9 100%)';
    if (props.rank === 3) return 'linear-gradient(135deg, #CD7F32 0%, #B8860B 100%)';
    return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  }};
`;

const PlayerName = styled.div`
  font-weight: bold;
  font-size: 1.1rem;
  color: #333;
`;

const Score = styled.div`
  font-weight: bold;
  font-size: 1.2rem;
  color: #667eea;
`;

const Button = styled(motion.button)`
  padding: 15px 40px;
  font-size: 1.2rem;
  font-weight: bold;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
  margin: 0 auto;
  display: block;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  }
`;

const CelebrationEmoji = styled(motion.div)`
  font-size: 4rem;
  text-align: center;
  margin: 20px 0;
`;

const WaitingMessage = styled(motion.div)`
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 152, 0, 0.1) 100%);
  padding: 20px;
  border-radius: 15px;
  margin: 20px 0;
  border: 1px solid rgba(255, 193, 7, 0.3);
  color: #ff9800;
  font-size: 1.1rem;
  text-align: center;
`;

const Results = ({ questionResults, onNextQuestion, isAdmin = false }) => {
  if (!questionResults) return null;

  const { correctAnswer, correctAnswerText, answerStats, leaderboard, isLastQuestion, playerAnswer, allChoices } = questionResults;

  const answerLabels = ['A', 'B', 'C', 'D'];
  const answerColors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a8e6cf'];

  const totalAnswers = answerStats.reduce((sum, count) => sum + count, 0);

  return (
    <Container
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5 }}
    >
      <Header>
        <CelebrationEmoji
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", bounce: 0.6 }}
        >
          🎉
        </CelebrationEmoji>
        
        <Title
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          Question Results
        </Title>
      </Header>

      <CorrectAnswer
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, type: "spring", bounce: 0.4 }}
      >
        ✅ Correct Answer: {answerLabels[correctAnswer]} - {correctAnswerText}
      </CorrectAnswer>

      <StatsContainer
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {answerStats.map((count, index) => {
          const isPlayerChoice = playerAnswer === index;
          const isCorrect = index === correctAnswer;
          const answerText = allChoices ? allChoices[index] : `Option ${answerLabels[index]}`;
          
          return (
            <StatCard
              key={index}
              color={answerColors[index]}
              isPlayerChoice={isPlayerChoice}
              isCorrect={isCorrect}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              whileHover={{ scale: isPlayerChoice ? 1.05 : 1.02 }}
            >
              {isPlayerChoice && (
                <PlayerChoiceIndicator isCorrect={isCorrect}>
                  {isCorrect ? '✓' : '✗'}
                </PlayerChoiceIndicator>
              )}
              
              <StatLabel 
                isPlayerChoice={isPlayerChoice}
                isCorrect={isCorrect}
              >
                {answerLabels[index]}
              </StatLabel>
              
              <AnswerText 
                isPlayerChoice={isPlayerChoice}
                isCorrect={isCorrect}
              >
                {answerText}
              </AnswerText>
              
              <StatValue color={answerColors[index]}>
                {totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0}%
              </StatValue>
              
              <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '5px' }}>
                {count} player{count !== 1 ? 's' : ''}
              </div>
            </StatCard>
          );
        })}
      </StatsContainer>

      <LeaderboardContainer
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <LeaderboardTitle>🏆 Current Leaderboard</LeaderboardTitle>
        {leaderboard.slice(0, 5).map((player, index) => (
          <LeaderboardItem
            key={player.username}
            rank={player.rank}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.9 + index * 0.1 }}
          >
            <PlayerInfo>
              <RankBadge rank={player.rank}>
                {player.rank <= 3 ? ['🥇', '🥈', '🥉'][player.rank - 1] : player.rank}
              </RankBadge>
              <PlayerName>{player.username || `Player ${player.rank}`}</PlayerName>
            </PlayerInfo>
            <Score>{player.score.toLocaleString()} pts</Score>
          </LeaderboardItem>
        ))}
      </LeaderboardContainer>

      {isAdmin ? (
        <Button
          onClick={onNextQuestion}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {isLastQuestion ? '🏁 View Final Results' : '➡️ Next Question'}
        </Button>
      ) : (
        <WaitingMessage
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
        >
          ⏳ Waiting for admin to {isLastQuestion ? 'view final results' : 'continue to next question'}...
        </WaitingMessage>
      )}
    </Container>
  );
};

export default Results; 