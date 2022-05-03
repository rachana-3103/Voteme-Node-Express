const Exception = require('../../lib/exception');
const Response = require('../../lib/response');
const Utils = require('../../lib/utils');
const User = require('../models/user');
const QueryLikeorDisLike = require('../models/query_likeordislike');
const QueryComment = require('../models/query_comments');
const Queryview = require('../models/query_views');
const Moment = require('moment');
const Query = require('../models/query');
const QueryOption = require('../models/queryoption');
const { ObjectId } = require('mongodb'); // or ObjectID
const fs = require('fs');
const { QUERYSEARCHTYPE, CHARTOPTIONTYPE } = require('../../lib/constant');
const AWS = require('aws-sdk');
const path = require('path');
const Category = require('../models/category');
const Imagemagick = require('imagemagick');
const ThumbnailGenerator = require('video-thumbnail-generator').default;
const Invitee = require('../models/invitee');
const QueryComments = require('../models/query_comments');
const QueryLikeOrDislkie = require('../models/query_likeordislike');

const videoThumbnail = async (path, key) => {
    return new Promise((resolve, reject) => {
        // console.log({
        //     sourcePath: path,
        //     thumbnailPath: '/tmp/thumbnail_'+key,
        //     tmpDir: '/tmp'
        // });
        const tg = new ThumbnailGenerator({
            sourcePath: path,
            thumbnailPath: '/tmp'
        });
        tg.generate({
            size: '260x160'
        }).then(result => {
            // console.log(result,'........'); // Success!
            resolve(result[0]);
        }, reason => {
            console.error(reason); // Error!
            reject(reason)
        });
        // tg.generateOneByPercentCb(90, (err, result) => {
        //     if(err){
        //         reject(err)
        //     }
        //     resolve(result);
        //     // 'test-thumbnail-320x240-0001.png'
        // });
    })

}

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
const fileUpload = async (file, isQuery) => {
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
        let bucketName = '';
        let originalUpload = '';
        let originalThumbnailUpload = '';
        if (isQuery === true) {
            bucketName = global.CONFIG['aws']['S3_BUCKET_QUERYIMAGES'] + '/QueryImages';
        }
        if (isQuery === false) {
            bucketName = global.CONFIG['aws']['S3_BUCKET_QUERYIMAGES'] + '/QueryImagesOption';
        }

        originalUpload = await uploadImageToS3(`${key}`, data, bucketName, contentType);
        // 'https://voteme-development-images.s3.ap-south-1.amazonaws.com/QueryImages/store_logo.png';//await uploadImageToS3(`${key}`, data, bucketName, contentType);
        fs.unlinkSync(file.path);
        originalThumbnailUpload = await uploadImageToS3(`${thumbnailKey}`, thumbnailData, bucketName, contentType);
        // 'https://voteme-development-images.s3.ap-south-1.amazonaws.com/QueryImages/thumbnailstore_logo.png';// await uploadImageToS3(`${thumbnailKey}`, thumbnailData, bucketName, contentType);
        fs.unlinkSync(thumbnailPath);
        return [originalUpload, originalThumbnailUpload];
    }

    else if (global.CONFIG['contentType']['audio'].includes(fileContentType) === true) {
        let bucketName = '';
        let originalUpload = '';
        let originalThumbnailUpload = '';
        if (isQuery === true) {
            bucketName = global.CONFIG['aws']['S3_BUCKET_QUERYAUDIOS'] + '/Queryaudios';
        }
        if (isQuery === false) {
            bucketName = global.CONFIG['aws']['S3_BUCKET_QUERYAUDIOS'] + '/QueryaudiosOption';
        }
        originalUpload = await uploadImageToS3(`${key}`, data, bucketName, contentType);
        // 'https://voteme-development-audios.s3.ap-south-1.amazonaws.com/Queryaudios/Prince%27s.mp3';//await uploadImageToS3(`${key}`, data, bucketName, contentType);
        fs.unlinkSync(file.path);
        return [originalUpload, originalThumbnailUpload];
    }

    else if (global.CONFIG['contentType']['video'].includes(fileContentType) === true) {
        let bucketName = '';
        let originalUpload = '';
        let originalThumbnailUpload = '';

        const thumbnailPath = await videoThumbnail(file.path, key);
        thumbnailKey = thumbnailPath.replace(/ /g, '_')
        thumbnailData = fs.readFileSync('/tmp/' + thumbnailPath);

        if (isQuery === true) {
            bucketName = global.CONFIG['aws']['S3_BUCKET_QUERYVIDEOS'] + '/Queryvideos';
        }
        if (isQuery === false) {
            bucketName = global.CONFIG['aws']['S3_BUCKET_QUERYVIDEOS'] + '/QueryvideosOption';
        }

        originalUpload = await uploadImageToS3(`${key}`, data, bucketName, contentType);
        // 'https://voteme-development-videos.s3.ap-south-1.amazonaws.com/Queryvideos/VID-20171224-WA0002.mp4';// await uploadImageToS3(`${key}`, data, bucketName, contentType);
        fs.unlinkSync(file.path);
        originalThumbnailUpload = await uploadImageToS3(`${thumbnailKey}`, thumbnailData, bucketName, contentType);
        // 'https://voteme-development-videos.s3.ap-south-1.amazonaws.com/Queryvideos/1603863439414-11819-ef974ab64f66a983-thumbnail-260x160-0001.png';//await uploadImageToS3(`${thumbnailKey}`, thumbnailData, bucketName, contentType);

        fs.unlinkSync('/tmp/' + thumbnailPath);
        return [originalUpload, originalThumbnailUpload];
    }
}


const fileRemove = async (filepath, mimeType, isQuery) => {
    let key = filepath;
    if (global.CONFIG['contentType']['image'].includes(mimeType) === true) {
        let bucketName = '';
        if (isQuery === true) {
            bucketName = global.CONFIG['aws']['S3_BUCKET_QUERYIMAGES'] + '/QueryImages';
        }
        if (isQuery === false) {
            bucketName = global.CONFIG['aws']['S3_BUCKET_QUERYIMAGES'] + '/QueryImagesOption';
        }
        if (isQuery === null) {
            bucketName = global.CONFIG['aws']['S3_BUCKET_IMAGES_PROFILEIMAGE'];
        }
        await removeImageToS3(`${key}`, bucketName);
    }
    if (global.CONFIG['contentType']['audio'].includes(mimeType) === true) {
        let bucketName = '';
        if (isQuery === true) {
            bucketName = global.CONFIG['aws']['S3_BUCKET_QUERYAUDIOS'] + '/Queryaudios';
        }
        if (isQuery === false) {
            bucketName = global.CONFIG['aws']['S3_BUCKET_QUERYAUDIOS'] + '/QueryaudiosOption';
        }
        await removeImageToS3(`${key}`, bucketName);
    }
    if (global.CONFIG['contentType']['video'].includes(mimeType) === true) {
        let bucketName = '';
        if (isQuery === true) {
            bucketName = global.CONFIG['aws']['S3_BUCKET_QUERYVIDEOS'] + '/Queryvideos';
        }
        if (isQuery === false) {
            bucketName = global.CONFIG['aws']['S3_BUCKET_QUERYVIDEOS'] + '/QueryvideosOption';
        }
        await removeImageToS3(`${key}`, bucketName);
    }
}

// AWS.config.update({
//     accessKeyId: global.CONFIG['aws']['S3_BUCKET_ACCESS_KEY_ID'],
//     secretAccessKey: global.CONFIG['aws']['S3_BUCKET_SECRET_ACCESS_KEY'],
//     region: global.CONFIG['aws']['REGION'],
// });

// const s3bucket = new AWS.S3({
//     params: global.CONFIG['aws']['S3_BUCKET_IMAGES_PROFILEIMAGE']
// });

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

const removeImageToS3 = (key, bucketName) => new Promise((resolve, reject) => {
    const params = {
        Key: key,
        Bucket: bucketName,
    };
    s3bucket.deleteObject(params, function (error, data) {
        if (error) {
            return reject(error);
        }
        return resolve(data);
    })
});

const fileSize = async (file) => {
    let size = false;
    let fileSize = file.bytes;
    const fileContentType = file.headers['content-type'];
    if (global.CONFIG['contentType']['image'].includes(fileContentType) === true) {
        if (fileSize > global.CONFIG['fileSize']['image']) {
            size = true;
        }
    }
    if (global.CONFIG['contentType']['audio'].includes(fileContentType) === true) {
        if (fileSize > global.CONFIG['fileSize']['audio']) {
            size = true;
        }
    }
    if (global.CONFIG['contentType']['video'].includes(fileContentType) === true) {
        if (fileSize > global.CONFIG['fileSize']['video']) {
            size = true;
        }
    }
    return size;
}

