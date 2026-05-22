// ---- Modules ----
const express = require('express');
const cors = require('cors');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const app = express();

// ---- Middleware ----
app.use(express.json());
app.use(cors());

// ---- Reports Database ----
const adapter = new FileSync('reports.json');
const db = low(adapter);
db.defaults({ reports: [] }).write();

// ---- Users Database ----
const usersDb = new FileSync('users.json');
const usersData = low(usersDb);
usersData.defaults({ users: [] }).write();

// ---- OTP Storage ----
let otpStore = {};

// ---- Email Setup ----
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'karanya1810@gmail.com',
        pass: 'pizo kgyk bmqp bgzp'
    }
});

// ---- Test Route ----
app.get('/', function(req, res) {
    res.json({ message: 'Emergency Server Chal Raha Hai!' });
});

// ---- Report Save Karo ----
app.post('/report', function(req, res) {
    let reports = db.get('reports');
    let count = reports.size().value();

    let report = {
        id: 'EM-' + String(count + 1).padStart(4, '0'),
        type: req.body.type,
        description: req.body.description,
        location: req.body.location,
        severity: req.body.severity,
        time: new Date().toLocaleString()
    };

    reports.push(report).write();
    console.log('Naya Report Aaya:', report);

    let mailOptions = {
        from: 'karanya1810@gmail.com',
        to: 'sprinceyadav23@gmail.com',
        subject: '🚨 New Emergency: ' + report.type + ' — ' + report.severity,
        html: `
            <h2 style="color:#E24B4A">🚨 Emergency Alert!</h2>
            <table border="1" cellpadding="8" style="border-collapse:collapse">
                <tr><td><b>Case ID</b></td><td>${report.id}</td></tr>
                <tr><td><b>Type</b></td><td>${report.type}</td></tr>
                <tr><td><b>Severity</b></td><td>${report.severity}</td></tr>
                <tr><td><b>Location</b></td><td>${report.location}</td></tr>
                <tr><td><b>Description</b></td><td>${report.description}</td></tr>
                <tr><td><b>Time</b></td><td>${report.time}</td></tr>
            </table>
            <p>Turant action lo!</p>
        `
    };

    transporter.sendMail(mailOptions, function(err, info) {
        if (err) {
            console.log('Email Error:', err);
        } else {
            console.log('Email Bhej Di:', info.response);
        }
    });

    res.json({ success: true, caseId: report.id });
});

// ---- Saare Reports Lo ----
app.get('/reports', function(req, res) {
    let reports = db.get('reports').value();
    res.json(reports);
});

// ---- Login Route ----
app.post('/login', function(req, res) {
    let username = req.body.username;
    let password = req.body.password;

    let user = usersData.get('users')
        .find({ username: username })
        .value();

    if (!user) {
        return res.json({ success: false, message: 'Galat username ya password!' });
    }

    let isMatch = bcrypt.compareSync(password, user.password);

    if (isMatch) {
        res.json({
            success: true,
            role: user.role,
            username: user.username,
            name: user.name
        });
    } else {
        res.json({ success: false, message: 'Galat username ya password!' });
    }
});

// ---- Register Route ----
app.post('/register', function(req, res) {
    let name     = req.body.name;
    let email    = req.body.email;
    let username = req.body.username;
    let password = req.body.password;

    console.log('Register request aaya:', req.body);

    if (!name || !email || !username || !password) {
        return res.json({ success: false, message: 'Sab fields bharo!' });
    }

    let existing = usersData.get('users')
        .find({ username: username })
        .value();

    if (existing) {
        return res.json({ success: false, message: 'Yeh username pehle se liya hua hai!' });
    }

    let existingEmail = usersData.get('users')
        .find({ email: email })
        .value();

    if (existingEmail) {
        return res.json({ success: false, message: 'Yeh email pehle se registered hai!' });
    }

    let otp = Math.floor(100000 + Math.random() * 900000).toString();
    let hashed = bcrypt.hashSync(password, 10);

    otpStore[email] = {
        otp: otp,
        name: name,
        username: username,
        password: hashed,
        expiry: Date.now() + 10 * 60 * 1000
    };

    let mailOptions = {
        from: 'karanya1810@gmail.com',
        to: email,
        subject: '🔐 Emergency App — OTP Verification',
        html: `
            <h2 style="color:#E24B4A">🚨 Emergency App</h2>
            <p>Aapka OTP hai:</p>
            <h1 style="color:#E24B4A; letter-spacing:8px">${otp}</h1>
            <p>Yeh OTP <b>10 minute</b> mein expire ho jayega!</p>
        `
    };

    transporter.sendMail(mailOptions, function(err, info) {
        if (err) {
            console.log('Email Error:', err);
            return res.json({ success: false, message: 'Email nahi gayi!' });
        }
        console.log('Email ja rahi hai:', email);
        console.log('OTP Bheja:', otp);
        res.json({ success: true, message: 'OTP email par bhej diya!' });
    });
});

// ---- OTP Verify Karo ----
app.post('/verify-otp', function(req, res) {
    let email = req.body.email;
    let otp   = req.body.otp;

    console.log('OTP aaya:', otp);
    console.log('OTP stored:', otpStore[email] ? otpStore[email].otp : 'nahi mila');

    if (!otpStore[email]) {
        return res.json({ success: false, message: 'Pehle register karo!' });
    }

    if (Date.now() > otpStore[email].expiry) {
        delete otpStore[email];
        return res.json({ success: false, message: 'OTP expire ho gaya! Dobara register karo.' });
    }

    if (otpStore[email].otp !== otp) {
        return res.json({ success: false, message: 'Galat OTP! Dobara try karo.' });
    }

    let data = otpStore[email];

    let newUser = {
        name: data.name,
        email: email,
        username: data.username,
        password: data.password,
        role: 'user'
    };

    usersData.get('users').push(newUser).write();
    delete otpStore[email];

    res.json({ success: true, message: 'Account ban gaya! Ab login karo.' });
});

// ---- Server Start Karo ----
app.listen(3000, function() {
    console.log('Server chal raha hai: http://localhost:3000');
});