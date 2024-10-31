const express = require('express')
const sqlite3 = require('sqlite3').verbose();
const app = express()
const path = require('path');
const port = 4000
const cors = require('cors');
bodyParser = require('body-parser');
const mime = require('mime-types');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcrypt');
app.use(bodyParser.json());
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
const upload = multer({
  dest: 'uploads/', 
  limits: {
      fileSize: 10 * 1024 * 1024, // Limit file size to 10 MB
  },
}).single('file');

const db = new sqlite3.Database(path.join(__dirname, 'database.db'))

function strhash( str ) {
    if (str.length % 32 > 0) str += Array(33 - str.length % 32).join("z");
    var hash = '', bytes = [], i = 0, j = 0, k = 0, a = 0, dict = ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','1','2','3','4','5','6','7','8','9'];
    for (i = 0; i < str.length; i++ ) {
        ch = str.charCodeAt(i);
        bytes[j++] = (ch < 127) ? ch & 0xFF : 127;
    }
    var chunk_len = Math.ceil(bytes.length / 32);   
    for (i=0; i<bytes.length; i++) {
        j += bytes[i];
        k++;
        if ((k == chunk_len) || (i == bytes.length-1)) {
            a = Math.floor( j / k );
            if (a < 32)
                hash += '0';
            else if (a > 126)
                hash += 'z';
            else
                hash += dict[  Math.floor( (a-32) / 2.76) ];
            j = k = 0;
        }
    }
    return hash;
}

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER DEFAULT CURRENT_TIMESTAMP,
	last_visit_at INTEGER DEFAULT CURRENT_TIMESTAMP,
	is_admin BOOLEAN DEFAULT FALSE,
	token TEXT UNIQUE NOT NULL,
	email_verified BOOLEAN DEFAULT FALSE
);
`,[])
db.run(`CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id INTEGER NOT NULL,
  location TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER DEFAULT CURRENT_TIMESTAMP,
  is_approved BOOLEAN DEFAULT FALSE,
  category_id INTEGER NOT NULL,
  happening_at INTEGER NOT NULL,
  image_url TEXT,
  is_hidden BOOLEAN DEFAULT FALSE
);
`,[])
db.run(`CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER DEFAULT CURRENT_TIMESTAMP,
  is_hidden BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE
);
`,[])
db.run(`CREATE TABLE IF NOT EXISTS punishments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  created_at INTEGER DEFAULT CURRENT_TIMESTAMP,
  expires INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  reason TEXT DEFAULT "no reason provided."
);
`,[])
db.run(`CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    liker_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    created_at INTEGER DEFAULT CURRENT_TIMESTAMP
  );
  `,[])
});

function uploadFile(filePath, callback = (res)=>{})  {
    const formData = new FormData();
    const fileName = path.basename(filePath);
    formData.append('files[]', fs.createReadStream(filePath), fileName);
    axios.post('https://qu.ax/upload.php', formData, {
      headers: {
        ...formData.getHeaders(), 
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'sec-ch-ua': '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'priority': 'u=1, i'
      },
      referrer: 'https://qu.ax/',
      referrerPolicy: 'strict-origin-when-cross-origin',
      mode: 'cors',
      withCredentials: false
    })
    .then(response => {
      callback(response)
    })
    .catch(error => {
      console.error('Error uploading file:', error);
    });
  }

  function deleteFile(filePath) {
    fs.unlink(filePath, (err) => {
        if (err) {
            console.error(`Error deleting file: ${filePath}`, err);
        } else {
            console.log(`File deleted: ${filePath}`);
        }
    });
  }

function randomString(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
  }
  function b64e(text){
    return (Buffer.from(text.toString()).toString('base64'));
  }
  
  function b64d(text){
    return Buffer.from(text.toString(), 'base64').toString('ascii')
  }
  const usernamePattern = /^[A-Za-z0-9_]{2,24}$/;
  const passwordPattern = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;
  const emailPattern = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/
  function sendError(res, code, error, errcode){
    return res.status(code).json({"error":error, "code":code, "errcode":errcode})
  }

  app.all('/api/:reqtype/:arg1?/:arg2?/:arg3?', (req, res) => {
    upload(req, res, (err) => {
    let current_account = null
    let token = req.headers.authorization
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      if (req.file) {
          deleteFile(req.file.path);
      }
      return sendError(res, 400, "File size exceeds 10MB limit.",36522)
    }
    if (token != null) {
        db.all("UPDATE users SET last_visit_at = strftime('%s') WHERE token = ? RETURNING *", [token], (err, rows) => {
        if (err) {
          console.log(124542)
          console.log(err)
        }
      
        if (rows.length > 0) {
          current_account = rows[0]
        }
        after1()
        })
      }else{
        after1()
      }
        function after1(){
        const reqtype = req.params.reqtype
        const arg1 = req.params.arg1
        const arg2 = req.params.arg2
        const arg3 = req.params.arg3
        switch (reqtype) {
          case "sign-up":
            if (req.method.toLowerCase() != "post") {
              return sendError(res, 405, "Method not allowed.", 124643)
            }
  
            let username = req.body.username
            let password = req.body.password
            let email = req.body.email
            if (!usernamePattern.test(username)) {
              return sendError(res, 400, "Username can only contain Latin letters, numbers, and underscores, and must be between 2 and 24 characters long.", 65432)
            }
  
            if (!passwordPattern.test(password)) {
              return sendError(res, 400, "Password must be at least 8 characters long, contain at least one number, and have at least one uppercase letter.", 123456)
            }
  
            if (!emailPattern.test(email)) {
              return sendError(res, 400, "Invalid email address.", 64338)
            }
  
            db.all("SELECT * FROM users WHERE lower(username) = ? OR lower(email) = ?", [username.toLowerCase(), email.toLowerCase()], (err, rows) => {
              if (err) {
                console.log(235665)
                console.log(err)
              }
              if (rows.length > 0) {
                if (rows[0].email.toLowerCase() == email.toLowerCase()) {
                  return sendError(res, 400, "Account with this email already exists", 47244)
                }
                if (rows[0].username.toLowerCase() == username.toLowerCase()) {
                  return sendError(res, 400, "Account with this username already exists", 15887)
                }
              }
  
              db.all("SELECT count(*) as user_count FROM users ", [], (err, rows) => {
                if (err) {
                  console.log(3543543)
                  console.log(err)
                }
                let newid = rows[0].user_count
                let token = b64e(newid).replaceAll("=", "") + "." + randomString(16)
                db.run(`INSERT INTO users (username, email, password_hash, created_at, last_visit_at, token) 
  VALUES (?, ?, ?, strftime('%s'), strftime('%s'), ?)`, [username, email, strhash(password), token])
                return res.status(200).json({ "message": "Account created successfully.", "code": 200, "token": token })
              })                             
            })
            break
          case "login":
            if (req.method.toLowerCase() != "post") {
              return sendError(res, 405, "Method not allowed.", 124643)
            }
            let usernamelog = req.body.username || ""
            let passwordlog = req.body.password || ""
            let emaillog = req.body.email || ""
  
            db.all("SELECT * FROM users WHERE (lower(username) = ? OR lower(email) = ?) AND password_hash == ?", [usernamelog.toLowerCase(), emaillog.toLowerCase(), strhash(passwordlog)], (err, rows) => {
              if (err) {
                console.log(235665)
                console.log(err)
              }
              if (rows.length <= 0) {
                return sendError(res, 400, "Invalid email/username or password.", 39823)
              }
              let acc = rows[0]
              db.all("SELECT * FROM punishments WHERE user_id = ? AND is_active = TRUE AND (expires IS NULL OR expires > strftime('%s') AND type = 'ban')", [acc.id],(err,rows)=>{
                if(rows.length > 0){
                  return res.status(403).json({"message":"Your account has been banned.",code:403,ban:{"reason":rows[0].reason,"expires":rows[0].expires}})
                }
                db.all("UPDATE users SET last_visit_at = strftime('%s') WHERE id = ?", [acc.id], (err, rows) => {
                  if (err) {
                    console.log(87953)
                    console.log(err)
                  }
                  return res.status(200).json({ "message": "Logged in successfully.", "code": 200, "token": acc.token })
                })
              })
              
            })
            break
          case "user":
            if (current_account == null) {
              return sendError(res, 401, "Unauthorized.", 10245)
            }
            let accinfo = {
              "username": current_account.username,
              "id": current_account.id,
              "created_at": current_account.created_at,
              "last_visit_at": current_account.last_visit_at,
              "is_admin": current_account.is_admin
            }
            if (arg1 == null || arg1 == "") {
              return res.status(200).json({ "code": 200, "message": "Fetched account details successfully.", "data": (accinfo) })
            }
            
            if(arg2 == "" || arg2 == null){
              db.all("SELECT * FROM users WHERE id = ?", [arg1], (err, rows) => {
                if (err) {
                  console.log(74886)
                  console.log(err)
                }
                if (rows.length <= 0) {
                  return sendError(res, 404, "Account not found.", 45654)
                }
                let foundacc = rows[0]
                let accinfo = {
                  "username": foundacc.username,
                  "id": foundacc.id,
                  "created_at": foundacc.created_at,
                  "last_visit_at": foundacc.last_visit_at,
                  "is_admin": foundacc.is_admin
                }
                return res.status(200).json({ "code": 200, "message": "Fetched account details successfully.", "data": (accinfo) })})
              }else if(arg2 == "punishments"){
                if(!current_account.is_admin && arg1 != current_account.id){
                  return sendError(res, 403, "Forbidden.", 20334)
                }
                db.all("SELECT punishments.*, users.username AS author_username  FROM punishments JOIN users ON punishments.author_id = users.id WHERE punishments.user_id = ?; ",[arg1],(err,rows)=>{
                  if (err) {
                    console.log(34543)
                    console.log(err)
                  }
  
                  res.status(200).json({message:"Fetched user punishments successfully.", code:200, data:rows})
                })
              }
            break
          case "posts":
            if (current_account == null) {
              return sendError(res, 401, "Unauthorized.", 35788)
            }

            
            if (arg1 == null || arg1 == "") {
              
              let query = "SELECT posts.id, posts.author_id, users.username AS author_username, posts.location, posts.name, posts.created_at, posts.category_id, posts.is_approved, categories.name AS category_name, posts.happening_at, posts.image_url,(SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS likes, CASE WHEN likes.liker_id IS NOT NULL THEN TRUE ELSE FALSE END AS liked_by_you FROM posts JOIN users ON posts.author_id = users.id JOIN categories ON posts.category_id = categories.id LEFT JOIN likes ON likes.post_id = posts.id AND likes.liker_id = ? WHERE posts.is_hidden = FALSE AND posts.is_approved = TRUE "
              let vals = [current_account.id]
              if(req.query.after){
                query += "AND posts.created_at > ? "
                vals.push(req.query.after)
              }

              if(req.query.before){
                query += "AND posts.created_at < ? "
                vals.push(req.query.before)
              }
              
              if(req.query.category && req.query.category != -1){
                query += "AND posts.category_id = ? "
                vals.push(req.query.category)
              }

              query += "ORDER BY posts.created_at DESC";
              db.all(query, vals, (err, rows) => {
                if (err) {
                  console.log(55675)
                  console.log(err)
                }
                if (rows.length <= 0) {
                  return res.status(200).json({ "code": 200, "message": "No posts yet.", "data": [] })
                }
                return res.status(200).json({ "code": 200, "message": "Fetched posts successfully.", "data": rows })
              })
            } else if (arg1 == "submissions") {
  
              if(!current_account.is_admin){
                return sendError(res, 403, "Forbidden.", 20124)
              }
  
              db.all("SELECT posts.id, posts.author_id, users.username AS author_username, posts.location, posts.name, posts.created_at, posts.category_id, posts.is_approved, categories.name AS category_name, posts.happening_at, posts.image_url,(SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS likes, CASE WHEN likes.liker_id IS NOT NULL THEN TRUE ELSE FALSE END AS liked_by_you FROM posts JOIN users ON posts.author_id = users.id JOIN categories ON posts.category_id = categories.id LEFT JOIN likes ON likes.post_id = posts.id AND likes.liker_id = ? WHERE posts.is_approved = FALSE ORDER BY posts.created_at DESC", [current_account.id], (err, rows) => {
                if (err) {
                  console.log(55675)
                  console.log(err)
                }
                if (rows.length <= 0) {
                  return res.status(200).json({ "code": 200, "message": "No posts yet.", "data": [] })
                }
                return res.status(200).json({ "code": 200, "message": "Fetched posts successfully.", "data": rows })
              })
            } else if(arg1 == "approve"){
              if(!current_account.is_admin){
                return sendError(res, 403, "Forbidden.", 20034)
              }
              db.run("UPDATE posts SET is_approved = TRUE WHERE id = ?", arg2,(err)=>{
                if (err) {
                  console.log(34532)
                  console.log(err)
                }
                return res.status(200).json({ "code": 200, "message": "Post approved successfully."})
              })
            } else
            {
              return sendError(res, 400, "Invalid request type.", 35542)
            }
            break
          case "create-post":
            if (current_account == null) {
              return sendError(res, 401, "Unauthorized.", 35788)
            }
  
            if (req.method.toLowerCase() != "post") {
              return sendError(res, 405, "Method not allowed.", 124643)
            }
  
            let createname = req.body.name || ""
            let createlocation = req.body.location || ""
            let createcategory = req.body.category || ""
            let createtime = req.body.time || ""
  
            const lengthregex = /^.{2,120}$/;
            if(!lengthregex.test(createname)){
              return sendError(res, 400, "'Name' has invalid length.", 9492)
            }
            if(!lengthregex.test(createlocation)){
              return sendError(res, 400, "'Location' has invalid length.", 2453)
            }
            if(isNaN(createtime) || createtime <= ((+ new Date()) /1000)){
              return sendError(res, 400, "'Time' has invalid timestamp.",4654)
            }
  
            if(isNaN(createcategory)){
              return sendError(res, 400, "Invalid category.",6542)
            }
            function after2(imageurl){
  
              db.run("INSERT INTO posts (author_id, created_at, name, location, happening_at, image_url, category_id) VALUES (?, strftime('%s'), ?, ?, ?, ?, ?)",
                [current_account.id, createname, createlocation, createtime, imageurl, createcategory], (err)=>{
                  if (err) {
                    console.log(35432)
                    console.log(err)
                  }
                }
              )
  
              return res.status(200).json({"message":"Post was submitted successfully, please wait for webiste administrators to approve your post."})
            }
            db.all("SELECT * FROM punishments WHERE user_id = ? AND is_active = TRUE AND (expires IS NULL OR expires > strftime('%s') AND type = 'mute')",[current_account.id],(err,rows)=>{
              if (err) {
                console.log(21614)
                console.log(err)
              }
              if(rows.length > 0){
                return res.status(200).json({message:"You have been muted from posting events.", code:200, mute:{reason:rows[0].reason,expires:rows[0].expires}})
              }
              db.all("SELECT * FROM categories WHERE id = ? AND is_hidden = FALSE AND is_approved = TRUE",[createcategory],(err,rows)=>{
                if (err) {
                  console.log(21544)
                  console.log(err)
                }
                if(rows.length <= 0){
                  return sendError(res, 400, "Invalid category.")
                }
                if(req.file){
                  uploadFile(req.file.path,(res)=>{
                    deleteFile(req.file.path)
                    after2(res.data.files[0].url)
                  })
                }else{
                  after2("https://qu.ax/BSogD.png")
                }
              })
          })
            
            break
          case "create-category":
            if (current_account == null) {
              return sendError(res, 401, "Unauthorized.", 23545)
            }
  
            if (!current_account.is_admin) {
              return sendError(res, 403, "Forbidden.", 23544)
            }
            let categoryname = req.body.name || ""
            
            if(!/^.{2,120}$/.test(categoryname)){
              return sendError(res, 400, "'Name' has invalid length.", 9492)
            }
  
            db.run("INSERT INTO categories (author_id, name, created_at, is_approved, is_hidden) VALUES (?, ?, strftime('%s'), TRUE, FALSE)",[current_account.id, categoryname],(e)=>{
              if (err) {
                console.log(54323)
                console.log(err)
              }
              return res.status(200).json({"message":"Category created successfully.","code":200})
            })
            break
          case "category":
            if (current_account == null) {
              return sendError(res, 401, "Unauthorized.", 23545)
            }
            switch(req.method.toLowerCase()){
              case "get":
                  db.all("SELECT * FROM categories WHERE id = ? "+(!current_account.is_admin ? "AND is_hidden = FALSE AND is_approved = TRUE" : ""), [arg1],(err,rows)=>{
                    if (err) {
                      console.log(544654)
                      console.log(err)
                    }
                    if(rows.length <= 0){
                      return sendError(res, 404, "Not found.", 54354)
                    }else{
                      return res.status(200).json({"code":200,"message":"Fetched category successfully.","data":rows[0]})
                    }
                  })
                break
              case "delete":
                if (!current_account.is_admin) {
                  return sendError(res, 403, "Forbidden.", 35432)
                }
                db.run("DELETE FROM categories WHERE id = ?",[arg1],(err)=>{
                  if (err) {
                    console.log(54346)
                    console.log(err)
                  }
                  
                  return res.status(200).json({"message":"Category deleted successfully.", code:200})
                  
                })
                break
              default:
                return sendError(res, 405, "Method not allowed.", 57392)
            }
            break
          case "categories":
            if (current_account == null) {
              return sendError(res, 401, "Unauthorized.", 23543)
            }
  
            db.all("SELECT id, name FROM categories WHERE is_hidden = FALSE AND is_approved = TRUE",(err,rows)=>{
              if (err) {
                console.log(55644)
                console.log(err)
              }
              return res.status(200).json({"message":"Fetched categories successsfully.","code":200,"data":rows})
            })
            break
          case "logout":
            if (current_account == null) {
              return sendError(res, 401, "Unauthorized.", 35788)
            }
            let token = b64e(current_account.id).replaceAll("=", "") + "." + randomString(16)
            db.run("UPDATE users SET token = ? WHERE id = ?",[token, current_account.id],(err)=>{
              if (err) {
                console.log(45663)
                console.log(err)
              }
              return res.status(200).json({"message":"Logged out successsfully.","code":200})
            })
            break
          case "post":
            if (current_account == null) {
              return sendError(res, 401, "Unauthorized.", 35788)
            }
            if (req.method.toLowerCase() == "get") {
              if((arg1 == null || arg1 == "") && (arg2 == null && arg2 == "")){
                    if(current_account.is_admin){
                        db.all("SELECT posts.id, posts.author_id, users.username AS author_username, posts.location, posts.name, posts.created_at, posts.category_id, posts.is_approved, categories.name AS category_name, posts.happening_at, posts.image_url, COUNT(likes.id) AS likes_count FROM posts JOIN users ON posts.author_id = users.id JOIN categories ON posts.category_id = categories.id LEFT JOIN likes ON posts.id = likes.post_id WHERE posts.id = ? GROUP BY posts.id ORDER BY posts.created_at DESC;", [arg1], (err, rows) => {
                        if (err) {
                            console.log(43456)
                            console.log(err)
                        }
                        if(rows.length <= 0){
                            return sendError(res, 404, "Not found.", 35788)
                        }else{
                            return res.status(200).json({"message":"Fetched post data successfully.", "code":200,"data":rows[0]})
                        }
                        })
                    }else{
                        db.all("SELECT posts.id, posts.author_id, users.username AS author_username, posts.location, posts.name, posts.created_at, posts.category_id, posts.is_approved, categories.name AS category_name, posts.happening_at, posts.image_url, COUNT(likes.id) AS likes_count FROM posts JOIN users ON posts.author_id = users.id JOIN categories ON posts.category_id = categories.id LEFT JOIN likes ON posts.id = likes.post_id WHERE posts.is_hidden = FALSE AND posts.is_approved = TRUE AND posts.id = ? GROUP BY posts.id ORDER BY posts.created_at DESC;", [arg1], (err, rows) => {
                        if (err) {
                            console.log(43457)
                            console.log(err)
                        }
                        if(rows.length <= 0){
                            return sendError(res, 404, "Not found.", 35789)
                        }else{
                            return res.status(200).json({"message":"Fetched post data successfully.", "code":200,"data":rows[0]})
                        }
                        })
                    }
                }else{
                    if(arg2 == "like"){
                        db.all("SELECT * FROM likes WHERE liker_id = ? AND post_id = ?", [current_account.id, arg1],(err, rows)=>{
                            if (err) {
                                console.log(34563)
                                console.log(err)
                            }
                            if(rows.length > 0){
                                db.run("DELETE FROM likes WHERE id = ?",[rows[0].id],(err)=>{
                                    if (err) {
                                        console.log(3567754)
                                        console.log(err)
                                    }
                                    db.all("SELECT count(*) AS likes FROM likes WHERE post_id = ?",[arg1],(err,rows)=>{
                                        if (err) {
                                            console.log(35673)
                                            console.log(err)
                                        }
                                        return res.status(200).json({"message":"Unliked successfully.","code":200, "likes":rows[0].likes})
                                    })
                                })
                            }else{
                                db.run("INSERT INTO likes (liker_id, post_id, created_at) VALUES (?, ?, strftime(\"%s\"))",[current_account.id, arg1],(err)=>{
                                    if (err) {
                                        console.log(356774)
                                        console.log(err)
                                    }
                                    db.all("SELECT count(*) AS likes FROM likes WHERE post_id = ?",[arg1],(err,rows)=>{
                                        if (err) {
                                            console.log(356773)
                                            console.log(err)
                                        }
                                        return res.status(200).json({"message":"Liked successfully.","code":200, "likes":rows[0].likes})
                                    })
                                    
                                })
                            }
                        })
                    }
                }
            }else if (req.method.toLowerCase() == "delete") {
              if(current_account.is_admin){
                db.run("DELETE FROM posts WHERE id = ?",[arg1],(err)=>{
                  if (err) {
                    console.log(34432)
                    console.log(err)
                  }
                  if(this.changes >0){
                    return res.status(200).json({"message":"Post deleted successfully.", code:200})
                  }else{
                    return res.status(200).json({"message":"No posts were deleted.", code:200})
                  }
                })
              }else{
                db.run("DELETE FROM posts WHERE id = ? AND author_id = ?",[arg1, current_account.id],(err)=>{
                  if (err) {
                    console.log(23433)
                    console.log(err)
                  }
                  if(this.changes >0){
                    return res.status(200).json({"message":"Post deleted successfully.", code:200})
                  }else{
                    return res.status(200).json({"message":"No posts were deleted.", code:200})
                  }
                })
              }
              }else if (req.method.toLowerCase() == "put") {
                
                  db.all("SELECT posts.id, posts.author_id, users.username AS author_username, posts.location, posts.name, posts.created_at, posts.category_id, posts.is_approved, categories.name AS category_name, posts.happening_at, posts.image_url FROM posts JOIN users ON posts.author_id = users.id JOIN categories ON posts.category_id = categories.id WHERE posts.id = ? ORDER BY posts.created_at DESC;", [arg1], (err, rows) => {
                    if (err) {
                      console.log(43459)
                      console.log(err)
                    }
                    if(!current_account.is_admin && rows[0].author_id != current_account.id){
                      return sendError(res, 403, "You do not have permission to edit this post.", 35791)
                    }
                    if(rows.length <= 0){
                      return sendError(res, 404, "Not found.", 35788)
                    }else{
                      let current_post = rows[0]
                      let editname = req.body.name || ""
                      let editlocation = req.body.location || ""
                      let editcategory = req.body.category || ""
                      let edittime = req.body.time || ""
  
                      const lengthregex = /^.{2,120}$/;
                      if(!lengthregex.test(editname)){
                        return sendError(res, 400, "'Name' has invalid length.", 9494)
                      }
                      if(!lengthregex.test(editlocation)){
                        return sendError(res, 400, "'Location' has invalid length. ", 2456)
                      }
                      if(isNaN(edittime) || edittime <= ((+ new Date()) /1000)){
                        return sendError(res, 400, "'Time' has invalid timestamp.",4656)
                      }
  
                      if(isNaN(editcategory)){
                        return sendError(res, 400, "Invalid category.",6547)
                      }
                      function after3(imageurl){
                        db.run("UPDATE posts SET name = ?, location = ?, happening_at = ?, image_url = ?, category_id = ? WHERE id = ?",
                          [editname, editlocation, edittime, imageurl, editcategory, current_post.id], (err)=>{
                            if (err) {
                              console.log(35433)
                              console.log(err)
                            }
                            db.all("SELECT posts.id, posts.author_id, users.username AS author_username, posts.location, posts.name, posts.created_at, posts.category_id, posts.is_approved, categories.name AS category_name, posts.happening_at, posts.image_url FROM posts JOIN users ON posts.author_id = users.id JOIN categories ON posts.category_id = categories.id WHERE posts.id = ? ORDER BY posts.created_at DESC;", [arg1], (err, rows) => {
                              if (err) {
                                console.log(35435)
                                console.log(err)
                              }
                              return res.status(200).json({"message":"Post was editted successfully.", data:rows[0]})
                            })
                          }
                        )
                        
                        
                      }
                      
                      db.all("SELECT * FROM categories WHERE id = ? AND is_hidden = FALSE AND is_approved = TRUE",[editcategory],(err,rows)=>{
                        if (err) {
                          console.log(21545)
                          console.log(err)
                        }
                        if(rows.length <= 0){
                          return sendError(res, 400, "Invalid category.", 65432)
                        }
                        if(req.file){
                          uploadFile(req.file.path,(res)=>{
                            deleteFile(req.file.path)
                            after3(res.data.files[0].url)
                          })
                        }else{
                          after3(current_post.image_url)
                        }
                      })
                    }
                  })
                
                
            }else{
              return sendError(res, 405, "Method not allowed.", 124643)
            }
            break
          case "search-users":
            if (current_account == null) {
              return sendError(res, 401, "Unauthorized.", 10275)
            }
            if(arg1 == "" || arg1 == null){
              return sendError(res, 400, "Search query is empty.", 10246)
            }
  
            db.all("SELECT id, username, created_at, last_visit_at, is_admin FROM users WHERE lower(username) LIKE ? OR id = ?",[arg1.toLowerCase() + "%", (!isNaN(arg1) ? Number(arg1) : arg1) ],(err,rows)=>{
              if (err) {
                console.log(26654)
                console.log(err)
              }
              return res.status(200).json({"message":"Successfully found users.","code":200,"data":rows})
            })
            break
          case "punishment":
            if (current_account == null) {
              return sendError(res, 401, "Unauthorized.", 35788)
            }
            switch(req.method.toLowerCase()){
              case "get":
                db.all("SELECT punishments.*, users.username AS author_username  FROM punishments  JOIN users ON punishments.author_id = users.id  WHERE punishments.id = ?;",[arg1],(err,rows)=>{
                  if (err) {
                    console.log(26354)
                    console.log(err)
                  }
                  if(rows.length > 0){
                    if(rows[0].user_id == current_account.id || rows[0].author_id == current_account.id || current_account.is_admin){
                      return res.status(200).json({"message":"Fetched punishment successfully.", "code":200, "data":rows[0]})
                    }else{
                      return sendError(res,403,"Forbidden.",3543);
                    }
                  }else{
                    return sendError(res,404,"No punishment found by ID.",3543);
                  }
                })
                break
              case "patch":
                if(!current_account.is_admin){
                  return sendError(res,403,"Forbidden.",35434);
                }
                db.run("UPDATE punishments SET is_active = NOT is_active WHERE id = ?;",[arg1],(err)=>{
                  if (err) {
                    console.log(22354)
                    console.log(err)
                  }
                  return res.status(200).json({"message":"Toggled punishment's is_active property successfully.","code":200})
                })
                break
              case "post":
                if(!current_account.is_admin){
                  return sendError(res,403,"Forbidden.",35434);
                }
                let target_user = req.body.user_id
                let expires = req.body.expires || null
                let type = req.body.type.toLowerCase()
                let reason = req.body.reason
                if(isNaN(target_user)){
                  return sendError(res,400,"Invalid user ID.",33434);
                }
  
                if(type != "mute" && type != "ban"){
                  return sendError(res,400,"Invalid punishment type, has to be either 'mute' or 'ban'.",31434);
                }
                
                if(expires != null && expires < ((+ new Date()) / 1000)){
                  return sendError(res,400,"Invalid expiration date.",31434);
                }
                let query = "INSERT INTO punishments (author_id, user_id, type, created_at, expires) VALUES (?, ?, ?, strftime('%s'), ?)"
                let values = [current_account.id, target_user, type, expires]
                if(reason){
                  values.push(reason)
                  query = "INSERT INTO punishments (author_id, user_id, type, created_at, expires, reason) VALUES (?, ?, ?, strftime('%s'), ?, ?)"
                }
                
                db.run(query, values,(err)=>{
                  if (err) {
                    console.log(22354)
                    console.log(err)
                  }
                  if(type== "ban"){
                    let newtoken = b64e(target_user).replaceAll("=","") +"."+randomString(16)
                    db.run("UPDATE users SET token = ? WHERE id = ?",[newtoken, target_user],(err)=>{
                      if (err) {
                        console.log(22324)
                        console.log(err)
                      }
                      return res.status(200).json({"message":"Punished user successfully.",code:200});
                    })
                  }else{
                    return res.status(200).json({"message":"Punished user successfully.",code:200});
                  }
                  
                })
                break
              default:
                return sendError(res, 405, "Method not allowed.", 126643)
            }
            break
          default:
            return sendError(res, 400, "Invalid request type.", 102)
        }
      }
    })
  })
  

  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
  })