exports.createPoll = async (req, res) => {
    try {
        const params = req.body;
        const userID = params.UserID;
        const query = params.Query;
        const file = params.File;
        const chartOption = params.ChartOption;
        const thumbnailUrl = params.ThumbnailURL;
        const category = params.Category;
        const isPublic = params.IsPublic || false;
        const endDate = params.EndDate;
        const optionType = params.OptionType;
        const optionOne = params.OptionOne;
        const optionOneFile = params.OptionOneFile;
        const optionTwo = params.OptionTwo;
        const optionTwoFile = params.OptionTwoFile;
        const optionThree = params.OptionThree;
        const optionThreeFile = params.OptionThreeFile;
        const optionFour = params.OptionFour;
        const optionFourFile = params.OptionFourFile;
        const optionFive = params.OptionFive;
        const optionFiveFile = params.OptionFiveFile;
        const optionSix = params.OptionSix;
        const optionSixFile = params.OptionSixFile;

        const categoryArray = await Query.categoryArray(category);

        if (file && global.CONFIG['extension'].includes(path.extname(file.filename)) === false) {
            return new Exception('ValidationError', 'Please Provide Valid input type of File').sendError();
        } else if (file) {
            const size = await fileSize(file);
            if (size == true) {
                return new Exception('ValidationError', 'Please Provide Valid size of file').sendError();
            }
        }
        if (optionOneFile && global.CONFIG['extension'].includes(path.extname(optionOneFile.filename)) === false) {
            return new Exception('ValidationError', 'Please Provide Valid input type of optionOneFile').sendError();
        } else if (optionOneFile) {
            const size = await fileSize(optionOneFile);
            if (size == true) {
                return new Exception('ValidationError', 'Please Provide Valid size of optionOneFile').sendError();
            }
        }
        if (optionTwoFile && global.CONFIG['extension'].includes(path.extname(optionTwoFile.filename)) === false) {
            return new Exception('ValidationError', 'Please Provide Valid input type of optionTwoFile').sendError();
        } else if (optionTwoFile) {
            const size = await fileSize(optionTwoFile);
            if (size == true) {
                return new Exception('ValidationError', 'Please Provide Valid size of optionTwoFile').sendError();
            }
        }
        if (optionThreeFile && global.CONFIG['extension'].includes(path.extname(optionThreeFile.filename)) === false) {
            return new Exception('ValidationError', 'Please Provide Valid input type of optionThreeFile').sendError();
        } else if (optionThreeFile) {
            const size = await fileSize(optionThreeFile);
            if (size == true) {
                return new Exception('ValidationError', 'Please Provide Valid size of optionThreeFile').sendError();
            }
        }
        if (optionFourFile && global.CONFIG['extension'].includes(path.extname(optionFourFile.filename)) === false) {
            return new Exception('ValidationError', 'Please Provide Valid input type of optionFourFile').sendError();
        } else if (optionFourFile) {
            const size = await fileSize(optionFourFile);
            if (size == true) {
                return new Exception('ValidationError', 'Please Provide Valid size of optionFourFile').sendError();
            }
        }
        if (optionFiveFile && global.CONFIG['extension'].includes(path.extname(optionFiveFile.filename)) === false) {
            return new Exception('ValidationError', 'Please Provide Valid input type of optionFiveFile').sendError();
        } else if (optionFiveFile) {
            const size = await fileSize(optionFiveFile);
            if (size == true) {
                return new Exception('ValidationError', 'Please Provide Valid size of optionFiveFile').sendError();
            }
        }
        if (optionSixFile && global.CONFIG['extension'].includes(path.extname(optionSixFile.filename)) === false) {
            return new Exception('ValidationError', 'Please Provide Valid input type of optionSixFile').sendError();
        } else if (optionSixFile) {
            const size = await fileSize(optionSixFile);
            if (size == true) {
                return new Exception('ValidationError', 'Please Provide Valid size of optionSixFile').sendError();
            }
        }

        if (!userID) {
            return new Exception('ValidationError', 'Please Provide UserID').sendError();
        }

        if (!query) {
            return new Exception('ValidationError', 'Please Provide Query').sendError();
        }
        if (!category) {
            return new Exception('ValidationError', 'Please Provide Category').sendError();
        }
        // if(!QUERYTYPE[queryType]){
        //     return new Exception('ValidationError', 'Please Provide QueryType').sendError();
        // }
        // if(queryType > 1){
        //     if(!file){
        //         return new Exception('ValidationError', 'Please Provide Url').sendError();
        //     }
        // }
        // if(queryType == 2){
        if (!thumbnailUrl) {
            //return new Exception('ValidationError', 'Please Provide Thumbnail ').sendError();
        }
        // }
        if (!chartOption) {
            return new Exception('ValidationError', 'Please Provide ChartOption').sendError();
        }
        // if (!endDate) {
        //     return new Exception('ValidationError', 'Please Provide EndDate').sendError();
        // }
        // else {
        //     if (!Moment(endDate, 'DD-MM-YYYY HH:mm A', true).isValid()) {
        //         return new Exception('ValidationError', 'End Date Must Be DD-MM-YYYY HH:mm A (25/05/2020 05:10 AM) ').sendError();
        //     } else if (Moment(endDate, 'DD-MM-YYYY HH:mm A') < Moment()) {
        //         return new Exception('ValidationError', 'Please Provide Valid EndDate').sendError();
        //     }
        // }

        if (!optionType) {
            return new Exception('ValidationError', 'Please Provide OptionType').sendError();
        }
        if (!optionOne) {
            return new Exception('ValidationError', 'Please Provide OptionOne').sendError();
        }
        if (!optionTwo) {
            return new Exception('ValidationError', 'Please Provide optionTwo').sendError();
        }
        if (optionThree === '') {
            return new Exception('ValidationError', 'Please Enter text in OptionThree').sendError();
        }
        if (optionFour === '') {
            return new Exception('ValidationError', 'Please Enter text in OptionFour').sendError();
        }
        if (optionFive === '') {
            return new Exception('ValidationError', 'Please Enter text in OptionFive').sendError();
        }
        if (optionSix === '') {
            return new Exception('ValidationError', 'Please Enter text in OptionSix').sendError();
        }


        const postData = {};
        postData.UserId = userID;
        postData.Query = query;
        if (CHARTOPTIONTYPE[chartOption] === "Bar Chart") {
            postData.ChartOption = 1;
        } else if (CHARTOPTIONTYPE[chartOption] === "Pie Chart") {
            postData.ChartOption = 2;
        } else if (CHARTOPTIONTYPE[chartOption] === "Line Chart") {
            postData.ChartOption = 3;
        } else if (CHARTOPTIONTYPE[chartOption] === "Doughnut Chart") {
            postData.ChartOption = 4;
        }
        postData.Category = categoryArray;
        postData.IsPublic = isPublic;
        postData.TotalComments = 0;
        postData.TotalViews = 0;
        postData.TotalLikes = 0;
        postData.TotalDisLikes = 0;
        postData.TotalVotes = 0;
        postData.EndDate = Moment(endDate, 'DD/MM/YYYY').unix();
        postData.CreatedAt = new Moment();
        postData.InActive = false;
        postData.File = "";
        postData.ThumbnailURL = "";
        postData.MimeType = "";
        if (file) {
            const filepath = await fileUpload(file, true);
            postData.File = filepath[0];
            postData.ThumbnailURL = filepath[1];
            postData.MimeType = file.headers['content-type'];
        }
        const queryObj = new Query(postData);
        const result = await queryObj.save();

        const queryOptionData = {};
        let options = [];
        if (optionOne || optionOneFile) {
            const objectOne = {
                "Key": "A",
                "Answer": optionOne,
                "NumberOfVotes": 0,
                "VotedBy": [],
                "OptionOneFile": "",
                "OptionOneThumbnailURL": "",
                "OptionOneMimeType": ""
            }
            if (optionOneFile) {
                const filepath = await fileUpload(optionOneFile, false);
                objectOne.OptionOneFile = filepath[0];
                objectOne.OptionOneThumbnailURL = filepath[1];
                objectOne.OptionOneMimeType = optionOneFile.headers['content-type'];
            }
            options.push(objectOne);
        }
        if (optionTwo || optionTwoFile) {
            const objectTwo = {
                "Key": "B",
                "Answer": optionTwo,
                "NumberOfVotes": 0,
                "VotedBy": [],
                "OptionTwoFile": "",
                "OptionTwoThumbnailURL": "",
                "OptionTwoMimeType": ""
            }
            if (optionTwoFile) {
                const filepath = await fileUpload(optionTwoFile, false);
                objectTwo.OptionTwoFile = filepath[0];
                objectTwo.OptionTwoThumbnailURL = filepath[1];
                objectTwo.OptionTwoMimeType = optionTwoFile.headers['content-type'];
            }
            options.push(objectTwo);

        }
        if (optionThree || optionThreeFile) {
            const objectThree = {
                "Key": "C",
                "Answer": optionThree,
                "NumberOfVotes": 0,
                "VotedBy": [],
                "OptionThreeFile": "",
                "OptionThreeThumbnailURL": "",
                "OptionThreeMimeType": ""
            }
            if (optionThreeFile) {
                const filepath = await fileUpload(optionThreeFile, false);
                objectThree.OptionThreeFile = filepath[0];
                objectThree.OptionThreeThumbnailURL = filepath[1];
                objectThree.OptionThreeMimeType = optionThreeFile.headers['content-type'];
            }
            options.push(objectThree);

        }
        if (optionFour || optionFourFile) {
            const objectFour = {
                "Key": "D",
                "Answer": optionFour,
                "NumberOfVotes": 0,
                "VotedBy": [],
                "OptionFourFile": "",
                "OptionFourThumbnailURL": "",
                "OptionFourMimeType": ""
            }
            if (optionFourFile) {
                const filepath = await fileUpload(optionFourFile, false);
                objectFour.OptionFourFile = filepath[0];
                objectFour.OptionFourThumbnailURL = filepath[1];
                objectFour.OptionFourMimeType = optionFourFile.headers['content-type'];
            }
            options.push(objectFour);
        }
        if (optionFive || optionFiveFile) {
            const objectFive = {
                "Key": "E",
                "Answer": optionFive,
                "NumberOfVotes": 0,
                "VotedBy": [],
                "OptionFiveFile": "",
                "OptionFiveThumbnailURL": "",
                "OptionFiveMimeType": ""
            }
            if (optionFiveFile) {
                const filepath = await fileUpload(optionFiveFile, false);
                objectFive.OptionFiveFile = filepath[0];
                objectFive.OptionFiveThumbnailURL = filepath[1];
                objectFive.OptionFiveMimeType = optionFiveFile.headers['content-type'];
            }
            options.push(objectFive);
        }
        if (optionSix || optionSixFile) {
            const objectSix = {
                "Key": "F",
                "Answer": optionSix,
                "NumberOfVotes": 0,
                "VotedBy": [],
                "OptionSixFile": "",
                "OptionSixThumbnailURL": "",
                "OptionSixMimeType": ""
            }
            if (optionSixFile) {
                const filepath = await fileUpload(optionSixFile, false);
                objectSix.OptionSixFile = filepath[0];
                objectSix.OptionSixThumbnailURL = filepath[1];
                objectSix.OptionSixMimeType = optionSixFile.headers['content-type'];
            }
            options.push(objectSix);
        }
        const queryOptionObj = new QueryOption(queryOptionData);
        queryOptionObj.QueryId = result._id;
        queryOptionObj.OptionType = optionType;
        queryOptionObj.Options = options;

        await queryOptionObj.save();
        return res.send({ message: "Query Created Successfully!", Data: result });
    } catch (error) {
        console.log(error);
        return new Exception('GeneralError').sendError(error);
    }
}

exports.getMyQuery = async (req, res) => {
    try {
        const authToken = req.headers.authorization.split(' ')[1];
        const user = await User.findOne({ "AuthoToken": authToken }).lean();
        req.query.InternalCall = true;
        if (user) {
            req.query.UserId = user._id;
        }
        const result = await this.getQuery(req, res);
        return res.send({ message: "Success", Data: result });
    } catch (error) {
        console.log(error);
        return new Exception('GeneralError').sendError(error);
    }
}

