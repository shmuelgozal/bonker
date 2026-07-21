const mongoose = require('mongoose');
const url = 'mongodb://localhost:27017/bunker_system';

mongoose.connect(url).then(async () => {
  const User = require('./dist/db/mongo').User;
  const UserFrameworkPermission = require('./dist/db/mongo').UserFrameworkPermission;
  const Unit = require('./dist/db/mongo').Unit;
  
  const users = await User.find({});
  console.log('All users:', users.map(u => ({ id: u._id, username: u.username, role: u.role })));
  
  const units = await Unit.find({});
  console.log('\nAll units:', units.slice(0, 5).map(u => ({ id: u._id, name: u.name, type: u.type })));
  console.log(`... (${units.length} total units)`);
  
  const perms = await UserFrameworkPermission.find({}).populate('user_id').populate('unit_id');
  console.log('\nAll permissions:');
  perms.forEach(p => {
    console.log(`  ${p.user_id?.username} -> ${p.unit_id?.name} (${p.unit_id?.type})`);
  });
  
  mongoose.disconnect();
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
