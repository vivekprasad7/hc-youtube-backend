import multer from "multer";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "./public/temp")
    },
    filename: function (req, file, cb) {

      cb(null, file.originalname)  // not a good idea, as user can upload files with same name. it needs to be tweaked. but since files are stored temporarily here and removed after getting uploaded to cloudinary. We are using the original name given by user
    }
  })

export const upload = multer({ 
    storage, 
})