exports.getQuery = async (req, res) => {
    try {
        let userId = '';
        if (req.query.UserId) {
            userId = req.query.UserId.toString();
        }
        const categoryId = req.query.CategoryId;
        let page = parseInt(req.query.PageNo) || 1;
        let maxRecords = parseInt(req.query.Rows) || 10;
        let internalCall = req.query.InternalCall || false;
        let isPublic;

        if (req.query.IsPublic === 'false' || req.query.IsPublic === false) {
            isPublic = false;
        } else if (req.query.IsPublic === 'true' || req.query.IsPublic === true) {
            isPublic = true;
        }
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
        const queryObj = { "InActive": false };
        let sortQuery = {};
        let currentDate = new Date();

        if (isPublic == false || isPublic == true) {
            queryObj.IsPublic = isPublic;
        }
        if (userId) {
            queryObj.UserId = userId;
        }
        switch (QUERYSEARCHTYPE[req.query.searchBy]) {
            case 'AllQueries':
                sortQuery.CreatedAt = -1;
                break;
            case 'ReacentQueries':
                sortQuery.CreatedAt = -1;
                break;
            case 'Top10Queries':
                sortQuery.TotalVotes = -1;
                break;
            case 'PopularQueries':
                sortQuery.TotalViews = -1;
                break;
            default:
                sortQuery.CreatedAt = -1;
        }

        if (categoryId) {
            const categoryArray = categoryId.split(',');
            const newCategoryArray = categoryArray.map(key => {
                if (key.length == 24) {
                    return ObjectId(key).toString();
                }
            });
            queryObj.Category = { $in: newCategoryArray }
        }
        let result = await Query.aggregate(
            [{ $match: queryObj },
            // {
            //     "$unwind": "$CategoryDetails"
            // },
            {
                $project: {
                    "_id": {
                        "$toString": "$_id"
                    },
                    "Query": 1,
                    "UserId": {
                        "$toObjectId": "$UserId"
                    },
                    "QueryType": 1,
                    "IsPublic": 1,
                    "CreatedAt": 1,
                    "EndDate": 1,
                    "File": 1,
                    "TotalComments": 1,
                    "ThumbnailURL": 1,
                    "TotalViews": 1,
                    "TotalLikes": 1,
                    "TotalDisLikes": 1,
                    "TotalVotes": 1,
                    "Category": 1,
                    "ChartOption": 1,
                    // "CategoryDetails.CategoryName":1
                }
            },
            {
                $lookup:
                {
                    from: 'users',
                    localField: 'UserId',
                    foreignField: '_id',
                    as: 'UserDetails'
                }
            },
            {
                $lookup: {
                    from: "queryoptions",
                    localField: "_id",
                    foreignField: "QueryId",
                    as: "Options"
                }
            },

            { $sort: sortQuery },
            {
                '$facet': {
                    Summary: [{ $count: "TotalRecords" }, { $addFields: { Page: parseInt(page) } }],
                    Records: [{ $skip: pageNumber }, { $limit: parseInt(maxRecords, 10) }] // add projection here wish you re-shape the docs
                }
            },
            ]
        );
        // let responseObject = {};
        // responseObject.Summary=result[0].Summary;
        // responseObject.Records=[];
        //console.log(result[0]);
        let newArray = result[0].Records.map(function (object) {

            object.EndDate = Moment.unix(object.EndDate).format('DD/MM/YYYY');
            // object.CreatedAt= Moment(object.CreatedAt).add(5.5, 'hours').format('DD-MM-YYYY HH:mm A');

            for (let i = 0; i < object.Options.length; i++) {
                for (let j = 0; j < object.Options[i].Options.length; j++) {
                    let percentage = Number((object.Options[i].Options[j].NumberOfVotes / object.TotalVotes) * 100);
                    if (percentage == 'null' || percentage == NaN || percentage == 'NaN') {
                        percentage = 0;
                    }
                    object.Options[i].Options[j]['Percentage'] = percentage;
                }
            }
            for (let i = 0; i < object.UserDetails.length; i++) {
                if (object.UserDetails[i].Image == 'null' || object.UserDetails[i].Image == null) {
                    object.UserDetails[i].Image = '';
                }
                delete object.UserDetails[i].Category;
                delete object.UserDetails[i].Token;
                delete object.UserDetails[i].Status;
                delete object.UserDetails[i].CreatedAt;
                delete object.UserDetails[i].UpdatedAt;
                delete object.UserDetails[i].AuthoToken;
                delete object.UserDetails[i].TokenExpireIn;
                delete object.UserDetails[i]._id;
                delete object.UserDetails[i].Type;
            }

            return object

        });
        if (!userId) {
            const authToken = req.headers.authorization.split(' ')[1];
            const user = await User.findOne({ "AuthoToken": authToken }).lean();
            userId = user._id;

        }
        for (let i = 0; i < newArray.length; i++) {
            if (newArray[i].Category.length > 0) {

                const categoryResult = await Category.find({ _id: { $in: newArray[i].Category } }, {
                    CategoryName: 1,
                    _id: 0
                }).lean();
                const categoryArray = categoryResult.map(function (object) {
                    return object.CategoryName;
                });
                newArray[i].Category = categoryArray;
            }

            const likeordislikeResult = await QueryLikeorDisLike.findOne({
                QueryId: newArray[i]._id,
                LikedBy: userId
            }).lean();
            newArray[i].Like = null;
            if (likeordislikeResult) {
                newArray[i].Like = likeordislikeResult.Like;
            }
        }

        const authToken = req.headers.authorization.split(' ')[1];
        const user = await User.findOne({ "AuthoToken": authToken }).lean();
        result[0].Records = newArray;
        for (let i = 0; i < result[0].Records.length; i++) {
            if (result[0].Records[i].EndDate < Moment().unix()) {
                newArray[i].IsEnded = true;
            } else {
                newArray[i].IsEnded = false;
            }
            for (let j = 0; j < result[0].Records[i].Options.length; j++) {
                for (let k = 0; k < result[0].Records[i].Options[j].Options.length; k++) {
                    if (result[0].Records[i].TotalVotes !== 0) {

                        for (let m = 0; m <= result[0].Records[i].Options[j].Options[k].VotedBy.length; m++) {
                            if (result[0].Records[i].Options[j].Options[k].VotedBy.includes(user._id.toString()) === true) {
                                result[0].Records[i].Options[j].Options[k].IsOptionVoted = true;
                                newArray[i].IsVoted = true;

                            } else if (result[0].Records[i].Options[j].Options[k].VotedBy.includes(user._id.toString()) === false) {
                                result[0].Records[i].Options[j].Options[k].IsOptionVoted = false;
                            }
                        }
                    } else {
                        result[0].Records[i].Options[j].Options[k].IsOptionVoted = false;
                        newArray[i].IsVoted = false;
                    }
                }
            }
        }
        if (internalCall) {
            return result;
        }

        return res.send({ message: "Success", Data: result });

    } catch (error) {
        console.log(error);
        return new Exception('GeneralError').sendError(error);
    }
}

exports.giveVote = async (req, res) => {
    try {
        const userID = req.body.UserID;
        const queryId = req.body.QueryId;
        const optionId = req.body.OptionId;
        if (!userID) {
            return res.send({
                Error: {
                    Message: 'Please Provide UserID'
                }
            });
        }
        if (!queryId) {
            return res.send({
                Error: {
                    Message: 'Please Provide Query Id'
                }
            });
        }
        if (!optionId) {
            return res.send({
                Error: {
                    Message: 'Please Provide Option Id'
                }
            });
        }

        const queryObj = await Query.findOne({ "_id": queryId }).lean();

        if (queryObj.UserId == userID) {
            return res.send({
                Error: {
                    Message: 'Sorry, You are the creator so you are not able to given vote'
                }
            });
        }
        const queryOptionObj = await QueryOption.findOne({ "QueryId": queryId }).lean();
        let userVotedForQuery = false;
        for (let i = 0; i < queryOptionObj.Options.length; i++) {
            if (!queryOptionObj.Options[i].VotedBy.includes(userID)) {

                if (queryOptionObj.Options[i]._id == optionId) {
                    queryOptionObj.Options[i].NumberOfVotes = queryOptionObj.Options[i].NumberOfVotes + 1;
                    queryOptionObj.Options[i].VotedBy.push(userID);
                }
            } else {

                userVotedForQuery = true;
            }
        }
        if (userVotedForQuery) {
            return res.send({
                Error: {
                    Message: 'User Already voted for this query'
                }
            });
        }
        await Query.findOneAndUpdate({ "_id": queryId }, {
            $inc: { TotalVotes: 1 }
        });
        const updateResult = await QueryOption.findOneAndUpdate({
            "QueryId": queryId,
            "Options._id": ObjectId(optionId)
        }, {
            $set: {
                "Options": queryOptionObj.Options,
                //"TotalVotes": queryOptionObj.TotalVotes + 1
            }
        }, { new: true });
        return res.send({ message: "Success", Data: updateResult });
    } catch (error) {
        console.log(error, "^^");
        return new Exception('GeneralError').sendError(error);
    }
}

exports.getQueryDetailById = async (req, res) => {
    try {
        const id = req.params.id;
        const queryObj = { "_id": ObjectId(id) };

        const result = await Query.aggregate(
            [{ $match: queryObj },
            {
                $project: {
                    "_id": {
                        "$toString": "$_id"
                    },
                    "Query": 1,
                    "UserId": 1,
                    "QueryType": 1,
                    "IsPublic": 1,
                    "CreatedAt": 1,
                    "EndDate": 1,
                    "File": 1,
                    "ThumbnailURL": 1,
                    "Category": 1,
                    "TotalVotes": 1,
                    "TotalViews": 1,
                    "TotalLikes": 1,
                    "TotalDisLikes": 1,
                    "MimeType": 1,
                    "ChartOption": 1,
                    "TotalComments": 1,
                }
            },
            {
                $lookup: {
                    from: "queryoptions",
                    localField: "_id",
                    foreignField: "QueryId",
                    as: "Options"
                }
            }
            ]
        );

        let responseObject = {};
        const authToken = req.headers.authorization.split(' ')[1];
        const user = await User.findOne({ "AuthoToken": authToken }).lean();
        for (let i = 0; i < result[0].Options[0].Options.length; i++) {
            const likeordislikeResult = await QueryLikeorDisLike.findOne({
                QueryId: id,
                LikedBy: user._id
            }).lean();
            result[0].Like = null;
            if (likeordislikeResult) {
                result[0].Like = likeordislikeResult.Like;
            }
            if (result[0].TotalVotes !== 0) {
                for (let m = 0; m <= result[0].Options[0].Options[i].VotedBy.length; m++) {
                    if (result[0].Options[0].Options[i].VotedBy.includes(user._id.toString()) === true) {
                        result[0].Options[0].Options[i].IsOptionVoted = true;
                        result[0].IsVoted = true;
                    } else if (result[0].Options[0].Options[i].VotedBy.includes(user._id.toString()) === false) {
                        result[0].Options[0].Options[i].IsOptionVoted = false;
                    }
                }
            } else {
                result[0].Options[0].Options[i].IsOptionVoted = false;
                result[0].IsVoted = false;
            }
            if (result[0].Options[0].Options[i].NumberOfVotes > 0) {

                result[0].Options[0].Options[i].Percentage = parseFloat((result[0].Options[0].Options[i].NumberOfVotes / result[0].TotalVotes) * 100).toFixed(2);
            } else {
                result[0].Options[0].Options[i].Percentage = 0;
            }
        }
        const categoryResult = await Category.find({ _id: { $in: result[0].Category } }, {
            CategoryName: 1,
            _id: 1,
            Image: 1,
        }).lean();
        const categoryArray = categoryResult.map(function (object) {
            return object;
        });

        responseObject.UserId = result[0].UserId;
        responseObject.QueryId = result[0]._id;
        responseObject.Query = result[0].Query;
        responseObject.QueryType = result[0].QueryType;
        responseObject.File = result[0].File;
        responseObject.ThumbnailURL = result[0].ThumbnailURL;
        responseObject.Category = result[0].Category;
        responseObject.Category = categoryArray;
        responseObject.IsPublic = result[0].IsPublic;
        responseObject.EndDate = Moment.unix(result[0].EndDate).format('DD/MM/YYYY'); //format('DD-MM-YYYY hh:mm A');
        responseObject.CreatedAt = result[0].CreatedAt;
        responseObject.Options = result[0].Options[0].Options;
        responseObject.OptionType = result[0].Options[0].OptionType;
        responseObject.TotalVotes = result[0].TotalVotes;
        responseObject.TotalViews = result[0].TotalViews;
        responseObject.TotalLikes = result[0].TotalLikes;
        responseObject.TotalDisLikes = result[0].TotalDisLikes;
        responseObject.MimeType = result[0].MimeType;
        responseObject.ChartOption = result[0].ChartOption
        responseObject.TotalComments = result[0].TotalComments;
        responseObject.IsVoted = result[0].IsVoted;
        responseObject.Like = result[0].Like;
        const userObj = await User.findOne({ "_id": ObjectId(result[0].UserId) }, {
            "_id": 1,
            "FirstName": 1,
            "LastName": 1,
            "Email": 1,
            "Image": 1
        }).lean();

        responseObject.UserDetails = userObj;
        return res.send({ message: "Success", Data: responseObject });
    } catch (error) {
        console.log(error);
        return new Exception('GeneralError').sendError(error);
    }
}

