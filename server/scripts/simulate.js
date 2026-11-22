#!/usr/bin/env node

import mongoose from 'mongoose';
import { resolveConfig, env } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import {
  ConsensusResult,
  DisputeThread,
  Exam,
  OfficialKey,
  Question,
  Submission,
  User
} from '../src/models/index.js';
import { ROLES } from '../src/models/User.js';
import { EXAM_STATUS } from '../src/models/Exam.js';
import { generateCohort } from '../src/services/simulation/generateCohort.js';
import { buildMatrix } from '../src/services/consensus/matrix.js';
import { computeAndStoreConsensus } from '../src/services/consensusService.js';
import { compareMethods, keyToMap, methodAccuracy, METHODS } from '../src/services/consensus/validation.js';
import { runAllMethods } from '../src/services/consensus/validation.js';
import { respondentIdFor } from '../src/utils/respondent.js';
import { detectCollusion } from '../src/services/consensus/integrity.js';

const DEMO_ACCOUNTS = {
  admin: { name: 'Exam Cell Admin', email: 'admin@papertruth.com', password: 'admin123', role: ROLES.ADMIN },
  students: [
    { name: 'Aarav Sharma', email: 'aarav@student.papertruth.com', password: 'student123' },
    { name: 'Diya Nair', email: 'diya@student.papertruth.com', password: 'student123' },
    { name: 'Kabir Singh', email: 'kabir@student.papertruth.com', password: 'student123' },
    { name: 'Meera Iyer', email: 'meera@student.papertruth.com', password: 'student123' },
    { name: 'Rohan Das', email: 'rohan@student.papertruth.com', password: 'student123' }
  ]
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  resolveConfig();
  await connectDatabase();

  console.log('\n=== PaperTruth simulation seed ===');
  console.log(`database : ${mongoose.connection.name}`);
  console.log(`options  : respondents=${args.respondents} questions=${args.questions} seed=${args.seed}`);

  if (!args.keep) {
    const removed = await wipeSimulatedData();
    console.log(`cleanup  : removed ${removed.exams} simulated exam(s) and their data`);
  }

  const admin = await upsertUser(DEMO_ACCOUNTS.admin);
  const students = [];
  for (const student of DEMO_ACCOUNTS.students) {
    students.push(await upsertUser({ ...student, role: ROLES.STUDENT }));
  }
  console.log(`accounts : 1 admin + ${students.length} students ready`);

  const cohort = generateCohort({
    seed: args.seed,
    questionCount: args.questions,
    respondentCount: args.respondents + students.length
  });
  const simulatedRespondents = cohort.respondents.slice(0, args.respondents);
  const demoRespondents = cohort.respondents.slice(args.respondents);
  console.log(
    `cohort   : ${simulatedRespondents.length} simulated + ${demoRespondents.length} demo-account respondents, ability ` +
      `${cohort.abilityStats.min.toFixed(2)}–${cohort.abilityStats.max.toFixed(2)} ` +
      `(mean ${cohort.abilityStats.mean.toFixed(2)})`
  );
  console.log(`traps    : Q${cohort.trapQuestionNumbers.join(', Q')}`);
  console.log(`unclear  : Q${cohort.ambiguousQuestionNumbers.join(', Q')}`);

  const now = Date.now();
  const exam = await Exam.create({
    title: 'Data Structures & Algorithms — Sessional II',
    subject: 'Data Structures & Algorithms',
    courseCode: 'CS304',
    createdBy: admin._id,
    questionCount: cohort.questions.length,
    opensAt: new Date(now - 24 * 3600 * 1000),
    closesAt: new Date(now + 6 * 24 * 3600 * 1000),
    status: EXAM_STATUS.OPEN,
    markingScheme: { correctMarks: 2, negativeMarks: 0.5 },
    disputeThreshold: 0.85,
    collectPredictions: true,
    isSimulated: true
  });

  await Question.insertMany(
    cohort.questions.map((q) => ({
      examId: exam._id,
      number: q.number,
      text: q.text,
      type: q.type,
      options: q.options,
      topic: q.topic
    }))
  );
  console.log(`exam     : "${exam.title}" (${exam.questionCount} questions) id=${exam._id}`);

  const simulatedUserIds = simulatedRespondents.map(() => new mongoose.Types.ObjectId());
  const submissions = simulatedRespondents.map((respondent, index) => ({
    examId: exam._id,
    userId: simulatedUserIds[index],
    respondentId: respondent.respondentId,
    answers: respondent.answers.map((a) => ({
      questionNumber: a.questionNumber,
      answer: a.answer,
      predictedMajority: a.predictedMajority,
      confidence: a.confidence
    })),
    submittedAt: new Date(now - Math.floor((simulatedRespondents.length - index) * 90 * 1000))
  }));

  students.forEach((student, index) => {
    const profile = demoRespondents[index];
    submissions.push({
      examId: exam._id,
      userId: student._id,
      respondentId: respondentIdFor(student._id.toString(), exam._id.toString()),
      answers: profile.answers.map((a) => ({
        questionNumber: a.questionNumber,
        answer: a.answer,
        predictedMajority: a.predictedMajority,
        confidence: a.confidence
      })),
      submittedAt: new Date(now - 60 * 1000 * (index + 1))
    });
  });

  await Submission.insertMany(submissions);
  console.log(`answers  : ${submissions.length} submissions stored (including the ${students.length} demo students)`);

  await OfficialKey.create({
    examId: exam._id,
    answers: cohort.groundTruth,
    uploadedBy: admin._id,
    source: 'SIMULATION_GROUND_TRUTH'
  });
  console.log(`key      : ${cohort.groundTruth.length} ground-truth answers stored as the official key`);

  if (args.compute) {
    const { methods } = await computeAndStoreConsensus(exam._id, { logger: quietLogger });
    console.log(`consensus: computed for ${methods.join(', ')}`);
  } else {
    console.log('consensus: skipped (--no-compute)');
  }

  await seedDisputeThreads(exam, cohort, submissions);

  const verdict = report(cohort, submissions);

  await disconnectDatabase();

  console.log('\nSign in at ' + env.clientUrl);
  console.log(`  admin   : ${DEMO_ACCOUNTS.admin.email} / ${DEMO_ACCOUNTS.admin.password}`);
  console.log(`  student : ${DEMO_ACCOUNTS.students[0].email} / ${DEMO_ACCOUNTS.students[0].password}`);

  if (!verdict.pass) {
    console.error(
      '\nFAILED: the weighted methods did not beat majority voting on the trap questions.\n' +
        'That comparison is the project thesis — treat this as a failing test, not a warning.'
    );
    process.exitCode = 1;
  } else {
    console.log('\nOK: weighted EM and the surprisingly-popular criterion both beat majority voting on the traps.');
  }
}

