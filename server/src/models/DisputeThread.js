import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    respondentId: { type: String, required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    votes: { type: Number, default: 0 },
    voters: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const disputeThreadSchema = new mongoose.Schema(
  {
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    questionNumber: { type: Number, required: true },
    posts: { type: [postSchema], default: [] }
  },
  { timestamps: true }
);

disputeThreadSchema.index({ examId: 1, questionNumber: 1 }, { unique: true });

disputeThreadSchema.methods.toPublic = function toPublic(viewerRespondentId) {
  return {
    id: this._id.toString(),
    examId: this.examId.toString(),
    questionNumber: this.questionNumber,
    posts: this.posts.map((post) => ({
      id: post._id.toString(),
      respondentId: post.respondentId,
      body: post.body,
      votes: post.votes,
      createdAt: post.createdAt,
      isMine: viewerRespondentId ? post.respondentId === viewerRespondentId : false,
      hasVoted: viewerRespondentId ? post.voters.includes(viewerRespondentId) : false
    }))
  };
};

export const DisputeThread = mongoose.model('DisputeThread', disputeThreadSchema);
export default DisputeThread;
