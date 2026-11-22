import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../models/User.js';
import { asyncRoute } from '../middleware/errors.js';
import { collusionReport } from '../services/consensusService.js';
import { respondentLabel } from '../utils/respondent.js';

const router = express.Router();
const adminOnly = [requireAuth, requireRole(ROLES.ADMIN)];

router.get(
  '/exams/:examId/integrity',
  adminOnly,
  asyncRoute(async (req, res) => {
    const options = {};
    const rareAnswerThreshold = Number(req.query.rareAnswerThreshold);
    if (Number.isFinite(rareAnswerThreshold) && rareAnswerThreshold > 0 && rareAnswerThreshold < 1) {
      options.rareAnswerThreshold = rareAnswerThreshold;
    }
    const rareMatchThreshold = Number(req.query.rareMatchThreshold);
    if (Number.isFinite(rareMatchThreshold) && rareMatchThreshold >= 0) {
      options.rareMatchThreshold = Math.round(rareMatchThreshold);
    }
    const minClusterSize = Number(req.query.minClusterSize);
    if (Number.isFinite(minClusterSize) && minClusterSize >= 2) {
      options.minClusterSize = Math.round(minClusterSize);
    }

    const report = await collusionReport(req.params.examId, options);

    res.json({
      examId: req.params.examId,
      totalRespondents: report.totalRespondents,
      rareAnswerCount: report.rareAnswerCount,
      calibration: report.calibration,
      params: report.params,
      identicalGroups: report.identicalGroups.map((group) => ({
        ...group,
        labels: group.respondentIds.map(respondentLabel)
      })),
      clusters: report.clusters.map((cluster) => ({
        ...cluster,
        labels: cluster.respondentIds.map(respondentLabel)
      })),
      suspiciousPairs: report.suspiciousPairs.slice(0, 100).map((pair) => ({
        ...pair,
        labelA: respondentLabel(pair.a),
        labelB: respondentLabel(pair.b)
      })),
      suspiciousPairCount: report.suspiciousPairs.length
    });
  })
);

export default router;
