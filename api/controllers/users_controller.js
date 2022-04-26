const Exception = require('../../lib/exception');
const Response = require('../../lib/response');
const Utils = require('../../lib/utils');
const User = require('../models/user');
const Category = require('../models/category');
const validator = require('validator');
const AWS = require('aws-sdk');
const path = require('path');
const Moment = require('moment');
const lodash = require('lodash');
const Hashes = require('jshashes');
const MD5 = new Hashes.MD5;
const moment = require('moment-timezone');
const { LOGINTYPE } = require('../../lib/constant');
const { ObjectId } = require('mongodb'); // or ObjectID
const EmailTemplates = require('email-templates');
const SMTP = require('../../lib/smtp');
const { jwtSignUser } = require('../../lib/helper');
const fs = require('fs');
const Imagemagick = require('imagemagick');
const Email = require('email-templates');

const convertImage = async (path, key) => {
    return new Promise((resolve, reject) => {
        Imagemagick.resize(
            {
                srcData: fs.readFileSync(path, 'binary'),
                width: 300,
                height: 160
            },
            function (err, stdout) {
                if (err) {
                    reject(err)
                }
                fs.writeFileSync('/tmp/thumbnail_' + key, stdout, 'binary');
                resolve('/tmp/thumbnail_' + key);
            });
    })
}

// AWS.config.update({
//     accessKeyId: global.CONFIG['aws']['S3_BUCKET_ACCESS_KEY_ID'],
//     secretAccessKey: global.CONFIG['aws']['S3_BUCKET_SECRET_ACCESS_KEY'],
//     region: global.CONFIG['aws']['REGION'],
// });

// const s3bucket = new AWS.S3({
//     params: { Bucket: global.CONFIG['aws']['S3_BUCKET_IMAGES_PROFILEIMAGE'] },
// });

const fileUpload = async (file) => {
    let fileContentType = file.headers['content-type'];
    let contentType = 'application/octet-stream';
    contentType = fileContentType;
    const fileName = file.filename;
    const key = fileName.replace(/ /g, '_');
    let data = fs.readFileSync(file.path);
    let thumbnailData = '';
    let thumbnailKey = 'thumbnail' + key;
    if (global.CONFIG['contentType']['image'].includes(fileContentType) === true) {
        const thumbnailPath = await convertImage(file.path, key);
        thumbnailData = fs.readFileSync(thumbnailPath);

        let bucketName = global.CONFIG['aws']['S3_BUCKET_IMAGES_PROFILEIMAGE'];
        let originalUpload = await uploadImageToS3(`${key}`, data, bucketName, contentType);
        fs.unlinkSync(file.path);
        let originalThumbnailUpload = await uploadImageToS3(`${thumbnailKey}`, thumbnailData, bucketName, contentType);
        fs.unlinkSync(thumbnailPath);
        return [originalUpload, originalThumbnailUpload];
    }
}

const fileSize = async (file) => {
    let size = false;
    let fileSize = file.bytes;
    const fileContentType = file.headers['content-type'];
    if (global.CONFIG['contentType']['image'].includes(fileContentType) === true) {
        if (fileSize > global.CONFIG['fileSize']['image']) {
            size = true;
        }
    }
    return size;
}

const uploadImageToS3 = (key, data, bucketName, contentType) => new Promise((resolve, reject) => {
    const params = {
        Key: key,
        Body: data,
        ContentType: contentType,
        Bucket: bucketName,
        ACL: 'public-read',

    };
    s3bucket.upload(params, async (error, fileInfo) => {

        if (error) {
            return reject(error);
        }
        return resolve(fileInfo.Location);
    });

});

