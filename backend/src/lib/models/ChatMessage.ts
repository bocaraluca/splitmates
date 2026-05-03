import mongoose, { Schema, model } from 'mongoose';

const chatMessageSchema = new Schema({
  groupId: {
    type: Number,
    required: true,
    index: true,
  },
  userId: {
    type: Number,
    required: true,
    index: true,
  },
  username: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

chatMessageSchema.index({ groupId: 1, createdAt: -1 });

export const ChatMessage = mongoose.models.ChatMessage || model('ChatMessage', chatMessageSchema);
