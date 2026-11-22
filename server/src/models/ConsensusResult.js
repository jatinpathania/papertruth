import mongoose from 'mongoose';

export const CONSENSUS_METHODS = {
  MAJORITY: 'MAJORITY',
  WEIGHTED_EM: 'WEIGHTED_EM',
  SURPRISINGLY_POPULAR: 'SURPRISINGLY_POPULAR'
};

const perQuestionSchema = new mongoose.Schema(
  {
    _id: false,
    questionNumber: { type: Number, required: true },
    topic: String,
    consensusAnswer: { type: String, default: null },
    confidence: { type: Number, default: 0 },
    rawAgreement: { type: Number, default: 0 },
    entropy: { type: Number, default: 0 },
    normalisedEntropy: { type: Number, default: 0 },
    margin: { type: Number, default: 0 },
    totalResponses: { type: Number, default: 0 },
    distribution: { type: mongoose.Schema.Types.Mixed, default: {} },
    optionScores: { type: mongoose.Schema.Types.Mixed, default: {} },
    disputed: { type: Boolean, default: false },
    disputeReasons: { type: [String], default: [] },
    overturnsMajority: { type: Boolean, default: false },
    actual: { type: mongoose.Schema.Types.Mixed },
    predicted: { type: mongoose.Schema.Types.Mixed },
    spScores: { type: mongoose.Schema.Types.Mixed },
    predictionDistribution: { type: mongoose.Schema.Types.Mixed }
  },
  { _id: false }
);

const consensusResultSchema = new mongoose.Schema(
  {
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    method: { type: String, enum: Object.values(CONSENSUS_METHODS), required: true },
    computedAt: { type: Date, default: Date.now },
    respondentCount: { type: Number, default: 0 },
    iterations: { type: Number, default: 1 },
    converged: { type: Boolean, default: true },
    perQuestion: { type: [perQuestionSchema], default: [] },
    respondentWeights: [
      {
        _id: false,
        respondentId: { type: String, required: true },
        weight: { type: Number, required: true },
        answered: { type: Number, default: 0 }
      }
    ],
    summary: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

consensusResultSchema.index({ examId: 1, method: 1 }, { unique: true });

export const ConsensusResult = mongoose.model('ConsensusResult', consensusResultSchema);
export default ConsensusResult;