exports.votemeSignUp = async (req, res) => {
    try {
        const param = req.body;
        const firstName = param.FirstName;
        const lastName = param.LastName;
        const email = param.Email;
        const mobile = param.Mobile;
        const dob = param.BirthDate;
        const type = param.Type;
        const token = param.Token; // For Google Token
        const image = param.Image;

        // if (!image) {
        //     return new Exception('ValidationError', 'Please Provide Image').sendError();
        // }
        if (!email) {
            return new Exception('ValidationError', 'Please Provide Email Id').sendError();
        }
        if (!validator.isEmail(email)) {
            return new Exception('ValidationError', 'Please Provide Valid Email Id').sendError();
        }
        if (!token) {
            return new Exception('ValidationError', 'Please Provide Token').sendError();
        }
        if (!LOGINTYPE[param.Type]) {
            return new Exception('ValidationError', 'Please Provide Valid LoginType').sendError();
        }

        const userDetail = await User.findOne({ "Email": email, "Token": token }).lean();
        const tokenExpireIn = Moment().add(global.CONFIG['token']['expired'], 'minutes').unix();
        if (userDetail) {
            if (!userDetail.AuthoToken) {
                const generatedToken = jwtSignUser({ _id: userDetail._id, Email: userDetail.Email });
                await User.updateOne({
                    _id: userDetail._id,
                }, {
                    $set: {
                        AuthoToken: generatedToken,
                        TokenExpireIn: tokenExpireIn
                    }
                });
            }

            const now = Moment().unix();
            const tokenExpired = userDetail.TokenExpireIn;
            const difference = tokenExpired - now;
            if (userDetail.AuthoToken && difference < global.CONFIG['token']['expired']) {
                const generatedToken = jwtSignUser({ _id: userDetail._id, Email: userDetail.Email });
                await User.updateOne({
                    _id: userDetail._id,
                }, {
                    $set: {
                        AuthoToken: generatedToken,
                        TokenExpireIn: tokenExpireIn
                    }
                });
            }
            const userDetailUpdate = await User.findOne({ "Email": email, "Token": token }).lean();
            const categoryArray = [];
            if (!userDetailUpdate.Category) {
                await User.updateOne({
                    _id: userDetail._id,
                }, {
                    $set: {
                        Category: []
                    }
                });
            } else {
                for (let i = 0; i < userDetailUpdate.Category.length; i++) {
                    const categoryId = userDetailUpdate.Category[i];
                    const result = await Category.findOne({ "_id": categoryId }).lean();
                    if (result) {
                        delete result.Active;
                        categoryArray.push(result);
                    }
                }
            }

            userDetailUpdate.Category = categoryArray;

            res.send({
                status: "Success",
                Data: {
                    user: userDetailUpdate,
                    AuthoToken: userDetailUpdate.AuthoToken,
                    TokenExpireIn: userDetailUpdate.TokenExpireIn,
                    message: 'User is already exists'
                }
            })
        } else {
            const postData = {};
            if (image === "") {
                postData.Image = image;
            } else {
                postData.Image = image;
            }
            postData.FirstName = firstName;
            postData.LastName = lastName;
            postData.Mobile = mobile;
            postData.Email = email;
            postData.Type = type;
            postData.Token = token;
            postData.Status = true;
            postData.CreatedAt = new Moment();
            postData.UpdatedAt = new Moment();
            if (dob) {
                postData.BirthDate = Moment.utc(dob, 'DD/MM/YYYY').local();
            }

            const userObj = new User(postData);
            const result = await userObj.save();
            const userDetail = await User.findOne({ "Email": email, "Token": token }).lean();
            const categoryArray = [];
            for (let i = 0; i < userDetail.Category.length; i++) {
                const categoryId = userDetail.Category[i];
                const result = await Category.findOne({ "_id": categoryId }).lean();
                if (result) {
                    delete result.Active;
                    delete result.CreatedAt;
                    categoryArray.push(result);
                }
            }
            userDetail.Category = categoryArray;

            const generatedToken = jwtSignUser({ _id: result._id, Email: result.Email });
            const templatesDir = path.resolve(global.ROOT_PATH, 'templates');
            const emailContent = new EmailTemplates({ views: { root: templatesDir } });
            const objForEmail = {

                Name: result.FirstName + ' ' + result.LastName,
                URL: global.CONFIG['SMTP']['baseURL']

            };
            const mailOptions = {
                from: global.CONFIG['SMTP']['from'], // sender address
                to: email, // list of receivers
                subject: 'Registered successfully', // Subject line
                html: await emailContent.render('users/welcome-email.ejs', objForEmail)// plaintext body,
            };
            const transporter = new SMTP().transporter;
            await transporter.sendMail(mailOptions);
            //userDetail.BirthDate = Moment(userDetail.BirthDate).format('DD/MM/YYYY');
            await User.updateOne({
                _id: result._id,
            }, {
                $set: {
                    AuthoToken: generatedToken,
                    TokenExpireIn: tokenExpireIn
                }
            })
            res.send({
                status: "Success",
                Data: {
                    user: userDetail,
                    AuthoToken: generatedToken,
                    TokenExpireIn: tokenExpireIn,
                    message: 'Awesome! user registered successfully'
                }

            })

        }
    } catch (error) {
        console.log(error);
        if (error.code == 11000 && error.errmsg.search("Token_1 dup key") !== -1) {
            return new Exception('GeneralError', 'Sorry! Token is already exists, please try again with new Token.').sendError();

        }
        if (error.code == 11000 && error.errmsg.search("Email_1 dup key") !== -1) {
            return new Exception('GeneralError', 'Provided Email Already Exists. Please Register With Other Email.').sendError();

        }
        return new Exception('GeneralError').sendError(error);
    }
}

