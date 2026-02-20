const mongoose = require('mongoose');

const hrSchema = new mongoose.Schema({
  // ...other fields...
  Department_Kh: {
    type: String,
    required: true // or false if optional
    // You can add enum if you want to restrict to existing departments
    // enum: [array of department names]
  },
  // ...other fields...
});

// If the HR model was already registered elsewhere (ES modules or another file),
// reuse it to avoid overwrite/validation mismatches when multiple files define the model.
if (mongoose.models && mongoose.models.HR) {
  // Reuse existing model
  module.exports = mongoose.model('HR');
} else {
  module.exports = mongoose.model('HR', hrSchema);
}