import mongoose from 'mongoose';

const officialKeySchema = new mongoose.Schema(
  {
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, unique: true },
    answers: [
      {
        _id: false,
        questionNumber: { type: Number, required: true },
        answer: { type: String, required: true }
      }
    ],
    source: { type: String, trim: true, default: 'MANUAL_UPLOAD' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const OfficialKey = mongoose.model('OfficialKey', officialKeySchema);
export default OfficialKey;
