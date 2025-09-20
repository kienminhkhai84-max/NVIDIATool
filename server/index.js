const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

app.use(express.static(path.join(__dirname, '../public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// --- DATA HANDLING ---
const tokenFilePath = path.join(__dirname, 'tokens.json');

const readTokenData = () => {
    try {
        if (fs.existsSync(tokenFilePath)) {
            const data = fs.readFileSync(tokenFilePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Error reading token data:', e);
    }
    return {};
};

const writeTokenData = async (data) => {
    try {
        await fs.promises.writeFile(tokenFilePath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error writing token data:', e);
    }
};

// Middleware to check if the user is logged in
const requireAuth = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.redirect('/?error=Please log in to continue.');
    }

    const tokenData = readTokenData();
    const userEntry = Object.values(tokenData).find(d => d.token === token);

    if (userEntry) {
        req.token = token; // Pass the token to the request object
        next(); // User is authenticated, proceed
    } else {
        res.clearCookie('token');
        return res.redirect('/?error=Invalid session. Please log in again.');
    }
};

// --- ROUTES ---

// Login page (home)
app.get('/', (req, res) => {
    const { error } = req.query;
    res.render('login', { error: error || null });
});

// Handle login logic
app.post('/do-login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.redirect('/?error=Email and password are required.');
    }

    try {
        const tokenData = readTokenData();
        
        // In a real app, you would hash and salt passwords.
        // For this demo, we are comparing plain text.
        const userExists = tokenData[email] && tokenData[email].pass === password;

        if (userExists) {
            const sessionToken = crypto.randomBytes(32).toString('hex');
            tokenData[email].token = sessionToken;
            await writeTokenData(tokenData);
            res.cookie('token', sessionToken, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
            res.redirect('/dashboard');
        } else {
            res.redirect('/?error=' + encodeURIComponent('Invalid email or password.'));
        }
    } catch (e) {
        console.error('Critical error during login:', e.message);
        res.redirect('/?error=' + encodeURIComponent('Login failed: ' + e.message));
    }
});

// Dashboard page (protected)
app.get('/dashboard', requireAuth, (req, res) => {
    // The token is available from the middleware via req.token
    res.render('dashboard', { token: req.token });
});


// Logout
app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
