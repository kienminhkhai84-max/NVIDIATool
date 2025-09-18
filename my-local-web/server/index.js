const express = require('express');
const fs = require('fs').promises;
const puppeteer = require('puppeteer');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = 3000;

// === CẤU HÌNH ===
// Thiết lập view engine là EJS
app.set('view engine', 'ejs');
// Thiết lập đường dẫn đến thư mục 'views'
app.set('views', path.join(__dirname, '..', 'views'));

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
// Phục vụ các tệp tĩnh từ thư mục 'public'
app.use(express.static(path.join(__dirname, '..', 'public')));

// Hằng số
const TOKEN_FILE_PATH = path.join(__dirname, '..', 'token.json');
const NVIDIA_LOGIN_URL = 'https://learn.learn.nvidia.com/login';
const NVIDIA_DASHBOARD_URL = 'https://learn.learn.nvidia.com/dashboard';


// === HÀM HỖ TRỢ ===

async function readTokenData() {
    try {
        const data = await fs.readFile(TOKEN_FILE_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') return {}; // Trả về object rỗng nếu file không tồn tại
        throw error;
    }
}

async function writeTokenData(data) {
    await fs.writeFile(TOKEN_FILE_PATH, JSON.stringify(data, null, 2));
}

async function performNvidiaLogin(email, password) {
    let browser = null;
    try {
        console.log('Khởi chạy trình duyệt...');
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.goto(NVIDIA_LOGIN_URL);
        console.log('Đã vào trang đăng nhập.');

        await page.waitForSelector('#email', { visible: true, timeout: 10000 });
        await page.type('#email', email);
        await page.click('button[type="submit"]');
        console.log('Đã nhập email.');

        await page.waitForSelector('#signinPassword', { visible: true, timeout: 40000 });
        await page.type('#signinPassword', password);
        await page.click('#passwordLoginButton');
        console.log('Đã nhập mật khẩu và gửi đi.');

        await page.waitForNavigation({ timeout: 60000 });
        console.log('Đăng nhập thành công, đã điều hướng.');

        await page.goto(NVIDIA_DASHBOARD_URL);
        const cookies = await page.cookies();
        const sessionCookie = cookies.find(c => c.name === 'sessionid');

        return sessionCookie ? sessionCookie.value : null;
    } finally {
        if (browser) await browser.close();
        console.log('Đã đóng trình duyệt.');
    }
}

// === MIDDLEWARE XÁC THỰC ===

const requireAuth = async (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.redirect('/?error=' + encodeURIComponent('Vui lòng đăng nhập để tiếp tục.'));
    }

    try {
        const tokenData = await readTokenData();
        // Tìm email tương ứng với token trong file
        const userEntry = Object.entries(tokenData).find(([email, data]) => data.token === token);

        if (userEntry) {
            req.userEmail = userEntry[0]; // Gắn email vào request để sử dụng ở route sau
            return next();
        } else {
            res.clearCookie('token');
            return res.redirect('/?error=' + encodeURIComponent('Phiên đăng nhập không hợp lệ.'));
        }
    } catch (error) {
        console.error('Lỗi khi xác thực:', error);
        return res.redirect('/?error=' + encodeURIComponent('Lỗi hệ thống.'));
    }
};


// === ROUTES (CÁC ĐƯỜNG DẪN) ===

// Route cho trang đăng nhập (trang chủ)
app.get('/', (req, res) => {
    const { error } = req.query;
    res.render('login', { error: error || null });
});

// Route xử lý logic đăng nhập
app.post('/do-login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.redirect('/?error=' + encodeURIComponent('Email và mật khẩu là bắt buộc.'));
    }

    try {
        console.log(`Bắt đầu quá trình đăng nhập cho ${email}...`);
        const sessionToken = await performNvidiaLogin(email, password);

        if (sessionToken) {
            console.log('Lấy token thành công!');
            const tokenData = await readTokenData();

            if (!tokenData[email]) tokenData[email] = {};
            
            // CẢNH BÁO BẢO MẬT: Không bao giờ lưu mật khẩu dạng văn bản thuần trong ứng dụng thực tế.
            tokenData[email].pass = password; 
            tokenData[email].token = sessionToken;
            if (tokenData[email].hasDevice === undefined) tokenData[email].hasDevice = false;

            await writeTokenData(tokenData);

            // Thiết lập cookie cho trình duyệt client, tồn tại trong 1 ngày
            res.cookie('token', sessionToken, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }); 
            res.redirect('/dashboard');
        } else {
            res.redirect('/?error=' + encodeURIComponent('Email hoặc mật khẩu không hợp lệ.'));
        }
    } catch (e) {
        console.error('Lỗi nghiêm trọng trong quá trình đăng nhập:', e.message);
        res.redirect('/?error=' + encodeURIComponent('Đăng nhập thất bại: ' + e.message));
    }
});

// Route cho trang dashboard (yêu cầu xác thực)
app.get('/dashboard', requireAuth, (req, res) => {
    // req.userEmail được lấy từ middleware requireAuth
    res.render('dashboard', { email: req.userEmail });
});

// Route để đăng xuất
app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});


// === KHỞI ĐỘNG SERVER ===
app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});