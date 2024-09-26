const express = require('express');
const app = express();
const cors = require('cors');
const { default: mongoose } = require('mongoose');
const { ObjectId } = require('mongoose').Types;

const User = require('./models/User');
const Post = require('./models/Post');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const uploadMiddleWare = multer({ dest: 'uploads/' });
const fs = require('fs');

const salt = bcrypt.genSaltSync(10);
const secret = 'asuhdfjsdbvcfawiuegfas';

app.use(cors({ credentials: true, origin: ['http://localhost:5173'] }));
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

mongoose.connect('mongodb+srv://coderjothees:Jothees1045.@joblogs.gzdav2d.mongodb.net/?retryWrites=true&w=majority&appName=JoBlogs');

app.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const findUser = await User.findOne({username});
        if (findUser == null || ((findUser.username != username) && (findUser.email != email))) {
            const userDoc = await User.create({ username, email, password: bcrypt.hashSync(password, salt) });
            res.json('ok');
        } else {
            res.json('Already Exist')
        }
        
    } catch (error) {
        console.log(error);
    }

});

app.post('/login', async (req, res) => {

    try {
        const { email, password } = req.body;
        const userDoc = await User.findOne({ email });

        if (userDoc == null) {
            return res.json(null);
        }
        // console.log(userDoc);
        const checkPass = bcrypt.compareSync(password, userDoc.password);
        if (checkPass) {
            jwt.sign({ username: userDoc.username, id: userDoc._id, email: userDoc.email, }, secret, {}, (err, token) => {
                if (err) throw err;
                res.cookie('token', token).json({
                    id: userDoc._id,
                    username: userDoc.username,
                    email: userDoc.email,
                });
            })
        } else {
            res.json("IncorrectPassword");
        }
    } catch (error) {
        console.log(error);
    }
});

app.get('/profile', async (req, res) => {
    try {

        // const isUserLoggedIn = req.body;
        const { token } = req.cookies;


        if ((token != "null") && (token)) {
            jwt.verify(token, secret, {}, async (err, info) => {
                if (err) throw err;
                const PostDetails = await Post.find().populate('author', 'username');
                // console.log(PostDetails); 
                let postLen = 0;
                let postDet = [];
                if (!PostDetails) {
                    return res.json({ userInfo: info, PostCount: postLen, PostInfo: postDet })
                } else {
                    PostDetails.map((dt) => {
                        if (dt.author._id == info.id) {
                            postLen++;
                            postDet.push(dt);
                        }
                    })
                    // console.log(postLen + " " + postDet);
                    res.json({ userInfo: info, PostCount: postLen, PostInfo: postDet })
                }
            })
        } else {
            return res.json("No Cookies");
        }


    } catch (error) {
        console.log(error);
    }
});

app.post('/ResetPassword', async (req, res) => {
    try {
        const {pass, email} = req.body;
        const userDoc = await User.findOne({ email});
        const checkPass = bcrypt.compareSync(pass, userDoc.password);
        if (checkPass) {
            return res.json("Password Matched");
        } else {
            return res.json("Password Mismatched");
        }
    } catch (error) {
        console.log(error);
    }
});

app.put('/ResetPassword', async (req,res)=>{
    try {
        const {pass, email} = req.body;
        const userDoc = await User.findOne({ email });
        await userDoc.updateOne({
            password: bcrypt.hashSync(pass, salt)
        });
        res.json('ok');
    } catch (error) {
        console.log(error);
    }
});

app.post('/logout', (req, res) => {
    res.cookie('token', "null").json('ok');
});

app.post('/post', uploadMiddleWare.single('file'), async (req, res) => {

    try {
        const { originalname, path } = req.file;
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        const newPath = path + '.' + ext;
        fs.renameSync(path, newPath);

        const { token } = req.cookies;
        jwt.verify(token, secret, {}, async (err, info) => {
            if (err) throw err;

            const { title, summary, content } = req.body;
            const postDoc = await Post.create({
                title,
                summary,
                content,
                cover: newPath,
                author: info.id,
            });

            res.json(postDoc);
        });
    } catch (error) {
        console.log(error);
    }
});

app.put('/EditPost', uploadMiddleWare.single('file'), async (req, res) => {

    try {

        let newPath = null;
        if (req.file) {
            const { originalname, path } = req.file;
            const parts = originalname.split('.');
            const ext = parts[parts.length - 1];
            const newPath = path + '.' + ext;
            fs.renameSync(path, newPath);
        }

        const { token } = req.cookies;
        jwt.verify(token, secret, {}, async (err, info) => {
            if (err) throw err;
            const { id, title, summary, content } = req.body;
            const postDoc = await Post.findById(id);
            if (postDoc === null) {
                return res.json('PostDocs is null');
            }
            const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
            if (!isAuthor) {
                res.status(400).json('You are not the Author');
                throw "You are not the Author";
            }

            await postDoc.updateOne({
                title,
                summary,
                content,
                cover: newPath ? newPath : postDoc.cover,
            });
            res.json(postDoc);
        });

    } catch (error) {
        console.log(error);
    }

})

app.get('/post', async (req, res) => {
    try {
        res.json(await Post.find().populate('author').sort({ createdAt: -1 }));

    } catch (error) {
        console.log(error);
    }
})

app.get('/FullPost/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const postDoc = await Post.findById(id).populate('author', ['username']);
        res.json(postDoc);
    } catch (error) {
        console.log(error);

    }

})

app.delete('/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const postDoc = await Post.findByIdAndDelete(id);

        res.json('ok');
    } catch (error) {
        console.log(error);
    }

});

app.get('/test', (req, res) => {
    res.json(" Test ok")
});
app.get('/PopulateTest', async (req, res) => {
    const posts = await Post.find().populate('author');
    let count = 0;

    res.json(posts);


    // posts.map((dt) => {
    //     if (dt.author._id == '65c33b51af917908a0ff0d3d') {
    //         count++;
    //     }

    // })
    // res.json(count);

})

app.listen(4000);
