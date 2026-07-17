const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const app = express();


// ==================== ১. ভিউ ইঞ্জিন এবং মিডলওয়্যার সেটআপ ====================
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true })); // ফরমের ডেটা ব্যাকএন্ডে রিড করার জন্য
app.use(express.json()); // জেসব ডেটা হ্যান্ডেল করার জন্য
app.locals.basedir = path.join(__dirname, 'views');

// ==================== ২. স্ট্যাটিক ফাইল ফোল্ডার সেটআপ ====================
app.use(express.static(path.join(__dirname, 'assets'))); 
app.use('/asset', express.static(path.join(__dirname, 'views/asset')));

// ==================== ৩. মঙ্গোডিবি ক্লাউড কানেকশন ====================
// ==================== DATABASE CONNECTION ====================
// পরিবেশ ভ্যারিয়েবল (MONGO_URI) থাকলে সেটা নেবে, না থাকলে আপনার সরাসরি অনলাইন লিংকটি ব্যবহার করবে
const dbURI = process.env.MONGO_URI || 'mongodb+srv://shahoriarislamadmin:fuckfuckfuck@cluster0.dij49m1.mongodb.net/telemeleDB?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(dbURI)
    .then(() => console.log("MongoDB Atlas Connected Successfully! 🎉"))
    .catch(err => console.error("Database connection error: ", err));

// ==================== ৪. ডাটাবেজ স্কিমা ও মডেলস ====================
const doctorSchema = new mongoose.Schema({
    name: String,
    speciality: String,
    experience: String,
    fees: Number,
    designation: String,
    institution: String,
    frcsFrom: String,
    fcpsFrom: String,
    image: String,
    profileUrl: String // ডক্টরের নিজস্ব পেজের লিঙ্ক সেভ করার জন্য ফিল্ড
});

// ==================== গ্লোবাল সেশন ভ্যারিয়েবলস ====================

// ১. সাধারণ ইউজারের লগইন সেশন ট্র্যাক করার জন্য
let currentUserSession = null; 


// ৩. (ঐচ্ছিক কিন্তু দরকারি) সাইনআপের পর টেম্পোরারি কোনো মেসেজ রিডাইরেক্ট পেজে দেখানোর জন্য
let sessionMessage = null;

// নাম এবং স্পেশালিটির উপর টেক্সট ইনডেক্স তৈরি (সার্চ ফাস্ট করার জন্য)
doctorSchema.index({ name: 'text', speciality: 'text' });
const Doctor = mongoose.model('Doctor', doctorSchema);

// অ্যাপয়েন্টমেন্ট/বুকিং স্কিমা (যা পেমেন্টের পর ডাটাবেজে সেভ হবে)
// অ্যাপয়েন্টমেন্ট/বুকিং স্কিমা (আপডেটেড)
const appointmentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // এটি নতুন যোগ করা হলো
    doctorName: String,
    patientName: String, 
    bookingDate: String, 
    timeSlot: String     
});
const Appointment = mongoose.model('Appointment', appointmentSchema);
// ==================== অ্যাডমিন স্কিমা (Admin Schema) ====================
const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

// মঙ্গোডিবি-তে এটি 'admins' নামে কালেকশন তৈরি করবে
const Admin = mongoose.model('Admin', adminSchema);

// অ্যাডমিন সেশন ট্র্যাক করার গ্লোবাল ভ্যারিয়েবল
let currentAdminSession = null;

// ==================== ৫. নতুন স্কিমা: User Schema ====================
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true }, 
    email: { type: String, required: true, unique: true },    
    number: { type: String, required: true },
    address: { type: String, required: true },
    password: { type: String, required: true } 
});
const User = mongoose.model('User', userSchema);



// ==================== ৫. ইউজার সাইড রাউটস (USER ROUTES) ====================

// হোমপেজ
app.get('/', (req, res) => {
    res.render('index'); 
});

// অ্যাবাউট মি পেজ
app.get('/about-me', (req, res) => {
    res.render('about-me'); 
});

// MD Shahoriar Islam Khan স্যারের নিজস্ব ডেডিকেটেড পেজ
// MD কেটে দেওয়ার পর রাউটটি এমন হওয়া উচিত:
app.get('/doctor/robiul-islam-robin', (req, res) => {
    res.render('robiul-islam-robin'); 
});

// MD কেটে দেওয়ার পর রাউটটি এমন হওয়া উচিত:
app.get('/doctor/shahoriar-islam-khan', (req, res) => {
    res.render('shahoriar-islam-khan'); // এখানে 'views/shahoriar-islam-khan.ejs' লোড হচ্ছে
});

