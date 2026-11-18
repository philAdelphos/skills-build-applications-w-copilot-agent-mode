import { Schema, model } from 'mongoose';

const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  team: { type: Schema.Types.ObjectId, ref: 'Team' },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  fitnessGoal: { type: String, required: true, trim: true },
});

export const User = model('User', userSchema);