function report(cohort, submissions) {
  const matrix = buildMatrix({
    questions: cohort.questions,
    submissions: submissions.map((s) => ({ respondentId: s.respondentId, answers: s.answers }))
  });
  const key = keyToMap(cohort.groundTruth);
  const results = runAllMethods(matrix, { collectPredictions: true });
  const traps = new Set(cohort.trapQuestionNumbers);
  const ambiguous = new Set(cohort.ambiguousQuestionNumbers);

  console.log('\n--- method accuracy against the known key ---');
  console.log('method                 overall   traps   unclear   normal   disputed-flagged');
  const accuracy = {};
  for (const [method, result] of Object.entries(results)) {
    const overall = methodAccuracy(result.perQuestion, key);
    const trapRows = result.perQuestion.filter((q) => traps.has(q.questionNumber));
    const ambiguousRows = result.perQuestion.filter((q) => ambiguous.has(q.questionNumber));
    const normalRows = result.perQuestion.filter(
      (q) => !traps.has(q.questionNumber) && !ambiguous.has(q.questionNumber)
    );
    const trap = methodAccuracy(trapRows, key);
    accuracy[method] = { overall: overall.accuracy, trap: trap.accuracy };
    console.log(
      method.padEnd(22),
      `${(overall.accuracy * 100).toFixed(1)}%`.padStart(7),
      `${trap.matched}/${trap.comparable}`.padStart(8),
      `${methodAccuracy(ambiguousRows, key).matched}/${ambiguousRows.length}`.padStart(9),
      `${methodAccuracy(normalRows, key).matched}/${normalRows.length}`.padStart(8),
      `${result.perQuestion.filter((q) => q.disputed).length}`.padStart(18)
    );
  }

  const comparison = compareMethods(matrix, key, { results, collectPredictions: true });
  console.log(
    `\nweighting overturned the plurality on ${comparison.overturnedQuestions.length} question(s): ` +
      `${comparison.overturnedWonByWeighting} corrected, ${comparison.overturnedLostByWeighting} made worse`
  );

  const em = results[METHODS.WEIGHTED_EM];
  console.log(
    `EM converged in ${em.iterations} iterations; inferred reliability ranged ` +
      `${em.weightStats.min.toFixed(2)}–${em.weightStats.max.toFixed(2)}`
  );

  const integrity = detectCollusion(matrix);
  console.log(
    `integrity: ${integrity.clusters.length} cluster(s) flagged ` +
      `(planted: ${cohort.collusionGroups.length}), rare-match threshold ${integrity.calibration.rareMatchThreshold}`
  );

  console.log(`\nstored   : ${submissions.length} submissions in MongoDB`);

  const majorityTrap = accuracy[METHODS.MAJORITY].trap;
  const pass =
    accuracy[METHODS.WEIGHTED_EM].trap > majorityTrap &&
    (accuracy[METHODS.SURPRISINGLY_POPULAR]?.trap ?? 1) > majorityTrap &&
    accuracy[METHODS.WEIGHTED_EM].overall >= accuracy[METHODS.MAJORITY].overall;
  return { pass, accuracy };
}

