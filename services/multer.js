const multer = require('multer');

const HME = (error, req, res, next) => {
  if (error) {
    res.status(400).json({ message: 'Multer error', error });
  } else {
    next();
  }
};

function myMulter(allowedTypes, multiple = false) {
  const storage = multer.memoryStorage();
  function fileFilter(req, file, cb) {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only specific file types are allowed'), false);
    }
  }

  if (multiple) {
    return multer({ storage, fileFilter }).array('files');
  } else {
    return multer({ storage, fileFilter }).single('file');
  }
}

module.exports = {
  myMulter,
  HME
};
