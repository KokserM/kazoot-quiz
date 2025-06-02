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

const Fireworks = styled(motion.div)`
  position: absolute;
  font-size: 3rem;
  user-select: none;
  pointer-events: none;
  z-index: 10;
`;

const FireworksAnimation = () => {
  const fireworkItems = ['🎆', '🎇', '✨', '💥', '🌟'];
  
  return (
    <>
      {Array.from({ length: 15 }, (_, i) => (
        <Fireworks
          key={i}
          initial={{
            x: Math.random() * 800,
            y: Math.random() * 600,
            scale: 0,
            rotate: 0,
            opacity: 1
          }}
          animate={{
            scale: [0, 1.5, 0],
            rotate: 360,
            opacity: [1, 1, 0]
          }}
          transition={{
            duration: 2,
            delay: Math.random() * 3,
            repeat: Infinity,
            repeatDelay: 3 + Math.random() * 2
          }}
        >
          {fireworkItems[Math.floor(Math.random() * fireworkItems.length)]}
        </Fireworks>
      ))}
    </>
  );
};

const GameEnd = ({ gameEndData, onPlayAgain }) => {
  if (!gameEndData || !gameEndData.leaderboard) return null;

  const { leaderboard } = gameEndData;
  const topThree = leaderboard.slice(0, 3);
  const restOfPlayers = leaderboard.slice(3);

  return (
    <Container
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5 }}
    >
      <FireworksAnimation />
      
      <Title
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        🏆 Game Complete!
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
                <PlayerName>{player.username}</PlayerName>
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
                {['🥇', '🥈', '🥉'][player.rank - 1] || player.rank}
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
                <PlayerName>{player.username}</PlayerName>
              </RankInfo>
              <PlayerScore>{player.score.toLocaleString()} pts</PlayerScore>
            </LeaderboardItem>
          ))}
        </RestOfLeaderboard>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        style={{
          fontSize: '1.2rem',
          color: '#666',
          marginBottom: '30px',
          fontStyle: 'italic'
        }}
      >
        Thanks for playing Kazoot! 🎮
      </motion.div>

      <Button
        onClick={onPlayAgain}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.2 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        🎮 Play Again
      </Button>
    </Container>
  );
};

export default GameEnd; 