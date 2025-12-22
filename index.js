const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDb = require('./config/dbConnect');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/authRoute');
const chatRoutes = require('./routes/chatRoute');
const statusRoute = require('./routes/statusRoute');
const initializeSocket = require('./services/socketService');
const http = require('http');

dotenv.config();

const PORT = process.env.PORT;
const app = express();

const corsOptions = {
    origin: process.env.FRONTEND_URL,
    credentials:true,
    methods:['GET','POST','PUT','DELETE','OPTIONS']
}

// middlewares

app.use(express.json()); // parse body data
app.use(cookieParser()); // parse token
app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({extended:true}));


// databse connection
connectDb();
const server = http.createServer(app);

const io = initializeSocket(server);




app.use((req,res,next)=>{
    req.io = io;
    req.socketUserMap = io.socketUserMap;
    next();

})


// routes

app.use("/api/auth",authRoutes);
app.use("/api/auth",chatRoutes);
app.use("/api/status",statusRoute);



server.listen(PORT,()=>{
    console.log(`server is running on Port ${PORT}`)
})