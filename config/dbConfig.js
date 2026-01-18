const mongoose = require('mongoose');

const connectDb = async ()=> {
    try {
        await mongoose.connect(process.env.MONGO_URL)
        console.log("mongodatabase connected");
    } catch (error) {
        console.error("error connecting database",error.message);
        process.exit(1);
        
    }
}

module.exports = connectDb;