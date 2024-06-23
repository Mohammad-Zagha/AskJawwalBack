const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true
    },
    chatHistory: [
        {
            chatTitle: {
                type: String,
                required: true
            },
            messages: {
                type: [String],
                default: []
            }
        }
    ]
}, { timestamps: true });

const userModel = mongoose.model('user', userSchema);

module.exports = { userModel };
