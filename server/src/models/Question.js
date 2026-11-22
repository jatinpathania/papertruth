import mongoose from 'mongoose';

export const QUESTION_TYPES = { MCQ: 'MCQ', SHORT: 'SHORT' };

const questionSchema = new mongoose.Schema(
  {
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    number: { type: Number, required: true, min: 1 },
    text: { type: String, trim: true, default: '' },
    type: { type: String, enum: Object.values(QUESTION_TYPES), default: QUESTION_TYPES.MCQ },
    options: { type: [String], default: undefined },
    topic: { type: String, trim: true, default: 'General' }
  },
  { timestamps: true }
);

questionSchema.index({ examId: 1, number: 1 }, { unique: true });

export const Question = mongoose.model('Question', questionSchema);
export default Question;
