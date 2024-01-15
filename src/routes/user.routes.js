import {Router} from "express"
import { registerUser } from "../controllers/user.controller.js"  // we can take this name only if we are NOT using export default

import { upload } from "../middlewares/multer.middleware.js"

const router = Router()

router.route("/register").post(
    upload.fields(
        [
            {
                name:"avatar",
                maxCount:1
            },
            {
                name:"coverImage",
                maxCount:1
            }
        ]
    ),
    registerUser
    )

export default router