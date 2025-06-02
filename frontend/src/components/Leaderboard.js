import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const Container = styled(motion.div)`
  display: flex;
  flex-direction: column;
  padding: 40px;
  min-height: 600px;
  text-align: center;
`;

const Title = styled(motion.h1)`
  font-size: 3rem;
  font-weight: bold;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 40px;
`;

const PodiumContainer = styled(motion.div)`
  display: flex;
  justify-content: center;
  align-items: end;
  margin-bottom: 40px;
  gap: 20px;
  flex-wrap: wrap;
`;

const PodiumPosition = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-items: center;
  order: ${props => props.position === 2 ? 1 : props.position === 1 ? 2 : 3};
`;

const PodiumStep = styled(motion.div)`
  width: 120px;
  height: ${props => props.position === 1 ? '120px' : props.position === 2 ? '100px' : '80px'};
  background: ${props => {
    if (props.position === 1) return 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)';
    if (props.position === 2) return 'linear-gradient(135deg, #C0C0C0 0%, #A9A9A9 100%)';
    return 'linear-gradient(135deg, #CD7F32 0%, #B8860B 100%)';
  }};
  border-radius: 10px 10px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: bold;
  color: white;
  margin-top: ${props => props.position === 1 ? '0px' : props.position === 2 ? '20px' : '40px'};
`;

const PodiumPlayer = styled(motion.div)`
  background: white;
  padding: 15px;
  border-radius: 15px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  margin-bottom: 10px;
  min-width: 120px;
`;

const PlayerName = styled.div`
  font-weight: bold;
  font-size: 1.1rem;
  color: #333;
  margin-bottom: 5px;
`;

const PlayerScore = styled.div`
  font-size: 1.2rem;
  font-weight: bold;
  color: #667eea;
`;

const RestOfLeaderboard = styled(motion.div)`
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
  border-radius: 20px;
  padding: 30px;
  margin-bottom: 30px;
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
`;

const RankInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
`;

const RankNumber = styled.div`
  width: 35px;
  height: 35px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
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

const Confetti = styled(motion.div)`
  position: absolute;
  font-size: 2rem;
  user-select: none;
  pointer-events: none;
`;

const ConfettiAnimation = () => {
  const confettiItems = ['🎉', '🎊', '✨', '🌟', '💫'];
  
  return (
    <>
      {Array.from({ length: 20 }, (_, i) => (
        <Confetti
          key={i}
          initial={{
            x: Math.random() * window.innerWidth,
            y: -50,
            rotate: 0,
            opacity: 1
          }}
          animate={{
            y: window.innerHeight + 50,
            rotate: 360,
            opacity: 0
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            delay: Math.random() * 2,
            repeat: Infinity,
            repeatDelay: 5
          }}
        >
          {confettiItems[Math.floor(Math.random() * confettiItems.length)]}
        </Confetti>
      ))}
    </>
  );
};

const Leaderboard = ({ leaderboard, onPlayAgain }) => {
  if (!leaderboard || leaderboard.length === 0) return null;

  const topThree = leaderboard.slice(0, 3);
  const restOfPlayers = leaderboard.slice(3);

  return (
    <Container
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5 }}
    >
      <ConfettiAnimation />
      
      <Title
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        🏆 Final Results
      </Title>

      {topThree.length > 0 && (
        <PodiumContainer
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {topThree.map((player, index) => (
            <PodiumPosition key={player.username} position={player.rank}>
              <PodiumPlayer
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + index * 0.2 }}
              >
                <PlayerName>{player.username || `Player ${player.rank}`}</PlayerName>
                <PlayerScore>{player.score.toLocaleString()}</PlayerScore>
              </PodiumPlayer>
              
              <PodiumStep
                position={player.rank}
                initial={{ height: 0 }}
                animate={{ 
                  height: player.rank === 1 ? '120px' : player.rank === 2 ? '100px' : '80px'
                }}
                transition={{ delay: 0.8 + index * 0.2, duration: 0.5 }}
              >
                {player.rank}
              </PodiumStep>
            </PodiumPosition>
          ))}
        </PodiumContainer>
      )}

      {restOfPlayers.length > 0 && (
        <RestOfLeaderboard
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
        >
          {restOfPlayers.map((player, index) => (
            <LeaderboardItem
              key={player.username}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.4 + index * 0.1 }}
            >
              <RankInfo>
                <RankNumber>{player.rank}</RankNumber>
                <PlayerName>{player.username || `Player ${player.rank}`}</PlayerName>
              </RankInfo>
              <PlayerScore>{player.score.toLocaleString()} pts</PlayerScore>
            </LeaderboardItem>
          ))}
        </RestOfLeaderboard>
      )}

      <Button
        onClick={onPlayAgain}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        🎮 Play Again
      </Button>
    </Container>
  );
};

export default Leaderboard; 