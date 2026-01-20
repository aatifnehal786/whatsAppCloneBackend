const express = require('express');
const bodyParser = require('body-parser');
const connectDB = require('./config/dbConfig');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const initializeSocket = require('./services/socketIoService');
require('dotenv').config();

const PORT = process.env.PORT || 5000;
const app = express();

// Configure CORS
const corsOptions = {
    origin: ["https://pingmeweb.netlify.app", "http://localhost:3000"],
    credentials:true
};
app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
// Create HTTP Server
const server = http.createServer(app);

// Connect to Database
connectDB();


const io = initializeSocket(server);

// ✅ CRITICAL: Apply socket middleware BEFORE routes
app.use((req, res, next) => {
    req.io = io;
    req.socketUserMap = io.socketUserMap; // This is the key missing piece!
    next();
});


// Routes
const userRoutes = require('./routes/authRoute');
const chatRoutes = require('./routes/chatRoute');
const statusRoute = require('./routes/statusRoute');

app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/status',statusRoute)


// Start Server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


