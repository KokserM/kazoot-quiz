function registerSocketHandlers(io, gameService) {
  io.on('connection', (socket) => {
    if (socket.recovered) {
      gameService.handleRecoveredConnection(socket);
    }

    socket.on(
      'join-game',
      gameService.wrapSocketHandler(socket, async (payload) => {
        gameService.joinSession(socket, payload);
      })
    );

    socket.on(
      'start-game',
      gameService.wrapSocketHandler(socket, async () => {
        gameService.startGame(socket.id);
      })
    );

    socket.on(
      'submit-answer',
      gameService.wrapSocketHandler(socket, async (payload) => {
        const result = gameService.submitAnswer(socket.id, payload);
        socket.emit('answer-submitted', result);
      })
    );

    socket.on(
      'next-question',
      gameService.wrapSocketHandler(socket, async () => {
        gameService.advance(socket.id);
      })
    );

    socket.on('disconnect', () => {
      gameService.handleDisconnect(socket.id);
    });
  });
}

module.exports = {
  registerSocketHandlers,
};
