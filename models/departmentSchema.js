const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  Department_Kh: {
    type: String,
    required: true,
    unique: true // optional, if you want unique department names
  },
  // ...other fields...
});

module.exports = mongoose.model('Department', departmentSchema);