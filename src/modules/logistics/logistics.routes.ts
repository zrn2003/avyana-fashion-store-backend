import { Router } from 'express';
import { PincodeController } from './pincode.controller';

const router = Router();

// Public Pincode Directory Lookup (Used by checkout & customer profile)
router.get('/pincode/:pincode', PincodeController.getPincodeDetails);

export default router;
