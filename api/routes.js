
module.exports = app => {
    const usersController = require('./controllers/users_controller');
    const categoryController = require('./controllers/categories_controller');
    const pollsController =  require('./controllers/polls_controller');
   
    var router = require("express").Router();

    router.post("/voteme/signup", usersController.votemeSignUp);
    router.get("/voteme/:id/profile", usersController.getProfile);
    router.get("/voteme/users", usersController.getUsers);
    router.post("/voteme/logout", usersController.logout);
    router.put("/voteme/updateusercategory", usersController.updateUserCategory);
    router.delete("/voteme/:id/delete", usersController.deleteUserProfile);
    router.put("/voteme/:id/profile", usersController.updateProfile);

    router.post("/voteme/createcategory", categoryController.createCategory);
    router.get("/voteme/category", categoryController.getCategory);
    router.get("/voteme/updatecategory/:categoryid", categoryController.updateCategory);

    router.post("/voteme/createpoll", pollsController.createPoll);
    router.put("/voteme/editquery/:id", pollsController.updatePoll);
    router.get("/voteme/query", pollsController.getQuery);
    router.get("/voteme/myquery", pollsController.getMyQuery);
    router.get("/voteme/givevote", pollsController.giveVote);
    router.get("/voteme/querydetail/:id", pollsController.getQueryDetailById);
    router.delete("/voteme/deletequery/:id", pollsController.deleteQuery);
    router.post("/voteme/:queryid/likeordislike", pollsController.querylikeordislike);
    router.get("/voteme/:queryid/likeordislike", pollsController.getQueryLikeOrDislike);
    router.get("/voteme/:queryid/queryview/:viewedby", pollsController.viewQuery);
    router.post("/voteme/:id/createComments", pollsController.createComments);
    router.post("/voteme/:queryid/comment/:commentid/likeordislike", pollsController.commentslikeordislike);
    router.post("/voteme/:queryid/comment/:commentid/reply", pollsController.commentReply);
    router.get("/voteme/:queryid/getComments", pollsController.getComments);
    router.get("/voteme/:queryid/comment/:commentid/reply", pollsController.getCommentReply);
    router.delete("/voteme/:queryid/comment/:commentid", pollsController.deleteComment);

    app.use('/', router);
  };