import mongoose from 'mongoose';

let connectionPromise;

export async function connectDb() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured.');
  connectionPromise ??= mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  }).catch((error) => {
    connectionPromise = undefined;
    throw error;
  });
  return connectionPromise;
}
