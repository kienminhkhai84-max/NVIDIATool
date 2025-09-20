
const express = require('express');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = 3001;

// Đường dẫn đến tệp JSON để lưu trữ token
const TOKEN_FILE_PATH = path.join(__dirname, 'token.json');

// Cấu hình Express
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Hàm trợ giúp để đọc dữ liệu token
function readTokenData() {
    if (!fs.existsSync(TOKEN_FILE_PATH)) {
        return {};
    }
    const data = fs.readFileSync(TOKEN_FILE_PATH, 'utf8');
    return JSON.parse(data);
}

// Hàm trợ giúp để ghi dữ liệu token
function writeTokenData(data) {
    fs.writeFileSync(TOKEN_FILE_PATH, JSON.stringify(data, null, 2));
}

// Middleware để kiểm tra xem người dùng đã đăng nhập chưa
const requireAuth = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.redirect('/?error=Please log in to continue.');
    }

    const tokenData = readTokenData();
    const userEntry = Object.values(tokenData).find(d => d.token === token);

    if (userEntry) {
        next(); // Người dùng được xác thực, tiếp tục
    } else {
        res.clearCookie('token');
        return res.redirect('/?error=Invalid session. Please log in again.');
    }
};

// --- ROUTES ---

// Trang đăng nhập (trang chủ)
app.get('/', (req, res) => {
    const { error } = req.query;
    res.render('login', { error: error || null });
});

// Xử lý logic đăng nhập
app.post('/do-login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.redirect('/?error=Email and password are required.');
    }

    let browser;
    try {
        console.log('Launching browser...');
        browser = await puppeteer.launch({
            executablePath: '/usr/bin/chromium-browser',
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        console.log('Navigating to NVIDIA login page...');
        await page.goto('https://learn.learn.nvidia.com/login');

        console.log('Typing email...');
        await page.waitForSelector('#email', { visible: true, timeout: 10000 });
        await page.type('#email', email);
        
        console.log('Pressing Enter after email...');
        await page.keyboard.press('Enter');

        console.log('Waiting for 5 seconds for the page to transition...');
        await page.waitForTimeout(5000);

        console.log('Saving screenshot to password-page.png');
        await page.screenshot({ path: 'password-page.png', fullPage: true });

        console.log('Saving HTML content to password-page.html');
        const pageContent = await page.content();
        fs.writeFileSync('password-page.html', pageContent);

        console.log('Debug files saved. The script will now stop.');
        res.redirect('/?error=Debug files have been saved. Please check password-page.png and password-page.html');

    } catch (e) {
        console.error('An error occurred during the debugging process:', e);
        res.redirect('/?error=' + encodeURIComponent('An error occurred: ' + e.message));
    } finally {
        if (browser) {
            console.log('Closing browser...');
            await browser.close();
        }
    }
});


// Trang tổng quan (yêu cầu xác thực)
app.get('/dashboard', requireAuth, (req, res) => {
    res.render('dashboard');
});

// Đăng xuất
app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});


// Khởi động máy chủ
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
