function registerSocketHandlers(io, gameService) {
  io.on('connection', (socket) => {
    const on = (eventName, handler) => socket.on(eventName, gameService.wrapSocketHandler(socket, handler));

    on('join-game', (payload) => {
      const joined = gameService.joinSession(socket, payload);
      return { sessionId: joined.session.sessionId, reconnected: Boolean(joined.reconnected) };
    });
    on('sync-state', () => gameService.syncState(socket));
    on('start-game', () => gameService.startGame(socket.id));
    on('submit-answer', (payload) => gameService.submitAnswer(socket.id, payload));
    on('next-question', (payload) => gameService.advance(socket.id, payload));
    on('leave-game', () => gameService.leaveSession(socket));

    socket.on('disconnect', () => {
      gameService.handleDisconnect(socket.id);
    });
  });
}

module.exports = {
  registerSocketHandlers,
};