exports.updateProfile = async (req, res) => {
    try {
        const id = req.params.id;
        const firstName = req.body.FirstName;
        const lastName = req.body.LastName;
        const mobile = req.body.Mobile;
        const dob = req.body.BirthDate;
        const image = req.body.Image;
        if (!firstName) {
            return new Exception('ValidationError', 'Please Provide First Name').sendError();
        }
        if (!lastName) {
            return new Exception('ValidationError', 'Please Provide Last Name').sendError();
        }
        if (!dob) {
            return new Exception('ValidationError', 'Please Provide Date of Birth').sendError();
        } else {

            if (!Moment(dob, 'DD/MM/YYYY', true).isValid()) {
                return new Exception('ValidationError', 'Date of Birth Must Be DD/MM/YYYY').sendError();
            }
        }
        if (image && global.CONFIG['extension'].includes(path.extname(image.filename)) === false) {
            return new Exception('ValidationError', 'Please Provide Valid input type of Image').sendError();
        } else if (image) {
            const size = await fileSize(image);
            if (size == true) {
                return new Exception('ValidationError', 'Please Provide Valid size of Image').sendError();
            }
        }

        // if (image) {
        // let filepath = await fileUpload(image);
        await User.updateOne({
            _id: id
        }, {
            $set: {
                "FirstName": firstName,
                "LastName": lastName,
                "Mobile": mobile,
                // "Category":finalCategoryArray,
                // "Image": filepath[0],
                // "ThumbnailURL": filepath[1],
                // "MimeType": image.headers['content-type'],
                "BirthDate": Moment.utc(dob, 'DD/MM/YYYY').local(),
                "UpdatedAt": new Moment()
            }
        });
        // }

        return res.send({ message: 'Awesome! user updated successfully' });
    } catch (error) {
        if (error.code == 11000 && error.errmsg.search("Token_1 dup key") !== -1) {
            return new Exception('GeneralError', 'Sorry! Token is already exists, please try again with new Token.').sendError();

        }
        if (error.code == 11000 && error.errmsg.search("Email_1 dup key") !== -1) {
            return new Exception('GeneralError', 'Provided Email Already Exists. please try again with new Email.').sendError();

        }
        return new Exception('GeneralError').sendError(error);
    }
}

