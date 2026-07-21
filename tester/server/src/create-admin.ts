import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// MongoDB connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bonker';

interface IUser {
  username: string;
  password_hash: string;
  email: string;
  role: 'admin' | 'user';
  created_at: Date;
}

const userSchema = new mongoose.Schema<IUser>({
  username: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  created_at: { type: Date, default: () => new Date() },
});

const User = mongoose.model<IUser>('User', userSchema);

async function createAdminUser() {
  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists:', existingAdmin.username);
      console.log('📧 Email:', existingAdmin.email);
      await mongoose.connection.close();
      return;
    }

    // Create admin user
    const username = 'admin';
    const password = 'Admin@123456'; // Change this password!
    const email = 'admin@example.com';

    const password_hash = await bcrypt.hash(password, 10);

    const admin = new User({
      username,
      password_hash,
      email,
      role: 'admin',
    });

    await admin.save();

    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('📋 Login Credentials:');
    console.log('─'.repeat(50));
    console.log(`👤 Username: ${username}`);
    console.log(`🔐 Password: ${password}`);
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Role: admin`);
    console.log('─'.repeat(50));
    console.log('');
    console.log('⚠️  IMPORTANT: Change this password immediately after first login!');
    console.log('');
    console.log('🌐 Access the app at: http://localhost:5173');
    console.log('');

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

createAdminUser();
