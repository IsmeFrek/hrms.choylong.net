
// MongoDB/Mongoose model for 'អង្គភាព' (DepartmentUnit)
import mongoose from 'mongoose';

const DepartmentUnitSchema = new mongoose.Schema({
  name: { type: String, required: true }, // ឈ្មោះអង្គភាព
  code: { type: String }, // កូដ (ស្រេចចិត្ត)
  description: { type: String }, // ផ្សេងៗ
  order: { type: Number, default: 0 }, // សម្រាប់តម្រៀប
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const DepartmentUnit = mongoose.model('DepartmentUnit', DepartmentUnitSchema);
export default DepartmentUnit;
