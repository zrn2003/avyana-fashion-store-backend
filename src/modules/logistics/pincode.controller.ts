import { Request, Response, NextFunction } from 'express';
import { PincodeService } from './pincode.service';
import { sendSuccess } from '../../utils/response';

export class PincodeController {
  static async getPincodeDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { pincode } = req.params;
      const details = await PincodeService.lookup(pincode);

      if (!details) {
        return res.status(404).json({
          success: false,
          message: `Postal PIN Code "${pincode}" not found or invalid format. Please check the 6-digit number.`,
        });
      }

      return sendSuccess(res, details, 'Pincode details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}