exports.deleteQuery = async (req, res) => {
    try {
        const queryId = req.params.id;
        const queryOption = await QueryOption.find({ "QueryId": queryId });
        for (let i = 0; i < queryOption.length; i++) {
            for (let j = 0; j < queryOption[i].Options.length; j++) {
                let fileToRemove = '';
                let mimeType = '';
                if (queryOption[i].Options.length > 0) {

                    if (queryOption[i].Options[j].OptionOneFile) {
                        fileToRemove = queryOption[i].Options[j].OptionOneFile.split('/').slice(-1)[0];
                        mimeType = queryOption[i].Options[j].OptionOneMimeType;
                        await fileRemove(fileToRemove, mimeType, false);
                        fileToRemove = queryOption[i].Options[j].OptionOneThumbnailURL.split('/').slice(-1)[0];
                        await fileRemove(fileToRemove, mimeType, false);
                    }
                    if (queryOption[i].Options[j].OptionTwoFile) {
                        fileToRemove = queryOption[i].Options[j].OptionTwoFile.split('/').slice(-1)[0];
                        mimeType = queryOption[i].Options[j].OptionTwoMimeType;
                        await fileRemove(fileToRemove, mimeType, false);
                        fileToRemove = queryOption[i].Options[j].OptionTwoThumbnailURL.split('/').slice(-1)[0];
                        await fileRemove(fileToRemove, mimeType, false);
                    }
                    if (queryOption[i].Options[j].OptionThreeFile) {
                        fileToRemove = queryOption[i].Options[j].OptionThreeFile.split('/').slice(-1)[0];
                        mimeType = queryOption[i].Options[j].OptionThreeMimeType;
                        await fileRemove(fileToRemove, mimeType, false);
                        fileToRemove = queryOption[i].Options[j].OptionThreeThumbnailURL.split('/').slice(-1)[0];
                        await fileRemove(fileToRemove, mimeType, false);
                    }
                    if (queryOption[i].Options[j].OptionFourFile) {
                        fileToRemove = queryOption[i].Options[j].OptionFourFile.split('/').slice(-1)[0];
                        mimeType = queryOption[i].Options[j].OptionFourMimeType;
                        await fileRemove(fileToRemove, mimeType, false);
                        fileToRemove = queryOption[i].Options[j].OptionFourThumbnailURL.split('/').slice(-1)[0];
                        await fileRemove(fileToRemove, mimeType, false);
                    }
                    if (queryOption[i].Options[j].OptionFiveFile) {
                        fileToRemove = queryOption[i].Options[j].OptionFiveFile.split('/').slice(-1)[0];
                        mimeType = queryOption[i].Options[j].OptionFiveMimeType;
                        await fileRemove(fileToRemove, mimeType, false);
                        fileToRemove = queryOption[i].Options[j].OptionFiveThumbnailURL.split('/').slice(-1)[0];
                        await fileRemove(fileToRemove, mimeType, false);
                    }
                    if (queryOption[i].Options[j].OptionSixFile) {
                        fileToRemove = queryOption[i].Options[j].OptionSixFile.split('/').slice(-1)[0];
                        mimeType = queryOption[i].Options[j].OptionSixMimeType;
                        await fileRemove(fileToRemove, mimeType, false);
                        fileToRemove = queryOption[i].Options[j].OptionSixThumbnailURL.split('/').slice(-1)[0];
                        await fileRemove(fileToRemove, mimeType, false);
                    }
                }
            }
        }

        const resultQuery = await Query.findOne({
            "_id": queryId
        });
        if (resultQuery.File) {
            let fileToRemove = resultQuery.File.split('/').slice(-1)[0];
            const mimeType = resultQuery.MimeType;
            await fileRemove(fileToRemove, mimeType, true);
            let thumbnailRemove = resultQuery.ThumbnailURL.split('/').slice(-1)[0];
            await fileRemove(thumbnailRemove, mimeType, true);
        }
        await QueryOption.remove({
            "QueryId": queryId
        });
        await Query.remove({
            "_id": queryId
        });
        await Queryview.remove({
            "QueryId": queryId
        });
        await QueryComment.remove({
            "QueryId": queryId
        });
        await QueryLikeOrDislkie.remove({
            "QueryId": queryId
        });
        return res.send({ message: "Query deleted successfully!!" });
    } catch (error) {
        console.log(error);
        return new Exception('GeneralError').sendError(error);
    }

}

