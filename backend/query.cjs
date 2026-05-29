const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/hrms');
const HR = mongoose.model('HR', new mongoose.Schema({}, { strict: false }));
HR.findOne({}).then(d => { console.log(d.toObject()); mongoose.disconnect(); });
