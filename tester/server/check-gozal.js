const mongoose = require('mongoose');
const url = 'mongodb://localhost:27017/bunker_system';

mongoose.connect(url).then(async () => {
  const User = require('./dist/db/mongo').User;
  const UserFrameworkPermission = require('./dist/db/mongo').UserFrameworkPermission;
  
  const gozal = await User.findOne({ username: 'gozal' });
  console.log('Gozal user:', gozal?.username, gozal?._id);
  
  if (gozal) {
    const perms = await UserFrameworkPermission.find({ user_id: gozal._id }).populate('unit_id');
    console.log('Permissions:', perms.map(p => ({ unitId: p.unit_id._id, unitName: p.unit_id.name, unitType: p.unit_id.type })));
  }
  
  mongoose.disconnect();
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