exports.updatePoll = async (req, res) => {
    try {
        const queryId = req.params.id;
        const userID = req.body.UserID;
        const query = req.body.Query;
        const file = req.body.File;
        const queryFileRemoved = req.body.QueryFileRemoved || false;
        const chartOption = req.body.ChartOption;
        const thumbnailUrl = req.body.ThumbnailURL;
        const category = req.body.Category;
        const isPublic = req.body.IsPublic || false;
        const endDate = req.body.EndDate;
        const optionType = req.body.OptionType;
        const optionOne = req.body.OptionOne;
        const optionOneFile = req.body.OptionOneFile;
        const optionOneFileRemoved = req.body.OptionOneFileRemoved || false;
        const optionTwo = req.body.OptionTwo;
        const optionTwoFile = req.body.OptionTwoFile;
        const optionTwoFileRemoved = req.body.OptionTwoFileRemoved || false;
        const optionThree = req.body.OptionThree;
        const optionThreeFile = req.body.OptionThreeFile;
        const optionThreeFileRemoved = req.body.OptionThreeFileRemoved || false;
        const optionFour = req.body.OptionFour;
        const optionFourFile = req.body.OptionFourFile;
        const optionFourFileRemoved = req.body.OptionFourFileRemoved || false;
        const optionFive = req.body.OptionFive;
        const optionFiveFile = req.body.OptionFiveFile;
        const optionFiveFileRemoved = req.body.OptionFiveFileRemoved || false;
        const optionSix = req.body.OptionSix;
        const optionSixFile = req.body.OptionSixFile;
        const optionSixFileRemoved = req.body.OptionSixFileRemoved || false;

        const categoryArray = await Query.categoryArray(category);
        if (file && global.CONFIG['extension'].includes(path.extname(file.filename)) === false) {
            return new Exception('ValidationError', 'Please Provide Valid input type of File').sendError();
        } else if (file) {
            const size = await fileSize(file);
            if (size == true) {
                return new Exception('ValidationError', 'Please Provide Valid size of file').sendError();
            }
        }
        if (optionOneFile && global.CONFIG['extension'].includes(path.extname(optionOneFile.filename)) === false) {
            return new Exception('ValidationError', 'Please Provide Valid input type of optionOneFile').sendError();
        } else if (optionOneFile) {
            const size = await fileSize(optionOneFile);
            if (size == true) {
                return new Exception('ValidationError', 'Please Provide Valid size of optionOneFile').sendError();
            }
        }
        if (optionTwoFile && global.CONFIG['extension'].includes(path.extname(optionTwoFile.filename)) === false) {
            return new Exception('ValidationError', 'Please Provide Valid input type of optionTwoFile').sendError();
        } else if (optionTwoFile) {
            const size = await fileSize(optionTwoFile);
            if (size == true) {
                return new Exception('ValidationError', 'Please Provide Valid size of optionTwoFile').sendError();
            }
        }
        if (optionThreeFile && global.CONFIG['extension'].includes(path.extname(optionThreeFile.filename)) === false) {
            return new Exception('ValidationError', 'Please Provide Valid input type of optionThreeFile').sendError();
        } else if (optionThreeFile) {
            const size = await fileSize(optionThreeFile);
            if (size == true) {
                return new Exception('ValidationError', 'Please Provide Valid size of optionThreeFile').sendError();
            }
        }
        if (optionFourFile && global.CONFIG['extension'].includes(path.extname(optionFourFile.filename)) === false) {
            return new Exception('ValidationError', 'Please Provide Valid input type of optionFourFile').sendError();
        } else if (optionFourFile) {
            const size = await fileSize(optionFourFile);
            if (size == true) {
                return new Exception('ValidationError', 'Please Provide Valid size of optionFourFile').sendError();
            }
        }
        if (optionFiveFile && global.CONFIG['extension'].includes(path.extname(optionFiveFile.filename)) === false) {
            return new Exception('ValidationError', 'Please Provide Valid input type of optionFiveFile').sendError();
        } else if (optionFiveFile) {
            const size = await fileSize(optionFiveFile);
            if (size == true) {
                return new Exception('ValidationError', 'Please Provide Valid size of optionFiveFile').sendError();
            }
        }
        if (optionSixFile && global.CONFIG['extension'].includes(path.extname(optionSixFile.filename)) === false) {
            return new Exception('ValidationError', 'Please Provide Valid input type of optionSixFile').sendError();
        } else if (optionSixFile) {
            const size = await fileSize(optionSixFile);
            if (size == true) {
                return new Exception('ValidationError', 'Please Provide Valid size of optionSixFile').sendError();
            }
        }

        if (!userID) {
            return new Exception('ValidationError', 'Please Provide UserID').sendError();
        }

        if (!query) {
            return new Exception('ValidationError', 'Please Provide Query').sendError();
        }
        // if(queryType > 1){
        //     if(!url){
        //         return new Exception('ValidationError', 'Please Provide Url').sendError();
        //     }
        // }
        // if(queryType == 2){
        if (!thumbnailUrl) {
            //return new Exception('ValidationError', 'Please Provide Thumbnail ').sendError();
        }
        // }

        // if (!category) {
        //     return new Exception('ValidationError', 'Please Provide Category').sendError();
        // }
        // if(!queryType){
        //     return new Exception('ValidationError', 'Please Provide QueryType').sendError();
        // }

        if (!endDate) {
            return new Exception('ValidationError', 'Please Provide EndDate').sendError();
        } else {
            if (!Moment(endDate, 'DD/MM/YYYY', true).isValid()) {
                return new Exception('ValidationError', 'End Date Must Be DD-MM-YYYY hh:mm A (25/05/2020 05:10 AM) ').sendError();
            } else if (Moment(endDate, 'DD/MM/YYYY') < Moment()) {
                return new Exception('ValidationError', 'Please Provide Valid EndDate').sendError();
            }
        }
        if (!optionType) {
            return new Exception('ValidationError', 'Please Provide OptionType').sendError();
        }
        if (!optionOne) {
            return new Exception('ValidationError', 'Please Provide OptionOne').sendError();
        }
        if (!optionTwo) {
            return new Exception('ValidationError', 'Please Provide optionTwo').sendError();
        }
        if (optionThree === '') {
            return new Exception('ValidationError', 'Please Enter text in OptionThree').sendError();
        }
        if (optionFour === '') {
            return new Exception('ValidationError', 'Please Enter text in OptionFour').sendError();
        }
        if (optionFive === '') {
            return new Exception('ValidationError', 'Please Enter text in OptionFive').sendError();
        }
        if (optionSix === '') {
            return new Exception('ValidationError', 'Please Enter text in OptionSix').sendError();
        }

        const resultQuery = await Query.findOne({
            "_id": queryId
        });
        if (resultQuery.TotalVotes > 0) {
            await Query.updateOne({
                "_id": queryId,
            }, {
                $set: {
                    "ChartOption": chartOption,
                    "EndDate": Moment(endDate, 'DD-MM-YYYY').unix()
                }
            });
        }
        if (file) {
            let filepath = await fileUpload(file, true);
            await Query.updateOne({
                "_id": queryId,
            }, {
                $set: {
                    "File": filepath[0],
                    "ThumbnailURL": filepath[1],
                    "MimeType": file.headers['content-type']
                }
            });
            if (filepath) {
                let fileToRemove = resultQuery.File.split('/').slice(-1)[0];
                const mimeType = resultQuery.MimeType;
                await fileRemove(fileToRemove, mimeType, true);
                let thumbnailRemove = resultQuery.ThumbnailURL.split('/').slice(-1)[0];
                await fileRemove(thumbnailRemove, mimeType, true);
            }
        }
        if (queryFileRemoved == true || queryFileRemoved == 'true') {
            let fileToRemove = resultQuery.File.split('/').slice(-1)[0];
            const mimeType = resultQuery.MimeType;
            await fileRemove(fileToRemove, mimeType, true);
            let thumbnailRemove = resultQuery.ThumbnailURL.split('/').slice(-1)[0];
            await fileRemove(thumbnailRemove, mimeType, true);

            await Query.updateOne({
                "_id": queryId,
            }, {
                $set: {
                    "File": '',
                    "ThumbnailURL": '',
                    "MimeType": ''
                }
            });
        }
        if (resultQuery.TotalVotes == 0) {
            await Query.findOneAndUpdate({
                "_id": queryId,
            }, {
                $set: {
                    "UserId": userID,
                    "Query": query,
                    "Category": categoryArray,
                    "IsPublic": isPublic,
                    "ChartOption": chartOption,
                    "EndDate": Moment(endDate, 'DD-MM-YYYY').unix(),
                    "CreatedAt": new Moment(),
                    "InActive": false
                }
            });
            const queryOption = await QueryOption.findOne({ "QueryId": queryId });

            for (let j = 0; j < queryOption.Options.length; j++) {
                let fileToRemove = '';
                let mimeType = '';

                if (queryOption.Options[j].Key === 'A') {
                    await QueryOption.findOneAndUpdate({
                        QueryId: queryId,
                        Options: { $elemMatch: { "Key": queryOption.Options[j].Key } }
                    },
                        { $set: { "Options.$.Answer": optionOne } });


                    if (optionOneFile) {
                        let filepath = await fileUpload(optionOneFile, false);
                        await QueryOption.findOneAndUpdate({
                            QueryId: queryId,
                            Options: { $elemMatch: { "Key": queryOption.Options[j].Key } }
                        },
                            {
                                $set: {
                                    "Options.$.OptionOneFile": filepath[0],
                                    "Options.$.OptionOneThumbnailURL": filepath[1],
                                    "Options.$.OptionOneMimeType": optionOneFile.headers['content-type'],

                                }
                            });

                    }

                    if (optionOneFileRemoved == 'true' || optionOneFileRemoved == true) {


                        if (queryOption.Options[j].OptionOneFile) {
                            fileToRemove = queryOption.Options[j].OptionOneFile.split('/').slice(-1)[0];
                            mimeType = queryOption.Options[j].OptionOneMimeType;
                            await fileRemove(fileToRemove, mimeType, false);
                            fileToRemove = queryOption.Options[j].OptionOneThumbnailURL.split('/').slice(-1)[0];
                            await fileRemove(fileToRemove, mimeType, false);
                        }

                        await QueryOption.findOneAndUpdate({
                            QueryId: queryId,
                            Options: { $elemMatch: { "Key": queryOption.Options[j].Key } }
                        },
                            {
                                $set: {
                                    "Options.$.OptionOneFile": "",
                                    "Options.$.OptionOneThumbnailURL": "",
                                    "Options.$.OptionOneMimeType": "",

                                }
                            });
                    }
                }
                if (queryOption.Options[j].Key == 'B') {
                    await QueryOption.findOneAndUpdate({
                        QueryId: queryId,
                        Options: { $elemMatch: { "Key": queryOption.Options[j].Key } }
                    },
                        { $set: { "Options.$.Answer": optionTwo } });

                    if (optionTwoFile) {
                        let filepath = await fileUpload(optionTwoFile, false);
                        await QueryOption.findOneAndUpdate({
                            QueryId: queryId,
                            Options: { $elemMatch: { "Key": queryOption.Options[j].Key } }
                        },
                            {
                                $set: {
                                    "Options.$.OptionTwoFile": filepath[0],
                                    "Options.$.OptionTwoThumbnailURL": filepath[1],
                                    "Options.$.OptionTwoMimeType": optionTwoFile.headers['content-type'],

                                }
                            });

                    }
                    if (optionTwoFileRemoved == 'true' || optionTwoFileRemoved == true) {


                        if (queryOption.Options[j].OptionTwoFile) {
                            fileToRemove = queryOption.Options[j].OptionTwoFile.split('/').slice(-1)[0];
                            mimeType = queryOption.Options[j].OptionTwoMimeType;
                            await fileRemove(fileToRemove, mimeType, false);
                            fileToRemove = queryOption.Options[j].OptionTwoThumbnailURL.split('/').slice(-1)[0];
                            await fileRemove(fileToRemove, mimeType, false);
                        }

                        await QueryOption.findOneAndUpdate({
                            QueryId: queryId,
                            Options: { $elemMatch: { "Key": queryOption.Options[j].Key } }
                        },
                            {
                                $set: {
                                    "Options.$.OptionTwoFile": "",
                                    "Options.$.OptionTwoThumbnailURL": "",
                                    "Options.$.OptionTwoMimeType": "",

                                }
                            });
                    }
                }
                if (queryOption.Options[j].Key == 'C') {
                    await QueryOption.findOneAndUpdate({
                        QueryId: queryId,
                        Options: { $elemMatch: { "Key": queryOption.Options[j].Key } }
                    },
                        { $set: { "Options.$.Answer": optionThree } });

                    if (optionThreeFile) {
                        let filepath = await fileUpload(optionThreeFile, false);
                        await QueryOption.findOneAndUpdate({
                            QueryId: queryId,
                            Options: { $elemMatch: { "Key": queryOption.Options[j].Key } }
                        },
                            {
                                $set: {
                                    "Options.$.OptionThreeFile": filepath[0],
                                    "Options.$.OptionThreeThumbnailURL": filepath[1],
                                    "Options.$.OptionThreeMimeType": optionThreeFile.headers['content-type'],

                                }
                            });

                    }
                    if (optionThree == undefined || optionThree == 'undefined') {

                        await QueryOption.update(
                            {
                                QueryId: queryId,
                                Options: { $elemMatch: { "Key": queryOption.Options[j].Key } }
                            },
                            { $pull: { "Options": { "Key": queryOption.Options[j].Key } } }
                        );
                    }
                    if (optionThreeFileRemoved == 'true' || optionThreeFileRemoved == true) {


                        if (queryOption.Options[j].OptionThreeFile) {
                            fileToRemove = queryOption.Options[j].OptionThreeFile.split('/').slice(-1)[0];
                            mimeType = queryOption.Options[j].OptionThreeMimeType;
                            await fileRemove(fileToRemove, mimeType, false);
                            fileToRemove = queryOption.Options[j].OptionThreeThumbnailURL.split('/').slice(-1)[0];
                            await fileRemove(fileToRemove, mimeType, false);
                        }

                        await QueryOption.findOneAndUpdate({
                            QueryId: queryId,
                            Options: { $elemMatch: { "Key": queryOption.Options[j].Key } }
                        },
                            {
                                $set: {
                                    "Options.$.OptionThreeFile": "",
                                    "Options.$.OptionThreeThumbnailURL": "",
                                    "Options.$.OptionThreeMimeType": "",

                                }
                            });
                    }
                }
                if (queryOption.Options[j].Key == 'D') {
                    await QueryOption.findOneAndUpdate({
                        QueryId: queryId,
                        Options: { $elemMatch: { "Key": queryOption.Options[j].Key } }
                    },
                        { $set: { "Options.$.Answer": optionFour } });

                    if (optionFourFile) {
                        let filepath = await fileUpload(optionFourFile, false);
                        await QueryOption.findOneAndUpdate({
                            QueryId: queryId,
                            Options: { $elemMatch: { "Key": queryOption.Options[j].Key } }
                        },
                            {
                                $set: {
                                    "Options.$.OptionFourFile": filepath[0],
                                    "Options.$.OptionFourThumbnailURL": filepath[1],
                                    "Options.$.OptionFourMimeType": optionFourFile.headers['content-type'],

                                }
                            });

                    }

                    if (optionFour == undefined || optionFour == 'undefined') {

                        await QueryOption.update(
                            {
                                QueryId: queryId,
                                Options: { $elemMatch: { "Key": queryOption.Options[j].Key } }
                            },
                            { $pull: { "Options": { "Key": queryOption.Options[j].Key } } }
                        );
                    }
                    if (optionFourFileRemoved == 'true' || optionFourFileRemoved == true) {


                        if (queryOption.Options[j].OptionFourFile) {
                            fileToRemove = queryOption.Options[j].OptionFourFile.split('/').slice(-1)[0];
                            mimeType = queryOption.Options[j].OptionFourMimeType;
                            await fileRemove(fileToRemove, mimeType, false);
                            fileToRemove = queryOption.Options[j].OptionFourThumbnailURL.split('/').slice(-1)[0];
                            await fileRemove(fileToRemove, mimeType, false);
                        }

                        await QueryOption.findOneAndUpdate({
                            QueryId: queryId,
                            Options: { $elemMatch: { "Key": queryOption.Options[j].Key } }
                        },
                            {
                                $set: {
                                    "Options.$.OptionFourFile": "",
                                    "Options.$.OptionFourThumbnailURL": "",
                                    "Options.$.OptionFourMimeType": "",

                                }
                            });
                    }
                }
                if (queryOption.Options[j].Key == 'E') {
                    await QueryOption.findOneAndUpdate({
                        QueryId: queryId,
                        Options: { $elemMatch: { "Key": queryOption.Options[j].Key } }
                    },
                        { $set: { "Options.$.Answer": optionFive } });

                    if (optionFiveFile) {
                        let filepath = await fileUpload(optionFiveFile, false);
                        await QueryOption.findOneAndUpdate({
                            QueryId: queryId,
                            Options: { $elemMatch: { "Key": queryOption.Options[j].Key } }
                        },
                            {
                                $set: {
                                    "Options.$.OptionFiveFile": filepath[0],
                                    "Options.$.OptionFiveThumbnailURL": filepath[1],
                                    "Options.$.OptionFiveMimeType": optionFiveFile.headers['content-type'],

                                }
                            });
                    }
                    if (optionFive == undefined || optionFive == 'undefined') {

                        await QueryOption.update(
                            {
                                QueryId: queryId,
                                Options: { $elemMatch: { "Key": queryOption.Options[j].Key } }
                            },
                            { $pull: { "Options": { "Key": queryOption.Options[j].Key } } }
                        );
                    }

                    if (optionFiveFileRemoved == 'true' || optionFiveFileRemoved == true) {


                        if (queryOption.Options[j].OptionFiveFile) {
                            fileToRemove = queryOption.Options[j].OptionFiveFile.split('/').slice(-1)[0];
                            mimeType = queryOption.Options[j].OptionFiveMimeType;
                            await fileRemove(fileToRemove, mimeType, false);
                            fileToRemove = queryOption.Options[j].OptionFiveThumbnailURL.split('/').slice(-1)[0];
                            await fileRemove(fileToRemove, mimeType, false);
                        }

                        await QueryOption.findOneAndUpdate({
                            QueryId: queryId,
                            Options: { $elemMatch: { "Key": queryOption.Options[j].Key } }
                        },
                            {
                                $set: {
                                    "Options.$.OptionFiveFile": "",
                                    "Options.$.OptionFiveThumbnailURL": "",
                                    "Options.$.OptionFiveMimeType": "",

                                }
                            });
                    }
                }
                if (queryOption.Options[j].Key == 'F') {
                    await QueryOption.findOneAndUpdate({
                        QueryId: queryId,
                        Options: { $elemMatch: { "Key": queryOption.Options[j].Key } }
                    },
                        { $set: { "Options.$.Answer": optionSix } });

                    if (optionSixFile) {
                        let filepath = await fileUpload(optionSixFile, false);
                        await QueryOption.findOneAndUpdate({
                            QueryId: queryId,
                            Options: { $elemMatch: { "Key": queryOption.Options[j].Key } }
                        },
                            {
                                $set: {
                                    "Options.$.OptionSixFile": filepath[0],
                                    "Options.$.OptionSixThumbnailURL": filepath[1],
                                    "Options.$.OptionSixMimeType": optionSixFile.headers['content-type'],

                                }
                            });

                    }
                    if (optionSix == undefined || optionSix == 'undefined') {

                        await QueryOption.update(
                            {
                                QueryId: queryId,
                                Options: { $elemMatch: { "Key": queryOption.Options[j].Key } }
                            },
                            { $pull: { "Options": { "Key": queryOption.Options[j].Key } } }
                        );


                    }

                    if (optionSixFileRemoved == 'true' || optionSixFileRemoved == true) {


                        if (queryOption.Options[j].OptionSixFile) {
                            fileToRemove = queryOption.Options[j].OptionSixFile.split('/').slice(-1)[0];
                            mimeType = queryOption.Options[j].OptionSixMimeType;
                            await fileRemove(fileToRemove, mimeType, false);
                            fileToRemove = queryOption.Options[j].OptionSixThumbnailURL.split('/').slice(-1)[0];
                            await fileRemove(fileToRemove, mimeType, false);
                        }

                        await QueryOption.findOneAndUpdate({
                            QueryId: queryId,
                            Options: { $elemMatch: { "Key": queryOption.Options[j].Key } }
                        },
                            {
                                $set: {
                                    "Options.$.OptionSixFile": "",
                                    "Options.$.OptionSixThumbnailURL": "",
                                    "Options.$.OptionSixMimeType": "",

                                }
                            });
                    }
                }

                if (queryOption.Options[j].length > 0) {

                    if (queryOption.Options[j].OptionOneFile) {
                        fileToRemove = queryOption.Options[j].OptionOneFile.split('/').slice(-1)[0];
                        mimeType = queryOption.Options[j].OptionOneMimeType;
                        await fileRemove(fileToRemove, mimeType, false);
                        fileToRemove = queryOption.Options[j].OptionOneThumbnailURL.split('/').slice(-1)[0];
                        await fileRemove(fileToRemove, mimeType, false);
                    }

                    if (queryOption.Options[j].OptionTwoFile) {
                        fileToRemove = queryOption.Options[j].OptionTwoFile.split('/').slice(-1)[0];
                        mimeType = queryOption.Options[j].OptionTwoMimeType;
                        await fileRemove(fileToRemove, mimeType, false);
                        fileToRemove = queryOption.Options[j].OptionTwoThumbnailURL.split('/').slice(-1)[0];
                        await fileRemove(fileToRemove, mimeType, false);
                    }

                    if (queryOption.Options[j].OptionThreeFile) {
                        fileToRemove = queryOption.Options[j].OptionThreeFile.split('/').slice(-1)[0];
                        mimeType = queryOption.Options[j].OptionThreeMimeType;
                        await fileRemove(fileToRemove, mimeType, false);
                        fileToRemove = queryOption.Options[j].OptionThreeThumbnailURL.split('/').slice(-1)[0];
                        await fileRemove(fileToRemove, mimeType, false);
                    }
                    if (queryOption.Options[j].OptionFourFile) {
                        fileToRemove = queryOption.Options[j].OptionFourFile.split('/').slice(-1)[0];
                        mimeType = queryOption.Options[j].OptionFourMimeType;
                        await fileRemove(fileToRemove, mimeType, false);
                        fileToRemove = queryOption.Options[j].OptionFourThumbnailURL.split('/').slice(-1)[0];
                        await fileRemove(fileToRemove, mimeType, false);
                    }
                    if (queryOption.Options[j].OptionFiveFile) {
                        fileToRemove = queryOption.Options[j].OptionFiveFile.split('/').slice(-1)[0];
                        mimeType = queryOption.Options[j].OptionFiveMimeType;
                        await fileRemove(fileToRemove, mimeType, false);
                        fileToRemove = queryOption.Options[j].OptionFiveThumbnailURL.split('/').slice(-1)[0];
                        await fileRemove(fileToRemove, mimeType, false);
                    }
                    if (queryOption.Options[j].OptionSixFile) {
                        fileToRemove = queryOption.Options[j].OptionSixFile.split('/').slice(-1)[0];
                        mimeType = queryOption.Options[j].OptionSixMimeType;
                        await fileRemove(fileToRemove, mimeType, false);
                        fileToRemove = queryOption.Options[j].OptionSixThumbnailURL.split('/').slice(-1)[0];
                        await fileRemove(fileToRemove, mimeType, false);

                    }
                }
            }

            if (optionOne || optionOneFile) {

                const result = await QueryOption.findOne({
                    QueryId: queryId,
                    Options: { $elemMatch: { "Key": "A" } }
                });
                if (!result) {
                    await QueryOption.update({
                        QueryId: queryId
                    },
                        {
                            $push: {
                                "Options": {
                                    "Key": "B",
                                    "Answer": optionOne,
                                    "NumberOfVotes": 0,
                                    "VotedBy": [],
                                    "OptionOneFile": "",
                                    "OptionOneThumbnailURL": "",
                                    "OptionOneMimeType": ""

                                }
                            }
                        });
                    if (optionOneFile) {
                        let filepath = await fileUpload(optionOneFile, false);
                        await QueryOption.findOneAndUpdate({
                            QueryId: queryId,
                            Options: { $elemMatch: { "Key": "A" } }
                        },
                            {
                                $set: {
                                    "Options.$.OptionOneFile": filepath[0],
                                    "Options.$.OptionOneThumbnailURL": filepath[1],
                                    "Options.$.OptionOneMimeType": optionOneFile.headers['content-type'],

                                }
                            });

                    }
                }



            }

            if (optionTwo || optionTwoFile) {

                const result = await QueryOption.findOne({
                    QueryId: queryId,
                    Options: { $elemMatch: { "Key": "B" } }
                });
                if (!result) {
                    await QueryOption.update({
                        QueryId: queryId
                    },
                        {
                            $push: {
                                "Options": {
                                    "Key": "B",
                                    "Answer": optionTwo,
                                    "NumberOfVotes": 0,
                                    "VotedBy": [],
                                    "OptionTwoFile": "",
                                    "OptionTwoThumbnailURL": "",
                                    "OptionTwoMimeType": ""

                                }
                            }
                        });
                    if (optionTwoFile) {
                        let filepath = await fileUpload(optionTwoFile, false);
                        await QueryOption.findOneAndUpdate({
                            QueryId: queryId,
                            Options: { $elemMatch: { "Key": "B" } }
                        },
                            {
                                $set: {
                                    "Options.$.OptionTwoFile": filepath[0],
                                    "Options.$.OptionTwoThumbnailURL": filepath[1],
                                    "Options.$.OptionTwoMimeType": optionTwoFile.headers['content-type'],

                                }
                            });

                    }
                }



            }

            if (optionThree || optionThreeFile) {

                const result = await QueryOption.findOne({
                    QueryId: queryId,
                    Options: { $elemMatch: { "Key": "C" } }
                });
                if (!result) {
                    await QueryOption.update({
                        QueryId: queryId
                    },
                        {
                            $push: {
                                "Options": {
                                    "Key": "C",
                                    "Answer": optionThree,
                                    "NumberOfVotes": 0,
                                    "VotedBy": [],
                                    "OptionThreeFile": "",
                                    "OptionThreeThumbnailURL": "",
                                    "OptionThreeMimeType": ""

                                }
                            }
                        });
                    if (optionThreeFile) {
                        let filepath = await fileUpload(optionThreeFile, false);
                        await QueryOption.findOneAndUpdate({
                            QueryId: queryId,
                            Options: { $elemMatch: { "Key": "C" } }
                        },
                            {
                                $set: {
                                    "Options.$.OptionThreeFile": filepath[0],
                                    "Options.$.OptionThreeThumbnailURL": filepath[1],
                                    "Options.$.OptionThreeMimeType": optionThreeFile.headers['content-type'],

                                }
                            });

                    }
                }



            }

            if (optionFour || optionFourFile) {

                const result = await QueryOption.findOne({
                    QueryId: queryId,
                    Options: { $elemMatch: { "Key": "D" } }
                });
                if (!result) {
                    await QueryOption.update({
                        QueryId: queryId
                    },
                        {
                            $push: {
                                "Options": {
                                    "Key": "D",
                                    "Answer": optionFour,
                                    "NumberOfVotes": 0,
                                    "VotedBy": [],
                                    "OptionFourFile": "",
                                    "OptionFourThumbnailURL": "",
                                    "OptionFourMimeType": ""

                                }
                            }
                        });
                    if (optionFourFile) {
                        let filepath = await fileUpload(optionFourFile, false);
                        await QueryOption.findOneAndUpdate({
                            QueryId: queryId,
                            Options: { $elemMatch: { "Key": "D" } }
                        },
                            {
                                $set: {
                                    "Options.$.OptionFourFile": filepath[0],
                                    "Options.$.OptionFourThumbnailURL": filepath[1],
                                    "Options.$.OptionFourMimeType": optionFourFile.headers['content-type'],

                                }
                            });

                    }
                }



            }

            if (optionFive || optionFiveFile) {

                const result = await QueryOption.findOne({
                    QueryId: queryId,
                    Options: { $elemMatch: { "Key": "E" } }
                });
                if (!result) {
                    await QueryOption.update({
                        QueryId: queryId
                    },
                        {
                            $push: {
                                "Options": {
                                    "Key": "E",
                                    "Answer": optionFive,
                                    "NumberOfVotes": 0,
                                    "VotedBy": [],
                                    "OptionFiveFile": "",
                                    "OptionFiveThumbnailURL": "",
                                    "OptionFiveMimeType": ""

                                }
                            }
                        });
                    if (optionFiveFile) {
                        let filepath = await fileUpload(optionFiveFile, false);
                        await QueryOption.findOneAndUpdate({
                            QueryId: queryId,
                            Options: { $elemMatch: { "Key": "E" } }
                        },
                            {
                                $set: {
                                    "Options.$.OptionFiveFile": filepath[0],
                                    "Options.$.OptionFiveThumbnailURL": filepath[1],
                                    "Options.$.OptionFiveMimeType": optionFiveFile.headers['content-type'],

                                }
                            });

                    }
                }



            }

            if (optionSix || optionSixFile) {

                const result = await QueryOption.findOne({
                    QueryId: queryId,
                    Options: { $elemMatch: { "Key": "F" } }
                });
                if (!result) {
                    await QueryOption.update({
                        QueryId: queryId
                    },
                        {
                            $push: {
                                "Options": {
                                    "Key": "F",
                                    "Answer": optionSix,
                                    "NumberOfVotes": 0,
                                    "VotedBy": [],
                                    "OptionSixFile": "",
                                    "OptionSixThumbnailURL": "",
                                    "OptionSixMimeType": ""

                                }
                            }
                        });
                    if (optionSixFile) {
                        let filepath = await fileUpload(optionSixFile, false);
                        await QueryOption.findOneAndUpdate({
                            QueryId: queryId,
                            Options: { $elemMatch: { "Key": "F" } }
                        },
                            {
                                $set: {
                                    "Options.$.OptionSixFile": filepath[0],
                                    "Options.$.OptionSixThumbnailURL": filepath[1],
                                    "Options.$.OptionSixMimeType": optionSixFile.headers['content-type'],

                                }
                            });

                    }
                }



            }
        }
        return res.send({ message: 'Query Updated successfully!!' });
    } catch (error) {
        console.log(error);
        return new Exception('GeneralError').sendError(error);
    }
}

