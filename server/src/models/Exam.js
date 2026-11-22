import mongoose from 'mongoose';

export const EXAM_STATUS = { OPEN: 'OPEN', CLOSED: 'CLOSED', COMPUTED: 'COMPUTED' };

const examSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    courseCode: { type: String, required: true, trim: true, maxlength: 40 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    questionCount: { type: Number, required: true, min: 1, max: 500 },
    opensAt: { type: Date, default: Date.now },
    closesAt: { type: Date, required: true },
    status: { type: String, enum: Object.values(EXAM_STATUS), default: EXAM_STATUS.OPEN },
    markingScheme: {
      correctMarks: { type: Number, default: 1 },
      negativeMarks: { type: Number, default: 0 }
    },
    disputeThreshold: { type: Number, default: 0.85, min: 0, max: 1 },
    collectPredictions: { type: Boolean, default: true },
    isSimulated: { type: Boolean, default: false }
  },
  { timestamps: true }
);

examSchema.methods.isAcceptingSubmissions = function isAcceptingSubmissions(now = new Date()) {
  if (this.status !== EXAM_STATUS.OPEN) return false;
  if (this.opensAt && now < this.opensAt) return false;
  if (this.closesAt && now > this.closesAt) return false;
  return true;
};

examSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    title: this.title,
    subject: this.subject,
    courseCode: this.courseCode,
    questionCount: this.questionCount,
    opensAt: this.opensAt,
    closesAt: this.closesAt,
    status: this.status,
    markingScheme: {
      correctMarks: this.markingScheme?.correctMarks ?? 1,
      negativeMarks: this.markingScheme?.negativeMarks ?? 0
    },
    disputeThreshold: this.disputeThreshold,
    collectPredictions: this.collectPredictions,
    isSimulated: this.isSimulated,
    acceptingSubmissions: this.isAcceptingSubmissions(),
    createdAt: this.createdAt
  };
};

export const Exam = mongoose.model('Exam', examSchema);
export default Exam;
