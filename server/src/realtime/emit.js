// No socket.io import here on purpose: routes emit through an optional `io`,
// so the serverless bundle never has to pull the realtime server in.
export function emitSubmissionReceived(io, examId, payload) {
  io?.to(`exam:${examId}`).emit('submission:received', { examId, ...payload });
}

export default emitSubmissionReceived;
