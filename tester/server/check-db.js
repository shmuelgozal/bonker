const mongoose = require('mongoose');
const url = 'mongodb://localhost:27017/bunker_system';

mongoose.connect(url).then(async () => {
  const User = require('./dist/db/mongo').User;
  const Unit = require('./dist/db/mongo').Unit;
  
  const users = await User.find({}, { username: 1, role: 1 });
  const units = await Unit.find({}, { name: 1, type: 1 });
  
  console.log('Users:', users.map(u => ({ id: u._id, username: u.username, role: u.role })));
  console.log('Units:', units.map(u => ({ id: u._id, name: u.name, type: u.type })));
  
  mongoose.disconnect();
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