exports.escapeRegExp = (str) => {
    //escapeRegExp("All of these should be escaped: \ ^ $ * + ? . ( ) | { } [ ]");
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

exports.querylikeordislike = async (req, res) => {
    try {
        const like = req.body.Like;
        const likedBy = req.body.LikedBy;
        const queryId = req.params.queryid;

        if (typeof like !== "boolean" && like !== null) {
            return res.send({
                Error: {
                    Message: 'Please Provide valid input of Like'
                }
            });
        }
        if (!likedBy) {
            return res.send({
                Error: {
                    Message: 'Please Provide LikedBy'
                }
            });
        }
        const queryObj = await Query.findOne({ "_id": queryId }).lean();
        if (queryObj === null) {
            return res.send('Query not found.');
        }
        if (queryObj.UserId == likedBy) {
            return res.send({
                Error: {
                    Message: 'Sorry, You are the creator so you are not able to given Like'
                }
            });
        }
        const queryLikeObj = await QueryLikeorDisLike.findOne({ "QueryId": queryId, "LikedBy": likedBy });

        if (queryLikeObj && like === true && queryLikeObj.Like === true && queryLikeObj.LikedBy === likedBy) {
            return res.send({
                Error: {
                    Message: 'Sorry, You are already liked in this query'
                }
            });
        }
        if (queryLikeObj && like === false && queryLikeObj.Like === false && queryLikeObj.LikedBy === likedBy) {
            return res.send({
                Error: {
                    Message: 'Sorry, You are already disliked in this query'
                }
            });
        }
        if (queryLikeObj == null && like === null && queryObj.TotalLikes === 0) {
            return res.send({
                Error: {
                    Message: 'Sorry, You are not UnLike in this query'
                }
            });
        }
        if (queryLikeObj && like === null && queryObj.TotalLikes === 0) {
            return res.send({
                Error: {
                    Message: 'Sorry, You are not UnLike in this query'
                }
            });
        }
        let totalLikeObj = {};
        let successMessage = '';

        if (queryLikeObj && like === true && queryLikeObj.Like === null && queryLikeObj.LikedBy === likedBy) {
            await Query.findOneAndUpdate({ "_id": queryId }, {
                $inc: { TotalLikes: 1 }
            });
            await QueryLikeorDisLike.findOneAndUpdate({
                "QueryId": queryId,
                "LikedBy": likedBy
            }, {
                $set: {
                    Like: true
                },
            });
            successMessage = 'Query Liked successfully!!';
        }

        if (queryLikeObj && like === false && queryLikeObj.Like === null && queryLikeObj.LikedBy === likedBy) {
            await Query.findOneAndUpdate({ "_id": queryId }, {
                $inc: { TotalDisLikes: 1 }
            });
            await QueryLikeorDisLike.findOneAndUpdate({
                "QueryId": queryId,
                "LikedBy": likedBy
            }, {
                $set: {
                    Like: false
                }
            });
            successMessage = 'Query DisLiked successfully!!';
        }

        if (queryLikeObj && like === null && queryLikeObj.LikedBy === likedBy) {
            await Query.findOneAndUpdate({ "_id": queryId }, {
                $inc: { TotalLikes: -1 }
            });
            await QueryLikeorDisLike.findOneAndUpdate({
                "QueryId": queryId,
                "LikedBy": likedBy
            }, {
                $set: {
                    Like: null
                }
            });
            successMessage = 'Query UnLiked successfully!!';
        }

        if (queryLikeObj && like === true && queryLikeObj.Like === false && queryLikeObj.LikedBy === likedBy) {
            await Query.findOneAndUpdate({ "_id": queryId }, {
                $inc: { TotalDisLikes: -1, TotalLikes: 1 }
            });
            await QueryLikeorDisLike.findOneAndUpdate({
                "QueryId": queryId,
                "LikedBy": likedBy
            }, {
                $set: {
                    Like: true
                }
            });
            successMessage = 'Query Liked successfully!!';

        }
        if (queryLikeObj && like === false && queryLikeObj.Like === true && queryLikeObj.LikedBy === likedBy) {
            await Query.findOneAndUpdate({ "_id": queryId }, {
                $inc: { TotalDisLikes: 1, TotalLikes: -1 }
            });
            await QueryLikeorDisLike.findOneAndUpdate({
                "QueryId": queryId,
                "LikedBy": likedBy
            }, {
                $set: {
                    Like: false
                }
            });
            successMessage = 'Query DisLiked successfully!!';
        }
        const likeObject = {};
        likeObject.QueryId = queryId;
        likeObject.Like = like;
        likeObject.LikedBy = likedBy;
        likeObject.CreatedAt = new Moment();

        if (likeObject.Like === true && queryLikeObj === null) {
            await Query.findOneAndUpdate({ "_id": queryId }, {
                $inc: { TotalLikes: 1 }
            });
            const queryLikeorDislikeObj = new QueryLikeorDisLike(likeObject);
            await queryLikeorDislikeObj.save();
            successMessage = 'Query Liked successfully!!';
        }
        if (likeObject.Like === false && queryLikeObj === null) {
            await Query.findOneAndUpdate({ "_id": queryId }, {
                $inc: { TotalDisLikes: 1 }
            });
            const queryLikeorDislikeObj = new QueryLikeorDisLike(likeObject);
            await queryLikeorDislikeObj.save();
            successMessage = 'Query DisLiked successfully!!';
        }
        const query = await Query.findOne({ "_id": queryId }).lean();
        totalLikeObj.TotalLikes = query.TotalLikes;
        totalLikeObj.TotalDisLikes = query.TotalDisLikes;
        totalLikeObj.TotalComments = query.TotalComments;
        totalLikeObj.TotalVotes = query.TotalVotes;
        totalLikeObj.TotalViews = query.TotalViews;

        return res.send({ message: successMessage, Total: totalLikeObj });
    } catch (error) {
        console.log(error);
        return new Exception('GeneralError').sendError(error);
    }
}

exports.getQueryLikeOrDislike = async (req, res) => {
    try {
        const queryId = req.params.queryid;
        let page = parseInt(req.query.PageNo) || 1;
        let maxRecords = parseInt(req.query.Rows) || 10;

        const pageNumber = ((parseInt(page) - 1) * parseInt(maxRecords));

        if (page === undefined || page === null || page === '') {
            page = 1;
        }
        if (maxRecords === undefined || maxRecords === null || maxRecords === '') {
            maxRecords = 50;
        }

        const queryObj = { "QueryId": queryId };
        const result = await QueryLikeorDisLike.aggregate(
            [{ $match: queryObj },
            {
                $project: {
                    "QueryId": 1,
                    "Like": 1,
                    "LikedBy": {
                        "$toObjectId": "$LikedBy"
                    },
                    "CreatedAt": 1,
                    "UserDetails.FirstName": 1,
                    "UserDetails.LastName": 1
                }
            },
            {
                $lookup:
                {
                    from: 'users',
                    localField: 'LikedBy',
                    foreignField: '_id',
                    as: 'UserDetails',
                }
            },
            {
                $sort: { CreatedAt: -1 }
            },
            {
                '$facet': {
                    Summary: [{ $count: "TotalRecords" }, { $addFields: { Page: parseInt(page) } }],
                    Records: [{ $skip: pageNumber }, { $limit: parseInt(maxRecords, 10) }] // add projection here wish you re-shape the docs
                }
            }
            ]
        );

        return res.send({ message: "Success", Data: result });
    } catch (error) {
        return new Exception('GeneralError').sendError(error);
    }

}

exports.viewQuery = async (req, res) => {
    try {
        const queryId = req.params.queryid;
        const viewedBy = req.params.viewedby;

        // if (queryViewObj !== null && queryViewObj.ViewedBy === viewedBy) {
        //     return new Exception('ValidationError', 'Sorry, You are already viewed in this query').sendError();
        // }
        const viewObject = {};
        let totalLikeObj = {};
        let successMessage = '';
        viewObject.QueryId = queryId;
        viewObject.ViewedBy = viewedBy;
        viewObject.CreatedAt = new Moment();

        const queryView = await Queryview.findOne({ "QueryId": queryId, "ViewedBy": viewedBy });
        if (!queryView) {
            const queryViewObject = new Queryview(viewObject);
            await queryViewObject.save();
        }
        if (!queryView) {
            await Query.findByIdAndUpdate({ "_id": queryId }, {
                $inc: { TotalViews: 1 }
            });
        }
        const query = await Query.findOne({ "_id": queryId });
        totalLikeObj.TotalLikes = query.TotalLikes;
        totalLikeObj.TotalDisLikes = query.TotalDisLikes;
        totalLikeObj.TotalComments = query.TotalComments;
        totalLikeObj.TotalVotes = query.TotalVotes;
        totalLikeObj.TotalViews = query.TotalViews;
        successMessage = 'Query Viewed successfully!!';
        return res.send({ message: successMessage, Total: totalLikeObj });
    } catch (error) {
        console.log(error);
        return new Exception('GeneralError').sendError(error);
    }
}

exports.createComments = async (req, res) => {
    try {
        const queryId = req.params.id;
        const comment = req.body.Comment;
        const commentedBy = req.body.CommentedBy;
        if (!comment) {
            return res.send('Please Provide Comment');
        }
        if (!commentedBy) {
            return res.send('Please Provide CommentedBy');
        }
        const queryObj = await Query.findOne({ "_id": queryId }).lean();
        if (queryObj.UserId == commentedBy) {
            return res.send({
                Error: {
                    Message: 'Sorry, You are the creator so you are not able to given Comments'
                }
            });
        }
        const postComments = {};
        postComments.QueryId = queryId;
        postComments.ParentCommentId = null;
        postComments.Comment = comment;
        postComments.CommentedBy = commentedBy;
        postComments.TotalLikes = 0;
        postComments.CreatedAt = new Moment();
        const commentObj = new QueryComment(postComments);
        const result = await commentObj.save();

        await Query.findOneAndUpdate({ "_id": queryId }, {
            $inc: { TotalComments: 1 }
        });
        return res.send({ message: 'Success', data: result });
    } catch (error) {
        return new Exception('GeneralError').sendError(error);
    }
}

exports.commentReply = async (req, res) => {
    try {
        const commentId = req.params.commentid;
        const queryId = req.params.queryid;
        const comment = req.body.Comment;
        const commentedBy = req.body.CommentedBy;
        if (!comment) {
            return new Exception('ValidationError', 'Please Provide Comment').sendError();
        }
        if (!commentedBy) {
            return new Exception('ValidationError', 'Please Provide CommentedBy').sendError();
        }
        const postComments = {};
        postComments.ParentCommentId = commentId;
        postComments.QueryId = queryId;
        postComments.Comment = comment;
        postComments.CommentedBy = commentedBy;
        postComments.TotalLikes = 0;
        postComments.CreatedAt = new Moment();
        const commentObj = new QueryComment(postComments);
        const result = await commentObj.save();
        return res.send({ message: 'Comment Reply Added Successfully!!', data: result });
    } catch (error) {
        console.log(error);
        return new Exception('GeneralError').sendError(error);
    }
}

exports.deleteComment = async (req, res) => {
    try {
        const commentId = req.params.commentid;
        const queryId = req.params.queryid;
        await QueryComment.findOneAndRemove({
            "_id": commentId,
            "QueryId": queryId
        });
        await Query.findOneAndUpdate({ "_id": queryId }, {
            $inc: { TotalComments: -1 }
        });
        return res.send({ message: "Comment deleted successfully!!" });
    } catch (error) {
        return new Exception('GeneralError').sendError(error);
    }
}

exports.commentslikeordislike = async (req, res) => {
    try {
        const like = req.body.Like;
        const likedBy = req.body.LikedBy;
        const queryId = req.params.queryid;
        const commentId = req.params.commentid;

        if (typeof like !== "boolean") {
            return res.send('Please Provide valid input of Like');
        }
        if (!likedBy) {
            return res.send('Please Provide LikedBy');
        }
        const queryObj = await Query.findOne({ "_id": queryId }).lean();
        if (queryObj.UserId == likedBy) {
            return res.send({
                Error: { Message: 'Sorry, You are the creator so you are not able to given Like' }
            });
        }
        const commentObj = await QueryComment.findOne({ "_id": commentId });

        if (like === false && commentObj.Likes.length === 0) {
            return res.send({
                Error: { Message: 'Sorry, You can not unliked for this comment' }
            });
        }
        let successMessage = '';
        for (let i = 0; i < commentObj.Likes.length; i++) {
            if (like === true && commentObj.Likes[i].LikedBy === likedBy) {
                return res.send({
                    Error: { Message: 'Sorry, You are already liked in this comment' }
                });
            } else if (like === false && commentObj.Likes[i].LikedBy === likedBy) {
                await QueryComment.findOneAndUpdate(
                    { _id: commentId },
                    {
                        $pull: {
                            Likes: { LikedBy: likedBy }
                        },
                        $inc: { TotalLikes: -1 }
                    });
                successMessage = "Comment UnLiked successfully!!";
            }
        }
        const Likes = [];
        const likeObject = {};
        likeObject.Like = like;
        likeObject.LikedBy = likedBy;
        likeObject.CreatedAt = new Moment();
        Likes.push(likeObject);
        if (likeObject.Like === true) {
            await QueryComment.findOneAndUpdate({ "_id": commentId }, {
                $push: {
                    Likes: likeObject
                },
                $inc: { TotalLikes: 1 }
            });
            successMessage = "Comment Liked successfully!!";
        }
        let totalCommentLikeObj = {};
        const queryCommentObj = await QueryComments.findOne({ "_id": commentId }).lean();
        totalCommentLikeObj.TotalLikes = queryCommentObj.TotalLikes;
        return res.send({ message: successMessage, Total: totalCommentLikeObj });
    } catch (error) {
        console.log(error);
        return new Exception('GeneralError').sendError(error);
    }
}

exports.getComments = async (req, res) => {
    try {
        const queryId = req.params.queryid;
        let page = parseInt(req.query.PageNo) || 1;
        let maxRecords = parseInt(req.query.Rows) || 10;

        const pageNumber = ((parseInt(page) - 1) * parseInt(maxRecords));

        if (page === undefined || page === null || page === '') {
            page = 1;
        }
        if (maxRecords === undefined || maxRecords === null || maxRecords === '') {
            maxRecords = 50;
        }
        const queryObj = { "QueryId": queryId };

        const result = await QueryComment.aggregate(
            [{ $match: queryObj },
            {
                $project:
                {
                    "QueryId": 1,
                    "Comment": 1,
                    "CommentedBy": {
                        "$toObjectId": "$CommentedBy"
                    },
                    "TotalLikes":
                        1,
                    "CreatedAt":
                        1,
                    "Likes":
                        1,
                    "ParentCommentId": {
                        "$toObjectId": "$ParentCommentId"
                    },
                }
            },
            {
                $lookup:
                {
                    from: 'users',
                    localField: 'CommentedBy',
                    foreignField: '_id',
                    as: 'UserDetails'
                }
            },
            {
                $group: {
                    _id: "$ParentCommentId",
                    replay: { $push: "$$ROOT" },
                },

            },
            { $sort: { "_id": 1 } },
            {
                '$facet':
                {
                    Summary: [{ $count: "TotalRecords" }, { $addFields: { Page: parseInt(page) } }],
                    Records:
                        [{ $skip: pageNumber }, { $limit: parseInt(maxRecords, 10) }] // add projection here wish you re-shape the docs
                }
            }
            ]
        );
        const authToken = req.headers.authorization.split(' ')[1];
        const user = await User.findOne({ "AuthoToken": authToken }).lean();
        result[0].Records.map(function (object) {
            for (let i = 0; i < object.replay.length; i++) {
                if (object.replay[i].Likes.length === 0) {
                    object.replay[i].Like = false;
                }
                for (let k = 0; k < object.replay[i].Likes.length; k++) {
                    if (object.replay[i].Likes[k].LikedBy === user._id.toString()) {
                        object.replay[i].Like = true;
                    } else {
                        object.replay[i].Like = false;
                    }
                }
                for (let j = 0; j < object.replay[i].UserDetails.length; j++) {
                    if (object.replay[i].UserDetails[j].Image == 'null' || object.replay[i].UserDetails[j].Image == null) {
                        object.replay[i].UserDetails[j].Image = '';
                    }
                    delete object.replay[i].UserDetails[j].Category;
                    delete object.replay[i].UserDetails[j].Token;
                    delete object.replay[i].UserDetails[j].Status;
                    delete object.replay[i].UserDetails[j].UpdatedAt;
                    delete object.replay[i].UserDetails[j].AuthoToken;
                    delete object.replay[i].UserDetails[j].TokenExpireIn;
                    delete object.replay[i].UserDetails[j]._id;
                    delete object.replay[i].UserDetails[j].Type;
                    delete object.replay[i].UserDetails[j].Email;
                    delete object.replay[i].UserDetails[j].BirthDate;
                    delete object.replay[i].UserDetails[j].Mobile;
                    delete object.replay[i].UserDetails[j].CreatedAt;
                }
            }
        });
        return res.send({ message: 'Success', data: result });
    } catch (error) {
        console.log(error);
        return new Exception('GeneralError').sendError(error);
    }
}

exports.getCommentReply = async (req, res) => {
    try {
        const commentId = req.params.commentid;
        const queryId = req.params.queryid;
        let page = parseInt(req.query.PageNo) || 1;
        let maxRecords = parseInt(req.query.Rows) || 10;
        const pageNumber = ((parseInt(page) - 1) * parseInt(maxRecords));

        if (page === undefined || page === null || page === '') {
            page = 1;
        }
        if (maxRecords === undefined || maxRecords === null || maxRecords === '') {
            maxRecords = 50;
        }
        const queryObj = { "ParentCommentId": commentId, "QueryId": queryId };

        const result = await QueryComment.aggregate(
            [{ $match: queryObj },
            {
                $project:
                {
                    "QueryId": 1,
                    "Comment": 1,
                    "CommentedBy": {
                        "$toObjectId": "$CommentedBy"
                    },
                    "TotalLikes":
                        1,
                    "CreatedAt":
                        1,
                    "Likes":
                        1,
                    "ParentCommentId": {
                        "$toObjectId": "$ParentCommentId"
                    },
                }
            },
            {
                $lookup:
                {
                    from: 'users',
                    localField: 'CommentedBy',
                    foreignField: '_id',
                    as: 'UserDetails'
                }
            },
            { $sort: { "_id": 1 } },
            {
                '$facet':
                {
                    Summary: [{ $count: "TotalRecords" }, { $addFields: { Page: parseInt(page) } }],
                    Records:
                        [{ $skip: pageNumber }, { $limit: parseInt(maxRecords, 10) }] // add projection here wish you re-shape the docs
                }
            }
            ]
        );
        const authToken = req.headers.authorization.split(' ')[1];
        const user = await User.findOne({ "AuthoToken": authToken }).lean();
        result[0].Records.map(function (object) {
            if (object.Likes.length === 0) {
                object.Like = false;
            }
            for (let k = 0; k < object.Likes.length; k++) {
                if (object.Likes[k].LikedBy === user._id.toString()) {
                    object.Like = true;
                } else {
                    object.Like = false;
                }
            }
            for (let j = 0; j < object.UserDetails.length; j++) {
                if (object.UserDetails[j].Image == 'null' || object.UserDetails[j].Image == null) {
                    object.UserDetails[j].Image = '';
                }
                delete object.UserDetails[j].Category;
                delete object.UserDetails[j].Token;
                delete object.UserDetails[j].Status;
                delete object.UserDetails[j].UpdatedAt;
                delete object.UserDetails[j].AuthoToken;
                delete object.UserDetails[j].TokenExpireIn;
                delete object.UserDetails[j]._id;
                delete object.UserDetails[j].Type;
                delete object.UserDetails[j].Email;
                delete object.UserDetails[j].BirthDate;
                delete object.UserDetails[j].Mobile;
                delete object.UserDetails[j].CreatedAt;
            }
        });

        return res.send({ data: result });
    } catch (error) {
        console.log(error);
        return new Exception('GeneralError').sendError(error);
    }
}

exports.dropDatabase = async (req, res) => {
    try {
        const queryOption = await QueryOption.find({});
        for (let i = 0; i < queryOption.length; i++) {
            for (let j = 0; j < queryOption[i].Options.length; j++) {
                let fileToRemove = '';
                let mimeType = '';
                if (queryOption[i].Options[j].OptionOneFile) {
                    fileToRemove = queryOption[i].Options[j].OptionOneFile.split('/').slice(-1)[0];
                    mimeType = queryOption[i].Options[j].OptionOneMimeType;
                    await fileRemove(fileToRemove, mimeType, false);
                    fileToRemove = queryOption[i].Options[j].OptionOneThumbnailURL.split('/').slice(-1)[0];
                    await fileRemove(fileToRemove, mimeType, false);
                }
                if (queryOption[i].Options[j].OptionTwoFile) {
                    fileToRemove = queryOption[i].Options[j].OptionTwoFile.split('/').slice(-1)[0];
                    mimeType = queryOption[i].Options[j].OptionTwoMimeType;
                    await fileRemove(fileToRemove, mimeType, false);
                    fileToRemove = queryOption[i].Options[j].OptionTwoThumbnailURL.split('/').slice(-1)[0];
                    await fileRemove(fileToRemove, mimeType, false);
                }
                if (queryOption[i].Options[j].OptionThreeFile) {
                    fileToRemove = queryOption[i].Options[j].OptionThreeFile.split('/').slice(-1)[0];
                    mimeType = queryOption[i].Options[j].OptionThreeMimeType;
                    await fileRemove(fileToRemove, mimeType, false);
                    fileToRemove = queryOption[i].Options[j].OptionThreeThumbnailURL.split('/').slice(-1)[0];
                    await fileRemove(fileToRemove, mimeType, false);
                }
                if (queryOption[i].Options[j].OptionFourFile) {
                    fileToRemove = queryOption[i].Options[j].OptionFourFile.split('/').slice(-1)[0];
                    mimeType = queryOption[i].Options[j].OptionFourMimeType;
                    await fileRemove(fileToRemove, mimeType, false);
                    fileToRemove = queryOption[i].Options[j].OptionFourThumbnailURL.split('/').slice(-1)[0];
                    await fileRemove(fileToRemove, mimeType, false);
                }
                if (queryOption[i].Options[j].OptionFiveFile) {
                    fileToRemove = queryOption[i].Options[j].OptionFiveFile.split('/').slice(-1)[0];
                    mimeType = queryOption[i].Options[j].OptionFiveMimeType;
                    await fileRemove(fileToRemove, mimeType, false);
                    fileToRemove = queryOption[i].Options[j].OptionFiveThumbnailURL.split('/').slice(-1)[0];
                    await fileRemove(fileToRemove, mimeType, false);
                }
                if (queryOption[i].Options[j].OptionSixFile) {
                    fileToRemove = queryOption[i].Options[j].OptionSixFile.split('/').slice(-1)[0];
                    mimeType = queryOption[i].Options[j].OptionSixMimeType;
                    await fileRemove(fileToRemove, mimeType, false);
                    fileToRemove = queryOption[i].Options[j].OptionSixThumbnailURL.split('/').slice(-1)[0];
                    await fileRemove(fileToRemove, mimeType, false);
                }
            }
        }
        const query = await Query.find({});
        for (let i = 0; i < query.length; i++) {
            if (query[i].File) {
                let fileToRemove = query[i].File.split('/').slice(-1)[0];
                const mimeType = query[i].MimeType;
                await fileRemove(fileToRemove, mimeType, true);
                let thumbnailRemove = query[i].ThumbnailURL.split('/').slice(-1)[0];
                await fileRemove(thumbnailRemove, mimeType, true);
            }
        }
        const user = await User.find({});
        for (let i = 0; i < user.length; i++) {
            if (user[i].Image) {
                let fileToRemove = user[i].Image.split('/').slice(-1)[0];
                const mimeType = user[i].MimeType;
                await fileRemove(fileToRemove, mimeType, null);
                let thumbnailRemove = user[i].ThumbnailURL.split('/').slice(-1)[0];
                await fileRemove(thumbnailRemove, mimeType, null);
            }
        }
        await QueryOption.remove();
        await Query.remove();
        await Queryview.remove();
        await Invitee.remove();
        await QueryComments.remove();
        await QueryLikeOrDislkie.remove();
        await User.remove();

        return new Response({ message: "Drop Database successfully!!" }).sendResponse();
    } catch (e) {
        console.log(e);
        return new Exception('GeneralError').sendError(e);
    }
}