exports.updateUserCategory = async (req, res) => {
    try {
        const authToken = req.headers.authorization.split(' ')[1];
        const category = req.body.Category;

        const user = await User.findOne({ "AuthoToken": authToken }).lean();
        const userCategory = [];
        const finalCategoryArray = [];
        for (let i = 0; i < category.length; i++) {
            if (category[i].length === 24) {
                const categoryArray = await Category.findOne({ "_id": category[i] }).lean();
                if (categoryArray) {
                    const categoryObject = {};
                    categoryObject._id = categoryArray._id;
                    categoryObject.CategoryName = categoryArray.CategoryName;
                    categoryObject.Image = categoryArray.Image;
                    categoryObject.ThumbnailURL = categoryArray.ThumbnailURL;
                    categoryObject.MimeType = categoryArray.MimeType;
                    categoryObject.Active = categoryArray.Active;
                    userCategory.push(categoryObject);
                    finalCategoryArray.push(category[i]);
                }
            }
        }

        await User.findOneAndUpdate({
            "_id": user._id,
        }, {
            $set: {
                Category: finalCategoryArray
            }
        });

        return res.send({ message: "Success", Data: userCategory });

    } catch (error) {

        return new Exception('GeneralError').sendError(error);
    }
}

exports.getProfile = async (req, res) => {
    try {
        const id = req.params.id;
        const userDetail = await User.findOne({ "_id": id }).lean();
        userDetail.BirthDate = Moment(userDetail.BirthDate, 'DD/MM/YYYY');
        delete userDetail.AuthoToken;
        return res.send({ message: "Success", Data: userDetail });
    } catch (error) {
        console.log(error)
        return new Exception('GeneralError').sendError(error);
    }
}

exports.getUsers = async (req, res) => {
    try {

        let page = parseInt(req.query.PageNo) || 1;
        let maxRecords = parseInt(req.query.Rows) || 10;

        const pageNumber = ((parseInt(page) - 1) * parseInt(maxRecords));

        let date = req.query.Date;
        if (page === undefined || page === null || page === '') {
            page = 1;
        }
        if (maxRecords === undefined || maxRecords === null || maxRecords === '') {
            maxRecords = 50;
        }
        let sortyQueryObject = {};
        if (!date) {
            sortyQueryObject.CreatedAt = -1;
        }
        const queryObj = {};

        const result = await User.aggregate(
            [{ $match: queryObj },
            {
                $project: {

                    "FirstName": 1,
                    "LastName": 1,
                    "Email": 1,
                    "Status": 1,
                    "CreatedAt": 1,
                    "UpdatedAt": 1

                }
            },
            { $sort: { CreatedAt: -1 } },
            {
                '$facet': {
                    Summary: [{ $count: "TotalRecords" }, { $addFields: { Page: parseInt(page) } }],
                    Records: [{ $skip: pageNumber }, { $limit: parseInt(maxRecords, 10) }] // add projection here wish you re-shape the docs
                }
            }
            ]
        );
        let responseObject = {};
        responseObject.Summary = result[0].Summary;
        responseObject.Records = [];
        return res.send({ message: "Success", Data: result });

    } catch (error) {
        return new Exception('GeneralError').sendError(error);
    }
}

exports.deleteUserProfile = async (req, res) => {
    try {
        const id = req.params.id;
        await User.remove({
            _id: id
        });
        return res.send({ message: "User deleted successfully!!" });
    } catch (e) {
        return new Exception('GeneralError').sendError(e);
    }
}

exports.logout = async (req, res) => {
    try {
        const authToken = req.headers.authorization.split(' ')[1];
        const userDetail = await User.findOne({ "AuthoToken": authToken }).lean();
        await User.update(
            { "_id": userDetail._id },
            { $unset: { Token: "Token" } })
        return res.send({ message: "User logout successfully!!" });
    } catch (e) {
        console.log(e);
        return new Exception('GeneralError').sendError(e);
    }
}

