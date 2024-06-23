const router = require("express").Router();
const { myMulter, HME } = require("../../services/multer");

const { uploadPdfs, getAiResponse ,getAiResponseWithoutPdf, signin, signup,getUserChats} = require("./controller/user.controller");

    router.post("/uploadPdf", myMulter(["application/pdf"], true), HME, uploadPdfs);
router.post("/getAiResponse", getAiResponse);
router.post("/getAiResponseWithoutPdf", getAiResponseWithoutPdf);
router.post("/signin", signin);
router.post("/signup", signup);
router.post("/getUserChats",getUserChats)

module.exports = router;