// ডক্টরস লিস্ট পেজ (SEO Friendly সার্চ ও ডিপার্টমেন্ট ফিল্টার সহ)
app.get('/doctors', async (req, res) => {
    try {
        let query = {};
        if (req.query.speciality) {
            query.speciality = { $regex: req.query.speciality, $options: 'i' };
        }
        if (req.query.search) {
            query.name = { $regex: req.query.search, $options: 'i' };
        }

        const doctorList = await Doctor.find(query);
        const departments = await Doctor.distinct('speciality');

        res.render('doctors', { 
            allDoctors: doctorList, 
            departments: departments,
            currentSearch: req.query.search || '',
            currentSpeciality: req.query.speciality || ''
        });
    } catch (err) {
        res.status(500).send("Error fetching doctor data");
    }
});


// ==================== অথেন্টিকেশন রাউটস (SIGNUP & LOGIN) ====================

app.get('/signup', (req, res) => {
    res.render('signup', { error: null });
});

app.post('/signup', async (req, res) => {
    try {
        const { name, username, email, number, address, password } = req.body;
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        
        if (existingUser) {
            return res.render('signup', { error: 'Username or Email already exists! Try another.' });
        }

        const newUser = new User({ name, username, email, number, address, password });
        await newUser.save();
        res.redirect('/login'); 
    } catch (err) {
        res.status(500).send("Error creating user account");
    }
});

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    try {
        const { identity, password } = req.body; 
        const user = await User.findOne({
            $or: [{ username: identity }, { email: identity }],
            password: password
        });

        if (!user) {
            return res.render('login', { error: 'Invalid Identity or Password!' });
        }

        currentUserSession = user; 
        res.redirect('/doctors'); 
    } catch (err) {
        res.status(500).send("Error during login");
    }
});

app.get('/logout', (req, res) => {
    currentUserSession = null;
    res.redirect('/login');
});


// ==================== ৬. পেমেন্ট গেটওয়ে এবং কার্ট ফ্লো ====================

// ধাপ ১: ডক্টর প্রোফাইল থেকে ডেটা নিয়ে কার্ট/চেকআউট পেজে রিডাইরেক্ট করা (ডাটাবেজে সেভ হবে না)
// ধাপ ১: ডক্টর পেজের ফর্ম থেকে ডেটা রিসিভ করে চেকআউটে পাঠানো
// এই রাউটটি আগেরটা মুছে রিপ্লেস করবেন (লগইন ছাড়া চেকআউটে ঢুকতে দেবে না)
app.post('/proceed-to-checkout', (req, res) => {
    if (!currentUserSession) {
        return res.redirect('/login');
    }
    
    const { doctorName, fees, bookingDate, timeSlot } = req.body;
    res.redirect(`/checkout?doctorName=${encodeURIComponent(doctorName)}&fees=${fees}&patientName=${encodeURIComponent(currentUserSession.name)}&bookingDate=${bookingDate}&timeSlot=${encodeURIComponent(timeSlot)}`);
});

// ধাপ ২: চেকআউট পেজটি রেন্ডার করা এবং ইউআরএল থেকে ডাটাগুলো ইজেএস পেজে পাঠানো
app.get('/checkout', (req, res) => {
    const checkoutData = {
        doctorName: req.query.doctorName,
        fees: req.query.fees,
        patientName: req.query.patientName,
        bookingDate: req.query.bookingDate,
        timeSlot: req.query.timeSlot
    };
    
    // views/checkout.ejs পেজে এই ডাটা পাঠিয়ে দেওয়া হচ্ছে
    res.render('checkout', { data: checkoutData });
});
// াপ ৩: পেমেন্ট সফল হওয়ার পর ফাইনাল বুকিং ডাটাবেজে সেভ করা
// পেমেন্ট সফল হওয়ার পর ফাইনাল বুকিং ডাটাবেজে সেভ করা (আপডেটেড)
app.post('/confirm-payment-and-book', async (req, res) => {
    // সিকিউরিটি চেক: ইউজার লগইন করা না থাকলে লগইন পেজে পাঠাবে
    if (!currentUserSession) {
        return res.redirect('/login');
    }

    try {
        const confirmedAppointment = new Appointment({
            userId: currentUserSession._id, // লগইন করা ইউজারের আইডি সেভ হচ্ছে
            doctorName: req.body.doctorName,
            patientName: req.body.patientName || currentUserSession.name,
            bookingDate: req.body.bookingDate,
            timeSlot: req.body.timeSlot
        });

        await confirmedAppointment.save(); 
        
        res.send(`
            <div style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px; padding: 20px;">
                <h1 style="color: #059669;">🎉 Payment Successful & Appointment Booked!</h1>
                <p style="font-size: 18px; color: #374151;">Thank you, <b>${req.body.patientName || currentUserSession.name}</b>. Your serial for <b>${req.body.doctorName}</b> is confirmed.</p>
                <p style="color: #6b7280;">Date: ${req.body.bookingDate} | Time: ${req.body.timeSlot}</p>
                <a href="/doctors" style="display:inline-block; padding:12px 24px; background:#059669; color:#fff; text-decoration:none; border-radius:8px; margin-top:20px; font-weight: bold; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">Back to Doctors List</a>
            </div>
        `);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error completing payment and booking");
    }
});

