import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema(
  {
    _id: false,
    questionNumber: { type: Number, required: true },
    answer: { type: String, required: true, trim: true, maxlength: 400 },
    predictedMajority: { type: String, trim: true, maxlength: 400 },
    confidence: { type: Number, min: 1, max: 5 }
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    respondentId: { type: String, required: true, index: true },
    answers: { type: [answerSchema], default: [] },
    submittedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

submissionSchema.index({ examId: 1, userId: 1 }, { unique: true });
submissionSchema.index({ examId: 1, respondentId: 1 }, { unique: true });

submissionSchema.methods.toAnonymous = function toAnonymous() {
  return {
    respondentId: this.respondentId,
    examId: this.examId.toString(),
    answers: this.answers.map((a) => ({
      questionNumber: a.questionNumber,
      answer: a.answer,
      predictedMajority: a.predictedMajority,
      confidence: a.confidence
    })),
    submittedAt: this.submittedAt
  };
};

export const Submission = mongoose.model('Submission', submissionSchema);
export default Submission;
