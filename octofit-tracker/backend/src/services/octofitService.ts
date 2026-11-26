import { Activity, Team, User, Workout } from '../models/index.js';
import mongoose from 'mongoose';

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown) {
  if (!input || typeof input !== 'object') {
    throw Object.assign(new Error('Invalid activity'), { status: 400 });
  }

  const { userId, teamId, type, minutes } = input as Record<string, unknown>;
  if (
    typeof userId !== 'string'
    || typeof teamId !== 'string'
    || typeof type !== 'string'
    || type.trim().length === 0
    || typeof minutes !== 'number'
    || !Number.isFinite(minutes)
    || minutes <= 0
  ) {
    throw Object.assign(new Error('Invalid activity'), { status: 400 });
  }

  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(teamId)) {
    throw Object.assign(new Error('Invalid activity reference'), { status: 400 });
  }

  const [user, team] = await Promise.all([
    User.findById(userId),
    Team.findById(teamId),
  ]);
  if (!user || !team) {
    throw Object.assign(new Error('Activity references do not exist'), { status: 404 });
  }

  const activity = await Activity.create({
    user: user._id,
    team: team._id,
    type: type.trim(),
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
  return activity.toObject();
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(_input: unknown) {
  if (!_input || typeof _input !== 'object') {
    throw Object.assign(new Error('Invalid team'), { status: 400 });
  }

  const { name, mascot, members = [] } = _input as Record<string, unknown>;
  if (
    typeof name !== 'string'
    || name.trim().length === 0
    || typeof mascot !== 'string'
    || mascot.trim().length === 0
    || !Array.isArray(members)
  ) {
    throw Object.assign(new Error('Invalid team'), { status: 400 });
  }

  const memberIds = members as unknown[];
  if (!memberIds.every((memberId) => typeof memberId === 'string' && mongoose.isValidObjectId(memberId))) {
    throw Object.assign(new Error('Invalid team member'), { status: 400 });
  }

  const memberUsers = await User.find({ _id: { $in: memberIds } });
  if (memberUsers.length !== memberIds.length) {
    throw Object.assign(new Error('Team members do not exist'), { status: 404 });
  }

  const team = await Team.create({
    name: name.trim(),
    mascot: mascot.trim(),
    members: memberIds,
  });
  await User.updateMany({ _id: { $in: memberIds } }, { $set: { team: team._id } });
  return team.toObject();
}

export async function getLeaderboard() {
  const entries = await Activity.aggregate([
    {
      $group: {
        _id: '$team',
        totalPoints: { $sum: '$points' },
      },
    },
    { $sort: { totalPoints: -1, _id: 1 } },
  ]);

  const teams = await Team.find({
    _id: { $in: entries.map((entry) => entry._id) },
  }).lean();
  const teamNames = new Map(
    teams.map((team) => [team._id.toString(), team.name]),
  );

  return entries.map((entry, index) => ({
    teamName: teamNames.get(entry._id.toString()) ?? '',
    totalPoints: entry.totalPoints,
    rank: index + 1,
  }));
}

export async function suggestWorkouts(_userEmail: string) {
  const user = await User.findOne({ email: _userEmail });
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const activities = await Activity.find({ user: user._id }).lean();
  const activityTypes = activities.map((activity) => activity.type?.toLowerCase()).filter(Boolean);

  let focus = user.fitnessGoal?.toLowerCase();
  if (activityTypes.some((type) => type === 'strength')) {
    focus = 'strength';
  } else if (activityTypes.some((type) => type === 'run' || type === 'cycle')) {
    focus = 'endurance';
  }

  const matching = focus
    ? await Workout.find({ focus }).lean()
    : [];
  const workouts = matching.length > 0
    ? matching
    : await Workout.find().limit(1).lean();

  return workouts.map((workout) => ({
    ...workout,
    reason: focus
      ? `Matches your ${focus} activity pattern`
      : 'Suggested based on your activity pattern',
  }));
}

export { User };
