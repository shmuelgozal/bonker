import mongoose from 'mongoose';
import { User, Unit, UserFrameworkPermission } from './src/db/mongo';

const url = 'mongodb://localhost:27017/bunker_system';

async function main() {
  try {
    await mongoose.connect(url);
    console.log('Connected to MongoDB');
    
    const users = await User.find({}, { username: 1, role: 1 });
    const units = await Unit.find({}, { name: 1, type: 1 });
    
    console.log('Users:', users.map(u => ({ id: u._id, username: u.username, role: u.role })));
    console.log('Units:', units.map(u => ({ id: u._id, name: u.name, type: u.type })));
    
    // Try to find testuser2 and פלוגה א'
    const testuser = await User.findOne({ username: 'testuser2' });
    const company = await Unit.findOne({ name: /פלוגה.*א/ });
    
    console.log('\\nTestuser:', testuser?.username);
    console.log('Company:', company?.name);
    
    if (testuser && company) {
      const existing = await UserFrameworkPermission.findOne({ user_id: testuser._id, unit_id: company._id });
      if (!existing) {
        const perm = new UserFrameworkPermission({ user_id: testuser._id, unit_id: company._id });
        await perm.save();
        console.log('\\nPermission created successfully');
      } else {
        console.log('\\nPermission already exists');
      }
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
