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

app.use('/api-platform/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
            'https://hackbytecodex.vercel.app',
            'https://dashboardhackbytecodex.vercel.app',
            'https://panel.hackbytecodex.com',
            'https://www.hackbytecodex.com',
            'https://hackbytecodex.com',
            process.env.PLATFORM_DASHBOARD_URL,
            process.env.JUDGE_PANEL_URL
        ].filter(Boolean);

        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) === -1) {
            console.log("CORS blocked origin:", origin);
            return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'), false);
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use((req, res, next) => {
    console.log(req.method, req.url);
    next();
})


app.use(router)

console.log('main index.js ')

app.get('/', (req, res) => {
    res.send(`Hello, From ${process.env.APP_NAME} backend!`);
})

// Global error handler for better debugging
app.use((err, req, res, next) => {
    console.error('Global Error Handler:', err);
    console.error('Error Stack:', err.stack);
    console.error('Request Path:', req.path);
    console.error('Request Method:', req.method);

    res.status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
        error: process.env.NODE_ENV === 'production' ? undefined : err
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`${process.env.APP_NAME} backend is running on port ${PORT}`);
});
