const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Helper function to delay execution
const f1 = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Initialize token.json if it doesn't exist
if (!fs.existsSync('token.json')) {
    fs.writeFileSync('token.json', JSON.stringify({}));
}

app.get('/', (req, res) => {
    res.render('login', { error: req.query.error });
});

app.post('/do-login', async (req, res) => {
    const { email, password } = req.body;
    const v2 = JSON.parse(fs.readFileSync('token.json', 'utf8'));
    let browser;
    try {
        browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.goto('https://learn.learn.nvidia.com/login');
        await page.waitForSelector('#email', { visible: true, timeout: 10000 });
        await page.type('#email', email);
        await page.click('button[type="submit"]');
        await page.waitForSelector('#signinPassword', { visible: true, timeout: 40000 });
        await page.type('#signinPassword', password);
        await page.click('#passwordLoginButton');
        await page.waitForNavigation();
        await f1(60000);
        await page.goto('https://learn.learn.nvidia.com/dashboard');
        const cookies = await page.cookies();
        const v3 = cookies.find(c => c.name === 'sessionid');
        if (v3) {
            if (!v2[email]) v2[email] = {};
            v2[email].pass = password;
            v2[email].token = v3.value;
            if (v2[email].hasDevice === undefined) v2[email].hasDevice = false;
            fs.writeFileSync('token.json', JSON.stringify(v2));
            res.cookie('token', v3.value);
            res.redirect('/dashboard');
        } else {
            res.redirect('/?error=invalid');
        }
    } catch (e) {
        res.redirect('/?error=' + encodeURIComponent(e.message));
    } finally {
        if (browser) await browser.close();
    }
});

app.get('/dashboard', (req, res) => {
    if (req.cookies.token) {
        res.render('dashboard');
    } else {
        res.redirect('/');
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
