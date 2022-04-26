'use strict';
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});
let multer = require('multer');
let upload = multer();
app.use(upload.any());

require("./api/routes")(app);



const ENV = process.env.NODE_ENV || 'develop';
const configFile = './config/environments/' + ENV + '.json';
global.CONFIG = require(configFile);
global.ROOT_PATH = __dirname;
var path = require('path');
const Moment = require('moment');
const User = require('./api/models/user');
global.FRONT_ROOT_PATH = path.join(global.ROOT_PATH, '../frontend_app');
global.EXCEPTIONS = require('./config/exceptions');
global.APIS = require('./config/apis');
global.Local = "en";
const Exception = require('./lib/exception');

const Mongo = require('./config/mongodb').Mongo;
const AccessLog = require('./lib/access_log');


// set port, listen for requests
app.listen(8080, () => {
  console.log(`Server is running on port `, 8080);
})