const mongoose = require('mongoose');
require('dotenv').config();

const unitSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  name: String,
  type: String,
  parent_unit_id: mongoose.Schema.Types.ObjectId,
  description: String,
  created_at: Date,
});

const Unit = mongoose.model('Unit', unitSchema);

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const userIds = ['6a5e0ce7e260442e4bbf4b2c', '6a5e0ce8e260442e4bbf4b2f', '6a5e0ce8e260442e4bbf4b30'];
  const units = await Unit.find({ _id: { $in: userIds.map(id => new mongoose.Types.ObjectId(id)) } });
  
  console.log('\n=== User Accessible Units ===');
  units.forEach(u => {
    console.log(`${u.name} (${u._id}): parent=${u.parent_unit_id}`);
  });
  
  console.log('\n=== All units with their hierarchy ===');
  const allUnits = await Unit.find({});
  allUnits.forEach(u => {
    console.log(`${u.name} (${u._id}): parent=${u.parent_unit_id}`);
  });
  
  await mongoose.disconnect();
}
check().catch(console.error);
