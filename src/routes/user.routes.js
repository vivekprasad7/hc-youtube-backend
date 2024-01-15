import {Router} from "express"
import { registerUser } from "../controllers/user.controller.js"  // we can take this name only if we are NOT using export default

const router = Router()

router.route("/register").post(registerUser)

export default router