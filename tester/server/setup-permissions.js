const mongoose = require('mongoose');
const url = 'mongodb://localhost:27017/bunker_system';

mongoose.connect(url).then(async () => {
  const User = require('./dist/db/mongo').User;
  const Unit = require('./dist/db/mongo').Unit;
  const UserFrameworkPermission = require('./dist/db/mongo').UserFrameworkPermission;
  
  const testuser = await User.findOne({ username: 'testuser2' });
  const company = await Unit.findOne({ name: 'פלוגה א\'', type: 'company' });
  
  console.log('Testuser:', testuser?._id, testuser?.username);
  console.log('Company:', company?._id, company?.name);
  
  if (testuser && company) {
    // Check if permission already exists
    const existing = await UserFrameworkPermission.findOne({ user_id: testuser._id, unit_id: company._id });
    if (!existing) {
      const perm = new UserFrameworkPermission({ user_id: testuser._id, unit_id: company._id });
      await perm.save();
      console.log('Permission created');
    } else {
      console.log('Permission already exists');
    }
  }
  
  mongoose.disconnect();
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
