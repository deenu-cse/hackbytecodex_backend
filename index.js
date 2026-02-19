require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const router = require('./routes/index');
const connectDB = require('./db/config');
require("./models");
const app = express();

connectDB();

app.use(morgan('dev'));
app.use(express.json());
app.use(cors({
    origin:[
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'https://hackbytecodex.vercel.app'
    ]
}));

app.use((req,res,next)=>{
    console.log(req.method, req.url);
    next();
})


app.use(router)

console.log('main index.js ')

app.get('/', (req, res) => {
    res.send(`Hello, From ${process.env.APP_NAME} backend!`);
})

const PORT = process.env.PORT || 5000;

app.listen(PORT , () => {
    console.log(`${process.env.APP_NAME} backend is running on port ${PORT}`);
});