// অ্যাডমিন সেশন ট্র্যাক করার জন্য গ্লোবাল ভ্যারিয়েবল (লাইন ৩৫ এর দিকে যোগ করতে পারেন)
//let currentAdminSession = null; 

// ==================== ADMIN LOGIN SYSTEM ====================

// অ্যাডমিন লগইন পেজ (GET)
app.get('/admin/login', (req, res) => {
    res.render('admin/login', { error: null });
});

// অ্যাডমিন লগইন ভেরিফিকেশন (POST)
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;

    // আপনার দেওয়া নির্দিষ্ট ইউজারনেম ও পাসওয়ার্ড চেক
    if (username === 'darkadmin' && password === 'darkbase!') {
        currentAdminSession = { role: 'superadmin', name: 'Main Admin' };
        return res.redirect('/admin'); // লগইন মিললে ড্যাশবোর্ডে নিয়ে যাবে
    } else {
        return res.render('admin/login', { error: 'Access Denied! Invalid Admin Credentials.' });
    }
});

// অ্যাডমিন লগআউট
app.get('/admin/logout', (req, res) => {
    currentAdminSession = null;
    res.redirect('/admin/login');
});


// ==================== PROTECTED ADMIN DASHBOARD ROUTES ====================
// (লগইন ছাড়া এই রাউটগুলোতে কেউ ঢুকতে পারবে না)

app.get('/admin', async (req, res) => {
    if (!currentAdminSession) return res.redirect('/admin/login'); // প্রোটেকশন চেক
    
    try {
        const doctorList = await Doctor.find({}); 
        res.render('admin/dashboard', { 
            activeTab: 'manage-doctors', 
            allDoctors: doctorList,
            allBookings: [],
            allUsers: [] 
        }); 
    } catch (err) {
        res.status(500).send("Error loading admin dashboard");
    }
});

app.get('/admin/add-doctor', async (req, res) => {
    if (!currentAdminSession) return res.redirect('/admin/login');
    
    res.render('admin/dashboard', { 
        activeTab: 'add-doctor', 
        allDoctors: [],
        allBookings: [],
        allUsers: [] 
    }); 
});

// অ্যাডমিন ড্যাশবোর্ড - বুকিং লিস্ট (আপডেটেড)
app.get('/admin/appointments', async (req, res) => {
    if (!currentAdminSession) return res.redirect('/admin/login');
    
    try {
        // populate('userId') এর মাধ্যমে ইউজারের বিস্তারিত ডেটাও (নাম, ইমেইল) সাথে নিয়ে আসবে
        const bookingList = await Appointment.find({}).populate('userId'); 
        res.render('admin/dashboard', { 
            activeTab: 'appointments', 
            allDoctors: [],
            allBookings: bookingList,
            allUsers: [] 
        }); 
    } catch (err) {
        res.status(500).send("Error loading appointments");
    }
});

app.get('/admin/users', async (req, res) => {
    if (!currentAdminSession) return res.redirect('/admin/login');
    
    try {
        const userList = await User.find({});
        res.render('admin/dashboard', { 
            activeTab: 'registered-users', 
            allDoctors: [],
            allBookings: [],
            allUsers: userList 
        }); 
    } catch (err) {
        res.status(500).send("Error loading users in admin");
    }
});


// অ্যাডমিন প্যানেল থেকে নির্দিষ্ট ইউজার ডিলিট করা
app.post('/admin/delete-user/:id', async (req, res) => {
    if (!currentAdminSession) return res.redirect('/admin/login');
    
    try {
        const userId = req.params.id;
        
        // ১. ইউজারকে ডিলিট করবে
        await User.findByIdAndDelete(userId);
        
        // ২. ঐ ইউজারের করা সমস্ত অ্যাপয়েন্টমেন্টও ডাটাবেজ থেকে ক্লিয়ার করে দেবে
        await Appointment.deleteMany({ userId: userId });
        
        res.redirect('/admin/users');
    } catch (err) {
        res.status(500).send("Error deleting user");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// ডাটাবেজে অটোমেটিক অ্যাডমিন অ্যাকাউন্ট তৈরি করার ম্যাজিক কোড
async function insertAdminDirectly() {
    try {
        // প্রথমে চেক করবে অলরেডি এই নামে কেউ আছে কি না
        const checkAdmin = await Admin.findOne({ username: 'darkadmin' });
        
        if (!checkAdmin) {
            const newAdmin = new Admin({
                username: 'darkadmin',
                password: 'darkbase!'
            });
            await newAdmin.save();
            console.log("=========================================");
            console.log("🎯 SUCCESS: Admin account created in MongoDB!");
            console.log("=========================================");
        }
    } catch (err) {
        console.log("Admin creation error:", err);
    }
}
// সার্ভার রান হওয়ার ৩ সেকেন্ড পর এটি নিজে নিজে ডাটাবেজে ডাটা ঢুকিয়ে দেবে
setTimeout(insertAdminDirectly, 3000);