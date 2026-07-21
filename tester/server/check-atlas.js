const mongoose = require('mongoose');

const url = 'mongodb+srv://gozalshmoel_db_user:xdovOYLLEixX85lY@clustergozal.bdzxhve.mongodb.net/bonker?retryWrites=true&w=majority';

mongoose.connect(url).then(async () => {
  const User = require('./dist/db/mongo').User;
  const UserFrameworkPermission = require('./dist/db/mongo').UserFrameworkPermission;
  const Unit = require('./dist/db/mongo').Unit;
  
  const users = await User.find({});
  console.log('All users:', users.map(u => ({ id: u._id, username: u.username, role: u.role })));
  
  const units = await Unit.find({});
  console.log('\nAll units (first 5):', units.slice(0, 5).map(u => ({ id: u._id, name: u.name, type: u.type })));
  console.log(`... (${units.length} total units)`);
  
  const gozal = await User.findOne({ username: 'gozal' });
  console.log('\nGozal user:', gozal?.username, gozal?._id);
  
  if (gozal) {
    const perms = await UserFrameworkPermission.find({ user_id: gozal._id }).populate('unit_id');
    console.log('Gozal permissions:', perms.length);
    perms.forEach(p => {
      console.log(`  -> ${p.unit_id?.name} (${p.unit_id?.type})`);
    });
  }
  
  mongoose.disconnect();
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