async function seedDisputeThreads(exam, cohort, submissions) {
  const majority = await ConsensusResult.findOne({ examId: exam._id, method: METHODS.MAJORITY }).lean();
  const candidates = majority
    ? [...majority.perQuestion].sort((a, b) => b.normalisedEntropy - a.normalisedEntropy).slice(0, 2)
    : [];
  if (candidates.length === 0) return;

  const voices = submissions.slice(0, 6).map((s) => s.respondentId);
  for (const question of candidates) {
    const options = Object.keys(question.distribution || {}).sort();
    await DisputeThread.create({
      examId: exam._id,
      questionNumber: question.questionNumber,
      posts: [
        {
          respondentId: voices[0],
          body: `I am fairly sure the answer here was (${options[0] ?? 'A'}). The class seems split down the middle — the distribution is basically flat.`,
          votes: 4,
          voters: voices.slice(1, 5)
        },
        {
          respondentId: voices[1],
          body: `Disagree. I remember discussing this straight after the paper and most people had (${options[1] ?? 'B'}). Either the question was ambiguous or two options were defensible.`,
          votes: 2,
          voters: voices.slice(2, 4)
        },
        {
          respondentId: voices[2],
          body: 'Worth flagging to the department: normalised entropy on this one is close to 1, which means nobody actually remembers it.',
          votes: 1,
          voters: [voices[3]]
        }
      ]
    });
  }
  console.log(`disputes : seeded ${candidates.length} discussion thread(s)`);
}

async function wipeSimulatedData() {
  const exams = await Exam.find({ isSimulated: true }).select('_id').lean();
  const ids = exams.map((e) => e._id);
  if (ids.length === 0) return { exams: 0 };
  await Promise.all([
    Question.deleteMany({ examId: { $in: ids } }),
    Submission.deleteMany({ examId: { $in: ids } }),
    ConsensusResult.deleteMany({ examId: { $in: ids } }),
    DisputeThread.deleteMany({ examId: { $in: ids } }),
    OfficialKey.deleteMany({ examId: { $in: ids } })
  ]);
  await Exam.deleteMany({ _id: { $in: ids } });
  return { exams: ids.length };
}

async function upsertUser({ name, email, password, role }) {
  let user = await User.findOne({ email });
  if (!user) user = new User({ name, email, role });
  user.name = name;
  user.role = role || ROLES.STUDENT;
  user.password = password;
  await user.save();
  return user;
}

function parseArgs(argv) {
  const args = {
    respondents: 150,
    questions: 50,
    seed: 42,
    keep: false,
    compute: true
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case '--respondents':
      case '-n':
        args.respondents = clampInt(value, args.respondents, 2, 5000);
        i += 1;
        break;
      case '--questions':
      case '-q':
        args.questions = clampInt(value, args.questions, 1, 300);
        i += 1;
        break;
      case '--seed':
      case '-s':
        args.seed = clampInt(value, args.seed, 1, 2 ** 31 - 1);
        i += 1;
        break;
      case '--keep':
        args.keep = true;
        break;
      case '--no-compute':
        args.compute = false;
        break;
      case '--help':
      case '-h':
        console.log(
          'Usage: node scripts/simulate.js [--respondents N] [--questions N] [--seed N] [--keep] [--no-compute]'
        );
        process.exit(0);
        break;
      default:
        break;
    }
  }
  return args;
}

function clampInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

const quietLogger = { log: () => {}, warn: (...a) => console.warn(...a), error: (...a) => console.error(...a) };

main().catch(async (error) => {
  console.error('\n[simulate] failed:', error.message);
  if (error.name === 'MongooseServerSelectionError') {
    console.error('[simulate] MongoDB is not reachable. Start it with:  net start MongoDB');
  }
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
