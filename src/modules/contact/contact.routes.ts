import {Router} from 'express';
import authenticateUser from '../../middlewares/auth.middleware';
import { contactUs } from './contact.controllers';

const router = Router();

router.post('/', authenticateUser, contactUs);
export default router;