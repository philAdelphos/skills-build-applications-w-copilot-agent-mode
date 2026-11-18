import { Activity, Team, User, Workout } from '../models/index.js';
import mongoose from 'mongoose';

function badRequest(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}

function asObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw badRequest('Invalid request body');
  }
  return input as Record<string, unknown>;
}

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown) {
  const body = asObject(input);
  const userId = body.userId;
  const teamId = body.teamId;
  if (typeof userId !== 'string' || !mongoose.isValidObjectId(userId)
    || typeof teamId !== 'string' || !mongoose.isValidObjectId(teamId)) {
    throw badRequest('Invalid activity references');
  }
  if (typeof body.type !== 'string' || body.type.trim() === ''
    || typeof body.minutes !== 'number' || body.minutes < 1) {
    throw badRequest('Invalid activity input');
  }

  const [user, team] = await Promise.all([
    User.findById(userId).lean(),
    Team.findById(teamId).lean(),
  ]);
  if (!user || !team) throw badRequest('Activity references must exist');

  const occurredAt = body.occurredAt ? new Date(body.occurredAt as string) : new Date();
  if (body.occurredAt && Number.isNaN(occurredAt.getTime())) {
    throw badRequest('Invalid activity date');
  }
  const activity = new Activity({
    user: userId,
    team: teamId,
    type: body.type,
    minutes: body.minutes,
    points: body.minutes,
    occurredAt,
  });
  const validationError = activity.validateSync();
  if (validationError) throw badRequest(validationError.message);
  await activity.save();
  return activity.toObject();
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown) {
  const body = asObject(input);
  if (typeof body.name !== 'string' || body.name.trim() === ''
    || typeof body.mascot !== 'string' || body.mascot.trim() === '') {
    throw badRequest('Team name and mascot are required');
  }

  const members = Array.isArray(body.members) ? body.members : [];
  if (!members.every((id) => typeof id === 'string' && mongoose.isValidObjectId(id))) {
    throw badRequest('Invalid team member');
  }
  const team = new Team({ name: body.name, mascot: body.mascot, members });
  const validationError = team.validateSync();
  if (validationError) throw badRequest(validationError.message);
  await team.save();
  return team.toObject();
}

export async function getLeaderboard() {
  const totals = await Activity.aggregate([
    { $group: { _id: '$team', totalPoints: { $sum: '$points' } } },
    { $sort: { totalPoints: -1, _id: 1 } },
  ]);
  const teams = await Team.find({ _id: { $in: totals.map((entry) => entry._id) } }).lean();
  const names = new Map(teams.map((team) => [team._id.toString(), team.name]));
  return totals
    .filter((entry) => names.has(entry._id.toString()))
    .map((entry, index) => ({
      rank: index + 1,
      teamName: names.get(entry._id.toString()),
      totalPoints: entry.totalPoints,
    }));
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail.trim().toLowerCase() }).lean();
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  const activities = await Activity.find({ user: user._id }).lean();
  const activityTypes = new Set(activities.map((activity) => String(activity.type).toLowerCase()));
  const focus = user.fitnessGoal?.toLowerCase();
  const workouts = await Workout.find().lean();

  const scored = workouts.map((workout) => {
    const workoutFocus = workout.focus.toLowerCase();
    let score = 0;
    if (focus && workoutFocus === focus) score += 3;
    if (activityTypes.has(workoutFocus)) score += 3;
    if (activityTypes.has('run') && workoutFocus === 'endurance') score += 2;
    if (activityTypes.has('strength') && workoutFocus === 'strength') score += 2;
    return { workout, score };
  }).sort((a, b) => b.score - a.score);

  return scored.map(({ workout, score }) => ({
    ...workout,
    reason: score > 0
      ? `Matches your ${focus || 'activity'} fitness goal and recent activity`
      : 'Matches your general activity level',
  }));
}

export { User };
