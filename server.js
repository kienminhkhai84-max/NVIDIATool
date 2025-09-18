
const express = require('express');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = 3000;

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
        await page.click('button[type="submit"]');

        console.log('Typing password...');
        await page.waitForSelector('#signinPassword', { visible: true, timeout: 40000 });
        await page.type('#signinPassword', password);
        await page.click('#passwordLoginButton');

        console.log('Waiting for navigation after login...');
        await page.waitForNavigation({ timeout: 60000 });
        
        console.log('Navigating to dashboard to get cookies...');
        await page.goto('https://learn.learn.nvidia.com/dashboard');

        const cookies = await page.cookies();
        const sessionCookie = cookies.find(c => c.name === 'sessionid');

        if (sessionCookie) {
            console.log('Successfully found session cookie!');
            const tokenData = readTokenData();

            if (!tokenData[email]) {
                tokenData[email] = {};
            }
            // CẢNH BÁO: Lưu mật khẩu ở dạng văn bản thuần là không an toàn.
            // Mã này chỉ dành cho mục đích trình diễn cục bộ.
            tokenData[email].pass = password;
            tokenData[email].token = sessionCookie.value;
            if (tokenData[email].hasDevice === undefined) {
                tokenData[email].hasDevice = false;
            }

            writeTokenData(tokenData);

            // Đặt cookie trong trình duyệt của người dùng
            res.cookie('token', sessionCookie.value, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }); // 1 day
            res.redirect('/dashboard');
        } else {
            console.error('Login failed: sessionid cookie not found.');
            res.redirect('/?error=Invalid email or password.');
        }

    } catch (e) {
        console.error('An error occurred during login:', e);
        res.redirect('/?error=' + encodeURIComponent('Login failed: ' + e.message));
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
